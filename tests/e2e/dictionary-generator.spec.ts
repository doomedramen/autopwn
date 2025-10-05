import { test, expect } from '@playwright/test';
import { TestUtils } from '../helpers/test-utils';

test.describe('Dictionary Generator', () => {
  let testUtils: TestUtils;

  test.beforeAll(async () => {
    testUtils = new TestUtils('dictionary-generator-e2e');
  });

  test.afterAll(async () => {
    await testUtils.cleanupAll();
  });

  test('should display dictionary generator API endpoint', async ({ page }) => {
    // Test the API endpoint directly
    const response = await page.request.post('/api/wordlist/generate', {
      data: {
        essid: 'TestNetwork',
        bssid: '00:11:22:33:44:55',
        custom_words: ['password', 'admin', '123456'],
        use_common: true,
        use_digits: true,
        use_year_variations: true
      }
    });

    expect(response.status()).toBe(200);

    const result = await response.json();
    expect(result).toHaveProperty('wordlist');
    expect(result).toHaveProperty('count');
    expect(result.count).toBeGreaterThan(0);
    expect(Array.isArray(result.wordlist)).toBe(true);
  });

  test('should generate dictionary with custom words', async ({ page }) => {
    const customWords = ['testpass', 'mynetwork', 'password123'];
    const response = await page.request.post('/api/wordlist/generate', {
      data: {
        essid: 'TestNetwork',
        bssid: '00:11:22:33:44:55',
        custom_words: customWords,
        use_common: false,
        use_digits: false,
        use_year_variations: false
      }
    });

    expect(response.status()).toBe(200);
    const result = await response.json();

    // Should contain all custom words
    customWords.forEach(word => {
      expect(result.wordlist).toContain(word);
    });
  });

  test('should generate dictionary with common passwords', async ({ page }) => {
    const response = await page.request.post('/api/wordlist/generate', {
      data: {
        essid: 'TestNetwork',
        bssid: '00:11:22:33:44:55',
        custom_words: [],
        use_common: true,
        use_digits: false,
        use_year_variations: false
      }
    });

    expect(response.status()).toBe(200);
    const result = await response.json();

    // Should contain common passwords
    const commonPasswords = ['password', '123456', 'qwerty', 'admin'];
    const hasCommonPasswords = commonPasswords.some(pwd => result.wordlist.includes(pwd));
    expect(hasCommonPasswords).toBe(true);
  });

  test('should generate dictionary with digit variations', async ({ page }) => {
    const baseWord = 'password';
    const response = await page.request.post('/api/wordlist/generate', {
      data: {
        essid: 'TestNetwork',
        bssid: '00:11:22:33:44:55',
        custom_words: [baseWord],
        use_common: false,
        use_digits: true,
        use_year_variations: false
      }
    });

    expect(response.status()).toBe(200);
    const result = await response.json();

    // Should contain digit variations
    expect(result.wordlist).toContain(baseWord);

    // Check for common digit patterns
    const digitPatterns = [`${baseWord}1`, `${baseWord}123`, `${baseWord}2024`];
    const hasDigitVariations = digitPatterns.some(pattern => result.wordlist.includes(pattern));
    expect(hasDigitVariations).toBe(true);
  });

  test('should generate dictionary with year variations', async ({ page }) => {
    const baseWord = 'network';
    const response = await page.request.post('/api/wordlist/generate', {
      data: {
        essid: 'TestNetwork',
        bssid: '00:11:22:33:44:55',
        custom_words: [baseWord],
        use_common: false,
        use_digits: false,
        use_year_variations: true
      }
    });

    expect(response.status()).toBe(200);
    const result = await response.json();

    // Should contain year variations
    expect(result.wordlist).toContain(baseWord);

    // Check for year patterns
    const yearPatterns = [`${baseWord}2024`, `${baseWord}2023`, `${baseWord}25`];
    const hasYearVariations = yearPatterns.some(pattern => result.wordlist.includes(pattern));
    expect(hasYearVariations).toBe(true);
  });

  test('should handle ESSID-based variations', async ({ page }) => {
    const essid = 'HomeNetwork';
    const response = await page.request.post('/api/wordlist/generate', {
      data: {
        essid: essid,
        bssid: '00:11:22:33:44:55',
        custom_words: [],
        use_common: false,
        use_digits: true,
        use_year_variations: true
      }
    });

    expect(response.status()).toBe(200);
    const result = await response.json();

    // Should contain ESSID variations
    expect(result.wordlist.some(word =>
      word.toLowerCase().includes(essid.toLowerCase()) ||
      essid.toLowerCase().includes(word.toLowerCase())
    )).toBe(true);
  });

  test('should validate input parameters', async ({ page }) => {
    // Test missing required parameters
    const response1 = await page.request.post('/api/wordlist/generate', {
      data: {}
    });

    // Should still work with defaults
    expect(response1.status()).toBe(200);

    // Test with empty data
    const response2 = await page.request.post('/api/wordlist/generate', {
      data: {
        essid: '',
        bssid: '',
        custom_words: [],
        use_common: false,
        use_digits: false,
        use_year_variations: false
      }
    });

    expect(response2.status()).toBe(200);
    const result2 = await response2.json();
    expect(result2.count).toBe(0);
  });

  test('should handle large custom word lists', async ({ page }) => {
    // Generate a large custom word list
    const largeWordList = Array.from({ length: 1000 }, (_, i) => `word${i}`);

    const response = await page.request.post('/api/wordlist/generate', {
      data: {
        essid: 'TestNetwork',
        bssid: '00:11:22:33:44:55',
        custom_words: largeWordList,
        use_common: false,
        use_digits: false,
        use_year_variations: false
      }
    });

    expect(response.status()).toBe(200);
    const result = await response.json();

    // Should handle large lists without issues
    expect(result.wordlist.length).toBeGreaterThanOrEqual(largeWordList.length);
  });

  test('should generate unique words', async ({ page }) => {
    const customWords = ['password', 'password', '123456']; // Duplicate 'password'
    const response = await page.request.post('/api/wordlist/generate', {
      data: {
        essid: 'TestNetwork',
        bssid: '00:11:22:33:44:55',
        custom_words: customWords,
        use_common: false,
        use_digits: false,
        use_year_variations: false
      }
    });

    expect(response.status()).toBe(200);
    const result = await response.json();

    // Check for duplicates
    const uniqueWords = new Set(result.wordlist);
    expect(uniqueWords.size).toBe(result.wordlist.length);
  });

  test('should integrate with cracking workflow', async ({ page }) => {
    // First generate a dictionary
    const dictResponse = await page.request.post('/api/wordlist/generate', {
      data: {
        essid: 'TestNetwork',
        bssid: '00:11:22:33:44:55',
        custom_words: ['abcdefgh'], // Known password from test pcaps
        use_common: true,
        use_digits: true,
        use_year_variations: false
      }
    });

    expect(dictResponse.status()).toBe(200);
    const dictResult = await dictResponse.json();
    expect(dictResult.wordlist.length).toBeGreaterThan(0);

    // Verify the generated dictionary contains expected passwords
    expect(dictResult.wordlist.some(word => word.includes('abcdefgh'))).toBe(true);
  });

  test('should handle special characters in custom words', async ({ page }) => {
    const specialWords = ['p@ssw0rd!', 'network#123', 'my-wifi_pass'];
    const response = await page.request.post('/api/wordlist/generate', {
      data: {
        essid: 'TestNetwork',
        bssid: '00:11:22:33:44:55',
        custom_words: specialWords,
        use_common: false,
        use_digits: false,
        use_year_variations: false
      }
    });

    expect(response.status()).toBe(200);
    const result = await response.json();

    // Should handle special characters properly
    specialWords.forEach(word => {
      expect(result.wordlist).toContain(word);
    });
  });

  test('should be performant with large requests', async ({ page }) => {
    const startTime = Date.now();

    const response = await page.request.post('/api/wordlist/generate', {
      data: {
        essid: 'PerformanceTest',
        bssid: '00:11:22:33:44:55',
        custom_words: Array.from({ length: 500 }, (_, i) => `testword${i}`),
        use_common: true,
        use_digits: true,
        use_year_variations: true
      }
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(response.status()).toBe(200);

    // Should complete within reasonable time (5 seconds)
    expect(duration).toBeLessThan(5000);

    const result = await response.json();
    expect(result.wordlist.length).toBeGreaterThan(1000);
  });
});