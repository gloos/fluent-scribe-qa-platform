import { chromium } from 'playwright';

async function testAppAfterFix() {
  console.log('🧪 Testing React app after process.env fix...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Collect console messages and errors
  const consoleMessages = [];
  const jsErrors = [];
  
  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text()
    });
  });
  
  page.on('pageerror', error => {
    jsErrors.push({
      message: error.message,
      stack: error.stack
    });
  });
  
  try {
    console.log('🚀 Loading application...');
    await page.goto('http://localhost:8082/', { waitUntil: 'networkidle' });
    
    // Wait for React to render
    console.log('⏳ Waiting for React app to render...');
    await page.waitForTimeout(3000);
    
    // Check current state
    const url = page.url();
    const title = await page.title();
    console.log(`📍 URL: ${url}`);
    console.log(`📋 Title: ${title}`);
    
    // Check for JavaScript errors
    console.log('\\n❌ JAVASCRIPT ERRORS:');
    if (jsErrors.length === 0) {
      console.log('   ✅ No JavaScript errors detected!');
    } else {
      jsErrors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.message}`);
      });
    }
    
    // Analyze DOM structure
    console.log('\\n🏗️  DOM STRUCTURE ANALYSIS:');
    
    // Check React root content
    const rootHTML = await page.locator('#root').innerHTML();
    const rootContentLength = rootHTML.length;
    console.log(`⚛️  React root content length: ${rootContentLength} characters`);
    
    if (rootContentLength > 50) {
      console.log(`⚛️  React root preview: ${rootHTML.substring(0, 200)}...`);
    } else {
      console.log(`⚛️  React root content: ${rootHTML}`);
    }
    
    // Count interactive elements
    const focusableCount = await page.locator('button, [href], input, select, textarea').count();
    const headingCount = await page.locator('h1, h2, h3, h4, h5, h6').count();
    const formCount = await page.locator('form').count();
    const navCount = await page.locator('nav, [role="navigation"]').count();
    
    console.log(`\\n📊 CONTENT ANALYSIS:`);
    console.log(`   - Focusable elements: ${focusableCount}`);
    console.log(`   - Headings: ${headingCount}`);
    console.log(`   - Forms: ${formCount}`);
    console.log(`   - Navigation: ${navCount}`);
    
    // Check specific UI elements
    const specificElements = {
      'React loading indicators': await page.locator('.loading, .spinner, [data-loading]').count(),
      'Error messages': await page.locator('.error, .error-message, [data-error]').count(),
      'Auth elements': await page.locator('[data-auth], .login, .signin, .auth').count(),
      'Modal/dialogs': await page.locator('[role="dialog"], .modal').count(),
      'Buttons with text': await page.locator('button:has-text("")').count()
    };
    
    console.log(`\\n🎨 SPECIFIC UI ELEMENTS:`);
    Object.entries(specificElements).forEach(([name, count]) => {
      console.log(`   - ${name}: ${count}`);
    });
    
    // Test basic interactivity
    console.log('\\n🎯 INTERACTIVITY TEST:');
    
    if (focusableCount > 0) {
      try {
        await page.keyboard.press('Tab');
        const focusedElement = await page.locator(':focus').count();
        console.log(`   ✅ Tab navigation working: ${focusedElement} element focused`);
      } catch (error) {
        console.log(`   ⚠️  Tab navigation issue: ${error.message}`);
      }
    } else {
      console.log('   ℹ️  No focusable elements to test');
    }
    
    // Final verdict
    console.log('\\n🎯 DIAGNOSIS VERDICT:');
    
    if (jsErrors.length === 0) {
      console.log('✅ No JavaScript errors - process.env fix successful!');
    } else {
      console.log('❌ JavaScript errors still present');
    }
    
    if (rootContentLength > 50) {
      console.log('✅ React app is rendering content!');
    } else {
      console.log('❌ React app still not rendering content');
    }
    
    if (focusableCount > 0 || headingCount > 0) {
      console.log('✅ App has interactive/semantic content!');
      console.log('🎉 REACT APP IS WORKING - Ready for accessibility testing!');
    } else {
      console.log('❌ App still lacks interactive/semantic content');
      console.log('🔍 Further investigation needed');
    }
    
    // Pause for manual inspection
    console.log('\\n🔍 Pausing for manual inspection...');
    await page.pause();
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

testAppAfterFix(); 