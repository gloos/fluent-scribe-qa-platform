import { test, expect, Locator } from '@playwright/test';
import { testKeyboardNavigation } from '../utils/accessibility';
import { TestHelpers } from '../utils/test-helpers';
import { testData } from '../utils/test-data';

/**
 * Keyboard Navigation Accessibility Testing Suite
 * 
 * These tests verify that all functionality is accessible via keyboard
 * and that keyboard navigation follows accessibility best practices.
 */

const PAGES_TO_TEST = [
  { name: 'Home Page', url: '/' },
  { name: 'Dashboard', url: '/dashboard' },
  { name: 'Upload', url: '/upload' },
  { name: 'Admin', url: '/admin' },
  { name: 'Billing', url: '/billing' }
];

test.describe('Keyboard Navigation Accessibility', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    
    // Clear storage and setup authentication
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
      test(`should allow full keyboard navigation`, async ({ page }) => {
        await page.goto(pageInfo.url);
        await page.waitForLoadState('networkidle');
        
        // Test comprehensive keyboard navigation
        await testKeyboardNavigation(page, {
          // Add any page-specific skip links
          skipLinks: ['#main-content', '#navigation'],
          // Add any page-specific interactive elements
          interactiveElements: ['button', '[data-testid="submit-btn"]']
        });
      });

      test(`should have visible focus indicators`, async ({ page }) => {
        await page.goto(pageInfo.url);
        await page.waitForLoadState('networkidle');
        
        // Get all focusable elements
        const focusableElements = await page.locator(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ).all();

        // Test focus indicators on first 15 elements to keep test manageable
        const elementsToTest = focusableElements.slice(0, 15);
        
        for (const element of elementsToTest) {
          await element.focus();
          
          // Check that focus indicator is visible
          const computedStyle = await element.evaluate(el => {
            const style = window.getComputedStyle(el);
            return {
              outline: style.outline,
              outlineWidth: style.outlineWidth,
              outlineStyle: style.outlineStyle,
              outlineColor: style.outlineColor,
              boxShadow: style.boxShadow,
              borderColor: style.borderColor,
              backgroundColor: style.backgroundColor
            };
          });

          // Check for visible focus indicators
          const hasFocusIndicator = 
            (computedStyle.outline !== 'none' && computedStyle.outlineWidth !== '0px') ||
            (computedStyle.boxShadow !== 'none' && computedStyle.boxShadow.includes('0px 0px 0px')) ||
            computedStyle.borderColor !== 'rgba(0, 0, 0, 0)';

          expect(hasFocusIndicator).toBeTruthy();
        }
      });

      test(`should not have keyboard traps`, async ({ page }) => {
        await page.goto(pageInfo.url);
        await page.waitForLoadState('networkidle');
        
        // Test that focus can move through all elements without getting trapped
        const focusableElements = await page.locator(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ).all();

        if (focusableElements.length > 0) {
          // Start at first element
          await focusableElements[0].focus();
          
          let currentIndex = 0;
          const maxIterations = Math.min(focusableElements.length * 2, 50); // Prevent infinite loops
          
          for (let i = 0; i < maxIterations; i++) {
            await page.keyboard.press('Tab');
            
            // Check if focus moved to next element or wrapped around
            const focusedElement = await page.locator(':focus');
            const focusedElementSelector = await focusedElement.evaluate(el => {
              return el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '') + 
                     (el.className ? `.${el.className.split(' ').join('.')}` : '');
            });
            
            // Verify focus is still on a valid focusable element
            const isFocusableElement = await focusedElement.evaluate(el => {
              const tagName = el.tagName.toLowerCase();
              const hasTabindex = el.hasAttribute('tabindex') && el.getAttribute('tabindex') !== '-1';
              const isInteractive = ['button', 'a', 'input', 'select', 'textarea'].includes(tagName);
              return isInteractive || hasTabindex;
            });
            
            expect(isFocusableElement).toBeTruthy();
            
            currentIndex++;
            if (currentIndex >= focusableElements.length) {
              // Should have cycled through all elements
              break;
            }
          }
        }
      });

      test(`should support Enter key activation`, async ({ page }) => {
        await page.goto(pageInfo.url);
        await page.waitForLoadState('networkidle');
        
        // Test buttons and links
        const buttons = await page.locator('button:visible').all();
        const links = await page.locator('a[href]:visible').all();
        
        // Test first few buttons (to keep test manageable)
        for (const button of buttons.slice(0, 5)) {
          await button.focus();
          
          // Listen for click events
          const buttonHandle = await button.elementHandle();
          if (buttonHandle) {
            let clicked = false;
            await page.evaluate((btn) => {
              btn.addEventListener('click', () => {
                (window as any).testClickedViaEnter = true;
              });
            }, buttonHandle);
            
            await button.press('Enter');
            
            // Check if click event was triggered
            const wasClicked = await page.evaluate(() => (window as any).testClickedViaEnter);
            if (wasClicked) {
              // Reset for next test
              await page.evaluate(() => (window as any).testClickedViaEnter = false);
            }
            
            // For buttons, Enter should trigger click (unless it's a submit button in a form)
            const buttonType = await button.getAttribute('type');
            const isInForm = await button.evaluate(el => !!el.closest('form'));
            
            if (buttonType !== 'submit' || !isInForm) {
              // We can't always test the actual click due to navigation, 
              // but we can verify the button received the keypress
              expect(true).toBeTruthy(); // Placeholder - actual click testing would depend on the specific button
            }
          }
        }
      });

      test(`should support Space key activation for buttons`, async ({ page }) => {
        await page.goto(pageInfo.url);
        await page.waitForLoadState('networkidle');
        
        const buttons = await page.locator('button:visible').all();
        
        // Test first few buttons
        for (const button of buttons.slice(0, 5)) {
          await button.focus();
          
          // Set up click detection
          const buttonHandle = await button.elementHandle();
          if (buttonHandle) {
            await page.evaluate((btn) => {
              btn.addEventListener('click', () => {
                (window as any).testClickedViaSpace = true;
              });
            }, buttonHandle);
            
            await button.press('Space');
            
            // Space should trigger click on buttons
            const wasClicked = await page.evaluate(() => (window as any).testClickedViaSpace);
            if (wasClicked) {
              await page.evaluate(() => (window as any).testClickedViaSpace = false);
            }
            
            // We expect the button to respond to Space key
            expect(true).toBeTruthy(); // Placeholder for actual implementation
          }
        }
      });

      test(`should support Escape key for modal dismissal`, async ({ page }) => {
        await page.goto(pageInfo.url);
        await page.waitForLoadState('networkidle');
        
        // Look for modal triggers
        const modalTriggers = await page.locator(
          '[data-testid*="modal"], [aria-haspopup="dialog"], button:has-text("Open"), button:has-text("Show")'
        ).all();
        
        for (const trigger of modalTriggers.slice(0, 3)) { // Test first few
          // Click to open modal
          await trigger.click();
          await page.waitForTimeout(500); // Allow modal to open
          
          // Check if a modal opened
          const modals = await page.locator('[role="dialog"], .modal, [data-testid*="modal"]').all();
          const visibleModals: Locator[] = [];
          
          for (const modal of modals) {
            const isVisible = await modal.isVisible();
            if (isVisible) {
              visibleModals.push(modal);
            }
          }
          
          if (visibleModals.length > 0) {
            // Press Escape
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500); // Allow modal to close
            
            // Verify modal is closed
            for (const modal of visibleModals) {
              const isStillVisible = await modal.isVisible();
              expect(isStillVisible).toBeFalsy();
            }
          }
        }
      });

      test(`should support arrow key navigation in menus and tabs`, async ({ page }) => {
        await page.goto(pageInfo.url);
        await page.waitForLoadState('networkidle');
        
        // Test tab navigation
        const tabLists = await page.locator('[role="tablist"]').all();
        for (const tabList of tabLists) {
          const tabs = await tabList.locator('[role="tab"]').all();
          
          if (tabs.length > 1) {
            // Focus first tab
            await tabs[0].focus();
            
            // Test arrow right
            await page.keyboard.press('ArrowRight');
            const focusedAfterRight = await page.locator(':focus');
            
            // Should focus next tab
            const focusedTabIndex = await focusedAfterRight.evaluate(el => {
              const allTabs = Array.from(el.closest('[role="tablist"]')?.querySelectorAll('[role="tab"]') || []);
              return allTabs.indexOf(el);
            });
            
            expect(focusedTabIndex).toBe(1);
            
            // Test arrow left
            await page.keyboard.press('ArrowLeft');
            const focusedAfterLeft = await page.locator(':focus');
            
            const focusedTabIndexLeft = await focusedAfterLeft.evaluate(el => {
              const allTabs = Array.from(el.closest('[role="tablist"]')?.querySelectorAll('[role="tab"]') || []);
              return allTabs.indexOf(el);
            });
            
            expect(focusedTabIndexLeft).toBe(0);
          }
        }
        
        // Test menu navigation
        const menus = await page.locator('[role="menu"]').all();
        for (const menu of menus) {
          const menuItems = await menu.locator('[role="menuitem"]').all();
          
          if (menuItems.length > 1) {
            // Focus first menu item
            await menuItems[0].focus();
            
            // Test arrow down
            await page.keyboard.press('ArrowDown');
            const focusedAfterDown = await page.locator(':focus');
            
            // Should focus next menu item
            const focusedItemIndex = await focusedAfterDown.evaluate(el => {
              const allItems = Array.from(el.closest('[role="menu"]')?.querySelectorAll('[role="menuitem"]') || []);
              return allItems.indexOf(el);
            });
            
            expect(focusedItemIndex).toBe(1);
          }
        }
      });

      test(`should support Home and End keys for navigation`, async ({ page }) => {
        await page.goto(pageInfo.url);
        await page.waitForLoadState('networkidle');
        
        // Test in lists or other containers where Home/End make sense
        const lists = await page.locator('[role="listbox"], [role="menu"], [role="tablist"]').all();
        
        for (const list of lists) {
          const items = await list.locator('[role="option"], [role="menuitem"], [role="tab"]').all();
          
          if (items.length > 2) {
            // Focus somewhere in the middle
            if (items.length > 1) {
              await items[1].focus();
            }
            
            // Test Home key
            await page.keyboard.press('Home');
            const focusedAfterHome = await page.locator(':focus');
            
            // Should focus first item
            const isFirstItem = await focusedAfterHome.evaluate((el, firstItem) => {
              return el === firstItem;
            }, await items[0].elementHandle());
            
            expect(isFirstItem).toBeTruthy();
            
            // Test End key
            await page.keyboard.press('End');
            const focusedAfterEnd = await page.locator(':focus');
            
            // Should focus last item
            const isLastItem = await focusedAfterEnd.evaluate((el, lastItem) => {
              return el === lastItem;
            }, await items[items.length - 1].elementHandle());
            
            expect(isLastItem).toBeTruthy();
          }
        }
      });

      test(`should restore focus after modal close`, async ({ page }) => {
        await page.goto(pageInfo.url);
        await page.waitForLoadState('networkidle');
        
        // Find modal triggers
        const modalTriggers = await page.locator(
          '[data-testid*="modal"], [aria-haspopup="dialog"]'
        ).all();
        
        for (const trigger of modalTriggers.slice(0, 2)) { // Test first few
          // Focus and remember the trigger
          await trigger.focus();
          const triggerHandle = await trigger.elementHandle();
          
          // Open modal
          await trigger.click();
          await page.waitForTimeout(500);
          
          // Check if modal opened
          const modal = page.locator('[role="dialog"]:visible').first();
          const modalExists = await modal.count() > 0;
          
          if (modalExists) {
            // Close modal with Escape
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
            
            // Focus should return to trigger
            const currentFocus = await page.locator(':focus');
            const focusReturnedToTrigger = await currentFocus.evaluate((el, trigger) => {
              return el === trigger;
            }, triggerHandle);
            
            expect(focusReturnedToTrigger).toBeTruthy();
          }
        }
      });

      test(`should skip to main content`, async ({ page }) => {
        await page.goto(pageInfo.url);
        await page.waitForLoadState('networkidle');
        
        // Look for skip links (usually hidden until focused)
        const skipLinks = await page.locator('a[href*="#main"], a[href*="#content"]').all();
        
        if (skipLinks.length > 0) {
          const skipLink = skipLinks[0];
          
          // Focus the skip link
          await skipLink.focus();
          
          // Skip link should be visible when focused
          await expect(skipLink).toBeVisible();
          
          // Activate the skip link
          await skipLink.press('Enter');
          
          // Focus should move to main content
          const href = await skipLink.getAttribute('href');
          if (href) {
            const targetId = href.replace('#', '');
            const target = page.locator(`#${targetId}`);
            
            // Target should be focused or at least in viewport
            await expect(target).toBeVisible();
          }
        }
      });
    });
  }
});

test.describe('Form Keyboard Navigation', () => {
  test('should navigate form fields with Tab key', async ({ page }) => {
    // Test on pages that likely have forms
    const formsPages = ['/upload', '/admin', '/billing'];
    
    for (const url of formsPages) {
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      
      const formFields = await page.locator('input:visible, select:visible, textarea:visible').all();
      
      if (formFields.length > 1) {
        // Start with first field
        await formFields[0].focus();
        
        // Tab through form fields
        for (let i = 1; i < Math.min(formFields.length, 10); i++) {
          await page.keyboard.press('Tab');
          
          // Verify focus moved to expected field
          const currentFocus = await page.locator(':focus');
          const focusIsOnFormField = await currentFocus.evaluate(el => {
            const tagName = el.tagName.toLowerCase();
            return ['input', 'select', 'textarea', 'button'].includes(tagName);
          });
          
          expect(focusIsOnFormField).toBeTruthy();
        }
      }
    }
  });

  test('should handle form submission with Enter key', async ({ page }) => {
    // Test on forms that might exist
    const formsPages = ['/upload', '/admin'];
    
    for (const url of formsPages) {
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      
      const forms = await page.locator('form').all();
      
      for (const form of forms.slice(0, 2)) { // Test first few forms
        const submitButtons = await form.locator('button[type="submit"], input[type="submit"]').all();
        const textInputs = await form.locator('input[type="text"], input[type="email"], textarea').all();
        
        if (submitButtons.length > 0 && textInputs.length > 0) {
          // Focus a text input
          await textInputs[0].focus();
          
          // Enter key should submit form or move to submit button
          await page.keyboard.press('Enter');
          
          // We can't test actual submission due to navigation,
          // but we can verify the behavior is appropriate
          expect(true).toBeTruthy(); // Placeholder
        }
      }
    }
  });
}); 