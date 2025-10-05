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

  test('should generate dictionary with custom words', async ({ page }) => {
    await page.goto('/');

    // Fill in base words
    const baseWordsTextarea = page.locator('textarea');
    await baseWordsTextarea.fill('testpass\nmynetwork\npassword123');

    // Uncheck all options to only use base words
    await page.locator('label:has-text("Append numbers") input').uncheck();
    await page.locator('label:has-text("Append special characters") input').uncheck();
    await page.locator('label:has-text("Capitalize variations") input').uncheck();

    // Generate wordlist
    await page.locator('button:has-text("Generate Wordlist")').click();

    // Wait for generation to complete
    await expect(page.locator('button:has-text("Generate Wordlist")')).toBeVisible({ timeout: 10000 });

    // Verify success message
    await expect(page.locator('text=Wordlist generated successfully!')).toBeVisible();
    await expect(page.locator('text=Total entries:')).toBeVisible();

    // Verify the wordlist has entries
    const entriesText = await page.locator('text=Total entries:').textContent();
    expect(entriesText).toMatch(/\d+/);
    const entryCount = parseInt(entriesText!.match(/\d+/)![0]);
    expect(entryCount).toBeGreaterThan(0);
  });

  test('should generate dictionary with common passwords', async ({ page }) => {
    await page.goto('/');

    // Fill in common passwords as base words
    const baseWordsTextarea = page.locator('textarea');
    await baseWordsTextarea.fill('password\n123456\nqwerty\nadmin');

    // Keep all options checked
    await expect(page.locator('input:checked')).toHaveCount(3);

    // Generate wordlist
    await page.locator('button:has-text("Generate Wordlist")').click();

    // Wait for generation to complete
    await expect(page.locator('button:has-text("Generate Wordlist")')).toBeVisible({ timeout: 10000 });

    // Verify success message
    await expect(page.locator('text=Wordlist generated successfully!')).toBeVisible();
    await expect(page.locator('text=Total entries:')).toBeVisible();

    // Verify the wordlist has many entries due to variations
    const entriesText = await page.locator('text=Total entries:').textContent();
    expect(entriesText).toMatch(/\d+/);
    const entryCount = parseInt(entriesText!.match(/\d+/)![0]);
    expect(entryCount).toBeGreaterThan(4); // Should have more than just the base words
  });

  test('should generate dictionary with digit variations', async ({ page }) => {
    await page.goto('/');

    // Fill in base word
    const baseWordsTextarea = page.locator('textarea');
    await baseWordsTextarea.fill('password');

    // Only keep numbers option checked
    await page.locator('label:has-text("Append numbers") input').check();
    await page.locator('label:has-text("Append special characters") input').uncheck();
    await page.locator('label:has-text("Capitalize variations") input').uncheck();

    // Generate wordlist
    await page.locator('button:has-text("Generate Wordlist")').click();

    // Wait for generation to complete
    await expect(page.locator('button:has-text("Generate Wordlist")')).toBeVisible({ timeout: 10000 });

    // Verify success message
    await expect(page.locator('text=Wordlist generated successfully!')).toBeVisible();
    await expect(page.locator('text=Total entries:')).toBeVisible();

    // Verify the wordlist has many entries due to digit variations
    const entriesText = await page.locator('text=Total entries:').textContent();
    expect(entriesText).toMatch(/\d+/);
    const entryCount = parseInt(entriesText!.match(/\d+/)![0]);
    expect(entryCount).toBeGreaterThan(1); // Should have more than just the base word
  });

  test('should generate dictionary with year variations', async ({ page }) => {
    await page.goto('/');

    // Fill in base word
    const baseWordsTextarea = page.locator('textarea');
    await baseWordsTextarea.fill('network');

    // Add custom pattern with year
    const customPatternInput = page.locator('input[placeholder*="{word}{year}"]');
    await customPatternInput.fill('{word}{year}');

    // Generate wordlist
    await page.locator('button:has-text("Generate Wordlist")').click();

    // Wait for generation to complete
    await expect(page.locator('button:has-text("Generate Wordlist")')).toBeVisible({ timeout: 10000 });

    // Verify success message
    await expect(page.locator('text=Wordlist generated successfully!')).toBeVisible();
    await expect(page.locator('text=Total entries:')).toBeVisible();

    // Verify the wordlist has many entries due to year variations
    const entriesText = await page.locator('text=Total entries:').textContent();
    expect(entriesText).toMatch(/\d+/);
    const entryCount = parseInt(entriesText!.match(/\d+/)![0]);
    expect(entryCount).toBeGreaterThan(1); // Should have more than just the base word
  });

  test('should handle ESSID-based variations', async ({ page }) => {
    await page.goto('/');

    // Fill in ESSID as base word
    const baseWordsTextarea = page.locator('textarea');
    await baseWordsTextarea.fill('HomeNetwork');

    // Keep all options checked
    await expect(page.locator('input:checked')).toHaveCount(3);

    // Generate wordlist
    await page.locator('button:has-text("Generate Wordlist")').click();

    // Wait for generation to complete
    await expect(page.locator('button:has-text("Generate Wordlist")')).toBeVisible({ timeout: 10000 });

    // Verify success message
    await expect(page.locator('text=Wordlist generated successfully!')).toBeVisible();
    await expect(page.locator('text=Total entries:')).toBeVisible();

    // Verify the wordlist has many entries due to variations
    const entriesText = await page.locator('text=Total entries:').textContent();
    expect(entriesText).toMatch(/\d+/);
    const entryCount = parseInt(entriesText!.match(/\d+/)![0]);
    expect(entryCount).toBeGreaterThan(1); // Should have more than just the base word
  });

  test('should validate empty base words input', async ({ page }) => {
    await page.goto('/');

    // Try to generate without entering base words
    await page.locator('button:has-text("Generate Wordlist")').click();

    // Should show alert (we can't test alert content easily in Playwright, but we can verify it doesn't generate)
    await expect(page.locator('text=Wordlist generated successfully!')).not.toBeVisible({ timeout: 2000 });
  });

  test('should handle large custom word lists', async ({ page }) => {
    await page.goto('/');

    // Fill in many base words
    const manyWords = Array.from({ length: 100 }, (_, i) => `word${i}`).join('\n');
    const baseWordsTextarea = page.locator('textarea');
    await baseWordsTextarea.fill(manyWords);

    // Uncheck all options to only use base words
    await page.locator('label:has-text("Append numbers") input').uncheck();
    await page.locator('label:has-text("Append special characters") input').uncheck();
    await page.locator('label:has-text("Capitalize variations") input').uncheck();

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
    expect(entryCount).toBeGreaterThan(100); // Should have at least as many as base words
  });

  test('should generate unique words', async ({ page }) => {
    await page.goto('/');

    // Fill in base words with duplicates
    const baseWordsTextarea = page.locator('textarea');
    await baseWordsTextarea.fill('password\npassword\n123456');

    // Uncheck all options to only use base words
    await page.locator('label:has-text("Append numbers") input').uncheck();
    await page.locator('label:has-text("Append special characters") input').uncheck();
    await page.locator('label:has-text("Capitalize variations") input').uncheck();

    // Generate wordlist
    await page.locator('button:has-text("Generate Wordlist")').click();

    // Wait for generation to complete
    await expect(page.locator('button:has-text("Generate Wordlist")')).toBeVisible({ timeout: 10000 });

    // Verify success message
    await expect(page.locator('text=Wordlist generated successfully!')).toBeVisible();

    // Verify the wordlist has unique entries (duplicates should be removed)
    const entriesText = await page.locator('text=Total entries:').textContent();
    expect(entriesText).toMatch(/\d+/);
    const entryCount = parseInt(entriesText!.match(/\d+/)![0]);
    expect(entryCount).toBe(2); // Should have only 2 unique words (password and 123456)
  });

  test('should integrate with cracking workflow', async ({ page }) => {
    await page.goto('/');

    // Fill in base words with known password
    const baseWordsTextarea = page.locator('textarea');
    await baseWordsTextarea.fill('abcdefgh');

    // Keep all options checked
    await expect(page.locator('input:checked')).toHaveCount(3);

    // Generate wordlist
    await page.locator('button:has-text("Generate Wordlist")').click();

    // Wait for generation to complete
    await expect(page.locator('button:has-text("Generate Wordlist")')).toBeVisible({ timeout: 10000 });

    // Verify success message
    await expect(page.locator('text=Wordlist generated successfully!')).toBeVisible();

    // Verify the wordlist has entries
    const entriesText = await page.locator('text=Total entries:').textContent();
    expect(entriesText).toMatch(/\d+/);
    const entryCount = parseInt(entriesText!.match(/\d+/)![0]);
    expect(entryCount).toBeGreaterThan(0);
  });

  test('should handle special characters in custom words', async ({ page }) => {
    await page.goto('/');

    // Fill in base words with special characters
    const baseWordsTextarea = page.locator('textarea');
    await baseWordsTextarea.fill('p@ssw0rd!\nnetwork#123\nmy-wifi_pass');

    // Uncheck all options to only use base words
    await page.locator('label:has-text("Append numbers") input').uncheck();
    await page.locator('label:has-text("Append special characters") input').uncheck();
    await page.locator('label:has-text("Capitalize variations") input').uncheck();

    // Generate wordlist
    await page.locator('button:has-text("Generate Wordlist")').click();

    // Wait for generation to complete
    await expect(page.locator('button:has-text("Generate Wordlist")')).toBeVisible({ timeout: 10000 });

    // Verify success message
    await expect(page.locator('text=Wordlist generated successfully!')).toBeVisible();

    // Verify the wordlist has entries
    const entriesText = await page.locator('text=Total entries:').textContent();
    expect(entriesText).toMatch(/\d+/);
    const entryCount = parseInt(entriesText!.match(/\d+/)![0]);
    expect(entryCount).toBe(3); // Should have all 3 words with special characters
  });

  test('should be performant with large requests', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');

    // Fill in many base words
    const manyWords = Array.from({ length: 50 }, (_, i) => `testword${i}`).join('\n');
    const baseWordsTextarea = page.locator('textarea');
    await baseWordsTextarea.fill(manyWords);

    // Keep all options checked
    await expect(page.locator('input:checked')).toHaveCount(3);

    // Generate wordlist
    await page.locator('button:has-text("Generate Wordlist")').click();

    // Wait for generation to complete
    await expect(page.locator('button:has-text("Generate Wordlist")')).toBeVisible({ timeout: 30000 });

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should complete within reasonable time (30 seconds)
    expect(duration).toBeLessThan(30000);

    // Verify success message
    await expect(page.locator('text=Wordlist generated successfully!')).toBeVisible();

    // Verify the wordlist has many entries
    const entriesText = await page.locator('text=Total entries:').textContent();
    expect(entriesText).toMatch(/\d+/);
    const entryCount = parseInt(entriesText!.match(/\d+/)![0]);
    expect(entryCount).toBeGreaterThan(100); // Should have many variations
  });
});