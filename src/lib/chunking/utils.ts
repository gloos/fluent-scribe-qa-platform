import { ChunkingConfig } from './types'

/**
 * Calculate optimal chunk size based on file size, memory constraints, and network conditions
 */
export const calculateOptimalChunkSize = (
  fileSize: number,
  config: ChunkingConfig,
  networkSpeed?: number // bytes per second
): number => {
  let chunkSize = config.baseChunkSize

  // Adjust based on file size
  if (fileSize > 50 * 1024 * 1024) { // > 50MB
    chunkSize = Math.min(fileSize / 8, config.maxChunkSize)
  }

  // Network adaptive sizing (if network is slow, use smaller chunks)
  if (config.networkAdaptive && networkSpeed) {
    const speedMBps = networkSpeed / (1024 * 1024)
    if (speedMBps < 1) { // < 1 MB/s
      chunkSize = Math.max(chunkSize / 2, config.minChunkSize)
    } else if (speedMBps > 10) { // > 10 MB/s
      chunkSize = Math.min(chunkSize * 1.5, config.maxChunkSize)
    }
  }

  // Memory constraint check (estimate browser memory usage)
  const estimatedMemoryUsage = chunkSize * 3 // Buffer, processing, and backup
  const availableMemory = getAvailableMemoryEstimate()
  const memoryThreshold = availableMemory * (config.memoryThresholdPercent / 100)
  
  if (estimatedMemoryUsage > memoryThreshold) {
    chunkSize = Math.max(memoryThreshold / 3, config.minChunkSize)
  }

  return Math.floor(chunkSize)
}

/**
 * Estimate available memory in the browser (rough approximation)
 */
export const getAvailableMemoryEstimate = (): number => {
  // Default conservative estimate: 100MB
  let availableMemory = 100 * 1024 * 1024

  // Try to get more accurate estimate if available
  if ('memory' in performance && (performance as any).memory) {
    const memInfo = (performance as any).memory
    if (memInfo.jsHeapSizeLimit) {
      // Use 50% of the heap limit as available memory
      availableMemory = memInfo.jsHeapSizeLimit * 0.5
    }
  }

  return availableMemory
}

/**
 * Calculate checksum for a file chunk using Web Crypto API
 */
export const calculateChunkChecksum = async (chunk: Blob): Promise<string> => {
  try {
    const arrayBuffer = await chunk.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  } catch (error) {
    console.warn('Could not calculate checksum:', error)
    return `fallback_${Date.now()}_${Math.random().toString(36).substring(2)}`
  }
}

/**
 * Generate unique chunk ID
 */
export const generateChunkId = (fileId: string, chunkIndex: number): string => {
  return `${fileId}_chunk_${chunkIndex}_${Date.now()}`
}

/**
 * Generate unique file ID for chunking
 */
export const generateFileId = (fileName: string): string => {
  const timestamp = Date.now()
  const randomId = Math.random().toString(36).substring(2)
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
  return `${timestamp}_${randomId}_${sanitizedName}`
}

/**
 * Format file size for display
 */
export const formatFileSize = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`
}

/**
 * Calculate estimated upload time based on file size and network speed
 */
export const estimateUploadTime = (
  fileSize: number,
  networkSpeed: number, // bytes per second
  parallelism: number = 1
): number => {
  if (networkSpeed <= 0) return 0
  
  // Account for overhead (approximately 20% more time)
  const overhead = 1.2
  const effectiveSpeed = networkSpeed * parallelism * 0.8 // 80% efficiency with parallelism
  
  return (fileSize / effectiveSpeed) * overhead
}

/**
 * Calculate recommended concurrency based on file size and system capabilities
 */
export const calculateRecommendedConcurrency = (
  fileSize: number,
  chunkSize: number,
  networkSpeed?: number
): number => {
  const totalChunks = Math.ceil(fileSize / chunkSize)
  
  // Base concurrency on total chunks and system constraints
  let concurrency = Math.min(
    Math.max(2, Math.floor(totalChunks / 4)), // At least 2, but scale with chunks
    6 // Maximum of 6 concurrent uploads
  )

  // Adjust based on network speed if available
  if (networkSpeed) {
    const speedMBps = networkSpeed / (1024 * 1024)
    if (speedMBps < 1) {
      concurrency = Math.min(concurrency, 2) // Slow network: max 2 concurrent
    } else if (speedMBps > 10) {
      concurrency = Math.min(concurrency + 2, 8) // Fast network: up to 8 concurrent
    }
  }

  return concurrency
}

/**
 * Validate chunk integrity by checking size and boundaries
 */
export const validateChunk = (
  chunk: Blob,
  metadata: { expectedSize: number; startByte: number; endByte: number }
): boolean => {
  if (chunk.size !== metadata.expectedSize) {
    console.warn(`Chunk size mismatch: expected ${metadata.expectedSize}, got ${chunk.size}`)
    return false
  }

  if (chunk.size !== (metadata.endByte - metadata.startByte)) {
    console.warn(`Chunk boundary mismatch: size ${chunk.size} vs range ${metadata.endByte - metadata.startByte}`)
    return false
  }

  return true
}

/**
 * Default chunking configuration
 */
export const DEFAULT_CHUNKING_CONFIG: ChunkingConfig = {
  baseChunkSize: 5 * 1024 * 1024,  // 5MB
  maxChunkSize: 10 * 1024 * 1024,  // 10MB
  minChunkSize: 1 * 1024 * 1024,   // 1MB
  memoryThresholdPercent: 25,       // 25% of available memory
  networkAdaptive: true             // Adjust based on network speed
} 