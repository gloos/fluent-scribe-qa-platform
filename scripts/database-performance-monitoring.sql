-- Database Performance Monitoring Scripts
-- Translation QA Platform - Index Usage and Performance Analysis

-- ========================================
-- INDEX USAGE STATISTICS
-- ========================================

-- 1. Overall Index Usage Statistics
-- Shows how frequently each index is being used
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as "Index Scans",
    idx_tup_read as "Tuples Read",
    idx_tup_fetch as "Tuples Fetched",
    CASE 
        WHEN idx_scan = 0 THEN 'UNUSED'
        WHEN idx_scan < 100 THEN 'LOW USAGE'
        WHEN idx_scan < 1000 THEN 'MODERATE USAGE'
        ELSE 'HIGH USAGE'
    END as usage_level,
    pg_size_pretty(pg_relation_size(indexrelid)) as "Index Size"
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- 2. Unused Indexes (Candidates for Removal)
-- Identifies indexes that are never used and might be candidates for removal
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as "Wasted Space"
FROM pg_stat_user_indexes 
WHERE idx_scan = 0 
  AND schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;

-- 3. Index Efficiency (Scan vs Read Ratio)
-- High ratios might indicate index bloat or inefficient queries
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as scans,
    idx_tup_read as reads,
    CASE 
        WHEN idx_scan = 0 THEN 0
        ELSE ROUND((idx_tup_read::numeric / idx_scan), 2)
    END as "Avg Reads per Scan",
    CASE 
        WHEN idx_scan = 0 THEN 'UNUSED'
        WHEN (idx_tup_read::numeric / idx_scan) > 1000 THEN 'INEFFICIENT'
        WHEN (idx_tup_read::numeric / idx_scan) > 100 THEN 'REVIEW'
        ELSE 'EFFICIENT'
    END as efficiency_rating
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY "Avg Reads per Scan" DESC;

-- ========================================
-- TABLE STATISTICS
-- ========================================

-- 4. Table Access Patterns
-- Shows how tables are being accessed (seq scans vs index scans)
SELECT 
    schemaname,
    relname as "Table Name",
    seq_scan as "Sequential Scans",
    seq_tup_read as "Seq Tuples Read",
    idx_scan as "Index Scans", 
    idx_tup_fetch as "Index Tuples Fetched",
    CASE 
        WHEN seq_scan + idx_scan = 0 THEN 0
        ELSE ROUND((seq_scan::numeric / (seq_scan + idx_scan)) * 100, 2)
    END as "Seq Scan %",
    pg_size_pretty(pg_relation_size(oid)) as "Table Size",
    n_tup_ins as "Inserts",
    n_tup_upd as "Updates",
    n_tup_del as "Deletes"
FROM pg_stat_user_tables 
WHERE schemaname = 'public'
ORDER BY seq_scan DESC;

-- 5. Tables with High Sequential Scan Ratios
-- Tables that might benefit from additional indexes
SELECT 
    schemaname,
    relname as "Table Name",
    seq_scan,
    idx_scan,
    ROUND((seq_scan::numeric / (seq_scan + idx_scan)) * 100, 2) as "Seq Scan %",
    pg_size_pretty(pg_relation_size(oid)) as "Table Size"
FROM pg_stat_user_tables 
WHERE schemaname = 'public'
  AND (seq_scan + idx_scan) > 0
  AND (seq_scan::numeric / (seq_scan + idx_scan)) > 0.1
ORDER BY "Seq Scan %" DESC;

-- ========================================
-- QUERY PERFORMANCE ANALYSIS
-- ========================================

-- 6. Slowest Queries (requires pg_stat_statements extension)
-- Note: Enable pg_stat_statements in postgresql.conf for this to work
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements 
WHERE query NOT LIKE '%pg_stat_statements%'
  AND query NOT LIKE '%pg_stat_user_%'
ORDER BY mean_time DESC 
LIMIT 10;

-- 7. Most Frequently Called Queries
SELECT 
    left(query, 100) as "Query (truncated)",
    calls,
    total_time,
    mean_time,
    ROUND((100.0 * total_time / sum(total_time) OVER()), 2) AS "% of Total Time"
FROM pg_stat_statements 
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY calls DESC 
LIMIT 10;

-- ========================================
-- CACHE AND MEMORY PERFORMANCE
-- ========================================

-- 8. Buffer Cache Hit Ratio
-- Should be > 95% for good performance
SELECT 
    'Buffer Cache Hit Ratio' as metric,
    ROUND(
        100.0 * sum(blks_hit) / (sum(blks_hit) + sum(blks_read)), 2
    ) || '%' as value
FROM pg_stat_database;

-- 9. Table-Level Cache Hit Ratios
SELECT 
    schemaname,
    relname as "Table Name",
    heap_blks_read + heap_blks_hit as "Total Blocks",
    CASE 
        WHEN heap_blks_read + heap_blks_hit = 0 THEN 0
        ELSE ROUND(100.0 * heap_blks_hit / (heap_blks_hit + heap_blks_read), 2)
    END as "Cache Hit %",
    pg_size_pretty(pg_relation_size(oid)) as "Table Size"
FROM pg_statio_user_tables 
WHERE schemaname = 'public'
  AND (heap_blks_read + heap_blks_hit) > 0
ORDER BY "Cache Hit %" ASC;

-- ========================================
-- INDEX BLOAT ANALYSIS
-- ========================================

-- 10. Index Bloat Estimation
-- Estimates bloat in indexes (approximation)
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as "Index Size",
    CASE 
        WHEN pg_relation_size(indexrelid) > 100 * 1024 * 1024 THEN 'LARGE INDEX - Monitor for bloat'
        WHEN pg_relation_size(indexrelid) > 10 * 1024 * 1024 THEN 'MEDIUM INDEX'
        ELSE 'SMALL INDEX'
    END as size_category
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;

-- ========================================
-- LOCK CONTENTION ANALYSIS
-- ========================================

-- 11. Current Lock Information
-- Shows current locks (run during suspected contention)
SELECT 
    pl.pid,
    pl.mode,
    pl.granted,
    c.relname,
    pl.locktype
FROM pg_locks pl
LEFT JOIN pg_class c ON pl.relation = c.oid
WHERE pl.relation IS NOT NULL
  AND c.relkind = 'r'
ORDER BY pl.granted, c.relname;

-- 12. Blocking Queries
-- Shows queries that are blocking others
SELECT 
    blocked_locks.pid AS blocked_pid,
    blocked_activity.usename AS blocked_user,
    blocking_locks.pid AS blocking_pid,
    blocking_activity.usename AS blocking_user,
    blocked_activity.query AS blocked_statement,
    blocking_activity.query AS current_statement_in_blocking_process
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks 
    ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.DATABASE IS NOT DISTINCT FROM blocked_locks.DATABASE
    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
    AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
    AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
    AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
    AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
    AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
    AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
    AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
    AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.GRANTED;

-- ========================================
-- SPECIFIC INDEX MONITORING FOR NEW INDEXES
-- ========================================

-- 13. Composite Index Usage (Added in optimization)
-- Monitor usage of newly implemented composite indexes
SELECT 
    'Composite Index Performance' as analysis_type,
    indexname,
    idx_scan as scans,
    idx_tup_read as tuples_read,
    CASE 
        WHEN idx_scan = 0 THEN 'Not yet used'
        ELSE ROUND(idx_tup_read::numeric / idx_scan, 2) || ' avg tuples per scan'
    END as efficiency
FROM pg_stat_user_indexes 
WHERE indexname IN (
    'idx_projects_org_status_priority',
    'idx_qa_sessions_user_project_status', 
    'idx_assessment_results_session_status_type',
    'idx_qa_errors_session_severity_status',
    'idx_projects_org_deadline',
    'idx_qa_sessions_user_status_created'
)
ORDER BY idx_scan DESC;

-- 14. JSONB Index Usage
-- Monitor JSONB GIN indexes performance
SELECT 
    'JSONB Index Performance' as analysis_type,
    indexname,
    idx_scan as scans,
    idx_tup_read as tuples_read,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes 
WHERE indexname IN (
    'idx_projects_tags_gin',
    'idx_assessment_criteria_config_gin',
    'idx_qa_sessions_analysis_results_gin'
)
ORDER BY idx_scan DESC;

-- 15. Partial Index Effectiveness
-- Monitor partial indexes for active-only queries
SELECT 
    'Partial Index Performance' as analysis_type,
    indexname,
    idx_scan as scans,
    idx_tup_read as tuples_read,
    CASE 
        WHEN idx_scan > 0 THEN 
            'Avg selectivity: ' || ROUND(idx_tup_read::numeric / idx_scan, 2)
        ELSE 'No usage yet'
    END as selectivity_info
FROM pg_stat_user_indexes 
WHERE indexname IN (
    'idx_qa_sessions_active_created',
    'idx_qa_errors_critical', 
    'idx_assessment_results_pending'
)
ORDER BY idx_scan DESC;

-- ========================================
-- PERFORMANCE RECOMMENDATIONS
-- ========================================

-- 16. Weekly Performance Summary
-- Run this weekly to get an overview
WITH index_stats AS (
    SELECT 
        COUNT(*) as total_indexes,
        COUNT(*) FILTER (WHERE idx_scan = 0) as unused_indexes,
        SUM(pg_relation_size(indexrelid)) as total_index_size
    FROM pg_stat_user_indexes 
    WHERE schemaname = 'public'
),
table_stats AS (
    SELECT 
        COUNT(*) as total_tables,
        AVG(CASE 
            WHEN seq_scan + idx_scan = 0 THEN 0
            ELSE seq_scan::numeric / (seq_scan + idx_scan)
        END) as avg_seq_scan_ratio
    FROM pg_stat_user_tables 
    WHERE schemaname = 'public'
)
SELECT 
    'Performance Summary' as report_type,
    total_indexes || ' total indexes (' || unused_indexes || ' unused)' as index_summary,
    pg_size_pretty(total_index_size) as total_index_size,
    ROUND(avg_seq_scan_ratio * 100, 2) || '% average sequential scan ratio' as scan_efficiency
FROM index_stats, table_stats;

-- ========================================
-- USAGE INSTRUCTIONS
-- ========================================

/*
DAILY MONITORING:
- Run queries 1, 8, 11 to check index usage, cache performance, and locks

WEEKLY ANALYSIS:  
- Run queries 2, 5, 16 to identify optimization opportunities

MONTHLY REVIEWS:
- Run queries 6, 7 to analyze query performance trends
- Run queries 10, 3 for index bloat and efficiency analysis

AFTER DEPLOYING NEW INDEXES:
- Run queries 13, 14, 15 to monitor new index effectiveness

PERFORMANCE THRESHOLDS:
- Buffer cache hit ratio should be > 95%
- Sequential scan ratio should be < 10% for most tables
- Unused indexes should be reviewed for removal
- Average reads per scan > 1000 indicates potential inefficiency

ALERT CONDITIONS:
- Buffer cache hit ratio < 90%
- Any table with > 50% sequential scan ratio
- Blocking queries lasting > 5 minutes
- Index sizes growing disproportionately to table sizes
*/ 