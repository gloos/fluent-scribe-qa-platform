import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

async function testAuthenticatedAccessibility() {
  console.log('🚀 Testing accessibility with authentication...');
  
  const browser = await chromium.launch({ headless: false }); // Show browser for debugging
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // First, let's check the home page and see what actually loads
    console.log('\n🏠 Testing Home Page with content analysis...');
    await page.goto('http://localhost:8082/', { waitUntil: 'networkidle' });
    
    // Wait for potential React app to load
    await page.waitForTimeout(3000);
    
    // Check if we're redirected to login or if content loads
    const currentUrl = page.url();
    console.log(`📍 Current URL after load: ${currentUrl}`);
    
    // Get page title and check for content
    const title = await page.title();
    console.log(`📋 Page title: ${title}`);
    
    // Check for common elements that indicate the app loaded
    const bodyText = await page.locator('body').textContent();
    console.log(`📝 Body text preview: ${bodyText?.substring(0, 200)}...`);
    
    // Look for React root or main app container
    const reactRoot = await page.locator('#root, #app, main, .app').count();
    console.log(`⚛️  React/App containers found: ${reactRoot}`);
    
    // Check for navigation elements
    const navigation = await page.locator('nav, [role="navigation"], .nav, .navbar, .menu').count();
    console.log(`🧭 Navigation elements: ${navigation}`);
    
    // Check for buttons and interactive elements
    const buttons = await page.locator('button').count();
    const links = await page.locator('a').count();
    const inputs = await page.locator('input').count();
    console.log(`🔘 Interactive elements: ${buttons} buttons, ${links} links, ${inputs} inputs`);
    
    // If there's a login form, let's try to authenticate
    const loginForm = await page.locator('form').count();
    const emailInput = await page.locator('input[type="email"], input[name="email"], input[placeholder*="email"]').count();
    const passwordInput = await page.locator('input[type="password"], input[name="password"]').count();
    
    console.log(`🔐 Login elements: ${loginForm} forms, ${emailInput} email inputs, ${passwordInput} password inputs`);
    
    if (emailInput > 0 && passwordInput > 0) {
      console.log('📧 Login form detected, attempting authentication...');
      
      try {
        // Try to fill login form with test credentials
        await page.fill('input[type="email"], input[name="email"]', 'test@example.com');
        await page.fill('input[type="password"], input[name="password"]', 'password');
        
        // Look for submit button
        const submitButton = page.locator('button[type="submit"], input[type="submit"], button:has-text("Login"), button:has-text("Sign in")');
        if (await submitButton.count() > 0) {
          console.log('🚀 Clicking login button...');
          await submitButton.first().click();
          
          // Wait for navigation or content change
          await page.waitForTimeout(3000);
          
          console.log(`📍 URL after login attempt: ${page.url()}`);
        }
      } catch (error) {
        console.log(`⚠️  Login attempt failed: ${error.message}`);
      }
    }
    
    // Now run accessibility scan on whatever page we have
    console.log('\n🔍 Running accessibility scan on current page...');
    
    const axeBuilder = new AxeBuilder({ page });
    const results = await axeBuilder
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    
    console.log(`📊 Accessibility Results:`);
    console.log(`   - Violations: ${results.violations.length}`);
    console.log(`   - Passes: ${results.passes.length}`);
    console.log(`   - Incomplete: ${results.incomplete.length}`);
    
    if (results.violations.length > 0) {
      console.log('\n⚠️  VIOLATIONS FOUND:');
      results.violations.forEach((violation, index) => {
        console.log(`${index + 1}. ${violation.id} (${violation.impact})`);
        console.log(`   Description: ${violation.description}`);
        console.log(`   Nodes affected: ${violation.nodes.length}`);
        if (violation.nodes.length > 0) {
          console.log(`   Example: ${violation.nodes[0].html.substring(0, 100)}...`);
        }
        console.log('');
      });
    }
    
    if (results.passes.length > 0) {
      console.log('\n✅ PASSING CHECKS:');
      results.passes.slice(0, 10).forEach((pass, index) => {
        console.log(`${index + 1}. ${pass.id}: ${pass.description}`);
      });
      if (results.passes.length > 10) {
        console.log(`   ... and ${results.passes.length - 10} more`);
      }
    }
    
    // Final semantic structure analysis
    console.log('\n🏗️  FINAL SEMANTIC STRUCTURE ANALYSIS:');
    const headingStructure = await page.locator('h1, h2, h3, h4, h5, h6').all();
    console.log(`📰 Headings found: ${headingStructure.length}`);
    
    for (let i = 0; i < Math.min(headingStructure.length, 5); i++) {
      const heading = headingStructure[i];
      const tagName = await heading.evaluate(el => el.tagName.toLowerCase());
      const text = await heading.textContent();
      console.log(`   ${tagName}: ${text?.substring(0, 50)}...`);
    }
    
    const landmarks = {
      main: await page.locator('main, [role="main"]').count(),
      nav: await page.locator('nav, [role="navigation"]').count(),
      header: await page.locator('header, [role="banner"]').count(),
      footer: await page.locator('footer, [role="contentinfo"]').count(),
      aside: await page.locator('aside, [role="complementary"]').count()
    };
    
    console.log('🗺️  Landmarks:', landmarks);
    
    // Keep browser open for manual inspection
    console.log('\n🔍 Browser kept open for manual inspection. Press Enter to close...');
    // Uncomment the next line if you want to pause for manual inspection
    // await page.pause();
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

testAuthenticatedAccessibility(); 