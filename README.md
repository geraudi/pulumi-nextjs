# Next.js on AWS with Pulumi - Turbo Monorepo

Infrastructure-as-code solution for deploying Next.js applications on AWS using Pulumi and OpenNext in a Turbo monorepo with full pnpm support.

> ** Learning Project**: This repository is designed for educational purposes to understand how Next.js applications are deployed to AWS infrastructure. For production deployments, consider using [SST (Serverless Stack)](https://sst.dev/) which provides a complete, battle-tested solution with additional features and better developer experience.

## Published Package

This monorepo contains the **`@giweb/pulumi-nextjs`** package, published on npm registry:

- **Package**: [`@giweb/pulumi-nextjs`](https://www.npmjs.com/package/@giweb/pulumi-nextjs)
- **Location**: `packages/pulumi-nextjs/`
- **Purpose**: Pulumi component for deploying Next.js applications to AWS using OpenNext
- **Installation**: `npm install @giweb/pulumi-nextjs`

## Get started
To use `@giweb/pulumi-nextjs` in your own project (outside this monorepo):

### 1. Configure OpenNext
In the next.js application root, add the file `open-next.config.ts`
[Documentation OpenNext](https://opennext.js.org/aws/config)
Minimal content:
```
export default {
  default: {},
};
```

### 2. Configure Pulumi and @giweb/pulumi-nextjs
In an empty folder

1. **Initialize Pulumi**:
```bash
pulumi new aws-typescript
```

2. **Install the package**:
```bash
npm install @giweb/pulumi-nextjs
# or
pnpm add @giweb/pulumi-nextjs
# or
yarn add @giweb/pulumi-nextjs
```

Follow [Pulumi Get started documentation](https://www.pulumi.com/docs/iac/get-started/aws/begin/) to install Pulumi and configure AWS.

3. **Configure the package**:

```typescript
// index.ts
import { NextJsSite } from "@giweb/pulumi-nextjs";

const site = new NextJsSite("my-website", {
  // path to the next.js application
  path: "../apps/web"
});

export const url = site.url;
```

### 3. Deploy

#### 1. Build Next.js project with OpenNext
```bash
cd path/to/next.js/project
npx @opennextjs/aws@latest build
```

#### 2. Deploy to AWS with pulumi
```bash
cd path/to/pulumi/folder
pulumi up
```

## Monorepo Structure

This repository is organized as a Turbo monorepo with the following packages:

```
├── packages/
│   └── pulumi-nextjs/         # 📦 @giweb/pulumi-nextjs (published to npm)
├── apps/
│   └── web/                   # Example Next.js application
├── pulumi/                    # Example infrastructure code using the package
└── docs/                      # Documentation and guides
```

The `@giweb/pulumi-nextjs` package provides reusable Pulumi components that you can use in your own projects without needing to clone this entire repository.


## Monorepo Quick Commands

```bash
# Start development servers
pnpm dev        # Start development servers

# Build, verify, and deploy to AWS  
pnpm deploy:aws 

# Destroy AWS infrastructure
pnpm destroy    
```

## Monorepo Architecture

This project deploys a Next.js application using a serverless architecture on AWS:

### Core Infrastructure
- **CloudFront Distribution** - Global CDN for fast content delivery
- **Lambda Functions** - Server-side rendering and API routes
- **S3 Bucket** - Static asset storage with optimized caching
- **DynamoDB Table** - ISR (Incremental Static Regeneration) cache
- **SQS Queue** - Background revalidation processing
- **IAM Roles & Policies** - Secure resource access
- **WAF Rules** - Security features like rate limiting and SQL injection protection


## 🚀 Features

### Core Features
- ✅ **Next.js 16** support with latest features
- ✅ **Cache Components** with `"use cache"` and `cacheLife` (see [docs/nextjs-cache-components.md](docs/nextjs-cache-components.md))
- ✅ **OpenNext v3** integration for AWS optimization
- ✅ **Turbo monorepo** with intelligent caching and task dependencies
- ✅ **pnpm workspace** with Lambda-compatible symlink handling
- ✅ **TypeScript** throughout the stack
- ✅ **ISR (Incremental Static Regeneration)** support
- ✅ **Image optimization** with Lambda
- ✅ **Single command deployment** with automatic verification

### Security Features
- **IAM Authentication** for Lambda Function URLs using CloudFront Origin Access Control (OAC)
- **AWS WAF** integration with configurable rules (rate limiting, SQL injection, XSS protection)
- **TLS 1.2+** enforcement on CloudFront
- **Automatic SigV4 request signing** for secure Lambda invocations

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [Pulumi CLI](https://www.pulumi.com/docs/install/)
- [AWS CLI](https://aws.amazon.com/cli/) configured with appropriate credentials
- [pnpm](https://pnpm.io/installation) (v9.12.3 or later)
- [Turbo](https://turbo.build/repo/docs/installing) (automatically installed)

### Developing the Package

If you want to contribute to or modify the `@giweb/pulumi-nextjs` package:

1. **Clone this repository**:
   ```bash
   git clone https://github.com/geraudi/pulumi-nextjs.git
   cd pulumi-nextjs
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Work on the package**:
   ```bash
   cd packages/pulumi-nextjs
   pnpm dev  # Watch mode for development
   ```

4. **Test with the example**:
   ```bash
   # From the root directory
   pnpm build      # Build the package
   pnpm deploy:aws # Test with the example app
   ```

## Security

This project implements AWS security best practices:

### Lambda Function URL Security

Lambda Function URLs are secured using **CloudFront Origin Access Control (OAC)** with IAM authentication:

- **IAM Authentication**: All Lambda URLs require AWS Signature Version 4 (SigV4)
- **Origin Access Control**: CloudFront automatically signs requests to Lambda
- **Direct Access Blocked**: Lambda URLs return 403 Forbidden when accessed directly
- **Zero Additional Cost**: Built-in AWS feature, no extra charges

### AWS WAF (Web Application Firewall)

Optional WAF protection can be enabled with a simple configuration:

**WAF Features**:
- ✅ Rate limiting per IP address
- ✅ AWS Managed Rules (SQL injection, XSS, known exploits)
- ✅ Custom IP blocking/whitelisting
- ✅ Geographic blocking by country
- ✅ CloudWatch metrics and monitoring
- ✅ Sampled request logging

**Cost**: ~$8/month + $0.60 per million requests

See [docs/waf-configuration.md](docs/waf-configuration.md) for complete configuration guide.

## Documentation

### External References
- [OpenNext Documentation](https://opennext.js.org/)
- [Turbo Documentation](https://turbo.build/repo/docs)
- [pnpm Workspaces](https://pnpm.io/workspaces)
- [Pulumi AWS Guide](https://www.pulumi.com/docs/clouds/aws/)
- [Next.js Deployment](https://nextjs.org/docs/deployment)