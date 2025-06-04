import { chromium } from 'playwright';

async function diagnoseAppState() {
  console.log('🔍 Diagnosing React app state...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Collect console logs and errors
  const consoleMessages = [];
  const jsErrors = [];
  const networkRequests = [];
  
  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
      location: msg.location()
    });
  });
  
  page.on('pageerror', error => {
    jsErrors.push({
      message: error.message,
      stack: error.stack
    });
  });
  
  page.on('request', request => {
    networkRequests.push({
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType()
    });
  });
  
  try {
    console.log('\n🚀 Loading application...');
    await page.goto('http://localhost:8082/', { waitUntil: 'networkidle' });
    
    // Wait longer for potential React hydration
    console.log('⏳ Waiting for React app to hydrate...');
    await page.waitForTimeout(5000);
    
    // Check current state
    const url = page.url();
    const title = await page.title();
    console.log(`📍 Final URL: ${url}`);
    console.log(`📋 Page title: ${title}`);
    
    // Analyze DOM structure in detail
    console.log('\n🏗️  DOM STRUCTURE ANALYSIS:');
    
    // Check React root content
    const rootHTML = await page.locator('#root').innerHTML();
    console.log(`⚛️  React root content (first 500 chars):`);
    console.log(rootHTML.substring(0, 500));
    console.log('...\n');
    
    // Check for specific React elements
    const reactElements = {
      'React Router outlets': await page.locator('[data-reactroot], [data-react-helmet]').count(),
      'Suspense boundaries': await page.locator('[data-suspense]').count(),
      'Loading indicators': await page.locator('.loading, .spinner, [data-loading], .loader').count(),
      'Error boundaries': await page.locator('.error, .error-boundary, [data-error]').count(),
      'Auth components': await page.locator('[data-auth], .login, .signin, .auth').count()
    };
    
    console.log('⚛️  React-specific elements:');
    Object.entries(reactElements).forEach(([name, count]) => {
      console.log(`   - ${name}: ${count}`);
    });
    
    // Check for common UI framework components
    const uiElements = {
      'Radix components': await page.locator('[data-radix-root], [data-radix-portal]').count(),
      'Dialog/Modal overlays': await page.locator('[role="dialog"], .modal, .overlay').count(),
      'Navigation menus': await page.locator('[role="menubar"], [role="navigation"]').count(),
      'Form elements': await page.locator('form, input, button').count()
    };
    
    console.log('🎨 UI Framework elements:');
    Object.entries(uiElements).forEach(([name, count]) => {
      console.log(`   - ${name}: ${count}`);
    });
    
    // Check for authentication state
    console.log('\n🔐 AUTHENTICATION ANALYSIS:');
    
    // Look for common auth patterns
    const authIndicators = {
      'Login forms': await page.locator('form:has(input[type="email"]), form:has(input[type="password"])').count(),
      'Auth buttons': await page.locator('button:has-text("Login"), button:has-text("Sign"), button:has-text("Auth")').count(),
      'Token storage': await page.evaluate(() => {
        return {
          localStorage: Object.keys(localStorage).filter(key => 
            key.includes('token') || key.includes('auth') || key.includes('session')
          ),
          sessionStorage: Object.keys(sessionStorage).filter(key => 
            key.includes('token') || key.includes('auth') || key.includes('session')
          )
        };
      }),
      'Auth cookies': await page.context().cookies().then(cookies => 
        cookies.filter(cookie => 
          cookie.name.includes('token') || 
          cookie.name.includes('auth') || 
          cookie.name.includes('session')
        ).length
      )
    };
    
    console.log('🔑 Auth indicators:');
    console.log(`   - Login forms: ${authIndicators['Login forms']}`);
    console.log(`   - Auth buttons: ${authIndicators['Auth buttons']}`);
    console.log(`   - LocalStorage auth keys: ${authIndicators['Token storage'].localStorage.join(', ') || 'none'}`);
    console.log(`   - SessionStorage auth keys: ${authIndicators['Token storage'].sessionStorage.join(', ') || 'none'}`);
    console.log(`   - Auth cookies: ${authIndicators['Auth cookies']}`);
    
    // Check for routing state
    console.log('\n🗺️  ROUTING ANALYSIS:');
    const routingInfo = await page.evaluate(() => {
      return {
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
        historyLength: window.history.length,
        reactRouter: typeof window.__REACT_ROUTER__ !== 'undefined',
        reactDevTools: typeof window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined'
      };
    });
    
    console.log('🧭 Routing state:');
    Object.entries(routingInfo).forEach(([key, value]) => {
      console.log(`   - ${key}: ${value}`);
    });
    
    // Analyze console messages
    console.log('\n📝 CONSOLE MESSAGES:');
    if (consoleMessages.length === 0) {
      console.log('   No console messages');
    } else {
      consoleMessages.forEach((msg, index) => {
        if (index < 10) { // Show first 10 messages
          console.log(`   ${msg.type.toUpperCase()}: ${msg.text}`);
        }
      });
      if (consoleMessages.length > 10) {
        console.log(`   ... and ${consoleMessages.length - 10} more messages`);
      }
    }
    
    // Analyze JavaScript errors
    console.log('\n❌ JAVASCRIPT ERRORS:');
    if (jsErrors.length === 0) {
      console.log('   ✅ No JavaScript errors detected');
    } else {
      jsErrors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.message}`);
        if (error.stack) {
          console.log(`      Stack: ${error.stack.split('\n')[0]}`);
        }
      });
    }
    
    // Analyze network requests
    console.log('\n🌐 NETWORK REQUESTS:');
    const requestTypes = {};
    networkRequests.forEach(req => {
      requestTypes[req.resourceType] = (requestTypes[req.resourceType] || 0) + 1;
    });
    
    console.log('📊 Request types:');
    Object.entries(requestTypes).forEach(([type, count]) => {
      console.log(`   - ${type}: ${count}`);
    });
    
    // Show API calls
    const apiCalls = networkRequests.filter(req => 
      req.url.includes('/api/') || 
      req.resourceType === 'fetch' || 
      req.resourceType === 'xhr'
    );
    
    if (apiCalls.length > 0) {
      console.log('🔌 API/Data requests:');
      apiCalls.slice(0, 5).forEach(req => {
        console.log(`   ${req.method} ${req.url}`);
      });
      if (apiCalls.length > 5) {
        console.log(`   ... and ${apiCalls.length - 5} more API calls`);
      }
    } else {
      console.log('🔌 No API/data requests detected');
    }
    
    // Test if we can trigger content by interacting
    console.log('\n🎯 INTERACTION TESTING:');
    
    // Try clicking anywhere to trigger potential lazy loading
    await page.click('body');
    await page.waitForTimeout(1000);
    
    // Try keyboard interactions
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);
    
    // Check if anything changed
    const newFocusableCount = await page.locator('button, [href], input, select, textarea').count();
    const newHeadingCount = await page.locator('h1, h2, h3, h4, h5, h6').count();
    
    console.log(`🎪 After interactions:`);
    console.log(`   - Focusable elements: ${newFocusableCount}`);
    console.log(`   - Headings: ${newHeadingCount}`);
    
    // Final recommendations
    console.log('\n💡 DIAGNOSTIC SUMMARY & RECOMMENDATIONS:');
    
    if (jsErrors.length > 0) {
      console.log('🔴 ISSUE: JavaScript errors detected - fix these first');
    }
    
    if (authIndicators['Login forms'] > 0) {
      console.log('🟡 INFO: Login form detected - app may require authentication');
    }
    
    if (apiCalls.length === 0) {
      console.log('🟡 INFO: No API calls detected - app may be in offline mode or have connection issues');
    }
    
    if (newFocusableCount === 0 && newHeadingCount === 0) {
      console.log('🔴 ISSUE: No interactive content detected - possible routing or rendering issue');
    }
    
    // Pause for manual inspection
    console.log('\n🔍 Browser paused for manual inspection. Check the browser window and press Enter to continue...');
    await page.pause();
    
  } catch (error) {
    console.error('❌ Diagnostic failed:', error.message);
  } finally {
    await browser.close();
  }
}

diagnoseAppState(); 