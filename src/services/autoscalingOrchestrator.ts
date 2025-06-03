import { EventEmitter } from 'events';
import { AutoscalingPolicyEngine, ScalingDecision, ScalingEvent } from './autoscalingPolicyEngine';
import { ProcessClusterManager, ClusterStatus } from './processClusterManager';
import { ResourceMonitoringService, SystemMetrics } from './resourceMonitoringService';
import { DatabaseMonitoringService, DatabaseMetrics } from './databaseMonitoringService';

export interface AutoscalingMetrics {
  system: SystemMetrics;
  database: DatabaseMetrics;
  cluster: ClusterStatus;
  responseTime?: number;
  timestamp: number;
}

export interface AutoscalingStatus {
  enabled: boolean;
  currentInstances: number;
  targetInstances: number;
  lastScalingAction: number;
  lastDecision: ScalingDecision | null;
  metrics: AutoscalingMetrics | null;
  totalScalingEvents: number;
  successfulScalingEvents: number;
  failedScalingEvents: number;
}

export interface AutoscalingOrchestatorConfig {
  enabled: boolean;
  evaluationInterval: number;
  metricsCollectionInterval: number;
  enableResponseTimeTracking: boolean;
  enablePredictiveScaling: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export class AutoscalingOrchestrator extends EventEmitter {
  private config: AutoscalingOrchestatorConfig;
  private policyEngine: AutoscalingPolicyEngine;
  private clusterManager: ProcessClusterManager;
  private resourceMonitor: ResourceMonitoringService;
  private databaseMonitor: DatabaseMonitoringService;
  
  private evaluationInterval: NodeJS.Timeout | null = null;
  private metricsCollectionInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  
  private currentMetrics: AutoscalingMetrics | null = null;
  private lastDecision: ScalingDecision | null = null;
  private scalingEvents: ScalingEvent[] = [];
  private responseTimeHistory: number[] = [];
  
  private totalScalingEvents = 0;
  private successfulScalingEvents = 0;
  private failedScalingEvents = 0;

  private defaultConfig: AutoscalingOrchestatorConfig = {
    enabled: true,
    evaluationInterval: 30000, // 30 seconds
    metricsCollectionInterval: 10000, // 10 seconds
    enableResponseTimeTracking: false, // Requires integration with Express
    enablePredictiveScaling: false,
    logLevel: 'info'
  };

  constructor(
    policyEngine: AutoscalingPolicyEngine,
    clusterManager: ProcessClusterManager,
    resourceMonitor: ResourceMonitoringService,
    databaseMonitor: DatabaseMonitoringService,
    config?: Partial<AutoscalingOrchestatorConfig>
  ) {
    super();
    
    this.policyEngine = policyEngine;
    this.clusterManager = clusterManager;
    this.resourceMonitor = resourceMonitor;
    this.databaseMonitor = databaseMonitor;
    
    this.config = { ...this.defaultConfig, ...config };
    
    this.setupEventListeners();
  }

  /**
   * Setup event listeners for all components
   */
  private setupEventListeners(): void {
    // Policy engine events
    this.policyEngine.on('scaling-decision', (decision: ScalingDecision) => {
      this.lastDecision = decision;
      this.emit('scaling-decision', decision);
      
      if (decision.action !== 'no-change') {
        this.log('info', `Scaling decision: ${decision.action} to ${decision.targetInstances} instances (${decision.reason})`);
      }
    });

    this.policyEngine.on('scaling-action', (event: ScalingEvent) => {
      this.emit('scaling-action', event);
    });

    // Cluster manager events
    this.clusterManager.on('worker-spawned', (event) => {
      this.log('info', `Worker spawned: ${event.workerId} (PID: ${event.pid})`);
      this.emit('worker-spawned', event);
    });

    this.clusterManager.on('worker-died', (event) => {
      this.log('warn', `Worker died: ${event.workerId} (PID: ${event.pid})`);
      this.emit('worker-died', event);
    });

    this.clusterManager.on('scaling-complete', (event) => {
      this.log('info', `Scaling complete: ${event.data.activeWorkers} active workers`);
      this.emit('scaling-complete', event);
    });

    // Resource monitor events
    this.resourceMonitor.on('alert', (alert) => {
      this.log('warn', `Resource alert: ${alert.message}`);
      this.emit('resource-alert', alert);
    });

    // Database monitor events
    this.databaseMonitor.on('alert', (alert) => {
      this.log('warn', `Database alert: ${alert.message}`);
      this.emit('database-alert', alert);
    });
  }

  /**
   * Start autoscaling orchestration
   */
  start(): void {
    if (this.isRunning) {
      this.log('warn', 'Autoscaling is already running');
      return;
    }

    if (!this.config.enabled) {
      this.log('info', 'Autoscaling is disabled');
      return;
    }

    // Only run in primary process
    if (!this.clusterManager.isPrimary()) {
      this.log('debug', 'Not running autoscaling in worker process');
      return;
    }

    this.log('info', 'Starting autoscaling orchestrator...');
    this.isRunning = true;

    // Start monitoring services
    this.resourceMonitor.startMonitoring();
    this.databaseMonitor.startMonitoring();

    // Start metrics collection
    this.startMetricsCollection();

    // Start evaluation loop
    this.startEvaluationLoop();

    this.emit('started');
    this.log('info', '✅ Autoscaling orchestrator started successfully');
  }

  /**
   * Stop autoscaling orchestration
   */
  stop(): void {
    if (!this.isRunning) {
      this.log('warn', 'Autoscaling is not running');
      return;
    }

    this.log('info', 'Stopping autoscaling orchestrator...');
    this.isRunning = false;

    // Stop intervals
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
      this.evaluationInterval = null;
    }

    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
      this.metricsCollectionInterval = null;
    }

    // Stop monitoring services
    this.resourceMonitor.stopMonitoring();
    this.databaseMonitor.stopMonitoring();

    this.emit('stopped');
    this.log('info', '✅ Autoscaling orchestrator stopped');
  }

  /**
   * Start metrics collection loop
   */
  private startMetricsCollection(): void {
    this.metricsCollectionInterval = setInterval(() => {
      this.collectMetrics();
    }, this.config.metricsCollectionInterval);

    this.log('debug', `Metrics collection started (interval: ${this.config.metricsCollectionInterval}ms)`);
  }

  /**
   * Start evaluation loop
   */
  private startEvaluationLoop(): void {
    this.evaluationInterval = setInterval(() => {
      this.evaluateScaling();
    }, this.config.evaluationInterval);

    this.log('debug', `Evaluation loop started (interval: ${this.config.evaluationInterval}ms)`);
  }

  /**
   * Collect current metrics from all sources
   */
  private async collectMetrics(): Promise<void> {
    try {
      const [systemMetrics, databaseMetrics] = await Promise.all([
        this.getLatestSystemMetrics(),
        this.getLatestDatabaseMetrics()
      ]);

      if (!systemMetrics || !databaseMetrics) {
        this.log('warn', 'Could not collect complete metrics');
        return;
      }

      const clusterStatus = this.clusterManager.getClusterStatus();
      const responseTime = this.getAverageResponseTime();

      this.currentMetrics = {
        system: systemMetrics,
        database: databaseMetrics,
        cluster: clusterStatus,
        responseTime,
        timestamp: Date.now()
      };

      this.emit('metrics-collected', this.currentMetrics);

    } catch (error) {
      this.log('error', `Error collecting metrics: ${error}`);
    }
  }

  /**
   * Evaluate scaling decisions
   */
  private evaluateScaling(): void {
    if (!this.currentMetrics) {
      this.log('warn', 'No metrics available for scaling evaluation');
      return;
    }

    try {
      const decision = this.policyEngine.evaluateScaling(
        this.currentMetrics.system,
        this.currentMetrics.database,
        this.currentMetrics.cluster.activeWorkers,
        this.currentMetrics.responseTime
      );

      if (decision.action !== 'no-change') {
        this.executeScalingDecision(decision);
      }

    } catch (error) {
      this.log('error', `Error during scaling evaluation: ${error}`);
    }
  }

  /**
   * Execute scaling decision
   */
  private async executeScalingDecision(decision: ScalingDecision): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.log('info', `Executing scaling decision: ${decision.action} to ${decision.targetInstances} instances`);
      
      const clusterStatus = await this.clusterManager.scaleWorkers(decision.targetInstances);
      const executionTime = Date.now() - startTime;

      const scalingEvent: ScalingEvent = {
        decision,
        success: true,
        actualInstancesAfter: clusterStatus.activeWorkers,
        executionTimeMs: executionTime
      };

      this.recordScalingEvent(scalingEvent);
      this.policyEngine.recordScalingAction(scalingEvent);

      this.log('info', `✅ Scaling completed successfully in ${executionTime}ms`);

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      const scalingEvent: ScalingEvent = {
        decision,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTimeMs: executionTime
      };

      this.recordScalingEvent(scalingEvent);
      this.policyEngine.recordScalingAction(scalingEvent);

      this.log('error', `❌ Scaling failed: ${error}`);
    }
  }

  /**
   * Record scaling event for statistics
   */
  private recordScalingEvent(event: ScalingEvent): void {
    this.scalingEvents.push(event);
    this.totalScalingEvents++;
    
    if (event.success) {
      this.successfulScalingEvents++;
    } else {
      this.failedScalingEvents++;
    }

    // Keep only last 100 events
    if (this.scalingEvents.length > 100) {
      this.scalingEvents = this.scalingEvents.slice(-100);
    }

    this.emit('scaling-event-recorded', event);
  }

  /**
   * Get latest system metrics
   */
  private async getLatestSystemMetrics(): Promise<SystemMetrics | null> {
    try {
      const metrics = this.resourceMonitor.getLatestMetrics();
      return metrics || null;
    } catch (error) {
      this.log('error', `Error getting system metrics: ${error}`);
      return null;
    }
  }

  /**
   * Get latest database metrics
   */
  private async getLatestDatabaseMetrics(): Promise<DatabaseMetrics | null> {
    try {
      const metrics = this.databaseMonitor.getLatestMetrics();
      return metrics || null;
    } catch (error) {
      this.log('error', `Error getting database metrics: ${error}`);
      return null;
    }
  }

  /**
   * Get average response time from recent history
   */
  private getAverageResponseTime(): number | undefined {
    if (!this.config.enableResponseTimeTracking || this.responseTimeHistory.length === 0) {
      return undefined;
    }

    const sum = this.responseTimeHistory.reduce((a, b) => a + b, 0);
    return sum / this.responseTimeHistory.length;
  }

  /**
   * Add response time measurement
   */
  addResponseTime(responseTimeMs: number): void {
    if (!this.config.enableResponseTimeTracking) {
      return;
    }

    this.responseTimeHistory.push(responseTimeMs);
    
    // Keep only last 100 measurements
    if (this.responseTimeHistory.length > 100) {
      this.responseTimeHistory = this.responseTimeHistory.slice(-100);
    }
  }

  /**
   * Get current autoscaling status
   */
  getStatus(): AutoscalingStatus {
    const clusterStatus = this.clusterManager.getClusterStatus();
    
    return {
      enabled: this.config.enabled,
      currentInstances: clusterStatus.activeWorkers,
      targetInstances: clusterStatus.targetWorkers,
      lastScalingAction: this.scalingEvents.length > 0 
        ? this.scalingEvents[this.scalingEvents.length - 1].decision.timestamp 
        : 0,
      lastDecision: this.lastDecision,
      metrics: this.currentMetrics,
      totalScalingEvents: this.totalScalingEvents,
      successfulScalingEvents: this.successfulScalingEvents,
      failedScalingEvents: this.failedScalingEvents
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AutoscalingOrchestatorConfig>): void {
    const wasRunning = this.isRunning;
    
    // Stop if running
    if (wasRunning) {
      this.stop();
    }

    // Update config
    this.config = { ...this.config, ...newConfig };
    
    // Restart if was running
    if (wasRunning && this.config.enabled) {
      this.start();
    }

    this.emit('config-updated', this.config);
    this.log('info', 'Autoscaling configuration updated');
  }

  /**
   * Force scaling to specific instance count
   */
  async forceScale(targetInstances: number): Promise<ClusterStatus> {
    this.log('info', `Force scaling to ${targetInstances} instances`);
    
    const clusterStatus = await this.clusterManager.scaleWorkers(targetInstances);
    
    // Record manual scaling event
    const scalingEvent: ScalingEvent = {
      decision: {
        action: targetInstances > clusterStatus.activeWorkers ? 'scale-up' : 'scale-down',
        reason: 'Manual scaling',
        targetInstances,
        currentInstances: clusterStatus.activeWorkers,
        metrics: this.currentMetrics?.system ? {
          cpu: this.currentMetrics.system.cpu.usage,
          memory: this.currentMetrics.system.memory.usagePercent,
          dbConnections: this.currentMetrics.database.connections.usagePercent,
          cacheHitRatio: this.currentMetrics.database.performance.cacheHitRatio
        } : { cpu: 0, memory: 0, dbConnections: 0, cacheHitRatio: 0 },
        timestamp: Date.now(),
        confidence: 1.0
      },
      success: true,
      actualInstancesAfter: clusterStatus.activeWorkers,
      executionTimeMs: 0
    };

    this.recordScalingEvent(scalingEvent);
    
    return clusterStatus;
  }

  /**
   * Get scaling history
   */
  getScalingHistory(): ScalingEvent[] {
    return [...this.scalingEvents];
  }

  /**
   * Get configuration
   */
  getConfig(): AutoscalingOrchestatorConfig {
    return { ...this.config };
  }

  /**
   * Log with configured level
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const configLevel = levels[this.config.logLevel];
    const messageLevel = levels[level];

    if (messageLevel >= configLevel) {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [AUTOSCALING] [${level.toUpperCase()}]`;
      console.log(`${prefix} ${message}`);
    }
  }

  /**
   * Check if autoscaling is running
   */
  isEnabled(): boolean {
    return this.config.enabled && this.isRunning;
  }
} 