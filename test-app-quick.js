import { chromium } from 'playwright';

async function quickTest() {
  console.log('🧪 Quick test of React app after fix...');
  
  const browser = await chromium.launch({ headless: true }); // Headless mode
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const jsErrors = [];
  page.on('pageerror', error => {
    jsErrors.push(error.message);
  });
  
  try {
    await page.goto('http://localhost:8082/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    const rootHTML = await page.locator('#root').innerHTML();
    const focusableCount = await page.locator('button, [href], input, select, textarea').count();
    const headingCount = await page.locator('h1, h2, h3, h4, h5, h6').count();
    
    console.log(`✅ RESULTS:`);
    console.log(`   - JS Errors: ${jsErrors.length}`);
    console.log(`   - Root content length: ${rootHTML.length} chars`);
    console.log(`   - Focusable elements: ${focusableCount}`);
    console.log(`   - Headings: ${headingCount}`);
    
    if (jsErrors.length === 0 && rootHTML.length > 100) {
      console.log('🎉 SUCCESS: React app is working!');
      return true;
    } else {
      console.log('❌ Still have issues');
      if (jsErrors.length > 0) {
        console.log('Errors:', jsErrors.slice(0, 3));
      }
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  } finally {
    await browser.close();
  }
}

quickTest(); 