import { test, expect } from '@playwright/test';
import { 
  runAccessibilityScan, 
  verifySemanticHTML,
  generateAccessibilityReport
} from '../utils/accessibility';
import { WCAGAutomatedChecker, generateWCAGReport } from '../utils/wcag-checklist';
import { TestHelpers } from '../utils/test-helpers';
import { testData } from '../utils/test-data';

/**
 * WCAG 2.1 AA Compliance Testing Suite
 * 
 * These tests verify that the application meets Web Content Accessibility Guidelines
 * Level AA standards across all major pages and user flows.
 */

const PAGES_TO_TEST = [
  { name: 'Home Page', url: '/' },
  { name: 'Dashboard', url: '/dashboard' },
  { name: 'Upload', url: '/upload' },
  { name: 'Admin', url: '/admin' },
  { name: 'Billing', url: '/billing' }
];

test.describe('WCAG 2.1 AA Compliance', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    
    // Clear storage and login before each test
    await helpers.clearStorage();
    await helpers.mockAPIResponse('**/api/auth/login', testData.mockResponses.authSuccess);
    await helpers.mockAPIResponse('**/api/dashboard/**', testData.mockResponses.dashboardMetrics);
    await helpers.mockAPIResponse('**/api/reports**', testData.mockResponses.reportsData);
    
    // Login for authenticated pages
    try {
      await helpers.login(testData.users.user.email, testData.users.user.password);
    } catch (error) {
      // Some pages might not require authentication, continue anyway
      console.log('Authentication skipped for this test');
    }
  });

  for (const pageInfo of PAGES_TO_TEST) {
    test.describe(pageInfo.name, () => {
      test(`should pass automated accessibility scan`, async ({ page }) => {
        // Navigate to page
        await page.goto(pageInfo.url);
        await page.waitForLoadState('networkidle');
        
        // Run comprehensive axe-core scan
        const results = await runAccessibilityScan(page, {
          tags: ['wcag2a', 'wcag2aa', 'wcag21aa'],
          // Exclude third-party components that we can't control
          exclude: ['.stripe-element', '[data-testid="captcha"]']
        });

        // Generate detailed report
        const report = await generateAccessibilityReport(page, `${pageInfo.name} - Automated Scan`);
        
        // Log summary for debugging
        console.log(`Accessibility Report for ${pageInfo.name}:`);
        console.log(`- Violations: ${report.summary.violationCount}`);
        console.log(`- Passes: ${report.summary.passCount}`);
        
        // Fail if any violations found
        expect(report.summary.violationCount).toBe(0);
      });

      test(`should have proper semantic HTML structure`, async ({ page }) => {
        await page.goto(pageInfo.url);
        await page.waitForLoadState('networkidle');
        
        // Verify semantic HTML
        await verifySemanticHTML(page);
      });

      test(`should pass WCAG automated checks`, async ({ page }) => {
        await page.goto(pageInfo.url);
        await page.waitForLoadState('networkidle');
        
        // Run automated WCAG checks
        const checker = new WCAGAutomatedChecker(page);
        const results = await checker.runAllAutomatedChecks();
        
        // Generate report
        const report = generateWCAGReport(results);
        
        // Log results
        console.log(`WCAG Automated Checks for ${pageInfo.name}:`);
        console.log(`- Total: ${report.summary.total}`);
        console.log(`- Passed: ${report.summary.passed}`);
        console.log(`- Failed: ${report.summary.failed}`);
        
        if (report.recommendations.length > 0) {
          console.log('Recommendations:');
          report.recommendations.forEach(rec => console.log(`- ${rec}`));
        }
        
        // All automated checks should pass
        expect(report.summary.failed).toBe(0);
      });

      test(`should have accessible page titles`, async ({ page }) => {
        await page.goto(pageInfo.url);
        await page.waitForLoadState('networkidle');
        
        const title = await page.title();
        
        // Title should exist and be descriptive
        expect(title).toBeTruthy();
        expect(title.length).toBeGreaterThan(0);
        expect(title.length).toBeLessThan(100); // Reasonable length
        
        // Title should be unique and descriptive for the page
        if (pageInfo.name === 'Dashboard') {
          expect(title).toContain('Dashboard');
        } else if (pageInfo.name === 'Upload') {
          expect(title).toContain('Upload');
        }
      });

      test(`should have proper language declaration`, async ({ page }) => {
        await page.goto(pageInfo.url);
        await page.waitForLoadState('networkidle');
        
        const htmlLang = await page.locator('html').getAttribute('lang');
        
        // HTML lang attribute should be present
        expect(htmlLang).toBeTruthy();
        expect(htmlLang).toMatch(/^[a-z]{2}(-[A-Z]{2})?$/); // Format: en, en-US, etc.
      });

      test(`should have proper heading hierarchy`, async ({ page }) => {
        await page.goto(pageInfo.url);
        await page.waitForLoadState('networkidle');
        
        const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
        
        // Should have at least one h1
        const h1Count = await page.locator('h1').count();
        expect(h1Count).toBeGreaterThanOrEqual(1);
        
        // Check heading order
        let previousLevel = 0;
        for (const heading of headings) {
          const tagName = await heading.evaluate(el => el.tagName.toLowerCase());
          const currentLevel = parseInt(tagName.slice(1));
          
          if (previousLevel > 0) {
            // Heading levels shouldn't skip (e.g., h1 -> h3)
            expect(currentLevel - previousLevel).toBeLessThanOrEqual(1);
          }
          
          previousLevel = currentLevel;
        }
      });

      test(`should have accessible landmarks`, async ({ page }) => {
        await page.goto(pageInfo.url);
        await page.waitForLoadState('networkidle');
        
        // Should have exactly one main landmark
        const mainCount = await page.locator('main, [role="main"]').count();
        expect(mainCount).toBe(1);
        
        // Should have navigation
        const navCount = await page.locator('nav, [role="navigation"]').count();
        expect(navCount).toBeGreaterThanOrEqual(1);
        
        // Check for optional landmarks
        const bannerCount = await page.locator('header, [role="banner"]').count();
        if (bannerCount > 0) {
          expect(bannerCount).toBeLessThanOrEqual(1);
        }
        
        const contentInfoCount = await page.locator('footer, [role="contentinfo"]').count();
        if (contentInfoCount > 0) {
          expect(contentInfoCount).toBeLessThanOrEqual(1);
        }
      });

      test(`should have accessible forms`, async ({ page }) => {
        await page.goto(pageInfo.url);
        await page.waitForLoadState('networkidle');
        
        const formControls = await page.locator('input:not([type="hidden"]), select, textarea').all();
        
        for (const control of formControls) {
          // Each form control should have an accessible name
          const hasAccessibleName = await hasAccessibleNameHelper(control);
          expect(hasAccessibleName).toBeTruthy();
          
          // Required fields should be properly indicated
          const required = await control.getAttribute('required');
          const ariaRequired = await control.getAttribute('aria-required');
          
          if (required !== null || ariaRequired === 'true') {
            // Required fields should have proper indication
            const ariaLabel = await control.getAttribute('aria-label') || '';
            const ariaDescribedBy = await control.getAttribute('aria-describedby');
            
            // Should have some indication of being required
            const hasRequiredIndication = 
              ariaLabel.includes('required') ||
              ariaLabel.includes('*') ||
              ariaDescribedBy !== null;
              
            expect(hasRequiredIndication).toBeTruthy();
          }
        }
      });

      test(`should have accessible images`, async ({ page }) => {
        await page.goto(pageInfo.url);
        await page.waitForLoadState('networkidle');
        
        const images = await page.locator('img').all();
        
        for (const img of images) {
          const alt = await img.getAttribute('alt');
          const role = await img.getAttribute('role');
          const src = await img.getAttribute('src');
          
          // Images should have alt text or role="presentation"
          const hasAltText = alt !== null;
          const isDecorative = role === 'presentation' || alt === '';
          
          expect(hasAltText || isDecorative).toBeTruthy();
          
          // Non-decorative images should have meaningful alt text
          if (!isDecorative && alt) {
            expect(alt.length).toBeGreaterThan(0);
            expect(alt.length).toBeLessThan(200); // Reasonable length
          }
        }
      });

      test(`should support high contrast mode`, async ({ page }) => {
        await page.goto(pageInfo.url);
        await page.waitForLoadState('networkidle');
        
        // Emulate high contrast mode
        await page.emulateMedia({ forcedColors: 'active' });
        
        // Run accessibility scan in high contrast mode
        const results = await runAccessibilityScan(page, {
          tags: ['wcag2a', 'wcag2aa'],
          disableRules: ['color-contrast'] // High contrast mode changes colors
        });
        
        // Should still pass accessibility tests
        expect(results.violations).toHaveLength(0);
      });

      test(`should be accessible at 200% zoom`, async ({ page }) => {
        await page.goto(pageInfo.url);
        await page.waitForLoadState('networkidle');
        
        // Set zoom to 200%
        await page.evaluate(() => {
          document.body.style.zoom = '2';
        });
        
        await page.waitForTimeout(1000); // Allow for layout changes
        
        // Check that content is still accessible
        const results = await runAccessibilityScan(page, {
          tags: ['wcag2aa']
        });
        
        expect(results.violations).toHaveLength(0);
        
        // Check that no horizontal scrolling is required (within reason)
        const hasHorizontalScroll = await page.evaluate(() => {
          return document.documentElement.scrollWidth > window.innerWidth + 50; // Allow small buffer
        });
        
        expect(hasHorizontalScroll).toBeFalsy();
      });
    });
  }
});

// Helper function to check if element has accessible name
async function hasAccessibleNameHelper(locator: any): Promise<boolean> {
  const element = locator.first();
  
  // Check for aria-label
  const ariaLabel = await element.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.trim()) return true;
  
  // Check for aria-labelledby
  const ariaLabelledBy = await element.getAttribute('aria-labelledby');
  if (ariaLabelledBy) {
    const labelElement = await element.page().locator(`#${ariaLabelledBy}`);
    const labelCount = await labelElement.count();
    if (labelCount > 0) return true;
  }
  
  // Check for associated label
  const id = await element.getAttribute('id');
  if (id) {
    const label = await element.page().locator(`label[for="${id}"]`);
    const labelCount = await label.count();
    if (labelCount > 0) return true;
  }
  
  // Check for wrapping label
  const parentLabel = await element.locator('xpath=ancestor::label').count();
  return parentLabel > 0;
} 