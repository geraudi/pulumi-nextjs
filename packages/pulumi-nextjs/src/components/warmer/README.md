# Warmer Component

## Overview
The Warmer component keeps Lambda functions warm by periodically invoking them, reducing cold start latency for Next.js applications. It uses OpenNext's built-in warmer function to efficiently warm multiple Lambda functions.

## Status
✅ **Implemented** (using OpenNext's warmer function)

## Features
- **Scheduled Warming**: Uses EventBridge rules to invoke functions on a schedule
- **Configurable Schedule**: Default is every 5 minutes, customizable via cron or rate expressions
- **Concurrency Support**: Can invoke multiple instances simultaneously
- **Custom Payloads**: Support for custom warming payloads
- **Automatic Permissions**: Manages EventBridge invoke permissions automatically

## Usage

### Basic Usage (Enabled by Default)

```typescript
import { NextJsSite } from "./nextjs";

const site = new NextJsSite("my-site", {
  path: "../apps/web",
  // Warmer is enabled by default with 5-minute intervals
});
```

### Custom Configuration

```typescript
const site = new NextJsSite("my-site", {
  path: "../apps/web",
  warmer: {
    enabled: true,
    schedule: "rate(3 minutes)", // Warm every 3 minutes
    concurrency: 2, // Default concurrency for all functions
  },
});
```

### Per-Function Configuration

You can configure warming behavior for individual functions:

```typescript
const site = new NextJsSite("my-site", {
  path: "../apps/web",
  warmer: {
    enabled: true,
    schedule: "rate(5 minutes)",
    concurrency: 1, // Default for functions not specified below
    functions: {
      api: { enabled: false }, // Disable warming for API function
      fetchingPage: { concurrency: 2 }, // Warm with 2 concurrent instances
      server: { concurrency: 3 }, // Warm with 3 concurrent instances
    },
  },
});
```

### Disable Warmer

```typescript
const site = new NextJsSite("my-site", {
  path: "../apps/web",
  warmer: {
    enabled: false,
  },
});
```

### Advanced Schedule Examples

```typescript
// Rate expressions
schedule: "rate(5 minutes)"  // Every 5 minutes
schedule: "rate(1 hour)"     // Every hour

// Cron expressions (UTC timezone)
schedule: "cron(0/5 * * * ? *)"    // Every 5 minutes
schedule: "cron(0 9 * * ? *)"      // Every day at 9:00 AM UTC
schedule: "cron(0 9-17 ? * MON-FRI *)" // Weekdays 9 AM - 5 PM UTC
```

## Architecture

The warmer creates:
1. **EventBridge Rule**: Scheduled rule that triggers on the specified schedule
2. **Lambda Permissions**: Grants EventBridge permission to invoke each function
3. **Event Targets**: Configures each Lambda function as a target with warming payload

## Configuration Options

### Global Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable or disable the warmer |
| `schedule` | string | `"rate(5 minutes)"` | EventBridge schedule expression |
| `concurrency` | number | `1` | Default number of concurrent invocations for all functions |
| `payload` | object | `{ warmer: true }` | Custom warming payload |
| `functions` | object | `{}` | Per-function configuration overrides |

### Per-Function Options

Configure individual functions using the `functions` object with function names as keys:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable or disable warming for this specific function |
| `concurrency` | number | (global) | Override concurrency for this function |

**Available function names**: `server`, `api`, `imageOptimization`, `revalidate`, `warmer`, or any custom function name from your OpenNext output.

## How It Works

1. EventBridge rule triggers on the configured schedule
2. Rule invokes all registered Lambda functions simultaneously
3. Functions receive a warming payload: `{ warmer: true, concurrency: 1 }`
4. Functions can detect warming requests and return early to minimize costs
5. Keeps function execution contexts warm, reducing cold starts

## Best Practices

- **Schedule Frequency**: Balance between cost and performance. 5 minutes is a good default.
- **Concurrency**: Set to match your expected concurrent load for each function
- **Selective Warming**: Disable warming for functions that don't benefit from it (e.g., infrequently used API routes)
- **Per-Function Tuning**: Use higher concurrency for high-traffic functions, lower for others
- **Cost Optimization**: Consider disabling during low-traffic periods or for specific functions
- **Function Detection**: Add warming detection logic in your functions:

```typescript
export async function handler(event) {
  // Detect warming request
  if (event.warmer) {
    console.log('Warming request received');
    return { statusCode: 200, body: 'Warmed' };
  }
  
  // Normal request handling
  // ...
}
```

## Monitoring

The warmer creates CloudWatch metrics automatically:
- EventBridge rule invocations
- Lambda function invocations from EventBridge
- Function execution duration and errors

## Cost Considerations

- EventBridge: ~$1 per million events
- Lambda: Charged per invocation and duration
- Example: 5-minute warming for 3 functions = ~25,920 invocations/month
- Estimated cost: $0.01-0.05/month (depending on function duration)
- **Optimization**: Disable warming for unused functions to reduce costs

## Troubleshooting

### Functions Not Warming
- Check EventBridge rule is ENABLED
- Verify Lambda permissions are correctly set
- Check CloudWatch logs for invocation errors

### High Costs
- Reduce warming frequency (e.g., 10 minutes instead of 5)
- Optimize function cold start time
- Consider disabling for non-critical functions
