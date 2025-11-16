import { readFileSync } from "node:fs";
import * as path from "node:path";
import * as pulumi from "@pulumi/pulumi";
import { NextJsDistribution } from "./components/core/distribution";
import { NextJsFunctions } from "./components/core/functions";
import { NextJsStorage } from "./components/core/storage";
import { NextJsDatabase } from "./components/isr-revalidation/database";
import { NextJsQueue } from "./components/isr-revalidation/queue";
import type { WafConfig } from "./components/security/waf";
import { NextJsWaf } from "./components/security/waf";
import { NextJsWarmer } from "./components/warmer/warmer";
import type { LambdaConfigMap, OpenNextOutput, WarmerConfig } from "./types";

export interface NexJsSiteArgs {
  path?: string;
  environment?: Record<string, pulumi.Input<string>>;
  warmer?: WarmerConfig;
  waf?: WafConfig;
  lambdaConfig?: LambdaConfigMap;
}

export class NextJsSite extends pulumi.ComponentResource {
  private openNextOutput: OpenNextOutput;
  private storage: NextJsStorage;
  private database: NextJsDatabase;
  private queue: NextJsQueue;
  private functions: NextJsFunctions;
  private distribution: NextJsDistribution;
  private warmer?: NextJsWarmer;
  private waf?: NextJsWaf;

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
        lambdaConfig: args.lambdaConfig,
      },
      { parent: this },
    );

    // Create WAF if enabled
    if (args.waf?.enabled === true) {
      this.waf = new NextJsWaf(`${name}-waf`, args.waf, { parent: this });
    }

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
        lambdaFunctions: this.functions.functions,
        webAclArn: this.waf?.webAcl.arn,
      },
      { parent: this },
    );

    // Create warmer if explicitly enabled
    if (args.warmer?.enabled === true) {
      this.warmer = new NextJsWarmer(
        `${name}-warmer`,
        {
          name,
          openNextOutput: this.openNextOutput,
          path: this.path,
          functions: this.functions.functions,
          config: args.warmer,
        },
        { parent: this },
      );
    }

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
