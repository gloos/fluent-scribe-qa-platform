export interface ChunkMetadata {
  chunkId: string
  fileId: string
  fileName: string
  chunkIndex: number
  totalChunks: number
  chunkSize: number
  actualSize: number
  checksum: string
  startByte: number
  endByte: number
  uploadPath?: string
  isLastChunk: boolean
}

export interface ChunkUploadOptions {
  bucket?: string
  folder?: string
  onProgress?: (progress: number) => void
  onChunkComplete?: (chunk: ChunkMetadata) => void
  onChunkProgress?: (chunk: ChunkMetadata, progress: ChunkProgress) => void
  onFileProgress?: (fileId: string, progress: FileProgress) => void
  maxRetries?: number
  retryDelay?: number
}

export interface ChunkingConfig {
  baseChunkSize: number // Default 5MB
  maxChunkSize: number  // Default 10MB
  minChunkSize: number  // Default 1MB
  memoryThresholdPercent: number // Default 25% of available memory
  networkAdaptive: boolean // Adjust chunk size based on upload speed
}

export interface FileChunkingResult {
  chunks: ChunkMetadata[]
  totalSize: number
  estimatedUploadTime: number
  recommendedConcurrency: number
}

export interface ChunkUploadResult {
  success: boolean
  chunkId: string
  uploadPath?: string
  error?: string
  retryCount?: number
  uploadTime?: number
}

export interface ChunkReassemblyInfo {
  fileId: string
  fileName: string
  totalChunks: number
  uploadedChunks: ChunkMetadata[]
  finalPath?: string
  isComplete: boolean
}

// Enhanced Progress Tracking Types

export type ChunkStatus = 'pending' | 'uploading' | 'completed' | 'failed' | 'retrying' | 'cancelled'

export interface ChunkProgress {
  chunkId: string
  status: ChunkStatus
  progress: number // 0-100
  bytesUploaded: number
  totalBytes: number
  uploadSpeed: number // bytes per second
  startTime: number
  endTime?: number
  retryCount: number
  error?: string
  memoryUsageMB?: number
}

export interface FileProgress {
  fileId: string
  fileName: string
  status: 'analyzing' | 'uploading' | 'completed' | 'failed' | 'cancelled'
  overallProgress: number // 0-100
  totalChunks: number
  completedChunks: number
  failedChunks: number
  retryingChunks: number
  pendingChunks: number
  bytesUploaded: number
  totalBytes: number
  uploadSpeed: number // bytes per second
  estimatedTimeRemaining: number // seconds
  startTime: number
  endTime?: number
  chunkProgresses: Map<string, ChunkProgress>
  memoryStats?: {
    currentUsageMB: number
    peakUsageMB: number
    memoryPressure: 'low' | 'medium' | 'high' | 'critical'
  }
  performanceStats?: {
    averageChunkUploadTime: number
    successRate: number
    totalRetries: number
    networkUtilization: number
  }
}

export interface ProgressEvent {
  type: 'chunk_started' | 'chunk_progress' | 'chunk_completed' | 'chunk_failed' | 
        'file_started' | 'file_progress' | 'file_completed' | 'file_failed' |
        'memory_warning' | 'performance_warning'
  timestamp: number
  data: any
}

export interface ProgressReporter {
  onEvent: (event: ProgressEvent) => void
  onChunkProgress: (progress: ChunkProgress) => void
  onFileProgress: (progress: FileProgress) => void
}

export interface ChunkProgressTracker {
  fileId: string
  totalChunks: number
  completedChunks: number
  failedChunks: number
  overallProgress: number
  uploadSpeed: number // bytes per second
  estimatedTimeRemaining: number // seconds
  lastUpdated: number
} 