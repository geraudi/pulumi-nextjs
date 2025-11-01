import type { PulumiFunctionConfig } from "./types";

/**
 * Pulumi Function Configuration
 *
 * This file allows you to customize Lambda function settings for each function
 * discovered in your OpenNext output. If this file doesn't exist or a function
 * isn't configured here, default settings will be used.
 *
 * Configuration is applied to functions based on their names in the OpenNext
 * output file (open-next.output.json).
 */
const functionConfig: PulumiFunctionConfig = {
  // ========================================================================
  // DEFAULT FUNCTION
  // ========================================================================
  // Handles most application routes (pages, API routes, etc.)
  // This is typically the main server-side rendering function
  default: {
    memory: 1024, // 1GB - Good balance for SSR workloads
    timeout: 15, // 15 seconds - Sufficient for most page renders
    runtime: "nodejs20.x", // Latest stable Node.js runtime
    environment: {
      NODE_ENV: "production",
      // Add any environment variables needed by your app
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },

  // ========================================================================
  // IMAGE OPTIMIZATION FUNCTION
  // ========================================================================
  // Handles Next.js Image component optimization
  // Requires more memory for image processing operations
  imageOptimizer: {
    memory: 2048, // 2GB - Image processing is memory intensive
    timeout: 10, // 10 seconds - Image ops should be fast
    runtime: "nodejs20.x"
  },

  // Pages that make external API calls or database queries
  // May need longer timeouts and specific environment variables
  "fetching-page": {
    memory: 512, // 512MB - Lighter workload, mostly I/O bound
    timeout: 30, // 30 seconds - Allow time for external API calls
    runtime: "nodejs20.x",
    environment: {
      API_TIMEOUT: "25000", // 25 second timeout for external APIs
      DATABASE_URL: "your-db-connection-string",
      REDIS_URL: "your-redis-connection-string",
    },
  }
};

export default functionConfig;