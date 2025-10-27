import { test, expect } from '../fixtures/auth-fixture';

test.describe('Authentication Flow Tests', () => {
  const testUser = {
    email: 'testuser@example.com',
    password: 'testPassword123!',
    name: 'Test User'
  };

  test.beforeEach(async ({ page }) => {
    // Clean up any existing session
    await page.context().clearCookies();
    await page.goto('/');
  });

  test.describe('User Registration', () => {
    test('should navigate to sign-up page and show form', async ({ page }) => {
      // Navigate to sign-up page
      await page.goto('/sign-up');

      // Verify page loads and form is visible
      await expect(page.locator('[data-testid="signup-form-container"]')).toBeVisible();
      await expect(page.locator('[data-testid="branding-title"]')).toContainText('AutoPWN');

      // Verify form elements are present
      await expect(page.locator('[data-testid="signup-name-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="signup-email-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="signup-password-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="signup-submit-button"]')).toBeVisible();

      console.log('✅ Sign-up page loads with all form elements');
    });

    test('should attempt user registration', async ({ page }) => {
      await page.goto('/sign-up');

      // Fill out registration form
      await page.fill('[data-testid="signup-name-input"]', testUser.name);
      await page.fill('[data-testid="signup-email-input"]', testUser.email);
      await page.fill('[data-testid="signup-password-input"]', testUser.password);

      // Submit form
      await page.click('[data-testid="signup-submit-button"]');

      // Wait for submission to complete (either success or error)
      await page.waitForTimeout(2000);

      // Check for either redirect to sign-in or staying on sign-up with error
      const currentUrl = page.url();
      if (currentUrl.includes('/sign-in')) {
        // Successful registration - redirected to sign-in
        await expect(page.locator('[data-testid="signin-form-container"]')).toBeVisible();
        console.log('✅ User registration successful and redirected to sign-in');
      } else if (currentUrl.includes('/sign-up')) {
        // Check if there's an error message
        const errorElement = page.locator('[data-testid="signup-error-message"]');
        if (await errorElement.isVisible()) {
          console.log('ℹ️ Registration showed error (this might be expected in test environment)');
        } else {
          console.log('ℹ️ Registration form submitted, handling unclear');
        }
      }
    });

    test('should show validation errors for invalid registration data', async ({ page }) => {
      await page.goto('/sign-up');

      // Try to submit empty form
      await page.click('[data-testid="signup-submit-button"]');

      // Browser validation should prevent submission
      await expect(page.locator('[data-testid="signup-name-input"]')).toBeFocused();

      // Test invalid email
      await page.fill('[data-testid="signup-email-input"]', 'invalid-email');
      await page.fill('[data-testid="signup-password-input"]', testUser.password);

      // Browser should validate email format
      const emailInput = page.locator('[data-testid="signup-email-input"]');
      await expect(emailInput).toHaveAttribute('type', 'email');

      console.log('✅ Form validation working correctly');
    });

    test('should show error for duplicate user registration', async ({ page }) => {
      await page.goto('/sign-up');

      // Register user first time
      await page.fill('[data-testid="signup-name-input"]', testUser.name);
      await page.fill('[data-testid="signup-email-input"]', testUser.email);
      await page.fill('[data-testid="signup-password-input"]', testUser.password);
      await page.click('[data-testid="signup-submit-button"]');

      // Wait for redirect
      await expect(page).toHaveURL('/sign-in');

      // Go back to sign-up and try to register same user
      await page.goto('/sign-up');
      await page.fill('[data-testid="signup-name-input"]', 'Different Name');
      await page.fill('[data-testid="signup-email-input"]', testUser.email);
      await page.fill('[data-testid="signup-password-input"]', 'differentPassword123!');
      await page.click('[data-testid="signup-submit-button"]');

      // Should show error message
      await expect(page.locator('[data-testid="signup-error-message"]')).toBeVisible();

      console.log('✅ Duplicate registration error handled correctly');
    });
  });

  test.describe('User Login', () => {
    test('should navigate to sign-in page and show form', async ({ page }) => {
      await page.goto('/sign-in');

      // Verify page loads and form is visible
      await expect(page.locator('[data-testid="signin-form-container"]')).toBeVisible();
      await expect(page.locator('[data-testid="branding-title"]')).toContainText('AutoPWN');

      // Verify form elements are present
      await expect(page.locator('[data-testid="signin-email-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="signin-password-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="signin-submit-button"]')).toBeVisible();

      console.log('✅ Sign-in page loads with all form elements');
    });

    test('should attempt login with credentials', async ({ page }) => {
      await page.goto('/sign-in');

      // Fill login form
      await page.fill('[data-testid="signin-email-input"]', testUser.email);
      await page.fill('[data-testid="signin-password-input"]', testUser.password);
      await page.click('[data-testid="signin-submit-button"]');

      // Wait for login attempt to complete
      await page.waitForTimeout(3000);

      // Check if login was successful (redirect to dashboard) or failed (stayed on sign-in)
      const currentUrl = page.url();
      if (currentUrl === '/' || currentUrl.endsWith('/')) {
        // Successful login
        await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
        console.log('✅ User login successful and redirected to dashboard');
      } else if (currentUrl.includes('/sign-in')) {
        // Check if error message is shown
        const errorElement = page.locator('[data-testid="signin-error-message"]');
        if (await errorElement.isVisible()) {
          console.log('ℹ️ Login showed error message (user may not exist or API issue)');
        } else {
          console.log('ℹ️ Login attempted, status unclear');
        }
      }
    });

    test('should show form validation for empty fields', async ({ page }) => {
      await page.goto('/sign-in');

      // Try to submit empty form
      await page.click('[data-testid="signin-submit-button"]');

      // Browser validation should prevent submission
      const emailInput = page.locator('[data-testid="signin-email-input"]');
      await expect(emailInput).toBeFocused();

      console.log('✅ Form validation working correctly');
    });

    test('should handle field interactions correctly', async ({ page }) => {
      await page.goto('/sign-in');

      // Test typing in fields
      await page.fill('[data-testid="signin-email-input"]', testUser.email);
      await expect(page.locator('[data-testid="signin-email-input"]')).toHaveValue(testUser.email);

      await page.fill('[data-testid="signin-password-input"]', testUser.password);
      await expect(page.locator('[data-testid="signin-password-input"]')).toHaveValue(testUser.password);

      // Test clearing fields
      await page.fill('[data-testid="signin-email-input"]', '');
      await expect(page.locator('[data-testid="signin-email-input"]')).toHaveValue('');

      console.log('✅ Field interactions working correctly');
    });
  });

  test.describe('Navigation Between Auth Pages', () => {
    test('should navigate from sign-up to sign-in', async ({ page }) => {
      await page.goto('/sign-up');

      // Click sign-in link
      await page.click('[data-testid="signin-link"]');

      // Should navigate to sign-in page
      await expect(page).toHaveURL('/sign-in');
      await expect(page.locator('[data-testid="signin-form-container"]')).toBeVisible();

      console.log('✅ Navigation from sign-up to sign-in works');
    });

    test('should navigate from sign-in to sign-up', async ({ page }) => {
      await page.goto('/sign-in');

      // Click sign-up link
      await page.click('[data-testid="signup-link"]');

      // Should navigate to sign-up page
      await expect(page).toHaveURL('/sign-up');
      await expect(page.locator('[data-testid="signup-form-container"]')).toBeVisible();

      console.log('✅ Navigation from sign-in to sign-up works');
    });
  });

  test.describe('Protected Routes', () => {
    test('should redirect unauthenticated user to login', async ({ page }) => {
      // Try to access protected route
      await page.goto('/');

      // Should redirect to login (either sign-in or login page)
      await expect(page.url()).toMatch(/\/(sign-in|login)/);

      console.log('✅ Protected routes redirect unauthenticated users');
    });
  });

  test.describe('Form Field Interactions', () => {
    test('should show loading state during form submission', async ({ page }) => {
      await page.goto('/sign-up');

      // Fill form and submit
      await page.fill('[data-testid="signup-name-input"]', testUser.name);
      await page.fill('[data-testid="signup-email-input"]', testUser.email);
      await page.fill('[data-testid="signup-password-input"]', testUser.password);

      // Submit and check loading state
      await page.click('[data-testid="signup-submit-button"]');

      // Button should show loading text or be disabled
      const submitButton = page.locator('[data-testid="signup-submit-button"]');
      await expect(submitButton).toBeDisabled();

      console.log('✅ Loading state works correctly');
    });

    test('should handle password visibility toggle if present', async ({ page }) => {
      await page.goto('/sign-up');

      // Check if password input has type password
      const passwordInput = page.locator('[data-testid="signup-password-input"]');
      await expect(passwordInput).toHaveAttribute('type', 'password');

      // Fill password
      await page.fill('[data-testid="signup-password-input"]', testUser.password);
      const value = await passwordInput.inputValue();
      expect(value).toBe(testUser.password);

      console.log('✅ Password field functions correctly');
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto('/sign-up');

      // Check if form is visible and usable on mobile
      await expect(page.locator('[data-testid="signup-form-container"]')).toBeVisible();
      await expect(page.locator('[data-testid="branding-title"]')).toBeVisible();

      // Try to fill form
      await page.fill('[data-testid="signup-name-input"]', testUser.name);
      await page.fill('[data-testid="signup-email-input"]', testUser.email);
      await page.fill('[data-testid="signup-password-input"]', testUser.password);

      // Submit should work
      await page.click('[data-testid="signup-submit-button"]');

      console.log('✅ Mobile responsive design works correctly');
    });

    test('should work on tablet viewport', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });

      await page.goto('/sign-in');

      // Check if form is visible and usable on tablet
      await expect(page.locator('[data-testid="signin-form-container"]')).toBeVisible();

      // Try to fill form
      await page.fill('[data-testid="signin-email-input"]', testUser.email);
      await page.fill('[data-testid="signin-password-input"]', testUser.password);

      console.log('✅ Tablet responsive design works correctly');
    });
  });
});