import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as path from "node:path";
import type { WarmerArgs, WarmerConfig } from "../../types";
import { createLoggingPolicy } from "../shared/iam";
import { createLambdaRole } from "../shared/utils";

/**
 * Internal configuration with all required properties (after resolving defaults)
 */
interface ResolvedWarmerConfig {
  enabled: boolean;
  schedule: string;
  concurrency: number;
}

/**
 * NextJsWarmer - Component for warming Lambda functions using OpenNext's warmer function
 *
 * This component creates a dedicated warmer Lambda function that invokes other functions
 * to keep them warm and reduce cold start latency.
 *
 * How it works:
 * 1. Creates a warmer Lambda function from OpenNext's warmer bundle
 * 2. Configures it with WARM_PARAMS environment variable (list of functions to warm)
 * 3. Sets up EventBridge rule to invoke the warmer on a schedule
 * 4. The warmer function invokes each target function with a special "warmer" payload
 *
 * Features:
 * - Uses OpenNext's built-in warmer function
 * - Configurable warming schedule (default: every 5 minutes)
 * - Support for multiple concurrent invocations per function
 * - Automatic permission management
 */
export class NextJsWarmer extends pulumi.ComponentResource {
  public warmerFunction?: aws.lambda.Function;
  public eventRule?: aws.cloudwatch.EventRule;
  public eventTarget?: aws.cloudwatch.EventTarget;

  constructor(
    name: string,
    args: WarmerArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super("nextjs:warmer:Warmer", name, {}, opts);

    const config = this.resolveConfig(args.config);

    if (!config.enabled || !args.openNextOutput.additionalProps?.warmer) {
      return;
    }

    // Create the warmer Lambda function
    this.warmerFunction = this.createWarmerFunction(args, config);

    // Create EventBridge rule for warming schedule
    this.eventRule = this.createEventRule(args.name, config);

    // Grant EventBridge permission to invoke the warmer function
    this.grantEventBridgePermission(args.name);

    // Add warmer function as EventBridge target
    this.eventTarget = this.createEventTarget(args.name);
  }

  private resolveConfig(config?: WarmerConfig): ResolvedWarmerConfig {
    return {
      enabled: config?.enabled ?? false,
      schedule: config?.schedule ?? "rate(5 minutes)",
      concurrency: config?.concurrency ?? 1,
    };
  }

  private shouldWarmFunction(
    functionKey: string,
    config?: WarmerConfig,
  ): boolean {
    if (!config?.functions?.[functionKey]) {
      return true; // Warm by default if not specified
    }
    return config.functions[functionKey].enabled !== false;
  }

  private getFunctionConcurrency(
    functionKey: string,
    config: ResolvedWarmerConfig,
    warmerConfig?: WarmerConfig,
  ): number {
    const functionConfig = warmerConfig?.functions?.[functionKey];
    if (functionConfig?.concurrency !== undefined) {
      return functionConfig.concurrency;
    }
    return config.concurrency;
  }

  private createWarmerFunction(
    args: WarmerArgs,
    config: ResolvedWarmerConfig,
  ): aws.lambda.Function {
    const role = createLambdaRole(`${args.name}-warmer`, this);

    // Attach logging policy
    const loggingPolicy = createLoggingPolicy(`${args.name}-warmer`, this);
    new aws.iam.RolePolicyAttachment(
      `${args.name}-warmer-logging-policy-attachment`,
      {
        policyArn: loggingPolicy.arn,
        role: role.name,
      },
      { parent: this },
    );

    // Create policy to allow warmer to invoke other Lambda functions
    const invokePolicy = new aws.iam.Policy(
      `${args.name}-warmer-invoke-policy`,
      {
        description: "Allow warmer to invoke Lambda functions",
        policy: pulumi
          .output({
            Version: "2012-10-17",
            Statement: [
              {
                Effect: "Allow",
                Action: ["lambda:InvokeFunction"],
                Resource: Array.from(args.functions.values()).map(
                  (fn) => pulumi.interpolate`${fn.arn}`,
                ),
              },
            ],
          })
          .apply(JSON.stringify),
      },
      { parent: this },
    );

    new aws.iam.RolePolicyAttachment(
      `${args.name}-warmer-invoke-policy-attachment`,
      {
        policyArn: invokePolicy.arn,
        role: role.name,
      },
      { parent: this },
    );

    // Build WARM_PARAMS environment variable
    // Format: [{"function": "function-name", "concurrency": 1}, ...]
    const warmParams = Array.from(args.functions.entries())
      .filter(([key]) => this.shouldWarmFunction(key, args.config))
      .map(([key, fn]) => ({
        function: fn.name,
        concurrency: this.getFunctionConcurrency(key, config, args.config),
      }));

    const warmerConfig = args.openNextOutput.additionalProps?.warmer;
    if (!warmerConfig) {
      throw new Error("Warmer configuration not found in OpenNext output");
    }

    return new aws.lambda.Function(
      `${args.name}-warmer-lambda`,
      {
        handler: warmerConfig.handler,
        runtime: aws.lambda.Runtime.NodeJS20dX,
        environment: {
          variables: {
            WARM_PARAMS: pulumi
              .all(warmParams.map((p) => p.function))
              .apply((names) =>
                JSON.stringify(
                  names.map((name, i) => ({
                    function: name,
                    concurrency: warmParams[i].concurrency,
                  })),
                ),
              ),
          },
        },
        timeout: 900, // 15 minutes - warmer needs time to invoke all functions
        memorySize: 128,
        role: role.arn,
        code: new pulumi.asset.FileArchive(
          path.join(args.path, warmerConfig.bundle),
        ),
      },
      { parent: this },
    );
  }

  private createEventRule(
    name: string,
    config: ResolvedWarmerConfig,
  ): aws.cloudwatch.EventRule {
    return new aws.cloudwatch.EventRule(
      `${name}-warmer-rule`,
      {
        description: "Periodic warming for Next.js Lambda functions",
        scheduleExpression: config.schedule,
        state: config.enabled ? "ENABLED" : "DISABLED",
      },
      { parent: this },
    );
  }

  private grantEventBridgePermission(name: string): void {
    if (!this.warmerFunction || !this.eventRule) {
      return;
    }

    new aws.lambda.Permission(
      `${name}-warmer-eventbridge-permission`,
      {
        action: "lambda:InvokeFunction",
        function: this.warmerFunction.name,
        principal: "events.amazonaws.com",
        sourceArn: this.eventRule.arn,
      },
      { parent: this },
    );
  }

  private createEventTarget(name: string): aws.cloudwatch.EventTarget {
    if (!this.warmerFunction || !this.eventRule) {
      throw new Error("Warmer function or event rule not created");
    }

    return new aws.cloudwatch.EventTarget(
      `${name}-warmer-target`,
      {
        rule: this.eventRule.name,
        arn: this.warmerFunction.arn,
      },
      { parent: this },
    );
  }
}
