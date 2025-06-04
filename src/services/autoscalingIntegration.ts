import { AutoscalingPolicyEngine } from './autoscalingPolicyEngine';
import { ProcessClusterManager } from './processClusterManager';
import { LoadBalancingService } from './loadBalancingService';
import { AutoscalingOrchestrator } from './autoscalingOrchestrator';
import { resourceMonitor } from './resourceMonitoringService';
import { DatabaseMonitoringService } from './databaseMonitoringService';
import { EventEmitter } from 'events';
import { Application, Request, Response, NextFunction } from 'express';
import cluster from 'cluster';

export interface AutoscalingIntegrationConfig {
  enabled: boolean;
  enableLoadBalancing: boolean;
  enableResponseTimeTracking: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export class AutoscalingIntegration extends EventEmitter {
  private config: AutoscalingIntegrationConfig;
  private policyEngine: AutoscalingPolicyEngine;
  private clusterManager: ProcessClusterManager;
  private loadBalancingService: LoadBalancingService;
  private orchestrator: AutoscalingOrchestrator;
  private databaseMonitor: DatabaseMonitoringService | null = null;
  private isInitialized: boolean = false;

  private defaultConfig: AutoscalingIntegrationConfig = {
    enabled: true,
    enableLoadBalancing: true,
    enableResponseTimeTracking: true,
    logLevel: 'info'
  };

  constructor(config?: Partial<AutoscalingIntegrationConfig>) {
    super();
    this.config = { ...this.defaultConfig, ...config };
    
    // Initialize components
    this.policyEngine = new AutoscalingPolicyEngine();
    this.clusterManager = new ProcessClusterManager();
    this.loadBalancingService = new LoadBalancingService(this.clusterManager);
    
    // Initialize database monitoring if available
    if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
      this.databaseMonitor = new DatabaseMonitoringService(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      );
    } else {
      this.log('warn', 'Database monitoring not available - missing Supabase credentials');
    }

    // Initialize orchestrator
    this.orchestrator = new AutoscalingOrchestrator(
      this.policyEngine,
      this.clusterManager,
      resourceMonitor,
      this.databaseMonitor || ({} as DatabaseMonitoringService), // Fallback for type safety
      {
        enabled: this.config.enabled,
        enableResponseTimeTracking: this.config.enableResponseTimeTracking,
        logLevel: this.config.logLevel
      }
    );

    this.setupEventListeners();
  }

  /**
   * Setup event listeners between components
   */
  private setupEventListeners(): void {
    // Orchestrator events
    this.orchestrator.on('started', () => {
      this.log('info', '✅ Autoscaling orchestrator started');
      this.emit('autoscaling-started');
    });

    this.orchestrator.on('stopped', () => {
      this.log('info', '✅ Autoscaling orchestrator stopped');
      this.emit('autoscaling-stopped');
    });

    this.orchestrator.on('scaling-decision', (decision) => {
      this.log('info', `Scaling decision: ${decision.action} to ${decision.targetInstances} instances`);
      this.emit('scaling-decision', decision);
    });

    this.orchestrator.on('scaling-action', (event) => {
      if (event.success) {
        this.log('info', `Scaling action completed: ${event.decision.action}`);
      } else {
        this.log('error', `Scaling action failed: ${event.error}`);
      }
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

    // Load balancing events
    this.loadBalancingService.on('request-routed', (decision) => {
      if (this.config.logLevel === 'debug') {
        this.log('debug', `Request routed to worker ${decision.selectedWorker?.workerId} via ${decision.strategy}`);
      }
      this.emit('request-routed', decision);
    });

    this.loadBalancingService.on('worker-added', (event) => {
      this.log('info', `Load balancer: Worker added ${event.workerId}`);
    });

    this.loadBalancingService.on('worker-removed', (event) => {
      this.log('info', `Load balancer: Worker removed ${event.workerId}`);
    });
  }

  /**
   * Initialize autoscaling system
   */
  initialize(): void {
    if (this.isInitialized) {
      this.log('warn', 'Autoscaling integration already initialized');
      return;
    }

    this.log('info', '🚀 Initializing autoscaling integration...');

    // Only run autoscaling in primary process
    if (cluster.isPrimary) {
      this.log('info', 'Primary process: Starting autoscaling orchestrator');
      
      if (this.config.enabled) {
        this.orchestrator.start();
      } else {
        this.log('info', 'Autoscaling is disabled in configuration');
      }
    } else {
      this.log('info', `Worker process ${cluster.worker?.id}: Autoscaling not started in worker`);
    }

    this.isInitialized = true;
    this.emit('initialized');
    this.log('info', '✅ Autoscaling integration initialized successfully');
  }

  /**
   * Create Express middleware for load balancing and response time tracking
   */
  createMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      // Load balancing (mainly for monitoring and session affinity in single-machine setup)
      if (this.config.enableLoadBalancing && cluster.isPrimary) {
        const routingDecision = this.loadBalancingService.routeRequest(req);
        req.headers['x-worker-id'] = routingDecision.selectedWorker?.workerId?.toString() || 'unknown';
        req.headers['x-routing-strategy'] = routingDecision.strategy;
      }

      // Response time tracking
      if (this.config.enableResponseTimeTracking) {
        res.on('finish', () => {
          const responseTime = Date.now() - startTime;
          this.orchestrator.addResponseTime(responseTime);
          
          if (this.config.logLevel === 'debug') {
            this.log('debug', `Request completed in ${responseTime}ms`);
          }
        });
      }

      next();
    };
  }

  /**
   * Add autoscaling routes to Express app
   */
  addRoutes(app: Application): void {
    const baseRoute = '/api/v1/autoscaling';

    // Autoscaling status
    app.get(`${baseRoute}/status`, (req: Request, res: Response) => {
      try {
        const status = this.orchestrator.getStatus();
        const clusterStatus = this.clusterManager.getClusterStatus();
        const loadBalancingMetrics = this.loadBalancingService.getMetrics();
        const routingStats = this.loadBalancingService.getRoutingStats();

        res.json({
          autoscaling: status,
          cluster: clusterStatus,
          loadBalancing: {
            metrics: loadBalancingMetrics,
            stats: routingStats,
            sessionAffinity: this.loadBalancingService.getSessionAffinityStatus()
          },
          config: this.config
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to get autoscaling status', details: (error as Error).message });
      }
    });

    // Force scaling
    app.post(`${baseRoute}/scale`, async (req: Request, res: Response) => {
      try {
        const { targetInstances } = req.body;
        
        if (!targetInstances || typeof targetInstances !== 'number') {
          res.status(400).json({ error: 'targetInstances must be a number' });
          return;
        }

        const result = await this.orchestrator.forceScale(targetInstances);
        res.json({ success: true, result });
      } catch (error) {
        res.status(500).json({ error: 'Failed to scale', details: (error as Error).message });
      }
    });

    // Configuration updates
    app.put(`${baseRoute}/config`, (req: Request, res: Response) => {
      try {
        const newConfig = req.body;
        this.updateConfig(newConfig);
        res.json({ success: true, config: this.config });
      } catch (error) {
        res.status(500).json({ error: 'Failed to update config', details: (error as Error).message });
      }
    });

    // Scaling history
    app.get(`${baseRoute}/history`, (req: Request, res: Response) => {
      try {
        const history = this.orchestrator.getScalingHistory();
        res.json({ history });
      } catch (error) {
        res.status(500).json({ error: 'Failed to get scaling history', details: (error as Error).message });
      }
    });

    // Load balancing stats
    app.get(`${baseRoute}/load-balancing`, (req: Request, res: Response) => {
      try {
        const stats = this.loadBalancingService.getRoutingStats();
        const metrics = this.loadBalancingService.getMetrics();
        const sessionAffinity = this.loadBalancingService.getSessionAffinityStatus();
        
        res.json({
          stats,
          metrics,
          sessionAffinity,
          config: this.loadBalancingService.getConfig()
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to get load balancing stats', details: (error as Error).message });
      }
    });

    // Reset metrics
    app.post(`${baseRoute}/reset-metrics`, (req: Request, res: Response) => {
      try {
        this.loadBalancingService.resetMetrics();
        res.json({ success: true, message: 'Metrics reset successfully' });
      } catch (error) {
        res.status(500).json({ error: 'Failed to reset metrics', details: (error as Error).message });
      }
    });

    this.log('info', `✅ Autoscaling routes added at ${baseRoute}`);
  }

  /**
   * Stop autoscaling system
   */
  stop(): void {
    this.log('info', 'Stopping autoscaling integration...');
    
    if (cluster.isPrimary && this.orchestrator.isEnabled()) {
      this.orchestrator.stop();
    }
    
    this.emit('stopped');
    this.log('info', '✅ Autoscaling integration stopped');
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AutoscalingIntegrationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update orchestrator config
    this.orchestrator.updateConfig({
      enabled: this.config.enabled,
      enableResponseTimeTracking: this.config.enableResponseTimeTracking,
      logLevel: this.config.logLevel
    });

    this.emit('config-updated', this.config);
    this.log('info', 'Autoscaling integration configuration updated');
  }

  /**
   * Get current configuration
   */
  getConfig(): AutoscalingIntegrationConfig {
    return { ...this.config };
  }

  /**
   * Get all component references for advanced usage
   */
  getComponents() {
    return {
      policyEngine: this.policyEngine,
      clusterManager: this.clusterManager,
      loadBalancingService: this.loadBalancingService,
      orchestrator: this.orchestrator,
      databaseMonitor: this.databaseMonitor
    };
  }

  /**
   * Check if autoscaling is running
   */
  isRunning(): boolean {
    return this.orchestrator.isEnabled() && this.isInitialized;
  }

  /**
   * Graceful shutdown
   */
  async gracefulShutdown(): Promise<void> {
    this.log('info', 'Performing graceful shutdown of autoscaling system...');
    
    this.stop();
    
    if (cluster.isPrimary) {
      await this.clusterManager.gracefulShutdown();
    }
    
    this.log('info', '✅ Autoscaling system shut down gracefully');
  }

  /**
   * Logging helper
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [AUTOSCALING-INTEGRATION] [${level.toUpperCase()}]`;
    
    switch (level) {
      case 'debug':
        if (this.config.logLevel === 'debug') console.log(`${prefix} ${message}`);
        break;
      case 'info':
        if (['debug', 'info'].includes(this.config.logLevel)) console.log(`${prefix} ${message}`);
        break;
      case 'warn':
        if (['debug', 'info', 'warn'].includes(this.config.logLevel)) console.warn(`${prefix} ${message}`);
        break;
      case 'error':
        console.error(`${prefix} ${message}`);
        break;
    }
  }
}

// Create singleton instance
export const autoscalingIntegration = new AutoscalingIntegration(); 