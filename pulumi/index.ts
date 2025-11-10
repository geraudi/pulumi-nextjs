import { NextJsSite } from "./nextjs";

const site = new NextJsSite("nextjs-pulumi", {
  path: "../apps/web",
  // Warmer is disabled by default
  warmer: {
    enabled: true,
    schedule: "cron(0/5 9-17 ? * MON-FRI *)", // Every 5 min, 9AM-5PM, weekdays (UTC)
    concurrency: 1, // (default)
  },
});

export const url = site.url;
