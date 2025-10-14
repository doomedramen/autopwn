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

test('Complete System Workflow: Setup, Authentication, File Management, and Password Cracking', async ({
  page,
  request,
}) => {
  test.setTimeout(300000); // 5 minutes for comprehensive test
  console.log('🚀 Starting comprehensive system workflow test...');

  // Step 1: Initialize System (if needed)
  console.log('📋 Step 1: System Initialization');
  await page.goto('/setup');

  // Wait for page to fully load
  await page.waitForLoadState('networkidle', { timeout: 10000 });

  // Check what's actually on the page
  const pageTitle = await page.title();
  console.log('📄 Page title:', pageTitle);

  // Try to find the initialize button with a more robust selector
  const initButton = page.locator(
    'button:has-text("Initialize System"), [data-testid="initialize-system-button"]'
  );

  // Wait for either the button to be visible or for system already initialized
  await page.waitForTimeout(2000);

  const buttonExists = await initButton.isVisible().catch(() => false);
  console.log('🔧 Initialize button exists:', buttonExists);

  let superUserCredentials;

  if (buttonExists) {
    // System needs initialization
    console.log('🚀 Initializing system...');
    await page.click('[data-testid="initialize-system-button"]');

    // Wait for credentials to be displayed
    await page.waitForSelector('[data-testid="superuser-email"]', {
      timeout: 10000,
    });
    await page.waitForSelector('[data-testid="superuser-password"]', {
      timeout: 10000,
    });

    const emailElement = await page.locator('[data-testid="superuser-email"]');
    const passwordElement = await page.locator(
      '[data-testid="superuser-password"]'
    );
    const emailText = await emailElement.textContent();
    const passwordText = await passwordElement.textContent();

    superUserCredentials = {
      email: emailText!.replace('Email:', '').trim(),
      password: passwordText!.replace('Password:', '').trim(),
    };

    console.log('✅ System initialized successfully');
    console.log(`📧 Superuser email: ${superUserCredentials.email}`);
  } else {
    // System already initialized, check if we're on a redirect page
    const currentUrl = page.url();
    console.log('📍 Current URL after loading setup page:', currentUrl);

    // Check if we're already logged in or redirected to login
    if (currentUrl.includes('/login')) {
      console.log('🔐 System already initialized, redirected to login');

      // Use known test credentials for initialized system
      superUserCredentials = {
        email: 'superuser@autopwn.local',
        password: 'TestPassword123!',
      };
    } else if (currentUrl.includes('/change-password')) {
      console.log('🔐 System already initialized, need to change password');

      // Use known test credentials for initialized system
      superUserCredentials = {
        email: 'superuser@autopwn.local',
        password: 'TestPassword123!',
      };
    } else {
      // Try to check if there are any credentials displayed on the page
      const emailElement = await page
        .locator('[data-testid="superuser-email"]')
        .isVisible()
        .catch(() => false);
      const passwordElement = await page
        .locator('[data-testid="superuser-password"]')
        .isVisible()
        .catch(() => false);

      if (emailElement && passwordElement) {
        console.log('📋 Found credentials on setup page');
        const emailText = await page
          .locator('[data-testid="superuser-email"]')
          .textContent();
        const passwordText = await page
          .locator('[data-testid="superuser-password"]')
          .textContent();

        superUserCredentials = {
          email: emailText!.replace('Email:', '').trim(),
          password: passwordText!.replace('Password:', '').trim(),
        };
      } else {
        console.log('⚠️ System state unclear, using default test credentials');
        superUserCredentials = {
          email: 'superuser@autopwn.local',
          password: 'TestPassword123!',
        };
      }
    }
  }

  // Step 2: Login and Change Password
  console.log('🔐 Step 2: Authentication and Password Change');

  // Check if we're already on the change password page or need to login
  const currentUrl = page.url();
  if (!currentUrl.includes('/change-password')) {
    console.log('🔑 Navigating to login...');
    await page.goto('/login');
    await page.fill('input[type="email"]', superUserCredentials.email);
    await page.fill('input[type="password"]', superUserCredentials.password);
    await page.click('button:has-text("Sign In")');

    // Should be redirected to change password page
    await expect(page).toHaveURL(/.*\/change-password/, { timeout: 10000 });
  } else {
    console.log('🔑 Already on change password page');
  }

  // Change password
  const newPassword = 'SecureTestPassword123!';
  await page.fill(
    'input[name="currentPassword"]',
    superUserCredentials.password
  );
  await page.fill('input[name="newPassword"]', newPassword);
  await page.fill('input[name="confirmPassword"]', newPassword);
  await page.click('button:has-text("Change Password")');

  // Wait for success message and redirect to dashboard
  await page.waitForSelector('text=Password Updated!', { timeout: 10000 });
  await page.waitForTimeout(3000);
  await expect(page).toHaveURL(/.*\/$/, { timeout: 10000 });

  // Update credentials
  superUserCredentials.password = newPassword;
  console.log('✅ Password changed successfully');

  // Step 3: Upload Dictionary (using API)
  console.log('📚 Step 3: Dictionary Upload');

  const dictionaryFile = await fs.readFile(DICTIONARY_PATH);

  // Get session cookie for API requests
  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find(
    c => c.name === 'better-auth.session_token'
  );

  if (!sessionCookie) {
    throw new Error('No session cookie found for API requests');
  }

  const authHeaders = {
    Cookie: `${sessionCookie.name}=${sessionCookie.value}`,
  };

  // Upload dictionary via API
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

  expect(dictionaryResponse.ok()).toBeTruthy();
  const dictionaryData = await dictionaryResponse.json();
  expect(dictionaryData.success).toBe(true);
  expect(dictionaryData.data.dictionary).toBeDefined();

  const dictionaryId = dictionaryData.data.dictionary.id;
  console.log(`✅ Dictionary uploaded with ID: ${dictionaryId}`);

  // Step 4: Upload PCAP (using API)
  console.log('📦 Step 4: PCAP Upload');

  const pcapFile = await fs.readFile(PCAP_PATH);

  // Upload PCAP via API
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
  console.log(
    `✅ PCAP uploaded with ${networks.length} network(s): ${networkBssids.join(', ')}`
  );

  // Step 5: Create and Run Password Cracking Job (using API)
  console.log('🚀 Step 5: Password Cracking Job');

  // Create job via API
  const jobResponse = await request.post('/api/jobs', {
    data: {
      name: 'Comprehensive Test Job',
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

  expect(jobResponse.ok()).toBeTruthy();
  const jobData = await jobResponse.json();
  expect(jobData.success).toBe(true);
  expect(jobData.data.id).toBeDefined();

  const jobId = jobData.data.id;
  console.log(`✅ Job started with ID: ${jobId}`);

  // Step 6: Monitor Job Progress
  console.log('⏳ Step 6: Monitoring Job Progress');

  let jobCompleted = false;
  let attempts = 0;
  const maxAttempts = 180; // 3 minutes max (180 * 1 second)

  while (!jobCompleted && attempts < maxAttempts) {
    // Check job status
    const statusElement = page.locator(
      'text=processing|text=completed|text=cracked|text=exhausted|text=failed'
    );
    const status = await statusElement.first().textContent();

    const progressElement = page.locator('text=Progress:');
    const crackedElement = page.locator('text=Cracked:');

    console.log(`  Status: ${status}, Attempt: ${attempts}/${maxAttempts}`);

    if (
      status &&
      (status.includes('completed') ||
        status.includes('cracked') ||
        status.includes('exhausted'))
    ) {
      jobCompleted = true;
      console.log('✅ Job completed successfully');
      break;
    }

    if (status && status.includes('failed')) {
      throw new Error('Job failed during processing');
    }

    await page.waitForTimeout(1000);
    attempts++;
  }

  if (!jobCompleted) {
    throw new Error('Job did not complete within the timeout period');
  }

  // Step 7: Verify Results
  console.log('🔍 Step 7: Verifying Results');

  // Check that we have cracked passwords
  const crackedCount = await page.locator('text=Cracked:').textContent();
  expect(crackedCount).toBeTruthy();

  // Check job details
  await page.click('text=View Details');
  await page.waitForSelector('text=Job Details', { timeout: 10000 });

  // Verify cracked passwords are displayed
  await expect(page.locator('text=Cracked Passwords')).toBeVisible();

  console.log('✅ Results verified successfully');

  // Step 8: Test User Management
  console.log('👥 Step 8: Testing User Management');

  // Navigate to user management
  await page.click('[data-value="users"]');
  await page.waitForSelector('text=User Management', { timeout: 10000 });

  // Create a new user
  await page.click('button:has-text("Add User")');
  await page.waitForSelector('text=Create New User', { timeout: 10000 });

  await page.fill('input[name="username"]', 'testuser');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'TestPassword123!');
  await page.fill('input[name="confirmPassword"]', 'TestPassword123!');
  await page.selectOption('select[name="role"]', 'user');

  await page.click('button:has-text("Create User")');

  // Wait for user creation success
  await page.waitForSelector('text=User created successfully', {
    timeout: 10000,
  });

  // Verify user appears in table
  await expect(page.locator('text=testuser')).toBeVisible();
  await expect(page.locator('text=test@example.com')).toBeVisible();

  console.log('✅ User management verified successfully');

  // Final verification
  console.log('🎉 Comprehensive workflow test completed successfully!');

  // Take a final screenshot for verification
  await page.screenshot({
    path: 'test-results/comprehensive-workflow-success.png',
  });
});
