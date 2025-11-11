import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

export interface WafConfig {
  /**
   * Enable or disable WAF
   * @default false
   */
  enabled?: boolean;

  /**
   * Rate limit per IP (requests per 5 minutes)
   * @default 2000
   */
  rateLimit?: number;

  /**
   * Enable AWS Managed Rules - Common Rule Set
   * Protects against common threats like SQL injection, XSS
   * @default true
   */
  enableCommonRuleSet?: boolean;

  /**
   * Enable AWS Managed Rules - Known Bad Inputs
   * Protects against known malicious inputs
   * @default true
   */
  enableKnownBadInputs?: boolean;

  /**
   * Enable AWS Managed Rules - Anonymous IP List
   * Blocks requests from anonymous proxies, VPNs, Tor
   * @default false
   */
  enableAnonymousIpList?: boolean;

  /**
   * Enable AWS Managed Rules - IP Reputation List
   * Blocks requests from known malicious IPs
   * @default false
   */
  enableIpReputationList?: boolean;

  /**
   * Custom IP addresses to block (CIDR notation)
   * @example ["192.0.2.0/24", "198.51.100.0/24"]
   */
  blockIpAddresses?: string[];

  /**
   * Custom IP addresses to allow (CIDR notation)
   * @example ["203.0.113.0/24"]
   */
  allowIpAddresses?: string[];

  /**
   * Geographic locations to block (ISO 3166-1 alpha-2 country codes)
   * @example ["CN", "RU"]
   */
  blockCountries?: string[];

  /**
   * Enable CloudWatch metrics
   * @default true
   */
  enableMetrics?: boolean;

  /**
   * Enable sampled requests (for debugging)
   * @default true
   */
  enableSampledRequests?: boolean;
}

export class NextJsWaf extends pulumi.ComponentResource {
  public webAcl: aws.wafv2.WebAcl;

  constructor(
    name: string,
    config: WafConfig,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super("nextjs:security:Waf", name, {}, opts);

    if (!config.enabled) {
      // Create a dummy resource to satisfy the type system
      // This won't actually create anything in AWS
      throw new Error("WAF is disabled. Do not create this resource.");
    }

    const rules = this.createRules(name, config);

    this.webAcl = new aws.wafv2.WebAcl(
      `${name}-waf`,
      {
        scope: "CLOUDFRONT",
        description: "WAF for Next.js application",
        defaultAction: { allow: {} },
        rules,
        visibilityConfig: {
          cloudwatchMetricsEnabled: config.enableMetrics ?? true,
          metricName: `${name}-waf-metric`,
          sampledRequestsEnabled: config.enableSampledRequests ?? true,
        },
        tags: {
          Name: `${name}-waf`,
          ManagedBy: "Pulumi",
        },
      },
      { parent: this, provider: this.getUsEast1Provider() },
    );
  }

  private createRules(
    name: string,
    config: WafConfig,
  ): aws.types.input.wafv2.WebAclRule[] {
    const rules: aws.types.input.wafv2.WebAclRule[] = [];
    let priority = 1;

    // Rule 1: Rate Limiting
    if (config.rateLimit && config.rateLimit > 0) {
      rules.push({
        name: "RateLimitRule",
        priority: priority++,
        action: { block: {} },
        statement: {
          rateBasedStatement: {
            limit: config.rateLimit,
            aggregateKeyType: "IP",
          },
        },
        visibilityConfig: {
          cloudwatchMetricsEnabled: config.enableMetrics ?? true,
          metricName: `${name}-rate-limit-metric`,
          sampledRequestsEnabled: config.enableSampledRequests ?? true,
        },
      });
    }

    // Rule 2: Block specific IP addresses
    if (config.blockIpAddresses && config.blockIpAddresses.length > 0) {
      const ipSet = new aws.wafv2.IpSet(
        `${name}-blocked-ips`,
        {
          scope: "CLOUDFRONT",
          ipAddressVersion: "IPV4",
          addresses: config.blockIpAddresses,
        },
        { parent: this, provider: this.getUsEast1Provider() },
      );

      rules.push({
        name: "BlockSpecificIPs",
        priority: priority++,
        action: { block: {} },
        statement: {
          ipSetReferenceStatement: {
            arn: ipSet.arn,
          },
        },
        visibilityConfig: {
          cloudwatchMetricsEnabled: config.enableMetrics ?? true,
          metricName: `${name}-blocked-ips-metric`,
          sampledRequestsEnabled: config.enableSampledRequests ?? true,
        },
      });
    }

    // Rule 3: Allow specific IP addresses (whitelist)
    if (config.allowIpAddresses && config.allowIpAddresses.length > 0) {
      const ipSet = new aws.wafv2.IpSet(
        `${name}-allowed-ips`,
        {
          scope: "CLOUDFRONT",
          ipAddressVersion: "IPV4",
          addresses: config.allowIpAddresses,
        },
        { parent: this, provider: this.getUsEast1Provider() },
      );

      rules.push({
        name: "AllowSpecificIPs",
        priority: priority++,
        action: { allow: {} },
        statement: {
          ipSetReferenceStatement: {
            arn: ipSet.arn,
          },
        },
        visibilityConfig: {
          cloudwatchMetricsEnabled: config.enableMetrics ?? true,
          metricName: `${name}-allowed-ips-metric`,
          sampledRequestsEnabled: config.enableSampledRequests ?? true,
        },
      });
    }

    // Rule 4: Block specific countries
    if (config.blockCountries && config.blockCountries.length > 0) {
      rules.push({
        name: "BlockCountries",
        priority: priority++,
        action: { block: {} },
        statement: {
          geoMatchStatement: {
            countryCodes: config.blockCountries,
          },
        },
        visibilityConfig: {
          cloudwatchMetricsEnabled: config.enableMetrics ?? true,
          metricName: `${name}-blocked-countries-metric`,
          sampledRequestsEnabled: config.enableSampledRequests ?? true,
        },
      });
    }

    // Rule 5: AWS Managed Rules - Common Rule Set
    if (config.enableCommonRuleSet ?? true) {
      rules.push({
        name: "AWSManagedRulesCommonRuleSet",
        priority: priority++,
        overrideAction: { none: {} },
        statement: {
          managedRuleGroupStatement: {
            vendorName: "AWS",
            name: "AWSManagedRulesCommonRuleSet",
          },
        },
        visibilityConfig: {
          cloudwatchMetricsEnabled: config.enableMetrics ?? true,
          metricName: `${name}-common-rule-set-metric`,
          sampledRequestsEnabled: config.enableSampledRequests ?? true,
        },
      });
    }

    // Rule 6: AWS Managed Rules - Known Bad Inputs
    if (config.enableKnownBadInputs ?? true) {
      rules.push({
        name: "AWSManagedRulesKnownBadInputsRuleSet",
        priority: priority++,
        overrideAction: { none: {} },
        statement: {
          managedRuleGroupStatement: {
            vendorName: "AWS",
            name: "AWSManagedRulesKnownBadInputsRuleSet",
          },
        },
        visibilityConfig: {
          cloudwatchMetricsEnabled: config.enableMetrics ?? true,
          metricName: `${name}-known-bad-inputs-metric`,
          sampledRequestsEnabled: config.enableSampledRequests ?? true,
        },
      });
    }

    // Rule 7: AWS Managed Rules - Anonymous IP List
    if (config.enableAnonymousIpList) {
      rules.push({
        name: "AWSManagedRulesAnonymousIpList",
        priority: priority++,
        overrideAction: { none: {} },
        statement: {
          managedRuleGroupStatement: {
            vendorName: "AWS",
            name: "AWSManagedRulesAnonymousIpList",
          },
        },
        visibilityConfig: {
          cloudwatchMetricsEnabled: config.enableMetrics ?? true,
          metricName: `${name}-anonymous-ip-list-metric`,
          sampledRequestsEnabled: config.enableSampledRequests ?? true,
        },
      });
    }

    // Rule 8: AWS Managed Rules - IP Reputation List
    if (config.enableIpReputationList) {
      rules.push({
        name: "AWSManagedRulesAmazonIpReputationList",
        priority: priority++,
        overrideAction: { none: {} },
        statement: {
          managedRuleGroupStatement: {
            vendorName: "AWS",
            name: "AWSManagedRulesAmazonIpReputationList",
          },
        },
        visibilityConfig: {
          cloudwatchMetricsEnabled: config.enableMetrics ?? true,
          metricName: `${name}-ip-reputation-list-metric`,
          sampledRequestsEnabled: config.enableSampledRequests ?? true,
        },
      });
    }

    return rules;
  }

  private getUsEast1Provider(): aws.Provider {
    // WAF for CloudFront must be created in us-east-1
    return new aws.Provider("us-east-1-provider", {
      region: "us-east-1",
    });
  }
}
