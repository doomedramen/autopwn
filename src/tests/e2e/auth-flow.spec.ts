import { test, expect } from '@playwright/test';

test.describe.serial('Authentication Flow', () => {
  test('should show setup page when no users exist', async ({ page }) => {
    // Clear any existing auth state
    await page.context().clearCookies();

    // Navigate directly to setup page since redirect logic is complex in test environment
    await page.goto('/setup');

    // Check setup page elements - the page shows "AutoPWN" as the main title and "Initialize System" as the card title
    await expect(page.locator('h1')).toContainText('AutoPWN');
    await expect(page.locator('text=Initialize System').first()).toBeVisible(); // Card title
    await expect(
      page.locator('text=Set up your AutoPWN instance')
    ).toBeVisible();
    await expect(
      page.locator('button:has-text("Initialize System")')
    ).toBeVisible();

    // Should show warning about random credentials
    await expect(
      page.locator('text=This will create the first superuser account')
    ).toBeVisible();
  });

  test('should create initial superuser successfully', async ({ page }) => {
    // Clear any existing auth state
    await page.context().clearCookies();

    await page.goto('/setup');

    // Click initialize button - wait for it to be visible and enabled
    await expect(
      page.locator('[data-testid="initialize-system-button"]')
    ).toBeVisible();
    await page.click('[data-testid="initialize-system-button"]');

    // Wait for success state
    await expect(page.locator('text=Initialization Complete!')).toBeVisible();
    await expect(
      page.locator('text=Your superuser account has been created')
    ).toBeVisible();

    // Check that credentials are displayed
    await expect(page.locator('text=🔐 Superuser Credentials:')).toBeVisible();
    await expect(page.locator('text=Email:')).toBeVisible();
    await expect(page.locator('text=Password:')).toBeVisible();
    await expect(page.locator('text=Username:')).toBeVisible();
    await expect(page.locator('text=Role: superuser')).toBeVisible();

    // Should show important warning
    await expect(
      page.locator('text=IMPORTANT: Save these credentials now!')
    ).toBeVisible();

    // Should have copy credentials button
    await expect(
      page.locator('button:has-text("Copy Credentials")')
    ).toBeVisible();

    // Should have go to login button
    await expect(page.locator('a:has-text("Go to Login")')).toBeVisible();

    // Verify credentials are extracted properly
    const emailText = await page
      .locator('[data-testid="superuser-email"]')
      .textContent();
    const password =
      (await page
        .locator('[data-testid="superuser-password"] span')
        .textContent()) || '';
    const username =
      (await page
        .locator('[data-testid="superuser-username"]')
        .textContent()) || '';

    expect(emailText?.replace('Email:', '').trim() || '').toBeTruthy();
    expect(password).toBeTruthy();
    expect(username?.replace('Username:', '').trim() || '').toBeTruthy();
  });

  test('should prevent initialization when system already initialized', async ({
    page,
  }) => {
    // Clear any existing auth state
    await page.context().clearCookies();

    // System is already initialized from previous test
    await page.goto('/setup');

    // Should show already initialized message
    await expect(page.locator('text=System Already Initialized')).toBeVisible();
    await expect(
      page.locator('text=The system has already been set up')
    ).toBeVisible();

    // Should have go to login button
    await expect(page.locator('a:has-text("Go to Login")')).toBeVisible();
  });

  test('should validate required fields on login', async ({ page }) => {
    // Clear any existing auth state
    await page.context().clearCookies();

    await page.goto('/login');

    // Try to submit empty form
    await page.click('button:has-text("Sign In")');

    // HTML5 validation should prevent submission
    // Check that email field is required
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveAttribute('required');

    // Check that password field is required
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toHaveAttribute('required');
  });
});

test.describe('Authentication Guards', () => {
  test('should redirect unauthenticated users to login', async ({ page }) => {
    // Try to access protected routes
    const protectedRoutes = ['/', '/networks', '/dictionaries', '/jobs'];

    for (const route of protectedRoutes) {
      await page.goto(route);
      // Should redirect to login
      await expect(page).toHaveURL(/.*\/login.*/);
    }
  });

  test('should allow access to public routes without authentication', async ({
    page,
  }) => {
    const publicRoutes = ['/login', '/setup'];

    for (const route of publicRoutes) {
      await page.goto(route);
      // Should be able to access public routes
      await expect(page).toHaveURL(new RegExp(`.*${route}.*`));
    }
  });

  test('should show login page with proper elements', async ({ page }) => {
    await page.goto('/login');

    // Check page title and branding
    await expect(page.locator('[data-testid="autopwn-title"]')).toContainText(
      'AutoPWN'
    );
    await expect(page.locator('text=Welcome Back')).toBeVisible();
    await expect(
      page.locator('text=Sign in to access your dashboard')
    ).toBeVisible();

    // Check form elements
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button:has-text("Sign In")')).toBeVisible();

    // Check link to setup page
    await expect(page.locator('text=First time setup?')).toBeVisible();
    await expect(
      page.locator('a:has-text("Initialize your system")')
    ).toBeVisible();
  });
});
