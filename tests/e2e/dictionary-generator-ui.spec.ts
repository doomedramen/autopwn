import { test, expect } from '@playwright/test';
import { TestUtils } from '../helpers/test-utils';

test.describe('Dictionary Generator UI', () => {
  let testUtils: TestUtils;

  test.beforeAll(async () => {
    testUtils = new TestUtils('dictionary-generator-ui-e2e');
  });

  test.afterAll(async () => {
    await testUtils.cleanupAll();
  });

  test('should display dictionary generator UI elements', async ({ page }) => {
    await page.goto('/');

    // Check if wordlist generator section is visible
    await expect(page.locator('h2:has-text("Custom Wordlist Generator")')).toBeVisible();

    // Check for input fields
    await expect(page.locator('label:has-text("Base Words (one per line)")')).toBeVisible();
    await expect(page.locator('textarea')).toBeVisible();

    // Check for number inputs
    await expect(page.locator('label:has-text("Min Length")')).toBeVisible();
    await expect(page.locator('label:has-text("Max Length")')).toBeVisible();

    // Check for checkboxes
    await expect(page.locator('label:has-text("Append numbers")')).toBeVisible();
    await expect(page.locator('label:has-text("Append special characters")')).toBeVisible();
    await expect(page.locator('label:has-text("Capitalize variations")')).toBeVisible();

    // Check for generate button
    await expect(page.locator('button:has-text("Generate Wordlist")')).toBeVisible();
  });

  test('should generate wordlist with basic configuration', async ({ page }) => {
    await page.goto('/');

    // Fill in base words
    const baseWordsTextarea = page.locator('textarea');
    await baseWordsTextarea.fill('password\nadmin\nwifi\nnetwork');

    // Verify default settings
    await expect(page.locator('input:checked')).toHaveCount(3); // All checkboxes checked by default

    // Generate wordlist
    await page.locator('button:has-text("Generate Wordlist")').click();

    // Wait for generation to complete
    await expect(page.locator('button:has-text("Generating...")')).toBeVisible();
    await expect(page.locator('button:has-text("Generate Wordlist")')).toBeVisible({ timeout: 10000 });

    // Verify success message
    await expect(page.locator('text=Wordlist generated successfully!')).toBeVisible();
    await expect(page.locator('text=File:')).toBeVisible();
    await expect(page.locator('text=Total entries:')).toBeVisible();
  });

  test('should validate empty base words input', async ({ page }) => {
    await page.goto('/');

    // Try to generate without entering base words
    await page.locator('button:has-text("Generate Wordlist")').click();

    // Should show alert (we can't test alert content easily in Playwright, but we can verify it doesn't generate)
    await expect(page.locator('text=Wordlist generated successfully!')).not.toBeVisible({ timeout: 2000 });
  });

  test('should handle different configuration options', async ({ page }) => {
    await page.goto('/');

    // Fill in base words
    const baseWordsTextarea = page.locator('textarea');
    await baseWordsTextarea.fill('test');

    // Uncheck some options
    await page.locator('label:has-text("Append numbers") input').uncheck();
    await page.locator('label:has-text("Append special characters") input').uncheck();
    await page.locator('label:has-text("Capitalize variations") input').check();

    // Change length settings
    await page.locator('label:has-text("Min Length") + input').fill('4');
    await page.locator('label:has-text("Max Length") + input').fill('10');

    // Generate wordlist
    await page.locator('button:has-text("Generate Wordlist")').click();

    // Wait for generation to complete
    await expect(page.locator('button:has-text("Generate Wordlist")')).toBeVisible({ timeout: 10000 });

    // Verify success message
    await expect(page.locator('text=Wordlist generated successfully!')).toBeVisible();
  });

  test('should handle custom pattern input', async ({ page }) => {
    await page.goto('/');

    // Fill in base words
    const baseWordsTextarea = page.locator('textarea');
    await baseWordsTextarea.fill('company');

    // Add custom pattern
    const customPatternInput = page.locator('input[placeholder*="{word}{year}"]');
    await customPatternInput.fill('{word}{year}');

    // Generate wordlist
    await page.locator('button:has-text("Generate Wordlist")').click();

    // Wait for generation to complete
    await expect(page.locator('button:has-text("Generate Wordlist")')).toBeVisible({ timeout: 10000 });

    // Verify success message
    await expect(page.locator('text=Wordlist generated successfully!')).toBeVisible();
  });

  test('should handle large base word lists', async ({ page }) => {
    await page.goto('/');

    // Fill in many base words
    const manyWords = Array.from({ length: 100 }, (_, i) => `word${i}`).join('\n');
    const baseWordsTextarea = page.locator('textarea[placeholder*="password\\nwifi\\nnetwork"]');
    await baseWordsTextarea.fill(manyWords);

    // Generate wordlist
    await page.locator('button:has-text("Generate Wordlist")').click();

    // Wait for generation to complete (may take longer)
    await expect(page.locator('button:has-text("Generate Wordlist")')).toBeVisible({ timeout: 30000 });

    // Verify success message
    await expect(page.locator('text=Wordlist generated successfully!')).toBeVisible();

    // Verify the wordlist has many entries
    const entriesText = await page.locator('text=Total entries:').textContent();
    expect(entriesText).toMatch(/\d+/);
    const entryCount = parseInt(entriesText!.match(/\d+/)![0]);
    expect(entryCount).toBeGreaterThan(1000); // Should have many variations
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Test on mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Check if all elements are still visible and functional on mobile
    await expect(page.locator('h2:has-text("Custom Wordlist Generator")')).toBeVisible();
    await expect(page.locator('textarea[placeholder*="password\\nwifi\\nnetwork"]')).toBeVisible();
    await expect(page.locator('button:has-text("Generate Wordlist")')).toBeVisible();

    // Try generating a wordlist on mobile
    const baseWordsTextarea = page.locator('textarea[placeholder*="password\\nwifi\\nnetwork"]');
    await baseWordsTextarea.fill('mobile\ntest');

    await page.locator('button:has-text("Generate Wordlist")').click();
    await expect(page.locator('text=Wordlist generated successfully!')).toBeVisible({ timeout: 15000 });
  });
});