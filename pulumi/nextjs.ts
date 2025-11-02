import { readFileSync } from "node:fs";
import * as path from "node:path";
import * as pulumi from "@pulumi/pulumi";
import { NextJsDatabase } from "./components/database";
import { NextJsDistribution } from "./components/distribution";
import { NextJsFunctions } from "./components/functions";
import { NextJsQueue } from "./components/queue";
import { NextJsStorage } from "./components/storage";
import type { OpenNextOutput } from "./types";

export interface NexJsSiteArgs {
  path?: string;
  environment?: Record<string, pulumi.Input<string>>;
}

export class NextJsSite extends pulumi.ComponentResource {
  private openNextOutput: OpenNextOutput;
  private storage: NextJsStorage;
  private database: NextJsDatabase;
  private queue: NextJsQueue;
  private functions: NextJsFunctions;
  private distribution: NextJsDistribution;

  private readonly name: string;
  private readonly region: string;

  path: string;
  environment: Record<string, pulumi.Input<string>>;
  domainName: pulumi.Output<string>;
  url: pulumi.Output<string>;

  public constructor(
    name: string,
    args: NexJsSiteArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super("cloud:index:NextJsSite", name, {}, opts);

    this.path = args.path ?? "../apps/web";
    this.environment = args.environment ?? {};
    this.name = name;
    this.region = "us-east-1";

    this.openNextOutput = JSON.parse(
      readFileSync(
        path.join(this.path, ".open-next", "open-next.output.json"),
        "utf-8",
      ),
    ) as OpenNextOutput;

    // Create sub-components
    this.storage = new NextJsStorage(
      `${name}-storage`,
      {
        name,
        openNextOutput: this.openNextOutput,
        path: this.path,
        region: this.region,
      },
      { parent: this },
    );

    this.database = new NextJsDatabase(
      `${name}-database`,
      {
        name,
        openNextOutput: this.openNextOutput,
        path: this.path,
        region: this.region,
      },
      { parent: this },
    );

    this.queue = new NextJsQueue(
      `${name}-queue`,
      {
        name,
        openNextOutput: this.openNextOutput,
        path: this.path,
        region: this.region,
      },
      { parent: this },
    );

    this.functions = new NextJsFunctions(
      `${name}-functions`,
      {
        name,
        openNextOutput: this.openNextOutput,
        path: this.path,
        region: this.region,
        environment: this.getEnvironment(),
        bucketArn: this.storage.bucket.arn,
        tableArn: this.database.table.arn,
        queueArn: this.queue.queue.arn,
        bucketPolicy: this.storage.bucketPolicy.arn,
        tablePolicy: this.database.tablePolicy.arn,
        queuePolicy: this.queue.queuePolicy.arn,
      },
      { parent: this },
    );

    this.distribution = new NextJsDistribution(
      `${name}-distribution`,
      {
        name,
        openNextOutput: this.openNextOutput,
        path: this.path,
        region: this.region,
        bucketRegionalDomainName: this.storage.bucket.bucketRegionalDomainName,
        bucketArn: this.storage.bucket.arn,
        functionUrls: this.functions.functionUrls,
      },
      { parent: this },
    );

    this.domainName = this.distribution.distribution.domainName;
    this.url = pulumi.interpolate`https://${this.distribution.distribution.domainName}`;
  }

  private getEnvironment() {
    return {
      variables: {
        CACHE_BUCKET_NAME: this.storage.bucket.id,
        CACHE_BUCKET_KEY_PREFIX: "_cache",
        CACHE_BUCKET_REGION: this.region,
        REVALIDATION_QUEUE_URL: this.queue.queue.url,
        REVALIDATION_QUEUE_REGION: this.region,
        CACHE_DYNAMO_TABLE: this.database.table.name,
        // Those 2 are used only for image optimizer
        BUCKET_NAME: this.storage.bucket.id,
        BUCKET_KEY_PREFIX: "_assets",
      },
    };
  }
}
