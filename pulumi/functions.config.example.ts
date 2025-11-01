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
    runtime: "nodejs20.x",
    environment: {
      // Image optimization specific settings
      NEXT_IMAGE_QUALITY: "75",
      NEXT_IMAGE_FORMATS: "image/webp,image/avif",
    },
  },

  // ========================================================================
  // API-HEAVY PAGES
  // ========================================================================
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
  },

  // ========================================================================
  // CUSTOM API FUNCTIONS
  // ========================================================================
  // Example configurations for different types of API endpoints

  // Lightweight API endpoints (simple CRUD operations)
  "api-users": {
    memory: 256, // 256MB - Minimal memory for simple operations
    timeout: 5, // 5 seconds - Quick response expected
    runtime: "nodejs20.x",
    environment: {
      LOG_LEVEL: "info",
    },
  },

  // Heavy computation API (data processing, analytics)
  "api-analytics": {
    memory: 3008, // 3GB - High memory for data processing
    timeout: 60, // 1 minute - Allow time for complex calculations
    runtime: "nodejs20.x",
    environment: {
      WORKER_THREADS: "4",
      MEMORY_LIMIT: "2800", // Leave some headroom
    },
  },

  // File upload/processing function
  "api-upload": {
    memory: 1536, // 1.5GB - File processing needs memory
    timeout: 45, // 45 seconds - File operations can be slow
    runtime: "nodejs20.x",
    environment: {
      MAX_FILE_SIZE: "50MB",
      UPLOAD_BUCKET: "your-s3-bucket-name",
    },
  },

  // Real-time/WebSocket API
  "api-websocket": {
    memory: 512, // 512MB - Connection management
    timeout: 15, // 15 seconds - Keep connections responsive
    runtime: "nodejs20.x",
    environment: {
      WEBSOCKET_ENDPOINT: "your-websocket-api-gateway-url",
      CONNECTION_TABLE: "your-dynamodb-connections-table",
    },
  },

  // ========================================================================
  // EDGE CASES AND SPECIALIZED FUNCTIONS
  // ========================================================================

  // Legacy Node.js runtime (if needed for compatibility)
  "legacy-api": {
    memory: 1024,
    timeout: 30,
    runtime: "nodejs18.x", // Older runtime for compatibility
    environment: {
      LEGACY_MODE: "true",
    },
  },

  // Minimal function (health checks, simple redirects)
  "health-check": {
    memory: 128, // 128MB - Minimum allowed memory
    timeout: 3, // 3 seconds - Should be very fast
    runtime: "nodejs20.x",
    environment: {
      HEALTH_CHECK_ENDPOINT: "/health",
    },
  },

  // Maximum resource function (heavy ML/AI workloads)
  "ml-inference": {
    memory: 10240, // 10GB - Maximum Lambda memory
    timeout: 900, // 15 minutes - Maximum Lambda timeout
    runtime: "nodejs20.x",
    environment: {
      MODEL_BUCKET: "your-ml-models-bucket",
      INFERENCE_TIMEOUT: "840000", // 14 minutes in milliseconds
      GPU_ENABLED: "false", // Lambda doesn't support GPU
    },
  },
};

export default functionConfig;

/**
 * CONFIGURATION REFERENCE
 *
 * Memory (memory):
 * - Range: 128 MB to 10,240 MB (10 GB)
 * - Increments: 1 MB
 * - Default: 1024 MB
 * - Higher memory = more CPU power and faster execution
 *
 * Timeout (timeout):
 * - Range: 1 second to 900 seconds (15 minutes)
 * - Default: 15 seconds
 * - Consider your function's typical execution time + buffer
 *
 * Runtime (runtime):
 * - Supported: "nodejs18.x", "nodejs20.x"
 * - Default: "nodejs20.x"
 * - Use latest stable version unless compatibility issues exist
 *
 * Environment Variables (environment):
 * - Key-value pairs passed to your Lambda function
 * - Merged with base environment variables from NextJS
 * - Function-specific variables override base variables
 *
 * COMMON USE CASES:
 *
 * 1. SSR Pages: 1024MB memory, 15s timeout
 * 2. API Routes: 512MB memory, 5-30s timeout (depending on complexity)
 * 3. Image Processing: 2048MB+ memory, 10-30s timeout
 * 4. File Upload: 1536MB memory, 30-60s timeout
 * 5. Database Operations: 512-1024MB memory, 15-30s timeout
 * 6. External API Calls: 256-512MB memory, 30-60s timeout
 * 7. Heavy Computation: 3008MB+ memory, 60-900s timeout
 * 8. Health Checks: 128MB memory, 3-5s timeout
 *
 * PERFORMANCE TIPS:
 *
 * - Start with defaults and adjust based on CloudWatch metrics
 * - Monitor memory usage and duration in CloudWatch Logs
 * - Higher memory allocation provides more CPU power
 * - Set timeout slightly higher than your 95th percentile duration
 * - Use environment variables for configuration instead of hardcoding
 * - Consider cold start impact when choosing memory allocation
 */
