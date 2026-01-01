import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';

interface WafConfig {
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

type BaseFunction = {
    handler: string;
    bundle: string;
};
type OpenNextFunctionOrigin = {
    type: "function";
    streaming?: boolean;
} & BaseFunction;
type OpenNextECSOrigin = {
    type: "ecs";
    bundle: string;
    dockerfile: string;
};
type OpenNextS3OriginCopy = {
    from: string;
    to: string;
    cached: boolean;
    versionedSubDir?: string;
};
type OpenNextS3Origin = {
    type: "s3";
    originPath: string;
    copy: OpenNextS3OriginCopy[];
};
type OpenNextOrigins = OpenNextFunctionOrigin | OpenNextECSOrigin | OpenNextS3Origin;
interface OpenNextOutput {
    edgeFunctions: {
        [key: string]: BaseFunction;
    };
    origins: {
        s3: OpenNextS3Origin;
        default: OpenNextFunctionOrigin | OpenNextECSOrigin;
        imageOptimizer: OpenNextFunctionOrigin | OpenNextECSOrigin;
        [key: string]: OpenNextOrigins;
    };
    behaviors: {
        pattern: string;
        origin?: string;
        edgeFunction?: string;
    }[];
    additionalProps?: {
        disableIncrementalCache?: boolean;
        disableTagCache?: boolean;
        initializationFunction?: BaseFunction;
        warmer?: BaseFunction;
        revalidationFunction?: BaseFunction;
    };
}
interface LambdaConfig {
    /**
     * Memory size in MB
     * @default 256
     */
    memory?: number;
    /**
     * Timeout in seconds
     * @default 15
     */
    timeout?: number;
    /**
     * Lambda runtime
     * @default NodeJS20dX
     */
    runtime?: aws.lambda.Runtime;
    /**
     * Architecture
     * @default "x86_64"
     */
    architecture?: "x86_64" | "arm64";
}
interface LambdaConfigMap {
    /**
     * Default configuration for all Lambda functions
     */
    default?: LambdaConfig;
    /**
     * Configuration for the default server function
     */
    defaultServer?: LambdaConfig;
    /**
     * Configuration for the image optimizer function
     */
    imageOptimizer?: LambdaConfig;
    /**
     * Configuration for custom server functions (e.g., api, fetchingPage)
     * Key should match the function name from open-next.config.ts
     */
    [key: string]: LambdaConfig | undefined;
}
interface WarmerConfig {
    /**
     * Enable or disable the warmer
     * @default true
     */
    enabled?: boolean;
    /**
     * Schedule expression for warming (cron or rate)
     * @default "rate(5 minutes)"
     * @example "rate(5 minutes)" or "cron(0/5 * * * ? *)"
     */
    schedule?: string;
    /**
     * Number of concurrent invocations per warming cycle (applies to all functions if not specified per-function)
     * @default 1
     */
    concurrency?: number;
    /**
     * Per-function warming configuration
     * @example
     * {
     *   api: { concurrency: 5 },
     *   fetchingPage: { enabled: false }
     * }
     */
    functions?: {
        [functionKey: string]: {
            /**
             * Enable or disable warming for this specific function
             * @default true
             */
            enabled?: boolean;
            /**
             * Number of concurrent invocations for this function
             * Required if enabled is true or undefined
             */
            concurrency?: number;
        };
    };
    /**
     * Custom warming payload
     */
    payload?: Record<string, unknown>;
}

interface NexJsSiteArgs {
    path?: string;
    environment?: Record<string, pulumi.Input<string>>;
    warmer?: WarmerConfig;
    waf?: WafConfig;
    lambdaConfig?: LambdaConfigMap;
    fixSymLinks?: boolean;
}
declare class NextJsSite extends pulumi.ComponentResource {
    private openNextOutput;
    private storage;
    private database;
    private queue;
    private functions;
    private distribution;
    private waf?;
    private warmer?;
    private readonly name;
    private readonly region;
    path: string;
    environment: Record<string, pulumi.Input<string>>;
    domainName: pulumi.Output<string>;
    url: pulumi.Output<string>;
    constructor(name: string, args: NexJsSiteArgs, opts?: pulumi.ComponentResourceOptions);
    private getEnvironment;
}

export { type LambdaConfig, type LambdaConfigMap, type NexJsSiteArgs, NextJsSite, type OpenNextOutput, type WafConfig, type WarmerConfig };
