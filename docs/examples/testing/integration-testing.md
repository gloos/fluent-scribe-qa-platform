# Integration Testing Patterns

This guide provides comprehensive testing strategies for API integrations, covering unit tests, integration tests, end-to-end testing, and mocking patterns for the Translation QA Platform API.

## Testing Strategy Overview

### Test Pyramid Structure

1. **Unit Tests (70%)** - Test individual functions and classes
2. **Integration Tests (20%)** - Test API interactions and workflows
3. **End-to-End Tests (10%)** - Test complete user journeys

### Test Categories

- **Authentication Tests** - Login, token refresh, API key validation
- **API Client Tests** - Request/response handling, error scenarios
- **Workflow Tests** - Complete file processing workflows
- **Error Handling Tests** - Network failures, rate limiting, validation errors
- **Performance Tests** - Load testing, concurrent operations

---

## JavaScript/Node.js Testing

### 1. Unit Tests with Jest

```javascript
// tests/unit/apiClient.test.js
import { jest } from '@jest/globals';
import fetch from 'node-fetch';
import { APIClient } from '../../src/apiClient.js';
import { AuthenticationManager } from '../../src/auth.js';

// Mock fetch globally
jest.mock('node-fetch');
const mockFetch = fetch;

describe('APIClient', () => {
  let apiClient;
  let mockAuth;

  beforeEach(() => {
    mockAuth = {
      getValidToken: jest.fn().mockResolvedValue('mock-token'),
      refreshAccessToken: jest.fn().mockResolvedValue('new-token'),
      onAuthFailure: jest.fn()
    };
    
    apiClient = new APIClient('https://api.example.com', mockAuth);
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('request method', () => {
    it('should make successful API request', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ data: 'test' }),
        headers: new Map()
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await apiClient.request('/test-endpoint');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/test-endpoint',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token'
          })
        })
      );
      expect(result).toEqual({ data: 'test' });
    });

    it('should handle 401 error and retry with refreshed token', async () => {
      // First call returns 401
      const unauthorizedResponse = {
        ok: false,
        status: 401,
        json: jest.fn().mockResolvedValue({ error: { message: 'Unauthorized' } })
      };
      
      // Second call succeeds
      const successResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ data: 'success' })
      };

      mockFetch
        .mockResolvedValueOnce(unauthorizedResponse)
        .mockResolvedValueOnce(successResponse);

      const result = await apiClient.request('/test-endpoint');

      expect(mockAuth.refreshAccessToken).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ data: 'success' });
    });

    it('should throw error when refresh token fails', async () => {
      const unauthorizedResponse = {
        ok: false,
        status: 401,
        json: jest.fn().mockResolvedValue({ error: { message: 'Unauthorized' } })
      };
      
      mockFetch.mockResolvedValue(unauthorizedResponse);
      mockAuth.refreshAccessToken.mockRejectedValue(new Error('Refresh failed'));

      await expect(apiClient.request('/test-endpoint'))
        .rejects.toThrow('Authentication session expired');
      
      expect(mockAuth.onAuthFailure).toHaveBeenCalledWith('Token refresh failed during request');
    });

    it('should handle rate limiting with exponential backoff', async () => {
      const rateLimitResponse = {
        ok: false,
        status: 429,
        headers: {
          get: jest.fn().mockReturnValue('60')
        },
        json: jest.fn().mockResolvedValue({ 
          error: { message: 'Rate limit exceeded' } 
        })
      };

      const successResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ data: 'success' })
      };

      mockFetch
        .mockResolvedValueOnce(rateLimitResponse)
        .mockResolvedValueOnce(successResponse);

      // Mock setTimeout to avoid actual delays in tests
      jest.spyOn(global, 'setTimeout').mockImplementation((cb) => cb());

      const result = await apiClient.request('/test-endpoint');

      expect(result).toEqual({ data: 'success' });
      expect(mockFetch).toHaveBeenCalledTimes(2);
      
      global.setTimeout.mockRestore();
    });
  });

  describe('uploadFile method', () => {
    it('should upload file successfully', async () => {
      const mockFile = Buffer.from('test file content');
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ file_id: 'file-123' })
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await apiClient.uploadFile(mockFile, {
        source_language: 'en',
        target_language: 'fr'
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/files',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token'
          })
        })
      );
      expect(result).toEqual({ file_id: 'file-123' });
    });

    it('should validate file before upload', async () => {
      const emptyFile = Buffer.alloc(0);

      await expect(apiClient.uploadFile(emptyFile))
        .rejects.toThrow('File cannot be empty');
    });
  });
});

// tests/unit/authenticationManager.test.js
describe('AuthenticationManager', () => {
  let authManager;

  beforeEach(() => {
    authManager = new AuthenticationManager('https://api.example.com');
    jest.clearAllMocks();
  });

  describe('login method', () => {
    it('should login successfully and set tokens', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          user: { email: 'test@example.com' }
        })
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await authManager.login('test@example.com', 'password');

      expect(result.user.email).toBe('test@example.com');
      expect(authManager.accessToken).toBe('access-token');
      expect(authManager.refreshToken).toBe('refresh-token');
    });

    it('should throw error on invalid credentials', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        json: jest.fn().mockResolvedValue({
          error: { message: 'Invalid credentials' }
        })
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(authManager.login('test@example.com', 'wrong-password'))
        .rejects.toThrow('Invalid credentials');
    });
  });

  describe('token expiry handling', () => {
    it('should detect expired tokens', () => {
      authManager.tokenExpiry = new Date(Date.now() - 1000); // 1 second ago
      
      expect(authManager.isTokenExpired()).toBe(true);
    });

    it('should detect tokens expiring soon', () => {
      authManager.tokenExpiry = new Date(Date.now() + 60000); // 1 minute from now
      
      expect(authManager.isTokenExpired(5)).toBe(true); // 5 minute buffer
    });
  });
});
```

### 2. Integration Tests

```javascript
// tests/integration/apiIntegration.test.js
import { APIClient } from '../../src/apiClient.js';
import { AuthenticationManager } from '../../src/auth.js';
import { setupTestServer, teardownTestServer } from '../helpers/testServer.js';

describe('API Integration Tests', () => {
  let apiClient;
  let authManager;
  let testServer;

  beforeAll(async () => {
    testServer = await setupTestServer();
  });

  afterAll(async () => {
    await teardownTestServer(testServer);
  });

  beforeEach(async () => {
    authManager = new AuthenticationManager(testServer.url);
    apiClient = new APIClient(testServer.url, authManager);
    
    // Login for authenticated tests
    await authManager.login('test@example.com', 'testpassword');
  });

  describe('File Operations', () => {
    it('should complete full file upload workflow', async () => {
      // Upload file
      const testFile = Buffer.from('<?xml version="1.0"?><xliff>test</xliff>');
      const uploadResult = await apiClient.uploadFile(testFile, {
        source_language: 'en',
        target_language: 'fr',
        assessment_model: 'gpt-4'
      });

      expect(uploadResult.file_id).toBeDefined();
      expect(uploadResult.processing_status).toBe('uploaded');

      // Check file status
      const fileStatus = await apiClient.request(`/files/${uploadResult.file_id}`);
      expect(fileStatus.id).toBe(uploadResult.file_id);
      expect(fileStatus.source_language).toBe('en');
      expect(fileStatus.target_language).toBe('fr');

      // List files should include our upload
      const filesList = await apiClient.request('/files');
      const ourFile = filesList.find(f => f.id === uploadResult.file_id);
      expect(ourFile).toBeDefined();
    });

    it('should handle file upload errors gracefully', async () => {
      const invalidFile = Buffer.from('not an xliff file');
      
      await expect(apiClient.uploadFile(invalidFile, {
        source_language: 'invalid',
        target_language: 'fr'
      })).rejects.toThrow();
    });
  });

  describe('Assessment Operations', () => {
    let testFileId;

    beforeEach(async () => {
      // Upload a test file for assessment
      const testFile = Buffer.from('<?xml version="1.0"?><xliff>test</xliff>');
      const uploadResult = await apiClient.uploadFile(testFile, {
        source_language: 'en',
        target_language: 'fr'
      });
      testFileId = uploadResult.file_id;
      
      // Wait for file processing (in real tests, you might mock this)
      await waitForFileProcessing(apiClient, testFileId);
    });

    it('should create and complete assessment', async () => {
      // Create assessment
      const assessmentResult = await apiClient.request('/assessments', {
        method: 'POST',
        body: JSON.stringify({
          file_id: testFileId,
          assessment_model: 'gpt-4',
          quality_dimensions: ['accuracy', 'fluency'],
          include_suggestions: true
        })
      });

      expect(assessmentResult.assessment_id).toBeDefined();
      expect(assessmentResult.status).toBe('queued');

      // Wait for assessment completion
      const completedAssessment = await waitForAssessmentCompletion(
        apiClient, 
        assessmentResult.assessment_id
      );

      expect(completedAssessment.status).toBe('completed');
      expect(completedAssessment.results).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    it('should handle rate limiting gracefully', async () => {
      const requests = [];
      
      // Make multiple concurrent requests to trigger rate limiting
      for (let i = 0; i < 10; i++) {
        requests.push(apiClient.request('/files'));
      }

      // Some requests should succeed, others might be rate limited
      const results = await Promise.allSettled(requests);
      
      const successful = results.filter(r => r.status === 'fulfilled');
      const rateLimited = results.filter(r => 
        r.status === 'rejected' && 
        r.reason.message.includes('rate limit')
      );

      expect(successful.length + rateLimited.length).toBe(10);
    });
  });

  describe('Error Recovery', () => {
    it('should recover from network errors', async () => {
      // Simulate network failure by stopping server temporarily
      await testServer.stop();
      
      let errorThrown = false;
      try {
        await apiClient.request('/files');
      } catch (error) {
        errorThrown = true;
        expect(error.message).toMatch(/network|connection/i);
      }
      
      expect(errorThrown).toBe(true);
      
      // Restart server and verify recovery
      await testServer.start();
      const result = await apiClient.request('/files');
      expect(Array.isArray(result)).toBe(true);
    });
  });
});

// Helper functions
async function waitForFileProcessing(apiClient, fileId, maxWait = 30000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWait) {
    const fileStatus = await apiClient.request(`/files/${fileId}`);
    
    if (fileStatus.processing_status === 'completed') {
      return fileStatus;
    } else if (fileStatus.processing_status === 'failed') {
      throw new Error('File processing failed');
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error('File processing timeout');
}

async function waitForAssessmentCompletion(apiClient, assessmentId, maxWait = 60000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWait) {
    const assessment = await apiClient.request(`/assessments/${assessmentId}`);
    
    if (assessment.status === 'completed') {
      return assessment;
    } else if (assessment.status === 'failed') {
      throw new Error('Assessment failed');
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  throw new Error('Assessment timeout');
}
```

### 3. Test Server Setup

```javascript
// tests/helpers/testServer.js
import express from 'express';
import { createServer } from 'http';

export class TestServer {
  constructor() {
    this.app = express();
    this.server = null;
    this.port = 0;
    this.url = '';
    
    this.setupRoutes();
    this.setupMiddleware();
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.raw({ type: 'application/octet-stream', limit: '100mb' }));
    
    // Add CORS for testing
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', '*');
      res.header('Access-Control-Allow-Methods', '*');
      next();
    });
  }

  setupRoutes() {
    // Mock authentication endpoints
    this.app.post('/auth/login', (req, res) => {
      const { email, password } = req.body;
      
      if (email === 'test@example.com' && password === 'testpassword') {
        res.json({
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          user: { email, id: 'user-123' }
        });
      } else {
        res.status(401).json({
          error: { message: 'Invalid credentials' }
        });
      }
    });

    this.app.post('/auth/refresh', (req, res) => {
      const { refresh_token } = req.body;
      
      if (refresh_token === 'mock-refresh-token') {
        res.json({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token'
        });
      } else {
        res.status(401).json({
          error: { message: 'Invalid refresh token' }
        });
      }
    });

    // Mock file endpoints
    this.app.get('/files', this.requireAuth, (req, res) => {
      res.json([
        { id: 'file-1', name: 'test1.xliff', status: 'completed' },
        { id: 'file-2', name: 'test2.xliff', status: 'processing' }
      ]);
    });

    this.app.post('/files', this.requireAuth, (req, res) => {
      const fileId = `file-${Date.now()}`;
      res.json({
        file_id: fileId,
        processing_status: 'uploaded',
        created_at: new Date().toISOString()
      });
    });

    this.app.get('/files/:id', this.requireAuth, (req, res) => {
      const { id } = req.params;
      res.json({
        id,
        processing_status: 'completed',
        source_language: 'en',
        target_language: 'fr',
        created_at: new Date().toISOString()
      });
    });

    // Mock assessment endpoints
    this.app.post('/assessments', this.requireAuth, (req, res) => {
      const assessmentId = `assessment-${Date.now()}`;
      res.json({
        assessment_id: assessmentId,
        status: 'queued',
        created_at: new Date().toISOString()
      });
    });

    this.app.get('/assessments/:id', this.requireAuth, (req, res) => {
      const { id } = req.params;
      res.json({
        id,
        status: 'completed',
        results: {
          overall_score: 85,
          dimensions: {
            accuracy: 90,
            fluency: 80
          }
        }
      });
    });

    // Rate limiting simulation
    let requestCounts = new Map();
    
    this.app.use('/files', (req, res, next) => {
      const ip = req.ip || 'test-ip';
      const count = requestCounts.get(ip) || 0;
      
      if (count > 5) {
        res.status(429).json({
          error: { message: 'Rate limit exceeded' },
          retryAfter: 60
        });
        return;
      }
      
      requestCounts.set(ip, count + 1);
      
      // Reset counter after 1 minute
      setTimeout(() => {
        requestCounts.delete(ip);
      }, 60000);
      
      next();
    });

    // Error simulation endpoint
    this.app.get('/error/:type', (req, res) => {
      const { type } = req.params;
      
      switch (type) {
        case '500':
          res.status(500).json({ error: { message: 'Internal server error' } });
          break;
        case '503':
          res.status(503).json({ error: { message: 'Service unavailable' } });
          break;
        case 'timeout':
          // Don't respond to simulate timeout
          break;
        default:
          res.status(400).json({ error: { message: 'Unknown error type' } });
      }
    });
  }

  requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'];
    
    if (!authHeader && !apiKey) {
      return res.status(401).json({
        error: { message: 'Authentication required' }
      });
    }
    
    if (authHeader && !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: { message: 'Invalid authentication format' }
      });
    }
    
    next();
  }

  async start() {
    return new Promise((resolve) => {
      this.server = createServer(this.app);
      this.server.listen(0, () => {
        this.port = this.server.address().port;
        this.url = `http://localhost:${this.port}`;
        resolve();
      });
    });
  }

  async stop() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(resolve);
      });
    }
  }
}

export async function setupTestServer() {
  const server = new TestServer();
  await server.start();
  return server;
}

export async function teardownTestServer(server) {
  await server.stop();
}
```

### 4. End-to-End Tests

```javascript
// tests/e2e/workflow.test.js
import { TranslationQAWorkflow } from '../../src/workflow.js';
import { setupTestServer, teardownTestServer } from '../helpers/testServer.js';
import fs from 'fs';
import path from 'path';

describe('End-to-End Workflow Tests', () => {
  let testServer;
  let workflow;

  beforeAll(async () => {
    testServer = await setupTestServer();
  });

  afterAll(async () => {
    await teardownTestServer(testServer);
  });

  beforeEach(() => {
    workflow = new TranslationQAWorkflow('test-api-key', testServer.url);
  });

  it('should complete full translation QA workflow', async () => {
    // Create test XLIFF file
    const testXliff = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2">
  <file source-language="en" target-language="fr">
    <body>
      <trans-unit id="1">
        <source>Hello World</source>
        <target>Bonjour le monde</target>
      </trans-unit>
    </body>
  </file>
</xliff>`;

    const testFilePath = path.join(__dirname, 'temp', 'test.xliff');
    fs.writeFileSync(testFilePath, testXliff);

    try {
      const result = await workflow.processTranslationFile(testFilePath, {
        sourceLanguage: 'en',
        targetLanguage: 'fr',
        model: 'gpt-4',
        dimensions: ['accuracy', 'fluency'],
        downloadFormats: ['pdf', 'json'],
        outputDir: path.join(__dirname, 'temp', 'reports')
      });

      expect(result.fileId).toBeDefined();
      expect(result.assessmentId).toBeDefined();
      expect(result.assessment.status).toBe('completed');
      expect(result.reports.pdf).toBeDefined();
      expect(result.reports.json).toBeDefined();

      // Verify report files were created
      const pdfPath = path.join(__dirname, 'temp', 'reports', `assessment-${result.assessmentId}.pdf`);
      const jsonPath = path.join(__dirname, 'temp', 'reports', `assessment-${result.assessmentId}.json`);
      
      expect(fs.existsSync(pdfPath)).toBe(true);
      expect(fs.existsSync(jsonPath)).toBe(true);

    } finally {
      // Cleanup
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    }
  });

  it('should handle workflow errors gracefully', async () => {
    const invalidFilePath = path.join(__dirname, 'nonexistent.xliff');

    await expect(workflow.processTranslationFile(invalidFilePath))
      .rejects.toThrow('File does not exist');
  });

  it('should process multiple files in batch', async () => {
    const files = ['test1.xliff', 'test2.xliff', 'test3.xliff'];
    const tempDir = path.join(__dirname, 'temp');
    
    // Create test files
    files.forEach((filename, index) => {
      const content = `<?xml version="1.0"?><xliff><body><trans-unit id="${index}"><source>Test ${index}</source><target>Test ${index} FR</target></trans-unit></body></xliff>`;
      fs.writeFileSync(path.join(tempDir, filename), content);
    });

    const results = [];

    try {
      for (const filename of files) {
        const result = await workflow.processTranslationFile(
          path.join(tempDir, filename),
          {
            sourceLanguage: 'en',
            targetLanguage: 'fr'
          }
        );
        results.push(result);
      }

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.fileId).toBeDefined();
        expect(result.assessmentId).toBeDefined();
      });

    } finally {
      // Cleanup
      files.forEach(filename => {
        const filePath = path.join(tempDir, filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
    }
  });
});
```

---

## Python Testing

### 1. Pytest Integration Tests

```python
# tests/test_api_integration.py
import pytest
import asyncio
import aiohttp
import tempfile
import os
from pathlib import Path

from src.api_client import APIClient
from src.auth_manager import AuthenticationManager
from src.workflow import TranslationQAWorkflow

@pytest.fixture
async def api_client():
    """Create authenticated API client for testing"""
    auth_manager = AuthenticationManager('http://localhost:8000')
    await auth_manager.login('test@example.com', 'testpassword')
    
    client = APIClient('http://localhost:8000', auth_manager)
    yield client
    
    await auth_manager.logout()

@pytest.fixture
def test_xliff_content():
    """Sample XLIFF content for testing"""
    return '''<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2">
  <file source-language="en" target-language="fr">
    <body>
      <trans-unit id="1">
        <source>Hello World</source>
        <target>Bonjour le monde</target>
      </trans-unit>
    </body>
  </file>
</xliff>'''

@pytest.fixture
def temp_xliff_file(test_xliff_content):
    """Create temporary XLIFF file for testing"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.xliff', delete=False) as f:
        f.write(test_xliff_content)
        temp_path = f.name
    
    yield temp_path
    
    # Cleanup
    if os.path.exists(temp_path):
        os.unlink(temp_path)

class TestAPIIntegration:
    """Integration tests for API client"""
    
    @pytest.mark.asyncio
    async def test_file_upload_workflow(self, api_client, temp_xliff_file):
        """Test complete file upload workflow"""
        # Upload file
        with open(temp_xliff_file, 'rb') as f:
            upload_result = await api_client.upload_file(f, {
                'source_language': 'en',
                'target_language': 'fr',
                'assessment_model': 'gpt-4'
            })
        
        assert upload_result['file_id']
        assert upload_result['processing_status'] == 'uploaded'
        
        # Check file status
        file_info = await api_client.request(f"/files/{upload_result['file_id']}")
        assert file_info['id'] == upload_result['file_id']
        assert file_info['source_language'] == 'en'
        assert file_info['target_language'] == 'fr'
    
    @pytest.mark.asyncio
    async def test_authentication_error_handling(self):
        """Test authentication error handling"""
        auth_manager = AuthenticationManager('http://localhost:8000')
        
        # Test invalid login
        with pytest.raises(Exception, match="Invalid credentials"):
            await auth_manager.login('invalid@example.com', 'wrongpassword')
    
    @pytest.mark.asyncio
    async def test_token_refresh(self, api_client):
        """Test automatic token refresh"""
        # Simulate expired token
        api_client.auth.token_expiry = datetime.now() - timedelta(seconds=1)
        
        # Make request that should trigger refresh
        files = await api_client.request('/files')
        assert isinstance(files, list)
    
    @pytest.mark.asyncio
    async def test_rate_limiting_handling(self, api_client):
        """Test rate limiting response handling"""
        tasks = []
        
        # Make multiple concurrent requests
        for i in range(10):
            task = api_client.request('/files')
            tasks.append(task)
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Some should succeed, others might be rate limited
        successful = [r for r in results if not isinstance(r, Exception)]
        rate_limited = [r for r in results if isinstance(r, Exception) 
                       and 'rate limit' in str(r).lower()]
        
        assert len(successful) + len(rate_limited) == 10
    
    @pytest.mark.asyncio
    async def test_file_validation(self, api_client):
        """Test file validation errors"""
        # Test empty file
        with tempfile.NamedTemporaryFile() as empty_file:
            with pytest.raises(Exception, match="File cannot be empty"):
                await api_client.upload_file(empty_file, {})
        
        # Test invalid file format
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt') as invalid_file:
            invalid_file.write("This is not an XLIFF file")
            invalid_file.flush()
            
            with pytest.raises(Exception):
                await api_client.upload_file(invalid_file, {
                    'source_language': 'en',
                    'target_language': 'fr'
                })

class TestWorkflowIntegration:
    """End-to-end workflow tests"""
    
    @pytest.mark.asyncio
    async def test_complete_workflow(self, temp_xliff_file):
        """Test complete translation QA workflow"""
        workflow = TranslationQAWorkflow('test-api-key', 'http://localhost:8000')
        
        result = await workflow.process_translation_file(
            temp_xliff_file,
            source_language='en',
            target_language='fr',
            model='gpt-4',
            dimensions=['accuracy', 'fluency'],
            download_formats=['json']
        )
        
        assert result['file_id']
        assert result['assessment_id']
        assert result['assessment']['status'] == 'completed'
        assert 'json' in result['reports']
    
    @pytest.mark.asyncio
    async def test_batch_processing(self, test_xliff_content):
        """Test batch processing of multiple files"""
        workflow = TranslationQAWorkflow('test-api-key', 'http://localhost:8000')
        
        # Create multiple temporary files
        temp_files = []
        for i in range(3):
            with tempfile.NamedTemporaryFile(mode='w', suffix='.xliff', delete=False) as f:
                f.write(test_xliff_content.replace('id="1"', f'id="{i}"'))
                temp_files.append(f.name)
        
        try:
            results = []
            for file_path in temp_files:
                result = await workflow.process_translation_file(
                    file_path,
                    source_language='en',
                    target_language='fr'
                )
                results.append(result)
            
            assert len(results) == 3
            for result in results:
                assert result['file_id']
                assert result['assessment_id']
        
        finally:
            # Cleanup
            for file_path in temp_files:
                if os.path.exists(file_path):
                    os.unlink(file_path)

# Pytest configuration
@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

# Performance tests
@pytest.mark.performance
class TestPerformance:
    """Performance and load tests"""
    
    @pytest.mark.asyncio
    async def test_concurrent_uploads(self, test_xliff_content):
        """Test concurrent file uploads"""
        auth_manager = AuthenticationManager('http://localhost:8000')
        await auth_manager.login('test@example.com', 'testpassword')
        
        client = APIClient('http://localhost:8000', auth_manager)
        
        # Create multiple upload tasks
        upload_tasks = []
        for i in range(5):
            with tempfile.NamedTemporaryFile(mode='w', suffix='.xliff', delete=False) as f:
                f.write(test_xliff_content)
                f.flush()
                
                upload_task = client.upload_file(open(f.name, 'rb'), {
                    'source_language': 'en',
                    'target_language': 'fr'
                })
                upload_tasks.append((upload_task, f.name))
        
        try:
            # Execute uploads concurrently
            start_time = time.time()
            results = await asyncio.gather(*[task for task, _ in upload_tasks])
            end_time = time.time()
            
            # Verify all uploads succeeded
            assert len(results) == 5
            for result in results:
                assert result['file_id']
            
            # Performance assertion (adjust threshold as needed)
            total_time = end_time - start_time
            assert total_time < 30  # Should complete within 30 seconds
            
        finally:
            # Cleanup
            for _, file_path in upload_tasks:
                if os.path.exists(file_path):
                    os.unlink(file_path)
```

### 2. Test Configuration

```python
# conftest.py
import pytest
import asyncio
import os
from pathlib import Path

def pytest_configure(config):
    """Configure pytest with custom markers"""
    config.addinivalue_line(
        "markers", "performance: mark test as performance test"
    )
    config.addinivalue_line(
        "markers", "integration: mark test as integration test"
    )
    config.addinivalue_line(
        "markers", "unit: mark test as unit test"
    )

@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for the test session"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
def test_data_dir():
    """Get test data directory"""
    return Path(__file__).parent / "data"

@pytest.fixture
def mock_api_responses():
    """Mock API responses for testing"""
    return {
        'login_success': {
            'access_token': 'mock-access-token',
            'refresh_token': 'mock-refresh-token',
            'user': {'email': 'test@example.com', 'id': 'user-123'}
        },
        'file_upload_success': {
            'file_id': 'file-123',
            'processing_status': 'uploaded',
            'created_at': '2024-01-15T10:30:00Z'
        },
        'assessment_success': {
            'assessment_id': 'assessment-123',
            'status': 'completed',
            'results': {
                'overall_score': 85,
                'dimensions': {'accuracy': 90, 'fluency': 80}
            }
        }
    }

# pytest.ini
"""
[tool:pytest]
minversion = 6.0
addopts = 
    -ra
    --strict-markers
    --strict-config
    --cov=src
    --cov-report=html
    --cov-report=term-missing
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
markers =
    unit: Unit tests
    integration: Integration tests  
    performance: Performance tests
    slow: Slow running tests
filterwarnings =
    ignore::DeprecationWarning
    ignore::PendingDeprecationWarning
"""
```

---

## Test Automation and CI/CD

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: API Integration Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [16.x, 18.x, 20.x]
        python-version: [3.8, 3.9, '3.10', '3.11']
    
    services:
      postgres:
        image: postgres:13
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'

    - name: Setup Python ${{ matrix.python-version }}
      uses: actions/setup-python@v4
      with:
        python-version: ${{ matrix.python-version }}

    - name: Install Node.js dependencies
      run: npm ci

    - name: Install Python dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -r requirements-test.txt

    - name: Start test server
      run: npm run test:server &
      env:
        NODE_ENV: test
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db

    - name: Wait for test server
      run: npx wait-on http://localhost:3001/health

    - name: Run Node.js unit tests
      run: npm run test:unit

    - name: Run Node.js integration tests
      run: npm run test:integration
      env:
        TEST_API_URL: http://localhost:3001

    - name: Run Python tests
      run: pytest tests/ -v --cov=src
      env:
        TEST_API_URL: http://localhost:3001

    - name: Run end-to-end tests
      run: npm run test:e2e
      env:
        TEST_API_URL: http://localhost:3001

    - name: Upload coverage reports
      uses: codecov/codecov-action@v3
      with:
        files: ./coverage/lcov.info,./coverage.xml
        fail_ci_if_error: true
```

## Test Documentation and Maintenance

### Test Coverage Monitoring

```javascript
// scripts/coverage-check.js
const fs = require('fs');
const path = require('path');

const coverageThresholds = {
  statements: 80,
  branches: 75,
  functions: 80,
  lines: 80
};

function checkCoverage() {
  const coveragePath = path.join(__dirname, '../coverage/coverage-summary.json');
  
  if (!fs.existsSync(coveragePath)) {
    console.error('Coverage file not found. Run tests first.');
    process.exit(1);
  }

  const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
  const total = coverage.total;
  
  let failed = false;
  
  for (const [metric, threshold] of Object.entries(coverageThresholds)) {
    const actual = total[metric].pct;
    
    if (actual < threshold) {
      console.error(`❌ ${metric} coverage ${actual}% is below threshold ${threshold}%`);
      failed = true;
    } else {
      console.log(`✅ ${metric} coverage ${actual}% meets threshold ${threshold}%`);
    }
  }
  
  if (failed) {
    process.exit(1);
  }
  
  console.log('🎉 All coverage thresholds met!');
}

checkCoverage();
```

This comprehensive testing guide provides robust patterns for testing API integrations at all levels, ensuring reliability, maintainability, and confidence in production deployments. 