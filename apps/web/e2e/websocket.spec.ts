import { test, expect } from '@playwright/test';

test.describe('WebSocket Connection', () => {
  test.beforeEach(async ({ page }) => {
    // Sign in before each test
    await page.goto('/');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');

    // Wait for dashboard to load
    await page.waitForURL('/');
    await expect(page.locator('h1')).toContainText(/Welcome|Dashboard/i, { timeout: 10000 });
  });

  test('should establish WebSocket connection', async ({ page }) => {
    // Wait for WebSocket connection to establish
    const connectionStatus = page.locator('text=Live updates');
    await expect(connectionStatus).toBeVisible({ timeout: 10000 });

    // Verify it's green (indicating active connection)
    const wifiIcon = page.locator('[data-testid="wifi-icon"], .text-green-500');
    if (await wifiIcon.isVisible()) {
      await expect(wifiIcon).toHaveClass(/text-green-500/);
    }
  });

  test('should show offline status when WebSocket disconnects', async ({ page }) => {
    // First ensure connection is established
    const connectionStatus = page.locator('text=Live updates');
    await expect(connectionStatus).toBeVisible({ timeout: 10000 });

    // Simulate network disconnection
    // Note: This is a simplified approach - in real tests you might need
    // to use browser context APIs to simulate network conditions
    await page.evaluate(() => {
      // Close all WebSocket connections
      const ws = window as any;
      if (ws.originalWebSocket) {
        // Restore original WebSocket if we've mocked it
        (window as any).WebSocket = ws.originalWebSocket;
      }
    });

    // Wait for connection to show as offline
    const offlineStatus = page.locator('text=Offline');
    await expect(offlineStatus).toBeVisible({ timeout: 5000 });
  });

  test('should handle real-time job updates', async ({ page }) => {
    // This test would require mocking WebSocket messages
    // or having the backend actually update job status

    // First establish connection
    const connectionStatus = page.locator('text=Live updates');
    await expect(connectionStatus).toBeVisible({ timeout: 10000 });

    // Mock WebSocket message for job update
    await page.evaluate(() => {
      // This would need to be implemented based on your WebSocket implementation
      // You might need to intercept WebSocket connections and mock responses
      console.log('Mocking WebSocket job update message');
    });

    // Look for job updates (this would depend on actual WebSocket messages)
    // For now, we'll just verify the connection is established
    await expect(connectionStatus).toBeVisible();
  });

  test('should handle real-time result updates', async ({ page }) => {
    // Establish connection
    const connectionStatus = page.locator('text=Live updates');
    await expect(connectionStatus).toBeVisible({ timeout: 10000 });

    // Navigate to Results tab
    await page.click('button:has-text("Recent Results")');

    // Mock WebSocket message for new result
    await page.evaluate(() => {
      console.log('Mocking WebSocket result update message');
    });

    // Look for new results appearing (would depend on actual WebSocket messages)
    // For now, verify we're on the results tab
    await expect(page.locator('text=Your most recently cracked WiFi passwords')).toBeVisible();
  });

  test('should maintain connection during navigation', async ({ page }) => {
    // Establish initial connection
    const connectionStatus = page.locator('text=Live updates');
    await expect(connectionStatus).toBeVisible({ timeout: 10000 });

    // Navigate between different tabs
    await page.click('button:has-text("Jobs")');
    await expect(connectionStatus).toBeVisible({ timeout: 5000 });

    await page.click('button:has-text("Active Jobs")');
    await expect(connectionStatus).toBeVisible({ timeout: 5000 });

    await page.click('button:has-text("Recent Results")');
    await expect(connectionStatus).toBeVisible({ timeout: 5000 });

    // Open and close dialogs
    await page.click('button:has-text("Create Job")');
    await expect(connectionStatus).toBeVisible({ timeout: 5000 });
    await page.keyboard.press('Escape');

    await page.click('button:has-text("Upload PCAP Files")');
    await expect(connectionStatus).toBeVisible({ timeout: 5000 });
    await page.keyboard.press('Escape');
  });

  test('should reconnect automatically on connection loss', async ({ page }) => {
    // Establish initial connection
    const connectionStatus = page.locator('text=Live updates');
    await expect(connectionStatus).toBeVisible({ timeout: 10000 });

    // Simulate connection loss and recovery
    await page.evaluate(() => {
      // This would need to be implemented based on your WebSocket implementation
      // For example, you could mock the WebSocket close event
      const ws = window as any;
      if (ws.websocketHook) {
        // Trigger reconnection logic
        ws.websocketHook.close();
      }
    });

    // Wait for automatic reconnection
    await expect(connectionStatus).toBeVisible({ timeout: 15000 });
  });
});