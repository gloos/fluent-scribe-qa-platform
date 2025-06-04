import { test, expect } from '@playwright/test';
import { 
  runAccessibilityScan, 
  verifySemanticHTML,
  testKeyboardNavigation
} from '../utils/accessibility';
import { WCAGAutomatedChecker, generateWCAGReport } from '../utils/wcag-checklist';
import path from 'path';

/**
 * Infrastructure Test - Validate Accessibility Testing Setup
 * 
 * This test validates that our accessibility testing infrastructure works correctly
 * by testing against a controlled static HTML page.
 */

test.describe('Accessibility Infrastructure Validation', () => {
  test('should validate accessibility utilities work correctly', async ({ page }) => {
    // Load the test HTML file
    const testPagePath = path.join(process.cwd(), 'test-accessibility-simple.html');
    await page.goto(`file://${testPagePath}`);
    
    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');
    
    console.log('Testing accessibility scan...');
    
    // Test 1: Run axe-core accessibility scan
    try {
      const results = await runAccessibilityScan(page, {
        tags: ['wcag2a', 'wcag2aa', 'wcag21aa']
      });
      
      console.log('✅ Axe-core scan completed successfully');
      console.log(`   - Violations: ${results.violations.length}`);
      console.log(`   - Passes: ${results.passes.length}`);
      
      // Should pass our well-formed test page
      expect(results.violations.length).toBe(0);
    } catch (error) {
      console.error('❌ Axe-core scan failed:', error);
      throw error;
    }
    
    // Test 2: Verify semantic HTML structure
    try {
      await verifySemanticHTML(page);
      console.log('✅ Semantic HTML verification completed');
    } catch (error) {
      console.error('❌ Semantic HTML verification failed:', error);
      throw error;
    }
    
    // Test 3: Run WCAG automated checks
    try {
      const checker = new WCAGAutomatedChecker(page);
      const wcagResults = await checker.runAllAutomatedChecks();
      
      const report = generateWCAGReport(wcagResults);
      
      console.log('✅ WCAG automated checks completed');
      console.log(`   - Total checks: ${report.summary.total}`);
      console.log(`   - Passed: ${report.summary.passed}`);
      console.log(`   - Failed: ${report.summary.failed}`);
      
      if (report.recommendations.length > 0) {
        console.log('   - Recommendations:');
        report.recommendations.forEach(rec => console.log(`     * ${rec}`));
      }
      
      // Our test page should pass all automated checks
      expect(report.summary.failed).toBe(0);
    } catch (error) {
      console.error('❌ WCAG automated checks failed:', error);
      throw error;
    }
    
    // Test 4: Basic keyboard navigation
    try {
      await testKeyboardNavigation(page, {
        skipLinks: ['#main-content'],
        interactiveElements: ['button', 'input', 'select', 'textarea', 'a']
      });
      console.log('✅ Keyboard navigation test completed');
    } catch (error) {
      console.error('❌ Keyboard navigation test failed:', error);
      throw error;
    }
  });

  test('should test individual WCAG criteria', async ({ page }) => {
    // Load the test HTML file
    const testPagePath = path.join(process.cwd(), 'test-accessibility-simple.html');
    await page.goto(`file://${testPagePath}`);
    await page.waitForLoadState('domcontentloaded');

    const checker = new WCAGAutomatedChecker(page);

    // Test individual criteria
    const pageTitle = await checker.checkPageTitle();
    expect(pageTitle.status).toBe('pass');
    console.log('✅ Page title check passed');

    const language = await checker.checkLanguage();
    expect(language.status).toBe('pass');
    console.log('✅ Language check passed');

    const headingStructure = await checker.checkHeadingStructure();
    expect(headingStructure.status).toBe('pass');
    console.log('✅ Heading structure check passed');

    const formLabels = await checker.checkFormLabels();
    expect(formLabels.status).toBe('pass');
    console.log('✅ Form labels check passed');

    const imageAltText = await checker.checkImageAltText();
    expect(imageAltText.status).toBe('pass');
    console.log('✅ Image alt text check passed');

    const focusVisibility = await checker.checkFocusVisibility();
    expect(focusVisibility.status).toBe('pass');
    console.log('✅ Focus visibility check passed');
  });

  test('should test focus management and keyboard interactions', async ({ page }) => {
    const testPagePath = path.join(process.cwd(), 'test-accessibility-simple.html');
    await page.goto(`file://${testPagePath}`);
    await page.waitForLoadState('domcontentloaded');

    // Test skip link
    console.log('Testing skip link functionality...');
    const skipLink = page.locator('.skip-link');
    await skipLink.focus();
    await expect(skipLink).toBeVisible();
    await skipLink.press('Enter');
    
    const mainContent = page.locator('#main-content');
    await expect(mainContent).toBeVisible();
    console.log('✅ Skip link functionality works');

    // Test modal keyboard interaction
    console.log('Testing modal keyboard interaction...');
    const openModalBtn = page.locator('button:has-text("Open Modal")');
    await openModalBtn.click();
    
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    
    // Close with Escape
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
    console.log('✅ Modal keyboard interaction works');

    // Test tab navigation
    console.log('Testing tab navigation...');
    const tabs = page.locator('[role="tab"]');
    const firstTab = tabs.first();
    await firstTab.focus();
    
    // Use arrow keys
    await page.keyboard.press('ArrowRight');
    const secondTab = tabs.nth(1);
    await expect(secondTab).toBeFocused();
    console.log('✅ Tab navigation works');
  });
}); 