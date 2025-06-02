# Security API Reference

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Common Response Formats](#common-response-formats)
4. [Vulnerability Scanning API](#vulnerability-scanning-api)
5. [Penetration Testing API](#penetration-testing-api)
6. [Security Dashboard API](#security-dashboard-api)
7. [Error Handling](#error-handling)
8. [Rate Limiting](#rate-limiting)
9. [Examples](#examples)

## Overview

The Security API provides programmatic access to the platform's security features, including vulnerability scanning, penetration testing, and security monitoring. All endpoints require authentication and are protected by rate limiting.

### Base URL
```
https://api.fluent-scribe.com/api/v1/security
```

### API Versioning
The API uses path-based versioning. The current version is `v1`.

### Content Type
All API requests and responses use JSON format:
```
Content-Type: application/json
```

## Authentication

All security API endpoints require authentication using one of the following methods:

### JWT Token Authentication
Include the JWT token in the Authorization header:
```http
Authorization: Bearer <jwt_token>
```

### API Key Authentication
Include the API key in the X-API-Key header:
```http
X-API-Key: <api_key>
```

### Authentication Requirements
- All endpoints require authentication
- API keys must have appropriate security permissions
- JWT tokens are validated for each request
- Rate limiting is applied per authenticated user

## Common Response Formats

### Success Response
```json
{
  "success": true,
  "data": { /* Response data */ },
  "message": "Operation completed successfully"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error description",
  "details": "Additional error details",
  "code": "ERROR_CODE"
}
```

### Pagination Format
```json
{
  "data": {
    "items": [ /* Array of items */ ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

## Vulnerability Scanning API

### Trigger Vulnerability Scan

**Endpoint:** `POST /scans`

**Description:** Initiate a new vulnerability scan with custom configuration.

**Request Body:**
```json
{
  "include_dependency_scan": true,
  "include_security_headers": true,
  "include_api_endpoints": true,
  "include_configuration": true,
  "include_code_patterns": true,
  "severity_threshold": "medium",
  "scan_depth": "standard",
  "exclude_patterns": ["test/*", "*.spec.js"]
}
```

**Request Schema:**
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `include_dependency_scan` | boolean | No | true | Scan dependencies for vulnerabilities |
| `include_security_headers` | boolean | No | true | Analyze HTTP security headers |
| `include_api_endpoints` | boolean | No | true | Test API endpoint security |
| `include_configuration` | boolean | No | true | Check security configurations |
| `include_code_patterns` | boolean | No | true | Analyze code for security patterns |
| `severity_threshold` | enum | No | "medium" | Minimum severity: "low", "medium", "high", "critical" |
| `scan_depth` | enum | No | "standard" | Scan depth: "surface", "standard", "deep" |
| `exclude_patterns` | array | No | [] | Patterns to exclude from scanning |

**Response:**
```json
{
  "success": true,
  "data": {
    "scan_id": "scan_123456789",
    "status": "completed",
    "start_time": "2024-12-02T10:00:00Z",
    "end_time": "2024-12-02T10:05:30Z",
    "summary": {
      "total_vulnerabilities": 12,
      "critical_count": 0,
      "high_count": 3,
      "medium_count": 6,
      "low_count": 3,
      "scan_duration_ms": 330000
    },
    "vulnerabilities": [
      {
        "id": "vuln_001",
        "type": "security_headers",
        "severity": "high",
        "title": "Missing Content Security Policy",
        "description": "The application lacks a Content Security Policy header",
        "affected_component": "HTTP Headers",
        "recommendation": "Implement a comprehensive CSP header",
        "cvss_score": 7.5,
        "cve_ids": [],
        "discovered_at": "2024-12-02T10:02:15Z"
      }
    ]
  },
  "message": "Vulnerability scan completed successfully"
}
```

**Example cURL:**
```bash
curl -X POST https://api.fluent-scribe.com/api/v1/security/scans \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "include_dependency_scan": true,
    "include_security_headers": true,
    "severity_threshold": "medium",
    "scan_depth": "deep"
  }'
```

### List Vulnerability Scans

**Endpoint:** `GET /scans`

**Description:** Retrieve a paginated list of vulnerability scans.

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | No | 1 | Page number for pagination |
| `limit` | integer | No | 20 | Number of items per page |
| `status` | string | No | all | Filter by scan status |
| `start_date` | string | No | - | Filter scans from this date (ISO 8601) |
| `end_date` | string | No | - | Filter scans until this date (ISO 8601) |

**Response:**
```json
{
  "success": true,
  "data": {
    "scans": [
      {
        "scan_id": "scan_123456789",
        "status": "completed",
        "start_time": "2024-12-02T10:00:00Z",
        "end_time": "2024-12-02T10:05:30Z",
        "total_vulnerabilities": 12,
        "critical_count": 0,
        "high_count": 3,
        "medium_count": 6,
        "low_count": 3
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  },
  "message": "Scans retrieved successfully"
}
```

### Get Scan Details

**Endpoint:** `GET /scans/{scanId}`

**Description:** Retrieve detailed information about a specific vulnerability scan.

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `scanId` | string | Yes | Unique scan identifier |

**Response:**
```json
{
  "success": true,
  "data": {
    "scan_id": "scan_123456789",
    "status": "completed",
    "configuration": {
      "include_dependency_scan": true,
      "include_security_headers": true,
      "severity_threshold": "medium",
      "scan_depth": "standard"
    },
    "start_time": "2024-12-02T10:00:00Z",
    "end_time": "2024-12-02T10:05:30Z",
    "summary": {
      "total_vulnerabilities": 12,
      "critical_count": 0,
      "high_count": 3,
      "medium_count": 6,
      "low_count": 3,
      "scan_duration_ms": 330000
    },
    "vulnerabilities": [ /* Full vulnerability details */ ],
    "scan_log": [ /* Scan execution log */ ]
  },
  "message": "Scan details retrieved successfully"
}
```

### List Vulnerabilities

**Endpoint:** `GET /vulnerabilities`

**Description:** Retrieve a filtered list of vulnerabilities across all scans.

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `severity` | string | No | all | Filter by severity level |
| `type` | string | No | all | Filter by vulnerability type |
| `status` | string | No | all | Filter by vulnerability status |
| `page` | integer | No | 1 | Page number for pagination |
| `limit` | integer | No | 20 | Number of items per page |

**Response:**
```json
{
  "success": true,
  "data": {
    "vulnerabilities": [
      {
        "id": "vuln_001",
        "scan_id": "scan_123456789",
        "type": "security_headers",
        "severity": "high",
        "status": "open",
        "title": "Missing Content Security Policy",
        "description": "The application lacks a Content Security Policy header",
        "affected_component": "HTTP Headers",
        "recommendation": "Implement a comprehensive CSP header",
        "cvss_score": 7.5,
        "cve_ids": [],
        "discovered_at": "2024-12-02T10:02:15Z",
        "updated_at": "2024-12-02T10:02:15Z"
      }
    ],
    "summary": {
      "total": 45,
      "critical": 2,
      "high": 8,
      "medium": 20,
      "low": 15,
      "open": 30,
      "fixed": 15
    },
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  },
  "message": "Vulnerabilities retrieved successfully"
}
```

### Update Vulnerability Status

**Endpoint:** `PATCH /vulnerabilities/{vulnId}/status`

**Description:** Update the status of a specific vulnerability.

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `vulnId` | string | Yes | Unique vulnerability identifier |

**Request Body:**
```json
{
  "status": "in_progress",
  "notes": "Working on implementing CSP header"
}
```

**Status Values:**
- `open` - Vulnerability is open and needs attention
- `acknowledged` - Vulnerability has been acknowledged
- `in_progress` - Remediation is in progress
- `fixed` - Vulnerability has been fixed
- `false_positive` - Vulnerability is a false positive
- `risk_accepted` - Risk has been accepted and won't be fixed

**Response:**
```json
{
  "success": true,
  "data": {
    "vulnerability_id": "vuln_001",
    "status": "in_progress",
    "updated_at": "2024-12-02T14:30:00Z"
  },
  "message": "Vulnerability status updated successfully"
}
```

## Penetration Testing API

### Trigger Penetration Test

**Endpoint:** `POST /pentests`

**Description:** Initiate a new penetration test with custom configuration.

**Request Body:**
```json
{
  "target_base_url": "https://api.fluent-scribe.com",
  "authentication_credentials": {
    "username": "test_user",
    "password": "test_password",
    "api_key": "optional_api_key"
  },
  "test_categories": {
    "authentication": true,
    "authorization": true,
    "injection": true,
    "session_management": true,
    "api_security": true,
    "file_upload": true,
    "rate_limiting": true,
    "business_logic": true
  },
  "test_depth": "active",
  "max_test_duration_minutes": 30,
  "include_complexity_analysis": true,
  "safe_mode": true,
  "exclude_endpoints": ["/admin/*"],
  "custom_payloads": {
    "sql_injection": ["' OR 1=1--", "'; DROP TABLE users;--"]
  }
}
```

**Request Schema:**
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `target_base_url` | string (URL) | No | "http://localhost:3000" | Base URL for testing |
| `authentication_credentials` | object | No | - | Credentials for authenticated tests |
| `test_categories` | object | No | all true | Categories of tests to run |
| `test_depth` | enum | No | "active" | Test depth: "passive", "active", "aggressive" |
| `max_test_duration_minutes` | integer | No | 30 | Maximum test duration (5-120 minutes) |
| `include_complexity_analysis` | boolean | No | true | Include complexity analysis |
| `safe_mode` | boolean | No | true | Enable safe mode (prevents destructive tests) |
| `exclude_endpoints` | array | No | [] | Endpoints to exclude from testing |
| `custom_payloads` | object | No | {} | Custom test payloads |

**Response:**
```json
{
  "success": true,
  "data": {
    "test_id": "pentest_987654321",
    "status": "completed",
    "start_time": "2024-12-02T11:00:00Z",
    "end_time": "2024-12-02T11:25:45Z",
    "summary": {
      "total_tests": 156,
      "passed_tests": 142,
      "failed_tests": 14,
      "critical_findings": 1,
      "high_findings": 4,
      "medium_findings": 6,
      "low_findings": 3,
      "test_duration_ms": 1545000
    },
    "findings": [
      {
        "id": "finding_001",
        "category": "injection",
        "severity": "high",
        "title": "SQL Injection Vulnerability",
        "description": "Endpoint vulnerable to SQL injection attacks",
        "affected_endpoint": "/api/v1/users/search",
        "payload_used": "' OR 1=1--",
        "recommendation": "Use parameterized queries",
        "cvss_score": 8.2,
        "discovered_at": "2024-12-02T11:15:30Z"
      }
    ],
    "complexity_analysis": {
      "overall_score": 7.5,
      "authentication_complexity": 8.2,
      "authorization_complexity": 7.1,
      "session_complexity": 6.8
    }
  },
  "message": "Penetration test completed successfully"
}
```

### Quick Penetration Test

**Endpoint:** `POST /pentests/quick`

**Description:** Run a quick penetration test with safe default settings.

**Request Body:**
```json
{
  "target_base_url": "https://api.fluent-scribe.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "test_id": "pentest_quick_123",
    "status": "completed",
    "summary": {
      "total_tests": 50,
      "passed_tests": 47,
      "failed_tests": 3,
      "critical_findings": 0,
      "high_findings": 1,
      "medium_findings": 2,
      "low_findings": 0,
      "test_duration_ms": 300000
    }
  },
  "message": "Quick penetration test completed successfully"
}
```

### List Penetration Tests

**Endpoint:** `GET /pentests`

**Description:** Retrieve a paginated list of penetration tests.

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | No | 1 | Page number for pagination |
| `limit` | integer | No | 20 | Number of items per page |
| `status` | string | No | all | Filter by test status |

**Response:**
```json
{
  "success": true,
  "data": {
    "pentests": [
      {
        "test_id": "pentest_987654321",
        "status": "completed",
        "start_time": "2024-12-02T11:00:00Z",
        "end_time": "2024-12-02T11:25:45Z",
        "total_tests": 156,
        "critical_findings": 1,
        "high_findings": 4,
        "medium_findings": 6,
        "low_findings": 3
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 23,
      "totalPages": 2
    }
  },
  "message": "Penetration tests retrieved successfully"
}
```

### Get Penetration Test Details

**Endpoint:** `GET /pentests/{testId}`

**Description:** Retrieve detailed information about a specific penetration test.

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `testId` | string | Yes | Unique test identifier |

**Response:**
```json
{
  "success": true,
  "data": {
    "test_id": "pentest_987654321",
    "status": "completed",
    "configuration": {
      "target_base_url": "https://api.fluent-scribe.com",
      "test_depth": "active",
      "safe_mode": true
    },
    "start_time": "2024-12-02T11:00:00Z",
    "end_time": "2024-12-02T11:25:45Z",
    "summary": { /* Full summary */ },
    "findings": [ /* All findings */ ],
    "test_log": [ /* Test execution log */ ],
    "complexity_analysis": { /* Complexity analysis results */ }
  },
  "message": "Penetration test details retrieved successfully"
}
```

## Security Dashboard API

### Get Security Dashboard

**Endpoint:** `GET /dashboard`

**Description:** Retrieve aggregated security dashboard data.

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_vulnerabilities": 45,
      "critical_count": 2,
      "high_count": 8,
      "medium_count": 20,
      "low_count": 15,
      "fixed_this_month": 12,
      "avg_resolution_time": 5.2
    },
    "recent_scans": [
      {
        "scan_id": "scan_123456789",
        "type": "vulnerability_scan",
        "status": "completed",
        "start_time": "2024-12-02T10:00:00Z",
        "vulnerabilities_found": 12
      }
    ],
    "trending": {
      "vulnerability_types": [
        {"type": "security_headers", "count": 15},
        {"type": "injection", "count": 12},
        {"type": "authentication", "count": 8}
      ],
      "severity_distribution": [
        {"severity": "critical", "count": 2, "percentage": 4.4},
        {"severity": "high", "count": 8, "percentage": 17.8},
        {"severity": "medium", "count": 20, "percentage": 44.4},
        {"severity": "low", "count": 15, "percentage": 33.4}
      ],
      "resolution_trends": [
        {"month": "2024-11", "fixed": 18, "opened": 22},
        {"month": "2024-12", "fixed": 12, "opened": 8}
      ]
    },
    "top_vulnerabilities": [
      {
        "type": "sql_injection",
        "count": 5,
        "avg_severity": "high",
        "trend": "decreasing"
      }
    ],
    "security_score": 85,
    "last_updated": "2024-12-02T15:30:00Z"
  },
  "message": "Dashboard data retrieved successfully"
}
```

### Test Security Endpoint

**Endpoint:** `POST /test`

**Description:** Test endpoint for basic security functionality verification.

**Response:**
```json
{
  "success": true,
  "data": {
    "scan_id": "test_scan_001",
    "status": "completed",
    "vulnerabilities_found": 3,
    "scan_duration": 15000,
    "summary": {
      "total_vulnerabilities": 3,
      "critical_count": 0,
      "high_count": 1,
      "medium_count": 2,
      "low_count": 0
    }
  },
  "message": "Test scan completed successfully"
}
```

## Error Handling

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 429 | Too Many Requests |
| 500 | Internal Server Error |

### Error Response Format

```json
{
  "success": false,
  "error": "Human-readable error message",
  "details": "Technical error details",
  "code": "ERROR_CODE",
  "timestamp": "2024-12-02T15:30:00Z",
  "request_id": "req_123456789"
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `INVALID_REQUEST` | Request validation failed |
| `UNAUTHORIZED` | Authentication required |
| `FORBIDDEN` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `RATE_LIMITED` | Rate limit exceeded |
| `SCAN_FAILED` | Vulnerability scan failed |
| `TEST_FAILED` | Penetration test failed |
| `INTERNAL_ERROR` | Internal server error |

## Rate Limiting

### Rate Limits

| Endpoint Category | Limit | Window |
|------------------|-------|--------|
| Vulnerability Scans | 10 requests | 1 hour |
| Penetration Tests | 5 requests | 1 hour |
| Dashboard/List APIs | 100 requests | 15 minutes |
| Status Updates | 50 requests | 15 minutes |

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1638360000
```

### Rate Limit Exceeded Response

```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "code": "RATE_LIMITED",
  "retry_after": 900
}
```

## Examples

### Complete Vulnerability Scan Workflow

```bash
# 1. Trigger a vulnerability scan
curl -X POST https://api.fluent-scribe.com/api/v1/security/scans \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "include_dependency_scan": true,
    "include_security_headers": true,
    "severity_threshold": "high",
    "scan_depth": "deep"
  }'

# 2. Get scan details
SCAN_ID="scan_123456789"
curl -X GET https://api.fluent-scribe.com/api/v1/security/scans/$SCAN_ID \
  -H "Authorization: Bearer $JWT_TOKEN"

# 3. Update vulnerability status
VULN_ID="vuln_001"
curl -X PATCH https://api.fluent-scribe.com/api/v1/security/vulnerabilities/$VULN_ID/status \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_progress",
    "notes": "Working on implementing fix"
  }'
```

### Penetration Testing Workflow

```bash
# 1. Run a quick penetration test
curl -X POST https://api.fluent-scribe.com/api/v1/security/pentests/quick \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "target_base_url": "https://staging.fluent-scribe.com"
  }'

# 2. Run a comprehensive penetration test
curl -X POST https://api.fluent-scribe.com/api/v1/security/pentests \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "target_base_url": "https://staging.fluent-scribe.com",
    "test_categories": {
      "authentication": true,
      "authorization": true,
      "injection": true
    },
    "test_depth": "active",
    "safe_mode": true
  }'
```

### Dashboard Monitoring

```bash
# Get security dashboard overview
curl -X GET https://api.fluent-scribe.com/api/v1/security/dashboard \
  -H "Authorization: Bearer $JWT_TOKEN"

# List recent vulnerabilities
curl -X GET "https://api.fluent-scribe.com/api/v1/security/vulnerabilities?severity=high&status=open&limit=10" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

**Document Version**: 1.0  
**Last Updated**: December 2024  
**Next Review**: March 2025 