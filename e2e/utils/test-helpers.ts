import { Page, expect } from '@playwright/test';

export class TestHelpers {
  constructor(private page: Page) {}

  /**
   * Navigate to a specific page and wait for it to load
   */
  async navigateToPage(path: string) {
    await this.page.goto(path);
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Fill in login form and submit
   */
  async login(email: string, password: string) {
    await this.navigateToPage('/auth/login');
    
    // Wait for login form to be visible
    await expect(this.page.locator('form')).toBeVisible();
    
    // Fill in credentials
    await this.page.fill('input[type="email"]', email);
    await this.page.fill('input[type="password"]', password);
    
    // Submit form
    await this.page.click('button[type="submit"]');
    
    // Wait for redirect after successful login
    await this.page.waitForURL('**/dashboard');
  }

  /**
   * Register a new user account
   */
  async register(email: string, password: string, name?: string) {
    await this.navigateToPage('/auth/register');
    
    // Wait for registration form
    await expect(this.page.locator('form')).toBeVisible();
    
    // Fill in registration details
    if (name) {
      await this.page.fill('input[name="name"]', name);
    }
    await this.page.fill('input[type="email"]', email);
    await this.page.fill('input[type="password"]', password);
    
    // Submit registration
    await this.page.click('button[type="submit"]');
  }

  /**
   * Logout current user
   */
  async logout() {
    // Look for user menu or logout button
    const userMenu = this.page.locator('[data-testid="user-menu"]');
    if (await userMenu.isVisible()) {
      await userMenu.click();
      await this.page.click('[data-testid="logout-button"]');
    }
    
    // Wait for redirect to login page
    await this.page.waitForURL('**/auth/login');
  }

  /**
   * Upload a file through the upload interface
   */
  async uploadFile(filePath: string, fileType: string = 'document') {
    await this.navigateToPage('/upload');
    
    // Wait for upload interface
    await expect(this.page.locator('[data-testid="file-upload"]')).toBeVisible();
    
    // Upload file
    const fileInput = this.page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);
    
    // Wait for upload to complete
    await expect(this.page.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 30000 });
  }

  /**
   * Wait for a toast notification with specific message
   */
  async waitForToast(message: string, type: 'success' | 'error' | 'warning' = 'success') {
    const toastSelector = `[data-testid="toast-${type}"]`;
    await expect(this.page.locator(toastSelector)).toContainText(message);
  }

  /**
   * Check if user is authenticated by verifying dashboard access
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      await this.navigateToPage('/dashboard');
      await this.page.waitForSelector('[data-testid="dashboard-content"]', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Fill form fields by label text
   */
  async fillFormByLabel(label: string, value: string) {
    const input = this.page.locator(`label:has-text("${label}") + input, label:has-text("${label}") input`);
    await input.fill(value);
  }

  /**
   * Click button by text content
   */
  async clickButtonByText(text: string) {
    await this.page.click(`button:has-text("${text}")`);
  }

  /**
   * Wait for page to load completely
   */
  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Take a screenshot with a descriptive name
   */
  async takeScreenshot(name: string) {
    await this.page.screenshot({ path: `test-results/screenshots/${name}.png`, fullPage: true });
  }

  /**
   * Check if element exists without waiting
   */
  async elementExists(selector: string): Promise<boolean> {
    return await this.page.locator(selector).count() > 0;
  }

  /**
   * Scroll element into view
   */
  async scrollToElement(selector: string) {
    await this.page.locator(selector).scrollIntoViewIfNeeded();
  }

  /**
   * Wait for API response
   */
  async waitForAPIResponse(urlPattern: string, timeout: number = 10000) {
    return await this.page.waitForResponse(urlPattern, { timeout });
  }

  /**
   * Mock API response for testing
   */
  async mockAPIResponse(urlPattern: string, response: any) {
    await this.page.route(urlPattern, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response)
      });
    });
  }

  /**
   * Get current page URL
   */
  getCurrentURL(): string {
    return this.page.url();
  }

  /**
   * Clear browser storage
   */
  async clearStorage() {
    await this.page.context().clearCookies();
    await this.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  }
} 