#!/usr/bin/env node

/**
 * API Documentation Generator
 * 
 * This script generates API documentation by:
 * 1. Extracting JSDoc comments from source files
 * 2. Merging with existing OpenAPI specification
 * 3. Generating HTML documentation
 * 4. Creating SDK documentation
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import swaggerJsdoc from 'swagger-jsdoc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const docsDir = path.join(rootDir, 'docs');
const outputDir = path.join(docsDir, 'generated');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Swagger JSDoc configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'AI-Powered Linguistic QA Platform API',
      version: '1.0.0',
      description: `
        RESTful API for the AI-Powered Linguistic QA Platform, enabling external integrations for XLIFF file processing, 
        quality assessment workflows, and MQM (Multidimensional Quality Metrics) scoring.
        
        This platform processes translation files using advanced LLMs to provide detailed quality assessment reports.
      `,
      contact: {
        name: 'QA Platform Support',
        email: 'support@qa-platform.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3001/api/v1',
        description: 'Development server'
      },
      {
        url: 'https://staging-api.qa-platform.com/v1',
        description: 'Staging server'
      },
      {
        url: 'https://api.qa-platform.com/v1',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        },
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key'
        }
      }
    },
    security: [
      { BearerAuth: [] },
      { ApiKeyAuth: [] }
    ]
  },
  apis: [
    path.join(rootDir, 'src/server/*.ts'),
    path.join(rootDir, 'src/lib/middleware/*.ts'),
    path.join(rootDir, 'docs/api-specification.yaml')
  ]
};

console.log('🚀 Generating API Documentation...');

try {
  // Generate OpenAPI specification from JSDoc comments
  console.log('📝 Extracting API definitions from source files...');
  const specs = swaggerJsdoc(swaggerOptions);

  // Write the generated OpenAPI spec
  const specPath = path.join(outputDir, 'openapi-generated.json');
  fs.writeFileSync(specPath, JSON.stringify(specs, null, 2));
  console.log(`✅ Generated OpenAPI specification: ${specPath}`);

  // Generate markdown documentation
  console.log('📚 Generating markdown documentation...');
  const markdownDoc = generateMarkdownDocs(specs);
  const markdownPath = path.join(outputDir, 'api-reference.md');
  fs.writeFileSync(markdownPath, markdownDoc);
  console.log(`✅ Generated markdown documentation: ${markdownPath}`);

  // Generate SDK examples
  console.log('🔧 Generating SDK examples...');
  generateSDKExamples(specs);
  console.log('✅ Generated SDK examples');

  // Generate postman collection
  console.log('📮 Generating Postman collection...');
  const postmanCollection = generatePostmanCollection(specs);
  const postmanPath = path.join(outputDir, 'qa-platform-api.postman_collection.json');
  fs.writeFileSync(postmanPath, JSON.stringify(postmanCollection, null, 2));
  console.log(`✅ Generated Postman collection: ${postmanPath}`);

  console.log('\n🎉 Documentation generation complete!');
  console.log('\nGenerated files:');
  console.log(`  - OpenAPI spec: ${specPath}`);
  console.log(`  - Markdown docs: ${markdownPath}`);
  console.log(`  - Postman collection: ${postmanPath}`);
  console.log(`  - SDK examples: ${outputDir}/sdks/`);

} catch (error) {
  console.error('❌ Error generating documentation:', error);
  process.exit(1);
}

function generateMarkdownDocs(specs) {
  let markdown = `# ${specs.info.title}\n\n`;
  markdown += `${specs.info.description}\n\n`;
  markdown += `**Version:** ${specs.info.version}\n\n`;

  // Authentication section
  markdown += '## Authentication\n\n';
  if (specs.components?.securitySchemes) {
    Object.entries(specs.components.securitySchemes).forEach(([name, scheme]) => {
      markdown += `### ${name}\n`;
      if (scheme.type === 'http' && scheme.scheme === 'bearer') {
        markdown += 'Include the JWT token in the Authorization header:\n';
        markdown += '```\nAuthorization: Bearer <your-jwt-token>\n```\n\n';
      } else if (scheme.type === 'apiKey') {
        markdown += `Include your API key in the ${scheme.name} header:\n`;
        markdown += `\`\`\`\n${scheme.name}: <your-api-key>\n\`\`\`\n\n`;
      }
    });
  }

  // Endpoints section
  markdown += '## Endpoints\n\n';
  if (specs.paths) {
    Object.entries(specs.paths).forEach(([path, methods]) => {
      Object.entries(methods).forEach(([method, operation]) => {
        markdown += `### ${method.toUpperCase()} ${path}\n\n`;
        markdown += `${operation.summary || 'No summary available'}\n\n`;
        if (operation.description) {
          markdown += `${operation.description}\n\n`;
        }

        // Parameters
        if (operation.parameters) {
          markdown += '**Parameters:**\n\n';
          operation.parameters.forEach(param => {
            markdown += `- \`${param.name}\` (${param.in}) - ${param.description || 'No description'}\n`;
          });
          markdown += '\n';
        }

        // Response codes
        if (operation.responses) {
          markdown += '**Responses:**\n\n';
          Object.entries(operation.responses).forEach(([code, response]) => {
            markdown += `- \`${code}\` - ${response.description || 'No description'}\n`;
          });
          markdown += '\n';
        }
      });
    });
  }

  return markdown;
}

function generateSDKExamples(specs) {
  const sdkDir = path.join(outputDir, 'sdks');
  if (!fs.existsSync(sdkDir)) {
    fs.mkdirSync(sdkDir, { recursive: true });
  }

  // Generate JavaScript SDK
  const jsSDK = generateJavaScriptSDK(specs);
  fs.writeFileSync(path.join(sdkDir, 'qa-platform-sdk.js'), jsSDK);

  // Generate Python SDK
  const pythonSDK = generatePythonSDK(specs);
  fs.writeFileSync(path.join(sdkDir, 'qa_platform_sdk.py'), pythonSDK);

  // Generate cURL examples
  const curlExamples = generateCurlExamples(specs);
  fs.writeFileSync(path.join(sdkDir, 'curl-examples.sh'), curlExamples);
}

function generateJavaScriptSDK(specs) {
  return `/**
 * QA Platform API SDK for JavaScript/Node.js
 * 
 * Auto-generated from OpenAPI specification
 * Version: ${specs.info.version}
 */

class QAPlatformAPI {
  constructor(apiKey, baseUrl = '${specs.servers[0].url}') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async request(endpoint, options = {}) {
    const url = \`\${this.baseUrl}\${endpoint}\`;
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
      throw new Error(\`API Error (\${response.status}): \${error.error?.message || 'Unknown error'}\`);
    }

    return await response.json();
  }

  // Health check
  async healthCheck() {
    return this.request('/health');
  }

  // Authentication
  async login(email, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  }

  async logout() {
    return this.request('/auth/logout', { method: 'POST' });
  }

  // API Key Management
  async getApiKeys() {
    return this.request('/api-keys');
  }

  async createApiKey(keyData) {
    return this.request('/api-keys', {
      method: 'POST',
      body: JSON.stringify(keyData)
    });
  }

  async getApiKey(keyId) {
    return this.request(\`/api-keys/\${keyId}\`);
  }

  async updateApiKey(keyId, updates) {
    return this.request(\`/api-keys/\${keyId}\`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  }

  async deleteApiKey(keyId) {
    return this.request(\`/api-keys/\${keyId}\`, { method: 'DELETE' });
  }

  // File Management
  async getFiles(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(\`/files?\${params}\`);
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
}

export default QAPlatformAPI;

// Example usage:
// const api = new QAPlatformAPI('your-api-key');
// const files = await api.getFiles({ status: 'completed' });
`;
}

function generatePythonSDK(specs) {
  return `"""
QA Platform API SDK for Python

Auto-generated from OpenAPI specification
Version: ${specs.info.version}
"""

import requests
import json
from typing import Dict, Any, Optional, List
from urllib.parse import urlencode


class QAPlatformAPI:
    def __init__(self, api_key: str, base_url: str = "${specs.servers[0].url}"):
        self.api_key = api_key
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({'X-API-Key': api_key})

    def request(self, endpoint: str, method: str = 'GET', **kwargs) -> Dict[str, Any]:
        url = f"{self.base_url}{endpoint}"
        response = self.session.request(method, url, **kwargs)
        
        if not response.ok:
            try:
                error_data = response.json()
                error_msg = error_data.get('error', {}).get('message', 'Unknown error')
            except ValueError:
                error_msg = response.text
            raise Exception(f"API Error ({response.status_code}): {error_msg}")
        
        return response.json()

    # Health check
    def health_check(self) -> Dict[str, Any]:
        return self.request('/health')

    # Authentication
    def login(self, email: str, password: str) -> Dict[str, Any]:
        return self.request('/auth/login', method='POST', json={
            'email': email,
            'password': password
        })

    def logout(self) -> Dict[str, Any]:
        return self.request('/auth/logout', method='POST')

    # API Key Management
    def get_api_keys(self) -> Dict[str, Any]:
        return self.request('/api-keys')

    def create_api_key(self, key_data: Dict[str, Any]) -> Dict[str, Any]:
        return self.request('/api-keys', method='POST', json=key_data)

    def get_api_key(self, key_id: str) -> Dict[str, Any]:
        return self.request(f'/api-keys/{key_id}')

    def update_api_key(self, key_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        return self.request(f'/api-keys/{key_id}', method='PATCH', json=updates)

    def delete_api_key(self, key_id: str) -> Dict[str, Any]:
        return self.request(f'/api-keys/{key_id}', method='DELETE')

    # File Management
    def get_files(self, **filters) -> Dict[str, Any]:
        if filters:
            endpoint = f'/files?{urlencode(filters)}'
        else:
            endpoint = '/files'
        return self.request(endpoint)

    def upload_file(self, file_path: str, **options) -> Dict[str, Any]:
        with open(file_path, 'rb') as f:
            files = {'file': f}
            return self.request('/files', method='POST', files=files, data=options)


# Example usage:
# api = QAPlatformAPI('your-api-key')
# files = api.get_files(status='completed')
`;
}

function generateCurlExamples(specs) {
  let examples = `#!/bin/bash
# QA Platform API cURL Examples
# Auto-generated from OpenAPI specification
# Version: ${specs.info.version}

# Set your API key
API_KEY="your-api-key-here"
BASE_URL="${specs.servers[0].url}"

# Health check
echo "Testing health endpoint..."
curl -X GET "$BASE_URL/health" \\
  -H "Content-Type: application/json"

# Login
echo "Testing login..."
curl -X POST "$BASE_URL/auth/login" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "user@example.com",
    "password": "your-password"
  }'

# Get API keys
echo "Getting API keys..."
curl -X GET "$BASE_URL/api-keys" \\
  -H "X-API-Key: $API_KEY"

# Create API key
echo "Creating API key..."
curl -X POST "$BASE_URL/api-keys" \\
  -H "X-API-Key: $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Test API Key",
    "description": "Generated for testing",
    "permissions": ["read:files", "write:assessments"],
    "rate_limit_per_minute": 100,
    "rate_limit_per_hour": 5000,
    "rate_limit_per_day": 100000
  }'

# Get files
echo "Getting files..."
curl -X GET "$BASE_URL/files" \\
  -H "X-API-Key: $API_KEY"

# Upload file
echo "Uploading file..."
curl -X POST "$BASE_URL/files" \\
  -H "X-API-Key: $API_KEY" \\
  -F "file=@path/to/your/file.xliff" \\
  -F "source_language=en" \\
  -F "target_language=fr" \\
  -F "assessment_model=gpt-4"
`;

  return examples;
}

function generatePostmanCollection(specs) {
  const collection = {
    info: {
      name: specs.info.title,
      description: specs.info.description,
      version: specs.info.version,
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    },
    auth: {
      type: "apikey",
      apikey: [
        {
          key: "key",
          value: "X-API-Key",
          type: "string"
        },
        {
          key: "value",
          value: "{{api_key}}",
          type: "string"
        }
      ]
    },
    variable: [
      {
        key: "base_url",
        value: specs.servers[0].url,
        type: "string"
      },
      {
        key: "api_key",
        value: "your-api-key-here",
        type: "string"
      }
    ],
    item: []
  };

  // Add requests for each endpoint
  if (specs.paths) {
    Object.entries(specs.paths).forEach(([path, methods]) => {
      Object.entries(methods).forEach(([method, operation]) => {
        const request = {
          name: operation.summary || `${method.toUpperCase()} ${path}`,
          request: {
            method: method.toUpperCase(),
            header: [
              {
                key: "Content-Type",
                value: "application/json",
                type: "text"
              }
            ],
            url: {
              raw: "{{base_url}}" + path,
              host: ["{{base_url}}"],
              path: path.split('/').filter(p => p)
            },
            description: operation.description
          }
        };

        // Add request body if applicable
        if (operation.requestBody) {
          request.request.body = {
            mode: "raw",
            raw: JSON.stringify({}, null, 2),
            options: {
              raw: {
                language: "json"
              }
            }
          };
        }

        collection.item.push(request);
      });
    });
  }

  return collection;
} 