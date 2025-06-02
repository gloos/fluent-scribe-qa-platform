# API Versioning Strategy

This document outlines the versioning strategy for the AI-Powered Linguistic QA Platform API, including policies for deprecation, migration paths, and backward compatibility.

## Versioning Approach

### URI-Based Versioning

We use URI-based versioning with semantic version numbers:

- **Format**: `/api/v{major}` (e.g., `/api/v1`, `/api/v2`)
- **Version Format**: Semantic versioning (`major.minor.patch`)
- **URL Structure**: Only major version in URL, full version in response headers

### Examples

```http
GET /api/v1/health
GET /api/v1/files
POST /api/v2/assessments
```

## Version Lifecycle

### Support Phases

1. **Development**: Version is in active development
2. **Supported**: Version is stable and fully supported
3. **Deprecated**: Version is marked for future removal with migration guidance
4. **Sunset**: Version is no longer available

### Deprecation Policy

- **Warning Period**: 90 days advance notice before deprecation
- **Grace Period**: 365 days between deprecation and sunset
- **Minimum Support**: 2 years minimum support for major versions

### Timeline Example

```
Release -> 90 days -> Deprecation Warning -> 365 days -> Sunset
```

## Version Headers

All API responses include version information in headers:

```http
X-API-Version: 1.0.0
X-API-Latest-Version: 1.0.0
X-API-Deprecated: true (if deprecated)
X-API-Deprecation-Date: 2024-06-01T00:00:00Z (if deprecated)
X-API-Sunset-Date: 2025-06-01T00:00:00Z (if deprecated)
X-API-Migration-Guide: https://docs.qa-platform.com/migration/v1-to-v2
```

## Current Version Status

### Supported Versions

- **v1.0.0**: Current stable version (supported)

### Planned Versions

- **v2.0.0**: Planned for March 2025
  - Restructured authentication flow
  - New batch processing endpoints
  - Enhanced error response format
  - Improved rate limiting granularity

## Version Detection

The API automatically detects the version from the URL path:

1. **Explicit Version**: `/api/v1/endpoint` → Uses v1.x.x
2. **No Version**: `/api/endpoint` → Uses default version (1.0.0)
3. **Invalid Version**: Returns 400 error with supported versions

## Backward Compatibility

### Breaking Changes

Breaking changes are only introduced in major versions:

- Changes to response structure
- Removal of endpoints or parameters
- Changes to authentication methods
- Behavioral changes that affect existing functionality

### Non-Breaking Changes

These can be introduced in minor/patch versions:

- Addition of new endpoints
- Addition of optional parameters
- Addition of response fields
- Bug fixes and performance improvements

## Migration Guidance

### Version Information Endpoint

Get comprehensive version information:

```http
GET /api/v1/version
```

Response includes:
- Current version details
- Supported versions and their status
- Planned future versions
- Available migration paths
- Deprecation policies

### Migration Process

1. **Check Current Version**: Use `/version` endpoint
2. **Review Migration Guide**: Follow provided documentation
3. **Test New Version**: Use staging environment
4. **Update Client Code**: Implement required changes
5. **Deploy**: Switch to new version
6. **Monitor**: Watch for any issues

### Version Guards

Use version guards for endpoints with specific version requirements:

```typescript
app.get('/api/v1/new-feature',
  ApiVersionMiddleware.versionGuard('1.2.0'), // Minimum version
  handler
);

app.get('/api/v1/legacy-feature',
  ApiVersionMiddleware.versionGuard('1.0.0', '1.9.9'), // Min and max
  handler
);
```

## Error Handling

### Unsupported Version

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "Unsupported API version",
  "message": "API version v3.0.0 is not supported",
  "supportedVersions": ["1.0.0", "2.0.0"],
  "latestVersion": "2.0.0"
}
```

### Version Too Old

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "API version too old",
  "message": "This endpoint requires API version 1.2.0 or higher",
  "currentVersion": "1.0.0",
  "requiredVersion": "1.2.0"
}
```

## Best Practices

### For API Consumers

1. **Always specify version** in your API calls
2. **Monitor deprecation headers** in responses
3. **Subscribe to API announcements** for version updates
4. **Test against new versions** before they become default
5. **Plan migration time** well before sunset dates

### For API Developers

1. **Follow semantic versioning** strictly
2. **Provide migration guides** for breaking changes
3. **Maintain backward compatibility** within major versions
4. **Give adequate notice** for deprecations
5. **Support multiple versions** during transition periods

## Configuration

The versioning system is configured in:

- `src/lib/middleware/apiVersionMiddleware.ts` - Version detection and validation
- `src/lib/config/apiVersionConfig.ts` - Version configuration and policies
- `docs/api-specification.yaml` - OpenAPI specification with version info

## Monitoring

Version usage is tracked through:

- Response headers on all API calls
- Analytics on version endpoint usage
- Deprecation warning tracking
- Migration completion metrics

## Support

For questions about API versioning:

- Check the `/version` endpoint for current information
- Review migration guides in documentation
- Contact support: support@qa-platform.com
- GitHub Issues: For technical problems or suggestions 