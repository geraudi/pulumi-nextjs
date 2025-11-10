/**
 * Example usage of NextJsWarmer component
 */

import { NextJsSite } from "../../nextjs";

// Example 1: Default configuration (warmer enabled with 5-minute intervals)
const site1 = new NextJsSite("my-site-default", {
  path: "../apps/web",
});

// Example 2: Custom warming schedule
const site2 = new NextJsSite("my-site-custom", {
  path: "../apps/web",
  warmer: {
    enabled: true,
    schedule: "rate(3 minutes)", // Warm every 3 minutes
    concurrency: 2, // Invoke 2 instances per warming cycle
  },
});

// Example 3: Cron-based schedule (weekdays only, 9 AM - 5 PM UTC)
const site3 = new NextJsSite("my-site-business-hours", {
  path: "../apps/web",
  warmer: {
    enabled: true,
    schedule: "cron(0 9-17 ? * MON-FRI *)",
    concurrency: 1,
  },
});

// Example 4: Disabled warmer (for development or cost optimization)
const site4 = new NextJsSite("my-site-no-warmer", {
  path: "../apps/web",
  warmer: {
    enabled: false,
  },
});

// Example 5: High-traffic configuration
const site5 = new NextJsSite("my-site-high-traffic", {
  path: "../apps/web",
  warmer: {
    enabled: true,
    schedule: "rate(2 minutes)", // More frequent warming
    concurrency: 5, // Higher concurrency for multiple instances
  },
});

export { site1, site2, site3, site4, site5 };
