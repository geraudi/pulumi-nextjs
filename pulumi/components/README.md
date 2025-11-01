# NextJS Site Components

This directory contains the refactored NextJS site components, organized by AWS service and functionality.

## Architecture

The original monolithic `NextJsSite` class has been split into smaller, focused components:

### Components

#### 1. **NextJsStorage** (`storage.ts`)
- **Purpose**: Manages S3 bucket and static asset storage
- **Resources**: 
  - S3 Bucket with public access blocking
  - S3 Bucket Objects for static files
  - IAM Policy for bucket access
- **Responsibilities**:
  - Creates and configures S3 bucket
  - Uploads static files from OpenNext build output
  - Manages bucket access policies

#### 2. **NextJsDatabase** (`database.ts`)
- **Purpose**: Manages DynamoDB table for revalidation data
- **Resources**:
  - DynamoDB Table with GSI
  - Lambda function for initialization
  - IAM roles and policies
  - CloudWatch log groups
- **Responsibilities**:
  - Creates revalidation table with proper schema
  - Sets up initialization Lambda function
  - Manages database access policies

#### 3. **NextJsQueue** (`queue.ts`)
- **Purpose**: Manages SQS queue for revalidation processing
- **Resources**:
  - SQS FIFO Queue
  - Lambda consumer function
  - IAM roles and policies
- **Responsibilities**:
  - Creates revalidation queue
  - Sets up queue consumer Lambda
  - Manages queue access policies

#### 4. **NextJsFunctions** (`functions.ts`)
- **Purpose**: Manages Lambda functions for Next.js runtime
- **Resources**:
  - Lambda functions (default, image-optimizer, fetchingPage)
  - Lambda function URLs
  - IAM roles and policies
- **Responsibilities**:
  - Creates Lambda functions from OpenNext bundles
  - Sets up function URLs with streaming support
  - Manages function permissions

#### 5. **NextJsDistribution** (`distribution.ts`)
- **Purpose**: Manages CloudFront distribution and CDN configuration
- **Resources**:
  - CloudFront Distribution
  - CloudFront Function
  - Origin Access Identity
  - Cache policies
- **Responsibilities**:
  - Creates CloudFront distribution with origins
  - Sets up cache behaviors and policies
  - Manages origin access and security

### Shared Utilities

#### **Types** (`shared/types.ts`)
- Common interfaces and type definitions
- Component argument interfaces
- Shared configuration types

#### **Utils** (`shared/utils.ts`)
- Utility functions for common operations
- Hash computation
- Lambda role creation helpers

#### **IAM** (`shared/iam.ts`)
- IAM policy factory for common policies
- Standardized policy creation methods
- Logging and access policy templates

## Usage

### Basic Usage

```typescript
import { NextJsSite } from "./nextjs";

const site = new NextJsSite("my-nextjs-site", {
  path: "../nextjs-app",
  environment: {
    NODE_ENV: "production"
  }
});

export const url = site.url;
export const domainName = site.domainName;
```

### Advanced Usage - Using Individual Components

```typescript
import { 
  NextJsStorage, 
  NextJsDatabase, 
  NextJsQueue, 
  NextJsFunctions, 
  NextJsDistribution 
} from "./components";

// Create storage component
const storage = new NextJsStorage("my-storage", {
  name: "my-site",
  openNextOutput,
  path: "./build",
  region: "us-east-1"
});

// Create other components...
```

## Benefits

1. **Separation of Concerns**: Each component handles a specific AWS service
2. **Reusability**: Components can be reused across different projects
3. **Testability**: Smaller components are easier to unit test
4. **Maintainability**: Changes to one service don't affect others
5. **Team Collaboration**: Different team members can work on different components
6. **Resource Organization**: Better resource grouping in Pulumi Console

## Migration Guide

The refactored `NextJsSite` class maintains the same public interface, so existing code should continue to work without changes:

```typescript
// This still works exactly the same
const site = new NextJsSite("my-site", {
  path: "../nextjs-app"
});
```

The main difference is that the implementation now uses smaller, focused components internally.

## Development

### Adding New Components

1. Create a new component file in the `components/` directory
2. Extend `pulumi.ComponentResource`
3. Add appropriate type definitions to `shared/types.ts`
4. Export the component from `index.ts`
5. Update the main `NextJsSite` class to use the new component

### Testing

Run TypeScript compilation to check for errors:

```bash
npx tsc --noEmit
```

### Best Practices

- Always use `{ parent: this }` when creating child resources
- Use descriptive resource names with consistent prefixes
- Handle optional properties safely (avoid non-null assertions)
- Use shared utilities for common operations
- Document complex logic with comments