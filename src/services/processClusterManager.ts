import { EventEmitter } from 'events';
import cluster, { Worker } from 'cluster';
import os from 'os';

export interface ProcessHealth {
  workerId: number;
  pid: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  uptime: number;
  isHealthy: boolean;
  lastHealthCheck: number;
  requestsHandled?: number;
  errors?: number;
}

export interface ClusterStatus {
  isPrimary: boolean;
  totalWorkers: number;
  activeWorkers: number;
  workers: ProcessHealth[];
  targetWorkers: number;
  cpuCores: number;
  maxWorkers: number;
  minWorkers: number;
}

export interface ClusterEvent {
  type: 'worker-spawned' | 'worker-died' | 'worker-healthy' | 'worker-unhealthy' | 'scaling-complete';
  workerId?: number;
  pid?: number;
  data?: any;
  timestamp: number;
}

export interface ClusterConfig {
  minWorkers: number;
  maxWorkers: number;
  healthCheckInterval: number;
  unhealthyThreshold: number;
  gracefulShutdownTimeout: number;
  enableHealthChecks: boolean;
  respawnOnExit: boolean;
}

export class ProcessClusterManager extends EventEmitter {
  private config: ClusterConfig;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private workerHealth = new Map<number, ProcessHealth>();
  private targetWorkerCount: number;
  private isShuttingDown: boolean = false;
  private workerStartTimes = new Map<number, number>();

  private defaultConfig: ClusterConfig = {
    minWorkers: 1,
    maxWorkers: Math.max(2, os.cpus().length),
    healthCheckInterval: 30000, // 30 seconds
    unhealthyThreshold: 3, // Number of failed health checks before restart
    gracefulShutdownTimeout: 30000, // 30 seconds
    enableHealthChecks: true,
    respawnOnExit: true
  };

  constructor(config?: Partial<ClusterConfig>) {
    super();
    this.config = { ...this.defaultConfig, ...config };
    this.targetWorkerCount = this.config.minWorkers;

    if (cluster.isPrimary) {
      this.setupPrimaryProcess();
    }
  }

  /**
   * Setup primary process event handlers and initialization
   */
  private setupPrimaryProcess(): void {
    console.log(`🔄 Cluster Manager: Primary process ${process.pid} is running`);
    console.log(`💻 Available CPU cores: ${os.cpus().length}`);
    console.log(`⚙️  Worker limits: ${this.config.minWorkers} - ${this.config.maxWorkers}`);

    // Handle worker exit events
    cluster.on('exit', (worker, code, signal) => {
      const workerId = worker.id;
      const startTime = this.workerStartTimes.get(workerId);
      const uptime = startTime ? Date.now() - startTime : 0;
      
      console.log(`⚠️  Worker ${workerId} died (PID: ${worker.process.pid}, uptime: ${Math.round(uptime / 1000)}s, code: ${code}, signal: ${signal})`);
      
      // Remove from tracking
      this.workerHealth.delete(workerId);
      this.workerStartTimes.delete(workerId);
      
      // Emit event
      this.emit('worker-died', {
        type: 'worker-died',
        workerId,
        pid: worker.process.pid,
        data: { code, signal, uptime },
        timestamp: Date.now()
      } as ClusterEvent);

      // Respawn if not shutting down and respawn is enabled
      if (!this.isShuttingDown && this.config.respawnOnExit) {
        if (Object.keys(cluster.workers || {}).length < this.targetWorkerCount) {
          console.log(`🔄 Respawning worker to maintain target count: ${this.targetWorkerCount}`);
          this.spawnWorker();
        }
      }
    });

    // Handle worker online events
    cluster.on('online', (worker) => {
      const workerId = worker.id;
      console.log(`✅ Worker ${workerId} is online (PID: ${worker.process.pid})`);
      
      // Track start time
      this.workerStartTimes.set(workerId, Date.now());
      
      // Initialize health tracking
      this.updateWorkerHealth(workerId);
      
      // Emit event
      this.emit('worker-spawned', {
        type: 'worker-spawned',
        workerId,
        pid: worker.process.pid,
        timestamp: Date.now()
      } as ClusterEvent);
    });

    // Handle worker disconnect events
    cluster.on('disconnect', (worker) => {
      console.log(`📡 Worker ${worker.id} disconnected`);
    });

    // Start initial workers
    this.initializeWorkers();

    // Start health checking if enabled
    if (this.config.enableHealthChecks) {
      this.startHealthChecking();
    }

    // Setup graceful shutdown
    this.setupGracefulShutdown();
  }

  /**
   * Initialize workers to minimum count
   */
  private initializeWorkers(): void {
    for (let i = 0; i < this.config.minWorkers; i++) {
      this.spawnWorker();
    }
  }

  /**
   * Spawn a new worker process
   */
  private spawnWorker(): void {
    if (Object.keys(cluster.workers || {}).length >= this.config.maxWorkers) {
      console.log(`⚠️  Cannot spawn worker: already at maximum (${this.config.maxWorkers})`);
      return;
    }

    const worker = cluster.fork();
    console.log(`🚀 Spawning worker ${worker.id} (PID: ${worker.process.pid})`);
  }

  /**
   * Scale workers to target count
   */
  scaleWorkers(targetCount: number): Promise<ClusterStatus> {
    return new Promise((resolve) => {
      if (!cluster.isPrimary) {
        throw new Error('Worker scaling can only be performed by primary process');
      }

      const clampedTarget = Math.max(
        this.config.minWorkers,
        Math.min(targetCount, this.config.maxWorkers)
      );

      if (clampedTarget !== targetCount) {
        console.log(`⚠️  Target worker count ${targetCount} clamped to ${clampedTarget} (limits: ${this.config.minWorkers}-${this.config.maxWorkers})`);
      }

      this.targetWorkerCount = clampedTarget;
      const currentWorkerCount = Object.keys(cluster.workers || {}).length;

      console.log(`🎯 Scaling workers: ${currentWorkerCount} -> ${clampedTarget}`);

      if (clampedTarget > currentWorkerCount) {
        // Scale up
        const workersToSpawn = clampedTarget - currentWorkerCount;
        console.log(`📈 Scaling up: spawning ${workersToSpawn} workers`);
        
        for (let i = 0; i < workersToSpawn; i++) {
          this.spawnWorker();
        }
      } else if (clampedTarget < currentWorkerCount) {
        // Scale down
        const workersToKill = currentWorkerCount - clampedTarget;
        console.log(`📉 Scaling down: removing ${workersToKill} workers`);
        
        this.killExcessWorkers(workersToKill);
      }

      // Wait a moment for scaling to complete, then resolve
      setTimeout(() => {
        const finalStatus = this.getClusterStatus();
        this.emit('scaling-complete', {
          type: 'scaling-complete',
          data: finalStatus,
          timestamp: Date.now()
        } as ClusterEvent);
        resolve(finalStatus);
      }, 1000);
    });
  }

  /**
   * Kill excess workers gracefully
   */
  private killExcessWorkers(count: number): void {
    const workers = Object.values(cluster.workers || {}).filter(Boolean);
    const workersToKill = workers.slice(0, count);

    workersToKill.forEach((worker) => {
      if (worker) {
        console.log(`🛑 Gracefully stopping worker ${worker.id} (PID: ${worker.process.pid})`);
        
        // Send disconnect signal
        worker.disconnect();
        
        // Force kill after timeout
        setTimeout(() => {
          if (!worker.isDead()) {
            console.log(`⚠️  Force killing unresponsive worker ${worker.id}`);
            worker.kill('SIGKILL');
          }
        }, this.config.gracefulShutdownTimeout);
      }
    });
  }

  /**
   * Start health checking for workers
   */
  private startHealthChecking(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthCheckInterval);

    console.log(`🏥 Health checking started (interval: ${this.config.healthCheckInterval}ms)`);
  }

  /**
   * Perform health checks on all workers
   */
  private performHealthChecks(): void {
    const workers = Object.values(cluster.workers || {}).filter(Boolean);
    
    workers.forEach((worker) => {
      if (worker) {
        this.updateWorkerHealth(worker.id);
      }
    });
  }

  /**
   * Update health status for a specific worker
   */
  private updateWorkerHealth(workerId: number): void {
    const worker = cluster.workers?.[workerId];
    if (!worker) return;

    const now = Date.now();
    const startTime = this.workerStartTimes.get(workerId) || now;
    
    try {
      const health: ProcessHealth = {
        workerId,
        pid: worker.process.pid || 0,
        memoryUsage: process.memoryUsage(), // This is primary process memory, ideally we'd get worker memory
        cpuUsage: process.cpuUsage(), // This is primary process CPU, ideally we'd get worker CPU
        uptime: now - startTime,
        isHealthy: !worker.isDead(),
        lastHealthCheck: now
      };

      this.workerHealth.set(workerId, health);

      // Emit health event
      this.emit(health.isHealthy ? 'worker-healthy' : 'worker-unhealthy', {
        type: health.isHealthy ? 'worker-healthy' : 'worker-unhealthy',
        workerId,
        pid: health.pid,
        data: health,
        timestamp: now
      } as ClusterEvent);

    } catch (error) {
      console.error(`Error checking health for worker ${workerId}:`, error);
    }
  }

  /**
   * Get current cluster status
   */
  getClusterStatus(): ClusterStatus {
    const workers = Object.values(cluster.workers || {}).filter(Boolean);
    const healthArray = Array.from(this.workerHealth.values());

    return {
      isPrimary: cluster.isPrimary,
      totalWorkers: workers.length,
      activeWorkers: workers.filter(w => w && !w.isDead()).length,
      workers: healthArray,
      targetWorkers: this.targetWorkerCount,
      cpuCores: os.cpus().length,
      maxWorkers: this.config.maxWorkers,
      minWorkers: this.config.minWorkers
    };
  }

  /**
   * Setup graceful shutdown handling
   */
  private setupGracefulShutdown(): void {
    const shutdown = (signal: string) => {
      console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
      this.gracefulShutdown();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  /**
   * Perform graceful shutdown of all workers
   */
  gracefulShutdown(): void {
    if (this.isShuttingDown) {
      console.log('Shutdown already in progress...');
      return;
    }

    this.isShuttingDown = true;

    // Stop health checking
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    const workers = Object.values(cluster.workers || {}).filter(Boolean);
    if (workers.length === 0) {
      console.log('✅ No workers to shutdown. Exiting.');
      process.exit(0);
      return;
    }

    console.log(`🛑 Shutting down ${workers.length} workers...`);
    let workersShutdown = 0;

    const checkComplete = () => {
      workersShutdown++;
      if (workersShutdown === workers.length) {
        console.log('✅ All workers shut down gracefully. Exiting.');
        process.exit(0);
      }
    };

    workers.forEach((worker) => {
      if (worker) {
        worker.on('disconnect', checkComplete);
        
        // Send disconnect signal
        worker.disconnect();
        
        // Force kill after timeout
        setTimeout(() => {
          if (!worker.isDead()) {
            console.log(`⚠️  Force killing worker ${worker.id}`);
            worker.kill('SIGKILL');
            checkComplete();
          }
        }, this.config.gracefulShutdownTimeout);
      }
    });

    // Emergency exit if graceful shutdown takes too long
    setTimeout(() => {
      console.log('⚠️  Emergency exit - graceful shutdown took too long');
      process.exit(1);
    }, this.config.gracefulShutdownTimeout + 5000);
  }

  /**
   * Update cluster configuration
   */
  updateConfig(newConfig: Partial<ClusterConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart health checking if interval changed
    if (newConfig.healthCheckInterval && this.config.enableHealthChecks) {
      this.startHealthChecking();
    }

    console.log('⚙️  Cluster configuration updated:', newConfig);
  }

  /**
   * Get current configuration
   */
  getConfig(): ClusterConfig {
    return { ...this.config };
  }

  /**
   * Check if this is the primary process
   */
  isPrimary(): boolean {
    return cluster.isPrimary;
  }

  /**
   * Check if this is a worker process
   */
  isWorker(): boolean {
    return cluster.isWorker;
  }

  /**
   * Get current worker ID (if this is a worker process)
   */
  getWorkerId(): number | undefined {
    return cluster.worker?.id;
  }
}

// Export singleton instance
export const processClusterManager = new ProcessClusterManager(); 