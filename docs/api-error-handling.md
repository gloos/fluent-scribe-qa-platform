# API Error Handling Strategy

This document defines the comprehensive error handling approach for the QA Platform API, ensuring consistent, informative, and actionable error responses.

## Error Response Format

All API errors follow a standardized JSON format:

```json
{
  "error": {
    "code": "error_code",
    "message": "Human-readable error description",
    "details": ["Additional error information"],
    "field_errors": {
      "field_name": ["Field-specific error messages"]
    }
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "request_id": "uuid-for-tracking"
}
```

## HTTP Status Codes

### 2xx Success
- **200 OK**: Request succeeded
- **201 Created**: Resource created successfully
- **204 No Content**: Request succeeded with no response body

### 4xx Client Errors
- **400 Bad Request**: Invalid request data or parameters
- **401 Unauthorized**: Authentication required or invalid credentials
- **403 Forbidden**: Valid authentication but insufficient permissions
- **404 Not Found**: Requested resource doesn't exist
- **409 Conflict**: Request conflicts with current resource state
- **413 Payload Too Large**: Request body exceeds size limits
- **422 Unprocessable Entity**: Request validation failed
- **429 Too Many Requests**: Rate limit exceeded

### 5xx Server Errors
- **500 Internal Server Error**: Unexpected server error
- **502 Bad Gateway**: Upstream service error
- **503 Service Unavailable**: Service temporarily unavailable
- **504 Gateway Timeout**: Upstream service timeout

## Error Categories and Codes

### Authentication Errors (AUTH_xxx)
```json
{
  "error": {
    "code": "AUTH_TOKEN_MISSING",
    "message": "Authentication token is required"
  }
}
```

**Error Codes:**
- `AUTH_TOKEN_MISSING`: No authentication token provided
- `AUTH_TOKEN_INVALID`: Invalid or malformed token
- `AUTH_TOKEN_EXPIRED`: Token has expired
- `AUTH_CREDENTIALS_INVALID`: Invalid email/password combination
- `AUTH_ACCOUNT_LOCKED`: Account temporarily locked
- `AUTH_ACCOUNT_DISABLED`: Account has been disabled

### Authorization Errors (AUTHZ_xxx)
```json
{
  "error": {
    "code": "AUTHZ_INSUFFICIENT_PERMISSIONS",
    "message": "You don't have permission to access this resource"
  }
}
```

**Error Codes:**
- `AUTHZ_INSUFFICIENT_PERMISSIONS`: User lacks required permissions
- `AUTHZ_RESOURCE_ACCESS_DENIED`: Cannot access specific resource
- `AUTHZ_OPERATION_NOT_ALLOWED`: Operation not permitted for user role

### Validation Errors (VALIDATION_xxx)
```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request validation failed",
    "field_errors": {
      "email": ["Must be a valid email address"],
      "password": ["Must be at least 8 characters long"]
    }
  }
}
```

**Error Codes:**
- `VALIDATION_FAILED`: General validation failure
- `VALIDATION_REQUIRED_FIELD`: Required field missing
- `VALIDATION_INVALID_FORMAT`: Field format invalid
- `VALIDATION_VALUE_OUT_OF_RANGE`: Value outside acceptable range
- `VALIDATION_INVALID_FILE_TYPE`: Unsupported file format
- `VALIDATION_FILE_TOO_LARGE`: File exceeds size limit

### Resource Errors (RESOURCE_xxx)
```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "The requested file was not found",
    "details": ["File ID: abc-123-def"]
  }
}
```

**Error Codes:**
- `RESOURCE_NOT_FOUND`: Requested resource doesn't exist
- `RESOURCE_ALREADY_EXISTS`: Resource with same identifier exists
- `RESOURCE_CONFLICT`: Resource state conflicts with operation
- `RESOURCE_LOCKED`: Resource is locked for exclusive access
- `RESOURCE_DELETED`: Resource has been soft-deleted

### File Processing Errors (FILE_xxx)
```json
{
  "error": {
    "code": "FILE_PROCESSING_FAILED",
    "message": "Failed to process XLIFF file",
    "details": ["Invalid XLIFF structure at line 42"]
  }
}
```

**Error Codes:**
- `FILE_UPLOAD_FAILED`: File upload operation failed
- `FILE_PROCESSING_FAILED`: Error processing uploaded file
- `FILE_CORRUPT`: File appears to be corrupted
- `FILE_UNSUPPORTED_FORMAT`: File format not supported
- `FILE_XLIFF_INVALID`: XLIFF file structure invalid
- `FILE_METADATA_MISSING`: Required metadata not found

### Assessment Errors (ASSESSMENT_xxx)
```json
{
  "error": {
    "code": "ASSESSMENT_LLM_UNAVAILABLE",
    "message": "The selected LLM model is currently unavailable",
    "details": ["Model: gpt-4", "Try again later or select different model"]
  }
}
```

**Error Codes:**
- `ASSESSMENT_CREATION_FAILED`: Could not create assessment
- `ASSESSMENT_PROCESSING_FAILED`: Error during quality assessment
- `ASSESSMENT_LLM_UNAVAILABLE`: LLM service unavailable
- `ASSESSMENT_LLM_QUOTA_EXCEEDED`: LLM usage quota exceeded
- `ASSESSMENT_TIMEOUT`: Assessment processing timed out
- `ASSESSMENT_INVALID_CONFIG`: Invalid assessment configuration

### Batch Processing Errors (BATCH_xxx)
```json
{
  "error": {
    "code": "BATCH_FILE_ACCESS_DENIED",
    "message": "Cannot access one or more files in the batch",
    "details": ["File IDs that failed: file-1, file-3"]
  }
}
```

**Error Codes:**
- `BATCH_CREATION_FAILED`: Could not create batch job
- `BATCH_FILE_ACCESS_DENIED`: Cannot access batch files
- `BATCH_PROCESSING_FAILED`: Batch processing error
- `BATCH_CANCELLED`: Batch job was cancelled
- `BATCH_TIMEOUT`: Batch processing timed out

### System Errors (SYSTEM_xxx)
```json
{
  "error": {
    "code": "SYSTEM_DATABASE_UNAVAILABLE",
    "message": "Database service is temporarily unavailable"
  }
}
```

**Error Codes:**
- `SYSTEM_INTERNAL_ERROR`: Unexpected internal error
- `SYSTEM_DATABASE_UNAVAILABLE`: Database connection failed
- `SYSTEM_SERVICE_UNAVAILABLE`: External service unavailable
- `SYSTEM_MAINTENANCE_MODE`: System in maintenance mode
- `SYSTEM_RATE_LIMIT_EXCEEDED`: Rate limit exceeded

### Webhook Errors (WEBHOOK_xxx)
```json
{
  "error": {
    "code": "WEBHOOK_URL_UNREACHABLE",
    "message": "Cannot reach the specified webhook URL",
    "details": ["URL: https://example.com/webhook", "Connection timeout"]
  }
}
```

**Error Codes:**
- `WEBHOOK_URL_INVALID`: Webhook URL format invalid
- `WEBHOOK_URL_UNREACHABLE`: Cannot connect to webhook URL
- `WEBHOOK_DELIVERY_FAILED`: Webhook delivery failed
- `WEBHOOK_SIGNATURE_INVALID`: Webhook signature verification failed

## Error Handling Implementation

### 1. Global Error Handler
```typescript
interface ApiError extends Error {
  code: string;
  statusCode: number;
  details?: string[];
  fieldErrors?: Record<string, string[]>;
}

class ApiErrorHandler {
  static handle(error: ApiError, req: Request, res: Response) {
    const response = {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details && { details: error.details }),
        ...(error.fieldErrors && { field_errors: error.fieldErrors })
      },
      timestamp: new Date().toISOString(),
      request_id: req.id
    };

    // Log error for debugging
    console.error('API Error:', {
      error: error.code,
      message: error.message,
      stack: error.stack,
      requestId: req.id,
      userId: req.user?.id,
      endpoint: `${req.method} ${req.path}`
    });

    res.status(error.statusCode).json(response);
  }
}
```

### 2. Custom Error Classes
```typescript
class ValidationError extends ApiError {
  constructor(message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.code = 'VALIDATION_FAILED';
    this.statusCode = 422;
    this.fieldErrors = fieldErrors;
  }
}

class AuthenticationError extends ApiError {
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.statusCode = 401;
  }
}

class ResourceNotFoundError extends ApiError {
  constructor(resourceType: string, resourceId: string) {
    super(`${resourceType} not found`);
    this.code = 'RESOURCE_NOT_FOUND';
    this.statusCode = 404;
    this.details = [`${resourceType} ID: ${resourceId}`];
  }
}
```

### 3. Middleware Integration
```typescript
// Authentication middleware
const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      throw new AuthenticationError('AUTH_TOKEN_MISSING', 'Authentication token is required');
    }
    
    // Verify token...
    next();
  } catch (error) {
    ApiErrorHandler.handle(error, req, res);
  }
};

// Validation middleware
const validateRequest = (schema: Schema) => (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = schema.validate(req.body);
    if (result.error) {
      const fieldErrors = result.error.details.reduce((acc, detail) => {
        const field = detail.path.join('.');
        acc[field] = acc[field] || [];
        acc[field].push(detail.message);
        return acc;
      }, {});
      
      throw new ValidationError('Request validation failed', fieldErrors);
    }
    next();
  } catch (error) {
    ApiErrorHandler.handle(error, req, res);
  }
};
```

## Error Response Examples

### Authentication Error
```json
{
  "error": {
    "code": "AUTH_TOKEN_EXPIRED",
    "message": "Authentication token has expired"
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "request_id": "req_abc123def"
}
```

### Validation Error
```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request validation failed",
    "field_errors": {
      "file": ["File is required"],
      "source_language": ["Must be a valid ISO 639-1 language code"],
      "assessment_model": ["Must be one of: gpt-4, gpt-3.5-turbo, claude-3, gemini-pro"]
    }
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "request_id": "req_def456ghi"
}
```

### File Processing Error
```json
{
  "error": {
    "code": "FILE_XLIFF_INVALID",
    "message": "Invalid XLIFF file structure",
    "details": [
      "Missing required element: <file>",
      "Invalid target-language attribute",
      "Line 23: Unclosed <trans-unit> element"
    ]
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "request_id": "req_ghi789jkl"
}
```

### Rate Limit Error
```json
{
  "error": {
    "code": "SYSTEM_RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please try again later.",
    "details": [
      "Limit: 100 requests per hour",
      "Reset time: 2024-01-15T11:30:00Z"
    ]
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "request_id": "req_jkl012mno"
}
```

## Client-Side Error Handling Guidelines

### 1. Error Parsing
```typescript
interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: string[];
    field_errors?: Record<string, string[]>;
  };
  timestamp: string;
  request_id: string;
}

const handleApiError = (response: ApiErrorResponse) => {
  const { error } = response;
  
  switch (error.code) {
    case 'AUTH_TOKEN_EXPIRED':
      // Redirect to login
      break;
    case 'VALIDATION_FAILED':
      // Show field errors in form
      break;
    case 'RESOURCE_NOT_FOUND':
      // Show 404 page
      break;
    default:
      // Show generic error message
  }
};
```

### 2. Retry Logic
```typescript
const retryableErrors = [
  'SYSTEM_SERVICE_UNAVAILABLE',
  'SYSTEM_DATABASE_UNAVAILABLE',
  'ASSESSMENT_LLM_UNAVAILABLE'
];

const shouldRetry = (errorCode: string) => {
  return retryableErrors.includes(errorCode);
};
```

## Monitoring and Alerting

### Error Metrics
- Error rate by endpoint
- Error rate by error code
- Response time percentiles
- User-specific error patterns

### Alerting Thresholds
- Error rate > 5% for any endpoint
- Authentication errors > 10% of requests
- File processing failures > 2%
- LLM service unavailable for > 5 minutes

### Logging Strategy
```typescript
const logError = (error: ApiError, context: any) => {
  const logData = {
    timestamp: new Date().toISOString(),
    level: 'error',
    error_code: error.code,
    message: error.message,
    stack_trace: error.stack,
    request_id: context.requestId,
    user_id: context.userId,
    endpoint: context.endpoint,
    ip_address: context.ipAddress
  };
  
  // Send to logging service
  logger.error(logData);
  
  // Send to error tracking service (e.g., Sentry)
  if (error.statusCode >= 500) {
    errorTracker.captureException(error, context);
  }
};
```

This comprehensive error handling strategy ensures consistent, informative error responses while providing the necessary information for debugging and user guidance. 