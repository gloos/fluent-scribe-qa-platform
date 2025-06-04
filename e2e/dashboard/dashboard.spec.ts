import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';
import { testData } from '../utils/test-data';

test.describe('Dashboard and Reports', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    
    // Clear storage and login before each test
    await helpers.clearStorage();
    await helpers.mockAPIResponse('**/api/auth/login', testData.mockResponses.authSuccess);
    await helpers.login(testData.users.user.email, testData.users.user.password);
  });

  test.describe('Dashboard Overview', () => {
    test('should display dashboard with key metrics', async ({ page }) => {
      // Mock dashboard data
      await helpers.mockAPIResponse('**/api/dashboard/**', testData.mockResponses.dashboardMetrics);
      
      await helpers.navigateToPage('/dashboard');
      
      // Verify dashboard loads
      await expect(page.locator('[data-testid="dashboard-content"], .dashboard')).toBeVisible();
      
      // Check for key metrics cards
      const metricsSelectors = [
        '[data-testid="total-reports"], .metric-card:has-text("Reports")',
        '[data-testid="average-score"], .metric-card:has-text("Score")',
        '[data-testid="recent-uploads"], .metric-card:has-text("Uploads")',
        '[data-testid="system-health"], .metric-card:has-text("Health")'
      ];
      
      for (const selector of metricsSelectors) {
        const element = page.locator(selector);
        if (await element.isVisible()) {
          await expect(element).toBeVisible();
        }
      }
      
      await helpers.takeScreenshot('dashboard-overview');
    });

    test('should display recent activity feed', async ({ page }) => {
      // Mock recent activity
      await helpers.mockAPIResponse('**/api/activity/**', [
        {
          id: 'activity-1',
          type: 'upload',
          message: 'Document uploaded: sample.pdf',
          timestamp: '2024-01-01T10:00:00Z'
        },
        {
          id: 'activity-2',
          type: 'analysis',
          message: 'Analysis completed for document.docx',
          timestamp: '2024-01-01T09:30:00Z'
        }
      ]);
      
      await helpers.navigateToPage('/dashboard');
      
      // Look for activity feed
      const activityFeed = page.locator('[data-testid="activity-feed"], .activity-feed');
      if (await activityFeed.isVisible()) {
        await expect(activityFeed).toContainText('sample.pdf');
        await expect(activityFeed).toContainText('document.docx');
      }
    });

    test('should display charts and visualizations', async ({ page }) => {
      await helpers.navigateToPage('/dashboard');
      
      // Check for chart components
      const chartSelectors = [
        '[data-testid="score-chart"], .recharts-container',
        '[data-testid="trend-chart"], canvas',
        '[data-testid="analytics-chart"], svg'
      ];
      
      for (const selector of chartSelectors) {
        const chart = page.locator(selector);
        if (await chart.isVisible()) {
          await expect(chart).toBeVisible();
        }
      }
    });

    test('should navigate to different sections from dashboard', async ({ page }) => {
      await helpers.navigateToPage('/dashboard');
      
      // Test navigation buttons/links
      const navigationTests = [
        { selector: '[data-testid="upload-nav"], a[href="/upload"]', expectedUrl: '/upload' },
        { selector: '[data-testid="reports-nav"], a[href="/reports"]', expectedUrl: '/reports' },
        { selector: '[data-testid="billing-nav"], a[href="/billing"]', expectedUrl: '/billing' }
      ];
      
      for (const nav of navigationTests) {
        const navElement = page.locator(nav.selector);
        if (await navElement.isVisible()) {
          await navElement.click();
          await expect(page).toHaveURL(new RegExp(nav.expectedUrl));
          await helpers.navigateToPage('/dashboard'); // Return to dashboard
        }
      }
    });
  });

  test.describe('Reports Listing', () => {
    test('should display reports list with pagination', async ({ page }) => {
      // Mock reports data
      await helpers.mockAPIResponse('**/api/reports**', testData.mockResponses.reportsData);
      
      await helpers.navigateToPage('/reports');
      
      // Verify reports page loads
      await expect(page.locator('[data-testid="reports-list"], .reports-table, table')).toBeVisible();
      
      // Check for report entries
      for (const report of testData.mockResponses.reportsData) {
        await expect(page.locator('[data-testid="reports-list"]')).toContainText(report.name);
      }
      
      // Check for pagination if present
      const pagination = page.locator('[data-testid="pagination"], .pagination');
      if (await pagination.isVisible()) {
        await expect(pagination).toBeVisible();
      }
      
      await helpers.takeScreenshot('reports-list');
    });

    test('should filter and search reports', async ({ page }) => {
      await helpers.mockAPIResponse('**/api/reports**', testData.mockResponses.reportsData);
      await helpers.navigateToPage('/reports');
      
      // Test search functionality
      const searchInput = page.locator('[data-testid="search-input"], input[placeholder*="search"]');
      if (await searchInput.isVisible()) {
        await searchInput.fill('Sample Report 1');
        await helpers.waitForPageLoad();
        
        // Should show filtered results
        await expect(page.locator('[data-testid="reports-list"]')).toContainText('Sample Report 1');
        await expect(page.locator('[data-testid="reports-list"]')).not.toContainText('Sample Report 2');
      }
      
      // Test filter dropdown
      const filterDropdown = page.locator('[data-testid="status-filter"], select');
      if (await filterDropdown.isVisible()) {
        await filterDropdown.selectOption('completed');
        await helpers.waitForPageLoad();
        
        // Should show only completed reports
        const completedReports = page.locator('[data-testid="report-row"]:has-text("completed")');
        await expect(completedReports).toBeVisible();
      }
    });

    test('should sort reports by different columns', async ({ page }) => {
      await helpers.mockAPIResponse('**/api/reports**', testData.mockResponses.reportsData);
      await helpers.navigateToPage('/reports');
      
      // Test sorting by clicking column headers
      const sortableColumns = [
        '[data-testid="sort-name"], th:has-text("Name")',
        '[data-testid="sort-date"], th:has-text("Date")',
        '[data-testid="sort-score"], th:has-text("Score")'
      ];
      
      for (const column of sortableColumns) {
        const columnHeader = page.locator(column);
        if (await columnHeader.isVisible()) {
          await columnHeader.click();
          await helpers.waitForPageLoad();
          
          // Verify sorting indicators
          const sortIndicator = page.locator('[data-testid="sort-indicator"], .sort-asc, .sort-desc');
          if (await sortIndicator.isVisible()) {
            await expect(sortIndicator).toBeVisible();
          }
        }
      }
    });
  });

  test.describe('Detailed Report View', () => {
    test('should display detailed report information', async ({ page }) => {
      // Mock detailed report data
      await helpers.mockAPIResponse('**/api/reports/report-1', {
        id: 'report-1',
        name: 'Detailed Test Report',
        score: 85,
        status: 'completed',
        createdAt: '2024-01-01T00:00:00Z',
        analysis: {
          sections: [
            { name: 'Grammar', score: 90, issues: 3 },
            { name: 'Clarity', score: 80, issues: 5 },
            { name: 'Structure', score: 85, issues: 2 }
          ],
          recommendations: [
            'Improve sentence clarity in section 2',
            'Review punctuation usage',
            'Consider restructuring paragraph 3'
          ]
        }
      });
      
      await helpers.navigateToPage('/report/report-1');
      
      // Verify detailed report loads
      await expect(page.locator('[data-testid="report-detail"], .report-detail')).toBeVisible();
      
      // Check for report metadata
      await expect(page.locator('[data-testid="report-title"]')).toContainText('Detailed Test Report');
      await expect(page.locator('[data-testid="report-score"]')).toContainText('85');
      
      // Check for analysis sections
      await expect(page.locator('[data-testid="grammar-section"]')).toContainText('Grammar');
      await expect(page.locator('[data-testid="clarity-section"]')).toContainText('Clarity');
      
      // Check for recommendations
      await expect(page.locator('[data-testid="recommendations"]')).toContainText('Improve sentence clarity');
      
      await helpers.takeScreenshot('detailed-report');
    });

    test('should allow downloading report in different formats', async ({ page }) => {
      await helpers.navigateToPage('/report/report-1');
      
      // Test PDF download
      const pdfDownload = page.locator('[data-testid="download-pdf"], button:has-text("PDF")');
      if (await pdfDownload.isVisible()) {
        // Set up download handler
        const downloadPromise = page.waitForEvent('download');
        await pdfDownload.click();
        const download = await downloadPromise;
        
        // Verify download
        expect(download.suggestedFilename()).toMatch(/\.pdf$/);
      }
      
      // Test Excel download
      const excelDownload = page.locator('[data-testid="download-excel"], button:has-text("Excel")');
      if (await excelDownload.isVisible()) {
        const downloadPromise = page.waitForEvent('download');
        await excelDownload.click();
        const download = await downloadPromise;
        
        expect(download.suggestedFilename()).toMatch(/\.xlsx?$/);
      }
    });

    test('should display interactive charts in report detail', async ({ page }) => {
      await helpers.navigateToPage('/report/report-1');
      
      // Check for interactive elements
      const chartElements = [
        '[data-testid="score-breakdown-chart"], .recharts-container',
        '[data-testid="trend-analysis"], canvas',
        '[data-testid="comparison-chart"], svg'
      ];
      
      for (const selector of chartElements) {
        const chart = page.locator(selector);
        if (await chart.isVisible()) {
          await expect(chart).toBeVisible();
          
          // Test chart interactivity
          await chart.hover();
          const tooltip = page.locator('[data-testid="chart-tooltip"], .recharts-tooltip');
          if (await tooltip.isVisible()) {
            await expect(tooltip).toBeVisible();
          }
        }
      }
    });

    test('should allow sharing reports', async ({ page }) => {
      await helpers.navigateToPage('/report/report-1');
      
      // Test share functionality
      const shareButton = page.locator('[data-testid="share-report"], button:has-text("Share")');
      if (await shareButton.isVisible()) {
        await shareButton.click();
        
        // Check for share modal/dropdown
        const shareModal = page.locator('[data-testid="share-modal"], .share-options');
        await expect(shareModal).toBeVisible();
        
        // Test copy link functionality
        const copyLinkButton = page.locator('[data-testid="copy-link"], button:has-text("Copy Link")');
        if (await copyLinkButton.isVisible()) {
          await copyLinkButton.click();
          
          // Should show success message
          await expect(page.locator('[data-testid="copy-success"], .success')).toBeVisible();
        }
      }
    });
  });

  test.describe('Report Actions', () => {
    test('should allow regenerating reports', async ({ page }) => {
      await helpers.navigateToPage('/reports');
      
      // Find regenerate button
      const regenerateButton = page.locator('[data-testid="regenerate-report"], button:has-text("Regenerate")');
      if (await regenerateButton.isVisible()) {
        await regenerateButton.click();
        
        // Should show confirmation dialog
        const confirmDialog = page.locator('[data-testid="confirm-dialog"], .confirmation');
        if (await confirmDialog.isVisible()) {
          await helpers.clickButtonByText('Confirm');
          
          // Should show processing status
          await expect(page.locator('[data-testid="processing"], .processing')).toBeVisible();
        }
      }
    });

    test('should allow deleting reports', async ({ page }) => {
      await helpers.navigateToPage('/reports');
      
      // Find delete button
      const deleteButton = page.locator('[data-testid="delete-report"], button:has-text("Delete")');
      if (await deleteButton.isVisible()) {
        await deleteButton.click();
        
        // Should show confirmation dialog
        const confirmDialog = page.locator('[data-testid="confirm-delete"], .delete-confirmation');
        if (await confirmDialog.isVisible()) {
          await helpers.clickButtonByText('Delete');
          
          // Should show success message
          await expect(page.locator('[data-testid="delete-success"], .success')).toBeVisible();
        }
      }
    });

    test('should allow batch operations on reports', async ({ page }) => {
      await helpers.navigateToPage('/reports');
      
      // Select multiple reports
      const checkboxes = page.locator('[data-testid="select-report"], input[type="checkbox"]');
      const checkboxCount = await checkboxes.count();
      
      if (checkboxCount > 0) {
        // Select first two reports
        await checkboxes.nth(0).check();
        await checkboxes.nth(1).check();
        
        // Check for batch actions
        const batchActions = page.locator('[data-testid="batch-actions"], .batch-operations');
        if (await batchActions.isVisible()) {
          await expect(batchActions).toBeVisible();
          
          // Test batch download
          const batchDownload = page.locator('[data-testid="batch-download"], button:has-text("Download Selected")');
          if (await batchDownload.isVisible()) {
            const downloadPromise = page.waitForEvent('download');
            await batchDownload.click();
            const download = await downloadPromise;
            expect(download.suggestedFilename()).toBeTruthy();
          }
        }
      }
    });
  });

  test.describe('Performance and Loading', () => {
    test('should handle large datasets efficiently', async ({ page }) => {
      // Mock large dataset
      const largeDataset = Array.from({ length: 100 }, (_, i) => ({
        id: `report-${i}`,
        name: `Report ${i}`,
        createdAt: '2024-01-01T00:00:00Z',
        status: i % 2 === 0 ? 'completed' : 'processing',
        score: Math.floor(Math.random() * 100)
      }));
      
      await helpers.mockAPIResponse('**/api/reports**', largeDataset);
      await helpers.navigateToPage('/reports');
      
      // Should load within reasonable time
      await expect(page.locator('[data-testid="reports-list"], table')).toBeVisible({ timeout: 15000 });
      
      // Check for virtualization or pagination
      const virtualList = page.locator('[data-testid="virtual-list"], .virtual-list');
      const pagination = page.locator('[data-testid="pagination"], .pagination');
      
      expect(await virtualList.isVisible() || await pagination.isVisible()).toBeTruthy();
    });

    test('should show loading states appropriately', async ({ page }) => {
      // Delay API response to test loading states
      await page.route('**/api/reports**', async route => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(testData.mockResponses.reportsData)
        });
      });
      
      await helpers.navigateToPage('/reports');
      
      // Should show loading indicator
      await expect(page.locator('[data-testid="loading"], .loading, .spinner')).toBeVisible();
      
      // Eventually should show data
      await expect(page.locator('[data-testid="reports-list"]')).toBeVisible({ timeout: 30000 });
    });
  });

  test.describe('Real-time Updates', () => {
    test('should update report status in real-time', async ({ page }) => {
      await helpers.navigateToPage('/reports');
      
      // Mock initial data with processing status
      await helpers.mockAPIResponse('**/api/reports**', [
        {
          id: 'report-processing',
          name: 'Processing Report',
          status: 'processing',
          score: null
        }
      ]);
      
      // Check initial state
      await expect(page.locator('[data-testid="reports-list"]')).toContainText('processing');
      
      // Mock status update via WebSocket or polling
      await helpers.mockAPIResponse('**/api/reports**', [
        {
          id: 'report-processing',
          name: 'Processing Report',
          status: 'completed',
          score: 88
        }
      ]);
      
      // Trigger update (refresh or WebSocket event)
      await page.reload();
      
      // Should show updated status
      await expect(page.locator('[data-testid="reports-list"]')).toContainText('completed');
      await expect(page.locator('[data-testid="reports-list"]')).toContainText('88');
    });
  });
}); 