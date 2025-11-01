type BaseFunction = {
  handler: string;
  bundle: string;
};

export type OpenNextFunctionOrigin = {
  type: "function";
  streaming?: boolean;
} & BaseFunction;

// Pulumi Function Configuration Types
export interface LambdaSettings {
  /** Memory allocation in MB (128-10240) */
  memory?: number;
  /** Timeout in seconds (1-900 for Lambda, 1-30 for Lambda@Edge) */
  timeout?: number;
  /** Lambda runtime version */
  runtime?: string;
  /** Environment variables specific to this function */
  environment?: Record<string, string>;
}

export interface PulumiFunctionConfig {
  [functionName: string]: LambdaSettings;
}

export interface ResolvedFunctionSettings {
  memory: number;
  timeout: number;
  runtime: string;
  environment: Record<string, string>;
}

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
