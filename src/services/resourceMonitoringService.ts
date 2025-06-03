import { EventEmitter } from 'events';
import * as si from 'systeminformation';
import * as osUtils from 'node-os-utils';
import * as os from 'os';

export interface SystemMetrics {
  timestamp: number;
  cpu: {
    usage: number;
    temperature: number | null;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  disk: {
    readSpeed: number;
    writeSpeed: number;
    totalSpace: number;
    usedSpace: number;
    freeSpace: number;
    usagePercent: number;
  };
  network: {
    rx: number;
    tx: number;
    rxSec: number;
    txSec: number;
  };
  processes: {
    total: number;
    running: number;
    blocked: number;
    sleeping: number;
  };
}

export interface AlertThreshold {
  cpu: number;
  memory: number;
  disk: number;
  temperature?: number;
}

export interface Alert {
  type: 'cpu' | 'memory' | 'disk' | 'temperature';
  value: number;
  threshold: number;
  message: string;
  timestamp: number;
  severity: 'warning' | 'critical';
}

export class ResourceMonitoringService extends EventEmitter {
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private previousNetworkStats: { rx: number; tx: number; timestamp: number } | null = null;
  private metricsHistory: SystemMetrics[] = [];
  private maxHistorySize = 1000; // Keep last 1000 measurements
  
  private defaultThresholds: AlertThreshold = {
    cpu: 80, // 80% CPU usage
    memory: 85, // 85% memory usage
    disk: 90, // 90% disk usage
    temperature: 80 // 80°C temperature
  };

  private alertThresholds: AlertThreshold;

  constructor(thresholds?: Partial<AlertThreshold>) {
    super();
    this.alertThresholds = { ...this.defaultThresholds, ...thresholds };
  }

  async startMonitoring(intervalMs: number = 5000): Promise<void> {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    console.log(`Starting resource monitoring with ${intervalMs}ms interval`);

    // Take initial measurement
    await this.collectMetrics();

    // Set up periodic monitoring
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
      } catch (error) {
        console.error('Error collecting metrics:', error);
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

    console.log('Resource monitoring stopped');
    this.emit('monitoring-stopped');
  }

  private async collectMetrics(): Promise<void> {
    try {
      const timestamp = Date.now();

      // Collect CPU information
      const cpuInfo = await si.cpu();
      const cpuLoad = await si.currentLoad();
      const cpuTemp = await si.cpuTemperature();
      const loadAvg = os.loadavg();

      // Collect memory information
      const memInfo = await si.mem();

      // Collect disk information
      const diskInfo = await si.disksIO();
      const diskLayout = await si.diskLayout();
      const fsSize = await si.fsSize();

      // Collect network information
      const networkStats = await si.networkStats();
      
      // Collect process information
      const processInfo = await si.processes();

      // Calculate network speed (bytes per second)
      let rxSec = 0;
      let txSec = 0;
      
      if (this.previousNetworkStats && networkStats.length > 0) {
        const currentStats = networkStats[0];
        const timeDiff = (timestamp - this.previousNetworkStats.timestamp) / 1000; // seconds
        
        rxSec = (currentStats.rx_bytes - this.previousNetworkStats.rx) / timeDiff;
        txSec = (currentStats.tx_bytes - this.previousNetworkStats.tx) / timeDiff;
      }

      // Update previous network stats
      if (networkStats.length > 0) {
        this.previousNetworkStats = {
          rx: networkStats[0].rx_bytes,
          tx: networkStats[0].tx_bytes,
          timestamp
        };
      }

      // Calculate disk usage
      const totalDiskSpace = fsSize.reduce((sum, fs) => sum + fs.size, 0);
      const usedDiskSpace = fsSize.reduce((sum, fs) => sum + fs.used, 0);
      const freeDiskSpace = totalDiskSpace - usedDiskSpace;
      const diskUsagePercent = totalDiskSpace > 0 ? (usedDiskSpace / totalDiskSpace) * 100 : 0;

      const metrics: SystemMetrics = {
        timestamp,
        cpu: {
          usage: cpuLoad.currentLoad,
          temperature: cpuTemp.main || null,
          loadAverage: loadAvg
        },
        memory: {
          total: memInfo.total,
          used: memInfo.used,
          free: memInfo.free,
          usagePercent: (memInfo.used / memInfo.total) * 100
        },
        disk: {
          readSpeed: diskInfo.rIO_sec || 0,
          writeSpeed: diskInfo.wIO_sec || 0,
          totalSpace: totalDiskSpace,
          usedSpace: usedDiskSpace,
          freeSpace: freeDiskSpace,
          usagePercent: diskUsagePercent
        },
        network: {
          rx: networkStats.length > 0 ? networkStats[0].rx_bytes : 0,
          tx: networkStats.length > 0 ? networkStats[0].tx_bytes : 0,
          rxSec,
          txSec
        },
        processes: {
          total: processInfo.all,
          running: processInfo.running,
          blocked: processInfo.blocked,
          sleeping: processInfo.sleeping
        }
      };

      // Add to history
      this.addToHistory(metrics);

      // Check for alerts
      this.checkAlerts(metrics);

      // Emit metrics
      this.emit('metrics', metrics);

    } catch (error) {
      console.error('Error collecting system metrics:', error);
      throw error;
    }
  }

  private addToHistory(metrics: SystemMetrics): void {
    this.metricsHistory.push(metrics);
    
    // Keep only the last maxHistorySize measurements
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory = this.metricsHistory.slice(-this.maxHistorySize);
    }
  }

  private checkAlerts(metrics: SystemMetrics): void {
    const alerts: Alert[] = [];

    // CPU usage alert
    if (metrics.cpu.usage > this.alertThresholds.cpu) {
      alerts.push({
        type: 'cpu',
        value: metrics.cpu.usage,
        threshold: this.alertThresholds.cpu,
        message: `High CPU usage: ${metrics.cpu.usage.toFixed(1)}%`,
        timestamp: metrics.timestamp,
        severity: metrics.cpu.usage > 95 ? 'critical' : 'warning'
      });
    }

    // Memory usage alert
    if (metrics.memory.usagePercent > this.alertThresholds.memory) {
      alerts.push({
        type: 'memory',
        value: metrics.memory.usagePercent,
        threshold: this.alertThresholds.memory,
        message: `High memory usage: ${metrics.memory.usagePercent.toFixed(1)}%`,
        timestamp: metrics.timestamp,
        severity: metrics.memory.usagePercent > 95 ? 'critical' : 'warning'
      });
    }

    // Disk usage alert
    if (metrics.disk.usagePercent > this.alertThresholds.disk) {
      alerts.push({
        type: 'disk',
        value: metrics.disk.usagePercent,
        threshold: this.alertThresholds.disk,
        message: `High disk usage: ${metrics.disk.usagePercent.toFixed(1)}%`,
        timestamp: metrics.timestamp,
        severity: metrics.disk.usagePercent > 98 ? 'critical' : 'warning'
      });
    }

    // Temperature alert (if available and threshold set)
    if (metrics.cpu.temperature && this.alertThresholds.temperature && 
        metrics.cpu.temperature > this.alertThresholds.temperature) {
      alerts.push({
        type: 'temperature',
        value: metrics.cpu.temperature,
        threshold: this.alertThresholds.temperature,
        message: `High CPU temperature: ${metrics.cpu.temperature.toFixed(1)}°C`,
        timestamp: metrics.timestamp,
        severity: metrics.cpu.temperature > 90 ? 'critical' : 'warning'
      });
    }

    // Emit alerts
    alerts.forEach(alert => this.emit('alert', alert));
  }

  getLatestMetrics(): SystemMetrics | null {
    return this.metricsHistory.length > 0 ? 
      this.metricsHistory[this.metricsHistory.length - 1] : null;
  }

  getMetricsHistory(limit?: number): SystemMetrics[] {
    if (limit) {
      return this.metricsHistory.slice(-limit);
    }
    return [...this.metricsHistory];
  }

  getAverageMetrics(timeWindowMs: number): Partial<SystemMetrics> | null {
    const cutoffTime = Date.now() - timeWindowMs;
    const recentMetrics = this.metricsHistory.filter(m => m.timestamp >= cutoffTime);
    
    if (recentMetrics.length === 0) {
      return null;
    }

    const avgCpu = recentMetrics.reduce((sum, m) => sum + m.cpu.usage, 0) / recentMetrics.length;
    const avgMemory = recentMetrics.reduce((sum, m) => sum + m.memory.usagePercent, 0) / recentMetrics.length;
    const avgDisk = recentMetrics.reduce((sum, m) => sum + m.disk.usagePercent, 0) / recentMetrics.length;

    return {
      timestamp: Date.now(),
      cpu: { usage: avgCpu, temperature: null, loadAverage: [] },
      memory: { 
        total: 0, 
        used: 0, 
        free: 0, 
        usagePercent: avgMemory 
      },
      disk: {
        readSpeed: 0,
        writeSpeed: 0,
        totalSpace: 0,
        usedSpace: 0,
        freeSpace: 0,
        usagePercent: avgDisk
      }
    };
  }

  updateAlertThresholds(thresholds: Partial<AlertThreshold>): void {
    this.alertThresholds = { ...this.alertThresholds, ...thresholds };
    this.emit('thresholds-updated', this.alertThresholds);
  }

  getAlertThresholds(): AlertThreshold {
    return { ...this.alertThresholds };
  }

  clearHistory(): void {
    this.metricsHistory = [];
    this.emit('history-cleared');
  }

  isActive(): boolean {
    return this.isMonitoring;
  }

  // Utility method to format bytes
  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Utility method to format percentage
  static formatPercent(value: number): string {
    return `${value.toFixed(1)}%`;
  }
}

// Export singleton instance
export const resourceMonitor = new ResourceMonitoringService(); 