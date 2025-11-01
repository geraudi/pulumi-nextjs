import * as crypto from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as glob from "glob";
import mime from "mime";
import { DynamicFunctionHandler } from "./dynamic-function-handler";
import { FunctionConfigManager } from "./function-config-manager";
import type {
  OpenNextOutput,
  OpenNextS3OriginCopy,
  PulumiFunctionConfig,
} from "./types";

export interface NexJsSiteArgs {
  path?: string;
  environment?: Record<string, pulumi.Input<string>>;
  functionConfig?: PulumiFunctionConfig;
}

export class NextJsSite extends pulumi.ComponentResource {
  private openNextOutput: OpenNextOutput;
  private bucket: aws.s3.Bucket;
  private table: aws.dynamodb.Table;
  private queue: aws.sqs.Queue;

  private bucketPolicy: aws.iam.Policy;
  private tablePolicy: aws.iam.Policy;
  private queuePolicy: aws.iam.Policy;

  private readonly name: string;
  private readonly region: string;
  private distribution: aws.cloudfront.Distribution;

  private functionConfigManager: FunctionConfigManager;
  private dynamicFunctionHandler: DynamicFunctionHandler;

  path: string;
  environment: Record<string, pulumi.Input<string>>;
  functionConfig?: PulumiFunctionConfig;
  domainName: pulumi.Output<string>;
  url: pulumi.Output<string>;

  public constructor(
    name: string,
    args: NexJsSiteArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super("cloud:index:NextJsSite", name, {}, opts);

    this.path = args.path ?? ".";
    this.environment = args.environment ?? {};
    this.functionConfig = args.functionConfig ?? this.loadFunctionConfig();
    this.name = name;
    this.region = "us-east-1";

    this.openNextOutput = JSON.parse(
      readFileSync(
        path.join(this.path, ".open-next", "open-next.output.json"),
        "utf-8",
      ),
    ) as OpenNextOutput;

    // Initialize function configuration manager
    this.functionConfigManager = new FunctionConfigManager(this.functionConfig);

    // Initialize dynamic function handler (will be used after bucket/table/queue creation)
    // We'll initialize this after creating the base environment in getEnvironment()

    this.bucket = this.createBucket();

    for (const copy of this.openNextOutput.origins.s3.copy) {
      this.addFilesToBucket(copy);
    }

    this.table = this.createRevalidationTable();
    this.queue = this.createRevalidationQueue();

    this.bucketPolicy = this.createBucketPolicy();
    this.tablePolicy = this.createTablePolicy();
    this.queuePolicy = this.createQueuePolicy();

    // Initialize dynamic function handler now that we have all the base resources
    this.dynamicFunctionHandler = new DynamicFunctionHandler(
      this.openNextOutput,
      this.functionConfigManager,
      this.name,
      this.path,
      this.getEnvironment().variables,
      this,
      (role: aws.iam.Role, functionName: string) =>
        this.grantPermissions(role, functionName),
    );

    const origins = this.createOrigins();
    this.distribution = this.createDistribution(origins);

    // Create CloudFront invalidation after deployment

    this.domainName = this.distribution.domainName;
    this.url = pulumi.interpolate`https://${this.distribution.domainName}`;
  }

  /**
   * Loads function configuration from pulumi-functions.config.ts if it exists.
   * Returns undefined if the config file doesn't exist, allowing for graceful fallback to defaults.
   */
  private loadFunctionConfig(): PulumiFunctionConfig | undefined {
    const configPath = path.join(__dirname, "pulumi-functions.config.ts");

    if (!existsSync(configPath)) {
      return undefined;
    }

    try {
      // Dynamic import to handle optional config file
      const configModule = require(configPath);
      return configModule.default || configModule;
    } catch (error) {
      console.warn(
        `Warning: Failed to load function config from ${configPath}:`,
        error,
      );
      return undefined;
    }
  }

  private createOrigins() {
    const { s3: s3Origin } = this.openNextOutput.origins;

    const originAccessIdentity = new aws.cloudfront.OriginAccessIdentity(
      `${this.name}-origin-identity`,
      {},
      { parent: this },
    );

    new aws.s3.BucketPolicy(
      `${this.name}-bucket-policy`,
      {
        bucket: this.bucket.id,
        policy: pulumi.interpolate`{
					"Version": "2012-10-17",
					"Statement": [
						{
							"Action": "s3:GetObject",
							"Effect": "Allow",
							"Principal": {
								"AWS": "${originAccessIdentity.iamArn}"
							},
							"Resource": "${this.bucket.arn}/*"
						}
					]
				}`,
      },
      { parent: this },
    );

    // Create all function origins dynamically
    const functionOrigins =
      this.dynamicFunctionHandler.createAllFunctionOrigins();

    // Generate CloudFront origins from function origins
    const dynamicOrigins =
      this.dynamicFunctionHandler.generateCloudFrontOrigins(functionOrigins);

    // Create S3 origin
    const s3OriginConfig: aws.types.input.cloudfront.DistributionOrigin = {
      originId: "s3",
      domainName: this.bucket.bucketRegionalDomainName,
      originPath: `/${s3Origin.originPath}`, // "/_assets",
      s3OriginConfig: {
        originAccessIdentity: originAccessIdentity.cloudfrontAccessIdentityPath,
      },
    };

    // Return combined origins (S3 + all dynamic function origins)
    return [s3OriginConfig, ...dynamicOrigins];
  }

  private createDistribution(
    origins: aws.types.input.cloudfront.DistributionOrigin[],
  ) {
    const cloudfrontFunction = new aws.cloudfront.Function(
      `${this.name}-cloudfront-function`,
      {
        code: `
            function handler(event) {
				        var request = event.request;
				        request.headers["x-forwarded-host"] = request.headers.host;
				        return request;
			      }
            `,
        runtime: "cloudfront-js-1.0",
        publish: true,
      },
      { parent: this },
    );

    // The managed cache policy ID for `CACHING_OPTIMIZED`
    const staticCachePolicyId = "658327ea-f89d-4fab-a63d-7e88639e58f6";
    const serverCachePolicy = new aws.cloudfront.CachePolicy(
      `${this.name}-cache-policy`,
      {
        comment: `Pulumi Cloud server response cache policy`,
        defaultTtl: 60,
        maxTtl: 31536000,
        minTtl: 0,
        parametersInCacheKeyAndForwardedToOrigin: {
          cookiesConfig: {
            cookieBehavior: "none",
          },
          enableAcceptEncodingBrotli: true,
          enableAcceptEncodingGzip: true,
          headersConfig: {
            headerBehavior: "whitelist",
            headers: {
              items: [
                "accept",
                // "accept-encoding",
                "rsc",
                "next-router-prefetch",
                "next-router-state-tree",
                "next-url",
                "x-prerender-revalidate",
              ],
            },
          },
          queryStringsConfig: {
            queryStringBehavior: "all",
          },
        },
      },
      { parent: this },
    );
    // Referencing the managed origin request policy (ALL_VIEWER_EXCEPT_HOST_HEADER)
    // https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-managed-origin-request-policies.html#managed-origin-request-policy-all-viewer-except-host-header
    const originRequestPolicyId = "b689b0a8-53d0-40ab-baf2-68738e2966ac";

    const orderedCacheBehaviors = this.openNextOutput.behaviors
      .filter((b) => b.pattern !== "*")
      .map((b) => {
        // Map origin names to match our origin IDs
        let originId = b.origin as string;
        if (b.origin === "imageOptimization") {
          originId = "imageOptimizer";
        }

        return this.makeBehaviour({
          pathPattern: b.pattern,
          origin: originId,
          cachePolicyId:
            b.origin === "s3" ? staticCachePolicyId : serverCachePolicy.id,
          functionArn: cloudfrontFunction.arn,
          ...(b.origin !== "s3" ? { originRequestPolicyId } : {}),
        });
      });

    const defaultOpenNextOutputBehavior = this.openNextOutput.behaviors.find(
      (b) => b.pattern === "*",
    );

    // Map origin names to match our origin IDs
    let defaultOriginId = defaultOpenNextOutputBehavior?.origin as string;
    if (defaultOpenNextOutputBehavior?.origin === "imageOptimization") {
      defaultOriginId = "imageOptimizer";
    }

    const defaultBehavior = this.makeBehaviour({
      pathPattern: defaultOpenNextOutputBehavior?.pattern as string,
      origin: defaultOriginId,
      cachePolicyId: serverCachePolicy.id,
      originRequestPolicyId,
      functionArn: cloudfrontFunction.arn,
    });

    const { pathPattern: _, ...defaultBehaviorWithoutPathPattern } =
      defaultBehavior;

    return new aws.cloudfront.Distribution(
      `${this.name}-distribution`,
      {
        comment: "Next.js site deployed with Pulumi",
        aliases: [],
        defaultCacheBehavior: defaultBehaviorWithoutPathPattern,
        orderedCacheBehaviors,
        enabled: true,
        httpVersion: "http2",
        isIpv6Enabled: true,
        restrictions: {
          geoRestriction: {
            restrictionType: "none",
          },
        },
        viewerCertificate: {
          cloudfrontDefaultCertificate: true,
        },
        origins,
      },
      { parent: this },
    );
  }

  private makeBehaviour(args: {
    pathPattern: string;
    origin: string;
    cachePolicyId: pulumi.Output<string> | string;
    originRequestPolicyId?: string;
    functionArn: pulumi.Input<string>;
    readOnly?: boolean;
  }): aws.types.input.cloudfront.DistributionOrderedCacheBehavior {
    return {
      viewerProtocolPolicy: "redirect-to-https",
      allowedMethods: ["GET", "HEAD", "OPTIONS"],
      cachedMethods: ["GET", "HEAD", "OPTIONS"],
      cachePolicyId: args.cachePolicyId,
      ...(args.originRequestPolicyId
        ? {
            originRequestPolicyId: args.originRequestPolicyId,
          }
        : {}),
      functionAssociations: [
        {
          eventType: "viewer-request",
          functionArn: args.functionArn,
        },
      ],
      pathPattern: args.pathPattern,
      targetOriginId: args.origin,
      compress: true,
    };
  }

  grantPermissions(role: aws.iam.Role, functionName: string) {
    // Attach AWSLambdaBasicExecutionRole policy
    new aws.iam.RolePolicyAttachment(
      `${this.name}-${functionName}-lambda-basic-execution-role-policy-attachment`,
      {
        policyArn:
          "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
        role: role.name,
      },
      { parent: this },
    );

    new aws.iam.RolePolicyAttachment(
      `${this.name}-${functionName}-bucket-read-write-role-policy-attachment`,
      {
        policyArn: this.bucketPolicy.arn,
        role: role.name,
      },
      { parent: this },
    );

    new aws.iam.RolePolicyAttachment(
      `${this.name}-${functionName}-table-read-write-data-role-policy-attachment`,
      {
        policyArn: this.tablePolicy.arn,
        role: role.name,
      },
      { parent: this },
    );

    new aws.iam.RolePolicyAttachment(
      `${this.name}-${functionName}-queue-send-message-role-policy-attachment`,
      {
        policyArn: this.queuePolicy.arn,
        role: role.name,
      },
      { parent: this },
    );
  }

  createBucketPolicy(): aws.iam.Policy {
    // Create an IAM policy that grants read/write access to the bucket
    return new aws.iam.Policy("bucketPolicy", {
      description: "S3 bucket read/write access",
      policy: this.bucket.arn.apply((bucketArn) =>
        JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: ["s3:PutObject", "s3:GetObject"],
              Resource: [`${bucketArn}/*`],
            },
          ],
        }),
      ),
    });
  }

  // Create an IAM policy to allow read/write access to the DynamoDB table
  createTablePolicy(): aws.iam.Policy {
    return new aws.iam.Policy(`${this.name}-table-policy`, {
      description: "DynamoDB read/write access policy",
      policy: this.table.arn.apply((tableArn) =>
        JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: [
                "dynamodb:GetItem",
                "dynamodb:PutItem",
                "dynamodb:UpdateItem",
                "dynamodb:DeleteItem",
                "dynamodb:BatchGetItem",
                "dynamodb:BatchWriteItem",
                "dynamodb:Query",
                "dynamodb:Scan",
              ],
              Resource: [`${tableArn}`, `${tableArn}/index/*`],
            },
          ],
        }),
      ),
    });
  }

  // Create an IAM policy to allow sending messages to the queue
  createQueuePolicy(): aws.iam.Policy {
    return new aws.iam.Policy(`${this.name}-queue-policy`, {
      description: "Allow sending messages to the SQS queue",
      policy: this.queue.arn.apply((queueArn) =>
        JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: [
                "sqs:SendMessage",
                "sqs:ReceiveMessage",
                "sqs:DeleteMessage",
                "sqs:GetQueueAttributes",
                "sqs:GetQueueUrl",
              ],
              Resource: queueArn,
            },
          ],
        }),
      ),
    });
  }

  /**
   * done
   * @private
   */
  private getEnvironment() {
    return {
      variables: {
        CACHE_BUCKET_NAME: this.bucket.id,
        CACHE_BUCKET_KEY_PREFIX: "_cache",
        CACHE_BUCKET_REGION: this.region,
        REVALIDATION_QUEUE_URL: this.queue.url,
        REVALIDATION_QUEUE_REGION: this.region,
        CACHE_DYNAMO_TABLE: this.table.name,
        // Those 2 are used only for image optimizer
        BUCKET_NAME: this.bucket.id,
        BUCKET_KEY_PREFIX: "_assets",
      },
    };
  }

  /**
   * @private
   * @param {OpenNextS3OriginCopy} copy - The copy object containing information about the files to be added to the bucket.
   */
  private addFilesToBucket(copy: OpenNextS3OriginCopy) {
    const files = glob.sync("**", {
      cwd: path.resolve(this.path, copy.from),
      dot: true,
      nodir: true,
      follow: true,
    });

    for (const file of files) {
      const cacheControl = copy.cached
        ? "public,max-age=31536000,immutable"
        : "public,max-age=0,s-maxage=31536000,must-revalidate";
      const hex = computeHexHash(file);
      const key = path.join(copy.to, file);

      new aws.s3.BucketObject(
        `${this.name}-bucket-object-${hex}`,
        {
          bucket: this.bucket.id,
          key,
          source: new pulumi.asset.FileAsset(
            path.resolve(this.path, copy.from, file),
          ),
          cacheControl,
          contentType: mime.getType(file) || undefined,
        },
        { parent: this },
      );
    }
  }

  private createBucket() {
    const bucket = new aws.s3.Bucket(
      `${this.name}-open-next-bucket`,
      {
        bucket: `${this.name}-open-next-bucket`,
        forceDestroy: true,
      },
      { parent: this },
    );

    new aws.s3.BucketPublicAccessBlock(
      `${this.name}-bucket-block-public-access`,
      {
        bucket: bucket.id,
        blockPublicAcls: true,
        blockPublicPolicy: true,
        ignorePublicAcls: true,
        restrictPublicBuckets: true,
      },
      { parent: this },
    );

    return bucket;
  }

  private createRevalidationTable() {
    const tableName = "RevalidationTable";
    const table = new aws.dynamodb.Table(
      `${this.name}-revalidation-table`,
      {
        name: tableName,
        hashKey: "tag",
        rangeKey: "path",
        pointInTimeRecovery: { enabled: true },
        billingMode: "PAY_PER_REQUEST",
        globalSecondaryIndexes: [
          {
            name: "revalidate",
            hashKey: "path",
            rangeKey: "revalidatedAt",
            projectionType: "INCLUDE",
            nonKeyAttributes: ["tag"],
          },
        ],
        attributes: [
          { name: "tag", type: "S" },
          { name: "path", type: "S" },
          { name: "revalidatedAt", type: "N" },
        ],
      },
      { parent: this },
    );

    new aws.cloudwatch.LogGroup(
      `${this.name}-revalidation-table-lambda-log-group`,
      {
        retentionInDays: 1,
      },
      { parent: this },
    );

    const role = new aws.iam.Role(
      `${this.name}-revalidation-table-lambda-role`,
      {
        assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
          Service: "lambda.amazonaws.com",
        }),
      },
      { parent: this },
    );

    const loggingPolicyDocument = aws.iam.getPolicyDocument(
      {
        statements: [
          {
            effect: "Allow",
            actions: [
              "logs:CreateLogGroup",
              "logs:CreateLogStream",
              "logs:PutLogEvents",
            ],
            resources: ["arn:aws:logs:*:*:*"],
          },
        ],
      },
      { parent: this },
    );

    const loggingPolicy = new aws.iam.Policy(
      `${this.name}-revalidation-table-lambda-logging-policy`,
      {
        path: "/",
        description: "IAM policy for logging from a revalidation lambda",
        policy: loggingPolicyDocument.then(
          (loggingPolicyDocument: aws.iam.GetPolicyDocumentResult) =>
            loggingPolicyDocument.json,
        ),
      },
      { parent: this },
    );

    new aws.iam.RolePolicyAttachment(
      `${this.name}-revalidation-table-lambda-logging-role-policy-attachment`,
      {
        role: role.name,
        policyArn: loggingPolicy.arn,
      },
      { parent: this },
    );

    // Attach DynamoDB read/write policy to the role
    const dynamoDbPolicy = new aws.iam.Policy(
      `${this.name}-revalidation-table-lambda-dynamodb-policy`,
      {
        policy: pulumi
          .output({
            Version: "2012-10-17",
            Statement: [
              {
                Action: [
                  "dynamodb:PutItem",
                  "dynamodb:GetItem",
                  "dynamodb:UpdateItem",
                  "dynamodb:DeleteItem",
                  "dynamodb:Query",
                  "dynamodb:BatchWriteItem",
                ],
                Effect: "Allow",
                Resource: table.arn,
              },
            ],
          })
          .apply(JSON.stringify),
      },
      { parent: this },
    );

    new aws.iam.RolePolicyAttachment(
      `${this.name}-revalidation-table-lambda-dynamodb-role-policy-attachment`,
      {
        role: role,
        policyArn: dynamoDbPolicy.arn,
      },
      { parent: this },
    );

    if (!this.openNextOutput?.additionalProps?.initializationFunction) {
      throw new Error(
        "openNextOutput.additionalProps.initializationFunction is required",
      );
    }

    const insertFn = new aws.lambda.Function(
      `${this.name}-revalidation-table-lambda`,
      {
        description: "Next.js revalidation data insert",
        handler:
          this.openNextOutput.additionalProps.initializationFunction.handler,
        runtime: aws.lambda.Runtime.NodeJS20dX,
        environment: {
          variables: {
            CACHE_DYNAMO_TABLE: tableName,
          },
        },
        timeout: 15,
        memorySize: 128,
        role: role.arn,
        code: new pulumi.asset.FileArchive(
          path.join(
            this.path,
            this.openNextOutput.additionalProps?.initializationFunction.bundle,
          ),
        ),
      },
      { parent: this },
    );

    // Invoke the Lambda function at deploy time
    new aws.lambda.Invocation(`${this.name}-revalidation-table-seeder`, {
      functionName: insertFn.name,
      triggers: {
        time: Date.now().toString(),
      },
      input: pulumi.jsonStringify({}),
    });

    return table;
  }

  private createRevalidationQueue() {
    const queue = new aws.sqs.Queue(`${this.name}-revalidation-queue`, {
      fifoQueue: true,
      receiveWaitTimeSeconds: 20,
      contentBasedDeduplication: true,
      // FIFO queue names must end with ".fifo"
      name: "revalidationQueue.fifo",
    });

    // Create IAM role and attach policies for Lambda to access SQS and Cloudwatch logs
    const role = new aws.iam.Role(
      `${this.name}-revalidation-queue-lambda-role`,
      {
        assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
          Service: "lambda.amazonaws.com",
        }),
      },
    );

    // Cloudwatch policy
    const loggingPolicyDocument = aws.iam.getPolicyDocument({
      statements: [
        {
          effect: "Allow",
          actions: [
            "logs:CreateLogGroup",
            "logs:CreateLogStream",
            "logs:PutLogEvents",
          ],
          resources: ["arn:aws:logs:*:*:*"],
        },
      ],
    });

    const loggingPolicy = new aws.iam.Policy(
      `${this.name}-revalidation-queue-lambda-logging-policy`,
      {
        path: "/",
        description: "IAM policy for logging from a revalidation queue lambda",
        policy: loggingPolicyDocument.then(
          (loggingPolicyDocument: aws.iam.GetPolicyDocumentResult) =>
            loggingPolicyDocument.json,
        ),
      },
    );

    new aws.iam.RolePolicyAttachment(
      `${this.name}-revalidation-queue-lambda-logging-role-policy-attachment`,
      {
        role: role.name,
        policyArn: loggingPolicy.arn,
      },
    );

    const queuePolicy = new aws.iam.Policy(
      `${this.name}-revalidation-queue-lambda-sqs-policy`,
      {
        policy: pulumi
          .output({
            Version: "2012-10-17",
            Statement: [
              {
                Action: [
                  "sqs:ReceiveMessage",
                  "sqs:DeleteMessage",
                  "sqs:GetQueueAttributes",
                ],
                Effect: "Allow",
                Resource: queue.arn,
              },
            ],
          })
          .apply(JSON.stringify),
      },
    );

    new aws.iam.RolePolicyAttachment(
      `${this.name}-revalidation-queue-lambda-sqs-role-policy-attachment`,
      {
        role: role,
        policyArn: queuePolicy.arn,
      },
    );

    if (!this.openNextOutput?.additionalProps?.revalidationFunction) {
      throw new Error(
        "openNextOutput.additionalProps.revalidationFunction is required",
      );
    }
    const consumer = new aws.lambda.Function(
      `${this.name}-revalidation-queue-lambda`,
      {
        handler:
          this.openNextOutput.additionalProps.revalidationFunction.handler,
        code: new pulumi.asset.FileArchive(
          path.join(
            this.path,
            this.openNextOutput.additionalProps.revalidationFunction.bundle,
          ),
        ),
        runtime: aws.lambda.Runtime.NodeJS20dX,
        timeout: 30,
        role: role.arn,
      },
    );

    new aws.lambda.EventSourceMapping(
      `${this.name}-revalidation-queue-lambda-event-source`,
      {
        eventSourceArn: queue.arn,
        functionName: consumer.arn,
        enabled: true,
      },
    );

    return queue;
  }
}

function computeHexHash(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}
