import type { OpenNextConfig } from "@opennextjs/aws/types/open-next";

export default {
  default: {
    minify: true,
    override: {
      wrapper: "aws-lambda-streaming",
      converter: "aws-apigw-v2",
      incrementalCache: "s3-lite",
      queue: "sqs-lite",
      tagCache: "dynamodb-lite",
    },
  },
  functions: {
    // API routes (optimized Node.js runtime)
    api: {
      routes: ["app/api/route"],
      patterns: ["api/*", "api"],
      override: {
        wrapper: "aws-lambda-streaming",
        converter: "aws-apigw-v2",
      },
    },
    fetchingPage: {
      routes: ["app/fetching/page"],
      patterns: ["fetching/*", "fetching"],
      override: {
        wrapper: "aws-lambda-streaming",
        converter: "aws-apigw-v2",
        incrementalCache: "s3-lite",
        queue: "sqs-lite",
        tagCache: "dynamodb-lite",
      },
    },
  },
  imageOptimization: {
    override: {
      wrapper: "aws-lambda",
      converter: "aws-apigw-v2",
    },
    loader: "s3",
    install: {
      packages: ["sharp@0.33.5"],
      arch: "x64",
    },
  },

  // Enhanced build command that handles pnpm properly
  buildCommand: "pnpm build",
} satisfies OpenNextConfig;
