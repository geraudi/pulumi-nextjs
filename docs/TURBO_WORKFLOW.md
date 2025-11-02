# Native Turbo Workflow Guide

## 🚀 Overview

This monorepo now uses **native Turbo functionality** for all build, verification, and deployment tasks. No custom scripts needed - everything leverages Turbo's built-in task dependencies, caching, and parallel execution.

## 📋 Task Architecture

### Task Dependency Graph
```
build → openbuild → verify → deploy
  ↓       ↓         ↓        ↓
Next.js  OpenNext  Lambda   Pulumi
Build    Package   Verify   Deploy
```

### Turbo Configuration (`turbo.json`)
```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"],
      "inputs": ["src/**", "public/**", "*.config.*", "package.json", "tsconfig.json"]
    },
    "openbuild": {
      "dependsOn": ["build"],
      "outputs": [".open-next/**"],
      "inputs": [".next/**", "open-next.config.*", "package.json"],
      "cache": true
    },
    "verify": {
      "dependsOn": ["openbuild"],
      "inputs": [".open-next/**"],
      "cache": true
    },
    "deploy": {
      "dependsOn": ["verify"],
      "cache": false,
      "inputs": [".open-next/**", "*.ts", "components/**"]
    }
  }
}
```

## 🎯 Available Commands

### Root Level Commands
```bash
# Build all packages
pnpm build

# Build OpenNext packages (web app only)
pnpm openbuild

# Verify Lambda packages (web app only)
pnpm verify

# Deploy to AWS (verify + deploy)
pnpm deploy:aws

# Preview deployment changes
pnpm deploy:preview

# Destroy infrastructure
pnpm destroy
```

### Package-Specific Commands
```bash
# Web app (@monorepo/web)
turbo build --filter=@monorepo/web
turbo openbuild --filter=@monorepo/web
turbo verify --filter=@monorepo/web

# Pulumi (@monorepo/pulumi)
turbo deploy --filter=@monorepo/pulumi
turbo preview --filter=@monorepo/pulumi
turbo destroy --filter=@monorepo/pulumi
```

## ⚡ Turbo Benefits

### 1. **Intelligent Caching**
```bash
# First run - cache miss
pnpm openbuild
# → Builds everything from scratch

# Second run - cache hit
pnpm openbuild
# → Uses cached results, completes in seconds
```

### 2. **Automatic Task Dependencies**
```bash
# Running deploy automatically runs:
pnpm deploy:aws
# 1. build (if needed)
# 2. openbuild (if needed)  
# 3. verify (if needed)
# 4. deploy
```

### 3. **Parallel Execution**
- Tasks run in parallel when possible
- Dependencies are respected automatically
- Optimal resource utilization

### 4. **Smart Invalidation**
- Only rebuilds when inputs change
- Tracks file changes, environment variables
- Efficient incremental builds

## 🔧 Task Details

### `build` Task
**Purpose**: Build Next.js application
**Inputs**: `src/**`, `public/**`, `*.config.*`, `package.json`, `tsconfig.json`
**Outputs**: `.next/**`, `dist/**`
**Caching**: ✅ Enabled

### `openbuild` Task  
**Purpose**: Create Lambda packages with OpenNext
**Dependencies**: `build`
**Inputs**: `.next/**`, `open-next.config.*`, `package.json`
**Outputs**: `.open-next/**`
**Caching**: ✅ Enabled
**Special**: Includes pnpm symlink fixes

### `verify` Task
**Purpose**: Verify Lambda packages are deployment-ready
**Dependencies**: `openbuild`
**Inputs**: `.open-next/**`
**Outputs**: None (verification only)
**Caching**: ✅ Enabled

### `deploy` Task
**Purpose**: Deploy to AWS with Pulumi
**Dependencies**: `verify`
**Inputs**: `.open-next/**`, `*.ts`, `components/**`
**Outputs**: None (deployment only)
**Caching**: ❌ Disabled (always runs)

## 🚀 Deployment Workflow

### Full Deployment
```bash
# One command does everything
pnpm deploy:aws

# Turbo automatically:
# 1. Checks if Next.js build is needed
# 2. Checks if OpenNext build is needed
# 3. Verifies Lambda packages
# 4. Deploys with Pulumi
```

### Step-by-Step (Manual)
```bash
# 1. Build Next.js (if needed)
pnpm build

# 2. Create Lambda packages (if needed)
pnpm openbuild

# 3. Verify packages (if needed)
pnpm verify

# 4. Deploy to AWS
pnpm deploy:aws
```

### Development Workflow
```bash
# Start development
pnpm dev

# Make changes to your app...

# Deploy changes
pnpm deploy:aws  # Only rebuilds what changed!
```

## 📊 Performance Optimizations

### Caching Strategy
- **Build artifacts** cached based on source files
- **OpenNext packages** cached based on Next.js output
- **Verification results** cached based on Lambda packages
- **Deployment** never cached (always fresh)

### Input Tracking
- **Precise file tracking**: Only relevant files trigger rebuilds
- **Environment variables**: Tracked for cache invalidation
- **Configuration files**: Changes invalidate dependent tasks

### Parallel Execution
- **Independent tasks** run in parallel
- **Dependencies** respected automatically
- **Resource optimization** built-in

## 🔍 Debugging & Troubleshooting

### Check Task Status
```bash
# See what Turbo would run
turbo deploy --dry-run

# See task graph
turbo deploy --graph
```

### Force Rebuild
```bash
# Force rebuild everything
turbo deploy --force

# Force rebuild specific task
turbo openbuild --force --filter=@monorepo/web
```

### Clear Cache
```bash
# Clear all Turbo cache
turbo clean

# Clear specific package cache
turbo clean --filter=@monorepo/web
```

### Verbose Output
```bash
# See detailed logs
turbo deploy --verbosity=2

# See all output
turbo deploy --output-logs=full
```

## 🎯 Best Practices

### 1. **Use Root Commands**
```bash
# ✅ Recommended
pnpm deploy:aws

# ❌ Avoid (unless debugging)
cd pulumi && pulumi up
```

### 2. **Trust Turbo's Caching**
```bash
# ✅ Let Turbo decide what to rebuild
pnpm deploy:aws

# ❌ Don't force rebuild unnecessarily
turbo deploy --force
```

### 3. **Use Filters for Specific Tasks**
```bash
# ✅ Target specific packages when needed
turbo verify --filter=@monorepo/web

# ✅ Multiple packages
turbo build --filter=@monorepo/web --filter=@monorepo/pulumi
```

### 4. **Monitor Cache Performance**
```bash
# Check cache hit rates
turbo deploy --summarize
```