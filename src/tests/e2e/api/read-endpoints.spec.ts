/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from '@playwright/test';
import { TestHelpers } from '../helpers/test-helpers';

test.describe('Read-Only API Endpoints', () => {
  let authHeaders: Record<string, string>;

  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await TestHelpers.loginWithSession(page, context);
    authHeaders = await TestHelpers.getAuthHeaders(context);
    await context.close();
  });

  test.beforeEach(async ({ page, context }) => {
    await TestHelpers.loginWithSession(page, context);
  });

  test.describe('GET /api/dictionaries', () => {
    test('should return list of dictionaries', async ({ request }) => {
      const response = await request.get('/api/dictionaries', {
        headers: authHeaders,
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data.success).toBe(true);
      expect(data).toHaveProperty('data');
      expect(Array.isArray(data.data)).toBe(true);
    });

    test('should require authentication', async ({ request }) => {
      const response = await request.get('/api/dictionaries');

      // Should redirect to login or return 401
      expect(response.status()).toBeGreaterThanOrEqual(300);
    });

    test('should return dictionaries with metadata', async ({ request }) => {
      const response = await request.get('/api/dictionaries', {
        headers: authHeaders,
      });

      const data = await response.json();
      if (data.data.length > 0) {
        const dictionary = data.data[0];
        expect(dictionary).toHaveProperty('id');
        expect(dictionary).toHaveProperty('filename');
        expect(dictionary).toHaveProperty('fileSize');
      }
    });
  });

  test.describe('GET /api/networks', () => {
    test('should return list of networks', async ({ request }) => {
      const response = await request.get('/api/networks', {
        headers: authHeaders,
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data.success).toBe(true);
      expect(data).toHaveProperty('data');
      expect(Array.isArray(data.data)).toBe(true);
    });

    test('should require authentication', async ({ request }) => {
      const response = await request.get('/api/networks');

      expect(response.status()).toBeGreaterThanOrEqual(300);
    });

    test('should return networks with BSSID and ESSID', async ({ request }) => {
      const response = await request.get('/api/networks', {
        headers: authHeaders,
      });

      const data = await response.json();
      if (data.data.length > 0) {
        const network = data.data[0];
        expect(network).toHaveProperty('bssid');
        expect(network).toHaveProperty('essid');
        expect(network).toHaveProperty('encryption');
      }
    });

    test('should filter networks by ESSID', async ({ request }) => {
      // First get all networks
      const allResponse = await request.get('/api/networks', {
        headers: authHeaders,
      });
      const allData = await allResponse.json();

      if (allData.data.length > 0) {
        const firstEssid = allData.data[0].essid;

        // Filter by ESSID
        const filteredResponse = await request.get(
          `/api/networks?essid=${encodeURIComponent(firstEssid)}`,
          { headers: authHeaders }
        );
        const filteredData = await filteredResponse.json();

        expect(filteredData.success).toBe(true);
        if (filteredData.data.length > 0) {
          expect(filteredData.data[0].essid).toBe(firstEssid);
        }
      }
    });
  });

  test.describe('GET /api/hardware/devices', () => {
    test('should return hardware device information', async ({ request }) => {
      const response = await request.get('/api/hardware/devices', {
        headers: authHeaders,
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data.success).toBe(true);
      expect(data).toHaveProperty('data');
    });

    test('should require authentication', async ({ request }) => {
      const response = await request.get('/api/hardware/devices');

      expect(response.status()).toBeGreaterThanOrEqual(300);
    });

    test('should return device array', async ({ request }) => {
      const response = await request.get('/api/hardware/devices', {
        headers: authHeaders,
      });

      const data = await response.json();
      expect(data.data).toHaveProperty('devices');
      expect(Array.isArray(data.data.devices)).toBe(true);
    });

    test('should include GPU information if available', async ({ request }) => {
      const response = await request.get('/api/hardware/devices', {
        headers: authHeaders,
      });

      const data = await response.json();
      if (data.data.devices.length > 0) {
        const device = data.data.devices[0];
        expect(device).toHaveProperty('id');
        expect(device).toHaveProperty('name');
        expect(device).toHaveProperty('type');
      }
    });
  });

  test.describe('GET /api/tools/status', () => {
    test('should return tool availability status', async ({ request }) => {
      const response = await request.get('/api/tools/status', {
        headers: authHeaders,
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data.success).toBe(true);
      expect(data).toHaveProperty('data');
    });

    test('should require authentication', async ({ request }) => {
      const response = await request.get('/api/tools/status');

      expect(response.status()).toBeGreaterThanOrEqual(300);
    });

    test('should check hashcat availability', async ({ request }) => {
      const response = await request.get('/api/tools/status', {
        headers: authHeaders,
      });

      const data = await response.json();
      expect(data.data).toHaveProperty('tools');
      expect(Array.isArray(data.data.tools)).toBe(true);

      const hashcat = data.data.tools.find((t: any) => t.name === 'hashcat');
      expect(hashcat).toBeDefined();
      expect(hashcat).toHaveProperty('available');
      expect(typeof hashcat.available).toBe('boolean');
    });

    test('should check hcxpcapngtool availability', async ({ request }) => {
      const response = await request.get('/api/tools/status', {
        headers: authHeaders,
      });

      const data = await response.json();
      const hcxTool = data.data.tools.find(
        (t: any) => t.name === 'hcxpcapngtool'
      );
      expect(hcxTool).toBeDefined();
      expect(hcxTool).toHaveProperty('available');
      expect(typeof hcxTool.available).toBe('boolean');
    });

    test('should include version info when tools are available', async ({
      request,
    }) => {
      const response = await request.get('/api/tools/status', {
        headers: authHeaders,
      });

      const data = await response.json();
      const availableTool = data.data.tools.find((t: any) => t.available);

      if (availableTool) {
        expect(availableTool).toHaveProperty('version');
      }
    });
  });

  test.describe('GET /api/networks/[id]/passwords', () => {
    test('should return cracked passwords for a network', async ({
      request,
    }) => {
      // First get a network ID
      const networksResponse = await request.get('/api/networks', {
        headers: authHeaders,
      });
      const networksData = await networksResponse.json();

      if (networksData.data.length > 0) {
        const networkId = networksData.data[0].id;

        const response = await request.get(
          `/api/networks/${networkId}/passwords`,
          { headers: authHeaders }
        );

        expect(response.ok()).toBeTruthy();
        const data = await response.json();
        expect(data).toHaveProperty('success');
        expect(data.success).toBe(true);
        expect(data).toHaveProperty('data');
        expect(Array.isArray(data.data)).toBe(true);
      }
    });

    test('should require authentication', async ({ request }) => {
      const response = await request.get('/api/networks/1/passwords');

      expect(response.status()).toBeGreaterThanOrEqual(300);
    });

    test('should return 404 for non-existent network', async ({ request }) => {
      const response = await request.get('/api/networks/99999999/passwords', {
        headers: authHeaders,
      });

      expect([404, 500]).toContain(response.status());
    });
  });
});
