import { test, expect } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';

const DICTIONARY_PATH = path.join(
  __dirname,
  '../fixtures/dictionaries/test-passwords.txt'
);
const PCAP_PATH = path.join(
  __dirname,
  '../fixtures/pcaps/wpa2-ikeriri-5g.pcap'
);

test.describe('Complete Workflow: Upload and Crack', () => {
  let authHeaders: Record<string, string> = {};

  test.setTimeout(120000); // Increase timeout to 2 minutes for password cracking

  test.beforeAll(async ({ browser }) => {
    // Setup: Authenticate user for API requests
    const context = await browser.newContext();
    const page = await context.newPage();

    // Check if system is already initialized
    await page.goto('/setup');

    // Check if initialize button exists (system not initialized)
    const initializeButton = page.locator(
      '[data-testid="initialize-system-button"]'
    );
    const initializeButtonExists = await initializeButton
      .isVisible()
      .catch(() => false);

    console.log('🔧 Initialize button exists:', initializeButtonExists);
    console.log('📄 Current URL before init:', page.url());

    // Debug: What's actually on the page?
    const pageContent = await page.content();
    console.log(
      '📄 Page contains "System Already Initialized":',
      pageContent.includes('System Already Initialized')
    );
    console.log(
      '📄 Page contains "Initialize System":',
      pageContent.includes('Initialize System')
    );
    console.log('📄 Page title:', await page.title());
    console.log(
      '📄 Page content (first 500 chars):',
      pageContent.substring(0, 500)
    );

    let credentials;

    if (initializeButtonExists) {
      // System needs initialization
      console.log('🚀 Clicking initialize button...');
      await initializeButton.click();
      console.log('✅ Initialize button clicked');

      // Wait for credentials to be displayed
      await page.waitForSelector('[data-testid="superuser-email"]', {
        timeout: 10000,
      });
      await page.waitForSelector('[data-testid="superuser-password"]', {
        timeout: 10000,
      });

      const emailElement = await page.locator(
        '[data-testid="superuser-email"]'
      );
      const passwordElement = await page.locator(
        '[data-testid="superuser-password"]'
      );
      const emailText = await emailElement.textContent();
      const passwordText = await passwordElement.textContent();

      credentials = {
        email: emailText!.replace('Email:', '').trim(),
        password: passwordText!.replace('Password:', '').trim(),
      };

      console.log('🔐 Extracted credentials:', {
        email: credentials.email,
        passwordLength: credentials.password.length,
      });

      // Go to login page
      await page.goto('/login');
      await page.fill('input[type="email"]', credentials.email);
      await page.fill('input[type="password"]', credentials.password);
      await page.click('button:has-text("Sign In")');

      // Check if we need to change password (superuser requires this on first login)
      if (page.url().includes('/change-password')) {
        console.log('🔒 Need to change password...');
        // Change password as required - use a different password
        await page.fill('input[name="currentPassword"]', credentials.password);
        await page.fill('input[name="newPassword"]', 'NewTestPassword123!');
        await page.fill('input[name="confirmPassword"]', 'NewTestPassword123!');
        await page.click('button:has-text("Change Password")');

        // Wait for success message and redirect to dashboard
        await page.waitForSelector('text=Password Updated!', {
          timeout: 10000,
        });
        await page.waitForTimeout(3000);

        // Update credentials for future use
        credentials.password = 'NewTestPassword123!';
        console.log('✅ Password changed successfully');
      }

      // Wait for successful login (redirect to dashboard)
      await expect(page).toHaveURL(/.*\/$/, { timeout: 10000 });
      await page.waitForTimeout(2000);
    } else {
      // System appears to be already initialized (no initialize button visible)
      // But since global setup cleared authentication, we need to check if we can initialize
      console.log(
        '📍 System appears initialized, but checking if we need to initialize after database cleanup...'
      );

      // Check the current page content more carefully
      const pageContent = await page.content();
      const hasInitButton = pageContent.includes(
        'data-testid="initialize-system-button"'
      );
      const hasSystemInitialized = pageContent.includes(
        'System Already Initialized'
      );

      console.log('📄 Page has init button:', hasInitButton);
      console.log('📄 Page shows system initialized:', hasSystemInitialized);

      if (!hasInitButton && !hasSystemInitialized) {
        // The system is in an inconsistent state - try refreshing or check if we can initialize
        await page.reload();
        await page.waitForLoadState('networkidle', { timeout: 10000 });

        // Check again after reload
        const initButtonAfterReload = page.locator(
          '[data-testid="initialize-system-button"]'
        );
        const initButtonExistsAfterReload = await initButtonAfterReload
          .isVisible()
          .catch(() => false);

        if (initButtonExistsAfterReload) {
          console.log(
            '🔄 After reload, initialize button is now visible - initializing system'
          );
          await initButtonAfterReload.click();

          // Wait for credentials to be displayed
          await page.waitForSelector('[data-testid="superuser-email"]', {
            timeout: 10000,
          });
          await page.waitForSelector('[data-testid="superuser-password"]', {
            timeout: 10000,
          });

          const emailElement = await page.locator(
            '[data-testid="superuser-email"]'
          );
          const passwordElement = await page.locator(
            '[data-testid="superuser-password"]'
          );
          const emailText = await emailElement.textContent();
          const passwordText = await passwordElement.textContent();

          credentials = {
            email: emailText!.replace('Email:', '').trim(),
            password: passwordText!.replace('Password:', '').trim(),
          };

          console.log('🔐 Extracted credentials after initialization:', {
            email: credentials.email,
            passwordLength: credentials.password.length,
          });
        } else {
          console.log(
            '⚠️ System in inconsistent state - using default credentials'
          );
          credentials = {
            email: 'superuser@autopwn.local',
            password: 'TestPassword123!',
          };
        }
      } else {
        console.log(
          '⚠️ System in inconsistent state - using default credentials'
        );
        credentials = {
          email: 'superuser@autopwn.local',
          password: 'TestPassword123!',
        };
      }

      // Try to login with the credentials we have
      await page.goto('/login');
      await page.fill('input[type="email"]', credentials.email);
      await page.fill('input[type="password"]', credentials.password);
      await page.click('button:has-text("Sign In")');

      // Check if login was successful or if we need to change password
      await page.waitForTimeout(2000); // Wait for redirect
      const currentUrlAfterLogin = page.url();
      console.log('📍 URL after login attempt:', currentUrlAfterLogin);

      if (currentUrlAfterLogin.includes('/change-password')) {
        console.log('🔒 Need to change password...');
        // Change password as required
        await page.fill('input[name="currentPassword"]', credentials.password);
        await page.fill('input[name="newPassword"]', 'NewTestPassword123!');
        await page.fill('input[name="confirmPassword"]', 'NewTestPassword123!');
        await page.click('button:has-text("Change Password")');

        // Wait for success message and redirect to dashboard
        await page.waitForSelector('text=Password Updated!', {
          timeout: 10000,
        });
        await page.waitForTimeout(3000);

        // Update credentials for future use
        credentials.password = 'NewTestPassword123!';
        console.log('✅ Password changed successfully');
      } else if (currentUrlAfterLogin.includes('/login')) {
        // Login failed - the credentials are wrong
        console.log('❌ Login failed with credentials:', credentials.email);
        throw new Error(
          `Login failed with email: ${credentials.email}. The system may be in an inconsistent state after global setup.`
        );
      }

      // Wait for successful login (redirect to dashboard)
      await expect(page).toHaveURL(/.*\/$/, { timeout: 10000 });
      await page.waitForTimeout(2000);
    }

    // Get session cookie for API requests
    const cookies = await context.cookies();
    const sessionCookie = cookies.find(
      c => c.name === 'better-auth.session_token'
    );

    console.log('Session cookie found:', !!sessionCookie);
    if (sessionCookie) {
      console.log(
        'Session cookie value:',
        sessionCookie.value.substring(0, 20) + '...'
      );
      authHeaders = {
        Cookie: `${sessionCookie.name}=${sessionCookie.value}`,
      };
    } else {
      console.log(
        'Available cookies:',
        cookies.map(c => ({
          name: c.name,
          value: c.value.substring(0, 20) + '...',
        }))
      );
    }

    // Verify user session is valid by checking a protected endpoint
    if (sessionCookie) {
      try {
        const sessionCheckResponse = await page.request.get('/api/auth/me', {
          headers: authHeaders,
        });

        if (sessionCheckResponse.ok()) {
          const userData = await sessionCheckResponse.json();
          console.log('✓ Session validated for user:', userData.email);
        } else {
          console.log(
            '⚠ Session validation failed, status:',
            sessionCheckResponse.status()
          );
        }
      } catch (error) {
        console.log('⚠ Could not validate session:', error);
      }
    }

    await context.close();
  });

  test('should upload dictionary, upload pcap, start job, and successfully crack password', async ({
    request,
  }) => {
    // Step 1: Upload dictionary
    console.log('📚 Uploading dictionary...');
    const dictionaryFile = await fs.readFile(DICTIONARY_PATH);

    // Use authentication for uploads
    const dictionaryResponse = await request.post('/api/upload/dictionary', {
      multipart: {
        file: {
          name: 'test-passwords.txt',
          mimeType: 'text/plain',
          buffer: dictionaryFile,
        },
      },
      headers: authHeaders,
    });

    if (!dictionaryResponse.ok()) {
      const errorData = await dictionaryResponse.json();
      console.error('Dictionary upload failed:', errorData);
      console.error('Response status:', dictionaryResponse.status());
      console.error('Response text:', await dictionaryResponse.text());
    }

    expect(dictionaryResponse.ok()).toBeTruthy();
    const dictionaryData = await dictionaryResponse.json();
    expect(dictionaryData.success).toBe(true);
    expect(dictionaryData.data.dictionary).toBeDefined();

    const dictionaryId = dictionaryData.data.dictionary.id;
    const dictionaryPath = dictionaryData.data.dictionary.path;
    console.log(`✓ Dictionary uploaded with ID: ${dictionaryId}`);
    console.log(`  Dictionary path: ${dictionaryPath}`);

    // Step 2: Upload PCAP
    console.log('📦 Uploading PCAP...');
    const pcapFile = await fs.readFile(PCAP_PATH);

    const pcapResponse = await request.post('/api/upload/pcap', {
      multipart: {
        file: {
          name: 'wpa2-ikeriri-5g.pcap',
          mimeType: 'application/vnd.tcpdump.pcap',
          buffer: pcapFile,
        },
      },
      headers: authHeaders,
    });

    expect(pcapResponse.ok()).toBeTruthy();
    const pcapData = await pcapResponse.json();
    expect(pcapData.success).toBe(true);
    expect(pcapData.data.networks).toBeDefined();
    expect(pcapData.data.networks.length).toBeGreaterThan(0);

    const networks = pcapData.data.networks;
    const networkBssids = networks.map(
      (network: { bssid: string }) => network.bssid
    );
    const pcapPath = pcapData.data.upload.savedPath;
    console.log(`✓ PCAP uploaded with ${networks.length} network(s)`);
    console.log(`  Networks: ${networkBssids.join(', ')}`);
    console.log(`  PCAP path: ${pcapPath}`);

    // Step 3: Start job
    console.log('🚀 Starting cracking job...');
    const jobResponse = await request.post('/api/jobs', {
      data: {
        name: 'E2E Test Job',
        networks: networkBssids,
        dictionaries: [dictionaryId],
        options: {
          attackMode: 0, // Dictionary attack
          hashType: 22000,
          workloadProfile: 3,
          gpuTempAbort: 90,
          optimizedKernelEnable: true,
          potfileDisable: true, // Disable potfile for tests to ensure passwords are actually cracked
        },
      },
      headers: authHeaders,
    });

    if (!jobResponse.ok()) {
      const errorData = await jobResponse.json();
      console.error('❌ Job creation failed:', errorData);
      throw new Error(
        `Job creation failed: ${JSON.stringify(errorData, null, 2)}`
      );
    }
    expect(jobResponse.ok()).toBeTruthy();
    const jobData = await jobResponse.json();
    expect(jobData.success).toBe(true);
    expect(jobData.data.id).toBeDefined();

    const jobId = jobData.data.id;
    console.log(`✓ Job started with ID: ${jobId}`);

    // Step 4: Wait for job to complete
    console.log('⏳ Waiting for job to complete...');
    let jobStatus;
    let attempts = 0;
    const maxAttempts = 120; // 2 minutes max (120 * 1 second)
    const pollInterval = 1000; // 1 second

    while (attempts < maxAttempts) {
      const statusResponse = await request.get(`/api/jobs/${jobId}/status`, {
        headers: authHeaders,
      });
      expect(statusResponse.ok()).toBeTruthy();

      const statusData = await statusResponse.json();
      expect(statusData.success).toBe(true);

      jobStatus = statusData.data;
      console.log(
        `  Status: ${jobStatus.status}, Progress: ${jobStatus.progress}%, Cracked: ${jobStatus.cracked}/${jobStatus.totalHashes}`
      );

      if (
        jobStatus.status === 'completed' ||
        jobStatus.status === 'cracked' ||
        jobStatus.status === 'exhausted'
      ) {
        console.log(`✓ Job finished with status: ${jobStatus.status}`);
        break;
      }

      if (jobStatus.status === 'failed' || jobStatus.status === 'error') {
        console.error(`❌ Job failed with status: ${jobStatus.status}`);
        console.error(`   Error: ${jobStatus.errorMessage || 'Unknown error'}`);
        throw new Error(
          `Job failed: ${jobStatus.errorMessage || 'Unknown error'}`
        );
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
      attempts++;
    }

    if (attempts >= maxAttempts) {
      throw new Error('Job did not complete within the timeout period');
    }

    // Step 5: Verify job was successful
    console.log('✅ Verifying job results...');
    expect(jobStatus).toBeDefined();
    expect(['completed', 'cracked', 'exhausted']).toContain(jobStatus.status);

    // The password "wireshark" should be in our dictionary and should crack successfully
    expect(jobStatus.cracked).toBeGreaterThan(0);
    expect(jobStatus.totalHashes).toBeGreaterThan(0);

    console.log(`✓ Job completed successfully!`);
    console.log(`  Total hashes: ${jobStatus.totalHashes}`);
    console.log(`  Cracked: ${jobStatus.cracked}`);
    console.log(`  Progress: ${jobStatus.progress}%`);
  });
});
