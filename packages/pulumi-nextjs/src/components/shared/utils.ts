import * as crypto from "node:crypto";
import * as aws from "@pulumi/aws";
import type * as pulumi from "@pulumi/pulumi";

export function computeHexHash(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export function createLambdaRole(
  name: string,
  parent: pulumi.Resource,
): aws.iam.Role {
  return new aws.iam.Role(
    `${name}-lambda-role`,
    {
      assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
        Service: "lambda.amazonaws.com",
      }),
    },
    { parent },
  );
}

export function attachBasicLambdaExecutionRole(
  name: string,
  role: aws.iam.Role,
  parent: pulumi.Resource,
): aws.iam.RolePolicyAttachment {
  return new aws.iam.RolePolicyAttachment(
    `${name}-lambda-basic-execution-role-policy-attachment`,
    {
      policyArn:
        "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
      role: role.name,
    },
    { parent },
  );
}
