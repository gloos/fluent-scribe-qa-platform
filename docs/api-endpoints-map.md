# API Endpoints Implementation Map

This document provides a detailed mapping of all API endpoints defined in the OpenAPI specification, serving as a guide for backend implementation.

## Base Configuration

- **Base URL Structure**: `/api/v1`
- **Authentication**: JWT Bearer tokens and API keys
- **Content Type**: `application/json` (except file uploads)
- **Error Format**: Standardized error response schema

---

## Endpoints by Category

### 1. System Endpoints

#### Health Check
- **Endpoint**: `GET /health`
- **Security**: None (public)
- **Purpose**: Service health monitoring
- **Response**: Service status, version, and dependent service health
- **Implementation Notes**: Should check database connectivity, LLM provider status, and file storage

---

### 2. Authentication Endpoints

#### User Login
- **Endpoint**: `POST /auth/login`
- **Security**: None (public)
- **Body**: `{ email: string, password: string }`
- **Response**: JWT tokens + user profile
- **Implementation Notes**: 
  - Use Supabase auth
  - Return both access and refresh tokens
  - Set appropriate token expiration

#### User Logout
- **Endpoint**: `POST /auth/logout`
- **Security**: Bearer token required
- **Purpose**: Invalidate user session
- **Implementation Notes**: Blacklist JWT token, clear session data

---

### 3. File Management Endpoints

#### List Files
- **Endpoint**: `GET /files`
- **Security**: Bearer token required
- **Query Parameters**:
  - `status`: Filter by processing status
  - `limit`: Number of results (1-100, default 20)
  - `offset`: Pagination offset
  - `file_type`: Filter by XLIFF format
- **Response**: Paginated file list with metadata
- **Implementation Notes**: 
  - Filter by user ownership
  - Include processing status and metadata
  - Support efficient pagination

#### Upload File
- **Endpoint**: `POST /files`
- **Security**: Bearer token required
- **Content-Type**: `multipart/form-data`
- **Body Fields**:
  - `file`: Binary XLIFF file (required)
  - `source_language`: ISO 639-1 code
  - `target_language`: ISO 639-1 code
  - `assessment_model`: LLM model choice
  - `priority`: Processing priority
- **Response**: File record with upload confirmation
- **Implementation Notes**:
  - Validate file format (XLIFF 1.2, 2.0, MXLIFF)
  - Extract file metadata
  - Queue for processing
  - Store in secure file storage

#### Get File Details
- **Endpoint**: `GET /files/{fileId}`
- **Security**: Bearer token required
- **Parameters**: `fileId` (UUID)
- **Response**: Complete file information including metadata
- **Implementation Notes**: 
  - Verify user ownership
  - Include processing status and error details

#### Delete File
- **Endpoint**: `DELETE /files/{fileId}`
- **Security**: Bearer token required
- **Parameters**: `fileId` (UUID)
- **Response**: Confirmation message
- **Implementation Notes**:
  - Verify user ownership
  - Cascade delete assessments and reports
  - Remove from file storage

---

### 4. Assessment Endpoints

#### List Assessments
- **Endpoint**: `GET /assessments`
- **Security**: Bearer token required
- **Query Parameters**:
  - `status`: Filter by assessment status
  - `file_id`: Filter by specific file
  - `limit`: Results per page
  - `offset`: Pagination offset
- **Response**: Paginated assessment list
- **Implementation Notes**: Filter by user's files only

#### Create Assessment
- **Endpoint**: `POST /assessments`
- **Security**: Bearer token required
- **Body**: Assessment configuration with file reference
- **Response**: Assessment record with estimated completion
- **Implementation Notes**:
  - Verify file ownership
  - Queue LLM processing job
  - Return job tracking information

#### Get Assessment Details
- **Endpoint**: `GET /assessments/{assessmentId}`
- **Security**: Bearer token required
- **Parameters**: `assessmentId` (UUID)
- **Response**: Complete assessment results with MQM scores
- **Implementation Notes**: 
  - Verify access permissions
  - Include detailed error analysis and recommendations

#### Download Assessment Report
- **Endpoint**: `GET /assessments/{assessmentId}/report`
- **Security**: Bearer token required
- **Query Parameters**: `format` (pdf, excel, csv, json)
- **Response**: Report file in requested format
- **Implementation Notes**:
  - Generate report on-demand or serve cached version
  - Support multiple export formats
  - Include comprehensive quality metrics

---

### 5. Batch Processing Endpoints

#### List Batches
- **Endpoint**: `GET /batches`
- **Security**: Bearer token required
- **Query Parameters**: Status filtering and pagination
- **Response**: Paginated batch job list
- **Implementation Notes**: Show user's batch jobs only

#### Create Batch Job
- **Endpoint**: `POST /batches`
- **Security**: Bearer token required
- **Body**: Batch configuration with file IDs and settings
- **Response**: Batch job record with tracking information
- **Implementation Notes**:
  - Validate all file IDs belong to user
  - Create individual assessment jobs
  - Set up progress tracking

#### Get Batch Details
- **Endpoint**: `GET /batches/{batchId}`
- **Security**: Bearer token required
- **Parameters**: `batchId` (UUID)
- **Response**: Detailed batch status with file-level progress
- **Implementation Notes**: Real-time progress updates

#### Update Batch Status
- **Endpoint**: `PATCH /batches/{batchId}`
- **Security**: Bearer token required
- **Body**: Status update (e.g., cancel)
- **Response**: Updated batch information
- **Implementation Notes**: Support cancellation of pending jobs

---

### 6. Webhook Endpoints

#### List Webhooks
- **Endpoint**: `GET /webhooks`
- **Security**: Bearer token required
- **Response**: User's configured webhooks
- **Implementation Notes**: Include delivery statistics

#### Create Webhook
- **Endpoint**: `POST /webhooks`
- **Security**: Bearer token required
- **Body**: Webhook URL, events, and configuration
- **Response**: Webhook record with generated ID
- **Implementation Notes**: 
  - Validate webhook URL accessibility
  - Generate webhook secret for verification

#### Get Webhook Details
- **Endpoint**: `GET /webhooks/{webhookId}`
- **Security**: Bearer token required
- **Response**: Webhook configuration and delivery history
- **Implementation Notes**: Include recent delivery attempts

#### Update Webhook
- **Endpoint**: `PATCH /webhooks/{webhookId}`
- **Security**: Bearer token required
- **Body**: Updated webhook configuration
- **Response**: Updated webhook record
- **Implementation Notes**: Support URL and event changes

#### Delete Webhook
- **Endpoint**: `DELETE /webhooks/{webhookId}`
- **Security**: Bearer token required
- **Response**: Confirmation message
- **Implementation Notes**: Stop future deliveries

---

## Implementation Guidelines

### Security Considerations
1. **Authentication**: All endpoints except `/health` and `/auth/login` require valid JWT tokens
2. **Authorization**: Users can only access their own resources
3. **Rate Limiting**: Implement per-user rate limits, especially for file uploads
4. **Input Validation**: Validate all inputs against OpenAPI schema
5. **File Security**: Scan uploaded files for malware, validate XLIFF format

### Error Handling
- Use standardized error response format
- Include error codes for programmatic handling
- Provide helpful error messages
- Log errors for debugging while avoiding sensitive data exposure

### Performance Considerations
1. **Pagination**: Implement cursor-based pagination for large datasets
2. **Caching**: Cache frequently accessed data (file metadata, assessment results)
3. **Async Processing**: Use job queues for LLM processing
4. **File Storage**: Use cloud storage with CDN for file serving

### Database Schema Requirements
Based on the API design, the following main entities are needed:
- **Users**: Authentication and profile information
- **Files**: Uploaded XLIFF files with metadata
- **Assessments**: Quality assessment jobs and results
- **Batches**: Batch processing jobs
- **Webhooks**: Webhook configurations
- **Quality_Errors**: Detailed error analysis from assessments

### Integration Points
1. **Supabase**: User authentication and database
2. **LLM Providers**: OpenAI/Anthropic/Google for quality assessment
3. **File Storage**: Supabase Storage or S3 for XLIFF files
4. **Job Queue**: For async processing (Redis/Bull queues)
5. **Webhook Delivery**: Reliable webhook delivery system

### Monitoring and Observability
- Log all API requests and responses
- Monitor processing job queues
- Track webhook delivery success rates
- Measure assessment processing times
- Alert on system health issues

---

## Next Steps for Implementation

1. **Set up project structure** with proper routing
2. **Implement authentication middleware** using Supabase
3. **Create database schemas** for all entities
4. **Build file upload handling** with validation
5. **Set up job queues** for LLM processing
6. **Implement webhook delivery system**
7. **Add comprehensive error handling**
8. **Create automated tests** for all endpoints
9. **Set up monitoring and logging**
10. **Deploy with proper security configurations** 