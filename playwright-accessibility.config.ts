import { defineConfig, devices } from '@playwright/test';

/**
 * Accessibility-focused Playwright configuration
 * This config is designed for accessibility testing that can run independently
 */
export default defineConfig({
  testDir: './e2e/accessibility',
  /* Run tests in files in parallel */
  fullyParallel: false, // Sequential for accessibility testing
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 1 : 0,
  /* Opt out of parallel tests on CI. */
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: 'test-results/accessibility-report' }],
    ['json', { outputFile: 'test-results/accessibility-results.json' }],
    ['line']
  ],
  /* Shared settings for all the projects below. */
  use: {
    /* Base URL - can be changed to external URL if needed */
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:5173',
    
    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',
    
    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
    
    /* Record video on failure */
    video: 'retain-on-failure',
    
    /* Accessibility-specific timeouts */
    actionTimeout: 10000,
    navigationTimeout: 20000,
  },

  /* Configure projects for accessibility testing */
  projects: [
    {
      name: 'accessibility-chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Accessibility-specific settings
        colorScheme: 'light',
        viewport: { width: 1280, height: 720 }
      },
    },
    {
      name: 'accessibility-firefox',
      use: { 
        ...devices['Desktop Firefox'],
        colorScheme: 'light',
        viewport: { width: 1280, height: 720 }
      },
    },
    {
      name: 'accessibility-mobile',
      use: { 
        ...devices['iPhone 12'],
        // Test mobile accessibility
      },
    },
  ],

  /* Only start webServer if not running against external URL */
  ...(process.env.TEST_BASE_URL ? {} : {
    webServer: {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  }),
  
  /* Test timeout */
  timeout: 45000,
  
  /* Test output directory */
  outputDir: 'test-results/accessibility/',
  
  /* Expect timeout for assertions */
  expect: {
    timeout: 8000,
  },
}); 