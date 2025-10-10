import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Environment Validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  describe('Production Secret Validation', () => {
    it('should reject weak secrets in production mode', async () => {
      process.env.NODE_ENV = 'production';
      process.env.BETTER_AUTH_SECRET = 'dev-secret-key-local-development-only-change-in-production';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';

      await expect(async () => {
        await import('../../../config/env.js');
      }).rejects.toThrow();
    });

    it('should reject default secret "secret" in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.BETTER_AUTH_SECRET = 'secret';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';

      await expect(async () => {
        await import('../../../config/env.js');
      }).rejects.toThrow();
    });

    it('should reject secret "password" in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.BETTER_AUTH_SECRET = 'password';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';

      await expect(async () => {
        await import('../../../config/env.js');
      }).rejects.toThrow();
    });

    it('should accept strong 32+ character secret in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.BETTER_AUTH_SECRET = 'strong-random-secret-generated-with-openssl-rand-base64';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';

      const { env } = await import('../../../config/env.js');
      expect(env.BETTER_AUTH_SECRET).toBe('strong-random-secret-generated-with-openssl-rand-base64');
    });

    it('should accept weak secrets in development mode', async () => {
      process.env.NODE_ENV = 'development';
      process.env.BETTER_AUTH_SECRET = 'dev-secret-key-local-development-only-change-in-production';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';

      const { env } = await import('../../../config/env.js');
      expect(env.BETTER_AUTH_SECRET).toBe('dev-secret-key-local-development-only-change-in-production');
    });
  });

  describe('Secret Length Validation', () => {
    it('should reject secrets shorter than 32 characters', async () => {
      process.env.NODE_ENV = 'development';
      process.env.BETTER_AUTH_SECRET = 'short-secret';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';

      await expect(async () => {
        await import('../../../config/env.js');
      }).rejects.toThrow();
    });

    it('should accept exactly 32 character secrets', async () => {
      process.env.NODE_ENV = 'development';
      process.env.BETTER_AUTH_SECRET = '12345678901234567890123456789012'; // Exactly 32 chars
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';

      const { env } = await import('../../../config/env.js');
      expect(env.BETTER_AUTH_SECRET).toBe('12345678901234567890123456789012');
    });

    it('should accept secrets longer than 32 characters', async () => {
      process.env.NODE_ENV = 'development';
      process.env.BETTER_AUTH_SECRET = 'very-long-secret-key-generated-with-openssl-rand-base64-command-for-security';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';

      const { env } = await import('../../../config/env.js');
      expect(env.BETTER_AUTH_SECRET.length).toBeGreaterThan(32);
    });
  });

  describe('Database URL Validation', () => {
    it('should require DATABASE_URL to be set', async () => {
      process.env.NODE_ENV = 'development';
      process.env.BETTER_AUTH_SECRET = 'test-secret-key-minimum-32-chars-long';
      process.env.DATABASE_URL = '';

      await expect(async () => {
        await import('../../../config/env.js');
      }).rejects.toThrow();
    });

    it('should accept postgresql:// protocol', async () => {
      process.env.NODE_ENV = 'development';
      process.env.BETTER_AUTH_SECRET = 'test-secret-key-minimum-32-chars-long';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/autopwn';

      const { env } = await import('../../../config/env.js');
      expect(env.DATABASE_URL).toContain('postgresql://');
    });

    it('should accept postgres:// protocol', async () => {
      process.env.NODE_ENV = 'development';
      process.env.BETTER_AUTH_SECRET = 'test-secret-key-minimum-32-chars-long';
      process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/autopwn';

      const { env } = await import('../../../config/env.js');
      expect(env.DATABASE_URL).toContain('postgres://');
    });

    it('should reject non-PostgreSQL connection strings', async () => {
      process.env.NODE_ENV = 'development';
      process.env.BETTER_AUTH_SECRET = 'test-secret-key-minimum-32-chars-long';
      process.env.DATABASE_URL = 'mysql://user:pass@localhost:3306/autopwn';

      await expect(async () => {
        await import('../../../config/env.js');
      }).rejects.toThrow();
    });
  });

  describe('Default Values', () => {
    it('should use default values when not specified', async () => {
      process.env.NODE_ENV = 'development';
      process.env.BETTER_AUTH_SECRET = 'test-secret-key-minimum-32-chars-long';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/autopwn';

      // Clear optional env vars
      delete process.env.PORT;
      delete process.env.PCAPS_PATH;
      delete process.env.DICTIONARIES_PATH;
      delete process.env.JOBS_PATH;
      delete process.env.HASHCAT_DEVICE_TYPE;
      delete process.env.JOB_TIMEOUT_HOURS;

      const { env } = await import('../../../config/env.js');

      expect(env.PORT).toBe(3001);
      expect(env.PCAPS_PATH).toBe('./volumes/pcaps');
      expect(env.DICTIONARIES_PATH).toBe('./volumes/dictionaries');
      expect(env.JOBS_PATH).toBe('./volumes/jobs');
      expect(env.HASHCAT_DEVICE_TYPE).toBe('cpu');
      expect(env.JOB_TIMEOUT_HOURS).toBe(24);
    });

    it('should allow overriding default values', async () => {
      process.env.NODE_ENV = 'development';
      process.env.BETTER_AUTH_SECRET = 'test-secret-key-minimum-32-chars-long';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/autopwn';
      process.env.PORT = '4000';
      process.env.HASHCAT_DEVICE_TYPE = 'nvidia';
      process.env.JOB_TIMEOUT_HOURS = '48';

      const { env } = await import('../../../config/env.js');

      expect(env.PORT).toBe(4000);
      expect(env.HASHCAT_DEVICE_TYPE).toBe('nvidia');
      expect(env.JOB_TIMEOUT_HOURS).toBe(48);
    });
  });

  describe('Job Timeout Configuration', () => {
    it('should accept positive timeout values', async () => {
      process.env.NODE_ENV = 'development';
      process.env.BETTER_AUTH_SECRET = 'test-secret-key-minimum-32-chars-long';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/autopwn';
      process.env.JOB_TIMEOUT_HOURS = '72';

      const { env } = await import('../../../config/env.js');
      expect(env.JOB_TIMEOUT_HOURS).toBe(72);
    });

    it('should reject negative timeout values', async () => {
      process.env.NODE_ENV = 'development';
      process.env.BETTER_AUTH_SECRET = 'test-secret-key-minimum-32-chars-long';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/autopwn';
      process.env.JOB_TIMEOUT_HOURS = '-1';

      await expect(async () => {
        await import('../../../config/env.js');
      }).rejects.toThrow();
    });

    it('should reject zero timeout values', async () => {
      process.env.NODE_ENV = 'development';
      process.env.BETTER_AUTH_SECRET = 'test-secret-key-minimum-32-chars-long';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/autopwn';
      process.env.JOB_TIMEOUT_HOURS = '0';

      await expect(async () => {
        await import('../../../config/env.js');
      }).rejects.toThrow();
    });
  });

  describe('GPU Configuration', () => {
    it('should accept valid GPU types', async () => {
      const gpuTypes = ['cpu', 'nvidia', 'amd', 'intel'];

      for (const gpuType of gpuTypes) {
        vi.resetModules();
        process.env = { ...originalEnv };
        process.env.NODE_ENV = 'development';
        process.env.BETTER_AUTH_SECRET = 'test-secret-key-minimum-32-chars-long';
        process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/autopwn';
        process.env.HASHCAT_DEVICE_TYPE = gpuType;

        const { env } = await import('../../../config/env.js');
        expect(env.HASHCAT_DEVICE_TYPE).toBe(gpuType);
      }
    });

    it('should reject invalid GPU types', async () => {
      process.env.NODE_ENV = 'development';
      process.env.BETTER_AUTH_SECRET = 'test-secret-key-minimum-32-chars-long';
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/autopwn';
      process.env.HASHCAT_DEVICE_TYPE = 'invalid-gpu';

      await expect(async () => {
        await import('../../../config/env.js');
      }).rejects.toThrow();
    });
  });
});
