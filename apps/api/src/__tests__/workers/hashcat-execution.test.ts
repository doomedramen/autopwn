import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TestDataFactory } from "../../test/utils/test-data-factory";

// Mock the hashcat module at the module level
vi.mock("../../workers/hashcat", () => ({
  checkHashcatAvailability: vi.fn(),
  runHashcatAttack: vi.fn(),
  parseHashcatOutput: vi.fn(),
}));

import {
  runHashcatAttack,
  parseHashcatOutput,
  checkHashcatAvailability,
} from "../../workers/hashcat";

describe("Hashcat Execution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Hashcat Availability Check", () => {
    it("should detect hashcat availability", async () => {
      (checkHashcatAvailability as any).mockResolvedValue({
        available: true,
        version: "hashcat v6.2.6",
        supportedModes: true,
        supportedAttackModes: {
          pmkid: true,
          handshake: true,
        },
      });

      const result = await checkHashcatAvailability();

      expect(result.available).toBe(true);
      expect(result.version).toBe("hashcat v6.2.6");
    });

    it("should handle hashcat not available", async () => {
      (checkHashcatAvailability as any).mockResolvedValue({
        available: false,
        error: "hashcat: command not found",
        supportedModes: false,
        supportedAttackModes: {
          pmkid: false,
          handshake: false,
        },
      });

      const result = await checkHashcatAvailability();

      expect(result.available).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  describe("Hashcat Attack Execution", () => {
    it("should execute successful hashcat attack", async () => {
      (runHashcatAttack as any).mockResolvedValue({
        success: true,
        passwordsFound: 2,
        passwords: ["password123", "admin123"],
        jobId: "test-job-1",
      });

      const jobData = TestDataFactory.createJob();
      const result = await runHashcatAttack({
        jobId: jobData.id,
        networkId: "test-network-1",
        dictionaryId: "dict-1",
        handshakePath: "/tmp/test.hc22000",
        dictionaryPath: "/tmp/wordlist.txt",
        attackMode: "handshake",
        userId: "test-user-1",
      });

      expect(result.success).toBe(true);
      expect(result.passwordsFound).toBe(2);
      expect(result.passwords).toEqual(["password123", "admin123"]);
    });

    it("should handle hashcat execution with no results", async () => {
      (runHashcatAttack as any).mockResolvedValue({
        success: true,
        passwordsFound: 0,
        passwords: [],
        message: "No passwords found",
        jobId: "test-job-2",
      });

      const jobData = TestDataFactory.createJob();
      const result = await runHashcatAttack({
        jobId: jobData.id,
        networkId: "test-network-2",
        dictionaryId: "dict-2",
        handshakePath: "/tmp/test.hc22000",
        dictionaryPath: "/tmp/wordlist.txt",
        attackMode: "handshake",
        userId: "test-user-2",
      });

      expect(result.success).toBe(true);
      expect(result.passwordsFound).toBe(0);
      expect(result.message).toContain("No passwords found");
    });
  });

  describe("Hashcat Output Parsing", () => {
    it("should parse successful hashcat output", async () => {
      (parseHashcatOutput as any).mockResolvedValue({
        success: true,
        cracked: 2,
        passwords: ["password1", "password2"],
        total: 2,
      });

      const result = await parseHashcatOutput("test-output.txt", "test-job-1");

      expect(result.success).toBe(true);
      expect(result.cracked).toBe(2);
      expect(result.total).toBe(2);
      expect(result.passwords).toEqual(["password1", "password2"]);
    });

    it("should parse hashcat output with no cracks", async () => {
      (parseHashcatOutput as any).mockResolvedValue({
        success: true,
        cracked: 0,
        passwords: [],
        total: 10,
      });

      const result = await parseHashcatOutput(
        "test-output-empty.txt",
        "test-job-2",
      );

      expect(result.success).toBe(true);
      expect(result.cracked).toBe(0);
      expect(result.passwords).toEqual([]);
    });

    it("should handle corrupted output file", async () => {
      (parseHashcatOutput as any).mockResolvedValue({
        success: true,
        cracked: 0,
        passwords: [],
        total: 0,
      });

      const result = await parseHashcatOutput(
        "test-output-corrupted.txt",
        "test-job-3",
      );

      expect(result.success).toBe(true);
      expect(result.cracked).toBe(0);
      expect(result.passwords).toEqual([]);
    });

    it("should handle missing output file", async () => {
      (parseHashcatOutput as any).mockResolvedValue({
        success: true,
        cracked: 0,
        passwords: [],
        total: 0,
      });

      const result = await parseHashcatOutput(
        "test-output-missing.txt",
        "test-job-4",
      );

      expect(result.success).toBe(true);
      expect(result.cracked).toBe(0);
      expect(result.passwords).toEqual([]);
    });
  });
});
