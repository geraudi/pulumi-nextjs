import * as aws from "@pulumi/aws";
import type * as pulumi from "@pulumi/pulumi";

export function createBucketPolicy(
  name: string,
  bucketArn: pulumi.Output<string>,
  parent: pulumi.Resource,
): aws.iam.Policy {
  return new aws.iam.Policy(
    `${name}-bucket-policy`,
    {
      description: "S3 bucket read/write access",
      policy: bucketArn.apply((arn) =>
        JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: ["s3:PutObject", "s3:GetObject"],
              Resource: [`${arn}/*`],
            },
          ],
        }),
      ),
    },
    { parent },
  );
}

export function createTablePolicy(
  name: string,
  tableArn: pulumi.Output<string>,
  parent: pulumi.Resource,
): aws.iam.Policy {
  return new aws.iam.Policy(
    `${name}-table-policy`,
    {
      description: "DynamoDB read/write access policy",
      policy: tableArn.apply((arn) =>
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
              Resource: [`${arn}`, `${arn}/index/*`],
            },
          ],
        }),
      ),
    },
    { parent },
  );
}

export function createQueuePolicy(
  name: string,
  queueArn: pulumi.Output<string>,
  parent: pulumi.Resource,
): aws.iam.Policy {
  return new aws.iam.Policy(
    `${name}-queue-policy`,
    {
      description: "Allow sending messages to the SQS queue",
      policy: queueArn.apply((arn) =>
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
              Resource: arn,
            },
          ],
        }),
      ),
    },
    { parent },
  );
}

export function createLoggingPolicy(
  name: string,
  parent: pulumi.Resource,
): aws.iam.Policy {
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
    { parent },
  );

  return new aws.iam.Policy(
    `${name}-logging-policy`,
    {
      path: "/",
      description: "IAM policy for logging from a lambda",
      policy: loggingPolicyDocument.then(
        (doc: aws.iam.GetPolicyDocumentResult) => doc.json,
      ),
    },
    { parent },
  );
}
