import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'fs';

async function generateComprehensiveAccessibilityReport() {
  console.log('🚀 Generating Comprehensive Accessibility Report...');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalPages: 0,
      totalViolations: 0,
      totalPasses: 0,
      violationsByLevel: { minor: 0, moderate: 0, serious: 0, critical: 0 },
      overallScore: 0
    },
    pageResults: [],
    recommendations: [],
    wcagCompliance: {
      levelA: { passed: 0, failed: 0 },
      levelAA: { passed: 0, failed: 0 }
    }
  };
  
  // Test pages
  const pagesToTest = [
    { name: 'Home Page', url: 'http://localhost:8082/' },
    { name: 'Dashboard', url: 'http://localhost:8082/dashboard' },
    { name: 'Upload', url: 'http://localhost:8082/upload' },
    { name: 'Admin', url: 'http://localhost:8082/admin' },
    { name: 'Billing', url: 'http://localhost:8082/billing' }
  ];
  
  try {
    for (const pageInfo of pagesToTest) {
      console.log(`\\n📝 Testing ${pageInfo.name}...`);
      
      await page.goto(pageInfo.url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      
      // Run axe-core accessibility scan
      const accessibilityResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      
      // Test keyboard navigation
      const focusableElements = await page.locator(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])'
      ).count();
      
      // Test semantic structure
      const headingCount = await page.locator('h1, h2, h3, h4, h5, h6').count();
      const h1Count = await page.locator('h1').count();
      const mainCount = await page.locator('main').count();
      const navCount = await page.locator('nav').count();
      const formCount = await page.locator('form').count();
      
      // Test color contrast (simplified)
      const imagesWithoutAlt = await page.locator('img:not([alt])').count();
      
      // Test keyboard trap
      let keyboardTrapDetected = false;
      try {
        if (focusableElements > 0) {
          const firstFocusable = page.locator('button, [href], input, select, textarea').first();
          await firstFocusable.focus();
          await page.keyboard.press('Tab');
          await page.keyboard.press('Tab');
          // If we can tab, no trap detected
        }
      } catch (error) {
        keyboardTrapDetected = true;
      }
      
      const pageResult = {
        name: pageInfo.name,
        url: pageInfo.url,
        accessibility: {
          violations: accessibilityResults.violations.length,
          passes: accessibilityResults.passes.length,
          violationDetails: accessibilityResults.violations.map(v => ({
            id: v.id,
            impact: v.impact,
            description: v.description,
            helpUrl: v.helpUrl,
            nodes: v.nodes.length
          }))
        },
        keyboard: {
          focusableElements,
          keyboardTrapDetected
        },
        semantic: {
          headings: headingCount,
          h1Count,
          mainLandmarks: mainCount,
          navLandmarks: navCount,
          forms: formCount,
          imagesWithoutAlt
        },
        score: Math.round((accessibilityResults.passes.length / 
          (accessibilityResults.passes.length + accessibilityResults.violations.length)) * 100)
      };
      
      report.pageResults.push(pageResult);
      report.summary.totalPages++;
      report.summary.totalViolations += accessibilityResults.violations.length;
      report.summary.totalPasses += accessibilityResults.passes.length;
      
      // Count violations by severity
      accessibilityResults.violations.forEach(v => {
        if (v.impact) report.summary.violationsByLevel[v.impact]++;
      });
      
      console.log(`   ✅ Score: ${pageResult.score}%`);
      console.log(`   🔍 Violations: ${accessibilityResults.violations.length}`);
      console.log(`   ✅ Passes: ${accessibilityResults.passes.length}`);
      console.log(`   ⌨️  Focusable elements: ${focusableElements}`);
    }
    
    // Calculate overall score
    report.summary.overallScore = Math.round(
      (report.summary.totalPasses / 
       (report.summary.totalPasses + report.summary.totalViolations)) * 100
    );
    
    // Generate recommendations
    const commonIssues = {};
    report.pageResults.forEach(page => {
      page.accessibility.violationDetails.forEach(violation => {
        commonIssues[violation.id] = (commonIssues[violation.id] || 0) + 1;
      });
    });
    
    // Top recommendations based on most common issues
    Object.entries(commonIssues)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .forEach(([issueId, count]) => {
        const sample = report.pageResults
          .flatMap(p => p.accessibility.violationDetails)
          .find(v => v.id === issueId);
        
        if (sample) {
          report.recommendations.push({
            priority: count >= 3 ? 'HIGH' : count >= 2 ? 'MEDIUM' : 'LOW',
            issue: issueId,
            description: sample.description,
            affectedPages: count,
            helpUrl: sample.helpUrl
          });
        }
      });
    
    // WCAG Compliance assessment
    report.wcagCompliance.levelAA.passed = report.summary.totalPasses;
    report.wcagCompliance.levelAA.failed = report.summary.totalViolations;
    
    // Generate HTML report
    const htmlReport = generateHTMLReport(report);
    fs.writeFileSync('accessibility-report.html', htmlReport);
    
    // Generate JSON report  
    fs.writeFileSync('accessibility-report.json', JSON.stringify(report, null, 2));
    
    console.log('\\n📊 COMPREHENSIVE ACCESSIBILITY REPORT');
    console.log('==================================================');
    console.log(`📈 Overall Accessibility Score: ${report.summary.overallScore}%`);
    console.log(`📝 Pages Tested: ${report.summary.totalPages}`);
    console.log(`✅ Total Passes: ${report.summary.totalPasses}`);
    console.log(`❌ Total Violations: ${report.summary.totalViolations}`);
    console.log(`🔥 Critical Issues: ${report.summary.violationsByLevel.critical}`);
    console.log(`⚠️  Serious Issues: ${report.summary.violationsByLevel.serious}`);
    console.log(`⚡ Moderate Issues: ${report.summary.violationsByLevel.moderate}`);
    console.log(`💡 Minor Issues: ${report.summary.violationsByLevel.minor}`);
    
    console.log('\\n🎯 TOP RECOMMENDATIONS:');
    report.recommendations.slice(0, 3).forEach((rec, i) => {
      console.log(`${i + 1}. [${rec.priority}] ${rec.issue}`);
      console.log(`   📄 ${rec.description}`);
      console.log(`   🔗 ${rec.helpUrl}`);
      console.log(`   📊 Affects ${rec.affectedPages} page(s)\\n`);
    });
    
    console.log('📄 Reports generated:');
    console.log('   - accessibility-report.html (Visual report)');
    console.log('   - accessibility-report.json (Detailed data)');
    
  } catch (error) {
    console.error('❌ Error during accessibility testing:', error);
  } finally {
    await browser.close();
  }
}

function generateHTMLReport(report) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Accessibility Report - ${new Date(report.timestamp).toLocaleDateString()}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 40px; }
        .header { background: #f4f4f4; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
        .score { font-size: 2em; font-weight: bold; color: ${report.summary.overallScore >= 90 ? '#28a745' : report.summary.overallScore >= 70 ? '#ffc107' : '#dc3545'}; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .summary-card { background: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; }
        .page-result { border: 1px solid #ddd; margin: 20px 0; padding: 20px; border-radius: 6px; }
        .violations { background: #ffeaa7; padding: 10px; margin: 10px 0; border-radius: 4px; }
        .recommendation { background: #e3f2fd; padding: 15px; margin: 15px 0; border-radius: 6px; border-left: 4px solid #2196f3; }
        .priority-high { border-left-color: #f44336; }
        .priority-medium { border-left-color: #ff9800; }
        .priority-low { border-left-color: #4caf50; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🛡️ Accessibility Report</h1>
        <p>Generated on ${new Date(report.timestamp).toLocaleString()}</p>
        <div class="score">${report.summary.overallScore}% Accessibility Score</div>
    </div>
    
    <div class="summary-grid">
        <div class="summary-card">
            <h3>Pages Tested</h3>
            <div style="font-size: 1.5em; font-weight: bold;">${report.summary.totalPages}</div>
        </div>
        <div class="summary-card">
            <h3>Passes</h3>
            <div style="font-size: 1.5em; font-weight: bold; color: #28a745;">${report.summary.totalPasses}</div>
        </div>
        <div class="summary-card">
            <h3>Violations</h3>
            <div style="font-size: 1.5em; font-weight: bold; color: #dc3545;">${report.summary.totalViolations}</div>
        </div>
        <div class="summary-card">
            <h3>Critical Issues</h3>
            <div style="font-size: 1.5em; font-weight: bold; color: #dc3545;">${report.summary.violationsByLevel.critical}</div>
        </div>
    </div>
    
    <h2>🎯 Top Recommendations</h2>
    ${report.recommendations.map(rec => `
    <div class="recommendation priority-${rec.priority.toLowerCase()}">
        <h3>[${rec.priority}] ${rec.issue}</h3>
        <p>${rec.description}</p>
        <p><strong>Affects:</strong> ${rec.affectedPages} page(s)</p>
        <p><a href="${rec.helpUrl}" target="_blank">Learn more →</a></p>
    </div>
    `).join('')}
    
    <h2>📊 Page Results</h2>
    ${report.pageResults.map(page => `
    <div class="page-result">
        <h3>${page.name} (${page.score}%)</h3>
        <p><strong>URL:</strong> ${page.url}</p>
        <p><strong>Violations:</strong> ${page.accessibility.violations} | <strong>Passes:</strong> ${page.accessibility.passes}</p>
        <p><strong>Focusable Elements:</strong> ${page.keyboard.focusableElements}</p>
        <p><strong>Semantic Structure:</strong> ${page.semantic.h1Count} H1, ${page.semantic.mainLandmarks} main, ${page.semantic.navLandmarks} nav</p>
        
        ${page.accessibility.violationDetails.length > 0 ? `
        <div class="violations">
            <h4>Violations Found:</h4>
            ${page.accessibility.violationDetails.map(v => `
            <p><strong>${v.id}</strong> (${v.impact}): ${v.description} - ${v.nodes} element(s)</p>
            `).join('')}
        </div>
        ` : '<p style="color: #28a745;">✅ No accessibility violations found!</p>'}
    </div>
    `).join('')}
    
</body>
</html>`;
}

// Run the comprehensive test
generateComprehensiveAccessibilityReport(); 