import type {
  LambdaSettings,
  PulumiFunctionConfig,
  ResolvedFunctionSettings,
} from "./types";

/**
 * Manages Lambda function configuration with defaults and validation
 */
export class FunctionConfigManager {
  private readonly defaultSettings: ResolvedFunctionSettings;
  private readonly userConfig: PulumiFunctionConfig;

  constructor(userConfig?: PulumiFunctionConfig) {
    this.defaultSettings = {
      memory: 1024,
      timeout: 15,
      runtime: "nodejs20.x",
      environment: {},
    };

    this.userConfig = userConfig || {};

    // Validate all user configurations on initialization
    for (const [functionName, settings] of Object.entries(this.userConfig)) {
      this.validateSettings(settings, functionName);
    }
  }

  /**
   * Validates Lambda settings according to AWS limits and requirements
   */
  private validateSettings(
    settings: LambdaSettings,
    functionName?: string,
  ): void {
    const context = functionName ? ` for function "${functionName}"` : "";

    if (settings.memory !== undefined) {
      if (
        !Number.isInteger(settings.memory) ||
        settings.memory < 128 ||
        settings.memory > 10240
      ) {
        throw new Error(
          `Invalid memory setting${context}: ${settings.memory}. Must be an integer between 128 and 10240 MB.`,
        );
      }
    }

    if (settings.timeout !== undefined) {
      if (
        !Number.isInteger(settings.timeout) ||
        settings.timeout < 1 ||
        settings.timeout > 900
      ) {
        throw new Error(
          `Invalid timeout setting${context}: ${settings.timeout}. Must be an integer between 1 and 900 seconds.`,
        );
      }
    }

    if (settings.runtime !== undefined) {
      const validRuntimes = [
        "nodejs18.x",
        "nodejs20.x",
        "python3.9",
        "python3.10",
        "python3.11",
        "python3.12",
        "java8.al2",
        "java11",
        "java17",
        "java21",
        "dotnet6",
        "dotnet8",
        "go1.x",
        "ruby3.2",
        "ruby3.3",
      ];

      if (!validRuntimes.includes(settings.runtime)) {
        throw new Error(
          `Invalid runtime setting${context}: ${settings.runtime}. Must be one of: ${validRuntimes.join(", ")}.`,
        );
      }
    }

    if (settings.environment !== undefined) {
      if (
        typeof settings.environment !== "object" ||
        settings.environment === null
      ) {
        throw new Error(
          `Invalid environment setting${context}: must be an object with string key-value pairs.`,
        );
      }

      for (const [key, value] of Object.entries(settings.environment)) {
        if (typeof key !== "string" || typeof value !== "string") {
          throw new Error(
            `Invalid environment variable${context}: "${key}" = "${value}". Both key and value must be strings.`,
          );
        }
      }
    }
  }

  /**
   * Gets resolved function settings by merging user config with defaults
   */
  getFunctionSettings(functionName: string): ResolvedFunctionSettings {
    const userSettings = this.userConfig[functionName];
    return this.mergeWithDefaults(functionName, userSettings);
  }

  /**
   * Merges user settings with defaults, handling environment variables specially
   */
  private mergeWithDefaults(
    _functionName: string,
    userSettings?: LambdaSettings,
  ): ResolvedFunctionSettings {
    if (!userSettings) {
      // No user config for this function, return defaults
      return { ...this.defaultSettings };
    }

    // Merge environment variables: defaults first, then user-specific
    const mergedEnvironment = {
      ...this.defaultSettings.environment,
      ...(userSettings.environment || {}),
    };

    return {
      memory: userSettings.memory ?? this.defaultSettings.memory,
      timeout: userSettings.timeout ?? this.defaultSettings.timeout,
      runtime: userSettings.runtime ?? this.defaultSettings.runtime,
      environment: mergedEnvironment,
    };
  }
}
