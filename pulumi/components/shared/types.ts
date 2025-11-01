import type * as pulumi from "@pulumi/pulumi";
import type { OpenNextOutput } from "../../types";

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
}
