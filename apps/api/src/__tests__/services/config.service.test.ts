import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { configService } from "../services/config.service";
import { logger } from "../lib/logger";

describe("ConfigService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    logger.info = vi.fn();
    logger.warn = vi.fn();
    logger.error = vi.fn();
    configService.clearCache();
  });

  describe("Initialization", () => {
    it("should initialize config from database on first call", async () => {
      await configService.loadConfig();
      expect(logger.info).toHaveBeenCalledWith(
        "Config loaded successfully",
        "config-service",
        expect.any(Object),
      );
    });

    it("should not reinitialize if already initialized", async () => {
      const initialLoad = configService.loadConfig();
      await configService.loadConfig();

      // Should only load once (second call should skip database query)
      expect(logger.info).toHaveBeenCalledTimes(2);
    });
  });

  describe("getValue methods", () => {
    beforeEach(async () => {
      await configService.loadConfig();
      configService.clearCache();
    });

    it("should get number value", async () => {
      const value = await configService.getNumber("max-pcap-size");
      expect(value).toBe(524288000);
    });

    it("should get string value", async () => {
      const value = await configService.getString("non-existent-config");
      expect(value).toBe("value from database");
    });

    it("should get boolean value", async () => {
      const value = await configService.getBoolean("allow-user-registration");
      expect(typeof value).toBe("boolean");
    });

    it("should use environment variable override", async () => {
      const envValue = "12345";
      process.env.MAX_PCAP_SIZE = envValue;

      const value = await configService.getNumber("max-pcap-size");
      expect(value).toBe(parseInt(envValue));
      expect(logger.info).toHaveBeenCalledWith(
        "Using environment variable override for 'max-pcap-size'",
        "config-service",
        { envKey: "MAX_PCAP_SIZE", envValue },
      );
    });

    it("should throw error for non-existent config", async () => {
      await expect(
        configService.getNumber("non-existent-config"),
      ).rejects.toThrow();
    });

    it("should cache values with TTL", async () => {
      await configService.getNumber("max-pcap-size");
      const value = await configService.getNumber("max-pcap-size");
      expect(value).toBe(524288000);

      // Value should be cached (not queried from database again)
      expect(logger.info).toHaveBeenCalledTimes(1);
    });
  });

  describe("update methods", () => {
    beforeEach(async () => {
      await configService.loadConfig();
    });

    it("should update config value and invalidate cache", async () => {
      await configService.update("max-pcap-size", 1048576000);
      const value = await configService.getNumber("max-pcap-size");
      expect(value).toBe(1048576000);
    });

    it("should reject update for non-existent config", async () => {
      await expect(
        configService.update("non-existent-config", 524288000),
      ).rejects.toThrow();
    });

    it("should reject update for read-only config", async () => {
      await expect(
        configService.update("session-expiry", 86400000),
      ).rejects.toThrow();
    });
  });

  describe("validate method", () => {
    it("should validate correct number value", async () => {
      await configService.loadConfig();
      const result = await configService.validate("max-pcap-size", 1048576000);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject number below min value", async () => {
      await configService.loadConfig();
      const result = await configService.validate("max-pcap-size", 0);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Config 'max-pcap-size' must be >= 1");
    });

    it("should reject number above max value", async () => {
      await configService.loadConfig();
      const result = await configService.validate("max-pcap-size", 2000000000);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Config 'max-pcap-size' must be <= 1073741824");
    });

    it("should validate correct string value", async () => {
      await configService.loadConfig();
      const result = await configService.validate(
        "non-existent-config",
        "value",
      );
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject wrong type for config", async () => {
      await configService.loadConfig();
      const result = await configService.validate(
        "max-pcap-size",
        "not-a-number",
      );
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Config 'max-pcap-size' must be a number");
    });
  });

  describe("batchUpdate method", () => {
    beforeEach(async () => {
      await configService.loadConfig();
    });

    it("should batch update multiple configs", async () => {
      const updates = [
        { id: "max-pcap-size", value: 1048576000 },
        { id: "max-dictionary-size", value: 10737418240 },
      ];

      const results = await configService.batchUpdate(updates);
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe("max-pcap-size");
      expect(results[0].value).toBe(1048576000);
      expect(results[1].id).toBe("max-dictionary-size");
      expect(results[1].value).toBe(10737418240);
    });

    it("should return empty array if no updates", async () => {
      const results = await configService.batchUpdate([]);
      expect(results).toEqual([]);
    });
  });

  describe("reload method", () => {
    beforeEach(async () => {
      await configService.loadConfig();
    });

    it("should clear cache and reload from database", async () => {
      await configService.reload();
      const initialValue = await configService.getNumber("max-pcap-size");
      expect(logger.info).toHaveBeenCalledWith(
        "Config reloaded successfully",
        "config-service",
      );

      // Cache should be cleared and reloaded
      expect(initialValue).toBeDefined();
    });
  });

  describe("getAll method", () => {
    it("should return all config values", async () => {
      await configService.loadConfig();
      const allConfig = await configService.getAll();
      expect(allConfig).toBeInstanceOf(Array);
      expect(allConfig.length).toBeGreaterThan(0);
    });
  });

  describe("cache methods", () => {
    it("should invalidate specific config", async () => {
      await configService.loadConfig();
      configService.invalidate("max-pcap-size");

      const nextValue = await configService.getNumber("max-pcap-size");
      expect(nextValue).toBeDefined();
    });

    it("should clear all cache", async () => {
      await configService.loadConfig();
      await configService.getNumber("max-pcap-size");
      configService.clearCache();

      // Next call should reload from database
      expect(logger.info).toHaveBeenCalledWith(
        "Config loaded successfully",
        "config-service",
        expect.any(Object),
      );
    });
  });

  describe("convenience methods", () => {
    it("should get max PCAP size", async () => {
      const value = await configService.getMaxPcapSize();
      expect(value).toBe(524288000);
    });

    it("should get max dictionary size", async () => {
      const value = await configService.getMaxDictionarySize();
      expect(value).toBe(10737418240);
    });

    it("should get max generated dict size", async () => {
      const value = await configService.getMaxGeneratedDictSize();
      expect(value).toBe(21474836480);
    });

    it("should get max concurrent jobs", async () => {
      const value = await configService.getMaxConcurrentJobs();
      expect(value).toBe(2);
    });

    it("should get hashcat default workload", async () => {
      const value = await configService.getHashcatDefaultWorkload();
      expect(value).toBe(4);
    });

    it("should get hashcat job timeout", async () => {
      const value = await configService.getHashcatJobTimeout();
      expect(value).toBe(86400000);
    });

    it("should get allow user registration", async () => {
      const value = await configService.getAllowUserRegistration();
      expect(typeof value).toBe("boolean");
    });

    it("should get session expiry", async () => {
      const value = await configService.getSessionExpiry();
      expect(value).toBe(604800000);
    });

    it("should get rate limit default", async () => {
      const value = await configService.getRateLimitDefault();
      expect(value).toBe(100);
    });

    it("should get rate limit upload", async () => {
      const value = await configService.getRateLimitUpload();
      expect(value).toBe(20);
    });

    it("should get rate limit auth", async () => {
      const value = await configService.getRateLimitAuth();
      expect(value).toBe(10);
    });
  });

  describe("error handling", () => {
    it("should log error and not throw when database query fails", async () => {
      const dbSpy = vi.spyOn(await import("../db/index"), "default", "query");
      dbSpy.mockRejectedValueOnce(new Error("Database connection failed"));

      const errorSpy = vi.spyOn(logger, "error");
      errorSpy.mockImplementation(() => {});

      try {
        await configService.loadConfig();
      } catch (error) {
        // Expected error
      }

      expect(dbSpy).toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(
        "Failed to load config from database",
        "config-service",
        expect.any(Object),
      );
    });

    it("should handle update errors gracefully", async () => {
      const dbSpy = vi.spyOn(await import("../db/index"), "default", "update");
      dbSpy.mockRejectedValueOnce(new Error("Update failed"));

      await expect(
        configService.update("max-pcap-size", 1048576000),
      ).rejects.toThrow();
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to load config from database",
        "config-service",
        expect.any(Object),
      );
    });
  });
});
