import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

async function testLiveApplicationAccessibility() {
  console.log('🚀 Testing accessibility on live application...');
  
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Test pages to check
  const pagesToTest = [
    { name: 'Home Page', url: 'http://localhost:8082/' },
    { name: 'Dashboard', url: 'http://localhost:8082/dashboard' },
    { name: 'Upload', url: 'http://localhost:8082/upload' },
    { name: 'Admin', url: 'http://localhost:8082/admin' },
    { name: 'Billing', url: 'http://localhost:8082/billing' }
  ];
  
  const results = [];
  
  try {
    for (const pageInfo of pagesToTest) {
      console.log(`\n📝 Testing ${pageInfo.name}...`);
      
      try {
        // Navigate to page
        await page.goto(pageInfo.url, { timeout: 10000 });
        await page.waitForLoadState('networkidle', { timeout: 5000 });
        
        console.log(`✅ Page loaded: ${pageInfo.name}`);
        
        // Run accessibility scan
        const axeBuilder = new AxeBuilder({ page });
        const scanResults = await axeBuilder
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        
        const pageResult = {
          page: pageInfo.name,
          url: pageInfo.url,
          violations: scanResults.violations.length,
          passes: scanResults.passes.length,
          violationDetails: scanResults.violations.map(v => ({
            id: v.id,
            impact: v.impact,
            description: v.description,
            nodeCount: v.nodes.length
          }))
        };
        
        results.push(pageResult);
        
        console.log(`   🔍 Accessibility scan completed`);
        console.log(`   - Violations: ${pageResult.violations}`);
        console.log(`   - Passes: ${pageResult.passes}`);
        
        if (pageResult.violations > 0) {
          console.log(`   ⚠️  Top violations:`);
          pageResult.violationDetails.slice(0, 3).forEach(v => {
            console.log(`     - ${v.id} (${v.impact}): ${v.description.substring(0, 80)}...`);
          });
        }
        
        // Test basic keyboard navigation
        const focusableElements = await page.locator('button, [href], input, select, textarea').count();
        console.log(`   ⌨️  Focusable elements: ${focusableElements}`);
        
        // Test semantic structure
        const h1Count = await page.locator('h1').count();
        const mainCount = await page.locator('main').count();
        const navCount = await page.locator('nav').count();
        
        console.log(`   🏗️  Semantic structure: ${h1Count} H1, ${mainCount} main, ${navCount} nav`);
        
      } catch (error) {
        console.log(`   ❌ Error testing ${pageInfo.name}: ${error.message}`);
        results.push({
          page: pageInfo.name,
          url: pageInfo.url,
          error: error.message,
          violations: 'unknown',
          passes: 'unknown'
        });
      }
    }
    
    // Generate summary report
    console.log('\n📊 ACCESSIBILITY TEST SUMMARY');
    console.log('='.repeat(50));
    
    const totalViolations = results.reduce((sum, r) => 
      typeof r.violations === 'number' ? sum + r.violations : sum, 0);
    const totalPasses = results.reduce((sum, r) => 
      typeof r.passes === 'number' ? sum + r.passes : sum, 0);
    const pagesWithErrors = results.filter(r => r.error).length;
    const pagesWithViolations = results.filter(r => r.violations > 0).length;
    
    console.log(`📈 Total violations across all pages: ${totalViolations}`);
    console.log(`✅ Total passes across all pages: ${totalPasses}`);
    console.log(`❌ Pages with errors: ${pagesWithErrors}`);
    console.log(`⚠️  Pages with violations: ${pagesWithViolations}`);
    
    console.log('\n📝 Detailed Results:');
    results.forEach(result => {
      if (result.error) {
        console.log(`❌ ${result.page}: ERROR - ${result.error}`);
      } else {
        const status = result.violations === 0 ? '✅' : '⚠️';
        console.log(`${status} ${result.page}: ${result.violations} violations, ${result.passes} passes`);
      }
    });
    
    if (totalViolations === 0 && pagesWithErrors === 0) {
      console.log('\n🎉 ALL ACCESSIBILITY TESTS PASSED!');
    } else {
      console.log('\n⚠️  ACCESSIBILITY ISSUES FOUND - Review and remediate violations');
    }
    
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

testLiveApplicationAccessibility(); 