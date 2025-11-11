# Next.js on AWS with Pulumi - Turbo Monorepo

Infrastructure-as-code solution for deploying Next.js applications on AWS using Pulumi and OpenNext in a Turbo monorepo with full pnpm support.

> **📚 Learning Project**: This repository is designed for educational purposes to understand how Next.js applications are deployed to AWS infrastructure. For production deployments, consider using [SST (Serverless Stack)](https://sst.dev/) which provides a complete, battle-tested solution with additional features and better developer experience.

## ⚡ Quick Commands

```bash
# Start development servers
pnpm dev        # Start development servers

# Build, verify, and deploy to AWS  
pnpm deploy:aws 

# Destroy AWS infrastructure
pnpm destroy    
```

## 🏗️ Architecture

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
- ✅ **OpenNext v3** integration for AWS optimization
- ✅ **Turbo monorepo** with intelligent caching and task dependencies
- ✅ **pnpm workspace** with Lambda-compatible symlink handling
- ✅ **TypeScript** throughout the stack
- ✅ **ISR (Incremental Static Regeneration)** support
- ✅ **Image optimization** with Lambda
- ✅ **Single command deployment** with automatic verification

### Security Features
- 🔒 **IAM Authentication** for Lambda Function URLs using CloudFront Origin Access Control (OAC)
- 🔒 **AWS WAF** integration with configurable rules (rate limiting, SQL injection, XSS protection)
- 🔒 **TLS 1.2+** enforcement on CloudFront
- 🔒 **Automatic SigV4 request signing** for secure Lambda invocations

## 📋 Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [Pulumi CLI](https://www.pulumi.com/docs/install/)
- [AWS CLI](https://aws.amazon.com/cli/) configured with appropriate credentials
- [pnpm](https://pnpm.io/installation) (v9.12.3 or later)
- [Turbo](https://turbo.build/repo/docs/installing) (automatically installed)

## 🛠️ Quick Start

### 1. Clone and Install Dependencies

```bash
# Install all dependencies (monorepo)
pnpm install

# Or install individually
pnpm install --filter @monorepo/web
pnpm install --filter @monorepo/pulumi
```

### 2. Configure AWS Credentials

```bash
aws configure
# or set environment variables:
# export AWS_ACCESS_KEY_ID=your_access_key
# export AWS_SECRET_ACCESS_KEY=your_secret_key
# export AWS_REGION=us-east-1
```

### 3. Initialize Pulumi

```bash
cd pulumi
pulumi login
pulumi stack init dev  # or your preferred stack name
```

### 4. Build and Deploy

```bash
# Deploy to AWS (build, verify, and deploy)
pnpm deploy:aws

# Or step by step
pnpm build      # Build Next.js app
pnpm openbuild  # Create Lambda packages
pnpm verify     # Verify packages are ready
pnpm deploy:aws # Deploy to AWS
```

> **Note about pnpm + OpenNext compatibility**: This project includes automated fixes for pnpm symlink issues with AWS Lambda deployment. The `apps/web/scripts/fix-pnpm-symlinks.js` script automatically resolves symlinks after OpenNext builds to ensure proper Lambda packaging. All deployment commands (`pnpm deploy:aws`, `pnpm openbuild`) include these fixes automatically.

### 5. Access Your Application

After deployment, Pulumi will output the CloudFront URL where your application is accessible.

## 📁 Project Structure

```
├── apps/
│   └── web/                   # Next.js application (@monorepo/web)
│       ├── src/               # Application source code
│       ├── public/            # Static assets
│       ├── scripts/           # Build and deployment scripts
│       ├── open-next.config.ts # OpenNext configuration
│       └── package.json
├── pulumi/                    # Infrastructure code (@monorepo/pulumi)
│   ├── index.ts              # Main Pulumi program
│   ├── nextjs.ts             # NextJsSite component
│   ├── types.ts              # TypeScript definitions
│   └── package.json
├── scripts/                   # Monorepo build scripts
├── docs/                      # Documentation
├── turbo.json                 # Turbo configuration
├── pnpm-workspace.yaml        # pnpm workspace configuration
└── package.json               # Root package.json
```

## 🔒 Security

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

## ⚙️ Configuration

### OpenNext Configuration

Customize the OpenNext build in `nextjs-app/open-next.config.ts`. See the [OpenNext configuration documentation](https://opennext.js.org/aws/config) for all available options:

```typescript
import type { OpenNextConfig } from "@opennextjs/aws";

const config: OpenNextConfig = {
  default: {},
  imageOptimization: {
    arch: "x64",
    runtime: "nodejs20.x",
  },
};

export default config;
```

## 🔧 Development

### Local Development

```bash
# Start all development servers
pnpm dev

# Start specific app
pnpm --filter @monorepo/web dev
```

### Building

```bash
# Build all packages
pnpm build

# Build OpenNext packages (with pnpm symlink fixes)
pnpm openbuild

# Verify Lambda packages are ready
pnpm verify

# Debug OpenNext build
cd apps/web && OPEN_NEXT_DEBUG=true pnpm openbuild
```

### Infrastructure Management

```bash
# Deploy to AWS (recommended)
pnpm deploy:aws

# Preview deployment changes
pnpm deploy:preview

# Destroy infrastructure
pnpm destroy

# Manual Pulumi commands (if needed)
cd pulumi && pulumi up
cd pulumi && pulumi destroy
```

## 🔗 pnpm + OpenNext Compatibility

This monorepo solves the complex symlink issues between pnpm and OpenNext for AWS Lambda deployment:

### The Problem
- pnpm uses symlinks for efficient dependency management
- AWS Lambda doesn't support symlinks in deployment packages
- OpenNext's dependency installation doesn't handle pnpm's workspace structure

### Our Solution
1. **Enhanced Symlink Resolution**: Automatically converts symlinks to actual files
2. **Strategic pnpm Configuration**: Optimized `.npmrc` settings for Lambda compatibility
3. **Comprehensive Build Process**: Handles the entire pnpm → OpenNext → Lambda pipeline

### Quick Fix Commands
```bash
# Fix symlinks manually if needed
cd apps/web && pnpm fix-symlinks

# Verify Lambda packages
pnpm verify

# Validate build output (check for broken symlinks)
find apps/web/.open-next -type l -exec test ! -e {} \; -print
```

## 📚 Documentation

### External References
- [OpenNext Documentation](https://opennext.js.org/)
- [Turbo Documentation](https://turbo.build/repo/docs)
- [pnpm Workspaces](https://pnpm.io/workspaces)
- [Pulumi AWS Guide](https://www.pulumi.com/docs/clouds/aws/)
- [Next.js Deployment](https://nextjs.org/docs/deployment)