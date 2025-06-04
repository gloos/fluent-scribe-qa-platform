import { test, expect, Page, Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Comprehensive accessibility testing utilities for WCAG 2.1 AA compliance
 */

export interface AccessibilityTestOptions {
  /** Include additional accessibility rules beyond WCAG 2.1 AA */
  includeExperimentalRules?: boolean;
  /** Disable specific axe rules (use sparingly) */
  disableRules?: string[];
  /** Tags to include in accessibility testing */
  tags?: string[];
  /** Exclude certain selectors from accessibility testing */
  exclude?: string[];
}

export interface KeyboardNavigationOptions {
  /** Skip links to test */
  skipLinks?: string[];
  /** Expected tab order selectors */
  expectedTabOrder?: string[];
  /** Interactive elements to verify */
  interactiveElements?: string[];
}

export interface ColorContrastRequirements {
  /** Minimum contrast ratio for normal text (default: 4.5) */
  normalText?: number;
  /** Minimum contrast ratio for large text (default: 3.0) */
  largeText?: number;
  /** Minimum contrast ratio for non-text elements (default: 3.0) */
  nonText?: number;
}

/**
 * Run comprehensive accessibility scan using axe-core
 */
export async function runAccessibilityScan(
  page: Page,
  options: AccessibilityTestOptions = {}
) {
  const axeBuilder = new AxeBuilder({ page });

  // Configure accessibility scan
  if (options.tags && options.tags.length > 0) {
    axeBuilder.withTags(options.tags);
  } else {
    // Default to WCAG 2.1 AA standards
    axeBuilder.withTags(['wcag2a', 'wcag2aa', 'wcag21aa']);
  }

  if (options.disableRules && options.disableRules.length > 0) {
    axeBuilder.disableRules(options.disableRules);
  }

  if (options.exclude && options.exclude.length > 0) {
    axeBuilder.exclude(options.exclude);
  }

  if (options.includeExperimentalRules) {
    axeBuilder.withTags(['experimental']);
  }

  const results = await axeBuilder.analyze();

  // Fail test if violations found
  expect(results.violations).toEqual([]);

  return results;
}

/**
 * Test keyboard navigation accessibility
 */
export async function testKeyboardNavigation(
  page: Page,
  options: KeyboardNavigationOptions = {}
) {
  // Test tab navigation
  await testTabNavigation(page, options.expectedTabOrder);
  
  // Test skip links if provided
  if (options.skipLinks && options.skipLinks.length > 0) {
    await testSkipLinks(page, options.skipLinks);
  }
  
  // Test interactive elements if provided
  if (options.interactiveElements && options.interactiveElements.length > 0) {
    await testInteractiveElements(page, options.interactiveElements);
  }
  
  // Test escape key functionality
  await testEscapeKeyFunctionality(page);
  
  // Test arrow key navigation for relevant components
  await testArrowKeyNavigation(page);
}

/**
 * Test tab navigation order and focus visibility
 */
export async function testTabNavigation(page: Page, expectedOrder?: string[]) {
  const focusableElements = await page.locator(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  ).all();
  
  if (focusableElements.length === 0) {
    console.log('No focusable elements found, skipping tab navigation test');
    return;
  }
  
  // Start by explicitly focusing the first focusable element
  await focusableElements[0].focus();
  
  if (expectedOrder) {
    // Test specific tab order
    for (let i = 0; i < expectedOrder.length; i++) {
      await page.keyboard.press('Tab');
      const focused = await page.locator(':focus');
      await expect(focused).toHaveAttribute('data-testid', expectedOrder[i]);
    }
  } else {
    // Test that tab navigation works through focusable elements
    const elementsToTest = Math.min(focusableElements.length, 10); // Limit to 10 for performance
    
    for (let i = 0; i < elementsToTest; i++) {
      // Check if an element is currently focused
      const focusedCount = await page.locator(':focus').count();
      
      if (focusedCount > 0) {
        const focused = page.locator(':focus');
        
        // Verify focus is visible
        await expect(focused).toBeVisible();
        
        // Verify focus indicator is present
        const computedStyle = await focused.evaluate(el => {
          const style = window.getComputedStyle(el);
          return {
            outline: style.outline,
            outlineWidth: style.outlineWidth,
            outlineStyle: style.outlineStyle,
            boxShadow: style.boxShadow
          };
        });
        
        // Check that focus indicator is visible
        const hasFocusIndicator = 
          computedStyle.outline !== 'none' || 
          computedStyle.outlineWidth !== '0px' ||
          computedStyle.boxShadow !== 'none';
        
        expect(hasFocusIndicator).toBeTruthy();
      } else if (i === 0) {
        // If no element is focused initially, focus the first one explicitly
        await focusableElements[0].focus();
        continue; // Re-run this iteration
      }
      
      // Move to next element (unless we're at the last one)
      if (i < elementsToTest - 1) {
        await page.keyboard.press('Tab');
      }
    }
  }
}

/**
 * Test skip links functionality
 */
export async function testSkipLinks(page: Page, skipLinks: string[]) {
  for (const skipLink of skipLinks) {
    const link = page.locator(`[href="${skipLink}"]`).first();
    await link.focus();
    await expect(link).toBeVisible();
    await link.press('Enter');
    
    // Verify focus moved to target
    const target = page.locator(skipLink);
    await expect(target).toBeFocused();
  }
}

/**
 * Test interactive elements keyboard accessibility
 */
export async function testInteractiveElements(page: Page, selectors: string[]) {
  for (const selector of selectors) {
    const element = page.locator(selector).first();
    
    // Test focus
    await element.focus();
    await expect(element).toBeFocused();
    
    // Test Enter key activation
    await element.press('Enter');
    
    // Test Space key activation for buttons
    const tagName = await element.evaluate(el => el.tagName.toLowerCase());
    if (tagName === 'button' || await element.getAttribute('role') === 'button') {
      await element.focus();
      await element.press('Space');
    }
  }
}

/**
 * Test escape key functionality for modals and dropdowns
 */
export async function testEscapeKeyFunctionality(page: Page) {
  // Look for modal triggers
  const modalTriggers = await page.locator('[data-testid*="modal"], [aria-haspopup="dialog"]').all();
  
  for (const trigger of modalTriggers) {
    await trigger.click();
    
    // Wait for modal to open
    await page.waitForTimeout(500);
    
    // Press escape
    await page.keyboard.press('Escape');
    
    // Verify modal is closed
    await page.waitForTimeout(500);
    const modals = await page.locator('[role="dialog"]').all();
    for (const modal of modals) {
      await expect(modal).not.toBeVisible();
    }
  }
}

/**
 * Test arrow key navigation for components like menus and tabs
 */
export async function testArrowKeyNavigation(page: Page) {
  // Test tab navigation
  const tabLists = await page.locator('[role="tablist"]').all();
  for (const tabList of tabLists) {
    const tabs = await tabList.locator('[role="tab"]').all();
    if (tabs.length > 1) {
      await tabs[0].focus();
      await page.keyboard.press('ArrowRight');
      await expect(tabs[1]).toBeFocused();
      
      await page.keyboard.press('ArrowLeft');
      await expect(tabs[0]).toBeFocused();
    }
  }
  
  // Test menu navigation
  const menus = await page.locator('[role="menu"]').all();
  for (const menu of menus) {
    const menuItems = await menu.locator('[role="menuitem"]').all();
    if (menuItems.length > 1) {
      await menuItems[0].focus();
      await page.keyboard.press('ArrowDown');
      await expect(menuItems[1]).toBeFocused();
      
      await page.keyboard.press('ArrowUp');
      await expect(menuItems[0]).toBeFocused();
    }
  }
}

/**
 * Verify semantic HTML structure
 */
export async function verifySemanticHTML(page: Page) {
  // Check for proper heading hierarchy
  await verifyHeadingHierarchy(page);
  
  // Check for landmarks
  await verifyLandmarks(page);
  
  // Check for proper form labels
  await verifyFormLabels(page);
  
  // Check for alt text on images
  await verifyImageAltText(page);
}

/**
 * Verify proper heading hierarchy (h1, h2, h3, etc.)
 */
export async function verifyHeadingHierarchy(page: Page) {
  const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
  let previousLevel = 0;
  
  for (const heading of headings) {
    const tagName = await heading.evaluate(el => el.tagName.toLowerCase());
    const currentLevel = parseInt(tagName.slice(1));
    
    // Check that heading levels don't skip (e.g., h1 -> h3)
    if (previousLevel > 0) {
      expect(currentLevel - previousLevel).toBeLessThanOrEqual(1);
    }
    
    previousLevel = currentLevel;
  }
  
  // Ensure there's at least one h1
  const h1Count = await page.locator('h1').count();
  expect(h1Count).toBeGreaterThanOrEqual(1);
}

/**
 * Verify ARIA landmarks are present
 */
export async function verifyLandmarks(page: Page) {
  // Check for main landmark
  const main = page.locator('main, [role="main"]');
  await expect(main).toHaveCount(1);
  
  // Check for navigation landmark
  const nav = page.locator('nav, [role="navigation"]');
  const navCount = await nav.count();
  expect(navCount).toBeGreaterThanOrEqual(1);
  
  // Check for banner (header) if present
  const banner = page.locator('header, [role="banner"]');
  const bannerCount = await banner.count();
  if (bannerCount > 0) {
    expect(bannerCount).toBeLessThanOrEqual(1);
  }
  
  // Check for contentinfo (footer) if present
  const contentInfo = page.locator('footer, [role="contentinfo"]');
  const contentInfoCount = await contentInfo.count();
  if (contentInfoCount > 0) {
    expect(contentInfoCount).toBeLessThanOrEqual(1);
  }
}

/**
 * Verify form labels and accessibility
 */
export async function verifyFormLabels(page: Page) {
  const formControls = await page.locator('input, select, textarea').all();
  
  for (const control of formControls) {
    const type = await control.getAttribute('type');
    
    // Skip hidden inputs
    if (type === 'hidden') continue;
    
    // Check for proper labeling
    const hasLabel = await hasAccessibleName(control);
    expect(hasLabel).toBeTruthy();
  }
}

/**
 * Check if element has accessible name
 */
export async function hasAccessibleName(locator: Locator): Promise<boolean> {
  const element = locator.first();
  
  // Check for aria-label
  const ariaLabel = await element.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.trim()) return true;
  
  // Check for aria-labelledby
  const ariaLabelledBy = await element.getAttribute('aria-labelledby');
  if (ariaLabelledBy) {
    const labelElement = await element.page().locator(`#${ariaLabelledBy}`);
    const labelText = await labelElement.textContent();
    if (labelText && labelText.trim()) return true;
  }
  
  // Check for associated label
  const id = await element.getAttribute('id');
  if (id) {
    const label = await element.page().locator(`label[for="${id}"]`);
    const labelCount = await label.count();
    if (labelCount > 0) {
      const labelText = await label.textContent();
      if (labelText && labelText.trim()) return true;
    }
  }
  
  // Check for wrapping label
  const parentLabel = await element.locator('xpath=ancestor::label').count();
  if (parentLabel > 0) {
    const labelText = await element.locator('xpath=ancestor::label').textContent();
    if (labelText && labelText.trim()) return true;
  }
  
  return false;
}

/**
 * Verify alt text on images
 */
export async function verifyImageAltText(page: Page) {
  const images = await page.locator('img').all();
  
  for (const img of images) {
    const alt = await img.getAttribute('alt');
    const role = await img.getAttribute('role');
    
    // Images should have alt text or role="presentation"
    const hasAltText = alt !== null;
    const isDecorative = role === 'presentation' || alt === '';
    
    expect(hasAltText || isDecorative).toBeTruthy();
  }
}

/**
 * Test color contrast ratios
 */
export async function testColorContrast(
  page: Page,
  requirements: ColorContrastRequirements = {}
) {
  const {
    normalText = 4.5,
    largeText = 3.0,
    nonText = 3.0
  } = requirements;

  // This would typically integrate with a color contrast library
  // For now, we'll use axe-core which includes color contrast checking
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2aa'])
    .analyze();

  const colorContrastViolations = results.violations.filter(
    violation => violation.id === 'color-contrast'
  );

  expect(colorContrastViolations).toHaveLength(0);
}

/**
 * Generate accessibility report
 */
export async function generateAccessibilityReport(
  page: Page,
  testName: string,
  options: AccessibilityTestOptions = {}
) {
  const results = await new AxeBuilder({ page })
    .withTags(options.tags || ['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();

  const report = {
    testName,
    url: page.url(),
    timestamp: new Date().toISOString(),
    violations: results.violations,
    passes: results.passes,
    inapplicable: results.inapplicable,
    incomplete: results.incomplete,
    summary: {
      violationCount: results.violations.length,
      passCount: results.passes.length,
      inapplicableCount: results.inapplicable.length,
      incompleteCount: results.incomplete.length
    }
  };

  return report;
} 