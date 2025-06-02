# AI-Powered Linguistic QA Platform API


        RESTful API for the AI-Powered Linguistic QA Platform, enabling external integrations for XLIFF file processing, 
        quality assessment workflows, and MQM (Multidimensional Quality Metrics) scoring.
        
        This platform processes translation files using advanced LLMs to provide detailed quality assessment reports.
      

**Version:** 1.0.0

## Authentication

### BearerAuth
Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### ApiKeyAuth
Include your API key in the X-API-Key header:
```
X-API-Key: <your-api-key>
```

## Endpoints

### GET /health

Health check endpoint

Returns the current health status of the API

**Responses:**

- `200` - API is healthy

### POST /auth/login

User authentication

Authenticate user with email and password

**Responses:**

- `200` - Successful authentication
- `401` - Invalid credentials
- `422` - No description
- `429` - Too many login attempts
- `501` - Not yet implemented

### POST /auth/logout

User logout

Invalidate current user session

**Responses:**

- `200` - Successfully logged out
- `401` - Authentication required

### GET /api-keys

List API keys

Retrieve all API keys for the authenticated user, including usage statistics and metadata

**Responses:**

- `200` - Successfully retrieved API keys
- `401` - Authentication required
- `500` - Internal server error

### POST /api-keys

Create API key

Generate a new API key with specified permissions and rate limits. The API key value is only returned once and cannot be retrieved again.

**Responses:**

- `201` - API key created successfully
- `400` - Validation error or creation failed
- `401` - Authentication required
- `500` - Internal server error

### GET /api-keys/{keyId}

Get API key details

Retrieve detailed information about a specific API key including usage statistics

**Parameters:**

- `keyId` (path) - Unique API key identifier

**Responses:**

- `200` - API key details retrieved successfully
- `401` - Authentication required
- `404` - API key not found
- `500` - Internal server error

### PATCH /api-keys/{keyId}

Update API key

Update API key configuration including name, description, permissions, and rate limits

**Parameters:**

- `keyId` (path) - Unique API key identifier

**Responses:**

- `200` - API key updated successfully
- `400` - Update validation error
- `401` - Authentication required
- `404` - API key not found
- `500` - Internal server error

### DELETE /api-keys/{keyId}

Delete API key

Permanently delete an API key. This action cannot be undone and will immediately invalidate the key.

**Parameters:**

- `keyId` (path) - Unique API key identifier

**Responses:**

- `200` - API key deleted successfully
- `400` - Deletion failed
- `401` - Authentication required
- `404` - API key not found
- `500` - Internal server error

### GET /files

List uploaded files

Retrieve a list of uploaded files with their processing status

**Parameters:**

- `status` (query) - Filter files by processing status
- `limit` (query) - Number of files to return
- `offset` (query) - Number of files to skip
- `file_type` (query) - Filter by file format

**Responses:**

- `200` - List of files
- `401` - Authentication required
- `501` - Endpoint not yet implemented

### POST /files

Upload XLIFF file for processing

Upload an XLIFF file for quality assessment analysis

**Responses:**

- `201` - File uploaded successfully
- `400` - Invalid file or upload error
- `401` - Authentication required
- `413` - File too large
- `501` - Endpoint not yet implemented

### 0 openapi

No summary available

### 1 openapi

No summary available

### 2 openapi

No summary available

### 3 openapi

No summary available

### 4 openapi

No summary available

### TITLE info

No summary available

### DESCRIPTION info

No summary available

### VERSION info

No summary available

### CONTACT info

No summary available

### LICENSE info

No summary available

### 0 servers

No summary available

Production server

### 1 servers

No summary available

Staging server

### 2 servers

No summary available

Development server

### 0 security

No summary available

### 1 security

No summary available

### GET /files/{fileId}

Get file details

Retrieve detailed information about a specific file

**Parameters:**

- `fileId` (path) - Unique file identifier

**Responses:**

- `200` - File details
- `401` - No description
- `404` - No description

### DELETE /files/{fileId}

Delete file

Delete an uploaded file and its associated data

**Parameters:**

- `fileId` (path) - Unique file identifier

**Responses:**

- `200` - File deleted successfully
- `401` - No description
- `404` - No description

### GET /assessments

List quality assessments

Retrieve a list of quality assessments with filtering options

**Parameters:**

- `status` (query) - Filter assessments by status
- `file_id` (query) - Filter by specific file ID
- `limit` (query) - No description
- `offset` (query) - No description

**Responses:**

- `200` - List of assessments
- `401` - No description

### POST /assessments

Create new assessment

Initiate a new quality assessment for an uploaded file

**Responses:**

- `201` - Assessment created successfully
- `400` - No description
- `401` - No description

### GET /assessments/{assessmentId}

Get assessment details

Retrieve detailed results of a quality assessment

**Parameters:**

- `assessmentId` (path) - Unique assessment identifier

**Responses:**

- `200` - Assessment details
- `401` - No description
- `404` - No description

### GET /assessments/{assessmentId}/report

Download assessment report

Download the complete assessment report in various formats

**Parameters:**

- `assessmentId` (path) - Unique assessment identifier
- `format` (query) - Report format

**Responses:**

- `200` - Assessment report file
- `401` - No description
- `404` - No description

### GET /batches

List batch processes

Retrieve a list of batch processing jobs

**Parameters:**

- `status` (query) - No description
- `limit` (query) - No description
- `offset` (query) - No description

**Responses:**

- `200` - List of batch processes
- `401` - No description

### POST /batches

Create batch processing job

Create a new batch processing job for multiple files

**Responses:**

- `201` - Batch job created successfully
- `400` - No description
- `401` - No description

### GET /batches/{batchId}

Get batch details

Retrieve detailed information about a batch processing job

**Parameters:**

- `batchId` (path) - No description

**Responses:**

- `200` - Batch details
- `401` - No description
- `404` - No description

### PATCH /batches/{batchId}

Update batch status

Update the status of a batch processing job

**Parameters:**

- `batchId` (path) - No description

**Responses:**

- `200` - Batch updated successfully
- `400` - No description
- `401` - No description
- `404` - No description

### GET /webhooks

List webhooks

Retrieve a list of configured webhooks

**Responses:**

- `200` - List of webhooks
- `401` - No description

### POST /webhooks

Create webhook

Create a new webhook endpoint for receiving notifications

**Responses:**

- `201` - Webhook created successfully
- `400` - No description
- `401` - No description

### GET /webhooks/{webhookId}

Get webhook details

Retrieve detailed information about a specific webhook

**Parameters:**

- `webhookId` (path) - No description

**Responses:**

- `200` - Webhook details
- `401` - No description
- `404` - No description

### PATCH /webhooks/{webhookId}

Update webhook

Update webhook configuration

**Parameters:**

- `webhookId` (path) - No description

**Responses:**

- `200` - Webhook updated successfully
- `400` - No description
- `401` - No description
- `404` - No description

### DELETE /webhooks/{webhookId}

Delete webhook

Delete a webhook endpoint

**Parameters:**

- `webhookId` (path) - No description

**Responses:**

- `200` - Webhook deleted successfully
- `401` - No description
- `404` - No description

