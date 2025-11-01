import * as path from "node:path";
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import type { FunctionConfigManager } from "./function-config-manager";
import type {
  OpenNextFunctionOrigin,
  OpenNextOutput,
  ResolvedFunctionSettings,
} from "./types";

export interface FunctionOriginResult {
  functionUrl: aws.lambda.FunctionUrl;
  originId: string;
}

/**
 * Handles dynamic discovery and creation of Lambda functions from OpenNext output
 */
export class DynamicFunctionHandler {
  private readonly openNextOutput: OpenNextOutput;
  private readonly configManager: FunctionConfigManager;
  private readonly siteName: string;
  private readonly sitePath: string;
  private readonly baseEnvironment: Record<string, pulumi.Input<string>>;
  private readonly parent: pulumi.ComponentResource;
  private readonly grantPermissionsCallback: (
    role: aws.iam.Role,
    functionName: string,
  ) => void;

  constructor(
    openNextOutput: OpenNextOutput,
    configManager: FunctionConfigManager,
    siteName: string,
    sitePath: string,
    baseEnvironment: Record<string, pulumi.Input<string>>,
    parent: pulumi.ComponentResource,
    grantPermissionsCallback: (
      role: aws.iam.Role,
      functionName: string,
    ) => void,
  ) {
    this.openNextOutput = openNextOutput;
    this.configManager = configManager;
    this.siteName = siteName;
    this.sitePath = sitePath;
    this.baseEnvironment = baseEnvironment;
    this.parent = parent;
    this.grantPermissionsCallback = grantPermissionsCallback;
  }

  /**
   * Discovers all function origins from OpenNext output, excluding S3 origins
   * @returns Array of function origin entries with their names and configurations
   */
  discoverFunctionOrigins(): Array<{
    name: string;
    origin: OpenNextFunctionOrigin;
  }> {
    const functionOrigins: Array<{
      name: string;
      origin: OpenNextFunctionOrigin;
    }> = [];

    // Iterate through all origins and filter for function types
    for (const [originName, originConfig] of Object.entries(
      this.openNextOutput.origins,
    )) {
      // Skip S3 origins - we only want function origins
      if (originConfig.type === "s3") {
        continue;
      }

      // Only process function-type origins
      if (originConfig.type === "function") {
        functionOrigins.push({
          name: originName,
          origin: originConfig as OpenNextFunctionOrigin,
        });
      }
    }

    return functionOrigins;
  }

  /**
   * Creates all function origins dynamically from discovered functions
   * @returns Record mapping function names to their created resources
   */
  createAllFunctionOrigins(): Record<string, FunctionOriginResult> {
    const discoveredFunctions = this.discoverFunctionOrigins();
    const functionOrigins: Record<string, FunctionOriginResult> = {};

    for (const { name, origin } of discoveredFunctions) {
      const settings = this.configManager.getFunctionSettings(name);
      const result = this.createFunctionOrigin(name, origin, settings);
      functionOrigins[name] = result;
    }

    return functionOrigins;
  }

  /**
   * Creates a single function origin with the specified settings
   * @param name Function name (used for resource naming)
   * @param origin OpenNext function origin configuration
   * @param settings Resolved function settings (memory, timeout, runtime, environment)
   * @returns Function URL and origin ID for CloudFront configuration
   */
  createFunctionOrigin(
    name: string,
    origin: OpenNextFunctionOrigin,
    settings: ResolvedFunctionSettings,
  ): FunctionOriginResult {
    // Merge base environment with function-specific environment
    const environment = {
      variables: {
        ...this.baseEnvironment,
        ...settings.environment,
      },
    };

    // Create IAM role for the function
    const role = new aws.iam.Role(
      `${this.siteName}-${name}-origin-lambda-role`,
      {
        assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
          Service: "lambda.amazonaws.com",
        }),
      },
      { parent: this.parent },
    );

    // Create the Lambda function with user-configured settings
    const fn = new aws.lambda.Function(
      `${this.siteName}-${name}-origin-lambda`,
      {
        handler: origin.handler,
        runtime: settings.runtime as aws.lambda.Runtime,
        environment,
        timeout: settings.timeout,
        memorySize: settings.memory,
        role: role.arn,
        code: new pulumi.asset.FileArchive(
          path.join(this.sitePath, origin.bundle),
        ),
      },
      { parent: this.parent },
    );

    // Grant IAM permissions to the function role
    this.grantPermissionsCallback(role, name);

    // Create function URL with appropriate invoke mode based on streaming
    const functionUrl = new aws.lambda.FunctionUrl(
      `${this.siteName}-${name}-origin-lambda-url`,
      {
        functionName: fn.arn,
        authorizationType: "NONE",
        invokeMode: origin.streaming ? "RESPONSE_STREAM" : "BUFFERED",
      },
      { parent: this.parent },
    );

    return {
      functionUrl,
      originId: name,
    };
  }

  /**
   * Generates CloudFront origins from function origin results
   * @param functionOrigins Record of function origins created by createAllFunctionOrigins
   * @returns Array of CloudFront distribution origins
   */
  generateCloudFrontOrigins(
    functionOrigins: Record<string, FunctionOriginResult>,
  ): aws.types.input.cloudfront.DistributionOrigin[] {
    const origins: aws.types.input.cloudfront.DistributionOrigin[] = [];

    for (const [functionName, result] of Object.entries(functionOrigins)) {
      // Map origin names to match CloudFront behavior expectations
      let originId = functionName;
      if (functionName === "imageOptimizer") {
        // Keep imageOptimizer as-is for CloudFront behaviors
        originId = "imageOptimizer";
      }

      const origin: aws.types.input.cloudfront.DistributionOrigin = {
        originId: originId,
        domainName: result.functionUrl.functionUrl.apply(
          (url) => url.split("//")[1].split("/")[0],
        ),
        customOriginConfig: {
          httpPort: 80,
          httpsPort: 443,
          originProtocolPolicy: "https-only",
          originReadTimeout: 10,
          originSslProtocols: ["TLSv1.2"],
        },
      };

      origins.push(origin);
    }

    return origins;
  }

  /**
   * Generates CloudFront behaviors using existing behavior mapping from OpenNext output
   * @returns Array of CloudFront ordered cache behaviors
   */
  generateCloudFrontBehaviors(): aws.types.input.cloudfront.DistributionOrderedCacheBehavior[] {
    // Filter out the default behavior (pattern "*") as it's handled separately
    const orderedBehaviors = this.openNextOutput.behaviors.filter(
      (b) => b.pattern !== "*",
    );

    return orderedBehaviors.map((behavior) => {
      // Map origin names to match our origin IDs
      let originId = behavior.origin as string;
      if (behavior.origin === "imageOptimization") {
        originId = "imageOptimizer";
      }

      // Return the behavior structure that will be completed by the caller
      // with cache policies and function associations
      return {
        pathPattern: behavior.pattern,
        targetOriginId: originId,
        // Note: Cache policies, origin request policies, and function associations
        // will be added by the calling code in NextJsSite
      } as aws.types.input.cloudfront.DistributionOrderedCacheBehavior;
    });
  }

  /**
   * Gets the default behavior configuration from OpenNext output
   * @returns The default behavior configuration or undefined if not found
   */
  getDefaultBehavior(): { pattern: string; origin: string } | undefined {
    const behavior = this.openNextOutput.behaviors.find(
      (b) => b.pattern === "*",
    );
    if (behavior?.origin) {
      return { pattern: behavior.pattern, origin: behavior.origin };
    }
    return undefined;
  }
}
