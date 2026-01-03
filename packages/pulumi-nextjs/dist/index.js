"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all2) => {
  for (var name in all2)
    __defProp(target, name, { get: all2[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  NextJsSite: () => NextJsSite
});
module.exports = __toCommonJS(index_exports);

// src/nextjs.ts
var import_node_fs = require("fs");
var path7 = __toESM(require("path"));
var pulumi8 = __toESM(require("@pulumi/pulumi"));

// src/components/core/distribution.ts
var aws = __toESM(require("@pulumi/aws"));
var pulumi = __toESM(require("@pulumi/pulumi"));
var NextJsDistribution = class extends pulumi.ComponentResource {
  constructor(name, args, opts) {
    super("nextjs:distribution:Distribution", name, {}, opts);
    this.originAccessIdentity = this.createOriginAccessIdentity(args.name);
    this.createBucketPolicy(args);
    this.cloudfrontFunction = this.createCloudfrontFunction(args.name);
    this.originAccessControl = this.createOriginAccessControl(args.name);
    this.distribution = this.createDistribution(args);
    this.grantLambdaPermissions(args);
  }
  createOriginAccessIdentity(name) {
    return new aws.cloudfront.OriginAccessIdentity(
      `${name}-origin-identity`,
      {},
      { parent: this }
    );
  }
  createBucketPolicy(args) {
    new aws.s3.BucketPolicy(
      `${args.name}-bucket-policy`,
      {
        bucket: args.bucketRegionalDomainName.apply(
          (domain) => domain.split(".")[0]
        ),
        // Extract bucket name
        policy: pulumi.interpolate`{
          "Version": "2012-10-17",
          "Statement": [
            {
              "Action": "s3:GetObject",
              "Effect": "Allow",
              "Principal": {
                "AWS": "${this.originAccessIdentity.iamArn}"
              },
              "Resource": "${args.bucketArn}/*"
            }
          ]
        }`
      },
      { parent: this }
    );
  }
  createCloudfrontFunction(name) {
    return new aws.cloudfront.Function(
      `${name}-cloudfront-function`,
      {
        code: `
          function handler(event) {
            var request = event.request;
            request.headers["x-forwarded-host"] = request.headers.host;
            return request;
          }
        `,
        runtime: "cloudfront-js-1.0",
        publish: true
      },
      { parent: this }
    );
  }
  createOriginAccessControl(name) {
    return new aws.cloudfront.OriginAccessControl(
      `${name}-lambda-oac`,
      {
        name: `${name}-lambda-oac`,
        description: "Origin Access Control for Lambda Function URLs",
        originAccessControlOriginType: "lambda",
        signingBehavior: "always",
        signingProtocol: "sigv4"
      },
      { parent: this }
    );
  }
  grantLambdaPermissions(args) {
    for (const [key, fn] of args.lambdaFunctions) {
      new aws.lambda.Permission(
        `${args.name}-${key}-cloudfront-oac-permission`,
        {
          action: "lambda:InvokeFunctionUrl",
          function: fn.arn,
          principal: "cloudfront.amazonaws.com",
          sourceArn: this.distribution.arn
        },
        { parent: this }
      );
    }
  }
  createDistribution(args) {
    const origins = this.createOrigins(args);
    const staticCachePolicyId = "658327ea-f89d-4fab-a63d-7e88639e58f6";
    const serverCachePolicy = this.createServerCachePolicy(args.name);
    const apiCachePolicy = this.createApiCachePolicy(args.name);
    const originRequestPolicyId = "b689b0a8-53d0-40ab-baf2-68738e2966ac";
    const orderedCacheBehaviors = args.openNextOutput.behaviors.filter((b) => b.pattern !== "*").map((b) => {
      const originId = b.origin;
      let cachePolicyId;
      if (b.origin === "s3") {
        cachePolicyId = staticCachePolicyId;
      } else if (originId.toLowerCase().includes("edge") || b.pattern.startsWith("api/")) {
        cachePolicyId = apiCachePolicy.id;
      } else {
        cachePolicyId = serverCachePolicy.id;
      }
      return this.makeBehaviour({
        pathPattern: b.pattern,
        origin: originId,
        cachePolicyId,
        functionArn: this.cloudfrontFunction.arn,
        ...b.origin !== "s3" ? { originRequestPolicyId } : {},
        // Allow more HTTP methods for API routes
        ...originId.toLowerCase().includes("edge") || b.pattern.startsWith("api/") ? {
          allowedMethods: [
            "DELETE",
            "GET",
            "HEAD",
            "OPTIONS",
            "PATCH",
            "POST",
            "PUT"
          ],
          cachedMethods: ["GET", "HEAD"]
        } : {}
      });
    });
    const defaultOpenNextOutputBehavior = args.openNextOutput.behaviors.find(
      (b) => b.pattern === "*"
    );
    const defaultOriginId = defaultOpenNextOutputBehavior?.origin;
    const defaultBehavior = this.makeBehaviour({
      pathPattern: defaultOpenNextOutputBehavior?.pattern,
      origin: defaultOriginId,
      cachePolicyId: serverCachePolicy.id,
      originRequestPolicyId,
      functionArn: this.cloudfrontFunction.arn
    });
    const { pathPattern: _, ...defaultBehaviorWithoutPathPattern } = defaultBehavior;
    return new aws.cloudfront.Distribution(
      `${args.name}-distribution`,
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
            restrictionType: "none"
          }
        },
        viewerCertificate: {
          cloudfrontDefaultCertificate: true,
          minimumProtocolVersion: "TLSv1.2_2021",
          // Most secure available option
          sslSupportMethod: "sni-only"
          // More cost-effective than vip
        },
        webAclId: args.webAclArn,
        // Attach WAF if provided
        origins
      },
      { parent: this }
    );
  }
  createOrigins(args) {
    const { s3: s3Origin } = args.openNextOutput.origins;
    const origins = [
      {
        originId: "s3",
        domainName: args.bucketRegionalDomainName,
        originPath: `/${s3Origin.originPath}`,
        // "/_assets",
        s3OriginConfig: {
          originAccessIdentity: this.originAccessIdentity.cloudfrontAccessIdentityPath
        }
      }
    ];
    for (const [key, functionUrl] of args.functionUrls) {
      origins.push({
        originId: key,
        domainName: functionUrl.apply(
          (url) => url.split("//")[1].split("/")[0]
        ),
        customOriginConfig: {
          httpPort: 80,
          httpsPort: 443,
          originProtocolPolicy: "https-only",
          originReadTimeout: 10,
          originSslProtocols: ["TLSv1.2"]
        },
        originAccessControlId: this.originAccessControl.id
      });
    }
    return origins;
  }
  createServerCachePolicy(name) {
    return new aws.cloudfront.CachePolicy(
      `${name}-cache-policy`,
      {
        comment: `Pulumi Cloud server response cache policy`,
        defaultTtl: 60,
        maxTtl: 31536e3,
        minTtl: 0,
        parametersInCacheKeyAndForwardedToOrigin: {
          cookiesConfig: {
            cookieBehavior: "none"
          },
          enableAcceptEncodingBrotli: true,
          enableAcceptEncodingGzip: true,
          headersConfig: {
            headerBehavior: "whitelist",
            headers: {
              items: [
                "accept",
                "rsc",
                "next-router-prefetch",
                "next-router-state-tree",
                "next-url",
                "x-prerender-revalidate"
              ]
            }
          },
          queryStringsConfig: {
            queryStringBehavior: "all"
          }
        }
      },
      { parent: this }
    );
  }
  createApiCachePolicy(name) {
    return new aws.cloudfront.CachePolicy(
      `${name}-api-cache-policy`,
      {
        comment: `API routes cache policy for edge functions`,
        defaultTtl: 0,
        // No default caching for APIs
        maxTtl: 31536e3,
        minTtl: 0,
        parametersInCacheKeyAndForwardedToOrigin: {
          cookiesConfig: {
            cookieBehavior: "all"
            // Forward all cookies for API routes
          },
          enableAcceptEncodingBrotli: true,
          enableAcceptEncodingGzip: true,
          headersConfig: {
            headerBehavior: "whitelist",
            headers: {
              items: [
                "authorization",
                "content-type",
                "accept",
                "user-agent",
                "referer",
                "x-forwarded-for",
                "cloudfront-viewer-country"
              ]
            }
          },
          queryStringsConfig: {
            queryStringBehavior: "all"
            // Forward all query strings for APIs
          }
        }
      },
      { parent: this }
    );
  }
  makeBehaviour(args) {
    return {
      viewerProtocolPolicy: "redirect-to-https",
      allowedMethods: args.allowedMethods || ["GET", "HEAD", "OPTIONS"],
      cachedMethods: args.cachedMethods || ["GET", "HEAD", "OPTIONS"],
      cachePolicyId: args.cachePolicyId,
      ...args.originRequestPolicyId ? {
        originRequestPolicyId: args.originRequestPolicyId
      } : {},
      functionAssociations: [
        {
          eventType: "viewer-request",
          functionArn: args.functionArn
        }
      ],
      pathPattern: args.pathPattern,
      targetOriginId: args.origin,
      compress: true
    };
  }
};

// src/components/core/functions.ts
var path = __toESM(require("path"));
var aws4 = __toESM(require("@pulumi/aws"));
var pulumi2 = __toESM(require("@pulumi/pulumi"));

// src/components/shared/iam.ts
var aws2 = __toESM(require("@pulumi/aws"));
function createBucketPolicy(name, bucketArn, parent) {
  return new aws2.iam.Policy(
    `${name}-bucket-policy`,
    {
      description: "S3 bucket read/write access",
      policy: bucketArn.apply(
        (arn) => JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: ["s3:PutObject", "s3:GetObject"],
              Resource: [`${arn}/*`]
            }
          ]
        })
      )
    },
    { parent }
  );
}
function createTablePolicy(name, tableArn, parent) {
  return new aws2.iam.Policy(
    `${name}-table-policy`,
    {
      description: "DynamoDB read/write access policy",
      policy: tableArn.apply(
        (arn) => JSON.stringify({
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
                "dynamodb:Scan"
              ],
              Resource: [`${arn}`, `${arn}/index/*`]
            }
          ]
        })
      )
    },
    { parent }
  );
}
function createQueuePolicy(name, queueArn, parent) {
  return new aws2.iam.Policy(
    `${name}-queue-policy`,
    {
      description: "Allow sending messages to the SQS queue",
      policy: queueArn.apply(
        (arn) => JSON.stringify({
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
              Resource: arn
            }
          ]
        })
      )
    },
    { parent }
  );
}
function createLoggingPolicy(name, parent) {
  const loggingPolicyDocument = aws2.iam.getPolicyDocument(
    {
      statements: [
        {
          effect: "Allow",
          actions: [
            "logs:CreateLogGroup",
            "logs:CreateLogStream",
            "logs:PutLogEvents"
          ],
          resources: ["arn:aws:logs:*:*:*"]
        }
      ]
    },
    { parent }
  );
  return new aws2.iam.Policy(
    `${name}-logging-policy`,
    {
      path: "/",
      description: "IAM policy for logging from a lambda",
      policy: loggingPolicyDocument.then(
        (doc) => doc.json
      )
    },
    { parent }
  );
}

// src/components/shared/utils.ts
var crypto = __toESM(require("crypto"));
var aws3 = __toESM(require("@pulumi/aws"));
function computeHexHash(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}
function createLambdaRole(name, parent) {
  return new aws3.iam.Role(
    `${name}-lambda-role`,
    {
      assumeRolePolicy: aws3.iam.assumeRolePolicyForPrincipal({
        Service: "lambda.amazonaws.com"
      })
    },
    { parent }
  );
}
function attachBasicLambdaExecutionRole(name, role, parent) {
  return new aws3.iam.RolePolicyAttachment(
    `${name}-lambda-basic-execution-role-policy-attachment`,
    {
      policyArn: "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
      role: role.name
    },
    { parent }
  );
}

// src/components/core/functions.ts
var DEFAULT_LAMBDA_CONFIGS = {
  default: {
    memory: 512,
    timeout: 15,
    runtime: aws4.lambda.Runtime.NodeJS20dX,
    architecture: "x86_64"
  },
  imageOptimizer: {
    memory: 1024,
    timeout: 30,
    runtime: aws4.lambda.Runtime.NodeJS20dX,
    architecture: "x86_64"
  }
};
var NextJsFunctions = class extends pulumi2.ComponentResource {
  constructor(name, args, opts) {
    super("nextjs:functions:Functions", name, {}, opts);
    this.functions = /* @__PURE__ */ new Map();
    this.functionUrls = /* @__PURE__ */ new Map();
    this.createFunctionOrigins(args);
  }
  createFunctionOrigins(args) {
    const {
      default: defaultOrigin,
      imageOptimizer: imageOrigin,
      ...customOrigins
    } = args.openNextOutput.origins;
    if (defaultOrigin && defaultOrigin.type === "function") {
      this.createFunctionOrigin("default", defaultOrigin, args);
    }
    if (imageOrigin && imageOrigin.type === "function") {
      this.createFunctionOrigin("imageOptimizer", imageOrigin, args);
    }
    Object.entries(customOrigins).forEach(([key, origin]) => {
      if (origin && origin.type === "function") {
        this.createFunctionOrigin(key, origin, args);
      }
    });
  }
  getLambdaConfig(key, args) {
    const baseDefaults = {
      memory: 256,
      timeout: 15,
      runtime: aws4.lambda.Runtime.NodeJS20dX,
      architecture: "x86_64"
    };
    const serverKey = key === "default" ? "default" : key;
    const serverDefaults = DEFAULT_LAMBDA_CONFIGS[serverKey] || {};
    const userDefaultConfig = args.lambdaConfig?.default || {};
    const userServerConfig = key === "default" ? args.lambdaConfig?.defaultServer || {} : args.lambdaConfig?.[key] || {};
    return {
      ...baseDefaults,
      ...serverDefaults,
      ...userDefaultConfig,
      ...userServerConfig
    };
  }
  createFunctionOrigin(key, origin, args) {
    const role = createLambdaRole(`${args.name}-${key}-origin`, this);
    const config = this.getLambdaConfig(key, args);
    const fn = new aws4.lambda.Function(
      `${args.name}-${key}-origin-lambda`,
      {
        handler: origin.handler,
        runtime: config.runtime,
        environment: args.environment,
        timeout: config.timeout,
        memorySize: config.memory,
        architectures: [config.architecture],
        role: role.arn,
        code: new pulumi2.asset.FileArchive(path.join(args.path, origin.bundle))
      },
      { parent: this }
    );
    this.grantPermissions(role, key, args);
    const functionUrl = new aws4.lambda.FunctionUrl(
      `${args.name}-${key}-origin-lambda-url`,
      {
        functionName: fn.arn,
        authorizationType: "AWS_IAM",
        // Secured with CloudFront Origin Access Control
        invokeMode: origin.streaming ? "RESPONSE_STREAM" : "BUFFERED"
      },
      { parent: this }
    );
    this.functions.set(key, fn);
    this.functionUrls.set(key, functionUrl.functionUrl);
  }
  grantPermissions(role, key, args) {
    attachBasicLambdaExecutionRole(`${args.name}-${key}`, role, this);
    const loggingPolicy = createLoggingPolicy(`${args.name}-${key}`, this);
    new aws4.iam.RolePolicyAttachment(
      `${args.name}-${key}-logging-policy-attachment`,
      {
        policyArn: loggingPolicy.arn,
        role: role.name
      },
      { parent: this }
    );
    new aws4.iam.RolePolicyAttachment(
      `${args.name}-${key}-bucket-read-write-role-policy-attachment`,
      {
        policyArn: args.bucketPolicy,
        role: role.name
      },
      { parent: this }
    );
    new aws4.iam.RolePolicyAttachment(
      `${args.name}-${key}-table-read-write-data-role-policy-attachment`,
      {
        policyArn: args.tablePolicy,
        role: role.name
      },
      { parent: this }
    );
    new aws4.iam.RolePolicyAttachment(
      `${args.name}-${key}-queue-send-message-role-policy-attachment`,
      {
        policyArn: args.queuePolicy,
        role: role.name
      },
      { parent: this }
    );
  }
};

// src/components/core/storage.ts
var path2 = __toESM(require("path"));
var aws5 = __toESM(require("@pulumi/aws"));
var pulumi3 = __toESM(require("@pulumi/pulumi"));
var glob = __toESM(require("glob"));
var import_mime = __toESM(require("mime"));
var NextJsStorage = class extends pulumi3.ComponentResource {
  constructor(name, args, opts) {
    super("nextjs:storage:Storage", name, {}, opts);
    this.bucket = this.createBucket(args.name);
    this.bucketPolicy = createBucketPolicy(args.name, this.bucket.arn, this);
    for (const copy of args.openNextOutput.origins.s3.copy) {
      this.addFilesToBucket(args.name, args.path, copy);
    }
  }
  createBucket(name) {
    const bucket = new aws5.s3.Bucket(
      `${name}-open-next-bucket`,
      {
        bucket: `${name}-open-next-bucket`,
        forceDestroy: true
      },
      { parent: this }
    );
    new aws5.s3.BucketPublicAccessBlock(
      `${name}-bucket-block-public-access`,
      {
        bucket: bucket.id,
        blockPublicAcls: true,
        blockPublicPolicy: true,
        ignorePublicAcls: true,
        restrictPublicBuckets: true
      },
      { parent: this }
    );
    return bucket;
  }
  addFilesToBucket(name, basePath, copy) {
    const sourceDir = path2.resolve(basePath, copy.from);
    if (!require("fs").existsSync(sourceDir)) {
      console.warn(
        `Warning: Source directory ${sourceDir} does not exist, skipping...`
      );
      return;
    }
    const files = glob.sync("**", {
      cwd: sourceDir,
      dot: true,
      nodir: true,
      follow: true
    });
    for (const file of files) {
      const filePath = path2.resolve(sourceDir, file);
      if (!require("fs").existsSync(filePath)) {
        console.warn(`Warning: File ${filePath} does not exist, skipping...`);
        continue;
      }
      const cacheControl = copy.cached ? "public,max-age=31536000,immutable" : "public,max-age=0,s-maxage=31536000,must-revalidate";
      const hex = computeHexHash(file);
      const key = path2.join(copy.to, file);
      new aws5.s3.BucketObject(
        `${name}-bucket-object-${hex}`,
        {
          bucket: this.bucket.id,
          key,
          source: new pulumi3.asset.FileAsset(filePath),
          cacheControl,
          contentType: import_mime.default.getType(file) || void 0
        },
        { parent: this }
      );
    }
  }
};

// src/components/isr-revalidation/database.ts
var path3 = __toESM(require("path"));
var aws6 = __toESM(require("@pulumi/aws"));
var pulumi4 = __toESM(require("@pulumi/pulumi"));
var NextJsDatabase = class extends pulumi4.ComponentResource {
  constructor(name, args, opts) {
    super("nextjs:database:Database", name, {}, opts);
    this.table = this.createRevalidationTable(args);
    this.tablePolicy = createTablePolicy(args.name, this.table.arn, this);
  }
  createRevalidationTable(args) {
    const tableName = `${args.name}-RevalidationTable`;
    const table = new aws6.dynamodb.Table(
      `${args.name}-revalidation-table`,
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
            nonKeyAttributes: ["tag"]
          }
        ],
        attributes: [
          { name: "tag", type: "S" },
          { name: "path", type: "S" },
          { name: "revalidatedAt", type: "N" }
        ]
      },
      { parent: this }
    );
    if (args.openNextOutput?.additionalProps?.initializationFunction) {
      this.createInitializationFunction(args, tableName, table);
    }
    return table;
  }
  createInitializationFunction(args, tableName, table) {
    new aws6.cloudwatch.LogGroup(
      `${args.name}-revalidation-table-lambda-log-group`,
      {
        retentionInDays: 1
      },
      { parent: this }
    );
    const role = createLambdaRole(`${args.name}-revalidation-table`, this);
    const loggingPolicy = createLoggingPolicy(
      `${args.name}-revalidation-table-lambda`,
      this
    );
    new aws6.iam.RolePolicyAttachment(
      `${args.name}-revalidation-table-lambda-logging-role-policy-attachment`,
      {
        role: role.name,
        policyArn: loggingPolicy.arn
      },
      { parent: this }
    );
    const dynamoDbPolicy = new aws6.iam.Policy(
      `${args.name}-revalidation-table-lambda-dynamodb-policy`,
      {
        policy: pulumi4.output({
          Version: "2012-10-17",
          Statement: [
            {
              Action: [
                "dynamodb:PutItem",
                "dynamodb:GetItem",
                "dynamodb:UpdateItem",
                "dynamodb:DeleteItem",
                "dynamodb:Query",
                "dynamodb:BatchWriteItem"
              ],
              Effect: "Allow",
              Resource: table.arn
            }
          ]
        }).apply(JSON.stringify)
      },
      { parent: this }
    );
    new aws6.iam.RolePolicyAttachment(
      `${args.name}-revalidation-table-lambda-dynamodb-role-policy-attachment`,
      {
        role,
        policyArn: dynamoDbPolicy.arn
      },
      { parent: this }
    );
    const initFunction = args.openNextOutput.additionalProps?.initializationFunction;
    if (!initFunction) {
      throw new Error("initializationFunction is required");
    }
    const insertFn = new aws6.lambda.Function(
      `${args.name}-revalidation-table-lambda`,
      {
        description: "Next.js revalidation data insert",
        handler: initFunction.handler,
        runtime: aws6.lambda.Runtime.NodeJS20dX,
        environment: {
          variables: {
            CACHE_DYNAMO_TABLE: tableName
          }
        },
        timeout: 15,
        memorySize: 128,
        role: role.arn,
        code: new pulumi4.asset.FileArchive(
          path3.join(args.path, initFunction.bundle)
        )
      },
      { parent: this }
    );
    new aws6.lambda.Invocation(
      `${args.name}-revalidation-table-seeder`,
      {
        functionName: insertFn.name,
        triggers: {
          time: Date.now().toString()
        },
        input: pulumi4.jsonStringify({})
      },
      { parent: this }
    );
  }
};

// src/components/isr-revalidation/queue.ts
var path4 = __toESM(require("path"));
var aws7 = __toESM(require("@pulumi/aws"));
var pulumi5 = __toESM(require("@pulumi/pulumi"));
var NextJsQueue = class extends pulumi5.ComponentResource {
  constructor(name, args, opts) {
    super("nextjs:queue:Queue", name, {}, opts);
    this.queue = this.createRevalidationQueue(args);
    this.queuePolicy = createQueuePolicy(args.name, this.queue.arn, this);
  }
  createRevalidationQueue(args) {
    const queue = new aws7.sqs.Queue(
      `${args.name}-revalidation-queue`,
      {
        fifoQueue: true,
        receiveWaitTimeSeconds: 20,
        contentBasedDeduplication: true,
        // FIFO queue names must end with ".fifo"
        name: "revalidationQueue.fifo"
      },
      { parent: this }
    );
    if (args.openNextOutput?.additionalProps?.revalidationFunction) {
      this.createConsumerFunction(args, queue);
    }
    return queue;
  }
  createConsumerFunction(args, queue) {
    const role = createLambdaRole(`${args.name}-revalidation-queue`, this);
    const loggingPolicy = createLoggingPolicy(
      `${args.name}-revalidation-queue-lambda`,
      this
    );
    new aws7.iam.RolePolicyAttachment(
      `${args.name}-revalidation-queue-lambda-logging-role-policy-attachment`,
      {
        role: role.name,
        policyArn: loggingPolicy.arn
      },
      { parent: this }
    );
    const queuePolicy = new aws7.iam.Policy(
      `${args.name}-revalidation-queue-lambda-sqs-policy`,
      {
        policy: pulumi5.output({
          Version: "2012-10-17",
          Statement: [
            {
              Action: [
                "sqs:ReceiveMessage",
                "sqs:DeleteMessage",
                "sqs:GetQueueAttributes"
              ],
              Effect: "Allow",
              Resource: queue.arn
            }
          ]
        }).apply(JSON.stringify)
      },
      { parent: this }
    );
    new aws7.iam.RolePolicyAttachment(
      `${args.name}-revalidation-queue-lambda-sqs-role-policy-attachment`,
      {
        role,
        policyArn: queuePolicy.arn
      },
      { parent: this }
    );
    const revalidationFunction = args.openNextOutput.additionalProps?.revalidationFunction;
    if (!revalidationFunction) {
      throw new Error("revalidationFunction is required");
    }
    const consumer = new aws7.lambda.Function(
      `${args.name}-revalidation-queue-lambda`,
      {
        handler: revalidationFunction.handler,
        code: new pulumi5.asset.FileArchive(
          path4.join(args.path, revalidationFunction.bundle)
        ),
        runtime: aws7.lambda.Runtime.NodeJS20dX,
        timeout: 30,
        role: role.arn
      },
      { parent: this }
    );
    new aws7.lambda.EventSourceMapping(
      `${args.name}-revalidation-queue-lambda-event-source`,
      {
        eventSourceArn: queue.arn,
        functionName: consumer.arn,
        enabled: true
      },
      { parent: this }
    );
  }
};

// src/components/security/waf.ts
var aws8 = __toESM(require("@pulumi/aws"));
var pulumi6 = __toESM(require("@pulumi/pulumi"));
var NextJsWaf = class extends pulumi6.ComponentResource {
  constructor(name, config, opts) {
    super("nextjs:security:Waf", name, {}, opts);
    if (!config.enabled) {
      throw new Error("WAF is disabled. Do not create this resource.");
    }
    const rules = this.createRules(name, config);
    this.webAcl = new aws8.wafv2.WebAcl(
      `${name}-waf`,
      {
        scope: "CLOUDFRONT",
        description: "WAF for Next.js application",
        defaultAction: { allow: {} },
        rules,
        visibilityConfig: {
          cloudwatchMetricsEnabled: config.enableMetrics ?? true,
          metricName: `${name}-waf-metric`,
          sampledRequestsEnabled: config.enableSampledRequests ?? true
        },
        tags: {
          Name: `${name}-waf`,
          ManagedBy: "Pulumi"
        }
      },
      { parent: this, provider: this.getUsEast1Provider() }
    );
  }
  createRules(name, config) {
    const rules = [];
    let priority = 1;
    if (config.rateLimit && config.rateLimit > 0) {
      rules.push({
        name: "RateLimitRule",
        priority: priority++,
        action: { block: {} },
        statement: {
          rateBasedStatement: {
            limit: config.rateLimit,
            aggregateKeyType: "IP"
          }
        },
        visibilityConfig: {
          cloudwatchMetricsEnabled: config.enableMetrics ?? true,
          metricName: `${name}-rate-limit-metric`,
          sampledRequestsEnabled: config.enableSampledRequests ?? true
        }
      });
    }
    if (config.blockIpAddresses && config.blockIpAddresses.length > 0) {
      const ipSet = new aws8.wafv2.IpSet(
        `${name}-blocked-ips`,
        {
          scope: "CLOUDFRONT",
          ipAddressVersion: "IPV4",
          addresses: config.blockIpAddresses
        },
        { parent: this, provider: this.getUsEast1Provider() }
      );
      rules.push({
        name: "BlockSpecificIPs",
        priority: priority++,
        action: { block: {} },
        statement: {
          ipSetReferenceStatement: {
            arn: ipSet.arn
          }
        },
        visibilityConfig: {
          cloudwatchMetricsEnabled: config.enableMetrics ?? true,
          metricName: `${name}-blocked-ips-metric`,
          sampledRequestsEnabled: config.enableSampledRequests ?? true
        }
      });
    }
    if (config.allowIpAddresses && config.allowIpAddresses.length > 0) {
      const ipSet = new aws8.wafv2.IpSet(
        `${name}-allowed-ips`,
        {
          scope: "CLOUDFRONT",
          ipAddressVersion: "IPV4",
          addresses: config.allowIpAddresses
        },
        { parent: this, provider: this.getUsEast1Provider() }
      );
      rules.push({
        name: "AllowSpecificIPs",
        priority: priority++,
        action: { allow: {} },
        statement: {
          ipSetReferenceStatement: {
            arn: ipSet.arn
          }
        },
        visibilityConfig: {
          cloudwatchMetricsEnabled: config.enableMetrics ?? true,
          metricName: `${name}-allowed-ips-metric`,
          sampledRequestsEnabled: config.enableSampledRequests ?? true
        }
      });
    }
    if (config.blockCountries && config.blockCountries.length > 0) {
      rules.push({
        name: "BlockCountries",
        priority: priority++,
        action: { block: {} },
        statement: {
          geoMatchStatement: {
            countryCodes: config.blockCountries
          }
        },
        visibilityConfig: {
          cloudwatchMetricsEnabled: config.enableMetrics ?? true,
          metricName: `${name}-blocked-countries-metric`,
          sampledRequestsEnabled: config.enableSampledRequests ?? true
        }
      });
    }
    if (config.enableCommonRuleSet ?? true) {
      rules.push({
        name: "AWSManagedRulesCommonRuleSet",
        priority: priority++,
        overrideAction: { none: {} },
        statement: {
          managedRuleGroupStatement: {
            vendorName: "AWS",
            name: "AWSManagedRulesCommonRuleSet"
          }
        },
        visibilityConfig: {
          cloudwatchMetricsEnabled: config.enableMetrics ?? true,
          metricName: `${name}-common-rule-set-metric`,
          sampledRequestsEnabled: config.enableSampledRequests ?? true
        }
      });
    }
    if (config.enableKnownBadInputs ?? true) {
      rules.push({
        name: "AWSManagedRulesKnownBadInputsRuleSet",
        priority: priority++,
        overrideAction: { none: {} },
        statement: {
          managedRuleGroupStatement: {
            vendorName: "AWS",
            name: "AWSManagedRulesKnownBadInputsRuleSet"
          }
        },
        visibilityConfig: {
          cloudwatchMetricsEnabled: config.enableMetrics ?? true,
          metricName: `${name}-known-bad-inputs-metric`,
          sampledRequestsEnabled: config.enableSampledRequests ?? true
        }
      });
    }
    if (config.enableAnonymousIpList) {
      rules.push({
        name: "AWSManagedRulesAnonymousIpList",
        priority: priority++,
        overrideAction: { none: {} },
        statement: {
          managedRuleGroupStatement: {
            vendorName: "AWS",
            name: "AWSManagedRulesAnonymousIpList"
          }
        },
        visibilityConfig: {
          cloudwatchMetricsEnabled: config.enableMetrics ?? true,
          metricName: `${name}-anonymous-ip-list-metric`,
          sampledRequestsEnabled: config.enableSampledRequests ?? true
        }
      });
    }
    if (config.enableIpReputationList) {
      rules.push({
        name: "AWSManagedRulesAmazonIpReputationList",
        priority: priority++,
        overrideAction: { none: {} },
        statement: {
          managedRuleGroupStatement: {
            vendorName: "AWS",
            name: "AWSManagedRulesAmazonIpReputationList"
          }
        },
        visibilityConfig: {
          cloudwatchMetricsEnabled: config.enableMetrics ?? true,
          metricName: `${name}-ip-reputation-list-metric`,
          sampledRequestsEnabled: config.enableSampledRequests ?? true
        }
      });
    }
    return rules;
  }
  getUsEast1Provider() {
    return new aws8.Provider("us-east-1-provider", {
      region: "us-east-1"
    });
  }
};

// src/components/warmer/warmer.ts
var aws9 = __toESM(require("@pulumi/aws"));
var pulumi7 = __toESM(require("@pulumi/pulumi"));
var path5 = __toESM(require("path"));
var NextJsWarmer = class extends pulumi7.ComponentResource {
  constructor(name, args, opts) {
    super("nextjs:warmer:Warmer", name, {}, opts);
    const config = this.resolveConfig(args.config);
    if (!config.enabled || !args.openNextOutput.additionalProps?.warmer) {
      return;
    }
    this.warmerFunction = this.createWarmerFunction(args, config);
    this.eventRule = this.createEventRule(args.name, config);
    this.grantEventBridgePermission(args.name);
    this.eventTarget = this.createEventTarget(args.name);
  }
  resolveConfig(config) {
    return {
      enabled: config?.enabled ?? false,
      schedule: config?.schedule ?? "rate(5 minutes)",
      concurrency: config?.concurrency ?? 1
    };
  }
  shouldWarmFunction(functionKey, config) {
    if (!config?.functions?.[functionKey]) {
      return true;
    }
    return config.functions[functionKey].enabled !== false;
  }
  getFunctionConcurrency(functionKey, config, warmerConfig) {
    const functionConfig = warmerConfig?.functions?.[functionKey];
    if (functionConfig?.concurrency !== void 0) {
      return functionConfig.concurrency;
    }
    return config.concurrency;
  }
  createWarmerFunction(args, config) {
    const role = createLambdaRole(`${args.name}-warmer`, this);
    const loggingPolicy = createLoggingPolicy(`${args.name}-warmer`, this);
    new aws9.iam.RolePolicyAttachment(
      `${args.name}-warmer-logging-policy-attachment`,
      {
        policyArn: loggingPolicy.arn,
        role: role.name
      },
      { parent: this }
    );
    const invokePolicy = new aws9.iam.Policy(
      `${args.name}-warmer-invoke-policy`,
      {
        description: "Allow warmer to invoke Lambda functions",
        policy: pulumi7.output({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: ["lambda:InvokeFunction"],
              Resource: Array.from(args.functions.values()).map(
                (fn) => pulumi7.interpolate`${fn.arn}`
              )
            }
          ]
        }).apply(JSON.stringify)
      },
      { parent: this }
    );
    new aws9.iam.RolePolicyAttachment(
      `${args.name}-warmer-invoke-policy-attachment`,
      {
        policyArn: invokePolicy.arn,
        role: role.name
      },
      { parent: this }
    );
    const warmParams = Array.from(args.functions.entries()).filter(([key]) => this.shouldWarmFunction(key, args.config)).map(([key, fn]) => ({
      function: fn.name,
      concurrency: this.getFunctionConcurrency(key, config, args.config)
    }));
    const warmerConfig = args.openNextOutput.additionalProps?.warmer;
    if (!warmerConfig) {
      throw new Error("Warmer configuration not found in OpenNext output");
    }
    return new aws9.lambda.Function(
      `${args.name}-warmer-lambda`,
      {
        handler: warmerConfig.handler,
        runtime: aws9.lambda.Runtime.NodeJS20dX,
        environment: {
          variables: {
            WARM_PARAMS: pulumi7.all(warmParams.map((p) => p.function)).apply(
              (names) => JSON.stringify(
                names.map((name, i) => ({
                  function: name,
                  concurrency: warmParams[i].concurrency
                }))
              )
            )
          }
        },
        timeout: 900,
        // 15 minutes - warmer needs time to invoke all functions
        memorySize: 128,
        role: role.arn,
        code: new pulumi7.asset.FileArchive(
          path5.join(args.path, warmerConfig.bundle)
        )
      },
      { parent: this }
    );
  }
  createEventRule(name, config) {
    return new aws9.cloudwatch.EventRule(
      `${name}-warmer-rule`,
      {
        description: "Periodic warming for Next.js Lambda functions",
        scheduleExpression: config.schedule,
        state: config.enabled ? "ENABLED" : "DISABLED"
      },
      { parent: this }
    );
  }
  grantEventBridgePermission(name) {
    if (!this.warmerFunction || !this.eventRule) {
      return;
    }
    new aws9.lambda.Permission(
      `${name}-warmer-eventbridge-permission`,
      {
        action: "lambda:InvokeFunction",
        function: this.warmerFunction.name,
        principal: "events.amazonaws.com",
        sourceArn: this.eventRule.arn
      },
      { parent: this }
    );
  }
  createEventTarget(name) {
    if (!this.warmerFunction || !this.eventRule) {
      throw new Error("Warmer function or event rule not created");
    }
    return new aws9.cloudwatch.EventTarget(
      `${name}-warmer-target`,
      {
        rule: this.eventRule.name,
        arn: this.warmerFunction.arn
      },
      { parent: this }
    );
  }
};

// src/scripts/fix-pnpm-symlinks.ts
var fs = __toESM(require("fs"));
var path6 = __toESM(require("path"));
var PnpmSymlinkFixer = class {
  constructor(openNextDir = ".open-next") {
    this.openNextDir = openNextDir;
    this.fixed = 0;
    this.errors = 0;
  }
  log(message, type = "info") {
    const prefix = {
      info: "\u2139\uFE0F",
      success: "\u2705",
      error: "\u274C",
      warning: "\u26A0\uFE0F"
    }[type];
    console.log(`${prefix} ${message}`);
  }
  /**
   * Find all .bin directories in the OpenNext output
   */
  findBinDirectories() {
    const binDirs = [];
    const searchDir = (dir) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path6.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === ".bin") {
            binDirs.push(fullPath);
          } else if (entry.name === "node_modules") {
            const binPath = path6.join(fullPath, ".bin");
            if (fs.existsSync(binPath)) {
              binDirs.push(binPath);
            }
          } else {
            searchDir(fullPath);
          }
        }
      }
    };
    searchDir(this.openNextDir);
    return binDirs;
  }
  /**
   * Resolve pnpm symlinks by finding the actual executable files
   */
  resolvePnpmSymlink(symlinkPath, binDir) {
    try {
      const target = fs.readlinkSync(symlinkPath);
      const fileName = path6.basename(symlinkPath);
      const nodeModulesDir = path6.dirname(binDir);
      const searchPaths = [
        // Direct relative path resolution
        path6.resolve(binDir, target),
        // Look in the package's bin directory
        path6.join(nodeModulesDir, fileName, "bin.js"),
        path6.join(nodeModulesDir, fileName, "cli.js"),
        path6.join(nodeModulesDir, fileName, "index.js"),
        path6.join(nodeModulesDir, fileName, `bin/${fileName}`),
        path6.join(nodeModulesDir, fileName, `bin/${fileName}.js`),
        // Look for the package in common locations
        path6.join(
          nodeModulesDir,
          `.pnpm/${fileName}@*/node_modules/${fileName}/bin.js`
        ),
        path6.join(
          nodeModulesDir,
          `.pnpm/${fileName}@*/node_modules/${fileName}/cli.js`
        )
      ];
      for (const searchPath of searchPaths) {
        if (searchPath.includes("*")) {
          const globPattern = searchPath;
          const baseDir = globPattern.split("*")[0];
          const suffix = globPattern.split("*")[1];
          if (fs.existsSync(path6.dirname(baseDir))) {
            const entries = fs.readdirSync(path6.dirname(baseDir));
            for (const entry of entries) {
              if (entry.startsWith(path6.basename(baseDir).replace("@", ""))) {
                const fullPath = path6.join(
                  path6.dirname(baseDir),
                  entry,
                  suffix
                );
                if (fs.existsSync(fullPath)) {
                  return fullPath;
                }
              }
            }
          }
        } else if (fs.existsSync(searchPath)) {
          return searchPath;
        }
      }
      return null;
    } catch (error) {
      this.log(
        `Error resolving symlink ${symlinkPath}: ${error instanceof Error ? error.message : "Unknown error"}`,
        "error"
      );
      return null;
    }
  }
  /**
   * Fix a single symlink by replacing it with the actual file
   */
  fixSymlink(symlinkPath, binDir) {
    const fileName = path6.basename(symlinkPath);
    try {
      fs.accessSync(symlinkPath);
      this.log(`Symlink ${fileName} is valid`, "success");
      return true;
    } catch (error) {
      this.log(
        `Fixing broken symlink: ${fileName}: ${error instanceof Error ? error.message : "Unknown error"}`,
        "warning"
      );
      const actualFile = this.resolvePnpmSymlink(symlinkPath, binDir);
      if (actualFile && fs.existsSync(actualFile)) {
        fs.unlinkSync(symlinkPath);
        fs.copyFileSync(actualFile, symlinkPath);
        fs.chmodSync(symlinkPath, 493);
        this.log(
          `Fixed ${fileName} -> ${path6.relative(process.cwd(), actualFile)}`,
          "success"
        );
        this.fixed++;
        return true;
      } else {
        this.log(`Could not find actual file for ${fileName}`, "error");
        fs.unlinkSync(symlinkPath);
        this.errors++;
        return false;
      }
    }
  }
  /**
   * Process all symlinks in a .bin directory
   */
  processBinDirectory(binDir) {
    this.log(`Processing ${binDir}`);
    if (!fs.existsSync(binDir)) {
      this.log(`Directory ${binDir} does not exist`, "warning");
      return;
    }
    const files = fs.readdirSync(binDir);
    for (const file of files) {
      const filePath = path6.join(binDir, file);
      try {
        const stats = fs.lstatSync(filePath);
        if (stats.isSymbolicLink()) {
          this.fixSymlink(filePath, binDir);
        }
      } catch (error) {
        this.log(
          `Error processing ${file}: ${error instanceof Error ? error.message : "Unknown error"}`,
          "error"
        );
        this.errors++;
      }
    }
  }
  /**
   * Main method to fix all symlinks in OpenNext output
   */
  fixAll() {
    this.log("Starting pnpm symlink fix for OpenNext...");
    if (!fs.existsSync(this.openNextDir)) {
      this.log(`OpenNext directory ${this.openNextDir} not found`, "error");
      return false;
    }
    const binDirectories = this.findBinDirectories();
    if (binDirectories.length === 0) {
      this.log("No .bin directories found", "warning");
      return true;
    }
    this.log(`Found ${binDirectories.length} .bin directories`);
    for (const binDir of binDirectories) {
      this.processBinDirectory(binDir);
    }
    this.log(
      `Symlink fix complete! Fixed: ${this.fixed}, Errors: ${this.errors}`,
      this.errors === 0 ? "success" : "warning"
    );
    return this.errors === 0;
  }
};
var fixSymLinks = (openNextDir) => {
  const fixer = new PnpmSymlinkFixer(openNextDir);
  fixer.fixAll();
};

// src/nextjs.ts
var NextJsSite = class extends pulumi8.ComponentResource {
  constructor(name, args, opts) {
    super("cloud:index:NextJsSite", name, {}, opts);
    this.path = args.path ?? "../apps/web";
    const openNextDir = path7.join(this.path, ".open-next");
    if (args.fixSymLinks === true) {
      fixSymLinks(openNextDir);
    }
    this.environment = args.environment ?? {};
    this.name = name;
    const config = new pulumi8.Config();
    this.region = config.require("aws:region");
    this.openNextOutput = JSON.parse(
      (0, import_node_fs.readFileSync)(path7.join(openNextDir, "open-next.output.json"), "utf-8")
    );
    this.storage = new NextJsStorage(
      `${name}-storage`,
      {
        name,
        openNextOutput: this.openNextOutput,
        path: this.path,
        region: this.region
      },
      { parent: this }
    );
    this.database = new NextJsDatabase(
      `${name}-database`,
      {
        name,
        openNextOutput: this.openNextOutput,
        path: this.path,
        region: this.region
      },
      { parent: this }
    );
    this.queue = new NextJsQueue(
      `${name}-queue`,
      {
        name,
        openNextOutput: this.openNextOutput,
        path: this.path,
        region: this.region
      },
      { parent: this }
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
        lambdaConfig: args.lambdaConfig
      },
      { parent: this }
    );
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
        webAclArn: this.waf?.webAcl.arn
      },
      { parent: this }
    );
    if (args.warmer?.enabled === true) {
      this.warmer = new NextJsWarmer(
        `${name}-warmer`,
        {
          name,
          openNextOutput: this.openNextOutput,
          path: this.path,
          functions: this.functions.functions,
          config: args.warmer
        },
        { parent: this }
      );
    }
    this.domainName = this.distribution.distribution.domainName;
    this.url = pulumi8.interpolate`https://${this.distribution.distribution.domainName}`;
  }
  getEnvironment() {
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
        BUCKET_KEY_PREFIX: "_assets"
      }
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  NextJsSite
});
