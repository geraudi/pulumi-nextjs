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
- ✅ **Automatic CloudFront invalidation**
- ✅ **ISR (Incremental Static Regeneration)** support
- ✅ **Image optimization** with Lambda
- ✅ **Secure by default** with proper IAM policies
- ✅ **Cost-optimized** with pay-per-use resources

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

### Environment Variables

You can pass environment variables to your Next.js application:

```typescript
// pulumi/index.ts
const site = new NextJsSite("my-site", {
  path: "../nextjs-app",
  environment: {
    DATABASE_URL: "your-database-url",
    API_KEY: "your-api-key",
  },
});
```

### OpenNext Configuration

Customize the OpenNext build in `nextjs-app/open-next.config.ts`:

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

## 📊 Monitoring and Logs

- **CloudWatch Logs**: Lambda function logs are automatically sent to CloudWatch
- **CloudFront Metrics**: Monitor CDN performance in AWS Console
- **DynamoDB Metrics**: Track ISR cache performance

## 💰 Cost Optimization

This setup is designed to be cost-effective:

- **Lambda**: Pay only for execution time
- **S3**: Optimized storage classes for static assets
- **CloudFront**: Free tier includes 1TB of data transfer
- **DynamoDB**: On-demand billing for ISR cache
- **SQS**: Pay per message for revalidation queue

## 🔒 Security

- S3 bucket is private with CloudFront Origin Access Identity
- Lambda functions have minimal IAM permissions
- All resources follow AWS security best practices

## 🐛 Troubleshooting

### Common Issues

1. **Build fails**: Ensure Node.js version compatibility (v18+)
2. **Deployment fails**: Check AWS credentials and permissions
3. **404 errors**: Verify OpenNext build completed successfully
4. **Slow performance**: Check CloudFront cache settings
5. **Lambda packaging issues**: Use npm instead of pnpm - pnpm's symlinks can break Lambda packaging

### Debug Commands

```bash
# Check OpenNext output
ls -la nextjs-app/.open-next/

# Validate Pulumi configuration
cd pulumi && pulumi config

# Check AWS credentials
aws sts get-caller-identity
```

## 📚 References

- [OpenNext Documentation](https://opennext.js.org/)
- [Pulumi AWS Guide](https://www.pulumi.com/docs/clouds/aws/)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [AWS CloudFront](https://aws.amazon.com/cloudfront/)


## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.