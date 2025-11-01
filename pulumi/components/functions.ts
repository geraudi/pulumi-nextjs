import * as path from "node:path";
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import type { OpenNextFunctionOrigin } from "../types";
import type { FunctionsArgs } from "./shared/types";
import {
  attachBasicLambdaExecutionRole,
  createLambdaRole,
} from "./shared/utils";

export class NextJsFunctions extends pulumi.ComponentResource {
  public functions: Map<string, aws.lambda.Function> = new Map();
  public functionUrls: Map<string, pulumi.Output<string>> = new Map();

  constructor(
    name: string,
    args: FunctionsArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super("nextjs:functions:Functions", name, {}, opts);

    this.createFunctionOrigins(args);
  }

  private createFunctionOrigins(args: FunctionsArgs): void {
    const {
      default: defaultOrigin,
      imageOptimizer: imageOrigin,
      fetchingPage: fetchingPageOrigin,
    } = args.openNextOutput.origins;

    // Create function origins
    if (defaultOrigin && defaultOrigin.type === "function") {
      this.createFunctionOrigin("default", defaultOrigin, args);
    }

    if (imageOrigin && imageOrigin.type === "function") {
      this.createFunctionOrigin("imageOptimizer", imageOrigin, args);
    }

    if (fetchingPageOrigin && fetchingPageOrigin.type === "function") {
      this.createFunctionOrigin("fetchingPage", fetchingPageOrigin, args);
    }
  }

  private createFunctionOrigin(
    key: string,
    origin: OpenNextFunctionOrigin,
    args: FunctionsArgs,
  ): void {
    const role = createLambdaRole(`${args.name}-${key}-origin`, this);

    const fn = new aws.lambda.Function(
      `${args.name}-${key}-origin-lambda`,
      {
        handler: origin.handler,
        runtime: aws.lambda.Runtime.NodeJS20dX,
        environment: args.environment,
        timeout: 15,
        memorySize: 1024,
        role: role.arn,
        code: new pulumi.asset.FileArchive(path.join(args.path, origin.bundle)),
      },
      { parent: this },
    );

    this.grantPermissions(role, key, args);

    const functionUrl = new aws.lambda.FunctionUrl(
      `${args.name}-${key}-origin-lambda-url`,
      {
        functionName: fn.arn,
        authorizationType: "NONE",
        invokeMode: origin.streaming ? "RESPONSE_STREAM" : "BUFFERED",
      },
      { parent: this },
    );

    this.functions.set(key, fn);
    this.functionUrls.set(key, functionUrl.functionUrl);
  }

  private grantPermissions(
    role: aws.iam.Role,
    key: string,
    args: FunctionsArgs,
  ): void {
    // Attach AWSLambdaBasicExecutionRole policy
    attachBasicLambdaExecutionRole(`${args.name}-${key}`, role, this);

    new aws.iam.RolePolicyAttachment(
      `${args.name}-${key}-bucket-read-write-role-policy-attachment`,
      {
        policyArn: args.bucketPolicy,
        role: role.name,
      },
      { parent: this },
    );

    new aws.iam.RolePolicyAttachment(
      `${args.name}-${key}-table-read-write-data-role-policy-attachment`,
      {
        policyArn: args.tablePolicy,
        role: role.name,
      },
      { parent: this },
    );

    new aws.iam.RolePolicyAttachment(
      `${args.name}-${key}-queue-send-message-role-policy-attachment`,
      {
        policyArn: args.queuePolicy,
        role: role.name,
      },
      { parent: this },
    );
  }
}
