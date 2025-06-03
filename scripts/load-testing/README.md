# Database Load Testing Setup

This directory contains a comprehensive database load testing solution for the Fluent Scribe QA Platform using Apache JMeter and PostgreSQL JDBC connectivity to test the Supabase database.

## Overview

The load testing framework is designed to:
- Simulate realistic database load patterns
- Test both read and write operations
- Monitor performance metrics and identify bottlenecks
- Generate comprehensive reports for analysis
- Support automated and repeatable testing scenarios

## Prerequisites

### Software Requirements
- **Java 17+**: Required for JMeter execution
- **Apache JMeter 5.6+**: Load testing framework
- **PostgreSQL JDBC Driver**: Database connectivity
- **Bash**: Script execution environment

### Installation Verification
```bash
# Check Java installation
java -version

# Check JMeter installation
jmeter --version

# Verify JDBC driver
ls -la postgresql-42.7.4.jar
```

## File Structure

```
scripts/load-testing/
├── README.md                    # This documentation
├── database-config.properties   # Configuration settings
├── database-load-test.jmx      # JMeter test plan
├── generate-test-data.sql      # Test data generation script
├── postgresql-42.7.4.jar      # PostgreSQL JDBC driver
├── run-load-test.sh           # Execution script
├── results/                   # Test results directory
│   └── test_run_YYYYMMDD_HHMMSS/
│       ├── test_results.jtl   # Raw test results
│       ├── html_report/       # HTML dashboard
│       ├── jmeter.log        # JMeter execution log
│       └── test_summary.txt   # Test summary report
└── scripts/                   # Additional utility scripts
```

## Configuration

### Database Configuration (`database-config.properties`)

Key configuration parameters:

#### Database Connection
- `db.url`: Supabase PostgreSQL connection string
- `db.username`: Database username
- `db.password`: Service role key (configure before testing)

#### Load Testing Parameters
- `load.users`: Number of concurrent users (default: 10)
- `load.ramp.up.period`: Time to reach full load in seconds (default: 60)
- `load.duration`: Test duration in seconds (default: 300)

#### Performance Thresholds
- `response.time.threshold`: Maximum acceptable response time in ms
- `error.rate.threshold`: Maximum acceptable error rate (0.01 = 1%)
- `throughput.min`: Minimum required transactions per second

### Test Data Configuration

The `generate-test-data.sql` script creates realistic test data:
- 10 organizations with various subscription tiers
- 100 users distributed across organizations
- 50 projects with different statuses
- 1000 QA sessions with realistic file sizes
- 800 assessment results with scores
- 500 user feedback entries
- 2000 audit log entries

## Usage

### Quick Start

1. **Configure Database Credentials**:
   ```bash
   # Edit database-config.properties
   nano database-config.properties
   # Update db.password with your Supabase service role key
   ```

2. **Run Load Test**:
   ```bash
   ./run-load-test.sh
   ```

3. **Review Results**:
   - Open the generated HTML dashboard
   - Analyze performance metrics
   - Check for errors or bottlenecks

### Manual Test Execution

If you prefer manual control:

```bash
# Set classpath for PostgreSQL driver
export CLASSPATH="./postgresql-42.7.4.jar:$CLASSPATH"

# Run JMeter test
jmeter -n -t database-load-test.jmx \
       -l results/test_results.jtl \
       -e -o results/html_report \
       -Jdb.password=YOUR_SERVICE_ROLE_KEY
```

### Test Data Generation

Before running tests, generate test data:

1. **Using psql** (if available):
   ```bash
   psql "postgresql://postgres.uqprvrrncpqhpfxafeuc:YOUR_PASSWORD@aws-0-us-west-1.pooler.supabase.com:6543/postgres" \
        -f generate-test-data.sql
   ```

2. **Using Supabase Dashboard**:
   - Copy contents of `generate-test-data.sql`
   - Paste into SQL Editor
   - Execute the script

## Test Scenarios

The JMeter test plan includes multiple test scenarios:

### Read Operations (70% of load)
- User profile queries
- Organization project listings
- QA session analytics
- Assessment result reports
- Audit log searches

### Write Operations (30% of load)
- User profile updates
- QA session creations
- Assessment result submissions
- Feedback submissions
- Audit log insertions

## Performance Metrics

The load tests measure:

### Response Time Metrics
- Average response time
- 95th percentile response time
- Maximum response time
- Response time distribution

### Throughput Metrics
- Transactions per second (TPS)
- Requests per second
- Data throughput (bytes/sec)

### Error Metrics
- Error rate percentage
- Error types and frequencies
- Failed transaction details

### Resource Utilization
- Database connection usage
- Query execution patterns
- Lock contention analysis

## Results Analysis

### HTML Dashboard
The generated HTML dashboard provides:
- Summary statistics
- Response time graphs
- Throughput trends
- Error analysis
- Performance over time

### Key Performance Indicators
Monitor these critical metrics:

1. **Response Time**: Should be < 1000ms for 95% of requests
2. **Error Rate**: Should be < 1% for all operations
3. **Throughput**: Should meet minimum TPS requirements
4. **Resource Usage**: Database connections should not be exhausted

### Bottleneck Identification
Common bottlenecks to analyze:
- Slow database queries
- Connection pool exhaustion
- Lock contention
- Index inefficiencies
- Network latency

## Optimization Recommendations

Based on test results, consider these optimizations:

### Database Level
- Add missing indexes for frequently queried columns
- Optimize slow queries identified in test results
- Implement connection pooling optimizations
- Consider read replicas for read-heavy workloads

### Application Level
- Implement query result caching
- Optimize database query patterns
- Use batch operations for bulk inserts
- Implement proper connection management

### Infrastructure Level
- Scale database resources based on bottlenecks
- Implement CDN for static content
- Configure load balancing for application servers
- Set up database monitoring and alerting

## Troubleshooting

### Common Issues

1. **Connection Errors**:
   - Verify database credentials
   - Check network connectivity
   - Ensure service role permissions

2. **Performance Issues**:
   - Review JMeter log for errors
   - Check database performance metrics
   - Analyze slow query logs

3. **Test Data Issues**:
   - Ensure test data generation completed successfully
   - Verify foreign key relationships
   - Check data distribution patterns

### Debug Mode
Enable verbose logging by modifying the JMeter test plan:
```bash
jmeter -n -t database-load-test.jmx -l results.jtl -j jmeter.log -Lorg.apache.jmeter=DEBUG
```

## Next Steps

After completing load testing:

1. **Analyze Results**: Review performance metrics and identify bottlenecks
2. **Optimize Database**: Implement recommended database optimizations
3. **Implement Caching**: Add caching layers based on test insights
4. **Automate Testing**: Schedule regular load tests for continuous monitoring
5. **Scale Infrastructure**: Plan scaling strategies based on performance requirements

## Integration with Development Workflow

This load testing setup integrates with the broader scalability improvement task:
- **Task 24.2**: Use results to identify queries needing optimization
- **Task 24.3**: Develop additional test scenarios based on findings
- **Task 24.4**: Implement monitoring based on identified metrics
- **Task 24.5**: Analyze bottlenecks discovered through testing

## Security Considerations

- Store database credentials securely
- Use service role keys with minimal required permissions
- Run tests against isolated test environments when possible
- Monitor for any security-related performance impacts

## Support and Maintenance

- Regularly update JMeter and JDBC drivers
- Review and update test scenarios as application evolves
- Monitor baseline performance metrics over time
- Document any performance regressions or improvements 