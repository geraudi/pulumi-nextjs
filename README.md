# Next.js on AWS with Pulumi

Infrastructure-as-code solution for deploying Next.js applications on AWS using Pulumi and OpenNext.

## 🏗️ Architecture

This project deploys a Next.js application using a serverless architecture on AWS:

- **CloudFront Distribution** - Global CDN for fast content delivery
- **Lambda Functions** - Server-side rendering and API routes
- **S3 Bucket** - Static asset storage with optimized caching
- **DynamoDB Table** - ISR (Incremental Static Regeneration) cache
- **SQS Queue** - Background revalidation processing
- **IAM Roles & Policies** - Secure resource access

## 🚀 Features

- ✅ **Next.js 16** support with latest features
- ✅ **OpenNext v3** integration for AWS optimization
- ✅ **TypeScript** throughout the stack
- ✅ **ISR (Incremental Static Regeneration)** support
- ✅ **Image optimization** with Lambda

## 📋 Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [Pulumi CLI](https://www.pulumi.com/docs/install/)
- [AWS CLI](https://aws.amazon.com/cli/) configured with appropriate credentials
- npm (pnpm not recommended due to symlink issues with Lambda packaging)

## 🛠️ Quick Start

### 1. Clone and Install Dependencies

```bash
# Install Next.js app dependencies
cd nextjs-app
npm install

# Install Pulumi dependencies
cd ../pulumi
npm install
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
# Build the Next.js app with OpenNext
cd ../nextjs-app
npm run build:open-next

# Deploy infrastructure
cd ../pulumi
pulumi up
```

> **Note about `fix-symlinks.js`**: This project includes an automated fix for a known Node.js symlink bug that affects OpenNext's image optimization function. OpenNext has a workaround for certain Node.js versions, but some affected versions (like v24.4.1) are not included in the `AFFECTED_NODE_VERSIONS` list. The `npm run build:open-next` command automatically runs the symlink fix after the OpenNext build to ensure proper deployment.

### 5. Access Your Application

After deployment, Pulumi will output the CloudFront URL where your application is accessible.

## 📁 Project Structure

```
├── nextjs-app/                 # Next.js application
│   ├── src/                   # Application source code
│   ├── public/                # Static assets
│   ├── open-next.config.ts    # OpenNext configuration
│   └── package.json
├── pulumi/                    # Infrastructure code
│   ├── index.ts              # Main Pulumi program
│   ├── nextjs.ts             # NextJsSite component
│   ├── types.ts              # TypeScript definitions
│   └── package.json
└── README.md
```

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
cd nextjs-app
npm run dev
```

### Debug OpenNext Build

```bash
cd nextjs-app
OPEN_NEXT_DEBUG=true npm run build:open-next
```

### Update Infrastructure

```bash
cd pulumi
pulumi up
```

### Destroy Infrastructure

```bash
cd pulumi
pulumi destroy
```

## 💰 Cost Optimization

This setup is designed to be cost-effective:

- **Lambda**: Pay only for execution time
- **S3**: Optimized storage classes for static assets
- **CloudFront**: Free tier includes 1TB of data transfer
- **DynamoDB**: On-demand billing for ISR cache
- **SQS**: Pay per message for revalidation queue

## 📚 References

- [OpenNext Documentation](https://opennext.js.org/)
- [Pulumi AWS Guide](https://www.pulumi.com/docs/clouds/aws/)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [AWS CloudFront](https://aws.amazon.com/cloudfront/)