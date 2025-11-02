import type { OpenNextConfig } from "@opennextjs/aws/types/open-next";

export default {
  default: {
    override: {
      wrapper: "aws-lambda-streaming",
      converter: "aws-apigw-v2",
      incrementalCache: "s3-lite",
      queue: "sqs",
      tagCache: "dynamodb-lite",
    },
  },

  dangerous: {
    middlewareHeadersOverrideNextConfigHeaders: true,
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
