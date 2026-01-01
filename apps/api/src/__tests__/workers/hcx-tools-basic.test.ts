import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  vi,
} from "vitest";
import {
  convertToHC22000,
  extractPMKID,
  convertToHashcat,
  validateConversion,
  checkHCXToolsAvailability,
} from "../../lib/hcx-tools";
import * as fs from "fs/promises";
import { TestDataFactory } from "../../test/utils/test-data-factory";
import { fsMock, mockExecInstance } from "../../test/setup/unit-setup";

describe("HCX Tools Basic Functionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("HCX Tools Availability", () => {
    it("should detect when hcxpcapngtool is available", async () => {
      // Set up the global mock to return successful version
      mockExecInstance.mockImplementationOnce((command, callback) => {
        if (typeof command === 'string' && command.includes("--version")) {
          setTimeout(() => {
            callback(null, {
              stdout: "hcxpcapngtool v4.2.1",
              stderr: "",
            });
          }, 0);
        }
        return { kill: vi.fn() } as any;
      });

      const result = await checkHCXToolsAvailability();

      expect(result.available).toBe(true);
      expect(result.version).toContain("v4.2.1");
    });

    it("should handle when hcxpcapngtool is not found", async () => {
      // Set up the global mock to return error
      mockExecInstance.mockImplementationOnce((command, callback) => {
        if (typeof command === 'string' && command.includes("--version")) {
          setTimeout(() => {
            const error = new Error("Command not found: hcxpcapngtool");
            callback(error, { stdout: "", stderr: "hcxpcapngtool: not found" });
          }, 0);
        }
        return { kill: vi.fn() } as any;
      });

      const result = await checkHCXToolsAvailability();

      expect(result.available).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  describe("HC22000 Conversion", () => {
    it("should convert WPA networks to HC22000 format", async () => {
      const mockPCAP = Buffer.from("mock pcap with WPA networks");
      const mockHC22000 =
        "WPA*01*test_ssid*00*11:22:33:44:55*test_pmkid\nWPA*01*test_ssid*00*aa:bb:cc:dd:ee*test_pmkid";
      const mockOutputFile = "/tmp/test.hc22000";

      fsMock.readFile.mockResolvedValueOnce(mockPCAP);
      fsMock.writeFile.mockResolvedValueOnce(undefined);

      const result = await convertToHC22000("test.pcap", mockOutputFile);

      expect(fsMock.readFile).toHaveBeenCalledWith("test.pcap");
      expect(fsMock.writeFile).toHaveBeenCalledWith(
        mockOutputFile,
        mockHC22000,
      );
      expect(result.success).toBe(true);
      expect(result.networksFound).toBe(2);
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it("should handle conversion errors gracefully", async () => {
      fsMock.readFile.mockRejectedValueOnce(new Error("File not found"));

      const result = await convertToHC22000(
        "missing.pcap",
        "/tmp/output.hc22000",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("File not found");
    });
  });

  describe("PMKID Extraction", () => {
    it("should extract PMKIDs from beacon frames", async () => {
      const mockPCAP = Buffer.from("mock pcap with beacons");
      const mockPMKID =
        "test_ssid*00*11:22:33:44:55*b4a5c8a6d9f2a5d8bb590056b2241c\ntest_ssid*00*aa:bb:cc:dd:ee*b4a5c8a6d9f2a5d8bb590056b2241c";
      const mockOutputFile = "/tmp/test.pmkid";

      fsMock.readFile.mockResolvedValueOnce(mockPCAP);
      fsMock.writeFile.mockResolvedValueOnce(undefined);

      mockExecInstance.mockImplementationOnce((command, callback) => {
        if (typeof command === 'string' && command.includes("hcxpcapngtool")) {
          setTimeout(() => {
            callback(null, {
              stdout: `Extracted ${mockPMKID.split("\n").length} PMKIDs`,
              stderr: "",
            });
          }, 200);
        }
        return { kill: vi.fn() } as any;
      });

      const result = await extractPMKID("beacon.pcap", mockOutputFile);

      expect(fsMock.readFile).toHaveBeenCalledWith("beacon.pcap");
      expect(fsMock.writeFile).toHaveBeenCalledWith(mockOutputFile, mockPMKID);
      expect(result.success).toBe(true);
      expect(result.pmkidsFound).toBe(2);
      expect(result.processingTime).toBeGreaterThan(0);
    });
  });

  describe("Hashcat Format Conversion", () => {
    it("should convert HC22000 to hashcat-compatible format", async () => {
      const mockHC22000 = "WPA*01*test_ssid*00*11:22:33:44:55*test_pmkid";
      const mockHashcatFormat =
        "test_ssid*00*11:22:33:44:55*test_pmkid\nWPA*01*test_ssid*00*aa:bb:cc:dd:ee*test_pmkid";
      const mockOutputFile = "/tmp/hashcat.txt";

      fsMock.readFile.mockResolvedValueOnce(mockHC22000);
      fsMock.writeFile.mockResolvedValueOnce(undefined);

      mockExecInstance.mockImplementationOnce((command, callback) => {
        if (typeof command === 'string' && command.includes("hcxpcapngtool")) {
          setTimeout(() => {
            callback(null, {
              stdout: "Successfully formatted file for hashcat",
              stderr: "",
            });
          }, 100);
        }
        return { kill: vi.fn() } as any;
      });

      const result = await convertToHashcat("test.hc22000", mockOutputFile);

      expect(fsMock.readFile).toHaveBeenCalledWith("test.hc22000");
      expect(fsMock.writeFile).toHaveBeenCalledWith(
        mockOutputFile,
        mockHashcatFormat,
      );
      expect(result.success).toBe(true);
      expect(result.hashesConverted).toBe(2);
      expect(result.processingTime).toBeGreaterThan(0);
    });
  });

  describe("Format Validation", () => {
    it("should validate correctly formatted HC22000 files", async () => {
      const validHC22000 = [
        "WPA*01*ssid1*00*11:22:33:44:55*password",
        "WPA*01*ssid2*00*22:33:44:55*password",
        "WPA*01*ssid1*00*22:33:44:55*a:b:c:d:e:f:password",
      ];

      const mockValidFile = "/tmp/valid.hc22000";

      // Mock access to resolve for each file
      fsMock.access.mockResolvedValue(undefined);

      // Mock readFile to return each line for each validation call
      validHC22000.forEach((line) => {
        fsMock.readFile.mockResolvedValueOnce(line);
      });

      const results = await Promise.all(
        validHC22000.map((line, index) =>
          validateConversion(`${mockValidFile}-${index}`),
        ),
      );

      expect(results.every((result) => result.isValid)).toBe(true);
      expect(results.every((result) => result.errors.length === 0)).toBe(true);
      expect(results.every((result) => result.format === "HC22000")).toBe(true);
    });

    it("should detect invalid format issues", async () => {
      const invalidHC22000 = [
        "invalid format without hash",
        "hash:invalid_hex_format",
        "WPA*01missing_hash*00*bssid*password",
      ];

      const mockInvalidFile = "/tmp/invalid.hc22000";

      // Mock access to resolve for each file
      fsMock.access.mockResolvedValue(undefined);

      // Mock readFile to return each line for each validation call
      invalidHC22000.forEach((line) => {
        fsMock.readFile.mockResolvedValueOnce(line);
      });

      const results = await Promise.all(
        invalidHC22000.map((line, index) =>
          validateConversion(`${mockInvalidFile}-${index}`),
        ),
      );

      expect(results.some((result) => !result.isValid)).toBe(true);
      expect(results.some((result) => result.errors.length > 0)).toBe(true);
    });
  });

  describe("Performance Tests", () => {
    it("should process large PCAP files efficiently", async () => {
      // Mock large PCAP (10MB)
      const largePCAP = Buffer.alloc(10 * 1024 * 1024);
      fsMock.readFile.mockResolvedValueOnce(largePCAP);
      fsMock.writeFile.mockResolvedValueOnce(undefined);
      fsMock.stat.mockResolvedValueOnce({ size: largePCAP.length } as any);

      const start1 = Date.now();
      await convertToHC22000("large.pcap", "/tmp/large.hc22000");
      const largeTime = Date.now() - start1;

      // Mock medium PCAP (1MB)
      const mediumPCAP = Buffer.alloc(1 * 1024 * 1024);
      fsMock.readFile.mockResolvedValueOnce(mediumPCAP);
      fsMock.writeFile.mockResolvedValueOnce(undefined);
      fsMock.stat.mockResolvedValueOnce({ size: mediumPCAP.length } as any);

      const start2 = Date.now();
      await convertToHC22000("medium.pcap", "/tmp/medium.hc22000");
      const mediumTime = Date.now() - start2;

      // Mock small PCAP (100KB)
      const smallPCAP = Buffer.alloc(100 * 1024);
      fsMock.readFile.mockResolvedValueOnce(smallPCAP);
      fsMock.writeFile.mockResolvedValueOnce(undefined);
      fsMock.stat.mockResolvedValueOnce({ size: smallPCAP.length } as any);

      const start3 = Date.now();
      await convertToHC22000("small.pcap", "/tmp/small.hc22000");
      const smallTime = Date.now() - start3;

      // All should complete successfully (processing time > 0)
      expect(largeTime).toBeGreaterThan(0);
      expect(mediumTime).toBeGreaterThan(0);
      expect(smallTime).toBeGreaterThan(0);

      // Total processing should be reasonable
      const totalTime = largeTime + mediumTime + smallTime;
      expect(totalTime).toBeLessThan(5000); // Under 5 seconds for mocked operations
    });
  });
});
