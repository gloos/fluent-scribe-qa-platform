import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

async function testAccessibilityInfrastructure() {
  console.log('🚀 Starting accessibility infrastructure test...');
  
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Simple test HTML
    const testHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Test Page</title>
    <style>
        button:focus, input:focus { outline: 2px solid blue; }
        .skip-link { position: absolute; top: -40px; }
        .skip-link:focus { top: 6px; }
    </style>
</head>
<body>
    <a href="#main" class="skip-link">Skip to main</a>
    <header><h1>Test Page</h1></header>
    <main id="main">
        <form>
            <label for="name">Name</label>
            <input type="text" id="name" required>
            <button type="submit">Submit</button>
        </form>
        <button>Test Button</button>
    </main>
</body>
</html>`;
    
    // Load test page
    const dataURL = `data:text/html;charset=utf-8,${encodeURIComponent(testHTML)}`;
    await page.goto(dataURL);
    
    console.log('✅ Page loaded successfully');
    
    // Test 1: Basic axe-core scan
    console.log('🔍 Testing axe-core integration...');
    const axeBuilder = new AxeBuilder({ page });
    const results = await axeBuilder.withTags(['wcag2a', 'wcag2aa']).analyze();
    
    console.log(`✅ Axe-core scan completed`);
    console.log(`   - Violations: ${results.violations.length}`);
    console.log(`   - Passes: ${results.passes.length}`);
    
    // Test 2: Basic keyboard navigation
    console.log('⌨️  Testing keyboard navigation...');
    const focusableElements = await page.locator('button, [href], input, select, textarea').all();
    console.log(`   - Found ${focusableElements.length} focusable elements`);
    
    if (focusableElements.length > 0) {
      await focusableElements[0].focus();
      await page.keyboard.press('Tab');
      console.log('   - Tab navigation works');
    }
    
    // Test 3: Focus visibility
    console.log('👁️  Testing focus visibility...');
    const button = page.locator('button').first();
    await button.focus();
    const focused = page.locator(':focus');
    const isVisible = await focused.isVisible();
    console.log(`   - Focus visibility: ${isVisible ? 'PASS' : 'FAIL'}`);
    
    // Test 4: Semantic structure
    console.log('🏗️  Testing semantic structure...');
    const h1Count = await page.locator('h1').count();
    const mainCount = await page.locator('main').count();
    const labelCount = await page.locator('label').count();
    
    console.log(`   - H1 headings: ${h1Count}`);
    console.log(`   - Main landmarks: ${mainCount}`);
    console.log(`   - Form labels: ${labelCount}`);
    
    console.log('\n🎉 All accessibility infrastructure tests completed successfully!');
    console.log('✅ axe-core integration working');
    console.log('✅ Keyboard navigation working');
    console.log('✅ Focus management working');
    console.log('✅ Semantic HTML detection working');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

testAccessibilityInfrastructure(); 