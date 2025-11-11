import { NextJsSite } from "./nextjs";

const site = new NextJsSite("nextjs-pulumi", {
  path: "../apps/web",
  // Warmer is disabled by default
  warmer: {
    enabled: true,
    schedule: "cron(0/5 9-17 ? * MON-FRI *)", // Every 5 min, 9AM-5PM, weekdays (UTC)
    concurrency: 1, // (default)
  },
  // WAF is disabled by default - uncomment to enable
  waf: {
    enabled: true,
    rateLimit: 2000, // 2000 requests per 5 minutes per IP
    enableCommonRuleSet: true, // Protects against SQL injection, XSS, etc.
    enableKnownBadInputs: true, // Blocks known malicious inputs
    enableAnonymousIpList: false, // Block VPNs, proxies, Tor (may block legitimate users)
    enableIpReputationList: false, // Block known malicious IPs
    // blockIpAddresses: ["192.0.2.0/24"], // Optional: Block specific IPs
    // allowIpAddresses: ["203.0.113.0/24"], // Optional: Whitelist specific IPs
    // blockCountries: ["CN", "RU"], // Optional: Block specific countries
  },
});

export const url = site.url;
