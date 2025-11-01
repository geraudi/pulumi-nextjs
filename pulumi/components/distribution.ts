import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import type { DistributionArgs } from "./shared/types";

export class NextJsDistribution extends pulumi.ComponentResource {
  public distribution: aws.cloudfront.Distribution;
  public cloudfrontFunction: aws.cloudfront.Function;
  public originAccessIdentity: aws.cloudfront.OriginAccessIdentity;

  constructor(
    name: string,
    args: DistributionArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super("nextjs:distribution:Distribution", name, {}, opts);

    this.originAccessIdentity = this.createOriginAccessIdentity(args.name);
    this.createBucketPolicy(args);
    this.cloudfrontFunction = this.createCloudfrontFunction(args.name);
    this.distribution = this.createDistribution(args);
  }

  private createOriginAccessIdentity(
    name: string,
  ): aws.cloudfront.OriginAccessIdentity {
    return new aws.cloudfront.OriginAccessIdentity(
      `${name}-origin-identity`,
      {},
      { parent: this },
    );
  }

  private createBucketPolicy(args: DistributionArgs): void {
    new aws.s3.BucketPolicy(
      `${args.name}-bucket-policy`,
      {
        bucket: args.bucketRegionalDomainName.apply(
          (domain) => domain.split(".")[0],
        ), // Extract bucket name
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
        }`,
      },
      { parent: this },
    );
  }

  private createCloudfrontFunction(name: string): aws.cloudfront.Function {
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
        publish: true,
      },
      { parent: this },
    );
  }

  private createDistribution(
    args: DistributionArgs,
  ): aws.cloudfront.Distribution {
    const origins = this.createOrigins(args);

    // The managed cache policy ID for `CACHING_OPTIMIZED`
    const staticCachePolicyId = "658327ea-f89d-4fab-a63d-7e88639e58f6";
    const serverCachePolicy = this.createServerCachePolicy(args.name);

    // Referencing the managed origin request policy (ALL_VIEWER_EXCEPT_HOST_HEADER)
    const originRequestPolicyId = "b689b0a8-53d0-40ab-baf2-68738e2966ac";

    const orderedCacheBehaviors = args.openNextOutput.behaviors
      .filter((b) => b.pattern !== "*")
      .map((b) => {
        // Origin IDs should match exactly with OpenNext output
        const originId = b.origin as string;

        return this.makeBehaviour({
          pathPattern: b.pattern,
          origin: originId,
          cachePolicyId:
            b.origin === "s3" ? staticCachePolicyId : serverCachePolicy.id,
          functionArn: this.cloudfrontFunction.arn,
          ...(b.origin !== "s3" ? { originRequestPolicyId } : {}),
        });
      });

    const defaultOpenNextOutputBehavior = args.openNextOutput.behaviors.find(
      (b) => b.pattern === "*",
    );

    // Origin ID should match exactly with OpenNext output
    const defaultOriginId = defaultOpenNextOutputBehavior?.origin as string;

    const defaultBehavior = this.makeBehaviour({
      pathPattern: defaultOpenNextOutputBehavior?.pattern as string,
      origin: defaultOriginId,
      cachePolicyId: serverCachePolicy.id,
      originRequestPolicyId,
      functionArn: this.cloudfrontFunction.arn,
    });

    const { pathPattern: _, ...defaultBehaviorWithoutPathPattern } =
      defaultBehavior;

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

  private createOrigins(
    args: DistributionArgs,
  ): aws.types.input.cloudfront.DistributionOrigin[] {
    const { s3: s3Origin } = args.openNextOutput.origins;

    const origins: aws.types.input.cloudfront.DistributionOrigin[] = [
      {
        originId: "s3",
        domainName: args.bucketRegionalDomainName,
        originPath: `/${s3Origin.originPath}`, // "/_assets",
        s3OriginConfig: {
          originAccessIdentity:
            this.originAccessIdentity.cloudfrontAccessIdentityPath,
        },
      },
    ];

    // Add function origins - keys should match exactly with OpenNext output
    for (const [key, functionUrl] of args.functionUrls) {
      origins.push({
        originId: key,
        domainName: functionUrl.apply(
          (url) => url.split("//")[1].split("/")[0],
        ),
        customOriginConfig: {
          httpPort: 80,
          httpsPort: 443,
          originProtocolPolicy: "https-only",
          originReadTimeout: 10,
          originSslProtocols: ["TLSv1.2"],
        },
      });
    }

    return origins;
  }

  private createServerCachePolicy(name: string): aws.cloudfront.CachePolicy {
    return new aws.cloudfront.CachePolicy(
      `${name}-cache-policy`,
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
  }

  private makeBehaviour(args: {
    pathPattern: string;
    origin: string;
    cachePolicyId: pulumi.Output<string> | string;
    originRequestPolicyId?: string;
    functionArn: pulumi.Input<string>;
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
}
