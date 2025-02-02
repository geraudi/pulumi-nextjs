import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { execSync } from "child_process";
import * as crypto from "crypto";
import * as glob from "glob";
import * as mime from "mime";
import * as path from "path";
import { OpenNextFunctionOrigin, OpenNextOutput, OpenNextS3OriginCopy } from "./types";
import { readFileSync } from "node:fs";

export interface NexJsSiteArgs {
  path?: string;
  environment?: Record<string, pulumi.Input<string>>;
}

export class NextJsSite extends pulumi.ComponentResource {
  private openNextOutput: OpenNextOutput;
  private bucket: aws.s3.BucketV2;
  private table: aws.dynamodb.Table;
  private queue: aws.sqs.Queue;

  private bucketPolicy: aws.iam.Policy;
  private tablePolicy: aws.iam.Policy;
  private queuePolicy: aws.iam.Policy;

  private readonly name: string;
  private readonly region: string;

  path: string;
  environment: Record<string, pulumi.Input<string>>;
  domainName: pulumi.Output<string>;
  url: pulumi.Output<string>;

  public constructor(name: string, args: NexJsSiteArgs, opts?: pulumi.ComponentResourceOptions) {
    super("cloud:index:NextJsSite", name, {}, opts);

    this.path = args.path ?? ".";
    this.environment = args.environment ?? {};
    this.name = name;
    this.region = 'us-east-1';

    this.openNextOutput = JSON.parse(
      readFileSync(
        path.join(this.path, ".open-next", "open-next.output.json"),
        "utf-8",
      ),
    ) as OpenNextOutput;

    this.bucket = this.createBucket();

    for (const copy of this.openNextOutput.origins.s3.copy) {
      this.addFilesToBucket(copy);
    }

    this.table = this.createRevalidationTable();
    this.queue = this.createRevalidationQueue();

    this.bucketPolicy = this.createBucketPolicy();
    this.tablePolicy = this.createTablePolicy();
    this.queuePolicy = this.createQueuePolicy();

    const origins = this.createOrigins();
    const distribution = this.createDistribution(origins);

    this.domainName = distribution.domainName;
    this.url = pulumi.interpolate`https://${distribution.domainName}`;
  }

  private createOrigins() {
    const {
      s3: s3Origin,
      default: defaultOrigin,
      imageOptimizer: imageOrigin,
      // ...restOrigins
    } = this.openNextOutput.origins;

    const originAccessIdentity = new aws.cloudfront.OriginAccessIdentity(`${this.name}-origin-identity`, {}, { parent: this });

    new aws.s3.BucketPolicy(`${this.name}-bucket-policy`, {
      bucket: this.bucket.id,
      policy: {
        "Version": "2012-10-17",
        "Statement": [
          {
            "Action": "s3:GetObject",
            "Effect": "Allow",
            "Principal": <any>{
              "CanonicalUser": originAccessIdentity.s3CanonicalUserId,
            },
            "Resource": pulumi.interpolate`${this.bucket.arn}/*`,
          },
        ],
      },
    }, { parent: this });

    const defaultFunctionUrl = this.createFunctionOrigin('default', defaultOrigin as OpenNextFunctionOrigin);
    const imageFunctionUrl = this.createFunctionOrigin('image-optimizer', imageOrigin as OpenNextFunctionOrigin);

    return [
      {
        originId: 's3',
        domainName: this.bucket.bucketRegionalDomainName,
        originPath: `/${s3Origin.originPath}`, // "/_assets",
        s3OriginConfig: {
          originAccessIdentity: originAccessIdentity.cloudfrontAccessIdentityPath
        }
      },
      {
        originId: 'default',
        domainName: defaultFunctionUrl.functionUrl.apply(url => url.split("//")[1].split("/")[0]),
        customOriginConfig: {
          httpPort: 80,
          httpsPort: 443,
          originProtocolPolicy: "https-only",
          originReadTimeout: 10,
          originSslProtocols: ["TLSv1.2"],
        },
      },
      {
        originId: 'imageOptimizer',
        domainName: imageFunctionUrl.functionUrl.apply(url => url.split("//")[1].split("/")[0]),
        customOriginConfig: {
          httpPort: 80,
          httpsPort: 443,
          originProtocolPolicy: "https-only",
          originReadTimeout: 10,
          originSslProtocols: ["TLSv1.2"],
        },
      }
    ]
  }

  private createDistribution(origins: aws.types.input.cloudfront.DistributionOrigin[]) {
    const cloudfrontFunction = new aws.cloudfront.Function(`${this.name}-cloudfront-function`, {
      code: `
            function handler(event) {
				        var request = event.request;
				        request.headers["x-forwarded-host"] = request.headers.host;
				        return request;
			      }
            `,
      runtime: "cloudfront-js-1.0",
      publish: true,
    }, { parent: this });

    // The managed cache policy ID for `CACHING_OPTIMIZED`
    const staticCachePolicyId = "658327ea-f89d-4fab-a63d-7e88639e58f6";
    const serverCachePolicy = new aws.cloudfront.CachePolicy(`${this.name}-cache-policy`, {
      comment: `Pulumi Cloud server response cache policy`,
      defaultTtl: 0,
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
    }, { parent: this });
    // Referencing the managed origin request policy (ALL_VIEWER_EXCEPT_HOST_HEADER)
    // https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-managed-origin-request-policies.html#managed-origin-request-policy-all-viewer-except-host-header
    const originRequestPolicyId = "b689b0a8-53d0-40ab-baf2-68738e2966ac";

    const orderedCacheBehaviors = this.openNextOutput.behaviors
      .filter(b => b.pattern !== "*")
      .map(b => {
        return this.makeBehaviour({
          pathPattern: b.pattern,
          origin: b.origin as string,
          cachePolicyId: b.origin === 's3' ? staticCachePolicyId : serverCachePolicy.id,
          functionArn: cloudfrontFunction.arn,
          ...(b.origin !== 's3' ? { originRequestPolicyId } : {}),
        })
      })

    const defaultOpenNextOutputBehavior = this.openNextOutput.behaviors
      .find(b => b.pattern === "*");

    const defaultBehavior = this.makeBehaviour({
      pathPattern: defaultOpenNextOutputBehavior?.pattern as string,
      origin: defaultOpenNextOutputBehavior?.origin as string,
      cachePolicyId: serverCachePolicy.id,
      originRequestPolicyId,
      functionArn: cloudfrontFunction.arn,
    })

    const { pathPattern, ...defaultBehaviorWithoutPathPattern } = defaultBehavior;

    return new aws.cloudfront.Distribution(`${this.name}-distribution`, {
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
    }, { parent: this });
  }

  private makeBehaviour(args: {
    pathPattern: string,
    origin: string,
    cachePolicyId: pulumi.Output<string> | string,
    originRequestPolicyId?: string,
    functionArn: pulumi.Input<string>,
    readOnly?: boolean,
  }): aws.types.input.cloudfront.DistributionOrderedCacheBehavior {
    return {
      viewerProtocolPolicy: "redirect-to-https",
      allowedMethods: ["GET", "HEAD", "OPTIONS"],
      cachedMethods: ["GET", "HEAD", "OPTIONS"],
      cachePolicyId: args.cachePolicyId,
      ...(args.originRequestPolicyId
        ? {
          originRequestPolicyId: args.originRequestPolicyId
        }
        : {}
      ),
      functionAssociations: [
        {
          eventType: "viewer-request",
          functionArn: args.functionArn
        }
      ],
      pathPattern: args.pathPattern,
      targetOriginId: args.origin,
      compress: true,
    };
  }

  /**
   *
   * @param key 'default' | 'imageOptimizer'
   * @param origin
   * @private
   */
  private createFunctionOrigin(key: string, origin: OpenNextFunctionOrigin) {
    const environment = this.getEnvironment();

    const role = new aws.iam.Role(`${this.name}-${key}-origin-lambda-role`, {
      assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({ Service: "lambda.amazonaws.com" })
    }, { parent: this });

    const fn = new aws.lambda.Function(`${this.name}-${key}-origin-lambda`, {
      handler: origin.handler,
      runtime: aws.lambda.Runtime.NodeJS20dX,
      environment,
      timeout: 15,
      memorySize: 1024,
      role: role.arn,
      code: new pulumi.asset.FileArchive(path.join(this.path, origin.bundle)),
    });

    this.grantPermissions(role, key);

    return new aws.lambda.FunctionUrl(`${this.name}-${key}-origin-lambda-url`, {
      functionName: fn.arn,
      authorizationType: "NONE",
      invokeMode: origin.streaming ? "RESPONSE_STREAM" : "BUFFERED",
    }, { parent: this });
  }

  grantPermissions(role: aws.iam.Role, key: string) {
    // Attach AWSLambdaBasicExecutionRole policy
    new aws.iam.RolePolicyAttachment(`${this.name}-${key}-lambda-basic-execution-role-polict-attachment`, {
      policyArn: "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
      role: role.name,
    });

    new aws.iam.RolePolicyAttachment(`${this.name}-${key}-bucket-read-write-role-policy-attachment`, {
      policyArn: this.bucketPolicy.arn,
      role: role.name,
    });

    new aws.iam.RolePolicyAttachment(`${this.name}-${key}-table-read-write-data-role-policy-attachment`, {
      policyArn: this.tablePolicy.arn,
      role: role.name,
    });

    new aws.iam.RolePolicyAttachment(`${this.name}-${key}-queue-send-message-role-policy-attachment`, {
      policyArn: this.queuePolicy.arn,
      role: role.name,
    });
  }

  createBucketPolicy(): aws.iam.Policy {
    // Create an IAM policy that grants read/write access to the bucket
    return new aws.iam.Policy("bucketPolicy", {
      description: "S3 bucket read/write access",
      policy: this.bucket.arn.apply(bucketArn => JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Action: [
              "s3:PutObject",
              "s3:GetObject",
            ],
            Resource: [
              `${bucketArn}/*`,
            ],
          },
        ],
      })),
    });
  }

  // Create an IAM policy to allow read/write access to the DynamoDB table
  createTablePolicy(): aws.iam.Policy {
    return new aws.iam.Policy(`${this.name}-table-policy`, {
      description: "DynamoDB read/write access policy",
      policy: this.table.arn.apply(tableArn => JSON.stringify({
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
            Resource: [
              `${tableArn}`,
            ],
          },
        ],
      })),
    });
  }

  // Create an IAM policy to allow sending messages to the queue
  createQueuePolicy(): aws.iam.Policy {
    return new aws.iam.Policy(`${this.name}-queue-policy`, {
      description: "Allow sending messages to the SQS queue",
      policy: this.queue.arn.apply(queueArn => JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Action: [
              "sqs:SendMessage",
              "sqs:ReceiveMessage",
              "sqs:DeleteMessage",
              "sqs:GetQueueAttributes",
              "sqs:GetQueueUrl"
            ],
            Resource: queueArn,
          },
        ],
      })),
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
      }
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

      new aws.s3.BucketObject(`${this.name}-bucket-object-${hex}`, {
        bucket: this.bucket.id,
        key,
        source: new pulumi.asset.FileAsset(path.resolve(this.path, copy.from, file)),
        cacheControl,
        contentType: mime.getType(file) || undefined,
      }, { parent: this });
    }
  }

  private createBucket() {
    const bucket = new aws.s3.BucketV2(`${this.name}-open-next-bucket`, {
      bucket: `${this.name}-open-next-bucket`,
      forceDestroy: true,
    }, { parent: this });

    new aws.s3.BucketPublicAccessBlock(`${this.name}-bucket-block-public-access`, {
      bucket: bucket.id,
      blockPublicAcls: true,
      blockPublicPolicy: true,
      ignorePublicAcls: true,
      restrictPublicBuckets: true,
    }, { parent: this });

    return bucket;
  }

  private createRevalidationTable() {
    const tableName = 'RevalidationTable';
    const table = new aws.dynamodb.Table(`${this.name}-revalidation-table`, {
      name: tableName,
      hashKey: "tag",
      rangeKey: "path",
      pointInTimeRecovery: { enabled: true },
      billingMode: 'PAY_PER_REQUEST',
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
        { name: 'tag', type: 'S' },
        { name: 'path', type: 'S' },
        { name: 'revalidatedAt', type: 'N' },]
    }, { parent: this });

    new aws.cloudwatch.LogGroup(`${this.name}-revalidation-table-lambda-log-group`, {
      retentionInDays: 1,
    }, { parent: this });

    const role = new aws.iam.Role(`${this.name}-revalidation-table-lambda-role`, {
      assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({ Service: "lambda.amazonaws.com" })
    }, { parent: this });

    const loggingPolicyDocument = aws.iam.getPolicyDocument({
      statements: [{
        effect: "Allow",
        actions: [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ],
        resources: ["arn:aws:logs:*:*:*"],
      }],
    }, { parent: this });

    const loggingPolicy = new aws.iam.Policy(`${this.name}-revalidation-table-lambda-logging-policy`, {
      path: "/",
      description: "IAM policy for logging from a revalidation lambda",
      policy: loggingPolicyDocument.then((loggingPolicyDocument: aws.iam.GetPolicyDocumentResult) => loggingPolicyDocument.json),
    }, { parent: this });

    new aws.iam.RolePolicyAttachment(`${this.name}-revalidation-table-lambda-logging-role-policy-attachment`, {
      role: role.name,
      policyArn: loggingPolicy.arn,
    }, { parent: this });

    // Attach DynamoDB read/write policy to the role
    const dynamoDbPolicy = new aws.iam.Policy(`${this.name}-revalidation-table-lambda-dynamodb-policy`, {
      policy: pulumi.output({
        Version: "2012-10-17",
        Statement: [{
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
        }],
      }).apply(JSON.stringify),
    }, { parent: this });

    new aws.iam.RolePolicyAttachment(`${this.name}-revalidation-table-lambda-dynamodb-role-policy-attachment`, {
      role: role,
      policyArn: dynamoDbPolicy.arn,
    }, { parent: this });

    if (!this.openNextOutput?.additionalProps?.initializationFunction) {
      throw new Error('openNextOutput.additionalProps.initializationFunction is required');
    }

    const insertFn = new aws.lambda.Function(`${this.name}-revalidation-table-lambda`, {
      description: "Next.js revalidation data insert",
      handler: this.openNextOutput.additionalProps.initializationFunction.handler,
      runtime: aws.lambda.Runtime.NodeJS20dX,
      environment: {
        variables: {
          CACHE_DYNAMO_TABLE: tableName,
        }
      },
      timeout: 15,
      memorySize: 128,
      role: role.arn,
      code: new pulumi.asset.FileArchive(path.join(this.path, this.openNextOutput.additionalProps?.initializationFunction.bundle)),
    }, { parent: this });

    // Invoke the Lambda function at deploy time
    const invokeLambda = new aws.lambda.Invocation(`${this.name}-revalidation-table-seeder`, {
      functionName: insertFn.name,
      input: pulumi.jsonStringify({ date: Date.now().toString() })
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
    const role = new aws.iam.Role(`${this.name}-revalidation-queue-lambda-role`, {
      assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({ Service: "lambda.amazonaws.com" }),
    });

    // Cloudwatch policy
    const loggingPolicyDocument = aws.iam.getPolicyDocument({
      statements: [{
        effect: "Allow",
        actions: [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ],
        resources: ["arn:aws:logs:*:*:*"],
      }],
    });

    const loggingPolicy = new aws.iam.Policy(`${this.name}-revalidation-queue-lambda-logging-policy`, {
      path: "/",
      description: "IAM policy for logging from a revalidation queue lambda",
      policy: loggingPolicyDocument.then((loggingPolicyDocument: aws.iam.GetPolicyDocumentResult) => loggingPolicyDocument.json),
    });

    new aws.iam.RolePolicyAttachment(`${this.name}-revalidation-queue-lambda-logging-role-policy-attachment`, {
      role: role.name,
      policyArn: loggingPolicy.arn,
    });

    const queuePolicy = new aws.iam.Policy(`${this.name}-revalidation-queue-lambda-sqs-policy`, {
      policy: pulumi.output({
        Version: "2012-10-17",
        Statement: [{
          Action: [
            "sqs:ReceiveMessage",
            "sqs:DeleteMessage",
            "sqs:GetQueueAttributes",
          ],
          Effect: "Allow",
          Resource: queue.arn,
        }],
      }).apply(JSON.stringify),
    });

    new aws.iam.RolePolicyAttachment(`${this.name}-revalidation-queue-lambda-sqs-role-policy-attachment`, {
      role: role,
      policyArn: queuePolicy.arn,
    });

    if (!this.openNextOutput?.additionalProps?.revalidationFunction) {
      throw new Error('openNextOutput.additionalProps.revalidationFunction is required');
    }
    const consumer = new aws.lambda.Function(`${this.name}-revalidation-queue-lambda`, {
      handler: this.openNextOutput.additionalProps.revalidationFunction.handler,
      code: new pulumi.asset.FileArchive(path.join(this.path, this.openNextOutput.additionalProps.revalidationFunction.bundle)),
      runtime: aws.lambda.Runtime.NodeJS20dX,
      timeout: 30,
      role: role.arn
    });

    new aws.lambda.EventSourceMapping(`${this.name}-revalidation-queue-lambda-event-source`, {
      eventSourceArn: queue.arn,
      functionName: consumer.arn,
      enabled: true
    });

    return queue;
  }
}

function computeHexHash(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}
