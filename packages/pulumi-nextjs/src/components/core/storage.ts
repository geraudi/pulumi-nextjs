import * as path from "node:path";
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as glob from "glob";
import mime from "mime";
import type { OpenNextS3OriginCopy, StorageArgs } from "../../types";
import { createBucketPolicy } from "../shared/iam";
import { computeHexHash } from "../shared/utils";

export class NextJsStorage extends pulumi.ComponentResource {
  public bucket: aws.s3.Bucket;
  public bucketPolicy: aws.iam.Policy;

  constructor(
    name: string,
    args: StorageArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super("nextjs:storage:Storage", name, {}, opts);

    this.bucket = this.createBucket(args.name);
    this.bucketPolicy = createBucketPolicy(args.name, this.bucket.arn, this);

    // Add files to bucket from OpenNext output
    for (const copy of args.openNextOutput.origins.s3.copy) {
      this.addFilesToBucket(args.name, args.path, copy);
    }
  }

  private createBucket(name: string): aws.s3.Bucket {
    const bucket = new aws.s3.Bucket(
      `${name}-open-next-bucket`,
      {
        bucket: `${name}-open-next-bucket`,
        forceDestroy: true,
      },
      { parent: this },
    );

    new aws.s3.BucketPublicAccessBlock(
      `${name}-bucket-block-public-access`,
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

  private addFilesToBucket(
    name: string,
    basePath: string,
    copy: OpenNextS3OriginCopy,
  ): void {
    const sourceDir = path.resolve(basePath, copy.from);

    // Check if source directory exists
    if (!require("fs").existsSync(sourceDir)) {
      console.warn(
        `Warning: Source directory ${sourceDir} does not exist, skipping...`,
      );
      return;
    }

    const files = glob.sync("**", {
      cwd: sourceDir,
      dot: true,
      nodir: true,
      follow: true,
    });

    for (const file of files) {
      const filePath = path.resolve(sourceDir, file);

      // Check if individual file exists (handles broken symlinks and missing files)
      if (!require("fs").existsSync(filePath)) {
        console.warn(`Warning: File ${filePath} does not exist, skipping...`);
        continue;
      }

      const cacheControl = copy.cached
        ? "public,max-age=31536000,immutable"
        : "public,max-age=0,s-maxage=31536000,must-revalidate";
      const hex = computeHexHash(file);
      const key = path.join(copy.to, file);

      new aws.s3.BucketObject(
        `${name}-bucket-object-${hex}`,
        {
          bucket: this.bucket.id,
          key,
          source: new pulumi.asset.FileAsset(filePath),
          cacheControl,
          contentType: mime.getType(file) || undefined,
        },
        { parent: this },
      );
    }
  }
}
