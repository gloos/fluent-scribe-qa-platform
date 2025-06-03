import { EventEmitter } from 'events';
import { IncomingMessage, ServerResponse } from 'http';
import { ProcessClusterManager, ProcessHealth } from './processClusterManager';

export interface LoadBalancingStrategy {
  name: string;
  selectWorker(workers: ProcessHealth[], request?: IncomingMessage): ProcessHealth | null;
}

export interface SessionAffinityConfig {
  enabled: boolean;
  cookieName: string;
  headerName: string;
  sessionTimeoutMs: number;
}

export interface LoadBalancingConfig {
  strategy: 'round-robin' | 'least-connections' | 'weighted-round-robin' | 'health-based' | 'session-affinity';
  sessionAffinity: SessionAffinityConfig;
  healthCheckThreshold: number;
  enableStickySessions: boolean;
  requestTimeoutMs: number;
  retryAttempts: number;
}

export interface RoutingDecision {
  selectedWorker: ProcessHealth | null;
  strategy: string;
  reason: string;
  sessionId?: string;
  timestamp: number;
}

export interface LoadBalancingMetrics {
  totalRequests: number;
  requestsPerWorker: Map<number, number>;
  failedRequests: number;
  averageResponseTime: number;
  sessionAffinityHits: number;
  strategyUsage: Map<string, number>;
}

export class LoadBalancingService extends EventEmitter {
  private config: LoadBalancingConfig;
  private clusterManager: ProcessClusterManager;
  private currentWorkerIndex: number = 0;
  private sessionAffinityMap = new Map<string, number>(); // sessionId -> workerId
  private workerRequestCounts = new Map<number, number>();
  private metrics: LoadBalancingMetrics;
  private strategies = new Map<string, LoadBalancingStrategy>();

  private defaultConfig: LoadBalancingConfig = {
    strategy: 'health-based',
    sessionAffinity: {
      enabled: true,
      cookieName: 'qa-session-id',
      headerName: 'X-Session-ID',
      sessionTimeoutMs: 1800000 // 30 minutes
    },
    healthCheckThreshold: 0.8, // Only route to workers with health > 80%
    enableStickySessions: true,
    requestTimeoutMs: 30000, // 30 seconds
    retryAttempts: 2
  };

  constructor(
    clusterManager: ProcessClusterManager,
    config?: Partial<LoadBalancingConfig>
  ) {
    super();
    this.clusterManager = clusterManager;
    this.config = { ...this.defaultConfig, ...config };
    
    this.metrics = {
      totalRequests: 0,
      requestsPerWorker: new Map(),
      failedRequests: 0,
      averageResponseTime: 0,
      sessionAffinityHits: 0,
      strategyUsage: new Map()
    };

    this.initializeStrategies();
    this.setupEventListeners();
  }

  /**
   * Initialize load balancing strategies
   */
  private initializeStrategies(): void {
    // Round Robin Strategy
    this.strategies.set('round-robin', {
      name: 'Round Robin',
      selectWorker: (workers: ProcessHealth[]) => {
        if (workers.length === 0) return null;
        
        const worker = workers[this.currentWorkerIndex % workers.length];
        this.currentWorkerIndex = (this.currentWorkerIndex + 1) % workers.length;
        return worker;
      }
    });

    // Least Connections Strategy
    this.strategies.set('least-connections', {
      name: 'Least Connections',
      selectWorker: (workers: ProcessHealth[]) => {
        if (workers.length === 0) return null;
        
        return workers.reduce((least, current) => {
          const leastCount = this.workerRequestCounts.get(least.workerId) || 0;
          const currentCount = this.workerRequestCounts.get(current.workerId) || 0;
          return currentCount < leastCount ? current : least;
        });
      }
    });

    // Health-Based Strategy
    this.strategies.set('health-based', {
      name: 'Health Based',
      selectWorker: (workers: ProcessHealth[]) => {
        if (workers.length === 0) return null;
        
        // Filter healthy workers
        const healthyWorkers = workers.filter(w => 
          w.isHealthy && this.calculateWorkerHealthScore(w) >= this.config.healthCheckThreshold
        );
        
        if (healthyWorkers.length === 0) {
          // Fallback to least unhealthy worker
          return workers.reduce((best, current) => 
            this.calculateWorkerHealthScore(current) > this.calculateWorkerHealthScore(best) 
              ? current : best
          );
        }
        
        // Among healthy workers, select based on combination of health and load
        return healthyWorkers.reduce((best, current) => {
          const bestScore = this.calculateWorkerScore(best);
          const currentScore = this.calculateWorkerScore(current);
          return currentScore > bestScore ? current : best;
        });
      }
    });

    // Weighted Round Robin Strategy
    this.strategies.set('weighted-round-robin', {
      name: 'Weighted Round Robin',
      selectWorker: (workers: ProcessHealth[]) => {
        if (workers.length === 0) return null;
        
        // Weight based on worker health and available resources
        const weightedWorkers: Array<{ worker: ProcessHealth; weight: number }> = workers.map(worker => ({
          worker,
          weight: this.calculateWorkerScore(worker)
        }));
        
        // Select based on weighted probability
        const totalWeight = weightedWorkers.reduce((sum, w) => sum + w.weight, 0);
        if (totalWeight === 0) return workers[0]; // Fallback
        
        let random = Math.random() * totalWeight;
        for (const { worker, weight } of weightedWorkers) {
          random -= weight;
          if (random <= 0) return worker;
        }
        
        return workers[0]; // Fallback
      }
    });
  }

  /**
   * Setup event listeners for cluster manager
   */
  private setupEventListeners(): void {
    this.clusterManager.on('worker-spawned', (event) => {
      this.workerRequestCounts.set(event.workerId!, 0);
      this.emit('worker-added', event);
    });

    this.clusterManager.on('worker-died', (event) => {
      this.workerRequestCounts.delete(event.workerId!);
      this.emit('worker-removed', event);
    });
  }

  /**
   * Route a request to an appropriate worker
   */
  routeRequest(request: IncomingMessage, response?: ServerResponse): RoutingDecision {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    // Get available workers
    const clusterStatus = this.clusterManager.getClusterStatus();
    const availableWorkers = clusterStatus.workers.filter(w => w.isHealthy);

    let selectedWorker: ProcessHealth | null = null;
    let strategy = this.config.strategy;
    let reason = '';
    let sessionId: string | undefined;

    // Check for session affinity
    if (this.config.sessionAffinity.enabled && this.config.enableStickySessions) {
      sessionId = this.extractSessionId(request);
      
      if (sessionId) {
        const affinityWorkerId = this.sessionAffinityMap.get(sessionId);
        if (affinityWorkerId) {
          const affinityWorker = availableWorkers.find(w => w.workerId === affinityWorkerId);
          if (affinityWorker && affinityWorker.isHealthy) {
            selectedWorker = affinityWorker;
            strategy = 'session-affinity';
            reason = `Session affinity to worker ${affinityWorkerId}`;
            this.metrics.sessionAffinityHits++;
          } else {
            // Remove stale session affinity
            this.sessionAffinityMap.delete(sessionId);
          }
        }
      }
    }

    // If no session affinity or affinity worker unavailable, use configured strategy
    if (!selectedWorker) {
      const strategyImpl = this.strategies.get(this.config.strategy);
      if (strategyImpl) {
        selectedWorker = strategyImpl.selectWorker(availableWorkers, request);
        reason = `Selected by ${strategyImpl.name} strategy`;
      }
    }

    // Update metrics and tracking
    if (selectedWorker) {
      // Update request count for the selected worker
      const currentCount = this.workerRequestCounts.get(selectedWorker.workerId) || 0;
      this.workerRequestCounts.set(selectedWorker.workerId, currentCount + 1);

      // Create session affinity if enabled and session ID exists
      if (sessionId && this.config.sessionAffinity.enabled && strategy !== 'session-affinity') {
        this.sessionAffinityMap.set(sessionId, selectedWorker.workerId);
        
        // Set session timeout
        setTimeout(() => {
          this.sessionAffinityMap.delete(sessionId!);
        }, this.config.sessionAffinity.sessionTimeoutMs);
      }
    } else {
      this.metrics.failedRequests++;
      reason = 'No healthy workers available';
    }

    // Update strategy usage metrics
    const strategyCount = this.metrics.strategyUsage.get(strategy) || 0;
    this.metrics.strategyUsage.set(strategy, strategyCount + 1);

    const decision: RoutingDecision = {
      selectedWorker,
      strategy,
      reason,
      sessionId,
      timestamp: startTime
    };

    this.emit('request-routed', decision);
    return decision;
  }

  /**
   * Extract session ID from request headers or cookies
   */
  private extractSessionId(request: IncomingMessage): string | undefined {
    // Check custom header first
    const headerSessionId = request.headers[this.config.sessionAffinity.headerName.toLowerCase()];
    if (headerSessionId && typeof headerSessionId === 'string') {
      return headerSessionId;
    }

    // Check cookie
    const cookieHeader = request.headers.cookie;
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>);

      return cookies[this.config.sessionAffinity.cookieName];
    }

    return undefined;
  }

  /**
   * Calculate worker health score (0-1)
   */
  private calculateWorkerHealthScore(worker: ProcessHealth): number {
    if (!worker.isHealthy) return 0;

    // Calculate health based on memory usage (lower is better)
    const memoryUsagePercent = (worker.memoryUsage.heapUsed / worker.memoryUsage.heapTotal) * 100;
    const memoryScore = Math.max(0, (100 - memoryUsagePercent) / 100);

    // Calculate uptime score (higher is better, but cap at reasonable value)
    const uptimeHours = worker.uptime / (1000 * 60 * 60);
    const uptimeScore = Math.min(1, uptimeHours / 24); // Cap at 24 hours

    // Error rate score (lower errors is better)
    const errorRate = (worker.errors || 0) / Math.max(1, worker.requestsHandled || 1);
    const errorScore = Math.max(0, 1 - errorRate);

    // Weighted average
    return (memoryScore * 0.4) + (uptimeScore * 0.3) + (errorScore * 0.3);
  }

  /**
   * Calculate overall worker score including load balancing factors
   */
  private calculateWorkerScore(worker: ProcessHealth): number {
    const healthScore = this.calculateWorkerHealthScore(worker);
    
    // Load factor (lower current load is better)
    const currentLoad = this.workerRequestCounts.get(worker.workerId) || 0;
    const maxLoad = Math.max(...Array.from(this.workerRequestCounts.values()), 1);
    const loadScore = 1 - (currentLoad / maxLoad);

    // Combine health and load (favor health slightly more)
    return (healthScore * 0.6) + (loadScore * 0.4);
  }

  /**
   * Get current load balancing metrics
   */
  getMetrics(): LoadBalancingMetrics {
    return { ...this.metrics };
  }

  /**
   * Get session affinity status
   */
  getSessionAffinityStatus(): {
    activeSessions: number;
    sessionMap: Array<{ sessionId: string; workerId: number }>;
  } {
    return {
      activeSessions: this.sessionAffinityMap.size,
      sessionMap: Array.from(this.sessionAffinityMap.entries()).map(([sessionId, workerId]) => ({
        sessionId,
        workerId
      }))
    };
  }

  /**
   * Clear session affinity for a specific session or all sessions
   */
  clearSessionAffinity(sessionId?: string): void {
    if (sessionId) {
      this.sessionAffinityMap.delete(sessionId);
    } else {
      this.sessionAffinityMap.clear();
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<LoadBalancingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('config-updated', this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): LoadBalancingConfig {
    return { ...this.config };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      requestsPerWorker: new Map(),
      failedRequests: 0,
      averageResponseTime: 0,
      sessionAffinityHits: 0,
      strategyUsage: new Map()
    };
    this.workerRequestCounts.clear();
  }

  /**
   * Get routing statistics
   */
  getRoutingStats(): {
    totalRequests: number;
    successRate: number;
    sessionAffinityRate: number;
    workerDistribution: Array<{ workerId: number; requests: number; percentage: number }>;
    strategyDistribution: Array<{ strategy: string; usage: number; percentage: number }>;
  } {
    const totalRequests = this.metrics.totalRequests;
    const successfulRequests = totalRequests - this.metrics.failedRequests;
    
    const workerDistribution = Array.from(this.workerRequestCounts.entries()).map(([workerId, requests]) => ({
      workerId,
      requests,
      percentage: totalRequests > 0 ? (requests / totalRequests) * 100 : 0
    }));

    const strategyDistribution = Array.from(this.metrics.strategyUsage.entries()).map(([strategy, usage]) => ({
      strategy,
      usage,
      percentage: totalRequests > 0 ? (usage / totalRequests) * 100 : 0
    }));

    return {
      totalRequests,
      successRate: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0,
      sessionAffinityRate: totalRequests > 0 ? (this.metrics.sessionAffinityHits / totalRequests) * 100 : 0,
      workerDistribution,
      strategyDistribution
    };
  }
} 