import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';
import { testData } from '../utils/test-data';
import path from 'path';

test.describe('File Upload and Analysis Workflow', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    
    // Clear storage and login before each test
    await helpers.clearStorage();
    await helpers.mockAPIResponse('**/api/auth/login', testData.mockResponses.authSuccess);
    await helpers.login(testData.users.user.email, testData.users.user.password);
  });

  test.describe('Upload Interface', () => {
    test('should display upload interface correctly', async ({ page }) => {
      await helpers.navigateToPage('/upload');
      
      // Verify upload form is visible
      await expect(page.locator('[data-testid="upload-form"], input[type="file"], .upload-area')).toBeVisible();
      
      // Check for upload instructions or dropzone
      await expect(page.locator('[data-testid="upload-instructions"], .dropzone, .upload-text')).toBeVisible();
      
      // Verify supported file types are displayed
      const supportedTypes = page.locator('[data-testid="supported-types"], .file-types');
      if (await supportedTypes.isVisible()) {
        await expect(supportedTypes).toContainText(/pdf|docx|txt/i);
      }
      
      await helpers.takeScreenshot('upload-interface');
    });

    test('should allow file selection via file input', async ({ page }) => {
      await helpers.navigateToPage('/upload');
      
      // Create a test file for upload
      const testFile = path.join(__dirname, '../fixtures/sample-document.txt');
      
      // Select file through input
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles([{
        name: 'test-document.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('This is a test document for QA analysis.')
      }]);
      
      // Verify file is selected
      await expect(page.locator('[data-testid="selected-file"], .file-name')).toContainText('test-document.txt');
    });

    test('should support drag and drop file upload', async ({ page }) => {
      await helpers.navigateToPage('/upload');
      
      // Find dropzone area
      const dropzone = page.locator('[data-testid="dropzone"], .dropzone, .upload-area');
      await expect(dropzone).toBeVisible();
      
      // Simulate drag and drop
      const testFileBuffer = Buffer.from('Test document content for drag and drop upload.');
      await dropzone.setInputFiles([{
        name: 'dragged-document.txt',
        mimeType: 'text/plain',
        buffer: testFileBuffer
      }]);
      
      // Verify file is processed
      await expect(page.locator('[data-testid="selected-file"], .file-name')).toContainText('dragged-document.txt');
    });
  });

  test.describe('File Upload Process', () => {
    test('should successfully upload and process a valid document', async ({ page }) => {
      // Mock successful upload response
      await helpers.mockAPIResponse('**/api/upload/**', testData.mockResponses.uploadSuccess);
      
      await helpers.navigateToPage('/upload');
      
      // Upload file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles([{
        name: 'valid-document.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 Sample PDF content')
      }]);
      
      // Start upload process
      await helpers.clickButtonByText('Upload');
      
      // Verify upload progress is shown
      await expect(page.locator('[data-testid="upload-progress"], .progress, .uploading')).toBeVisible();
      
      // Wait for upload completion
      await expect(page.locator('[data-testid="upload-success"], .success')).toBeVisible({ 
        timeout: testData.timeouts.upload 
      });
      
      // Verify success message
      await expect(page.locator('[data-testid="upload-success"]')).toContainText(/uploaded|success/i);
      
      await helpers.takeScreenshot('upload-success');
    });

    test('should handle upload errors gracefully', async ({ page }) => {
      // Mock upload failure
      await helpers.mockAPIResponse('**/api/upload/**', { 
        error: 'Upload failed', 
        message: 'File too large' 
      });
      
      await helpers.navigateToPage('/upload');
      
      // Upload file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles([{
        name: 'large-document.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('Large PDF content'.repeat(1000))
      }]);
      
      await helpers.clickButtonByText('Upload');
      
      // Should show error message
      await expect(page.locator('[data-testid="upload-error"], .error')).toBeVisible();
      await expect(page.locator('[data-testid="upload-error"]')).toContainText(/failed|error|large/i);
    });

    test('should validate file types before upload', async ({ page }) => {
      await helpers.navigateToPage('/upload');
      
      // Try to upload unsupported file type
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles([{
        name: 'unsupported-file.xyz',
        mimeType: 'application/unknown',
        buffer: Buffer.from('Unsupported file content')
      }]);
      
      // Should show validation error
      await expect(page.locator('[data-testid="file-type-error"], .error')).toBeVisible();
      await expect(page.locator('[data-testid="file-type-error"]')).toContainText(/not supported|invalid type/i);
    });

    test('should validate file size limits', async ({ page }) => {
      await helpers.navigateToPage('/upload');
      
      // Try to upload oversized file
      const largeContent = 'x'.repeat(10 * 1024 * 1024); // 10MB
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles([{
        name: 'oversized-document.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from(largeContent)
      }]);
      
      // Should show size validation error
      await expect(page.locator('[data-testid="file-size-error"], .error')).toBeVisible();
      await expect(page.locator('[data-testid="file-size-error"]')).toContainText(/too large|size limit/i);
    });
  });

  test.describe('Document Analysis', () => {
    test('should start analysis after successful upload', async ({ page }) => {
      // Mock successful upload and analysis start
      await helpers.mockAPIResponse('**/api/upload/**', testData.mockResponses.uploadSuccess);
      await helpers.mockAPIResponse('**/api/analyze/**', { 
        analysisId: 'analysis-123', 
        status: 'processing' 
      });
      
      await helpers.navigateToPage('/upload');
      
      // Upload and start analysis
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles([{
        name: 'document-for-analysis.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 Document content for QA analysis')
      }]);
      
      await helpers.clickButtonByText('Upload');
      
      // Wait for upload success
      await expect(page.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 30000 });
      
      // Analysis should start automatically or via button click
      const analyzeButton = page.locator('[data-testid="start-analysis"], button:has-text("Analyze")');
      if (await analyzeButton.isVisible()) {
        await analyzeButton.click();
      }
      
      // Verify analysis is started
      await expect(page.locator('[data-testid="analysis-progress"], .analyzing')).toBeVisible();
      
      await helpers.takeScreenshot('analysis-started');
    });

    test('should display analysis progress', async ({ page }) => {
      // Mock analysis in progress
      await helpers.mockAPIResponse('**/api/analyze/**', { 
        analysisId: 'analysis-123', 
        status: 'processing',
        progress: 45 
      });
      
      await helpers.navigateToPage('/upload');
      
      // Upload file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles([{
        name: 'progress-test.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 Progress test document')
      }]);
      
      await helpers.clickButtonByText('Upload');
      
      // Start analysis
      await expect(page.locator('[data-testid="upload-success"]')).toBeVisible();
      const analyzeButton = page.locator('[data-testid="start-analysis"], button:has-text("Analyze")');
      if (await analyzeButton.isVisible()) {
        await analyzeButton.click();
      }
      
      // Verify progress indicator
      await expect(page.locator('[data-testid="analysis-progress"], .progress-bar')).toBeVisible();
      
      // Check for progress percentage
      const progressText = page.locator('[data-testid="progress-text"], .progress-text');
      if (await progressText.isVisible()) {
        await expect(progressText).toContainText(/\d+%/);
      }
    });

    test('should handle analysis completion and redirect to report', async ({ page }) => {
      // Mock completed analysis
      await helpers.mockAPIResponse('**/api/analyze/**', { 
        analysisId: 'analysis-456', 
        status: 'completed',
        reportId: 'report-789' 
      });
      
      await helpers.navigateToPage('/upload');
      
      // Complete upload and analysis flow
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles([{
        name: 'completed-analysis.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 Completed analysis test')
      }]);
      
      await helpers.clickButtonByText('Upload');
      await expect(page.locator('[data-testid="upload-success"]')).toBeVisible();
      
      // Analysis completion should show success or redirect
      await expect(page.locator('[data-testid="analysis-complete"], .analysis-success')).toBeVisible({
        timeout: testData.timeouts.analysis
      });
      
      // Should offer to view report
      const viewReportButton = page.locator('[data-testid="view-report"], button:has-text("View Report")');
      if (await viewReportButton.isVisible()) {
        await viewReportButton.click();
        
        // Should navigate to report page
        await expect(page).toHaveURL(/\/report\//);
      }
    });

    test('should handle analysis errors', async ({ page }) => {
      // Mock analysis failure
      await helpers.mockAPIResponse('**/api/analyze/**', { 
        error: 'Analysis failed', 
        message: 'Document format not supported for analysis' 
      });
      
      await helpers.navigateToPage('/upload');
      
      // Upload file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles([{
        name: 'error-analysis.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('Corrupted PDF content')
      }]);
      
      await helpers.clickButtonByText('Upload');
      await expect(page.locator('[data-testid="upload-success"]')).toBeVisible();
      
      // Start analysis
      const analyzeButton = page.locator('[data-testid="start-analysis"], button:has-text("Analyze")');
      if (await analyzeButton.isVisible()) {
        await analyzeButton.click();
      }
      
      // Should show analysis error
      await expect(page.locator('[data-testid="analysis-error"], .error')).toBeVisible();
      await expect(page.locator('[data-testid="analysis-error"]')).toContainText(/failed|error/i);
    });
  });

  test.describe('Multiple File Upload', () => {
    test('should support uploading multiple files', async ({ page }) => {
      await helpers.navigateToPage('/upload');
      
      // Check if multiple file upload is supported
      const fileInput = page.locator('input[type="file"]');
      const hasMultiple = await fileInput.getAttribute('multiple');
      
      if (hasMultiple !== null) {
        // Upload multiple files
        await fileInput.setInputFiles([
          {
            name: 'document1.pdf',
            mimeType: 'application/pdf',
            buffer: Buffer.from('%PDF-1.4 First document')
          },
          {
            name: 'document2.txt',
            mimeType: 'text/plain',
            buffer: Buffer.from('Second document content')
          }
        ]);
        
        // Verify both files are listed
        await expect(page.locator('[data-testid="file-list"], .file-list')).toContainText('document1.pdf');
        await expect(page.locator('[data-testid="file-list"], .file-list')).toContainText('document2.txt');
      }
    });

    test('should allow removing files from upload queue', async ({ page }) => {
      await helpers.navigateToPage('/upload');
      
      // Upload multiple files
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles([
        {
          name: 'remove-test1.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('%PDF-1.4 Remove test 1')
        },
        {
          name: 'remove-test2.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('%PDF-1.4 Remove test 2')
        }
      ]);
      
      // Look for remove buttons
      const removeButtons = page.locator('[data-testid="remove-file"], .remove-file, button:has-text("Remove")');
      const removeButtonCount = await removeButtons.count();
      
      if (removeButtonCount > 0) {
        // Remove first file
        await removeButtons.first().click();
        
        // Verify file is removed from list
        await expect(page.locator('[data-testid="file-list"]')).not.toContainText('remove-test1.pdf');
        await expect(page.locator('[data-testid="file-list"]')).toContainText('remove-test2.pdf');
      }
    });
  });

  test.describe('Upload History and Management', () => {
    test('should display upload history', async ({ page }) => {
      // Mock upload history
      await helpers.mockAPIResponse('**/api/uploads/history', [
        {
          id: 'upload-1',
          filename: 'document1.pdf',
          uploadedAt: '2024-01-01T10:00:00Z',
          status: 'completed'
        },
        {
          id: 'upload-2', 
          filename: 'document2.docx',
          uploadedAt: '2024-01-01T11:00:00Z',
          status: 'processing'
        }
      ]);
      
      await helpers.navigateToPage('/upload');
      
      // Look for upload history section
      const historySection = page.locator('[data-testid="upload-history"], .upload-history');
      if (await historySection.isVisible()) {
        await expect(historySection).toContainText('document1.pdf');
        await expect(historySection).toContainText('document2.docx');
      }
    });

    test('should allow re-processing of failed uploads', async ({ page }) => {
      await helpers.navigateToPage('/upload');
      
      // Look for failed uploads that can be retried
      const retryButton = page.locator('[data-testid="retry-upload"], button:has-text("Retry")');
      if (await retryButton.isVisible()) {
        await retryButton.click();
        
        // Should start reprocessing
        await expect(page.locator('[data-testid="upload-progress"], .progress')).toBeVisible();
      }
    });
  });
}); 