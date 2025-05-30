// Request Batch Processor for LLM Performance Optimization

import { 
  LLMRequest, 
  LLMResponse, 
  LLMProvider,
  LLMError 
} from '../types/llm-types';
import { LLMClient } from '../clients/LLMClient';

export interface BatchConfig {
  maxBatchSize: number;
  batchTimeout: number; // ms to wait before processing incomplete batch
  maxConcurrentBatches: number;
  priorityLevels: string[];
  enableAdaptiveBatching: boolean;
}

export interface BatchRequest {
  id: string;
  request: LLMRequest;
  priority: string;
  timestamp: number;
  resolve: (response: LLMResponse) => void;
  reject: (error: Error) => void;
}

export interface BatchMetrics {
  totalBatches: number;
  averageBatchSize: number;
  batchLatency: number;
  throughputGain: number;
  queueLength: number;
  concurrentBatches: number;
}

export class RequestBatchProcessor {
  private config: BatchConfig;
  private requestQueue: Map<string, BatchRequest[]> = new Map(); // priority -> requests
  private activeBatches: Map<string, Promise<void>> = new Map();
  private batchTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private metrics: BatchMetrics;
  private client: LLMClient;

  constructor(client: LLMClient, config: Partial<BatchConfig> = {}) {
    this.client = client;
    this.config = {
      maxBatchSize: 10,
      batchTimeout: 1000, // 1 second
      maxConcurrentBatches: 3,
      priorityLevels: ['critical', 'high', 'medium', 'low'],
      enableAdaptiveBatching: true,
      ...config
    };

    this.initializeMetrics();
    this.initializePriorityQueues();
  }

  private initializeMetrics(): void {
    this.metrics = {
      totalBatches: 0,
      averageBatchSize: 0,
      batchLatency: 0,
      throughputGain: 0,
      queueLength: 0,
      concurrentBatches: 0
    };
  }

  private initializePriorityQueues(): void {
    this.config.priorityLevels.forEach(priority => {
      this.requestQueue.set(priority, []);
    });
  }

  /**
   * Add request to batch queue
   */
  public async batchRequest(
    request: LLMRequest, 
    priority: string = 'medium'
  ): Promise<LLMResponse> {
    return new Promise((resolve, reject) => {
      const batchRequest: BatchRequest = {
        id: this.generateRequestId(),
        request,
        priority,
        timestamp: Date.now(),
        resolve,
        reject
      };

      // Add to appropriate priority queue
      const queue = this.requestQueue.get(priority);
      if (!queue) {
        reject(new Error(`Invalid priority level: ${priority}`));
        return;
      }

      queue.push(batchRequest);
      this.updateQueueMetrics();

      // Check if we should process immediately
      this.checkForBatchProcessing(priority);
    });
  }

  /**
   * Check if we should process a batch for the given priority
   */
  private checkForBatchProcessing(priority: string): void {
    const queue = this.requestQueue.get(priority);
    if (!queue || queue.length === 0) return;

    // Check if we have enough requests or if timeout should trigger
    const shouldProcess = 
      queue.length >= this.config.maxBatchSize ||
      this.hasReachedTimeout(priority) ||
      this.getActiveBatchCount() < this.config.maxConcurrentBatches;

    if (shouldProcess) {
      this.processBatch(priority);
    } else if (!this.batchTimeouts.has(priority)) {
      // Set timeout for this priority level
      const timeout = setTimeout(() => {
        this.processBatch(priority);
      }, this.config.batchTimeout);
      
      this.batchTimeouts.set(priority, timeout);
    }
  }

  /**
   * Process a batch for the given priority
   */
  private async processBatch(priority: string): Promise<void> {
    const queue = this.requestQueue.get(priority);
    if (!queue || queue.length === 0) return;

    // Check concurrency limits
    if (this.getActiveBatchCount() >= this.config.maxConcurrentBatches) {
      return;
    }

    // Clear timeout if it exists
    const timeout = this.batchTimeouts.get(priority);
    if (timeout) {
      clearTimeout(timeout);
      this.batchTimeouts.delete(priority);
    }

    // Extract batch
    const batchSize = Math.min(queue.length, this.config.maxBatchSize);
    const batch = queue.splice(0, batchSize);
    
    if (batch.length === 0) return;

    const batchId = `batch_${priority}_${Date.now()}`;
    const startTime = Date.now();

    // Mark as active batch
    const batchPromise = this.executeBatch(batch, batchId);
    this.activeBatches.set(batchId, batchPromise);

    try {
      await batchPromise;
      const batchLatency = Date.now() - startTime;
      this.updateBatchMetrics(batch.length, batchLatency);
    } catch (error) {
      console.error(`Batch ${batchId} failed:`, error);
    } finally {
      this.activeBatches.delete(batchId);
      this.updateQueueMetrics();

      // Check if there are more requests to process
      setImmediate(() => this.checkForBatchProcessing(priority));
    }
  }

  /**
   * Execute a batch of requests
   */
  private async executeBatch(batch: BatchRequest[], batchId: string): Promise<void> {
    console.log(`Processing batch ${batchId} with ${batch.length} requests`);

    // Group similar requests for potential optimization
    const groupedRequests = this.groupSimilarRequests(batch);

    const batchResults = await Promise.allSettled(
      groupedRequests.map(group => this.processRequestGroup(group))
    );

    // Process results and resolve/reject individual promises
    batchResults.forEach((result, index) => {
      const group = groupedRequests[index];
      
      if (result.status === 'fulfilled') {
        // Handle successful group
        group.forEach((batchRequest, reqIndex) => {
          const response = result.value[reqIndex];
          if (response) {
            batchRequest.resolve(response);
          } else {
            batchRequest.reject(new Error('No response received for request'));
          }
        });
      } else {
        // Handle failed group
        group.forEach(batchRequest => {
          batchRequest.reject(new Error(result.reason?.message || 'Batch processing failed'));
        });
      }
    });
  }

  /**
   * Group similar requests for optimization
   */
  private groupSimilarRequests(batch: BatchRequest[]): BatchRequest[][] {
    const groups: Map<string, BatchRequest[]> = new Map();

    batch.forEach(batchRequest => {
      // Create a key based on similar characteristics
      const key = this.getRequestGroupKey(batchRequest.request);
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(batchRequest);
    });

    return Array.from(groups.values());
  }

  /**
   * Generate grouping key for similar requests
   */
  private getRequestGroupKey(request: LLMRequest): string {
    return `${request.systemPrompt || 'none'}_${request.temperature || 0.1}_${request.maxTokens || 4096}`;
  }

  /**
   * Process a group of similar requests
   */
  private async processRequestGroup(group: BatchRequest[]): Promise<(LLMResponse | null)[]> {
    const responses: (LLMResponse | null)[] = new Array(group.length).fill(null);

    // Process each request in the group
    await Promise.allSettled(
      group.map(async (batchRequest, index) => {
        try {
          const response = await this.client.sendRequest(batchRequest.request);
          responses[index] = response;
        } catch (error) {
          console.error(`Request ${batchRequest.id} failed:`, error);
          responses[index] = null;
        }
      })
    );

    return responses;
  }

  /**
   * Check if timeout has been reached for priority level
   */
  private hasReachedTimeout(priority: string): boolean {
    const queue = this.requestQueue.get(priority);
    if (!queue || queue.length === 0) return false;

    const oldestRequest = queue[0];
    return Date.now() - oldestRequest.timestamp >= this.config.batchTimeout;
  }

  /**
   * Get number of currently active batches
   */
  private getActiveBatchCount(): number {
    return this.activeBatches.size;
  }

  /**
   * Update queue length metrics
   */
  private updateQueueMetrics(): void {
    this.metrics.queueLength = Array.from(this.requestQueue.values())
      .reduce((total, queue) => total + queue.length, 0);
    this.metrics.concurrentBatches = this.getActiveBatchCount();
  }

  /**
   * Update batch processing metrics
   */
  private updateBatchMetrics(batchSize: number, latency: number): void {
    this.metrics.totalBatches++;
    
    // Update average batch size
    this.metrics.averageBatchSize = 
      (this.metrics.averageBatchSize * (this.metrics.totalBatches - 1) + batchSize) / 
      this.metrics.totalBatches;

    // Update average batch latency
    this.metrics.batchLatency = 
      (this.metrics.batchLatency * (this.metrics.totalBatches - 1) + latency) / 
      this.metrics.totalBatches;

    // Calculate throughput gain (estimated)
    this.metrics.throughputGain = Math.max(1, this.metrics.averageBatchSize / 1.5);
  }

  /**
   * Get current batch processing metrics
   */
  public getMetrics(): BatchMetrics {
    return { ...this.metrics };
  }

  /**
   * Get detailed queue status
   */
  public getQueueStatus(): Record<string, number> {
    const status: Record<string, number> = {};
    this.requestQueue.forEach((queue, priority) => {
      status[priority] = queue.length;
    });
    return status;
  }

  /**
   * Clear all queues and cancel pending batches
   */
  public async shutdown(): Promise<void> {
    // Clear all timeouts
    this.batchTimeouts.forEach(timeout => clearTimeout(timeout));
    this.batchTimeouts.clear();

    // Reject all pending requests
    this.requestQueue.forEach(queue => {
      queue.forEach(batchRequest => {
        batchRequest.reject(new Error('Batch processor shutting down'));
      });
      queue.length = 0;
    });

    // Wait for active batches to complete
    await Promise.allSettled(Array.from(this.activeBatches.values()));
    this.activeBatches.clear();
  }

  /**
   * Adaptive batching based on current performance
   */
  public optimizeBatchSize(): void {
    if (!this.config.enableAdaptiveBatching) return;

    const currentLatency = this.metrics.batchLatency;
    const currentThroughput = this.metrics.throughputGain;

    // Increase batch size if latency is low and throughput is good
    if (currentLatency < 2000 && currentThroughput > 1.5) {
      this.config.maxBatchSize = Math.min(20, this.config.maxBatchSize + 2);
    }
    // Decrease batch size if latency is high
    else if (currentLatency > 5000) {
      this.config.maxBatchSize = Math.max(3, this.config.maxBatchSize - 1);
    }

    // Adjust timeout based on queue length
    const avgQueueLength = this.metrics.queueLength / this.config.priorityLevels.length;
    if (avgQueueLength > 5) {
      this.config.batchTimeout = Math.max(500, this.config.batchTimeout - 100);
    } else if (avgQueueLength < 2) {
      this.config.batchTimeout = Math.min(2000, this.config.batchTimeout + 100);
    }
  }

  private generateRequestId(): string {
    return `batch_req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
} 