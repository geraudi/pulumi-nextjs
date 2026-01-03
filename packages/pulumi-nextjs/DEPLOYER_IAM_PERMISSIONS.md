# Deployer IAM Permissions

This document describes the minimal IAM permissions required for a user or role to deploy the Pulumi Next.js stack, following the principle of least privilege.

## Overview

The deployer needs permissions to create and manage various AWS resources across multiple services. All permissions are scoped to specific resource patterns to minimize security risk.

## AWS Services Used

The stack creates resources in the following AWS services:

- **S3** - Static asset storage
- **Lambda** - Server-side rendering and API functions
- **DynamoDB** - ISR revalidation cache
- **SQS** - Revalidation queue
- **CloudFront** - CDN distribution
- **IAM** - Execution roles and policies
- **CloudWatch** - Logging and monitoring
- **CloudWatch Events** - Lambda warming (optional)
- **WAF** - Web application firewall (optional)

## Required Permissions

### Core Resources (Always Required)

#### S3 Permissions
- Create and manage buckets for static assets
- Upload and manage objects (HTML, CSS, JS, images)
- Configure bucket policies and public access blocks

**Resources:**
- `arn:aws:s3:::*-open-next-bucket`
- `arn:aws:s3:::*-open-next-bucket/*`

#### Lambda Permissions
- Create and manage Lambda functions for SSR, image optimization, and revalidation
- Configure function URLs for CloudFront integration
- Set up event source mappings for SQS triggers
- Add permissions for CloudFront to invoke functions

**Resources:**
- `arn:aws:lambda:*:*:function:*-origin-lambda`
- `arn:aws:lambda:*:*:function:*-revalidation-table-lambda`
- `arn:aws:lambda:*:*:function:*-revalidation-queue-lambda`

#### DynamoDB Permissions
- Create and manage revalidation cache table
- Configure global secondary indexes
- Enable point-in-time recovery

**Resources:**
- `arn:aws:dynamodb:*:*:table/*-RevalidationTable`

#### SQS Permissions
- Create and manage FIFO queue for revalidation
- Configure queue attributes

**Resources:**
- `arn:aws:sqs:*:*:revalidationQueue.fifo`

#### CloudFront Permissions
- Create and manage distributions
- Configure Origin Access Identity (OAI) and Origin Access Control (OAC)
- Create CloudFront functions for header manipulation
- Manage cache policies

**Resources:**
- All CloudFront resources (requires `Resource: "*"` due to AWS API limitations)

#### IAM Permissions
- Create execution roles for Lambda functions
- Create and manage policies for S3, DynamoDB, SQS, and CloudWatch access
- Attach policies to roles
- Pass roles to Lambda services

**Resources:**
- `arn:aws:iam::*:role/*-origin-role`
- `arn:aws:iam::*:role/*-revalidation-table-role`
- `arn:aws:iam::*:role/*-revalidation-queue-role`
- `arn:aws:iam::*:policy/*-bucket-policy`
- `arn:aws:iam::*:policy/*-table-policy`
- `arn:aws:iam::*:policy/*-queue-policy`
- `arn:aws:iam::*:policy/*-logging-policy`

#### CloudWatch Logs Permissions
- Create and manage log groups for Lambda functions
- Configure log retention policies

**Resources:**
- `arn:aws:logs:*:*:log-group:/aws/lambda/*`

### Optional Resources

#### CloudWatch Events Permissions (if warmer enabled)
- Create EventBridge rules for Lambda warming
- Configure rule targets and schedules

**Resources:**
- `arn:aws:events:*:*:rule/*-warmer-rule`

**Required Lambda Resources:**
- `arn:aws:lambda:*:*:function:*-warmer-lambda`

**Required IAM Resources:**
- `arn:aws:iam::*:role/*-warmer-role`
- `arn:aws:iam::*:policy/*-warmer-invoke-policy`

#### WAF Permissions (if WAF enabled)
- Create and manage Web ACLs for CloudFront
- Create and manage IP sets for allow/block lists
- Configure managed rule groups

**Resources:**
- `arn:aws:wafv2:us-east-1:*:global/webacl/*`
- `arn:aws:wafv2:us-east-1:*:global/ipset/*`

**Note:** WAF for CloudFront must be created in `us-east-1` region.

## Setup Instructions

### Option 1: AWS Console

1. Navigate to IAM → Policies
2. Click "Create policy"
3. Select "JSON" tab
4. Paste the contents of `deployer-iam-policy.json`
5. Click "Next: Tags" (optional)
6. Click "Next: Review"
7. Name the policy (e.g., `PulumiNextJsDeployerPolicy`)
8. Click "Create policy"
9. Attach the policy to your IAM user or role

### Option 2: AWS CLI

```bash
# Create the policy
aws iam create-policy \
  --policy-name PulumiNextJsDeployerPolicy \
  --policy-document file://deployer-iam-policy.json \
  --description "Minimal permissions for deploying Pulumi Next.js stack"

# Attach to an IAM user
aws iam attach-user-policy \
  --user-name your-deployment-user \
  --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/PulumiNextJsDeployerPolicy

# Or attach to an IAM role
aws iam attach-role-policy \
  --role-name your-deployment-role \
  --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/PulumiNextJsDeployerPolicy
```

### Option 3: Terraform

```hcl
resource "aws_iam_policy" "pulumi_nextjs_deployer" {
  name        = "PulumiNextJsDeployerPolicy"
  description = "Minimal permissions for deploying Pulumi Next.js stack"
  policy      = file("${path.module}/deployer-iam-policy.json")
}

resource "aws_iam_user_policy_attachment" "deployer_attach" {
  user       = aws_iam_user.deployer.name
  policy_arn = aws_iam_policy.pulumi_nextjs_deployer.arn
}
```

### Option 4: CloudFormation

```yaml
Resources:
  PulumiNextJsDeployerPolicy:
    Type: AWS::IAM::ManagedPolicy
    Properties:
      ManagedPolicyName: PulumiNextJsDeployerPolicy
      Description: Minimal permissions for deploying Pulumi Next.js stack
      PolicyDocument: !Sub |
        ${file://deployer-iam-policy.json}

  DeployerUser:
    Type: AWS::IAM::User
    Properties:
      ManagedPolicyArns:
        - !Ref PulumiNextJsDeployerPolicy
```

## Security Best Practices

### 1. Use Specific Resource Patterns

The policy uses resource patterns like `*-open-next-bucket` to scope permissions to resources created by this stack. Consider making these patterns more specific to your deployment:

```json
{
  "Resource": [
    "arn:aws:s3:::myapp-prod-open-next-bucket",
    "arn:aws:s3:::myapp-prod-open-next-bucket/*"
  ]
}
```

### 2. Limit to Specific Regions

Add condition keys to restrict operations to specific regions (except for global services):

```json
{
  "Condition": {
    "StringEquals": {
      "aws:RequestedRegion": ["us-east-1", "eu-west-1"]
    }
  }
}
```

### 3. Remove Unused Permissions

If you're not using optional features, remove their permissions:

- **No warmer?** Remove CloudWatch Events and warmer Lambda permissions
- **No WAF?** Remove WAFv2 permissions

### 4. Use Role Assumption

For CI/CD deployments, use role assumption with session policies:

```bash
aws sts assume-role \
  --role-arn arn:aws:iam::ACCOUNT_ID:role/DeploymentRole \
  --role-session-name pulumi-deployment \
  --policy file://deployer-iam-policy.json
```

### 5. Enable CloudTrail

Monitor all deployment actions by enabling CloudTrail to track API calls made by the deployer.

### 6. Use MFA for Production

For production deployments, require MFA:

```json
{
  "Condition": {
    "BoolIfExists": {
      "aws:MultiFactorAuthPresent": "true"
    }
  }
}
```

## Minimum Required Actions by Service

| Service | Actions | Purpose |
|---------|---------|---------|
| S3 | 17 actions | Bucket and object management |
| Lambda | 24 actions | Function creation, configuration, and invocation |
| DynamoDB | 9 actions | Table management and configuration |
| SQS | 8 actions | Queue management |
| CloudFront | 23 actions | Distribution and cache policy management |
| IAM | 21 actions | Role and policy management |
| CloudWatch Logs | 7 actions | Log group management |
| CloudWatch Events | 10 actions | EventBridge rule management (optional) |
| WAF | 11 actions | Web ACL and IP set management (optional) |

**Total: 130 actions** (109 required, 21 optional)

## Troubleshooting

### Access Denied Errors

If you encounter "Access Denied" errors during deployment:

1. Check CloudTrail logs to identify the specific missing permission
2. Verify the resource pattern matches your naming convention
3. Ensure the policy is attached to the correct user/role
4. Check for any SCPs (Service Control Policies) that might be restricting access

### Common Issues

**Issue:** `AccessDenied` when creating Lambda function URLs
**Solution:** Ensure `lambda:CreateFunctionUrlConfig` permission is included

**Issue:** `AccessDenied` when attaching IAM policies
**Solution:** Both `iam:AttachRolePolicy` and `iam:PassRole` are required

**Issue:** WAF creation fails
**Solution:** Verify you're using a provider in `us-east-1` region for WAF resources

## References

- [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [Principle of Least Privilege](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html#grant-least-privilege)
- [IAM Policy Simulator](https://policysim.aws.amazon.com/)

## Policy Validation

You can validate the policy using AWS IAM Policy Simulator or the AWS CLI:

```bash
# Validate policy syntax
aws iam get-policy-version \
  --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/PulumiNextJsDeployerPolicy \
  --version-id v1

# Test permissions
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::YOUR_ACCOUNT_ID:user/deployer-user \
  --action-names s3:CreateBucket lambda:CreateFunction \
  --resource-arns "arn:aws:s3:::test-open-next-bucket" "arn:aws:lambda:*:*:function:test-origin-lambda"
```

## Updates and Maintenance

This policy should be reviewed and updated when:

- New AWS resources are added to the stack
- AWS introduces new required permissions for existing services
- Your deployment requirements change
- Security best practices evolve

Last updated: 2026-01-03
