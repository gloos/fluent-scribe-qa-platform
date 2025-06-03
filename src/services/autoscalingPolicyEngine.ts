import { EventEmitter } from 'events';
import * as os from 'os';
import { SystemMetrics } from './resourceMonitoringService';
import { DatabaseMetrics } from './databaseMonitoringService';

export interface ScalingThresholds {
  cpu: {
    scaleUp: number;
    scaleDown: number;
  };
  memory: {
    scaleUp: number;
    scaleDown: number;
  };
  database: {
    connectionUsage: number;
    cacheHitRatio: number;
  };
  responseTime: {
    averageMs: number;
  };
}

export interface ScalingLimits {
  minInstances: number;
  maxInstances: number;
  cooldownMs: number;
  scaleUpCooldownMs?: number;
  scaleDownCooldownMs?: number;
}

export interface ScalingDecision {
  action: 'scale-up' | 'scale-down' | 'no-change';
  reason: string;
  targetInstances: number;
  currentInstances: number;
  metrics: {
    cpu: number;
    memory: number;
    dbConnections: number;
    cacheHitRatio: number;
  };
  timestamp: number;
  confidence: number; // 0-1 scale
}

export interface ScalingEvent {
  decision: ScalingDecision;
  success: boolean;
  error?: string;
  actualInstancesAfter?: number;
  executionTimeMs: number;
}

export interface AutoscalingConfig {
  thresholds: ScalingThresholds;
  limits: ScalingLimits;
  evaluationWindowMs: number;
  requireConsecutiveViolations: number;
  enablePredictiveScaling: boolean;
  enableDatabaseAwareScaling: boolean;
}

export class AutoscalingPolicyEngine extends EventEmitter {
  private config: AutoscalingConfig;
  private lastScalingAction: number = 0;
  private consecutiveViolations: number = 0;
  private currentViolationType: 'scale-up' | 'scale-down' | null = null;
  private metricsHistory: Array<{
    system: SystemMetrics;
    database: DatabaseMetrics;
    timestamp: number;
  }> = [];
  private maxHistorySize = 100;

  private defaultConfig: AutoscalingConfig = {
    thresholds: {
      cpu: {
        scaleUp: 70,    // Scale up when CPU > 70%
        scaleDown: 30   // Scale down when CPU < 30%
      },
      memory: {
        scaleUp: 80,    // Scale up when memory > 80%
        scaleDown: 40   // Scale down when memory < 40%
      },
      database: {
        connectionUsage: 75,  // Scale up when DB connections > 75%
        cacheHitRatio: 90     // Scale up when cache hit ratio < 90%
      },
      responseTime: {
        averageMs: 1000       // Scale up when avg response time > 1000ms
      }
    },
    limits: {
      minInstances: 1,
      maxInstances: Math.max(2, os.cpus().length), // Max = CPU cores, min 2
      cooldownMs: 60000,        // 1 minute general cooldown
      scaleUpCooldownMs: 30000, // 30 seconds for scale up
      scaleDownCooldownMs: 300000 // 5 minutes for scale down
    },
    evaluationWindowMs: 60000,    // Evaluate over 1 minute window
    requireConsecutiveViolations: 3, // Require 3 consecutive violations
    enablePredictiveScaling: false,  // Disable predictive scaling initially
    enableDatabaseAwareScaling: true // Enable database-aware scaling
  };

  constructor(config?: Partial<AutoscalingConfig>) {
    super();
    this.config = {
      ...this.defaultConfig,
      ...config,
      thresholds: {
        ...this.defaultConfig.thresholds,
        ...config?.thresholds
      },
      limits: {
        ...this.defaultConfig.limits,
        ...config?.limits
      }
    };
  }

  /**
   * Evaluate scaling decision based on current metrics
   */
  evaluateScaling(
    systemMetrics: SystemMetrics,
    databaseMetrics: DatabaseMetrics,
    currentInstances: number,
    responseTimeMs?: number
  ): ScalingDecision {
    const now = Date.now();
    
    // Add to metrics history
    this.addMetricsToHistory(systemMetrics, databaseMetrics, now);

    // Check cooldown periods
    const timeSinceLastAction = now - this.lastScalingAction;
    const scaleUpCooldown = this.config.limits.scaleUpCooldownMs || this.config.limits.cooldownMs;
    const scaleDownCooldown = this.config.limits.scaleDownCooldownMs || this.config.limits.cooldownMs;

    // Analyze metrics for scaling signals
    const analysisResult = this.analyzeMetrics(systemMetrics, databaseMetrics, responseTimeMs);
    
    let decision: ScalingDecision = {
      action: 'no-change',
      reason: 'Metrics within acceptable ranges',
      targetInstances: currentInstances,
      currentInstances,
      metrics: {
        cpu: systemMetrics.cpu.usage,
        memory: systemMetrics.memory.usagePercent,
        dbConnections: databaseMetrics.connections.usagePercent,
        cacheHitRatio: databaseMetrics.performance.cacheHitRatio
      },
      timestamp: now,
      confidence: 0.5
    };

    // Check for scale-up conditions
    if (analysisResult.shouldScaleUp && currentInstances < this.config.limits.maxInstances) {
      if (timeSinceLastAction >= scaleUpCooldown) {
        if (this.checkConsecutiveViolations('scale-up')) {
          decision = {
            action: 'scale-up',
            reason: analysisResult.scaleUpReason,
            targetInstances: Math.min(currentInstances + 1, this.config.limits.maxInstances),
            currentInstances,
            metrics: decision.metrics,
            timestamp: now,
            confidence: analysisResult.confidence
          };
        } else {
          decision.reason = `Scale-up signal detected but waiting for ${this.config.requireConsecutiveViolations - this.consecutiveViolations} more consecutive violations`;
        }
      } else {
        decision.reason = `Scale-up needed but in cooldown (${Math.round((scaleUpCooldown - timeSinceLastAction) / 1000)}s remaining)`;
      }
    }
    // Check for scale-down conditions
    else if (analysisResult.shouldScaleDown && currentInstances > this.config.limits.minInstances) {
      if (timeSinceLastAction >= scaleDownCooldown) {
        if (this.checkConsecutiveViolations('scale-down')) {
          decision = {
            action: 'scale-down',
            reason: analysisResult.scaleDownReason,
            targetInstances: Math.max(currentInstances - 1, this.config.limits.minInstances),
            currentInstances,
            metrics: decision.metrics,
            timestamp: now,
            confidence: analysisResult.confidence
          };
        } else {
          decision.reason = `Scale-down signal detected but waiting for ${this.config.requireConsecutiveViolations - this.consecutiveViolations} more consecutive violations`;
        }
      } else {
        decision.reason = `Scale-down possible but in cooldown (${Math.round((scaleDownCooldown - timeSinceLastAction) / 1000)}s remaining)`;
      }
    } else {
      // Reset consecutive violations if no scaling needed
      this.resetConsecutiveViolations();
    }

    // Emit decision event
    this.emit('scaling-decision', decision);

    return decision;
  }

  /**
   * Analyze metrics to determine scaling needs
   */
  private analyzeMetrics(
    systemMetrics: SystemMetrics,
    databaseMetrics: DatabaseMetrics,
    responseTimeMs?: number
  ): {
    shouldScaleUp: boolean;
    shouldScaleDown: boolean;
    scaleUpReason: string;
    scaleDownReason: string;
    confidence: number;
  } {
    const violations: string[] = [];
    const scaleDownReasons: string[] = [];
    let confidence = 0.5;

    // CPU analysis
    if (systemMetrics.cpu.usage > this.config.thresholds.cpu.scaleUp) {
      violations.push(`High CPU usage: ${systemMetrics.cpu.usage.toFixed(1)}% > ${this.config.thresholds.cpu.scaleUp}%`);
      confidence += 0.2;
    } else if (systemMetrics.cpu.usage < this.config.thresholds.cpu.scaleDown) {
      scaleDownReasons.push(`Low CPU usage: ${systemMetrics.cpu.usage.toFixed(1)}% < ${this.config.thresholds.cpu.scaleDown}%`);
    }

    // Memory analysis
    if (systemMetrics.memory.usagePercent > this.config.thresholds.memory.scaleUp) {
      violations.push(`High memory usage: ${systemMetrics.memory.usagePercent.toFixed(1)}% > ${this.config.thresholds.memory.scaleUp}%`);
      confidence += 0.2;
    } else if (systemMetrics.memory.usagePercent < this.config.thresholds.memory.scaleDown) {
      scaleDownReasons.push(`Low memory usage: ${systemMetrics.memory.usagePercent.toFixed(1)}% < ${this.config.thresholds.memory.scaleDown}%`);
    }

    // Database analysis (if enabled)
    if (this.config.enableDatabaseAwareScaling) {
      if (databaseMetrics.connections.usagePercent > this.config.thresholds.database.connectionUsage) {
        violations.push(`High DB connection usage: ${databaseMetrics.connections.usagePercent.toFixed(1)}% > ${this.config.thresholds.database.connectionUsage}%`);
        confidence += 0.15;
      }

      if (databaseMetrics.performance.cacheHitRatio < this.config.thresholds.database.cacheHitRatio) {
        violations.push(`Low DB cache hit ratio: ${databaseMetrics.performance.cacheHitRatio.toFixed(1)}% < ${this.config.thresholds.database.cacheHitRatio}%`);
        confidence += 0.1;
      }
    }

    // Response time analysis
    if (responseTimeMs && responseTimeMs > this.config.thresholds.responseTime.averageMs) {
      violations.push(`High response time: ${responseTimeMs}ms > ${this.config.thresholds.responseTime.averageMs}ms`);
      confidence += 0.25;
    }

    // Determine scaling decision
    const shouldScaleUp = violations.length > 0;
    const shouldScaleDown = violations.length === 0 && scaleDownReasons.length >= 2; // Require multiple reasons for scale down

    return {
      shouldScaleUp,
      shouldScaleDown,
      scaleUpReason: violations.join(', '),
      scaleDownReason: scaleDownReasons.join(', '),
      confidence: Math.min(confidence, 1.0)
    };
  }

  /**
   * Check if we have enough consecutive violations to trigger scaling
   */
  private checkConsecutiveViolations(violationType: 'scale-up' | 'scale-down'): boolean {
    if (this.currentViolationType === violationType) {
      this.consecutiveViolations++;
    } else {
      this.currentViolationType = violationType;
      this.consecutiveViolations = 1;
    }

    return this.consecutiveViolations >= this.config.requireConsecutiveViolations;
  }

  /**
   * Reset consecutive violations counter
   */
  private resetConsecutiveViolations(): void {
    this.consecutiveViolations = 0;
    this.currentViolationType = null;
  }

  /**
   * Record that a scaling action was executed
   */
  recordScalingAction(event: ScalingEvent): void {
    this.lastScalingAction = Date.now();
    this.resetConsecutiveViolations();
    this.emit('scaling-action', event);
  }

  /**
   * Add metrics to history for analysis
   */
  private addMetricsToHistory(
    systemMetrics: SystemMetrics,
    databaseMetrics: DatabaseMetrics,
    timestamp: number
  ): void {
    this.metricsHistory.push({
      system: systemMetrics,
      database: databaseMetrics,
      timestamp
    });

    // Trim history to max size
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory = this.metricsHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get historical metrics for analysis
   */
  getMetricsHistory(timeWindowMs?: number): Array<{
    system: SystemMetrics;
    database: DatabaseMetrics;
    timestamp: number;
  }> {
    if (!timeWindowMs) {
      return [...this.metricsHistory];
    }

    const cutoffTime = Date.now() - timeWindowMs;
    return this.metricsHistory.filter(entry => entry.timestamp >= cutoffTime);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AutoscalingConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
      thresholds: {
        ...this.config.thresholds,
        ...newConfig.thresholds
      },
      limits: {
        ...this.config.limits,
        ...newConfig.limits
      }
    };

    this.emit('config-updated', this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): AutoscalingConfig {
    return { ...this.config };
  }

  /**
   * Get scaling statistics
   */
  getScalingStats(): {
    timeSinceLastAction: number;
    consecutiveViolations: number;
    currentViolationType: string | null;
    historySize: number;
  } {
    return {
      timeSinceLastAction: Date.now() - this.lastScalingAction,
      consecutiveViolations: this.consecutiveViolations,
      currentViolationType: this.currentViolationType,
      historySize: this.metricsHistory.length
    };
  }
}

// Export singleton instance
export const autoscalingPolicyEngine = new AutoscalingPolicyEngine(); 