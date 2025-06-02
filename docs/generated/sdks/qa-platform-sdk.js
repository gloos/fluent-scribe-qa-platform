/**
 * QA Platform API SDK for JavaScript/Node.js
 * 
 * Production-ready SDK with comprehensive error handling, retry logic, and rate limiting awareness
 * Version: 1.1.0
 */

class QAPlatformAPI {
  constructor(options = {}) {
    this.apiKey = options.apiKey;
    this.jwtToken = options.jwtToken;
    this.baseUrl = options.baseUrl || 'http://localhost:3001/api/v1';
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.timeout = options.timeout || 30000;
    
    if (!this.apiKey && !this.jwtToken) {
      throw new Error('Either apiKey or jwtToken must be provided');
    }
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    // Add authentication header
    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    } else if (this.jwtToken) {
      headers['Authorization'] = `Bearer ${this.jwtToken}`;
    }

    const config = {
      headers,
      timeout: this.timeout,
      ...options
    };

    return this._requestWithRetry(url, config);
  }

  async _requestWithRetry(url, config, attempt = 1) {
    try {
      const response = await fetch(url, config);
      
      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('retry-after') || '60');
        if (attempt <= this.retryAttempts) {
          console.warn(`Rate limited. Retrying after ${retryAfter} seconds...`);
          await this._delay(retryAfter * 1000);
          return this._requestWithRetry(url, config, attempt + 1);
        }
      }

      // Handle server errors with retry
      if (response.status >= 500 && attempt <= this.retryAttempts) {
        console.warn(`Server error (${response.status}). Retrying attempt ${attempt}/${this.retryAttempts}...`);
        await this._delay(this.retryDelay * Math.pow(2, attempt - 1));
        return this._requestWithRetry(url, config, attempt + 1);
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        const apiError = new Error(`API Error (${response.status}): ${error.error?.message || 'Unknown error'}`);
        apiError.status = response.status;
        apiError.code = error.error?.code;
        apiError.details = error.error?.details;
        throw apiError;
      }

      return await response.json();
    } catch (error) {
      if (attempt <= this.retryAttempts && this._isRetryableError(error)) {
        console.warn(`Network error. Retrying attempt ${attempt}/${this.retryAttempts}...`);
        await this._delay(this.retryDelay * Math.pow(2, attempt - 1));
        return this._requestWithRetry(url, config, attempt + 1);
      }
      throw error;
    }
  }

  _isRetryableError(error) {
    return error.name === 'TypeError' || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT';
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Health and Status
  async healthCheck() {
    return this.request('/health');
  }

  async getVersion() {
    return this.request('/version');
  }

  // Authentication
  async login(email, password) {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    
    // Store JWT token if successful
    if (response.token) {
      this.jwtToken = response.token;
      this.apiKey = null; // Prefer JWT over API key
    }
    
    return response;
  }

  async logout() {
    const response = await this.request('/auth/logout', { method: 'POST' });
    this.jwtToken = null;
    return response;
  }

  // API Key Management
  async getApiKeys(options = {}) {
    const params = new URLSearchParams(options);
    return this.request(`/api-keys?${params}`);
  }

  async createApiKey(keyData) {
    return this.request('/api-keys', {
      method: 'POST',
      body: JSON.stringify(keyData)
    });
  }

  async getApiKey(keyId) {
    return this.request(`/api-keys/${keyId}`);
  }

  async updateApiKey(keyId, updates) {
    return this.request(`/api-keys/${keyId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  }

  async deleteApiKey(keyId) {
    return this.request(`/api-keys/${keyId}`, { method: 'DELETE' });
  }

  // File Management with enhanced options
  async getFiles(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value);
      }
    });
    return this.request(`/files?${params}`);
  }

  async uploadFile(file, options = {}) {
    const formData = new FormData();
    
    // Handle different input types
    if (typeof file === 'string') {
      // Assume file path in Node.js environment
      const fs = require('fs');
      const path = require('path');
      const buffer = fs.readFileSync(file);
      const filename = path.basename(file);
      formData.append('file', new Blob([buffer]), filename);
    } else if (file instanceof File || file instanceof Blob) {
      formData.append('file', file);
    } else {
      throw new Error('File must be a File object, Blob, or file path string');
    }
    
    // Add additional options
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, value);
      }
    });

    return this.request('/files', {
      method: 'POST',
      body: formData,
      headers: {} // Remove Content-Type to let browser/Node.js set it
    });
  }

  async getFile(fileId) {
    return this.request(`/files/${fileId}`);
  }

  async deleteFile(fileId) {
    return this.request(`/files/${fileId}`, { method: 'DELETE' });
  }

  // Quality Assessment endpoints
  async getAssessments(fileId, options = {}) {
    const params = new URLSearchParams(options);
    return this.request(`/files/${fileId}/assessments?${params}`);
  }

  async createAssessment(fileId, assessmentData) {
    return this.request(`/files/${fileId}/assessments`, {
      method: 'POST',
      body: JSON.stringify(assessmentData)
    });
  }

  async getAssessment(fileId, assessmentId) {
    return this.request(`/files/${fileId}/assessments/${assessmentId}`);
  }

  // Utility methods
  async paginate(endpoint, options = {}) {
    const results = [];
    let offset = 0;
    const limit = options.limit || 20;
    
    while (true) {
      const params = { ...options, limit, offset };
      const response = await this.request(`${endpoint}?${new URLSearchParams(params)}`);
      
      if (response.data && response.data.length > 0) {
        results.push(...response.data);
        offset += limit;
        
        // Check if we've reached the end
        if (response.data.length < limit || 
            (response.pagination && offset >= response.pagination.total)) {
          break;
        }
      } else {
        break;
      }
    }
    
    return results;
  }

  // Webhook helpers
  static validateWebhookSignature(payload, signature, secret) {
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }
}

// Error classes for better error handling
class QAPlatformError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.name = 'QAPlatformError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

class RateLimitError extends QAPlatformError {
  constructor(message, retryAfter) {
    super(message, 429, 'rate_limit_exceeded');
    this.retryAfter = retryAfter;
  }
}

// Export classes
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { QAPlatformAPI, QAPlatformError, RateLimitError };
} else {
  window.QAPlatformAPI = QAPlatformAPI;
  window.QAPlatformError = QAPlatformError;
  window.RateLimitError = RateLimitError;
}

/**
 * Example usage:
 * 
 * // With API Key
 * const api = new QAPlatformAPI({ apiKey: 'your-api-key' });
 * 
 * // With JWT Token
 * const api = new QAPlatformAPI({ jwtToken: 'your-jwt-token' });
 * 
 * // With custom configuration
 * const api = new QAPlatformAPI({
 *   apiKey: 'your-api-key',
 *   baseUrl: 'https://api.qa-platform.com/v1',
 *   retryAttempts: 5,
 *   retryDelay: 2000,
 *   timeout: 60000
 * });
 * 
 * // Upload file with options
 * const result = await api.uploadFile(fileInput.files[0], {
 *   source_language: 'en',
 *   target_language: 'fr',
 *   assessment_model: 'gpt-4',
 *   priority: 'high'
 * });
 * 
 * // Get all files with pagination
 * const allFiles = await api.paginate('/files', { status: 'completed' });
 * 
 * // Error handling
 * try {
 *   const files = await api.getFiles();
 * } catch (error) {
 *   if (error instanceof RateLimitError) {
 *     console.log(`Rate limited. Retry after ${error.retryAfter} seconds`);
 *   } else if (error instanceof QAPlatformError) {
 *     console.log(`API Error: ${error.message} (Code: ${error.code})`);
 *   } else {
 *     console.log(`Network Error: ${error.message}`);
 *   }
 * }
 */
