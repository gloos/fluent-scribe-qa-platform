# Comprehensive Error Handling Patterns

This guide provides robust error handling patterns for the Translation QA Platform API, covering common error scenarios and best practices for production integrations.

## Error Response Structure

The API uses a consistent error response format:

```json
{
  "error": {
    "code": "error_type",
    "message": "Human-readable error description",
    "details": ["Additional error information"],
    "field_errors": {
      "field_name": ["Field-specific error messages"]
    }
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "retryAfter": 60
}
```

## Common HTTP Status Codes

| Status | Meaning | Retry Strategy |
|--------|---------|---------------|
| 400 | Bad Request | No retry - fix the request |
| 401 | Unauthorized | Refresh token/check API key |
| 403 | Forbidden | Check permissions |
| 404 | Not Found | No retry - resource doesn't exist |
| 409 | Conflict | Conditional retry |
| 422 | Validation Error | No retry - fix validation issues |
| 429 | Rate Limited | Retry after delay |
| 500 | Server Error | Retry with backoff |
| 502/503 | Service Unavailable | Retry with backoff |

---

## JavaScript/Node.js Error Handling

### Comprehensive Error Handler Class

```javascript
class APIErrorHandler {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000;
    this.maxDelay = options.maxDelay || 30000;
    this.jitterFactor = options.jitterFactor || 0.1;
    this.logger = options.logger || console;
  }

  // Main error handling method
  async handleApiCall(apiCall, context = {}) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await apiCall();
        
        // Log successful retry
        if (attempt > 1) {
          this.logger.info(`API call succeeded on attempt ${attempt}`, context);
        }
        
        return result;
        
      } catch (error) {
        lastError = error;
        
        const shouldRetry = this.shouldRetry(error, attempt);
        
        this.logger.warn(`API call failed on attempt ${attempt}`, {
          ...context,
          error: error.message,
          status: error.status,
          willRetry: shouldRetry
        });
        
        if (!shouldRetry) {
          break;
        }
        
        const delay = this.calculateDelay(attempt, error);
        this.logger.info(`Retrying in ${delay}ms...`);
        await this.sleep(delay);
      }
    }
    
    // All retries exhausted
    throw this.enhanceError(lastError, context);
  }

  // Determine if error should trigger a retry
  shouldRetry(error, attempt) {
    if (attempt >= this.maxRetries) {
      return false;
    }

    // Don't retry client errors (4xx except rate limiting)
    if (error.status >= 400 && error.status < 500 && error.status !== 429) {
      return false;
    }

    // Retry server errors and rate limiting
    if (error.status >= 500 || error.status === 429) {
      return true;
    }

    // Retry network errors
    if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      return true;
    }

    return false;
  }

  // Calculate retry delay with jitter and exponential backoff
  calculateDelay(attempt, error) {
    let delay;

    // Use Retry-After header for rate limiting
    if (error.status === 429 && error.retryAfter) {
      delay = error.retryAfter * 1000;
    } else {
      // Exponential backoff
      delay = Math.min(this.baseDelay * Math.pow(2, attempt - 1), this.maxDelay);
    }

    // Add jitter to prevent thundering herd
    const jitter = delay * this.jitterFactor * Math.random();
    return delay + jitter;
  }

  // Enhance error with additional context
  enhanceError(error, context) {
    const enhancedError = new Error(error.message);
    enhancedError.originalError = error;
    enhancedError.context = context;
    enhancedError.status = error.status;
    enhancedError.code = error.code;
    enhancedError.timestamp = new Date().toISOString();
    
    return enhancedError;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Specific error types
class APIError extends Error {
  constructor(message, status, code, details = null) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

class ValidationError extends APIError {
  constructor(message, fieldErrors = {}) {
    super(message, 422, 'validation_error', fieldErrors);
    this.name = 'ValidationError';
    this.fieldErrors = fieldErrors;
  }
}

class RateLimitError extends APIError {
  constructor(message, retryAfter = 60) {
    super(message, 429, 'rate_limit_exceeded');
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

class AuthenticationError extends APIError {
  constructor(message) {
    super(message, 401, 'authentication_failed');
    this.name = 'AuthenticationError';
  }
}
```

### Enhanced API Client with Error Handling

```javascript
class RobustAPIClient {
  constructor(apiKey, baseUrl, options = {}) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.errorHandler = new APIErrorHandler(options);
  }

  async request(endpoint, options = {}) {
    const context = {
      endpoint,
      method: options.method || 'GET',
      timestamp: new Date().toISOString()
    };

    return this.errorHandler.handleApiCall(async () => {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });

      return this.processResponse(response);
    }, context);
  }

  async processResponse(response) {
    const contentType = response.headers.get('content-type');
    
    if (!response.ok) {
      let errorData;
      
      try {
        if (contentType && contentType.includes('application/json')) {
          errorData = await response.json();
        } else {
          errorData = { error: { message: await response.text() } };
        }
      } catch (parseError) {
        errorData = { error: { message: 'Failed to parse error response' } };
      }

      const error = errorData.error || {};
      
      // Create specific error types
      switch (response.status) {
        case 401:
          throw new AuthenticationError(error.message || 'Authentication failed');
        case 422:
          throw new ValidationError(error.message || 'Validation failed', error.field_errors);
        case 429:
          const retryAfter = parseInt(response.headers.get('retry-after')) || 60;
          throw new RateLimitError(error.message || 'Rate limit exceeded', retryAfter);
        default:
          const apiError = new APIError(
            error.message || 'API request failed',
            response.status,
            error.code || 'unknown_error',
            error.details
          );
          apiError.retryAfter = parseInt(response.headers.get('retry-after'));
          throw apiError;
      }
    }

    // Handle successful responses
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    } else {
      return await response.blob();
    }
  }

  // File upload with enhanced error handling
  async uploadFile(filePath, options = {}) {
    const context = {
      operation: 'file_upload',
      filePath,
      fileSize: fs.statSync(filePath).size
    };

    return this.errorHandler.handleApiCall(async () => {
      // Validate file before upload
      if (!fs.existsSync(filePath)) {
        throw new ValidationError('File does not exist', { file: ['File not found'] });
      }

      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        throw new ValidationError('File is empty', { file: ['File cannot be empty'] });
      }

      if (stats.size > 100 * 1024 * 1024) { // 100MB limit
        throw new ValidationError('File too large', { file: ['File size exceeds 100MB limit'] });
      }

      const formData = new FormData();
      formData.append('file', fs.createReadStream(filePath));
      
      Object.entries(options).forEach(([key, value]) => {
        formData.append(key, value);
      });

      const response = await fetch(`${this.baseUrl}/files`, {
        method: 'POST',
        headers: {
          'X-API-Key': this.apiKey
        },
        body: formData
      });

      return this.processResponse(response);
    }, context);
  }
}
```

### Usage Examples with Error Handling

```javascript
// Example 1: Basic usage with error handling
async function basicUsageWithErrorHandling() {
  const client = new RobustAPIClient('your-api-key', 'https://api.qa-platform.com/v1', {
    maxRetries: 3,
    baseDelay: 1000,
    logger: console
  });

  try {
    const files = await client.request('/files');
    console.log('Retrieved files:', files.length);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      console.error('Authentication failed. Please check your API key.');
      // Trigger API key refresh
    } else if (error instanceof RateLimitError) {
      console.error(`Rate limited. Retry after ${error.retryAfter} seconds.`);
      // Implement backoff strategy
    } else if (error instanceof ValidationError) {
      console.error('Validation failed:', error.fieldErrors);
      // Handle specific field errors
    } else {
      console.error('Unexpected error:', error.message);
      // General error handling
    }
  }
}

// Example 2: File upload with comprehensive error handling
async function uploadWithErrorHandling(filePath) {
  const client = new RobustAPIClient('your-api-key', 'https://api.qa-platform.com/v1');

  try {
    const result = await client.uploadFile(filePath, {
      source_language: 'en',
      target_language: 'fr',
      assessment_model: 'gpt-4'
    });
    
    console.log('Upload successful:', result.file_id);
    return result;
    
  } catch (error) {
    console.error('Upload failed:', error.message);
    
    if (error instanceof ValidationError) {
      if (error.fieldErrors.file) {
        console.error('File validation errors:', error.fieldErrors.file);
      }
      if (error.fieldErrors.source_language) {
        console.error('Language validation errors:', error.fieldErrors.source_language);
      }
    } else if (error.status === 413) {
      console.error('File too large for server limits');
    } else if (error.code === 'ENOENT') {
      console.error('File not found on local filesystem');
    }
    
    throw error; // Re-throw for upstream handling
  }
}

// Example 3: Batch operations with individual error handling
async function batchProcessingWithErrorHandling(files) {
  const client = new RobustAPIClient('your-api-key', 'https://api.qa-platform.com/v1');
  const results = [];
  
  for (const file of files) {
    try {
      const result = await uploadWithErrorHandling(file);
      results.push({ file, success: true, result });
    } catch (error) {
      results.push({ 
        file, 
        success: false, 
        error: {
          message: error.message,
          code: error.code,
          status: error.status
        }
      });
      
      // Continue with next file instead of stopping
    }
  }
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`Batch processing complete: ${successful} successful, ${failed} failed`);
  return results;
}

// Example 4: Token refresh for JWT authentication
class AuthenticatedAPIClient extends RobustAPIClient {
  constructor(initialToken, refreshToken, baseUrl) {
    super(null, baseUrl);
    this.accessToken = initialToken;
    this.refreshToken = refreshToken;
  }

  async request(endpoint, options = {}) {
    // Override to use Bearer token
    options.headers = {
      'Authorization': `Bearer ${this.accessToken}`,
      ...options.headers
    };

    try {
      return await super.request(endpoint, options);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        // Try to refresh token
        await this.refreshAccessToken();
        
        // Retry with new token
        options.headers['Authorization'] = `Bearer ${this.accessToken}`;
        return await super.request(endpoint, options);
      }
      throw error;
    }
  }

  async refreshAccessToken() {
    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refresh_token: this.refreshToken })
      });

      if (!response.ok) {
        throw new AuthenticationError('Token refresh failed');
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      
      if (data.refresh_token) {
        this.refreshToken = data.refresh_token;
      }
      
    } catch (error) {
      throw new AuthenticationError('Failed to refresh authentication token');
    }
  }
}
```

---

## Python Error Handling

### Python Error Classes and Handler

```python
import asyncio
import aiohttp
import logging
import random
import time
from typing import Optional, Dict, Any, Callable
from dataclasses import dataclass

@dataclass
class RetryConfig:
    max_retries: int = 3
    base_delay: float = 1.0
    max_delay: float = 30.0
    jitter_factor: float = 0.1
    exponential_base: float = 2.0

class APIError(Exception):
    def __init__(self, message: str, status: int, code: str = None, details: Any = None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.details = details
        self.timestamp = time.time()

class ValidationError(APIError):
    def __init__(self, message: str, field_errors: Dict[str, list] = None):
        super().__init__(message, 422, 'validation_error', field_errors)
        self.field_errors = field_errors or {}

class RateLimitError(APIError):
    def __init__(self, message: str, retry_after: int = 60):
        super().__init__(message, 429, 'rate_limit_exceeded')
        self.retry_after = retry_after

class AuthenticationError(APIError):
    def __init__(self, message: str):
        super().__init__(message, 401, 'authentication_failed')

class APIErrorHandler:
    def __init__(self, config: RetryConfig = None, logger: logging.Logger = None):
        self.config = config or RetryConfig()
        self.logger = logger or logging.getLogger(__name__)

    async def handle_api_call(self, api_call: Callable, context: Dict = None) -> Any:
        """Handle API call with retry logic and error handling"""
        context = context or {}
        last_error = None

        for attempt in range(1, self.config.max_retries + 1):
            try:
                result = await api_call()
                
                if attempt > 1:
                    self.logger.info(f"API call succeeded on attempt {attempt}", extra=context)
                
                return result

            except Exception as error:
                last_error = error
                
                should_retry = self._should_retry(error, attempt)
                
                self.logger.warning(
                    f"API call failed on attempt {attempt}",
                    extra={
                        **context,
                        'error': str(error),
                        'error_type': type(error).__name__,
                        'will_retry': should_retry
                    }
                )

                if not should_retry:
                    break

                delay = self._calculate_delay(attempt, error)
                self.logger.info(f"Retrying in {delay:.2f}s...")
                await asyncio.sleep(delay)

        # All retries exhausted
        raise self._enhance_error(last_error, context)

    def _should_retry(self, error: Exception, attempt: int) -> bool:
        """Determine if error should trigger a retry"""
        if attempt >= self.config.max_retries:
            return False

        if isinstance(error, APIError):
            # Don't retry client errors except rate limiting
            if 400 <= error.status < 500 and error.status != 429:
                return False
            # Retry server errors and rate limiting
            return error.status >= 500 or error.status == 429

        if isinstance(error, (aiohttp.ClientConnectorError, asyncio.TimeoutError)):
            return True

        return False

    def _calculate_delay(self, attempt: int, error: Exception) -> float:
        """Calculate retry delay with jitter and exponential backoff"""
        if isinstance(error, RateLimitError):
            delay = error.retry_after
        else:
            delay = min(
                self.config.base_delay * (self.config.exponential_base ** (attempt - 1)),
                self.config.max_delay
            )

        # Add jitter
        jitter = delay * self.config.jitter_factor * random.random()
        return delay + jitter

    def _enhance_error(self, error: Exception, context: Dict) -> Exception:
        """Enhance error with additional context"""
        if isinstance(error, APIError):
            error.context = context
            return error
        
        # Wrap other exceptions
        enhanced = APIError(str(error), 0, 'unknown_error', str(error))
        enhanced.context = context
        enhanced.original_error = error
        return enhanced

class RobustAPIClient:
    def __init__(self, api_key: str, base_url: str, retry_config: RetryConfig = None):
        self.api_key = api_key
        self.base_url = base_url
        self.error_handler = APIErrorHandler(retry_config)
        self.session = None

    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def request(self, endpoint: str, **kwargs) -> Any:
        """Make API request with error handling"""
        context = {
            'endpoint': endpoint,
            'method': kwargs.get('method', 'GET'),
            'timestamp': time.time()
        }

        async def api_call():
            url = f"{self.base_url}{endpoint}"
            headers = kwargs.get('headers', {})
            headers['X-API-Key'] = self.api_key
            kwargs['headers'] = headers

            async with self.session.request(url=url, **kwargs) as response:
                return await self._process_response(response)

        return await self.error_handler.handle_api_call(api_call, context)

    async def _process_response(self, response: aiohttp.ClientResponse) -> Any:
        """Process response and handle errors"""
        if not response.ok:
            try:
                if response.content_type == 'application/json':
                    error_data = await response.json()
                else:
                    error_data = {'error': {'message': await response.text()}}
            except Exception:
                error_data = {'error': {'message': 'Failed to parse error response'}}

            error = error_data.get('error', {})
            message = error.get('message', 'API request failed')

            if response.status == 401:
                raise AuthenticationError(message)
            elif response.status == 422:
                raise ValidationError(message, error.get('field_errors', {}))
            elif response.status == 429:
                retry_after = int(response.headers.get('retry-after', 60))
                raise RateLimitError(message, retry_after)
            else:
                raise APIError(message, response.status, error.get('code', 'unknown_error'))

        # Handle successful response
        if response.content_type == 'application/json':
            return await response.json()
        else:
            return await response.read()

# Usage examples
async def example_usage():
    retry_config = RetryConfig(max_retries=5, base_delay=2.0)
    
    async with RobustAPIClient('your-api-key', 'https://api.qa-platform.com/v1', retry_config) as client:
        try:
            files = await client.request('/files')
            print(f"Retrieved {len(files)} files")
            
        except AuthenticationError:
            print("Authentication failed - check API key")
        except ValidationError as e:
            print(f"Validation error: {e.field_errors}")
        except RateLimitError as e:
            print(f"Rate limited - retry after {e.retry_after}s")
        except APIError as e:
            print(f"API error {e.status}: {e.message}")

if __name__ == "__main__":
    asyncio.run(example_usage())
```

---

## Best Practices Summary

### 1. **Retry Strategies**
- Use exponential backoff with jitter
- Respect `Retry-After` headers for rate limiting
- Don't retry client errors (4xx except 429)
- Limit maximum retry attempts

### 2. **Error Classification**
- Create specific error classes for different error types
- Include context information in errors
- Log errors with appropriate detail levels

### 3. **Rate Limiting**
- Monitor rate limit headers
- Implement backoff strategies
- Consider implementing local rate limiting

### 4. **Timeout Handling**
- Set appropriate timeout values
- Handle partial failures gracefully
- Implement circuit breaker patterns for repeated failures

### 5. **Monitoring and Logging**
- Log all error occurrences with context
- Monitor error rates and patterns
- Set up alerts for critical errors

### 6. **Graceful Degradation**
- Handle partial failures in batch operations
- Provide fallback mechanisms where possible
- Maintain service availability during error conditions

This comprehensive error handling approach ensures robust API integrations that can handle various failure scenarios while providing clear feedback and maintaining system stability. 