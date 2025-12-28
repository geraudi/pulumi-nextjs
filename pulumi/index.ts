import { NextJsSite } from "./nextjs";

const site = new NextJsSite("nextjs-pulumi", {
  path: "../apps/web",
  lambdaConfig: {
    // Image optimizer needs more memory
    imageOptimizer: {
      memory: 2048,
      timeout: 60,
    },
    // API routes need longer timeout
    api: {
      memory: 1024,
      timeout: 45,
    },
    // Custom fetching page server
    fetchingPage: {
      memory: 512,
      timeout: 20,
    },
  },
  // Warmer is disabled by default
  warmer: {
    enabled: false,
    schedule: "rate(5 minutes)",
    concurrency: 1, // Default for functions not specified below
    functions: {
      api: { enabled: false },
      fetchingPage: { concurrency: 2 },
    },
  },
  // WAF is disabled by default - uncomment to enable
  waf: {
    enabled: false,
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
