import type { OpenNextConfig } from "@opennextjs/aws/types/open-next";

const config = {
  default: {
    override: {
      wrapper: "aws-lambda-streaming",
      converter: "aws-apigw-v2",
      queue: "sqs-lite",
      incrementalCache: "s3-lite",
      tagCache: "dynamodb-lite",
    },
  },
  functions: {
    "fetching-page": {
      routes: ["app/fetching/page"],
      patterns: ["fetching"],
      override: {
        wrapper: "aws-lambda-streaming",
        converter: "aws-apigw-v2",
        queue: "sqs-lite",
        incrementalCache: "s3-lite",
        tagCache: "dynamodb-lite",
      },
    },
  },

  dangerous: {
    enableCacheInterception: true,
  },
  buildCommand: "npm run build",
  packageJsonPath: "./package.json",
} satisfies OpenNextConfig;

export default config;
