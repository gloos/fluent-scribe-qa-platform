# Authentication Flow Examples

This guide provides comprehensive examples for all authentication methods supported by the Translation QA Platform API, including JWT token management, API key usage, and token refresh patterns.

## Authentication Methods Overview

The API supports two primary authentication methods:

1. **JWT Bearer Token** - For user-authenticated applications with session management
2. **API Key** - For server-to-server integrations and service accounts

---

## JWT Authentication Flows

### 1. Login and Token Management

#### JavaScript/Node.js Implementation

```javascript
class AuthenticationManager {
  constructor(baseUrl, options = {}) {
    this.baseUrl = baseUrl;
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    this.onTokenRefresh = options.onTokenRefresh || (() => {});
    this.onAuthFailure = options.onAuthFailure || (() => {});
  }

  // Login with email and password
  async login(email, password) {
    try {
      const response = await fetch(`${this.baseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          password
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Login failed');
      }

      const data = await response.json();
      
      this.setTokens(data.access_token, data.refresh_token);
      
      return {
        user: data.user,
        accessToken: this.accessToken,
        expiresAt: this.tokenExpiry
      };
      
    } catch (error) {
      console.error('Login failed:', error.message);
      throw error;
    }
  }

  // Set tokens and calculate expiry
  setTokens(accessToken, refreshToken) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    
    // Decode JWT to get expiry (simplified - use a JWT library in production)
    if (accessToken) {
      try {
        const payload = JSON.parse(atob(accessToken.split('.')[1]));
        this.tokenExpiry = new Date(payload.exp * 1000);
      } catch (error) {
        console.warn('Failed to decode token expiry:', error);
        // Default to 1 hour from now
        this.tokenExpiry = new Date(Date.now() + 3600000);
      }
    }
  }

  // Check if token is expired or will expire soon (within 5 minutes)
  isTokenExpired(bufferMinutes = 5) {
    if (!this.tokenExpiry) return true;
    
    const now = new Date();
    const bufferTime = new Date(now.getTime() + (bufferMinutes * 60000));
    
    return this.tokenExpiry <= bufferTime;
  }

  // Refresh access token
  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          refresh_token: this.refreshToken
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Refresh token is invalid or expired
        if (response.status === 401) {
          this.clearTokens();
          this.onAuthFailure('Refresh token expired');
          throw new Error('Authentication session expired');
        }
        
        throw new Error(errorData.error?.message || 'Token refresh failed');
      }

      const data = await response.json();
      
      this.setTokens(data.access_token, data.refresh_token || this.refreshToken);
      this.onTokenRefresh(this.accessToken);
      
      return this.accessToken;
      
    } catch (error) {
      console.error('Token refresh failed:', error.message);
      throw error;
    }
  }

  // Get valid access token (refresh if needed)
  async getValidToken() {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    if (this.isTokenExpired()) {
      await this.refreshAccessToken();
    }

    return this.accessToken;
  }

  // Logout
  async logout() {
    try {
      if (this.accessToken) {
        await fetch(`${this.baseUrl}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            refresh_token: this.refreshToken
          })
        });
      }
    } catch (error) {
      console.warn('Logout request failed:', error.message);
    } finally {
      this.clearTokens();
    }
  }

  // Clear stored tokens
  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
  }

  // Get authorization header
  getAuthHeader() {
    if (!this.accessToken) {
      throw new Error('No access token available');
    }
    return `Bearer ${this.accessToken}`;
  }
}

// Usage example
async function authenticationExample() {
  const auth = new AuthenticationManager('https://api.qa-platform.com/v1', {
    onTokenRefresh: (newToken) => {
      console.log('Token refreshed');
      // Save to secure storage
      localStorage.setItem('access_token', newToken);
    },
    onAuthFailure: (reason) => {
      console.log('Authentication failed:', reason);
      // Redirect to login page
      window.location.href = '/login';
    }
  });

  try {
    // Login
    const loginResult = await auth.login('user@example.com', 'password');
    console.log('Logged in:', loginResult.user.email);

    // Make authenticated request
    const token = await auth.getValidToken();
    const response = await fetch('https://api.qa-platform.com/v1/files', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const files = await response.json();
    console.log('Files:', files);

  } catch (error) {
    console.error('Authentication error:', error.message);
  }
}
```

### 2. Authenticated API Client

```javascript
class AuthenticatedAPIClient {
  constructor(baseUrl, authManager) {
    this.baseUrl = baseUrl;
    this.auth = authManager;
  }

  async request(endpoint, options = {}) {
    try {
      // Get valid token (will refresh if needed)
      const token = await this.auth.getValidToken();
      
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      // Handle token expiry during request
      if (response.status === 401) {
        try {
          // Try to refresh token
          await this.auth.refreshAccessToken();
          const newToken = await this.auth.getValidToken();
          
          // Retry request with new token
          const retryResponse = await fetch(`${this.baseUrl}${endpoint}`, {
            ...options,
            headers: {
              'Authorization': `Bearer ${newToken}`,
              'Content-Type': 'application/json',
              ...options.headers
            }
          });

          if (!retryResponse.ok) {
            throw new Error(`API request failed: ${retryResponse.status}`);
          }

          return await retryResponse.json();
          
        } catch (refreshError) {
          this.auth.onAuthFailure('Token refresh failed during request');
          throw new Error('Authentication session expired');
        }
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `API request failed: ${response.status}`);
      }

      return await response.json();

    } catch (error) {
      console.error('API request failed:', error.message);
      throw error;
    }
  }

  // File upload with authentication
  async uploadFile(file, options = {}) {
    const token = await this.auth.getValidToken();
    
    const formData = new FormData();
    formData.append('file', file);
    
    Object.entries(options).forEach(([key, value]) => {
      formData.append(key, value);
    });

    const response = await fetch(`${this.baseUrl}/files`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Upload failed');
    }

    return await response.json();
  }
}
```

### 3. Python JWT Authentication

```python
import asyncio
import aiohttp
import json
import time
from datetime import datetime, timedelta
from typing import Optional, Dict, Callable
import base64

class AuthenticationManager:
    def __init__(self, base_url: str, on_token_refresh: Callable = None, on_auth_failure: Callable = None):
        self.base_url = base_url
        self.access_token: Optional[str] = None
        self.refresh_token: Optional[str] = None
        self.token_expiry: Optional[datetime] = None
        self.on_token_refresh = on_token_refresh
        self.on_auth_failure = on_auth_failure
        self.session: Optional[aiohttp.ClientSession] = None

    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def login(self, email: str, password: str) -> Dict:
        """Login with email and password"""
        async with self.session.post(
            f"{self.base_url}/auth/login",
            json={"email": email, "password": password}
        ) as response:
            if not response.ok:
                error_data = await response.json()
                raise Exception(error_data.get('error', {}).get('message', 'Login failed'))

            data = await response.json()
            self._set_tokens(data['access_token'], data['refresh_token'])
            
            return {
                'user': data['user'],
                'access_token': self.access_token,
                'expires_at': self.token_expiry
            }

    def _set_tokens(self, access_token: str, refresh_token: str):
        """Set tokens and calculate expiry"""
        self.access_token = access_token
        self.refresh_token = refresh_token
        
        # Decode JWT to get expiry
        try:
            # Split token and decode payload (second part)
            payload_part = access_token.split('.')[1]
            # Add padding if needed
            padding = len(payload_part) % 4
            if padding:
                payload_part += '=' * (4 - padding)
            
            payload = json.loads(base64.urlsafe_b64decode(payload_part))
            self.token_expiry = datetime.fromtimestamp(payload['exp'])
        except Exception as e:
            print(f"Warning: Failed to decode token expiry: {e}")
            # Default to 1 hour from now
            self.token_expiry = datetime.now() + timedelta(hours=1)

    def is_token_expired(self, buffer_minutes: int = 5) -> bool:
        """Check if token is expired or will expire soon"""
        if not self.token_expiry:
            return True
        
        buffer_time = datetime.now() + timedelta(minutes=buffer_minutes)
        return self.token_expiry <= buffer_time

    async def refresh_access_token(self) -> str:
        """Refresh access token"""
        if not self.refresh_token:
            raise Exception("No refresh token available")

        async with self.session.post(
            f"{self.base_url}/auth/refresh",
            json={"refresh_token": self.refresh_token}
        ) as response:
            if not response.ok:
                if response.status == 401:
                    self._clear_tokens()
                    if self.on_auth_failure:
                        self.on_auth_failure("Refresh token expired")
                    raise Exception("Authentication session expired")

                error_data = await response.json()
                raise Exception(error_data.get('error', {}).get('message', 'Token refresh failed'))

            data = await response.json()
            self._set_tokens(data['access_token'], data.get('refresh_token', self.refresh_token))
            
            if self.on_token_refresh:
                self.on_token_refresh(self.access_token)
            
            return self.access_token

    async def get_valid_token(self) -> str:
        """Get valid access token (refresh if needed)"""
        if not self.access_token:
            raise Exception("Not authenticated")

        if self.is_token_expired():
            await self.refresh_access_token()

        return self.access_token

    async def logout(self):
        """Logout and clear tokens"""
        try:
            if self.access_token:
                async with self.session.post(
                    f"{self.base_url}/auth/logout",
                    headers={"Authorization": f"Bearer {self.access_token}"},
                    json={"refresh_token": self.refresh_token}
                ) as response:
                    pass  # Ignore response for logout
        except Exception as e:
            print(f"Warning: Logout request failed: {e}")
        finally:
            self._clear_tokens()

    def _clear_tokens(self):
        """Clear stored tokens"""
        self.access_token = None
        self.refresh_token = None
        self.token_expiry = None

class AuthenticatedAPIClient:
    def __init__(self, base_url: str, auth_manager: AuthenticationManager):
        self.base_url = base_url
        self.auth = auth_manager

    async def request(self, endpoint: str, **kwargs) -> Dict:
        """Make authenticated request"""
        # Get valid token
        token = await self.auth.get_valid_token()
        
        headers = kwargs.get('headers', {})
        headers['Authorization'] = f"Bearer {token}"
        kwargs['headers'] = headers

        async with self.auth.session.request(
            url=f"{self.base_url}{endpoint}",
            **kwargs
        ) as response:
            # Handle token expiry during request
            if response.status == 401:
                try:
                    await self.auth.refresh_access_token()
                    new_token = await self.auth.get_valid_token()
                    headers['Authorization'] = f"Bearer {new_token}"
                    
                    # Retry request
                    async with self.auth.session.request(
                        url=f"{self.base_url}{endpoint}",
                        **kwargs
                    ) as retry_response:
                        if not retry_response.ok:
                            error_data = await retry_response.json()
                            raise Exception(error_data.get('error', {}).get('message', 'Request failed'))
                        return await retry_response.json()
                        
                except Exception:
                    if self.auth.on_auth_failure:
                        self.auth.on_auth_failure("Token refresh failed during request")
                    raise Exception("Authentication session expired")

            if not response.ok:
                error_data = await response.json()
                raise Exception(error_data.get('error', {}).get('message', 'Request failed'))

            return await response.json()

# Usage example
async def python_auth_example():
    async with AuthenticationManager(
        'https://api.qa-platform.com/v1',
        on_token_refresh=lambda token: print("Token refreshed"),
        on_auth_failure=lambda reason: print(f"Auth failure: {reason}")
    ) as auth:
        
        # Login
        login_result = await auth.login('user@example.com', 'password')
        print(f"Logged in: {login_result['user']['email']}")

        # Create authenticated client
        client = AuthenticatedAPIClient('https://api.qa-platform.com/v1', auth)
        
        # Make authenticated request
        files = await client.request('/files')
        print(f"Retrieved {len(files)} files")

if __name__ == "__main__":
    asyncio.run(python_auth_example())
```

---

## API Key Authentication

### 1. API Key Management

#### JavaScript Implementation

```javascript
class APIKeyManager {
  constructor(baseUrl, userToken) {
    this.baseUrl = baseUrl;
    this.userToken = userToken; // JWT token for managing API keys
    this.apiKeys = new Map(); // Cache API keys
  }

  // Create new API key
  async createAPIKey(keyConfig) {
    try {
      const response = await fetch(`${this.baseUrl}/api-keys`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.userToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: keyConfig.name,
          description: keyConfig.description || '',
          permissions: keyConfig.permissions || ['read:files', 'write:assessments'],
          rate_limit_per_minute: keyConfig.rateLimitPerMinute || 100,
          rate_limit_per_hour: keyConfig.rateLimitPerHour || 5000,
          rate_limit_per_day: keyConfig.rateLimitPerDay || 100000,
          expires_at: keyConfig.expiresAt || null
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to create API key');
      }

      const result = await response.json();
      
      // Store the key info (but not the actual key value)
      this.apiKeys.set(result.key_info.id, result.key_info);
      
      console.warn('IMPORTANT: Save this API key securely - it won\'t be shown again!');
      console.log('API Key:', result.api_key);
      
      return result;
      
    } catch (error) {
      console.error('Failed to create API key:', error.message);
      throw error;
    }
  }

  // List API keys
  async listAPIKeys() {
    try {
      const response = await fetch(`${this.baseUrl}/api-keys`, {
        headers: {
          'Authorization': `Bearer ${this.userToken}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to list API keys');
      }

      const result = await response.json();
      
      // Update cache
      result.api_keys.forEach(key => {
        this.apiKeys.set(key.id, key);
      });
      
      return result.api_keys;
      
    } catch (error) {
      console.error('Failed to list API keys:', error.message);
      throw error;
    }
  }

  // Revoke API key
  async revokeAPIKey(keyId) {
    try {
      const response = await fetch(`${this.baseUrl}/api-keys/${keyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.userToken}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to revoke API key');
      }

      // Remove from cache
      this.apiKeys.delete(keyId);
      
      return true;
      
    } catch (error) {
      console.error('Failed to revoke API key:', error.message);
      throw error;
    }
  }

  // Update API key
  async updateAPIKey(keyId, updates) {
    try {
      const response = await fetch(`${this.baseUrl}/api-keys/${keyId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.userToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to update API key');
      }

      const result = await response.json();
      
      // Update cache
      this.apiKeys.set(keyId, result.api_key);
      
      return result.api_key;
      
    } catch (error) {
      console.error('Failed to update API key:', error.message);
      throw error;
    }
  }
}

// API Key client for making requests
class APIKeyClient {
  constructor(apiKey, baseUrl) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async request(endpoint, options = {}) {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        if (response.status === 401) {
          throw new Error('Invalid API key');
        } else if (response.status === 403) {
          throw new Error('API key lacks required permissions');
        } else if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after') || 60;
          throw new Error(`Rate limit exceeded. Retry after ${retryAfter} seconds`);
        }
        
        throw new Error(errorData.error?.message || 'API request failed');
      }

      return await response.json();
      
    } catch (error) {
      console.error('API request failed:', error.message);
      throw error;
    }
  }

  // File upload with API key
  async uploadFile(file, options = {}) {
    const formData = new FormData();
    formData.append('file', file);
    
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

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Upload failed');
    }

    return await response.json();
  }
}

// Usage examples
async function apiKeyExamples() {
  // Manage API keys (requires user authentication)
  const keyManager = new APIKeyManager('https://api.qa-platform.com/v1', 'user-jwt-token');
  
  // Create API key
  const newKey = await keyManager.createAPIKey({
    name: 'Production Integration',
    description: 'API key for production file processing',
    permissions: ['read:files', 'write:assessments', 'read:reports'],
    rateLimitPerMinute: 200,
    rateLimitPerHour: 10000,
    expiresAt: '2025-12-31T23:59:59Z'
  });
  
  // Use API key for requests
  const apiClient = new APIKeyClient(newKey.api_key, 'https://api.qa-platform.com/v1');
  
  // Make requests with API key
  const files = await apiClient.request('/files');
  console.log('Files:', files);
  
  // Upload file with API key
  const fileInput = document.getElementById('file-input');
  const file = fileInput.files[0];
  
  const uploadResult = await apiClient.uploadFile(file, {
    source_language: 'en',
    target_language: 'fr',
    assessment_model: 'gpt-4'
  });
  
  console.log('Upload result:', uploadResult);
}
```

### 2. API Key Rotation and Security

```javascript
class SecureAPIKeyManager {
  constructor(baseUrl, userAuth) {
    this.baseUrl = baseUrl;
    this.userAuth = userAuth;
    this.activeKeys = new Map();
    this.keyRotationInterval = 30 * 24 * 60 * 60 * 1000; // 30 days
  }

  // Create API key with automatic rotation setup
  async createAPIKeyWithRotation(keyConfig) {
    const apiKey = await this.createAPIKey({
      ...keyConfig,
      // Set expiry to rotation interval + buffer
      expiresAt: new Date(Date.now() + this.keyRotationInterval + (7 * 24 * 60 * 60 * 1000))
    });

    // Schedule rotation
    this.scheduleKeyRotation(apiKey.key_info.id, keyConfig);
    
    return apiKey;
  }

  // Schedule automatic key rotation
  scheduleKeyRotation(keyId, originalConfig) {
    setTimeout(async () => {
      try {
        await this.rotateAPIKey(keyId, originalConfig);
      } catch (error) {
        console.error('Automatic key rotation failed:', error.message);
        // Notify administrators
        this.notifyKeyRotationFailure(keyId, error);
      }
    }, this.keyRotationInterval);
  }

  // Rotate API key
  async rotateAPIKey(oldKeyId, keyConfig) {
    try {
      // Create new key
      const newKey = await this.createAPIKey({
        ...keyConfig,
        name: `${keyConfig.name} - Rotated ${new Date().toISOString()}`
      });

      // Notify about new key (implement secure notification)
      await this.notifyKeyRotation(oldKeyId, newKey);

      // Wait for transition period (allow time for systems to update)
      const transitionPeriod = 24 * 60 * 60 * 1000; // 24 hours
      setTimeout(async () => {
        try {
          // Revoke old key after transition period
          await this.revokeAPIKey(oldKeyId);
          console.log(`Old API key ${oldKeyId} revoked after rotation`);
        } catch (error) {
          console.error('Failed to revoke old key:', error.message);
        }
      }, transitionPeriod);

      // Schedule rotation for new key
      this.scheduleKeyRotation(newKey.key_info.id, keyConfig);

      return newKey;
      
    } catch (error) {
      console.error('Key rotation failed:', error.message);
      throw error;
    }
  }

  // Validate API key permissions
  async validateKeyPermissions(keyId, requiredPermissions) {
    const keys = await this.listAPIKeys();
    const key = keys.find(k => k.id === keyId);
    
    if (!key) {
      throw new Error('API key not found');
    }

    const hasAllPermissions = requiredPermissions.every(permission => 
      key.permissions.includes(permission)
    );

    if (!hasAllPermissions) {
      const missing = requiredPermissions.filter(permission => 
        !key.permissions.includes(permission)
      );
      throw new Error(`API key missing permissions: ${missing.join(', ')}`);
    }

    return true;
  }

  // Monitor API key usage
  async monitorKeyUsage(keyId) {
    const keys = await this.listAPIKeys();
    const key = keys.find(k => k.id === keyId);
    
    if (!key) {
      throw new Error('API key not found');
    }

    // Check usage patterns
    const usageWarnings = [];
    
    if (key.usage_count > key.rate_limit_per_day * 0.8) {
      usageWarnings.push('Daily rate limit nearly exceeded');
    }

    if (key.expires_at && new Date(key.expires_at) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)) {
      usageWarnings.push('API key expires within 7 days');
    }

    if (!key.last_used_at || new Date(key.last_used_at) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) {
      usageWarnings.push('API key not used in 30 days - consider revoking');
    }

    return {
      key,
      warnings: usageWarnings,
      healthStatus: usageWarnings.length === 0 ? 'healthy' : 'attention_needed'
    };
  }

  // Secure key storage recommendations
  getSecurityRecommendations() {
    return {
      storage: [
        'Store API keys in environment variables or secure key management systems',
        'Never commit API keys to version control',
        'Use different API keys for different environments (dev/staging/prod)',
        'Implement key rotation every 30-90 days'
      ],
      network: [
        'Use HTTPS for all API requests',
        'Implement request signing for additional security',
        'Monitor for unusual usage patterns',
        'Set appropriate rate limits'
      ],
      access: [
        'Follow principle of least privilege for permissions',
        'Regularly audit API key usage',
        'Revoke unused or suspicious keys immediately',
        'Use separate keys for different applications or teams'
      ]
    };
  }
}
```

---

## Integration Testing for Authentication

### Authentication Test Suite

```javascript
class AuthenticationTests {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.testResults = [];
  }

  async runAllTests() {
    console.log('Running authentication tests...');
    
    await this.testJWTFlow();
    await this.testAPIKeyFlow();
    await this.testTokenRefresh();
    await this.testErrorHandling();
    
    this.printResults();
    return this.testResults;
  }

  async testJWTFlow() {
    try {
      const auth = new AuthenticationManager(this.baseUrl);
      
      // Test login
      const loginResult = await auth.login('test@example.com', 'testpassword');
      this.addTestResult('JWT Login', loginResult.user ? 'PASS' : 'FAIL');
      
      // Test authenticated request
      const token = await auth.getValidToken();
      const response = await fetch(`${this.baseUrl}/files`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      this.addTestResult('JWT Authenticated Request', response.ok ? 'PASS' : 'FAIL');
      
      // Test logout
      await auth.logout();
      this.addTestResult('JWT Logout', !auth.accessToken ? 'PASS' : 'FAIL');
      
    } catch (error) {
      this.addTestResult('JWT Flow', `FAIL: ${error.message}`);
    }
  }

  async testAPIKeyFlow() {
    try {
      const client = new APIKeyClient('test-api-key', this.baseUrl);
      
      // Test API key request
      const response = await client.request('/files');
      this.addTestResult('API Key Request', Array.isArray(response) ? 'PASS' : 'FAIL');
      
    } catch (error) {
      this.addTestResult('API Key Flow', `FAIL: ${error.message}`);
    }
  }

  async testTokenRefresh() {
    try {
      const auth = new AuthenticationManager(this.baseUrl);
      await auth.login('test@example.com', 'testpassword');
      
      // Simulate token expiry
      auth.tokenExpiry = new Date(Date.now() - 1000);
      
      // Test automatic refresh
      const newToken = await auth.getValidToken();
      this.addTestResult('Token Refresh', newToken ? 'PASS' : 'FAIL');
      
    } catch (error) {
      this.addTestResult('Token Refresh', `FAIL: ${error.message}`);
    }
  }

  async testErrorHandling() {
    try {
      // Test invalid credentials
      const auth = new AuthenticationManager(this.baseUrl);
      try {
        await auth.login('invalid@example.com', 'wrongpassword');
        this.addTestResult('Invalid Login Handling', 'FAIL: Should have thrown error');
      } catch (error) {
        this.addTestResult('Invalid Login Handling', 'PASS');
      }
      
      // Test invalid API key
      const client = new APIKeyClient('invalid-api-key', this.baseUrl);
      try {
        await client.request('/files');
        this.addTestResult('Invalid API Key Handling', 'FAIL: Should have thrown error');
      } catch (error) {
        this.addTestResult('Invalid API Key Handling', 'PASS');
      }
      
    } catch (error) {
      this.addTestResult('Error Handling Tests', `FAIL: ${error.message}`);
    }
  }

  addTestResult(testName, result) {
    this.testResults.push({ test: testName, result, timestamp: new Date() });
  }

  printResults() {
    console.log('\n=== Authentication Test Results ===');
    this.testResults.forEach(result => {
      const status = result.result.startsWith('PASS') ? '✅' : '❌';
      console.log(`${status} ${result.test}: ${result.result}`);
    });
    
    const passed = this.testResults.filter(r => r.result.startsWith('PASS')).length;
    const total = this.testResults.length;
    console.log(`\nSummary: ${passed}/${total} tests passed`);
  }
}

// Run tests
async function runAuthTests() {
  const tests = new AuthenticationTests('https://api.qa-platform.com/v1');
  await tests.runAllTests();
}
```

This comprehensive authentication guide provides robust patterns for implementing JWT and API key authentication, including token management, rotation strategies, and testing approaches for production-ready integrations. 