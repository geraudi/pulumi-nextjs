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
