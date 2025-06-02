# API Version Migration Guide

This guide provides comprehensive examples for migrating between API versions of the Translation QA Platform, including backward compatibility strategies, phased migration approaches, and version detection patterns.

## Migration Overview

The Translation QA Platform API follows semantic versioning with the following version structure:
- `/v1` - Current stable version
- `/v2` - Next major version (when available)
- `/v1.1`, `/v1.2` - Minor version updates (backward compatible)

## Version Detection and Compatibility

### 1. Version Detection Client

```javascript
class VersionCompatibilityClient {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.supportedVersions = new Set();
    this.currentVersion = null;
    this.deprecationWarnings = new Map();
  }

  // Detect available API versions
  async detectAvailableVersions() {
    try {
      const response = await fetch(`${this.baseUrl}/versions`, {
        headers: {
          'X-API-Key': this.apiKey
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch version information');
      }

      const versionInfo = await response.json();
      
      this.supportedVersions = new Set(versionInfo.supported_versions);
      this.currentVersion = versionInfo.current_version;
      
      // Check for deprecation warnings
      if (versionInfo.deprecated_versions) {
        versionInfo.deprecated_versions.forEach(version => {
          this.deprecationWarnings.set(version.version, {
            deprecatedAt: version.deprecated_at,
            retirementDate: version.retirement_date,
            migrationGuide: version.migration_guide_url
          });
        });
      }

      return versionInfo;
      
    } catch (error) {
      console.error('Version detection failed:', error);
      throw error;
    }
  }

  // Check if a specific version is supported
  isVersionSupported(version) {
    return this.supportedVersions.has(version);
  }

  // Get deprecation info for a version
  getDeprecationInfo(version) {
    return this.deprecationWarnings.get(version);
  }

  // Get optimal version to use
  getOptimalVersion(requiredFeatures = []) {
    // Simple version selection logic - in production, this would be more sophisticated
    const versions = Array.from(this.supportedVersions).sort().reverse();
    
    for (const version of versions) {
      const deprecationInfo = this.getDeprecationInfo(version);
      
      // Skip deprecated versions if there's a newer alternative
      if (deprecationInfo && versions.length > 1) {
        continue;
      }
      
      return version;
    }
    
    return this.currentVersion;
  }
}

// Usage example
async function versionDetectionExample() {
  const client = new VersionCompatibilityClient('https://api.qa-platform.com', 'your-api-key');
  
  const versionInfo = await client.detectAvailableVersions();
  console.log('Available versions:', versionInfo.supported_versions);
  console.log('Current version:', versionInfo.current_version);
  
  if (client.deprecationWarnings.size > 0) {
    console.warn('Deprecated versions detected:');
    for (const [version, info] of client.deprecationWarnings) {
      console.warn(`- v${version}: deprecated ${info.deprecatedAt}, retires ${info.retirementDate}`);
    }
  }
  
  const optimalVersion = client.getOptimalVersion();
  console.log('Recommended version to use:', optimalVersion);
}
```

### 2. Multi-Version API Client

```javascript
class MultiVersionAPIClient {
  constructor(baseUrl, apiKey, preferredVersion = 'v1') {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.preferredVersion = preferredVersion;
    this.versionClient = new VersionCompatibilityClient(baseUrl, apiKey);
    this.endpointMappings = new Map();
    
    this.initializeEndpointMappings();
  }

  initializeEndpointMappings() {
    // Define how endpoints differ between versions
    this.endpointMappings.set('v1', {
      uploadFile: '/files',
      getFiles: '/files',
      createAssessment: '/assessments',
      getAssessment: '/assessments/{id}',
      downloadReport: '/assessments/{id}/report'
    });

    this.endpointMappings.set('v2', {
      uploadFile: '/documents/upload',
      getFiles: '/documents',
      createAssessment: '/quality-assessments',
      getAssessment: '/quality-assessments/{id}',
      downloadReport: '/quality-assessments/{id}/reports/download'
    });
  }

  // Get endpoint for specific version
  getEndpoint(operation, version = null, params = {}) {
    const targetVersion = version || this.preferredVersion;
    const versionMappings = this.endpointMappings.get(targetVersion);
    
    if (!versionMappings || !versionMappings[operation]) {
      throw new Error(`Operation ${operation} not supported in version ${targetVersion}`);
    }

    let endpoint = versionMappings[operation];
    
    // Replace path parameters
    Object.entries(params).forEach(([key, value]) => {
      endpoint = endpoint.replace(`{${key}}`, value);
    });

    return endpoint;
  }

  // Make request with version fallback
  async requestWithFallback(operation, options = {}, params = {}) {
    const versions = [this.preferredVersion];
    
    // Add fallback versions
    if (this.preferredVersion === 'v2') {
      versions.push('v1');
    }

    let lastError;

    for (const version of versions) {
      try {
        const endpoint = this.getEndpoint(operation, version, params);
        const url = `${this.baseUrl}/${version}${endpoint}`;
        
        const response = await fetch(url, {
          headers: {
            'X-API-Key': this.apiKey,
            'Content-Type': 'application/json',
            ...options.headers
          },
          ...options
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`API ${version} ${operation} failed: ${errorData.error?.message}`);
        }

        const result = await response.json();
        
        // Log version used for monitoring
        console.log(`Request successful using API version ${version}`);
        
        return this.normalizeResponse(result, version, operation);
        
      } catch (error) {
        console.warn(`API ${version} ${operation} failed:`, error.message);
        lastError = error;
        
        // If this was the last version to try, throw the error
        if (version === versions[versions.length - 1]) {
          throw lastError;
        }
      }
    }
  }

  // Normalize responses between versions
  normalizeResponse(response, version, operation) {
    switch (operation) {
      case 'uploadFile':
        return {
          fileId: response.file_id || response.document_id,
          status: response.processing_status || response.status,
          createdAt: response.created_at || response.upload_time,
          version: version
        };
        
      case 'createAssessment':
        return {
          assessmentId: response.assessment_id || response.qa_id,
          status: response.status || response.state,
          createdAt: response.created_at || response.initiated_at,
          version: version
        };
        
      default:
        return { ...response, version };
    }
  }

  // Upload file with version compatibility
  async uploadFile(file, options = {}) {
    return this.requestWithFallback('uploadFile', {
      method: 'POST',
      body: this.createFormData(file, options)
    });
  }

  // Create assessment with version compatibility
  async createAssessment(fileId, config = {}) {
    const requestBody = this.normalizeAssessmentConfig(config, this.preferredVersion);
    
    return this.requestWithFallback('createAssessment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
  }

  normalizeAssessmentConfig(config, version) {
    if (version === 'v2') {
      // v2 uses different field names
      return {
        document_id: config.file_id,
        ai_model: config.assessment_model,
        quality_metrics: config.quality_dimensions,
        include_recommendations: config.include_suggestions,
        priority_level: config.priority
      };
    } else {
      // v1 format
      return config;
    }
  }

  createFormData(file, options) {
    const formData = new FormData();
    formData.append('file', file);
    
    Object.entries(options).forEach(([key, value]) => {
      formData.append(key, value);
    });
    
    return formData;
  }
}
```

## Phased Migration Strategies

### 1. Gradual Migration Pattern

```javascript
class GradualMigrationManager {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.migrationPhases = new Map();
    this.featureFlags = new Map();
    this.migrationLog = [];
  }

  // Define migration phases
  setupMigrationPhases() {
    this.migrationPhases.set('phase1', {
      description: 'Migrate file operations to v2',
      operations: ['uploadFile', 'getFiles'],
      targetVersion: 'v2',
      rolloutPercentage: 10,
      successThreshold: 95
    });

    this.migrationPhases.set('phase2', {
      description: 'Migrate assessment operations to v2',
      operations: ['createAssessment', 'getAssessment'],
      targetVersion: 'v2',
      rolloutPercentage: 25,
      successThreshold: 95
    });

    this.migrationPhases.set('phase3', {
      description: 'Complete migration to v2',
      operations: ['*'],
      targetVersion: 'v2',
      rolloutPercentage: 100,
      successThreshold: 98
    });
  }

  // Check if operation should use new version
  shouldUseNewVersion(operation, currentPhase = 'phase1') {
    const phase = this.migrationPhases.get(currentPhase);
    if (!phase) return false;

    // Check if operation is in current phase
    if (phase.operations.includes('*') || phase.operations.includes(operation)) {
      // Use rollout percentage to determine if this request should use new version
      return Math.random() * 100 < phase.rolloutPercentage;
    }

    return false;
  }

  // Execute request with migration logic
  async executeWithMigration(operation, requestFn, currentPhase = 'phase1') {
    const useNewVersion = this.shouldUseNewVersion(operation, currentPhase);
    const startTime = Date.now();
    
    try {
      const result = await requestFn(useNewVersion ? 'v2' : 'v1');
      
      this.logMigrationResult(operation, useNewVersion ? 'v2' : 'v1', true, Date.now() - startTime);
      return result;
      
    } catch (error) {
      this.logMigrationResult(operation, useNewVersion ? 'v2' : 'v1', false, Date.now() - startTime, error.message);
      
      // Fallback to v1 if v2 fails
      if (useNewVersion) {
        console.warn(`v2 ${operation} failed, falling back to v1:`, error.message);
        const fallbackResult = await requestFn('v1');
        this.logMigrationResult(operation, 'v1', true, Date.now() - startTime, 'fallback_success');
        return fallbackResult;
      }
      
      throw error;
    }
  }

  logMigrationResult(operation, version, success, duration, error = null) {
    this.migrationLog.push({
      timestamp: new Date().toISOString(),
      operation,
      version,
      success,
      duration,
      error
    });
  }

  // Analyze migration success rate
  analyzeMigrationMetrics(operation = null, timeWindow = 3600000) { // 1 hour default
    const cutoffTime = new Date(Date.now() - timeWindow);
    
    const relevantLogs = this.migrationLog.filter(log => {
      const logTime = new Date(log.timestamp);
      return logTime >= cutoffTime && (!operation || log.operation === operation);
    });

    const v2Logs = relevantLogs.filter(log => log.version === 'v2');
    const v2SuccessRate = v2Logs.length > 0 ? 
      (v2Logs.filter(log => log.success).length / v2Logs.length) * 100 : 0;

    const avgDurationV1 = this.calculateAverageDuration(relevantLogs.filter(log => log.version === 'v1' && log.success));
    const avgDurationV2 = this.calculateAverageDuration(v2Logs.filter(log => log.success));

    return {
      totalRequests: relevantLogs.length,
      v2Requests: v2Logs.length,
      v2SuccessRate,
      avgDurationV1,
      avgDurationV2,
      performanceImprovement: avgDurationV1 > 0 ? 
        ((avgDurationV1 - avgDurationV2) / avgDurationV1) * 100 : 0
    };
  }

  calculateAverageDuration(logs) {
    if (logs.length === 0) return 0;
    return logs.reduce((sum, log) => sum + log.duration, 0) / logs.length;
  }
}

// Usage example
async function gradualMigrationExample() {
  const migrationManager = new GradualMigrationManager('https://api.qa-platform.com', 'your-api-key');
  migrationManager.setupMigrationPhases();

  const apiClient = new MultiVersionAPIClient('https://api.qa-platform.com', 'your-api-key');

  // Upload file with migration logic
  const uploadResult = await migrationManager.executeWithMigration(
    'uploadFile',
    async (version) => {
      console.log(`Uploading with version ${version}`);
      return apiClient.requestWithFallback('uploadFile', {
        method: 'POST',
        body: new FormData() // simplified for example
      });
    },
    'phase1'
  );

  console.log('Upload result:', uploadResult);

  // Analyze migration metrics
  const metrics = migrationManager.analyzeMigrationMetrics('uploadFile');
  console.log('Migration metrics:', metrics);
}
```

### 2. Feature Flag Migration

```javascript
class FeatureFlagMigration {
  constructor(baseUrl, apiKey, flagService) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.flagService = flagService; // External feature flag service
    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
  }

  // Check feature flag with caching
  async isFeatureEnabled(flagName, userId = 'default') {
    const cacheKey = `${flagName}:${userId}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.enabled;
    }

    try {
      const enabled = await this.flagService.isEnabled(flagName, userId);
      this.cache.set(cacheKey, { enabled, timestamp: Date.now() });
      return enabled;
    } catch (error) {
      console.warn(`Feature flag check failed for ${flagName}:`, error.message);
      // Return cached value if available, otherwise default to false
      return cached ? cached.enabled : false;
    }
  }

  // Execute with feature flag
  async executeWithFlag(flagName, newVersionFn, oldVersionFn, userId = 'default') {
    const useNewVersion = await this.isFeatureEnabled(flagName, userId);
    
    try {
      if (useNewVersion) {
        console.log(`Using new version for flag: ${flagName}`);
        return await newVersionFn();
      } else {
        console.log(`Using old version for flag: ${flagName}`);
        return await oldVersionFn();
      }
    } catch (error) {
      // If new version fails and we were using it, fallback to old version
      if (useNewVersion) {
        console.warn(`New version failed for ${flagName}, falling back:`, error.message);
        return await oldVersionFn();
      }
      throw error;
    }
  }

  // Gradually roll out feature
  async gradualRollout(flagName, percentage, userId = 'default') {
    // Simple hash-based percentage rollout
    const hash = this.hashUserId(userId);
    const userPercentage = (hash % 100) + 1;
    
    return userPercentage <= percentage;
  }

  hashUserId(userId) {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

// Mock feature flag service
class MockFeatureFlagService {
  constructor() {
    this.flags = new Map();
  }

  setFlag(name, enabled, percentage = 100) {
    this.flags.set(name, { enabled, percentage });
  }

  async isEnabled(flagName, userId) {
    const flag = this.flags.get(flagName);
    if (!flag) return false;

    if (!flag.enabled) return false;

    // Percentage-based rollout
    const hash = this.hashUserId(userId);
    const userPercentage = (hash % 100) + 1;
    return userPercentage <= flag.percentage;
  }

  hashUserId(userId) {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}

// Usage example
async function featureFlagMigrationExample() {
  const flagService = new MockFeatureFlagService();
  flagService.setFlag('use_v2_upload', true, 25); // 25% rollout
  flagService.setFlag('use_v2_assessment', true, 10); // 10% rollout

  const migration = new FeatureFlagMigration('https://api.qa-platform.com', 'your-api-key', flagService);
  const apiClient = new MultiVersionAPIClient('https://api.qa-platform.com', 'your-api-key');

  // Upload with feature flag
  const uploadResult = await migration.executeWithFlag(
    'use_v2_upload',
    async () => {
      // v2 upload logic
      return apiClient.requestWithFallback('uploadFile', { method: 'POST' });
    },
    async () => {
      // v1 upload logic
      return apiClient.request('/v1/files', { method: 'POST' });
    },
    'user123'
  );

  console.log('Upload result:', uploadResult);
}
```

## Backward Compatibility Handling

### 1. Response Transformation

```javascript
class BackwardCompatibilityLayer {
  constructor() {
    this.transformers = new Map();
    this.setupTransformers();
  }

  setupTransformers() {
    // Transform v2 file response to v1 format
    this.transformers.set('file:v2->v1', (v2Response) => ({
      file_id: v2Response.document_id,
      processing_status: v2Response.status,
      created_at: v2Response.upload_time,
      file_name: v2Response.name,
      file_size: v2Response.size,
      source_language: v2Response.source_lang,
      target_language: v2Response.target_lang
    }));

    // Transform v2 assessment response to v1 format
    this.transformers.set('assessment:v2->v1', (v2Response) => ({
      assessment_id: v2Response.qa_id,
      status: v2Response.state,
      created_at: v2Response.initiated_at,
      completed_at: v2Response.finished_at,
      results: {
        overall_score: v2Response.quality_metrics?.overall_score,
        dimensions: v2Response.quality_metrics?.dimension_scores || {},
        suggestions: v2Response.recommendations || []
      }
    }));

    // Transform v1 request to v2 format
    this.transformers.set('assessment_request:v1->v2', (v1Request) => ({
      document_id: v1Request.file_id,
      ai_model: v1Request.assessment_model,
      quality_metrics: v1Request.quality_dimensions,
      include_recommendations: v1Request.include_suggestions,
      priority_level: v1Request.priority || 'normal'
    }));
  }

  transform(data, transformKey) {
    const transformer = this.transformers.get(transformKey);
    if (!transformer) {
      throw new Error(`No transformer found for key: ${transformKey}`);
    }
    return transformer(data);
  }

  // Auto-detect and transform responses
  autoTransform(response, sourceVersion, targetVersion, resourceType) {
    const transformKey = `${resourceType}:${sourceVersion}->${targetVersion}`;
    
    if (this.transformers.has(transformKey)) {
      return this.transform(response, transformKey);
    }
    
    // No transformation needed
    return response;
  }
}

// Enhanced API client with compatibility layer
class CompatibleAPIClient extends MultiVersionAPIClient {
  constructor(baseUrl, apiKey, preferredVersion = 'v1') {
    super(baseUrl, apiKey, preferredVersion);
    this.compatibilityLayer = new BackwardCompatibilityLayer();
  }

  async uploadFileCompatible(file, options = {}) {
    const result = await this.uploadFile(file, options);
    
    // If we used v2 but client expects v1 format, transform
    if (result.version === 'v2' && this.preferredVersion === 'v1') {
      return this.compatibilityLayer.autoTransform(result, 'v2', 'v1', 'file');
    }
    
    return result;
  }

  async createAssessmentCompatible(fileId, config = {}) {
    // Transform v1 request to v2 if needed
    let transformedConfig = config;
    if (this.preferredVersion === 'v2') {
      transformedConfig = this.compatibilityLayer.autoTransform(config, 'v1', 'v2', 'assessment_request');
    }
    
    const result = await this.createAssessment(fileId, transformedConfig);
    
    // Transform response if needed
    if (result.version === 'v2' && this.preferredVersion === 'v1') {
      return this.compatibilityLayer.autoTransform(result, 'v2', 'v1', 'assessment');
    }
    
    return result;
  }
}
```

## Migration Testing and Validation

### 1. Migration Test Suite

```javascript
class MigrationTestSuite {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.testResults = [];
  }

  async runMigrationTests() {
    console.log('Running migration test suite...');
    
    await this.testVersionDetection();
    await this.testBackwardCompatibility();
    await this.testFallbackMechanism();
    await this.testResponseTransformation();
    await this.testPerformanceComparison();
    
    this.printTestResults();
    return this.testResults;
  }

  async testVersionDetection() {
    try {
      const versionClient = new VersionCompatibilityClient(this.baseUrl, this.apiKey);
      const versionInfo = await versionClient.detectAvailableVersions();
      
      this.addTestResult('Version Detection', 
        versionInfo.supported_versions?.length > 0 ? 'PASS' : 'FAIL');
        
    } catch (error) {
      this.addTestResult('Version Detection', `FAIL: ${error.message}`);
    }
  }

  async testBackwardCompatibility() {
    try {
      const client = new CompatibleAPIClient(this.baseUrl, this.apiKey, 'v1');
      
      // Test file upload with v1 client expecting v1 response format
      const testFile = new Blob(['test content'], { type: 'text/plain' });
      const result = await client.uploadFileCompatible(testFile, {
        source_language: 'en',
        target_language: 'fr'
      });
      
      // Verify v1 format fields are present
      const hasV1Fields = result.file_id && result.processing_status && result.created_at;
      this.addTestResult('Backward Compatibility', hasV1Fields ? 'PASS' : 'FAIL');
      
    } catch (error) {
      this.addTestResult('Backward Compatibility', `FAIL: ${error.message}`);
    }
  }

  async testFallbackMechanism() {
    try {
      const client = new MultiVersionAPIClient(this.baseUrl, this.apiKey, 'v2');
      
      // This should attempt v2 first, then fallback to v1 if v2 fails
      const result = await client.requestWithFallback('uploadFile', {
        method: 'POST',
        body: new FormData()
      });
      
      this.addTestResult('Fallback Mechanism', result ? 'PASS' : 'FAIL');
      
    } catch (error) {
      this.addTestResult('Fallback Mechanism', `FAIL: ${error.message}`);
    }
  }

  async testResponseTransformation() {
    try {
      const compatibilityLayer = new BackwardCompatibilityLayer();
      
      // Test v2 to v1 transformation
      const v2Response = {
        document_id: 'doc-123',
        status: 'completed',
        upload_time: '2024-01-15T10:30:00Z',
        name: 'test.xliff'
      };
      
      const v1Response = compatibilityLayer.transform(v2Response, 'file:v2->v1');
      
      const isValid = v1Response.file_id === 'doc-123' && 
                     v1Response.processing_status === 'completed' &&
                     v1Response.created_at === '2024-01-15T10:30:00Z';
      
      this.addTestResult('Response Transformation', isValid ? 'PASS' : 'FAIL');
      
    } catch (error) {
      this.addTestResult('Response Transformation', `FAIL: ${error.message}`);
    }
  }

  async testPerformanceComparison() {
    try {
      const client = new MultiVersionAPIClient(this.baseUrl, this.apiKey);
      
      // Test v1 performance
      const v1Start = Date.now();
      await client.requestWithFallback('getFiles', { method: 'GET' });
      const v1Duration = Date.now() - v1Start;
      
      // Test v2 performance (if available)
      client.preferredVersion = 'v2';
      const v2Start = Date.now();
      await client.requestWithFallback('getFiles', { method: 'GET' });
      const v2Duration = Date.now() - v2Start;
      
      const performanceResult = {
        v1Duration,
        v2Duration,
        improvement: ((v1Duration - v2Duration) / v1Duration) * 100
      };
      
      this.addTestResult('Performance Comparison', 
        `PASS: v1=${v1Duration}ms, v2=${v2Duration}ms, improvement=${performanceResult.improvement.toFixed(1)}%`);
      
    } catch (error) {
      this.addTestResult('Performance Comparison', `FAIL: ${error.message}`);
    }
  }

  addTestResult(testName, result) {
    this.testResults.push({ test: testName, result, timestamp: new Date() });
  }

  printTestResults() {
    console.log('\n=== Migration Test Results ===');
    this.testResults.forEach(result => {
      const status = result.result.startsWith('PASS') ? '✅' : '❌';
      console.log(`${status} ${result.test}: ${result.result}`);
    });
    
    const passed = this.testResults.filter(r => r.result.startsWith('PASS')).length;
    const total = this.testResults.length;
    console.log(`\nSummary: ${passed}/${total} tests passed`);
  }
}

// Run migration tests
async function runMigrationTests() {
  const testSuite = new MigrationTestSuite('https://api.qa-platform.com/v1', 'your-api-key');
  await testSuite.runMigrationTests();
}
```

## Migration Best Practices

### 1. Migration Checklist

```markdown
## Pre-Migration Checklist

### Planning Phase
- [ ] Identify all API endpoints currently in use
- [ ] Document current request/response formats
- [ ] Catalog any custom integrations or workarounds
- [ ] Set up monitoring for success rates and performance
- [ ] Plan rollback strategy

### Testing Phase
- [ ] Set up test environment with both API versions
- [ ] Create comprehensive test suite covering all operations
- [ ] Test error handling and fallback mechanisms
- [ ] Validate response transformations
- [ ] Performance test both versions under load

### Deployment Phase
- [ ] Implement feature flags for gradual rollout
- [ ] Start with low-traffic, non-critical operations
- [ ] Monitor error rates and performance metrics
- [ ] Gather user feedback
- [ ] Plan for peak traffic periods

### Post-Migration Phase
- [ ] Monitor long-term stability
- [ ] Clean up old version code once migration is complete
- [ ] Update documentation and examples
- [ ] Train team on new API features
- [ ] Plan for future version migrations
```

### 2. Monitoring and Alerting

```javascript
class MigrationMonitoring {
  constructor(metricsService, alertService) {
    this.metrics = metricsService;
    this.alerts = alertService;
    this.thresholds = {
      errorRate: 5, // 5% error rate threshold
      latencyIncrease: 20, // 20% latency increase threshold
      fallbackRate: 10 // 10% fallback rate threshold
    };
  }

  recordMigrationMetric(operation, version, success, duration, fallback = false) {
    this.metrics.increment(`api.${operation}.${version}.requests`);
    this.metrics.timing(`api.${operation}.${version}.duration`, duration);
    
    if (!success) {
      this.metrics.increment(`api.${operation}.${version}.errors`);
    }
    
    if (fallback) {
      this.metrics.increment(`api.${operation}.fallback`);
    }
  }

  async checkMigrationHealth() {
    const operations = ['uploadFile', 'createAssessment', 'getFiles'];
    
    for (const operation of operations) {
      await this.checkOperationHealth(operation);
    }
  }

  async checkOperationHealth(operation) {
    const timeWindow = 300; // 5 minutes
    
    // Check error rates
    const v2Errors = await this.metrics.getRate(`api.${operation}.v2.errors`, timeWindow);
    const v2Requests = await this.metrics.getRate(`api.${operation}.v2.requests`, timeWindow);
    const errorRate = v2Requests > 0 ? (v2Errors / v2Requests) * 100 : 0;
    
    if (errorRate > this.thresholds.errorRate) {
      this.alerts.send(`High error rate for ${operation} v2: ${errorRate.toFixed(1)}%`);
    }
    
    // Check latency
    const v1Latency = await this.metrics.getAverage(`api.${operation}.v1.duration`, timeWindow);
    const v2Latency = await this.metrics.getAverage(`api.${operation}.v2.duration`, timeWindow);
    const latencyIncrease = v1Latency > 0 ? ((v2Latency - v1Latency) / v1Latency) * 100 : 0;
    
    if (latencyIncrease > this.thresholds.latencyIncrease) {
      this.alerts.send(`High latency increase for ${operation} v2: ${latencyIncrease.toFixed(1)}%`);
    }
    
    // Check fallback rate
    const fallbacks = await this.metrics.getRate(`api.${operation}.fallback`, timeWindow);
    const totalRequests = await this.metrics.getRate(`api.${operation}.v2.requests`, timeWindow);
    const fallbackRate = totalRequests > 0 ? (fallbacks / totalRequests) * 100 : 0;
    
    if (fallbackRate > this.thresholds.fallbackRate) {
      this.alerts.send(`High fallback rate for ${operation}: ${fallbackRate.toFixed(1)}%`);
    }
  }
}
```

This comprehensive migration guide provides the tools and strategies needed to safely migrate between API versions while maintaining backward compatibility and minimizing disruption to existing integrations. 