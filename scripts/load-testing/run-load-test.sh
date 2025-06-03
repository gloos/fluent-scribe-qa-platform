#!/bin/bash
# Database Load Testing Execution Script
# This script runs comprehensive load tests against the Supabase PostgreSQL database

set -e

# Script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Log function
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
}

success() {
    echo -e "${GREEN}[SUCCESS] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

# Configuration
CONFIG_FILE="database-config.properties"
JMETER_TEST_PLAN="database-load-test.jmx"
RESULTS_DIR="results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
TEST_RESULTS_DIR="$RESULTS_DIR/test_run_$TIMESTAMP"

# Validate prerequisites
log "Validating prerequisites..."

# Check Java installation
if ! command -v java &> /dev/null; then
    error "Java is not installed or not in PATH"
    exit 1
fi

# Check JMeter installation
if ! command -v jmeter &> /dev/null; then
    error "JMeter is not installed or not in PATH"
    exit 1
fi

# Check PostgreSQL JDBC driver
if [[ ! -f "postgresql-42.7.4.jar" ]]; then
    error "PostgreSQL JDBC driver not found: postgresql-42.7.4.jar"
    exit 1
fi

# Check configuration file
if [[ ! -f "$CONFIG_FILE" ]]; then
    error "Configuration file not found: $CONFIG_FILE"
    exit 1
fi

# Check test plan file
if [[ ! -f "$JMETER_TEST_PLAN" ]]; then
    error "JMeter test plan not found: $JMETER_TEST_PLAN"
    exit 1
fi

success "All prerequisites validated"

# Create results directory
mkdir -p "$TEST_RESULTS_DIR"
log "Created results directory: $TEST_RESULTS_DIR"

# Read configuration
source <(grep -v '^#' "$CONFIG_FILE" | grep '=' | sed 's/=/ = /' | while read key eq value; do
    echo "export ${key//./_}='$value'"
done)

# Display test configuration
log "Test Configuration:"
echo "  - Users: ${load_users:-10}"
echo "  - Ramp-up Period: ${load_ramp_up_period:-60}s"
echo "  - Test Duration: ${load_duration:-300}s"
echo "  - Database URL: ${db_url:-Not configured}"

# Prompt for database password if not configured
if [[ "$db_password" == "YOUR_SERVICE_ROLE_KEY_HERE" ]]; then
    warn "Database password not configured in $CONFIG_FILE"
    read -s -p "Enter Supabase service role key: " DB_PASSWORD
    echo
    export db_password="$DB_PASSWORD"
fi

# Generate test data (optional)
read -p "Generate fresh test data? [y/N]: " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log "Generating test data..."
    if command -v psql &> /dev/null; then
        log "Using psql to generate test data"
        # Note: This would need proper psql connection setup
        warn "Manual test data generation required - please run generate-test-data.sql manually"
    else
        warn "psql not available - skipping test data generation"
        warn "Please ensure test data exists before running load tests"
    fi
fi

# Prepare JMeter execution
log "Preparing JMeter execution..."

# Set JMeter classpath to include PostgreSQL driver
export CLASSPATH="$SCRIPT_DIR/postgresql-42.7.4.jar:$CLASSPATH"

# JMeter execution parameters
JMETER_ARGS=(
    "-n"  # Non-GUI mode
    "-t" "$JMETER_TEST_PLAN"  # Test plan file
    "-l" "$TEST_RESULTS_DIR/test_results.jtl"  # Results file
    "-e"  # Generate HTML dashboard
    "-o" "$TEST_RESULTS_DIR/html_report"  # HTML report output directory
    "-j" "$TEST_RESULTS_DIR/jmeter.log"  # JMeter log file
)

# Add property overrides
JMETER_ARGS+=(
    "-Jdb.url=$db_url"
    "-Jdb.username=$db_username"
    "-Jdb.password=$db_password"
    "-Jload.users=${load_users:-10}"
    "-Jload.ramp.up.period=${load_ramp_up_period:-60}"
    "-Jload.duration=${load_duration:-300}"
)

# Execute JMeter test
log "Starting JMeter load test..."
log "Command: jmeter ${JMETER_ARGS[*]}"

start_time=$(date +%s)

if jmeter "${JMETER_ARGS[@]}"; then
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    success "Load test completed successfully in ${duration}s"
else
    error "Load test failed"
    exit 1
fi

# Generate summary report
log "Generating test summary..."
cat > "$TEST_RESULTS_DIR/test_summary.txt" << EOF
Database Load Test Summary
==========================

Test Execution Details:
- Start Time: $(date -r $start_time)
- End Time: $(date -r $end_time)
- Duration: ${duration}s
- Configuration: $CONFIG_FILE
- Test Plan: $JMETER_TEST_PLAN

Test Parameters:
- Concurrent Users: ${load_users:-10}
- Ramp-up Period: ${load_ramp_up_period:-60}s
- Test Duration: ${load_duration:-300}s
- Database: ${db_url:-Not specified}

Results Location: $TEST_RESULTS_DIR
- Detailed Results: test_results.jtl
- HTML Dashboard: html_report/index.html
- JMeter Log: jmeter.log

Next Steps:
1. Review HTML dashboard for detailed metrics
2. Analyze response times and throughput
3. Check for errors in JMeter log
4. Compare results against performance thresholds
5. Identify optimization opportunities

EOF

# Display results location
log "Test Results Summary:"
echo "  - Results Directory: $TEST_RESULTS_DIR"
echo "  - HTML Dashboard: $TEST_RESULTS_DIR/html_report/index.html"
echo "  - Raw Results: $TEST_RESULTS_DIR/test_results.jtl"
echo "  - JMeter Log: $TEST_RESULTS_DIR/jmeter.log"
echo "  - Summary: $TEST_RESULTS_DIR/test_summary.txt"

# Open HTML report (optional)
read -p "Open HTML dashboard in browser? [y/N]: " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if command -v open &> /dev/null; then
        open "$TEST_RESULTS_DIR/html_report/index.html"
    elif command -v xdg-open &> /dev/null; then
        xdg-open "$TEST_RESULTS_DIR/html_report/index.html"
    else
        log "Please manually open: $TEST_RESULTS_DIR/html_report/index.html"
    fi
fi

success "Load testing completed successfully!" 