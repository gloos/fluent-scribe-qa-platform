# API Integration Guide

Welcome to the AI-Powered Linguistic QA Platform API! This guide will help you get started with integrating our API into your applications.

## Quick Start

### 1. Base URL

All API requests should be made to:
- **Development**: `http://localhost:3001/api/v1`
- **Staging**: `https://staging-api.qa-platform.com/v1`
- **Production**: `https://api.qa-platform.com/v1`

### 2. Authentication

The API supports two authentication methods:

#### JWT Bearer Token (Recommended for User Applications)
```bash
curl -X GET "https://api.qa-platform.com/v1/files" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### API Key (Recommended for Server-to-Server)
```bash
curl -X GET "https://api.qa-platform.com/v1/files" \
  -H "X-API-Key: YOUR_API_KEY"
```

### 3. Rate Limiting

The API implements comprehensive rate limiting:

| Scope | Limit | Reset Period |
|-------|-------|--------------|
| Global (per IP) | 1,000 requests | 1 hour |
| Authentication endpoints | 10 requests | 15 minutes |
| User endpoints | 1,000 requests | 1 hour |
| API Keys | Custom per key | Configurable |

Rate limit information is included in response headers:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642234567
```

## Authentication Examples

### Obtaining JWT Tokens

```javascript
// JavaScript/Node.js
const response = await fetch('https://api.qa-platform.com/v1/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'your-email@example.com',
    password: 'your-password'
  })
});

const { access_token, refresh_token, user } = await response.json();
```

```python
# Python
import requests

response = requests.post('https://api.qa-platform.com/v1/auth/login', json={
    'email': 'your-email@example.com',
    'password': 'your-password'
})

data = response.json()
access_token = data['access_token']
```

```bash
# cURL
curl -X POST "https://api.qa-platform.com/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "your-password"
  }'
```

### Managing API Keys

#### Create an API Key

```javascript
// JavaScript/Node.js
const response = await fetch('https://api.qa-platform.com/v1/api-keys', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'Production Integration',
    description: 'API key for our main production system',
    permissions: ['read:files', 'write:assessments', 'read:reports'],
    rate_limit_per_minute: 100,
    rate_limit_per_hour: 5000,
    rate_limit_per_day: 100000,
    expires_at: '2025-12-31T23:59:59Z'
  })
});

const { api_key, key_info } = await response.json();
// Save the api_key securely - it won't be shown again!
```

#### List Your API Keys

```javascript
const response = await fetch('https://api.qa-platform.com/v1/api-keys', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});

const { api_keys } = await response.json();
```

## File Processing Workflow

### 1. Upload an XLIFF File

```javascript
// JavaScript/Node.js with FormData
const formData = new FormData();
formData.append('file', fileBlob, 'translation.xliff');
formData.append('source_language', 'en');
formData.append('target_language', 'fr');
formData.append('assessment_model', 'gpt-4');
formData.append('priority', 'high');

const response = await fetch('https://api.qa-platform.com/v1/files', {
  method: 'POST',
  headers: {
    'X-API-Key': 'your-api-key'
  },
  body: formData
});

const fileData = await response.json();
console.log('File uploaded:', fileData.file_id);
```

```python
# Python with requests
import requests

files = {'file': open('translation.xliff', 'rb')}
data = {
    'source_language': 'en',
    'target_language': 'fr',
    'assessment_model': 'gpt-4',
    'priority': 'high'
}

response = requests.post(
    'https://api.qa-platform.com/v1/files',
    files=files,
    data=data,
    headers={'X-API-Key': 'your-api-key'}
)

file_data = response.json()
```

### 2. Check Processing Status

```javascript
// Poll for file processing status
const checkStatus = async (fileId) => {
  const response = await fetch(`https://api.qa-platform.com/v1/files/${fileId}`, {
    headers: {
      'X-API-Key': 'your-api-key'
    }
  });
  
  const file = await response.json();
  return file.processing_status; // 'uploaded', 'processing', 'completed', 'failed'
};

// Wait for completion
let status = 'processing';
while (status === 'processing') {
  await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
  status = await checkStatus(fileId);
}
```

### 3. Create Assessment

```javascript
const response = await fetch('https://api.qa-platform.com/v1/assessments', {
  method: 'POST',
  headers: {
    'X-API-Key': 'your-api-key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    file_id: fileId,
    assessment_model: 'gpt-4',
    quality_dimensions: ['accuracy', 'fluency', 'terminology', 'style'],
    include_suggestions: true,
    priority: 'normal'
  })
});

const assessment = await response.json();
```

### 4. Download Results

```javascript
// Get assessment results
const response = await fetch(`https://api.qa-platform.com/v1/assessments/${assessmentId}`, {
  headers: {
    'X-API-Key': 'your-api-key'
  }
});

const results = await response.json();

// Download report in specific format
const reportResponse = await fetch(
  `https://api.qa-platform.com/v1/assessments/${assessmentId}/report?format=pdf`,
  {
    headers: {
      'X-API-Key': 'your-api-key'
    }
  }
);

const reportBlob = await reportResponse.blob();
```

## Batch Processing

For processing multiple files efficiently:

```javascript
// Create batch job
const batchResponse = await fetch('https://api.qa-platform.com/v1/batches', {
  method: 'POST',
  headers: {
    'X-API-Key': 'your-api-key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Monthly Translation Review',
    file_ids: ['file-1', 'file-2', 'file-3'],
    assessment_config: {
      model: 'gpt-4',
      quality_dimensions: ['accuracy', 'fluency', 'terminology'],
      include_suggestions: true
    },
    priority: 'normal'
  })
});

const batch = await batchResponse.json();

// Monitor batch progress
const checkBatchStatus = async (batchId) => {
  const response = await fetch(`https://api.qa-platform.com/v1/batches/${batchId}`, {
    headers: {
      'X-API-Key': 'your-api-key'
    }
  });
  
  const batchData = await response.json();
  return batchData;
};
```

## Webhooks (Event Notifications)

Set up webhooks to receive real-time notifications:

```javascript
// Create webhook
const webhookResponse = await fetch('https://api.qa-platform.com/v1/webhooks', {
  method: 'POST',
  headers: {
    'X-API-Key': 'your-api-key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    url: 'https://your-server.com/webhook',
    events: ['file.processed', 'assessment.completed', 'batch.completed'],
    secret: 'your-webhook-secret-for-verification'
  })
});
```

## Error Handling

The API uses standard HTTP status codes and provides detailed error information:

```javascript
const handleApiCall = async () => {
  try {
    const response = await fetch('https://api.qa-platform.com/v1/files', {
      headers: {
        'X-API-Key': 'your-api-key'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      
      switch (response.status) {
        case 401:
          console.error('Authentication failed:', error.error.message);
          break;
        case 429:
          console.error('Rate limit exceeded. Retry after:', error.retryAfter, 'seconds');
          break;
        case 422:
          console.error('Validation errors:', error.error.field_errors);
          break;
        default:
          console.error('API error:', error.error.message);
      }
      
      return;
    }

    const data = await response.json();
    return data;
    
  } catch (error) {
    console.error('Network error:', error);
  }
};
```

## SDK Examples

### Node.js/JavaScript SDK Pattern

```javascript
class QAPlatformAPI {
  constructor(apiKey, baseUrl = 'https://api.qa-platform.com/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    const response = await fetch(url, config);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`API Error: ${error.error.message}`);
    }

    return await response.json();
  }

  async uploadFile(file, options = {}) {
    const formData = new FormData();
    formData.append('file', file);
    
    Object.entries(options).forEach(([key, value]) => {
      formData.append(key, value);
    });

    return this.request('/files', {
      method: 'POST',
      body: formData,
      headers: {} // Remove Content-Type to let browser set it
    });
  }

  async getFiles(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/files?${params}`);
  }

  async createAssessment(config) {
    return this.request('/assessments', {
      method: 'POST',
      body: JSON.stringify(config)
    });
  }
}

// Usage
const api = new QAPlatformAPI('your-api-key');
const files = await api.getFiles({ status: 'completed' });
```

### Python SDK Pattern

```python
import requests
import json

class QAPlatformAPI:
    def __init__(self, api_key, base_url='https://api.qa-platform.com/v1'):
        self.api_key = api_key
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({'X-API-Key': api_key})

    def request(self, endpoint, method='GET', **kwargs):
        url = f"{self.base_url}{endpoint}"
        response = self.session.request(method, url, **kwargs)
        
        if not response.ok:
            error_data = response.json()
            raise Exception(f"API Error: {error_data['error']['message']}")
        
        return response.json()

    def upload_file(self, file_path, **options):
        with open(file_path, 'rb') as f:
            files = {'file': f}
            return self.request('/files', method='POST', files=files, data=options)

    def get_files(self, **filters):
        return self.request('/files', params=filters)

    def create_assessment(self, config):
        return self.request('/assessments', method='POST', json=config)

# Usage
api = QAPlatformAPI('your-api-key')
files = api.get_files(status='completed')
```

## Best Practices

### 1. API Key Security
- Store API keys securely (environment variables, secure vaults)
- Use different keys for different environments
- Regularly rotate API keys
- Set appropriate expiration dates
- Monitor API key usage

### 2. Rate Limiting
- Implement exponential backoff for rate limit responses
- Cache responses when appropriate
- Use batch endpoints for bulk operations
- Monitor your usage patterns

### 3. Error Handling
- Always check HTTP status codes
- Parse error responses for detailed information
- Implement retry logic for transient errors
- Log errors for debugging

### 4. Performance
- Use webhooks instead of polling when possible
- Implement proper caching strategies
- Compress large payloads
- Use appropriate timeouts

### 5. Monitoring
- Track API usage and performance
- Set up alerts for high error rates
- Monitor rate limit consumption
- Log important events

## Interactive Documentation

For hands-on testing and exploration, visit our interactive API documentation:
- **Development**: http://localhost:3001/api/docs
- **Staging**: https://staging-api.qa-platform.com/docs
- **Production**: https://api.qa-platform.com/docs

The interactive documentation allows you to:
- Explore all available endpoints
- Test API calls directly in the browser
- View detailed request/response examples
- Generate code snippets in multiple languages

## Support

For additional help:
- Email: support@qa-platform.com
- Documentation: https://docs.qa-platform.com
- Status Page: https://status.qa-platform.com
- GitHub Issues: https://github.com/qa-platform/api-issues 