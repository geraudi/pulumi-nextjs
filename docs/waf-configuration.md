# AWS WAF Configuration for Next.js

## Overview

AWS WAF (Web Application Firewall) protects your Next.js application from common web exploits and attacks. This implementation provides an easy-to-configure WAF that can be enabled in your `NextJsSiteArgs`.

## Quick Start

Enable WAF in your `pulumi/index.ts`:

```typescript
const site = new NextJsSite("nextjs-pulumi", {
  path: "../apps/web",
  waf: {
    enabled: true,
  },
});
```

That's it! With just `enabled: true`, you get:
- ✅ Rate limiting (2000 requests per 5 min per IP)
- ✅ Protection against SQL injection, XSS, and common attacks
- ✅ Blocking of known malicious inputs
- ✅ CloudWatch metrics and logging

## Configuration Options

### Basic Configuration

```typescript
waf: {
  enabled: true,
  rateLimit: 2000, // Requests per 5 minutes per IP
}
```

### Full Configuration

```typescript
waf: {
  // Enable/disable WAF
  enabled: true,

  // Rate limiting
  rateLimit: 2000, // Requests per 5 minutes per IP (default: 2000)

  // AWS Managed Rule Sets
  enableCommonRuleSet: true,      // SQL injection, XSS, etc. (default: true)
  enableKnownBadInputs: true,     // Known malicious patterns (default: true)
  enableAnonymousIpList: false,   // Block VPNs, proxies, Tor (default: false)
  enableIpReputationList: false,  // Block known bad IPs (default: false)

  // Custom IP blocking/allowing
  blockIpAddresses: [
    "192.0.2.0/24",      // Block specific IP range
    "198.51.100.42/32",  // Block specific IP
  ],
  allowIpAddresses: [
    "203.0.113.0/24",    // Whitelist office IP range
  ],

  // Geographic blocking
  blockCountries: ["CN", "RU", "KP"], // ISO 3166-1 alpha-2 codes

  // Monitoring
  enableMetrics: true,           // CloudWatch metrics (default: true)
  enableSampledRequests: true,   // Sample blocked requests (default: true)
}
```

## Configuration Details

### Rate Limiting

Protects against DDoS and brute force attacks by limiting requests per IP.

```typescript
rateLimit: 2000  // 2000 requests per 5 minutes per IP
```

**Recommendations:**
- **API-heavy apps**: 1000-2000
- **Content sites**: 2000-5000
- **High-traffic apps**: 5000-10000

**What happens when exceeded:**
- Requests are blocked with HTTP 403
- IP is automatically unblocked after 5 minutes
- Metrics available in CloudWatch

### AWS Managed Rule Sets

#### Common Rule Set (Recommended: Enabled)

```typescript
enableCommonRuleSet: true
```

Protects against:
- SQL injection (SQLi)
- Cross-site scripting (XSS)
- Local file inclusion (LFI)
- Remote file inclusion (RFI)
- PHP injection
- Cross-site request forgery (CSRF)
- Session fixation
- Scanner detection

**Cost**: ~$1/month + $0.60 per million requests

#### Known Bad Inputs (Recommended: Enabled)

```typescript
enableKnownBadInputs: true
```

Blocks requests with patterns known to be malicious:
- Invalid or malformed requests
- Known exploit patterns
- Common attack signatures

**Cost**: ~$1/month + $0.60 per million requests

#### Anonymous IP List (Use with Caution)

```typescript
enableAnonymousIpList: false  // Default: disabled
```

Blocks requests from:
- VPN services
- Proxy servers
- Tor exit nodes
- Hosting providers

**⚠️ Warning**: May block legitimate users who use VPNs for privacy.

**Use cases**:
- High-security applications
- Banking/financial services
- Government sites

**Cost**: ~$1/month + $0.60 per million requests

#### IP Reputation List (Recommended for Production)

```typescript
enableIpReputationList: false  // Default: disabled
```

Blocks requests from IPs with known malicious activity:
- Botnet IPs
- Known attackers
- Spam sources

**Cost**: ~$1/month + $0.60 per million requests

### Custom IP Blocking

Block specific IP addresses or ranges:

```typescript
blockIpAddresses: [
  "192.0.2.0/24",      // Block entire subnet
  "198.51.100.42/32",  // Block single IP
]
```

**Use cases**:
- Block abusive users
- Block known attackers
- Comply with legal requirements

**Format**: CIDR notation (IPv4 only currently)

### IP Whitelisting

Allow specific IPs to bypass all WAF rules:

```typescript
allowIpAddresses: [
  "203.0.113.0/24",  // Office network
  "198.51.100.0/28", // VPN gateway
]
```

**⚠️ Warning**: Whitelisted IPs bypass ALL WAF rules, including rate limiting.

**Use cases**:
- Office networks
- CI/CD pipelines
- Monitoring services
- Partner integrations

### Geographic Blocking

Block requests from specific countries:

```typescript
blockCountries: ["CN", "RU", "KP"]  // China, Russia, North Korea
```

**Format**: ISO 3166-1 alpha-2 country codes

**Common country codes**:
- US - United States
- GB - United Kingdom
- CN - China
- RU - Russia
- KP - North Korea
- IR - Iran
- SY - Syria

**Use cases**:
- Comply with export restrictions
- Reduce spam from specific regions
- Target specific markets

**⚠️ Warning**: May block legitimate users traveling or using VPNs.

## Cost Breakdown

### Base Costs

| Component | Monthly Cost |
|-----------|--------------|
| WAF Web ACL | $5.00 |
| Per Rule (first 10) | $1.00 each |
| Per Million Requests | $0.60 |

### Example Configurations

#### Minimal (Rate Limiting Only)
```typescript
waf: {
  enabled: true,
  rateLimit: 2000,
  enableCommonRuleSet: false,
  enableKnownBadInputs: false,
}
```
**Cost**: ~$6/month + $0.60 per million requests

#### Recommended (Basic Protection)
```typescript
waf: {
  enabled: true,
  rateLimit: 2000,
  enableCommonRuleSet: true,
  enableKnownBadInputs: true,
}
```
**Cost**: ~$8/month + $0.60 per million requests

#### Maximum (Full Protection)
```typescript
waf: {
  enabled: true,
  rateLimit: 2000,
  enableCommonRuleSet: true,
  enableKnownBadInputs: true,
  enableAnonymousIpList: true,
  enableIpReputationList: true,
}
```
**Cost**: ~$10/month + $0.60 per million requests

### Traffic-Based Costs

| Monthly Requests | Additional Cost |
|------------------|-----------------|
| 1 million | $0.60 |
| 10 million | $6.00 |
| 100 million | $60.00 |

## Deployment

### Enable WAF

1. **Update configuration** in `pulumi/index.ts`:
   ```typescript
   waf: {
     enabled: true,
   }
   ```

2. **Deploy**:
   ```bash
   cd pulumi
   pulumi up
   ```

3. **Verify**:
   ```bash
   # Check WAF is attached to CloudFront
   aws wafv2 list-web-acls --scope CLOUDFRONT --region us-east-1
   
   # Get WAF details
   aws wafv2 get-web-acl --scope CLOUDFRONT --region us-east-1 \
     --id <web-acl-id> --name nextjs-pulumi-waf
   ```

### Disable WAF

1. **Update configuration**:
   ```typescript
   waf: {
     enabled: false,
   }
   ```

2. **Deploy**:
   ```bash
   pulumi up
   ```

## Monitoring

### CloudWatch Metrics

WAF automatically creates CloudWatch metrics:

```bash
# View WAF metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/WAFV2 \
  --metric-name BlockedRequests \
  --dimensions Name=Rule,Value=RateLimitRule Name=WebACL,Value=nextjs-pulumi-waf \
  --start-time 2025-11-11T00:00:00Z \
  --end-time 2025-11-11T23:59:59Z \
  --period 3600 \
  --statistics Sum
```

### Available Metrics

- **AllowedRequests**: Requests that passed WAF rules
- **BlockedRequests**: Requests blocked by WAF rules
- **CountedRequests**: Requests counted but not blocked
- **PassedRequests**: Requests that didn't match any rules

### CloudWatch Dashboards

Create a dashboard to monitor WAF:

```typescript
const dashboard = new aws.cloudwatch.Dashboard("waf-dashboard", {
  dashboardName: "nextjs-waf-monitoring",
  dashboardBody: JSON.stringify({
    widgets: [
      {
        type: "metric",
        properties: {
          metrics: [
            ["AWS/WAFV2", "BlockedRequests", { stat: "Sum" }],
            [".", "AllowedRequests", { stat: "Sum" }],
          ],
          period: 300,
          stat: "Sum",
          region: "us-east-1",
          title: "WAF Request Status",
        },
      },
    ],
  }),
});
```

### Sampled Requests

View blocked requests in AWS Console:
1. Go to AWS WAF console
2. Select your Web ACL
3. Click "Sampled requests" tab
4. View details of blocked requests

### CloudWatch Logs

Enable logging for detailed analysis:

```typescript
// Create log group
const logGroup = new aws.cloudwatch.LogGroup("waf-logs", {
  name: "/aws/wafv2/nextjs-pulumi",
  retentionInDays: 30,
});

// Enable WAF logging
const loggingConfig = new aws.wafv2.WebAclLoggingConfiguration("waf-logging", {
  resourceArn: waf.webAcl.arn,
  logDestinationConfigs: [logGroup.arn],
});
```

## Alerts

### Recommended CloudWatch Alarms

#### High Block Rate

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name waf-high-block-rate \
  --alarm-description "Alert when WAF blocks > 100 requests in 5 min" \
  --metric-name BlockedRequests \
  --namespace AWS/WAFV2 \
  --statistic Sum \
  --period 300 \
  --threshold 100 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1
```

#### Rate Limit Triggered

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name waf-rate-limit-triggered \
  --alarm-description "Alert when rate limit is triggered" \
  --metric-name BlockedRequests \
  --namespace AWS/WAFV2 \
  --dimensions Name=Rule,Value=RateLimitRule \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1
```

## Testing

### Test Rate Limiting

```bash
# Send rapid requests to trigger rate limit
for i in {1..2100}; do
  curl -s https://your-domain.com/ > /dev/null
  echo "Request $i"
done

# After ~2000 requests, you should see 403 Forbidden
```

### Test IP Blocking

```bash
# If you blocked 192.0.2.0/24, test from that range
curl -H "X-Forwarded-For: 192.0.2.1" https://your-domain.com/

# Expected: 403 Forbidden
```

### Test Geographic Blocking

```bash
# Use a VPN or proxy from blocked country
# Expected: 403 Forbidden
```

## Troubleshooting

### Issue: Legitimate Users Blocked

**Symptoms**: Users report 403 errors

**Solutions**:
1. Check CloudWatch metrics for high block rate
2. Review sampled requests to identify pattern
3. Adjust rate limit if too restrictive
4. Whitelist specific IPs if needed
5. Disable Anonymous IP List if blocking VPN users

### Issue: High Costs

**Symptoms**: Unexpected WAF charges

**Solutions**:
1. Review number of rules (each costs $1/month)
2. Check request volume (charged per million)
3. Disable unused managed rule sets
4. Consider removing geographic blocking if not needed

### Issue: WAF Not Blocking Attacks

**Symptoms**: Attacks getting through

**Solutions**:
1. Enable more managed rule sets
2. Lower rate limit threshold
3. Add custom IP blocking rules
4. Enable IP Reputation List
5. Review CloudWatch logs for attack patterns

## Best Practices

1. **Start Conservative**: Begin with basic protection and adjust based on metrics
2. **Monitor Regularly**: Check CloudWatch metrics weekly
3. **Test Changes**: Test WAF rules in staging before production
4. **Document Whitelists**: Keep track of whitelisted IPs and why
5. **Review Logs**: Regularly review sampled requests for false positives
6. **Update Rules**: Keep managed rule sets enabled for automatic updates
7. **Set Alerts**: Configure CloudWatch alarms for unusual activity
8. **Cost Monitoring**: Track WAF costs and optimize rules

## Security Considerations

### What WAF Protects Against

- ✅ DDoS attacks (rate limiting)
- ✅ SQL injection
- ✅ Cross-site scripting (XSS)
- ✅ Known exploits
- ✅ Malicious bots
- ✅ Geographic threats

### What WAF Does NOT Protect Against

- ❌ Application logic vulnerabilities
- ❌ Authentication bypass
- ❌ Business logic flaws
- ❌ Zero-day exploits (until rules updated)
- ❌ Insider threats
- ❌ Social engineering

### Defense in Depth

WAF is one layer of security. Also implement:
- Application-level authentication
- Input validation
- Output encoding
- HTTPS/TLS
- Security headers
- Regular security audits
- Dependency updates

## References

- [AWS WAF Documentation](https://docs.aws.amazon.com/waf/)
- [AWS Managed Rules](https://docs.aws.amazon.com/waf/latest/developerguide/aws-managed-rule-groups.html)
- [WAF Pricing](https://aws.amazon.com/waf/pricing/)
- [CloudWatch Metrics for WAF](https://docs.aws.amazon.com/waf/latest/developerguide/monitoring-cloudwatch.html)

---