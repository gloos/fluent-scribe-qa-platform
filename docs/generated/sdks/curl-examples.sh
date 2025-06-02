#!/bin/bash
# QA Platform API cURL Examples
# Auto-generated from OpenAPI specification
# Version: 1.0.0

# Set your API key
API_KEY="your-api-key-here"
BASE_URL="http://localhost:3001/api/v1"

# Health check
echo "Testing health endpoint..."
curl -X GET "$BASE_URL/health" \
  -H "Content-Type: application/json"

# Login
echo "Testing login..."
curl -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "your-password"
  }'

# Get API keys
echo "Getting API keys..."
curl -X GET "$BASE_URL/api-keys" \
  -H "X-API-Key: $API_KEY"

# Create API key
echo "Creating API key..."
curl -X POST "$BASE_URL/api-keys" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
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
curl -X GET "$BASE_URL/files" \
  -H "X-API-Key: $API_KEY"

# Upload file
echo "Uploading file..."
curl -X POST "$BASE_URL/files" \
  -H "X-API-Key: $API_KEY" \
  -F "file=@path/to/your/file.xliff" \
  -F "source_language=en" \
  -F "target_language=fr" \
  -F "assessment_model=gpt-4"
