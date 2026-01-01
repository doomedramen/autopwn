import { describe, test, expect, beforeAll, afterAll } from "vitest";
import {
  setupTestDB,
  cleanupTestDB,
  createTestUser,
  getAuthHeaders,
} from "../helpers/test-helpers";
import crypto from "crypto";

// Simple test to verify test app works
describe("Dictionary Management API - Infrastructure Test", () => {
  test('should create test user', async () => {
    console.log("Creating test user...");
    const user = await createTestUser({ role: "user" });
    console.log("Test user created:", user);
    expect(user).toBeDefined();
    expect(user.email).toBeDefined();
  });

  test('should get auth headers', async () => {
    console.log("Getting auth headers...");
    const auth = await getAuthHeaders("test@example.com", "test-password-123");
    console.log("Auth headers:", auth);
    expect(auth).toBeDefined();
    expect(auth.Authorization).toBeDefined();
  });

  test('test app should respond to request', async () => {
    console.log("Testing test app response...");
    const response = await testApp.request("/health", {
      method: "GET",
    headers: {
        "X-Test-Auth": "true",
      "X-Test-Email": "test@example.com",
        "X-Test-UserId": "test-user-id",
      }
    });

    console.log("Response status:", response.status);
    console.log("Response body:", await response.text());

    expect(response.status).toBe(200);
  });
});

// Main test file
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import {
  setupTestDB,
  cleanupTestDB,
  createTestUser,
  getAuthHeaders,
} from "../helpers/test-helpers";
import crypto from "crypto";

// Import test-only app instance to avoid full app initialization
let testApp: any;
import("../../test-app").then((module) => {
  testApp = (module as any).default;
});

describe("Dictionary Management API", () => {
  let userAuth: Record<string, string>;
  let testUser: any;
  let dictionaryIds: string[] = [];

  beforeAll(async () => {
    await setupTestDB();
    testUser = await createTestUser({ role: "user" });
    userAuth = await getAuthHeaders(testUser.email, "password123");
  });

describe("Dictionary Management API", () => {
  let userAuth: Record<string, string>;
  let testUser: any;
  let dictionaryIds: string[] = [];

  beforeAll(async () => {
    // Create test user with mock auth - skip password issues for now
    testUser = await createTestUser({ role: "user" });
    userAuth = {
      Authorization: `Bearer test-mock-token-${testUser.id}`,
      "X-Test-Auth": "true",
      "X-Test-Email": testUser.email,
      "X-Test-UserId": testUser.id,
    };

    // Create test dictionaries for merging
    for (let i = 1; i <= 3; i++) {
      const formData = new FormData();
      const content = `password${i}\ntest${i}\nadmin${i}\nroot${i}\nuser${i}`;
      const blob = new Blob([content], { type: "text/plain" });
      formData.append("file", blob, `dict${i}.txt`);
      formData.append("name", `Test Dictionary ${i}`);

      const response = await app.request("/api/dictionaries/upload", {
        method: "POST",
        headers: {
          ...userAuth,
          Authorization: userAuth.authorization,
        },
        body: formData,
      });

      const data = await response.json();
      dictionaryIds.push(data.data.id);
    }
  });

  afterAll(async () => {
    await cleanupTestDB();
  });

  describe("GET /api/dictionaries/:id/statistics", () => {
    test("should return dictionary statistics", async () => {
      const dictionaryId = dictionaryIds[0];

      const response = await app.request(
        `/api/dictionaries/${dictionaryId}/statistics`,
        {
          headers: {
            ...userAuth,
            Authorization: userAuth.authorization,
          },
        },
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.basic).toBeDefined();
      expect(data.data.basic.wordCount).toBeGreaterThan(0);
      expect(data.data.basic.uniqueWords).toBeGreaterThan(0);
      expect(data.data.basic.averageLength).toBeGreaterThan(0);
      expect(data.data.frequency).toBeDefined();
      expect(data.data.frequency.entropy).toBeGreaterThanOrEqual(0);
      expect(data.data.frequency.topWords).toBeInstanceOf(Array);
      expect(data.data.frequency.lengthDistribution).toBeInstanceOf(Array);
      expect(data.data.size).toBeDefined();
      expect(data.data.size.bytes).toBeGreaterThan(0);
    });

    test("should return 404 for non-existent dictionary", async () => {
      const fakeId = crypto.randomUUID();

      const response = await app.request(
        `/api/dictionaries/${fakeId}/statistics`,
        {
          headers: {
            ...userAuth,
            Authorization: userAuth.authorization,
          },
        },
      );

      expect(response.status).toBe(404);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toBe("Dictionary not found");
    });

    test("should return 403 for dictionary owned by another user", async () => {
      // Create another user
      const otherUser = await createTestUser({ role: "user" });
      const otherAuth = await getAuthHeaders(otherUser.email, "password123");

      const response = await app.request(
        `/api/dictionaries/${dictionaryIds[0]}/statistics`,
        {
          headers: {
            ...otherAuth,
            Authorization: otherAuth.authorization,
          },
        },
      );

      expect(response.status).toBe(403);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toBe("Access denied");
    });

    test("should calculate correct entropy for dictionary with duplicate words", async () => {
      // Create dictionary with duplicates
      const formData = new FormData();
      const content = "password\npassword\npassword\nadmin\nadmin\nroot";
      const blob = new Blob([content], { type: "text/plain" });
      formData.append("file", blob, "entropy-test.txt");
      formData.append("name", "Entropy Test");

      const uploadResponse = await app.request("/api/dictionaries/upload", {
        method: "POST",
        headers: {
          ...userAuth,
          Authorization: userAuth.authorization,
        },
        body: formData,
      });

      const uploadData = await uploadResponse.json();
      const dictId = uploadData.data.id;

      const response = await app.request(
        `/api/dictionaries/${dictId}/statistics`,
        {
          headers: {
            ...userAuth,
            Authorization: userAuth.authorization,
          },
        },
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.data.basic.wordCount).toBe(6);
      expect(data.data.basic.uniqueWords).toBe(3);
      expect(data.data.frequency.entropy).toBeGreaterThan(0);
      expect(data.data.frequency.entropy).toBeLessThan(Math.log2(3));
    });
  });

  describe("POST /api/dictionaries/merge", () => {
    test("should merge two dictionaries successfully", async () => {
      const response = await app.request("/api/dictionaries/merge", {
        method: "POST",
        headers: {
          ...userAuth,
          Authorization: userAuth.authorization,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Merged Dictionary",
          dictionaryIds: [dictionaryIds[0], dictionaryIds[1]],
          removeDuplicates: true,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.name).toBe("Merged Dictionary");
      expect(data.data.type).toBe("generated");
      expect(data.data.status).toBe("ready");
      expect(data.data.processingConfig).toBeDefined();
      expect(data.data.processingConfig.merge).toBeDefined();
      expect(data.data.processingConfig.merge.sourceDictionaries).toEqual(
        expect.arrayContaining([dictionaryIds[0], dictionaryIds[1]]),
      );
      expect(
        data.data.processingConfig.merge.removedDuplicates,
      ).toBeGreaterThan(0);
      expect(data.data.processingConfig.merge.mergedAt).toBeDefined();
    });

    test("should reject merge with less than 2 dictionaries", async () => {
      const response = await app.request("/api/dictionaries/merge", {
        method: "POST",
        headers: {
          ...userAuth,
          Authorization: userAuth.authorization,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Test",
          dictionaryIds: [dictionaryIds[0]],
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toContain("dictionaries");
    });

    test("should reject merge with more than 10 dictionaries", async () => {
      const tooManyIds = Array(11).fill(crypto.randomUUID());

      const response = await app.request("/api/dictionaries/merge", {
        method: "POST",
        headers: {
          ...userAuth,
          Authorization: userAuth.authorization,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Test",
          dictionaryIds: tooManyIds,
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();

      expect(data.success).toBe(false);
    });

    test("should apply validation rules during merge", async () => {
      const response = await app.request("/api/dictionaries/merge", {
        method: "POST",
        headers: {
          ...userAuth,
          Authorization: userAuth.authorization,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Validated Merged Dictionary",
          dictionaryIds: [dictionaryIds[0], dictionaryIds[1]],
          removeDuplicates: false,
          validationRules: {
            minLength: 5,
            maxLength: 10,
            excludePatterns: ["^admin", "^root"],
          },
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.processingConfig.merge.validationRules).toBeDefined();
      expect(data.data.processingConfig.merge.validationRules.minLength).toBe(
        5,
      );
      expect(data.data.processingConfig.merge.validationRules.maxLength).toBe(
        10,
      );
      expect(
        data.data.processingConfig.merge.validationRules.excludePatterns,
      ).toContain("^admin");
    });

    test("should return 404 for non-existent dictionaries", async () => {
      const response = await app.request("/api/dictionaries/merge", {
        method: "POST",
        headers: {
          ...userAuth,
          Authorization: userAuth.authorization,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Test",
          dictionaryIds: [crypto.randomUUID(), crypto.randomUUID()],
        }),
      });

      expect(response.status).toBe(404);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toContain("not found");
    });

    test("should prevent merging dictionaries owned by other users", async () => {
      // Create another user
      const otherUser = await createTestUser({ role: "user" });
      const otherAuth = await getAuthHeaders(otherUser.email, "password123");

      // Try to merge this user's dictionaries using another user's auth
      const response = await app.request("/api/dictionaries/merge", {
        method: "POST",
        headers: {
          ...otherAuth,
          Authorization: otherAuth.authorization,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Test",
          dictionaryIds: [dictionaryIds[0], dictionaryIds[1]],
        }),
      });

      expect(response.status).toBe(404);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toContain("not found");
    });

    test("should remove duplicates when specified", async () => {
      // Create two dictionaries with overlapping words
      const formData1 = new FormData();
      const content1 = "password\ntest\nadmin\nroot";
      const blob1 = new Blob([content1], { type: "text/plain" });
      formData1.append("file", blob1, "overlap1.txt");

      const upload1 = await app.request("/api/dictionaries/upload", {
        method: "POST",
        headers: {
          ...userAuth,
          Authorization: userAuth.authorization,
        },
        body: formData1,
      });

      const data1 = await upload1.json();
      const dictId1 = data1.data.id;

      const formData2 = new FormData();
      const content2 = "password\ntest\nuser\nguest";
      const blob2 = new Blob([content2], { type: "text/plain" });
      formData2.append("file", blob2, "overlap2.txt");

      const upload2 = await app.request("/api/dictionaries/upload", {
        method: "POST",
        headers: {
          ...userAuth,
          Authorization: userAuth.authorization,
        },
        body: formData2,
      });

      const data2 = await upload2.json();
      const dictId2 = data2.data.id;

      // Merge with deduplication
      const mergeResponse = await app.request("/api/dictionaries/merge", {
        method: "POST",
        headers: {
          ...userAuth,
          Authorization: userAuth.authorization,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Deduplicated Dictionary",
          dictionaryIds: [dictId1, dictId2],
          removeDuplicates: true,
        }),
      });

      expect(mergeResponse.status).toBe(200);
      const mergeData = await mergeResponse.json();

      // Should have 6 unique words (password, test, admin, root, user, guest)
      expect(mergeData.data.wordCount).toBe(6);
      expect(mergeData.data.processingConfig.merge.removedDuplicates).toBe(2);
    });
  });

  describe("POST /api/dictionaries/:id/validate", () => {
    test("should validate and clean dictionary", async () => {
      // Create dictionary with invalid characters and duplicates
      const formData = new FormData();
      const content =
        "password\npassword\nadmin\nadmin\nroot\n\n  \npassword1\ntest@#$\nuser123";
      const blob = new Blob([content], { type: "text/plain" });
      formData.append("file", blob, "validate-test.txt");
      formData.append("name", "Validation Test");

      const uploadResponse = await app.request("/api/dictionaries/upload", {
        method: "POST",
        headers: {
          ...userAuth,
          Authorization: userAuth.authorization,
        },
        body: formData,
      });

      const uploadData = await uploadResponse.json();
      const dictionaryId = uploadData.data.id;

      const response = await app.request(
        `/api/dictionaries/${dictionaryId}/validate`,
        {
          method: "POST",
          headers: {
            ...userAuth,
            Authorization: userAuth.authorization,
          },
        },
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.name).toContain("validated");
      expect(data.data.type).toBe("generated");
      expect(data.data.status).toBe("ready");
      expect(data.data.processingConfig.validation).toBeDefined();
      expect(data.data.processingConfig.validation.sourceDictionaryId).toBe(
        dictionaryId,
      );
      expect(
        data.data.processingConfig.validation.validWordCount,
      ).toBeGreaterThan(0);
      expect(
        data.data.processingConfig.validation.invalidWordCount,
      ).toBeGreaterThanOrEqual(0);
      expect(
        data.data.processingConfig.validation.duplicateWordCount,
      ).toBeGreaterThanOrEqual(0);
      expect(data.data.processingConfig.validation.validatedAt).toBeDefined();

      expect(data.stats).toBeDefined();
      expect(data.stats.originalWords).toBeGreaterThan(data.stats.validWords);
    });

    test("should return 404 for non-existent dictionary", async () => {
      const fakeId = crypto.randomUUID();

      const response = await app.request(
        `/api/dictionaries/${fakeId}/validate`,
        {
          method: "POST",
          headers: {
            ...userAuth,
            Authorization: userAuth.authorization,
          },
        },
      );

      expect(response.status).toBe(404);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toBe("Dictionary not found");
    });

    test("should return 403 for dictionary owned by another user", async () => {
      // Create another user
      const otherUser = await createTestUser({ role: "user" });
      const otherAuth = await getAuthHeaders(otherUser.email, "password123");

      const response = await app.request(
        `/api/dictionaries/${dictionaryIds[0]}/validate`,
        {
          method: "POST",
          headers: {
            ...otherAuth,
            Authorization: otherAuth.authorization,
          },
        },
      );

      expect(response.status).toBe(403);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toBe("Access denied");
    });

    test("should identify invalid words and duplicates correctly", async () => {
      // Create dictionary with specific test cases
      const formData = new FormData();
      const content =
        "password\npassword\nadmin\nadmin\nroot\nuser\n$invalid@\n#special\nmore$chars";
      const blob = new Blob([content], { type: "text/plain" });
      formData.append("file", blob, "validation-test.txt");
      formData.append("name", "Validation Test Case");

      const uploadResponse = await app.request("/api/dictionaries/upload", {
        method: "POST",
        headers: {
          ...userAuth,
          Authorization: userAuth.authorization,
        },
        body: formData,
      });

      const uploadData = await uploadResponse.json();
      const dictionaryId = uploadData.data.id;

      const response = await app.request(
        `/api/dictionaries/${dictionaryId}/validate`,
        {
          method: "POST",
          headers: {
            ...userAuth,
            Authorization: userAuth.authorization,
          },
        },
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should have duplicates
      expect(
        data.data.processingConfig.validation.duplicateWordCount,
      ).toBeGreaterThan(0);

      // Some words should be valid (password, admin, root, user)
      expect(
        data.data.processingConfig.validation.validWordCount,
      ).toBeGreaterThan(0);

      // Stats should reflect cleaning
      expect(data.stats.validWords).toBeLessThan(data.stats.originalWords);
    });

    test("should create new dictionary record with validated content", async () => {
      const formData = new FormData();
      const content = "password\ntest123\nadmin";
      const blob = new Blob([content], { type: "text/plain" });
      formData.append("file", blob, "clean-dict.txt");
      formData.append("name", "Clean Dictionary");

      const uploadResponse = await app.request("/api/dictionaries/upload", {
        method: "POST",
        headers: {
          ...userAuth,
          Authorization: userAuth.authorization,
        },
        body: formData,
      });

      const uploadData = await uploadResponse.json();
      const sourceDictId = uploadData.data.id;

      const validateResponse = await app.request(
        `/api/dictionaries/${sourceDictId}/validate`,
        {
          method: "POST",
          headers: {
            ...userAuth,
            Authorization: userAuth.authorization,
          },
        },
      );

      const validateData = await validateResponse.json();
      const validatedDictId = validateData.data.id;

      // Verify validated dictionary is accessible
      const getResponse = await app.request(
        `/api/dictionaries/${validatedDictId}`,
        {
          headers: {
            ...userAuth,
            Authorization: userAuth.authorization,
          },
        },
      );

      expect(getResponse.status).toBe(200);
      const getData = await getResponse.json();

      expect(getData.data.id).toBe(validatedDictId);
      expect(getData.data.name).toContain("validated");
      expect(getData.data.type).toBe("generated");
      expect(getData.data.userId).toBe(testUser.id);
    });
  });
});
