import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import { POST, GET } from "hono";
import { createMockContext } from "../helpers/test-helpers";

describe("Dictionary Management API", () => {
  const mockDb = {
    query: {
      dictionaries: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn().mockResolvedValue([{ id: "test-dict-1" }]),
    delete: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/dictionaries/:id/statistics", () => {
    it("should return dictionary statistics", async () => {
      mockDb.query.dictionaries.findFirst.mockResolvedValue({
        id: "test-dict-1",
        name: "Test Dictionary",
        filePath: "/tmp/test.txt",
        userId: "test-user-1",
      });

      const c = createMockContext({
        method: GET,
        path: "/api/dictionaries/test-dict-1/statistics",
        req: { param: vi.fn().mockReturnValue("test-dict-1") },
      });

      // Mock fs.readFile for entropy calculation
      const mockContent = "password\npassword\nadmin\n123456\npassword\ntest";
      vi.doMock("fs/promises", () => ({
        readFile: vi.fn().mockResolvedValue(mockContent),
      }));

      const result = await c.req.json();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.basic).toBeDefined();
      expect(result.data.basic.wordCount).toBeGreaterThan(0);
      expect(result.data.frequency).toBeDefined();
      expect(result.data.frequency.entropy).toBeGreaterThan(0);
    });

    it("should return 404 for non-existent dictionary", async () => {
      mockDb.query.dictionaries.findFirst.mockResolvedValue(null);

      const c = createMockContext({
        method: GET,
        path: "/api/dictionaries/non-existent/statistics",
        req: { param: vi.fn().mockReturnValue("non-existent") },
      });

      const result = await c.req.json();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Dictionary not found");
    });
  });

  describe("POST /api/dictionaries/merge", () => {
    it("should merge two dictionaries successfully", async () => {
      const dict1 = {
        id: "dict-1",
        filePath: "/tmp/dict1.txt",
        userId: "test-user-1",
      };
      const dict2 = {
        id: "dict-2",
        filePath: "/tmp/dict2.txt",
        userId: "test-user-1",
      };

      mockDb.query.dictionaries.findMany.mockResolvedValue([dict1, dict2]);
      mockDb.insert.mockResolvedValue([
        {
          id: "merged-dict-1",
          name: "Merged Dictionary",
          filename: "merged.txt",
          type: "generated",
          status: "ready",
          size: 2000,
          wordCount: 15,
          encoding: "utf-8",
          checksum: "merged123",
          filePath: "/tmp/merged.txt",
          userId: "test-user-1",
          processingConfig: {
            merge: {
              sourceDictionaries: ["dict-1", "dict-2"],
              originalWordCount: 15,
              finalWordCount: 10,
              removedDuplicates: 5,
              validationRules: undefined,
              mergedAt: expect.any(String),
            },
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const c = createMockContext({
        method: POST,
        path: "/api/dictionaries/merge",
        req: {
          valid: vi.fn().mockReturnValue({
            name: "Merged Dictionary",
            dictionaryIds: ["dict-1", "dict-2"],
            removeDuplicates: true,
          }),
          json: vi.fn().mockReturnValue({}),
          userId: "test-user-1",
        },
      });

      const result = await c.req.json();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.name).toBe("Merged Dictionary");
      expect(result.data.processingConfig.merge).toBeDefined();
    });

    it("should require at least 2 dictionaries", async () => {
      const c = createMockContext({
        method: POST,
        path: "/api/dictionaries/merge",
        req: {
          valid: vi.fn().mockReturnValue({
            name: "Test",
            dictionaryIds: ["dict-1"], // Only 1 dictionary
          }),
          userId: "test-user-1",
        },
      });

      const result = await c.req.json();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should not allow more than 10 dictionaries", async () => {
      const c = createMockContext({
        method: POST,
        path: "/api/dictionaries/merge",
        req: {
          valid: vi.fn().mockReturnValue({
            name: "Test",
            dictionaryIds: Array(11).fill("dict"), // 11 dictionaries
          }),
          userId: "test-user-1",
        },
      });

      const result = await c.req.json();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should apply validation rules", async () => {
      const dict1 = {
        id: "dict-1",
        filePath: "/tmp/dict1.txt",
        userId: "test-user-1",
      };

      mockDb.query.dictionaries.findMany.mockResolvedValue([dict1]);
      mockDb.insert.mockResolvedValue([
        {
          id: "merged-dict-1",
          name: "Merged Dictionary",
          processingConfig: {
            merge: {
              validationRules: {
                minLength: 8,
                maxLength: 16,
                excludePatterns: ["^admin", "^test"],
              },
            },
          },
        },
      ]);

      const c = createMockContext({
        method: POST,
        path: "/api/dictionaries/merge",
        req: {
          valid: vi.fn().mockReturnValue({
            name: "Test",
            dictionaryIds: ["dict-1"],
            removeDuplicates: false,
            validationRules: {
              minLength: 8,
              maxLength: 16,
              excludePatterns: ["^admin", "^test"],
            },
          }),
          userId: "test-user-1",
        },
      });

      const result = await c.req.json();

      expect(result.success).toBe(true);
      expect(result.data.processingConfig.merge.validationRules).toBeDefined();
    });
  });

  describe("POST /api/dictionaries/:id/validate", () => {
    it("should validate and clean dictionary", async () => {
      const dict1 = {
        id: "dict-1",
        filePath: "/tmp/dict1.txt",
        userId: "test-user-1",
      };

      mockDb.query.dictionaries.findFirst.mockResolvedValue(dict1);
      mockDb.insert.mockResolvedValue([
        {
          id: "validated-dict-1",
          name: "Test Dictionary (validated)",
          filename: "validated.txt",
          type: "generated",
          status: "ready",
          processingConfig: {
            validation: {
              sourceDictionaryId: "dict-1",
              originalWordCount: 10,
              validWordCount: 8,
              invalidWordCount: 2,
              duplicateWordCount: 2,
              validatedAt: expect.any(String),
            },
          },
        },
      ]);

      const c = createMockContext({
        method: POST,
        path: "/api/dictionaries/dict-1/validate",
        userId: "test-user-1",
      });

      const result = await c.req.json();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.name).toContain("validated");
      expect(result.data.processingConfig.validation).toBeDefined();
    });

    it("should return 404 for non-existent dictionary", async () => {
      mockDb.query.dictionaries.findFirst.mockResolvedValue(null);

      const c = createMockContext({
        method: POST,
        path: "/api/dictionaries/non-existent/validate",
        userId: "test-user-1",
      });

      const result = await c.req.json();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Dictionary not found");
    });

    it("should identify invalid words and duplicates", async () => {
      const dict1 = {
        id: "dict-1",
        filePath: "/tmp/dict1.txt",
        userId: "test-user-1",
      };

      mockDb.query.dictionaries.findFirst.mockResolvedValue(dict1);

      const c = createMockContext({
        method: POST,
        path: "/api/dictionaries/dict-1/validate",
        userId: "test-user-1",
      });

      const result = await c.req.json();

      expect(result.success).toBe(true);
      expect(result.data.processingConfig.validation).toBeDefined();
      expect(
        result.data.processingConfig.validation.invalidWordCount,
      ).toBeGreaterThan(0);
      expect(
        result.data.processingConfig.validation.duplicateWordCount,
      ).toBeGreaterThan(0);
    });
  });
});
