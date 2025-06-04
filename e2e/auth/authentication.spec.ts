import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';
import { testData, generateUniqueEmail } from '../utils/test-data';

test.describe('Authentication Flow', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    // Clear any existing authentication state
    await helpers.clearStorage();
  });

  test.describe('User Registration', () => {
    test('should allow new user registration with valid details', async ({ page }) => {
      const newUser = testData.users.newUser();
      
      await helpers.navigateToPage('/auth/register');
      
      // Verify registration form is visible
      await expect(page.locator('form')).toBeVisible();
      
      // Fill registration form
      await helpers.fillFormByLabel('Email', newUser.email);
      await helpers.fillFormByLabel('Password', newUser.password);
      if (await helpers.elementExists('input[name="name"]')) {
        await helpers.fillFormByLabel('Name', newUser.name);
      }
      
      // Submit registration
      await helpers.clickButtonByText('Sign Up');
      
      // Should redirect to email verification or dashboard
      await page.waitForURL(/\/(auth\/verify-email|dashboard)/, { timeout: 10000 });
      
      // Take screenshot for visual verification
      await helpers.takeScreenshot('registration-success');
    });

    test('should show validation errors for invalid registration data', async ({ page }) => {
      await helpers.navigateToPage('/auth/register');
      
      // Try to submit empty form
      await helpers.clickButtonByText('Sign Up');
      
      // Should show validation errors
      await expect(page.locator('[data-testid="error-message"], .error, [role="alert"]')).toBeVisible();
      
      // Try with invalid email
      await helpers.fillFormByLabel('Email', 'invalid-email');
      await helpers.fillFormByLabel('Password', 'weak');
      await helpers.clickButtonByText('Sign Up');
      
      // Should still show validation errors
      await expect(page.locator('[data-testid="error-message"], .error, [role="alert"]')).toBeVisible();
    });

    test('should prevent registration with existing email', async ({ page }) => {
      await helpers.navigateToPage('/auth/register');
      
      // Try to register with existing user email
      await helpers.fillFormByLabel('Email', testData.users.user.email);
      await helpers.fillFormByLabel('Password', testData.users.user.password);
      await helpers.clickButtonByText('Sign Up');
      
      // Should show error about existing email
      await expect(page.locator('[data-testid="error-message"], .error')).toContainText(/already exists|already registered/i);
    });
  });

  test.describe('User Login', () => {
    test('should allow login with valid credentials', async ({ page }) => {
      // Mock successful authentication response
      await helpers.mockAPIResponse('**/api/auth/login', testData.mockResponses.authSuccess);
      
      await helpers.navigateToPage('/auth/login');
      
      // Fill login form
      await helpers.fillFormByLabel('Email', testData.users.user.email);
      await helpers.fillFormByLabel('Password', testData.users.user.password);
      
      // Submit login
      await helpers.clickButtonByText('Sign In');
      
      // Should redirect to dashboard
      await page.waitForURL('**/dashboard', { timeout: 10000 });
      
      // Verify dashboard content is loaded
      await expect(page.locator('[data-testid="dashboard-content"], h1, .dashboard')).toBeVisible();
      
      await helpers.takeScreenshot('login-success-dashboard');
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await helpers.navigateToPage('/auth/login');
      
      // Fill with invalid credentials
      await helpers.fillFormByLabel('Email', 'invalid@test.com');
      await helpers.fillFormByLabel('Password', 'wrongpassword');
      
      // Submit login
      await helpers.clickButtonByText('Sign In');
      
      // Should show error message
      await expect(page.locator('[data-testid="error-message"], .error, [role="alert"]')).toBeVisible();
      
      // Should remain on login page
      await expect(page).toHaveURL(/\/auth\/login/);
    });

    test('should validate required fields on login form', async ({ page }) => {
      await helpers.navigateToPage('/auth/login');
      
      // Try to submit empty form
      await helpers.clickButtonByText('Sign In');
      
      // Should show validation errors for required fields
      await expect(page.locator('[data-testid="error-message"], .error, [role="alert"]')).toBeVisible();
      
      // Fill only email
      await helpers.fillFormByLabel('Email', testData.users.user.email);
      await helpers.clickButtonByText('Sign In');
      
      // Should still show password required error
      await expect(page.locator('[data-testid="error-message"], .error, [role="alert"]')).toBeVisible();
    });
  });

  test.describe('Password Reset', () => {
    test('should allow password reset request', async ({ page }) => {
      await helpers.navigateToPage('/auth/forgot-password');
      
      // Fill email for password reset
      await helpers.fillFormByLabel('Email', testData.users.user.email);
      
      // Submit reset request
      await helpers.clickButtonByText('Send Reset Link');
      
      // Should show success message
      await expect(page.locator('[data-testid="success-message"], .success')).toBeVisible();
    });

    test('should handle password reset with reset token', async ({ page }) => {
      // Simulate having a reset token (normally from email link)
      await helpers.navigateToPage('/auth/reset-password?token=test-reset-token');
      
      // Fill new password
      await helpers.fillFormByLabel('Password', 'NewTestPassword123!');
      await helpers.fillFormByLabel('Confirm Password', 'NewTestPassword123!');
      
      // Submit password reset
      await helpers.clickButtonByText('Reset Password');
      
      // Should redirect to login with success message
      await page.waitForURL('**/auth/login');
      await expect(page.locator('[data-testid="success-message"], .success')).toBeVisible();
    });
  });

  test.describe('Email Verification', () => {
    test('should handle email verification process', async ({ page }) => {
      // Simulate email verification link
      await helpers.navigateToPage('/auth/verify-email?token=test-verification-token');
      
      // Should show verification in progress
      await expect(page.locator('[data-testid="loading-spinner"], .loading')).toBeVisible();
      
      // Wait for verification to complete
      await helpers.waitForPageLoad();
      
      // Should show success message or redirect to dashboard
      const isSuccessPage = await helpers.elementExists('[data-testid="success-message"], .success');
      const isDashboard = page.url().includes('/dashboard');
      
      expect(isSuccessPage || isDashboard).toBeTruthy();
    });
  });

  test.describe('Logout', () => {
    test('should allow user to logout', async ({ page }) => {
      // First login
      await helpers.mockAPIResponse('**/api/auth/login', testData.mockResponses.authSuccess);
      await helpers.login(testData.users.user.email, testData.users.user.password);
      
      // Verify we're on dashboard
      await expect(page).toHaveURL(/\/dashboard/);
      
      // Logout
      await helpers.logout();
      
      // Should be redirected to login page
      await expect(page).toHaveURL(/\/auth\/login/);
      
      // Verify we can't access protected routes
      await helpers.navigateToPage('/dashboard');
      await expect(page).toHaveURL(/\/auth\/login/);
    });
  });

  test.describe('Protected Routes', () => {
    test('should redirect unauthenticated users to login', async ({ page }) => {
      const protectedRoutes = ['/dashboard', '/upload', '/reports', '/billing', '/profile'];
      
      for (const route of protectedRoutes) {
        await helpers.navigateToPage(route);
        
        // Should be redirected to login
        await expect(page).toHaveURL(/\/auth\/login/);
      }
    });

    test('should allow access to protected routes when authenticated', async ({ page }) => {
      // Login first
      await helpers.mockAPIResponse('**/api/auth/login', testData.mockResponses.authSuccess);
      await helpers.login(testData.users.user.email, testData.users.user.password);
      
      // Test access to various protected routes
      const routes = [
        { path: '/dashboard', expectedContent: '[data-testid="dashboard-content"], .dashboard, h1' },
        { path: '/upload', expectedContent: '[data-testid="upload-form"], .upload, input[type="file"]' },
        { path: '/reports', expectedContent: '[data-testid="reports-list"], .reports, table' },
        { path: '/profile', expectedContent: '[data-testid="profile-form"], .profile, form' }
      ];
      
      for (const route of routes) {
        await helpers.navigateToPage(route.path);
        
        // Should not be redirected to login
        await expect(page).not.toHaveURL(/\/auth\/login/);
        
        // Should show expected content
        await expect(page.locator(route.expectedContent)).toBeVisible({ timeout: 10000 });
      }
    });
  });

  test.describe('Session Management', () => {
    test('should maintain session across page reloads', async ({ page }) => {
      // Login
      await helpers.mockAPIResponse('**/api/auth/login', testData.mockResponses.authSuccess);
      await helpers.login(testData.users.user.email, testData.users.user.password);
      
      // Reload page
      await page.reload();
      
      // Should still be authenticated
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.locator('[data-testid="dashboard-content"], .dashboard')).toBeVisible();
    });

    test('should handle session expiration gracefully', async ({ page }) => {
      // Login first
      await helpers.mockAPIResponse('**/api/auth/login', testData.mockResponses.authSuccess);
      await helpers.login(testData.users.user.email, testData.users.user.password);
      
      // Mock session expiration
      await helpers.mockAPIResponse('**/api/**', { error: 'Session expired', status: 401 });
      
      // Try to access a protected resource
      await helpers.navigateToPage('/reports');
      
      // Should be redirected to login due to expired session
      await page.waitForURL(/\/auth\/login/, { timeout: 10000 });
    });
  });
}); 