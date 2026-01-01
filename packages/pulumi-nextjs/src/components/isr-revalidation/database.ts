import * as path from "node:path";
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import type { DatabaseArgs } from "../../types";
import { createLoggingPolicy, createTablePolicy } from "../shared/iam";
import { createLambdaRole } from "../shared/utils";

export class NextJsDatabase extends pulumi.ComponentResource {
  public table: aws.dynamodb.Table;
  public tablePolicy: aws.iam.Policy;

  constructor(
    name: string,
    args: DatabaseArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super("nextjs:database:Database", name, {}, opts);

    this.table = this.createRevalidationTable(args);
    this.tablePolicy = createTablePolicy(args.name, this.table.arn, this);
  }

  private createRevalidationTable(args: DatabaseArgs): aws.dynamodb.Table {
    const tableName = "RevalidationTable";
    const table = new aws.dynamodb.Table(
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

    // Create initialization function if available
    if (args.openNextOutput?.additionalProps?.initializationFunction) {
      this.createInitializationFunction(args, tableName, table);
    }

    return table;
  }

  private createInitializationFunction(
    args: DatabaseArgs,
    tableName: string,
    table: aws.dynamodb.Table,
  ): void {
    new aws.cloudwatch.LogGroup(
      `${args.name}-revalidation-table-lambda-log-group`,
      {
        retentionInDays: 1,
      },
      { parent: this },
    );

    const role = createLambdaRole(`${args.name}-revalidation-table`, this);

    const loggingPolicy = createLoggingPolicy(
      `${args.name}-revalidation-table-lambda`,
      this,
    );

    new aws.iam.RolePolicyAttachment(
      `${args.name}-revalidation-table-lambda-logging-role-policy-attachment`,
      {
        role: role.name,
        policyArn: loggingPolicy.arn,
      },
      { parent: this },
    );

    // Attach DynamoDB read/write policy to the role
    const dynamoDbPolicy = new aws.iam.Policy(
      `${args.name}-revalidation-table-lambda-dynamodb-policy`,
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
      `${args.name}-revalidation-table-lambda-dynamodb-role-policy-attachment`,
      {
        role: role,
        policyArn: dynamoDbPolicy.arn,
      },
      { parent: this },
    );

    const initFunction =
      args.openNextOutput.additionalProps?.initializationFunction;
    if (!initFunction) {
      throw new Error("initializationFunction is required");
    }
    const insertFn = new aws.lambda.Function(
      `${args.name}-revalidation-table-lambda`,
      {
        description: "Next.js revalidation data insert",
        handler: initFunction.handler,
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
          path.join(args.path, initFunction.bundle),
        ),
      },
      { parent: this },
    );

    // Invoke the Lambda function at deploy time
    new aws.lambda.Invocation(
      `${args.name}-revalidation-table-seeder`,
      {
        functionName: insertFn.name,
        triggers: {
          time: Date.now().toString(),
        },
        input: pulumi.jsonStringify({}),
      },
      { parent: this },
    );
  }
}
