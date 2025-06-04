# Performance Testing Framework

This directory contains a comprehensive performance testing framework for the Fluent Scribe QA Platform. The framework integrates with existing monitoring services and JMeter infrastructure to provide automated load testing, stress testing, and performance analysis.

## Overview

The performance testing framework consists of:

1. **PerformanceTestRunner** - Core orchestration class
2. **Performance Analysis Service** - Automated result analysis and bottleneck detection
3. **System Monitoring Integration** - Real-time resource monitoring during tests
4. **JMeter Integration** - Database load testing using existing JMeter infrastructure
5. **API Load Testing** - HTTP endpoint testing using autocannon
6. **Comprehensive Reporting** - Automated generation of performance reports

## Prerequisites

### Required Dependencies

```bash
# Core dependencies (should already be installed)
npm install commander autocannon

# Optional: For advanced load testing
npm install -g autocannon
```

### JMeter Setup (for database tests)

The framework integrates with existing JMeter infrastructure in `scripts/load-testing/`. Ensure JMeter is properly configured:

```bash
# Verify JMeter installation
jmeter --version

# Ensure database load test plan exists
ls scripts/load-testing/database-load-test.jmx
```

### Environment Variables

```bash
# Required for database monitoring (set in .env)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional: Custom endpoints
PERFORMANCE_TEST_BASE_URL=http://localhost:3000
```

## Usage

### Command Line Interface

The framework provides a CLI tool for running performance tests:

```bash
# Run from project root
npx tsx src/test/performance/run-performance-tests.ts <command> [options]
```

### Available Commands

#### 1. API Endpoint Testing

```bash
# Basic API load test
npx tsx src/test/performance/run-performance-tests.ts api

# Custom configuration
npx tsx src/test/performance/run-performance-tests.ts api \
  --duration 600 \
  --concurrency 100 \
  --url http://localhost:3000/api/health
```

#### 2. Database Load Testing

```bash
# Database load test using JMeter
npx tsx src/test/performance/run-performance-tests.ts database

# Custom configuration
npx tsx src/test/performance/run-performance-tests.ts database \
  --duration 900 \
  --concurrency 150
```

#### 3. Stress Testing

```bash
# Progressive stress test
npx tsx src/test/performance/run-performance-tests.ts stress

# Custom stress test
npx tsx src/test/performance/run-performance-tests.ts stress \
  --base-concurrency 25 \
  --url http://localhost:3000
```

#### 4. Comprehensive Test Suite

```bash
# Run all tests (full suite)
npx tsx src/test/performance/run-performance-tests.ts all

# Quick test suite (reduced duration)
npx tsx src/test/performance/run-performance-tests.ts all --quick
```

#### 5. System Monitoring

```bash
# Monitor system without running tests
npx tsx src/test/performance/run-performance-tests.ts monitor --duration 300
```

### Programmatic Usage

```typescript
import { PerformanceTestRunner, performanceTestConfigs } from './performance-test-setup';

async function runCustomTest() {
  const runner = new PerformanceTestRunner();
  await runner.initialize();

  // Custom test configuration
  const config = {
    name: 'Custom API Test',
    description: 'Test specific endpoint',
    duration: 300,
    concurrency: 50,
    targetEndpoint: 'http://localhost:3000/api/custom',
    thresholds: {
      responseTimeThreshold: 500,
      errorRateThreshold: 0.01,
      throughputMinimum: 100,
      p95ResponseTimeThreshold: 1000,
      p99ResponseTimeThreshold: 2000,
    },
    enableMonitoring: true,
    enableDatabaseLoad: false
  };

  try {
    await runner.runLoadTest(config);
    console.log('Test completed successfully');
  } finally {
    await runner.cleanup();
  }
}
```

## Test Configurations

### Predefined Configurations

#### 1. API Endpoints (`apiEndpoints`)
- **Duration**: 5 minutes
- **Concurrency**: 50 connections
- **Target**: Health check endpoint
- **Thresholds**: Conservative (1s response time, 1% error rate)

#### 2. Database Load (`databaseLoad`)
- **Duration**: 10 minutes
- **Concurrency**: 100 connections
- **Method**: JMeter test plan
- **Thresholds**: Strict (500ms response time, 0.5% error rate)

#### 3. Full System (`fullSystem`)
- **Duration**: 15 minutes
- **Concurrency**: 200 connections
- **Target**: Main application
- **Thresholds**: Relaxed (2s response time, 2% error rate)

### Custom Configuration

```typescript
const customConfig: PerformanceTestConfig = {
  name: 'Custom Test',
  description: 'Description of test scenario',
  duration: 600, // seconds
  concurrency: 100, // concurrent connections
  targetEndpoint: 'http://localhost:3000/api/endpoint',
  thresholds: {
    responseTimeThreshold: 1000, // ms
    errorRateThreshold: 0.05, // 5%
    throughputMinimum: 50, // requests/second
    p95ResponseTimeThreshold: 2000, // ms
    p99ResponseTimeThreshold: 5000, // ms
  },
  enableMonitoring: true,
  enableDatabaseLoad: false,
  jmeterTestPlan: 'path/to/test-plan.jmx' // optional
};
```

## Results and Reports

### Output Directory Structure

```
test-results/performance/
├── load-test-{timestamp}/
│   ├── {testId}.jtl                 # Raw JMeter results
│   ├── {testId}.log                 # Test execution log
│   ├── {testId}-report.json         # Detailed analysis report
│   ├── {testId}-summary.md          # Human-readable summary
│   └── html-report/                 # JMeter HTML report (if available)
│       ├── index.html
│       └── ...
```

### Report Contents

#### Summary Report (`{testId}-summary.md`)
- Test metadata and configuration
- Overall performance metrics
- Performance goals status (PASS/FAIL)
- Identified bottlenecks
- Actionable recommendations

#### Detailed Report (`{testId}-report.json`)
- Complete performance analysis
- System metrics during test
- Database metrics (if enabled)
- Bottleneck analysis with severity levels
- Historical comparison data

### Sample Summary Report

```markdown
# Performance Test Summary

**Test ID:** load-test-1704067200000
**Test Name:** API Endpoints Load Test
**Duration:** 300 seconds
**Timestamp:** 2024-01-01T00:00:00.000Z

## Test Results

### Overall Performance
- **Total Requests:** 15,000
- **Successful Requests:** 14,850 (99.00%)
- **Failed Requests:** 150 (1.00%)
- **Average Response Time:** 245.50ms
- **Max Response Time:** 1,234.00ms
- **Throughput:** 50.00 requests/second

### Performance Goals Status
- **Response Time:** 245.50ms / 1000ms - ✅ PASS
- **Throughput:** 50.00 req/s / 100 req/s - ❌ FAIL
- **Error Rate:** 1.00% / 1.00% - ✅ PASS

### Bottlenecks Detected
- **DATABASE** (medium): Connection pool exhaustion detected
- **SYSTEM** (low): CPU usage approaching threshold

### Recommendations
**Immediate:**
- Increase database connection pool size
- Monitor CPU usage during peak load

**Short Term:**
- Consider read replicas for read-heavy operations
- Implement connection pooling optimizations
```

## Monitoring Integration

### System Metrics Collected
- CPU usage and temperature
- Memory utilization
- Disk I/O and space usage
- Network throughput
- Process statistics

### Database Metrics Collected
- Connection pool usage
- Query performance
- Cache hit ratios
- Lock statistics
- Replication status

### Alert Thresholds

The framework automatically monitors for:
- CPU usage > 80%
- Memory usage > 85%
- Disk usage > 90%
- Database connection usage > 80%
- Cache hit ratio < 95%
- Slow query count > 10 per interval

## Best Practices

### Test Environment
1. **Isolated Environment**: Run tests in a dedicated environment
2. **Production-like Data**: Use realistic test data volumes
3. **Resource Baseline**: Establish baseline metrics before testing
4. **Clean State**: Ensure clean system state between tests

### Test Design
1. **Gradual Ramp-up**: Use progressive load increases
2. **Realistic Scenarios**: Model actual user behavior
3. **Recovery Time**: Allow system recovery between tests
4. **Monitoring**: Always enable system monitoring

### Analysis
1. **Multiple Metrics**: Don't rely on single performance indicators
2. **Trend Analysis**: Compare results over time
3. **Bottleneck Identification**: Focus on system constraints
4. **Actionable Insights**: Prioritize recommendations by impact

## Troubleshooting

### Common Issues

#### JMeter Not Found
```bash
# Ensure JMeter is in PATH
export PATH=$PATH:/path/to/jmeter/bin
```

#### Database Connection Issues
```bash
# Verify Supabase credentials
echo $SUPABASE_SERVICE_ROLE_KEY
```

#### Permission Errors
```bash
# Ensure write permissions for results directory
chmod -R 755 test-results/
```

#### Memory Issues During Large Tests
```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npx tsx src/test/performance/run-performance-tests.ts all
```

### Debugging

Enable verbose logging:
```bash
DEBUG=performance:* npx tsx src/test/performance/run-performance-tests.ts api
```

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Performance Tests
on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  workflow_dispatch:

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm ci
      - name: Run Performance Tests
        run: npx tsx src/test/performance/run-performance-tests.ts all --quick
        env:
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
      - name: Upload Results
        uses: actions/upload-artifact@v4
        with:
          name: performance-results
          path: test-results/performance/
```

## Contributing

### Adding New Test Scenarios

1. Add configuration to `performanceTestConfigs` in `performance-test-setup.ts`
2. Update CLI commands in `run-performance-tests.ts`
3. Add validation tests in `performance-test.spec.ts`
4. Update this README with usage examples

### Extending Analysis

1. Modify `PerformanceAnalysisService` for new metrics
2. Update report generation in `generateTestSummary()`
3. Add new bottleneck detection rules
4. Update recommendation engine

For questions or issues, refer to the main project documentation or create an issue in the project repository. 