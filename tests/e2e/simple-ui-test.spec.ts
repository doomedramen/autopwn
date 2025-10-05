import { test, expect } from '@playwright/test';

test.describe('Simple UI Test', () => {
  test('should load main page components', async ({ page }) => {
    await page.goto('/');

    // Check if main page loads
    await expect(page).toHaveTitle(/AutoPWN/);

    // Check if major components are visible
    await expect(page.locator('h2:has-text("Job Queue")')).toBeVisible();
    await expect(page.locator('h2:has-text("Custom Wordlist Generator")')).toBeVisible();
    await expect(page.locator('h2:has-text("Upload Captures")')).toBeVisible();

    // Check for generate button
    await expect(page.locator('button:has-text("Generate Wordlist")')).toBeVisible();
  });

  test('should test wordlist generator basic flow', async ({ page }) => {
    await page.goto('/');

    // Find the wordlist generator
    const generator = page.locator('h2:has-text("Custom Wordlist Generator")');
    await expect(generator).toBeVisible();

    // Find textarea and fill it
    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible();
    await textarea.fill('test\npassword\nadmin');

    // Click generate button
    const generateBtn = generator.locator('button:has-text("Generate Wordlist")');
    await generateBtn.click();

    // Wait for completion (up to 30 seconds for generation)
    await expect(generator.locator('text=Wordlist generated successfully!')).toBeVisible({ timeout: 30000 });
  });
});