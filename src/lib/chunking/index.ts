// Core chunking functionality
export { ChunkingService } from './ChunkingService'
export { 
  calculateOptimalChunkSize,
  calculateChunkChecksum,
  generateChunkId,
  generateFileId,
  estimateUploadTime,
  calculateRecommendedConcurrency,
  validateChunk,
  DEFAULT_CHUNKING_CONFIG
} from './utils'

// Memory management
export { MemoryManager, memoryManager } from './MemoryManager'
export type { 
  MemoryStats, 
  BufferPoolConfig, 
  MemoryCleanupResult 
} from './MemoryManager'

// Progress tracking and reporting
export { ChunkProgressTracker, chunkProgressTracker } from './ProgressTracker'

// Enhanced types including progress tracking
export type {
  ChunkMetadata,
  ChunkUploadOptions,
  ChunkingConfig,
  FileChunkingResult,
  ChunkUploadResult,
  ChunkReassemblyInfo,
  ChunkProgressTracker as ChunkProgressTrackerType,
  // Enhanced progress tracking types
  ChunkStatus,
  ChunkProgress,
  FileProgress,
  ProgressEvent,
  ProgressReporter
} from './types'

// Services
export { ReassemblyService } from './ReassemblyService'

// Worker pool
export { ChunkWorkerPool } from './WorkerPool'
export type {
  WorkerPoolConfig,
  ChunkWorkerJob,
  WorkerStats
} from './WorkerPool'

// Import types and services for factory functions
import type { ChunkingConfig } from './types'
import type { WorkerPoolConfig } from './WorkerPool'
import { ChunkingService } from './ChunkingService'
import { ChunkWorkerPool } from './WorkerPool'

// Factory functions for easy instantiation
export const createChunkingService = (config?: Partial<ChunkingConfig>) => {
  return new ChunkingService(config)
}

export const createReassemblyService = () => {
  // Import reassembly service if it exists
  try {
    const { ReassemblyService } = require('./ReassemblyService')
    return new ReassemblyService()
  } catch {
    // Fallback or stub implementation
    return {
      reassembleFile: async () => ({ success: false, error: 'Reassembly service not available' })
    }
  }
}

export const createWorkerPool = (config?: Partial<WorkerPoolConfig>) => {
  return new ChunkWorkerPool(config)
} 