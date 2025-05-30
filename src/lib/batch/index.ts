/**
 * Batch Processing System
 * Handles queue management and batch processing of XLIFF files
 */

// Core types and interfaces
export * from './types'

// Queue management
export { 
  BatchProcessingQueue, 
  processingQueue 
} from './queue'

// Batch processor
export { 
  BatchProcessor, 
  batchProcessor,
  type ProcessorOptions 
} from './processor'

// Convenience exports for common operations
export {
  JobPriority,
  DEFAULT_QUEUE_CONFIG,
  JOB_TEMPLATES
} from './types'

// Main API for easy usage
import { batchProcessor } from './processor'
import { processingQueue } from './queue'

/**
 * Main Batch Processing API
 * Provides a simplified interface for common batch operations
 */
export const batchAPI = {
  // Queue operations
  queue: processingQueue,
  
  // Processor operations  
  processor: batchProcessor,

  // Convenience methods
  async processFiles(files: File[], config = {}) {
    return batchProcessor.processFiles(files, config)
  },

  async createBatch(name: string, files: File[], config = {}) {
    return batchProcessor.processBatch(name, files, config)
  },

  start() {
    batchProcessor.start()
  },

  stop() {
    batchProcessor.stop()
  },

  getStats() {
    return batchProcessor.getStats()
  },

  getJobs(filter?: any) {
    return batchProcessor.getJobs(filter)
  },

  getJob(jobId: string) {
    return batchProcessor.getJob(jobId)
  },

  getBatches() {
    return batchProcessor.getBatches()
  },

  getBatch(batchId: string) {
    return batchProcessor.getBatch(batchId)
  },

  cancelJob(jobId: string) {
    return batchProcessor.cancelJob(jobId)
  },

  retryJob(jobId: string) {
    return batchProcessor.retryJob(jobId)
  }
}

// Default export
export default batchAPI 