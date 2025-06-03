import { EventEmitter } from 'events';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface DatabaseMetrics {
  timestamp: number;
  connections: {
    active: number;
    idle: number;
    total: number;
    maxConnections: number;
    usagePercent: number;
  };
  performance: {
    cacheHitRatio: number;
    indexHitRatio: number;
    slowQueries: number;
    totalQueries: number;
    avgQueryTime: number;
  };
  locks: {
    total: number;
    waiting: number;
    granted: number;
  };
  tableStats: {
    sequentialScans: number;
    indexScans: number;
    rowsInserted: number;
    rowsUpdated: number;
    rowsDeleted: number;
  };
  replication: {
    lag?: number;
    status?: string;
  };
}

export interface DatabaseAlert {
  type: 'connections' | 'performance' | 'locks' | 'replication';
  value: number;
  threshold: number;
  message: string;
  timestamp: number;
  severity: 'warning' | 'critical';
}

export interface DatabaseAlertThresholds {
  connectionUsage: number; // Percentage of max connections
  cacheHitRatio: number; // Minimum cache hit ratio
  indexHitRatio: number; // Minimum index hit ratio
  slowQueryCount: number; // Maximum slow queries per interval
  lockWaitTime: number; // Maximum lock wait time
  replicationLag?: number; // Maximum replication lag in bytes
}

export class DatabaseMonitoringService extends EventEmitter {
  private supabase: SupabaseClient;
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private metricsHistory: DatabaseMetrics[] = [];
  private maxHistorySize = 1000;

  private defaultThresholds: DatabaseAlertThresholds = {
    connectionUsage: 80, // 80% of max connections
    cacheHitRatio: 95, // 95% cache hit ratio minimum
    indexHitRatio: 95, // 95% index hit ratio minimum
    slowQueryCount: 10, // Max 10 slow queries per interval
    lockWaitTime: 5000, // 5 seconds max lock wait time
    replicationLag: 1024 * 1024 // 1MB replication lag
  };

  private alertThresholds: DatabaseAlertThresholds;

  constructor(supabaseUrl: string, supabaseKey: string, thresholds?: Partial<DatabaseAlertThresholds>) {
    super();
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.alertThresholds = { ...this.defaultThresholds, ...thresholds };
  }

  async startMonitoring(intervalMs: number = 10000): Promise<void> {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    console.log(`Starting database monitoring with ${intervalMs}ms interval`);

    // Take initial measurement
    await this.collectMetrics();

    // Set up periodic monitoring
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
      } catch (error) {
        console.error('Error collecting database metrics:', error);
        this.emit('error', error);
      }
    }, intervalMs);

    this.emit('monitoring-started');
  }

  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log('Database monitoring stopped');
    this.emit('monitoring-stopped');
  }

  private async collectMetrics(): Promise<void> {
    try {
      const timestamp = Date.now();

      // Get connection statistics
      const connectionsData = await this.getConnectionStats();
      
      // Get performance statistics
      const performanceData = await this.getPerformanceStats();
      
      // Get lock statistics
      const locksData = await this.getLockStats();
      
      // Get table access statistics
      const tableStatsData = await this.getTableStats();

      const metrics: DatabaseMetrics = {
        timestamp,
        connections: connectionsData,
        performance: performanceData,
        locks: locksData,
        tableStats: tableStatsData,
        replication: {
          // Supabase handles replication internally, so we can't easily get these stats
          lag: undefined,
          status: 'unknown'
        }
      };

      // Add to history
      this.addToHistory(metrics);

      // Check for alerts
      this.checkAlerts(metrics);

      // Emit metrics
      this.emit('metrics', metrics);

    } catch (error) {
      console.error('Error collecting database metrics:', error);
      throw error;
    }
  }

  private async getConnectionStats(): Promise<DatabaseMetrics['connections']> {
    try {
      // Query for connection statistics
      const { data: connectionData, error } = await this.supabase.rpc('get_connection_stats');
      
      if (error) {
        // Fallback to basic query if RPC function doesn't exist
        const { data: basicData } = await this.supabase
          .from('pg_stat_activity')
          .select('*')
          .not('state', 'eq', null);

        const active = basicData?.filter(row => row.state === 'active').length || 0;
        const idle = basicData?.filter(row => row.state === 'idle').length || 0;
        const total = basicData?.length || 0;

        return {
          active,
          idle,
          total,
          maxConnections: 100, // Default assumption for Supabase
          usagePercent: (total / 100) * 100
        };
      }

      return connectionData || {
        active: 0,
        idle: 0,
        total: 0,
        maxConnections: 100,
        usagePercent: 0
      };
    } catch (error) {
      console.warn('Could not collect connection stats:', error);
      return {
        active: 0,
        idle: 0,
        total: 0,
        maxConnections: 100,
        usagePercent: 0
      };
    }
  }

  private async getPerformanceStats(): Promise<DatabaseMetrics['performance']> {
    try {
      // Get cache hit ratio
      const { data: cacheData } = await this.supabase
        .rpc('get_cache_hit_ratio')
        .single();

      // Get index hit ratio
      const { data: indexData } = await this.supabase
        .rpc('get_index_hit_ratio')
        .single();

      // Get query statistics if pg_stat_statements is available
      const { data: queryData } = await this.supabase
        .rpc('get_query_stats');

      const cacheHitRatio = (cacheData as any)?.cache_hit_ratio || 0;
      const indexHitRatio = (indexData as any)?.index_hit_ratio || 0;
      const slowQueries = (queryData as any)?.slow_queries || 0;
      const totalQueries = (queryData as any)?.total_queries || 0;
      const avgQueryTime = (queryData as any)?.avg_query_time || 0;

      return {
        cacheHitRatio,
        indexHitRatio,
        slowQueries,
        totalQueries,
        avgQueryTime
      };
    } catch (error) {
      console.warn('Could not collect performance stats:', error);
      return {
        cacheHitRatio: 0,
        indexHitRatio: 0,
        slowQueries: 0,
        totalQueries: 0,
        avgQueryTime: 0
      };
    }
  }

  private async getLockStats(): Promise<DatabaseMetrics['locks']> {
    try {
      const { data: lockData } = await this.supabase
        .rpc('get_lock_stats')
        .single();

      return (lockData as any) || {
        total: 0,
        waiting: 0,
        granted: 0
      };
    } catch (error) {
      console.warn('Could not collect lock stats:', error);
      return {
        total: 0,
        waiting: 0,
        granted: 0
      };
    }
  }

  private async getTableStats(): Promise<DatabaseMetrics['tableStats']> {
    try {
      const { data: tableData } = await this.supabase
        .rpc('get_table_stats')
        .single();

      return (tableData as any) || {
        sequentialScans: 0,
        indexScans: 0,
        rowsInserted: 0,
        rowsUpdated: 0,
        rowsDeleted: 0
      };
    } catch (error) {
      console.warn('Could not collect table stats:', error);
      return {
        sequentialScans: 0,
        indexScans: 0,
        rowsInserted: 0,
        rowsUpdated: 0,
        rowsDeleted: 0
      };
    }
  }

  private addToHistory(metrics: DatabaseMetrics): void {
    this.metricsHistory.push(metrics);
    
    // Keep only the last maxHistorySize measurements
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory = this.metricsHistory.slice(-this.maxHistorySize);
    }
  }

  private checkAlerts(metrics: DatabaseMetrics): void {
    const alerts: DatabaseAlert[] = [];

    // Connection usage alert
    if (metrics.connections.usagePercent > this.alertThresholds.connectionUsage) {
      alerts.push({
        type: 'connections',
        value: metrics.connections.usagePercent,
        threshold: this.alertThresholds.connectionUsage,
        message: `High database connection usage: ${metrics.connections.usagePercent.toFixed(1)}%`,
        timestamp: metrics.timestamp,
        severity: metrics.connections.usagePercent > 95 ? 'critical' : 'warning'
      });
    }

    // Cache hit ratio alert
    if (metrics.performance.cacheHitRatio < this.alertThresholds.cacheHitRatio) {
      alerts.push({
        type: 'performance',
        value: metrics.performance.cacheHitRatio,
        threshold: this.alertThresholds.cacheHitRatio,
        message: `Low database cache hit ratio: ${metrics.performance.cacheHitRatio.toFixed(1)}%`,
        timestamp: metrics.timestamp,
        severity: metrics.performance.cacheHitRatio < 90 ? 'critical' : 'warning'
      });
    }

    // Index hit ratio alert
    if (metrics.performance.indexHitRatio < this.alertThresholds.indexHitRatio) {
      alerts.push({
        type: 'performance',
        value: metrics.performance.indexHitRatio,
        threshold: this.alertThresholds.indexHitRatio,
        message: `Low index hit ratio: ${metrics.performance.indexHitRatio.toFixed(1)}%`,
        timestamp: metrics.timestamp,
        severity: metrics.performance.indexHitRatio < 90 ? 'critical' : 'warning'
      });
    }

    // Slow query alert
    if (metrics.performance.slowQueries > this.alertThresholds.slowQueryCount) {
      alerts.push({
        type: 'performance',
        value: metrics.performance.slowQueries,
        threshold: this.alertThresholds.slowQueryCount,
        message: `High number of slow queries: ${metrics.performance.slowQueries}`,
        timestamp: metrics.timestamp,
        severity: metrics.performance.slowQueries > 20 ? 'critical' : 'warning'
      });
    }

    // Lock contention alert
    if (metrics.locks.waiting > 0) {
      alerts.push({
        type: 'locks',
        value: metrics.locks.waiting,
        threshold: 0,
        message: `Database lock contention detected: ${metrics.locks.waiting} waiting locks`,
        timestamp: metrics.timestamp,
        severity: metrics.locks.waiting > 5 ? 'critical' : 'warning'
      });
    }

    // Emit alerts
    alerts.forEach(alert => this.emit('alert', alert));
  }

  getLatestMetrics(): DatabaseMetrics | null {
    return this.metricsHistory.length > 0 ? 
      this.metricsHistory[this.metricsHistory.length - 1] : null;
  }

  getMetricsHistory(limit?: number): DatabaseMetrics[] {
    if (limit) {
      return this.metricsHistory.slice(-limit);
    }
    return [...this.metricsHistory];
  }

  updateAlertThresholds(thresholds: Partial<DatabaseAlertThresholds>): void {
    this.alertThresholds = { ...this.alertThresholds, ...thresholds };
    this.emit('thresholds-updated', this.alertThresholds);
  }

  getAlertThresholds(): DatabaseAlertThresholds {
    return { ...this.alertThresholds };
  }

  clearHistory(): void {
    this.metricsHistory = [];
    this.emit('history-cleared');
  }

  isActive(): boolean {
    return this.isMonitoring;
  }

  // Method to create necessary monitoring functions in Supabase
  async setupMonitoringFunctions(): Promise<void> {
    try {
      // These would typically be created as Supabase functions or stored procedures
      // For now, we'll use direct SQL queries where possible
      
      console.log('Database monitoring functions setup would be implemented here');
      console.log('Consider creating custom SQL functions for more detailed monitoring');
      
    } catch (error) {
      console.error('Error setting up monitoring functions:', error);
    }
  }
} 