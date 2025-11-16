import type * as aws from "@pulumi/aws";
import type * as pulumi from "@pulumi/pulumi";

type BaseFunction = {
  handler: string;
  bundle: string;
};

export type OpenNextFunctionOrigin = {
  type: "function";
  streaming?: boolean;
} & BaseFunction;

type OpenNextECSOrigin = {
  type: "ecs";
  bundle: string;
  dockerfile: string;
};

export type OpenNextS3OriginCopy = {
  from: string;
  to: string;
  cached: boolean;
  versionedSubDir?: string;
};

type OpenNextS3Origin = {
  type: "s3";
  originPath: string;
  copy: OpenNextS3OriginCopy[];
};

type OpenNextOrigins =
  | OpenNextFunctionOrigin
  | OpenNextECSOrigin
  | OpenNextS3Origin;

export interface OpenNextOutput {
  edgeFunctions: {
    [key: string]: BaseFunction;
  };
  origins: {
    s3: OpenNextS3Origin;
    default: OpenNextFunctionOrigin | OpenNextECSOrigin;
    imageOptimizer: OpenNextFunctionOrigin | OpenNextECSOrigin;
    [key: string]: OpenNextOrigins;
  };
  behaviors: {
    pattern: string;
    origin?: string;
    edgeFunction?: string;
  }[];
  additionalProps?: {
    disableIncrementalCache?: boolean;
    disableTagCache?: boolean;
    initializationFunction?: BaseFunction;
    warmer?: BaseFunction;
    revalidationFunction?: BaseFunction;
  };
}

export interface ComponentArgs {
  name: string;
  openNextOutput: OpenNextOutput;
  path: string;
  region: string;
}

export interface StorageArgs extends ComponentArgs {}

export interface DatabaseArgs extends ComponentArgs {}

export interface QueueArgs extends ComponentArgs {}

export interface FunctionsArgs extends ComponentArgs {
  environment: {
    variables: Record<string, pulumi.Input<string>>;
  };
  bucketArn: pulumi.Output<string>;
  tableArn: pulumi.Output<string>;
  queueArn: pulumi.Output<string>;
  bucketPolicy: pulumi.Output<string>;
  tablePolicy: pulumi.Output<string>;
  queuePolicy: pulumi.Output<string>;
}

export interface DistributionArgs extends ComponentArgs {
  bucketRegionalDomainName: pulumi.Output<string>;
  bucketArn: pulumi.Output<string>;
  functionUrls: Map<string, pulumi.Output<string>>;
  lambdaFunctions: Map<string, aws.lambda.Function>;
  webAclArn?: pulumi.Output<string>;
}

export interface WarmerConfig {
  /**
   * Enable or disable the warmer
   * @default true
   */
  enabled?: boolean;

  /**
   * Schedule expression for warming (cron or rate)
   * @default "rate(5 minutes)"
   * @example "rate(5 minutes)" or "cron(0/5 * * * ? *)"
   */
  schedule?: string;

  /**
   * Number of concurrent invocations per warming cycle (applies to all functions if not specified per-function)
   * @default 1
   */
  concurrency?: number;

  /**
   * Per-function warming configuration
   * @example
   * {
   *   api: { concurrency: 5 },
   *   fetchingPage: { enabled: false }
   * }
   */
  functions?: {
    [functionKey: string]: {
      /**
       * Enable or disable warming for this specific function
       * @default true
       */
      enabled?: boolean;
      /**
       * Number of concurrent invocations for this function
       * Required if enabled is true or undefined
       */
      concurrency?: number;
    };
  };

  /**
   * Custom warming payload
   */
  payload?: Record<string, unknown>;
}

export interface WarmerArgs {
  name: string;
  openNextOutput: OpenNextOutput;
  path: string;
  functions: Map<string, aws.lambda.Function>;
  config?: WarmerConfig;
}
