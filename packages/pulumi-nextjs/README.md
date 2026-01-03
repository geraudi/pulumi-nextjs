# @giweb/pulumi-nextjs

A Pulumi component for deploying Next.js applications to AWS using OpenNext.

## Features

- Deploy Next.js applications to AWS with a single Pulumi component
- Built on top of [OpenNext](https://open-next.js.org/) for seamless Next.js compatibility
- Automatically provisions:
  - AWS Lambda functions for server-side rendering and API routes
  - CloudFront distribution for global content delivery
  - S3 buckets for static assets and caching
  - DynamoDB for ISR (Incremental Static Regeneration) state
  - SQS queue for on-demand revalidation
- Optional features:
  - AWS WAF for security (rate limiting, common attack protection)
  - Lambda warmer to reduce cold starts
- Per-function Lambda configuration (memory, timeout)

## Installation

```bash
npm install @giweb/pulumi-nextjs
# or
pnpm add @giweb/pulumi-nextjs
# or
yarn add @giweb/pulumi-nextjs
```

## Prerequisites

- Node.js 18 or later
- Pulumi CLI installed
- AWS credentials configured
- Next.js application built with OpenNext

How to configure [Deployer IAM Permissions](./DEPLOYER_IAM_PERMISSIONS.md)

## Usage

### Basic Setup

```typescript
import { NextJsSite } from "@giweb/pulumi-nextjs";

const site = new NextJsSite("my-nextjs-site", {
  path: "../path/to/your/nextjs/app",
});

export const url = site.url;
```

### With Lambda Configuration

```typescript
const site = new NextJsSite("my-nextjs-site", {
  path: "../apps/web",
  lambdaConfig: {
    imageOptimizer: {
      memory: 2048,
      timeout: 60,
    },
    api: {
      memory: 1024,
      timeout: 45,
    },
    fetchingPage: {
      memory: 512,
      timeout: 20,
    },
  },
});
```

### With Environment Variables

```typescript
const site = new NextJsSite("my-nextjs-site", {
  path: "../apps/web",
  environment: {
    API_URL: "https://api.example.com",
    DATABASE_URL: databaseUrl,
  },
});
```

### With Lambda Warmer (Reduce Cold Starts)

```typescript
const site = new NextJsSite("my-nextjs-site", {
  path: "../apps/web",
  warmer: {
    enabled: true,
    schedule: "rate(5 minutes)",
    concurrency: 1,
    functions: {
      api: { enabled: true, concurrency: 2 },
      fetchingPage: { enabled: true, concurrency: 1 },
    },
  },
});
```

### With AWS WAF Protection

```typescript
const site = new NextJsSite("my-nextjs-site", {
  path: "../apps/web",
  waf: {
    enabled: true,
    rateLimit: 2000, // requests per 5 minutes per IP
    enableCommonRuleSet: true, // SQL injection, XSS protection
    enableKnownBadInputs: true,
    enableAnonymousIpList: false, // Block VPNs/proxies
    enableIpReputationList: true,
    blockIpAddresses: ["192.0.2.0/24"],
    allowIpAddresses: ["203.0.113.0/24"],
    blockCountries: ["CN", "RU"],
  },
});
```

## API Reference

### NextJsSite

#### Constructor

```typescript
new NextJsSite(name: string, args: NexJsSiteArgs, opts?: pulumi.ComponentResourceOptions)
```

#### Arguments

- `name` (string): The name of the component resource
- `args` (NexJsSiteArgs): Configuration options
  - `path` (string, optional): Path to the Next.js application (default: `"../apps/web"`)
  - `environment` (Record<string, pulumi.Input<string>>, optional): Environment variables for Lambda functions
  - `lambdaConfig` (LambdaConfigMap, optional): Per-function Lambda configuration
  - `warmer` (WarmerConfig, optional): Lambda warmer configuration
  - `waf` (WafConfig, optional): AWS WAF configuration

#### Outputs

- `url` (pulumi.Output<string>): The CloudFront distribution URL
- `domainName` (pulumi.Output<string>): The CloudFront domain name

### LambdaConfigMap

Configure memory and timeout for specific Lambda functions:

```typescript
type LambdaConfigMap = {
  [functionName: string]: {
    memory?: number; // MB
    timeout?: number; // seconds
  };
};
```

Available function names: `imageOptimizer`, `api`, `fetchingPage`, `server`, etc.

## Building Your Next.js App with OpenNext

Before deploying, you need to build your Next.js application with OpenNext:

```bash
# Install OpenNext
npm install --save-dev open-next

# Add build script to package.json
{
  "scripts": {
    "openbuild": "open-next build"
  }
}

# Build
npm run openbuild
```

This creates a `.open-next` directory with the optimized build output.

## Architecture

The component creates the following AWS resources:

- **Lambda Functions**: Server-side rendering, API routes, image optimization
- **CloudFront Distribution**: Global CDN with origin routing
- **S3 Bucket**: Static assets and cache storage
- **DynamoDB Table**: ISR state management
- **SQS Queue**: On-demand revalidation
- **IAM Roles & Policies**: Least-privilege access
- **CloudWatch Logs**: Function logging
- **EventBridge Rules** (optional): Lambda warmer scheduling
- **WAF Web ACL** (optional): Security rules

## License

MIT

## Repository

[https://github.com/geraudi/pulumi-nextjs](https://github.com/geraudi/pulumi-nextjs)
