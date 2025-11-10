import * as path from "node:path";
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import type { QueueArgs } from "../../types";
import { createLoggingPolicy, createQueuePolicy } from "../shared/iam";
import { createLambdaRole } from "../shared/utils";

export class NextJsQueue extends pulumi.ComponentResource {
  public queue: aws.sqs.Queue;
  public queuePolicy: aws.iam.Policy;

  constructor(
    name: string,
    args: QueueArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super("nextjs:queue:Queue", name, {}, opts);

    this.queue = this.createRevalidationQueue(args);
    this.queuePolicy = createQueuePolicy(args.name, this.queue.arn, this);
  }

  private createRevalidationQueue(args: QueueArgs): aws.sqs.Queue {
    const queue = new aws.sqs.Queue(
      `${args.name}-revalidation-queue`,
      {
        fifoQueue: true,
        receiveWaitTimeSeconds: 20,
        contentBasedDeduplication: true,
        // FIFO queue names must end with ".fifo"
        name: "revalidationQueue.fifo",
      },
      { parent: this },
    );

    // Create consumer function if available
    if (args.openNextOutput?.additionalProps?.revalidationFunction) {
      this.createConsumerFunction(args, queue);
    }

    return queue;
  }

  private createConsumerFunction(args: QueueArgs, queue: aws.sqs.Queue): void {
    // Create IAM role and attach policies for Lambda to access SQS and Cloudwatch logs
    const role = createLambdaRole(`${args.name}-revalidation-queue`, this);

    // Cloudwatch policy
    const loggingPolicy = createLoggingPolicy(
      `${args.name}-revalidation-queue-lambda`,
      this,
    );

    new aws.iam.RolePolicyAttachment(
      `${args.name}-revalidation-queue-lambda-logging-role-policy-attachment`,
      {
        role: role.name,
        policyArn: loggingPolicy.arn,
      },
      { parent: this },
    );

    const queuePolicy = new aws.iam.Policy(
      `${args.name}-revalidation-queue-lambda-sqs-policy`,
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
      { parent: this },
    );

    new aws.iam.RolePolicyAttachment(
      `${args.name}-revalidation-queue-lambda-sqs-role-policy-attachment`,
      {
        role: role,
        policyArn: queuePolicy.arn,
      },
      { parent: this },
    );

    const revalidationFunction =
      args.openNextOutput.additionalProps?.revalidationFunction;
    if (!revalidationFunction) {
      throw new Error("revalidationFunction is required");
    }
    const consumer = new aws.lambda.Function(
      `${args.name}-revalidation-queue-lambda`,
      {
        handler: revalidationFunction.handler,
        code: new pulumi.asset.FileArchive(
          path.join(args.path, revalidationFunction.bundle),
        ),
        runtime: aws.lambda.Runtime.NodeJS20dX,
        timeout: 30,
        role: role.arn,
      },
      { parent: this },
    );

    new aws.lambda.EventSourceMapping(
      `${args.name}-revalidation-queue-lambda-event-source`,
      {
        eventSourceArn: queue.arn,
        functionName: consumer.arn,
        enabled: true,
      },
      { parent: this },
    );
  }
}
