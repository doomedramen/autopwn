import { db } from "../db/index";
import { config } from "../db/schema";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

export interface ConfigValue {
  id: string;
  value: any;
  description: string | null;
  category: "general" | "security" | "performance";
  type: "number" | "string" | "boolean";
  defaultValue: any;
  minValue: any;
  maxValue: any;
  isReadOnly: boolean;
  requiresRestart: boolean;
  updatedAt: Date;
  updatedBy: string | null;
}

interface CacheEntry {
  value: any;
  expiresAt: number;
}

class ConfigService {
  private cache: Map<string, CacheEntry> = new Map();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes in milliseconds
  private initialized = false;

  /**
   * Load all config values from database into cache
   */
  async loadConfig(): Promise<void> {
    try {
      logger.info("Loading config from database", "config-service");

      const allConfig = await db.query.config.findMany({
        orderBy: (config, { asc }) => [asc(config.id)],
      });

      this.cache.clear();

      for (const cfg of allConfig) {
        this.cache.set(cfg.id, {
          value: cfg.value,
          expiresAt: Date.now() + this.cacheTTL,
        });
      }

      this.initialized = true;
      logger.info("Config loaded successfully", "config-service", {
        configCount: allConfig.length,
      });
    } catch (error) {
      logger.error("Failed to load config from database", "config-service", {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Get a config value (uses cache, with fallback to environment variable)
   */
  private async getConfigValue(id: string): Promise<any> {
    const cacheKey = id.toUpperCase().replace(/-/g, "_");

    if (!this.initialized) {
      await this.loadConfig();
    }

    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    try {
      const cfg = await db.query.config.findFirst({
        where: eq(config.id, cacheKey),
      });

      if (!cfg) {
        throw new Error(`Config '${id}' not found`);
      }

      this.cache.set(cacheKey, {
        value: cfg.value,
        expiresAt: Date.now() + this.cacheTTL,
      });

      return cfg.value;
    } catch (error) {
      logger.error(`Failed to get config value for '${id}'`, "config-service", {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Check if environment variable override exists
   */
  private getEnvOverride(id: string): any {
    const envKey = id.toUpperCase().replace(/-/g, "_");
    const envValue = process.env[envKey];

    if (envValue !== undefined) {
      logger.debug(
        `Using environment variable override for '${id}'`,
        "config-service",
        {
          envKey,
        },
      );
      return envValue;
    }

    return null;
  }

  /**
   * Get a number config value
   */
  async getNumber(id: string): Promise<number> {
    const envOverride = this.getEnvOverride(id);
    if (envOverride !== null) {
      const parsed = parseInt(envOverride, 10);
      if (isNaN(parsed)) {
        throw new Error(
          `Invalid environment variable value for '${id}': ${envValue}`,
        );
      }
      return parsed;
    }

    const value = await this.getConfigValue(id);
    if (typeof value !== "number") {
      throw new Error(`Config '${id}' is not a number: ${value}`);
    }
    return value;
  }

  /**
   * Get a string config value
   */
  async getString(id: string): Promise<string> {
    const envOverride = this.getEnvOverride(id);
    if (envOverride !== null) {
      return envOverride;
    }

    const value = await this.getConfigValue(id);
    if (typeof value !== "string") {
      throw new Error(`Config '${id}' is not a string: ${value}`);
    }
    return value;
  }

  /**
   * Get a boolean config value
   */
  async getBoolean(id: string): Promise<boolean> {
    const envOverride = this.getEnvOverride(id);
    if (envOverride !== null) {
      return envOverride.toLowerCase() === "true";
    }

    const value = await this.getConfigValue(id);
    if (typeof value !== "boolean") {
      throw new Error(`Config '${id}' is not a boolean: ${value}`);
    }
    return value;
  }

  /**
   * Get any config value without type checking
   */
  async get(id: string): Promise<any> {
    const envOverride = this.getEnvOverride(id);
    if (envOverride !== null) {
      return envOverride;
    }

    return this.getConfigValue(id);
  }

  /**
   * Update a config value (also updates database)
   */
  async update(
    id: string,
    value: any,
    userId: string | null = null,
  ): Promise<ConfigValue> {
    try {
      logger.info(`Updating config '${id}'`, "config-service", {
        id,
        value,
        userId,
      });

      const cacheKey = id.toUpperCase().replace(/-/g, "_");

      const [existing] = await db
        .update(config)
        .set({
          value,
          updatedAt: new Date(),
          updatedBy: userId,
        })
        .where(eq(config.id, cacheKey))
        .returning();

      if (!existing) {
        throw new Error(`Config '${id}' not found`);
      }

      if (existing.isReadOnly) {
        throw new Error(`Config '${id}' is read-only`);
      }

      this.cache.set(cacheKey, {
        value: existing.value,
        expiresAt: Date.now() + this.cacheTTL,
      });

      logger.info(`Config '${id}' updated successfully`, "config-service", {
        id,
        newValue: existing.value,
        requiresRestart: existing.requiresRestart,
      });

      return existing;
    } catch (error) {
      logger.error(`Failed to update config '${id}'`, "config-service", {
        id,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Batch update multiple config values
   */
  async batchUpdate(
    updates: Array<{ id: string; value: any }>,
    userId: string | null = null,
  ): Promise<ConfigValue[]> {
    const results: ConfigValue[] = [];

    try {
      logger.info("Batch updating config values", "config-service", {
        updateCount: updates.length,
        userId,
      });

      for (const { id, value } of updates) {
        const result = await this.update(id, value, userId);
        results.push(result);
      }

      logger.info("Batch config update completed", "config-service", {
        updateCount: results.length,
      });

      return results;
    } catch (error) {
      logger.error("Failed to batch update config values", "config-service", {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Reload config from database (clears cache)
   */
  async reload(): Promise<void> {
    logger.info("Reloading config", "config-service");
    this.cache.clear();
    await this.loadConfig();
    logger.info("Config reloaded successfully", "config-service");
  }

  /**
   * Invalidate a specific config value from cache
   */
  invalidate(id: string): void {
    const cacheKey = id.toUpperCase().replace(/-/g, "_");
    this.cache.delete(cacheKey);
    logger.debug(`Invalidated cache for '${id}'`, "config-service");
  }

  /**
   * Clear all cached config values
   */
  clearCache(): void {
    this.cache.clear();
    logger.info("Config cache cleared", "config-service");
  }

  /**
   * Get all config values (admin only)
   */
  async getAll(): Promise<ConfigValue[]> {
    try {
      const allConfig = await db.query.config.findMany({
        orderBy: (config, { asc }) => [asc(config.id)],
      });

      return allConfig;
    } catch (error) {
      logger.error("Failed to get all config values", "config-service", {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Get a single config value with metadata
   */
  async getById(id: string): Promise<ConfigValue | null> {
    try {
      const cacheKey = id.toUpperCase().replace(/-/g, "_");
      const cfg = await db.query.config.findFirst({
        where: eq(config.id, cacheKey),
      });

      return cfg || null;
    } catch (error) {
      logger.error(`Failed to get config '${id}'`, "config-service", {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Validate a config value against its type and constraints
   */
  async validate(
    id: string,
    value: any,
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const cfg = await this.getById(id);

      if (!cfg) {
        return { valid: false, error: `Config '${id}' not found` };
      }

      if (cfg.isReadOnly) {
        return { valid: false, error: `Config '${id}' is read-only` };
      }

      switch (cfg.type) {
        case "number":
          if (typeof value !== "number") {
            return { valid: false, error: `Config '${id}' must be a number` };
          }
          if (cfg.minValue !== null && value < cfg.minValue) {
            return {
              valid: false,
              error: `Config '${id}' must be >= ${cfg.minValue}`,
            };
          }
          if (cfg.maxValue !== null && value > cfg.maxValue) {
            return {
              valid: false,
              error: `Config '${id}' must be <= ${cfg.maxValue}`,
            };
          }
          break;

        case "string":
          if (typeof value !== "string") {
            return { valid: false, error: `Config '${id}' must be a string` };
          }
          break;

        case "boolean":
          if (typeof value !== "boolean") {
            return { valid: false, error: `Config '${id}' must be a boolean` };
          }
          break;

        default:
          return { valid: false, error: `Unknown config type: ${cfg.type}` };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : "Validation failed",
      };
    }
  }

  /**
   * Convenience methods for common config values
   */

  async getMaxPcapSize(): Promise<number> {
    return this.getNumber("max-pcap-size");
  }

  async getMaxDictionarySize(): Promise<number> {
    return this.getNumber("max-dictionary-size");
  }

  async getMaxGeneratedDictSize(): Promise<number> {
    return this.getNumber("max-generated-dict-size");
  }

  async getMaxConcurrentJobs(): Promise<number> {
    return this.getNumber("max-concurrent-jobs");
  }

  async getHashcatDefaultWorkload(): Promise<number> {
    return this.getNumber("hashcat-default-workload");
  }

  async getHashcatJobTimeout(): Promise<number> {
    return this.getNumber("hashcat-job-timeout");
  }

  async getAllowUserRegistration(): Promise<boolean> {
    return this.getBoolean("allow-user-registration");
  }

  async getSessionExpiry(): Promise<number> {
    return this.getNumber("session-expiry");
  }

  async getRateLimitDefault(): Promise<number> {
    return this.getNumber("rate-limit-default");
  }

  async getRateLimitUpload(): Promise<number> {
    return this.getNumber("rateLimitUpload");
  }

  async getRateLimitAuth(): Promise<number> {
    return this.getNumber("rate-limit-auth");
  }
}

export const configService = new ConfigService();
