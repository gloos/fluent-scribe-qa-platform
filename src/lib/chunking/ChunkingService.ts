import { 
  ChunkMetadata, 
  ChunkUploadOptions, 
  ChunkingConfig, 
  FileChunkingResult,
  ChunkUploadResult,
  ChunkReassemblyInfo,
  ChunkProgressTracker,
  ChunkProgress,
  FileProgress
} from './types'
import { 
  calculateOptimalChunkSize, 
  calculateChunkChecksum, 
  generateChunkId, 
  generateFileId,
  estimateUploadTime,
  calculateRecommendedConcurrency,
  validateChunk,
  DEFAULT_CHUNKING_CONFIG
} from './utils'
import { uploadChunk } from '../storage'
import { memoryManager } from './MemoryManager'
import { chunkProgressTracker } from './ProgressTracker'
import { defaultCacheManager, cacheUtils, type FileProgressState, type ChunkState } from './cache'

export class ChunkingService {
  private config: ChunkingConfig
  private progressTrackers: Map<string, ChunkProgressTracker> = new Map()
  private chunkUploadPromises: Map<string, Promise<ChunkUploadResult>> = new Map()
  private activeChunkCleanups: Map<string, () => void> = new Map()

  constructor(config?: Partial<ChunkingConfig>) {
    this.config = { ...DEFAULT_CHUNKING_CONFIG, ...config }
  }

  /**
   * Analyze a file and create chunking plan with memory optimization and resumability support
   */
  async analyzeFile(
    file: File, 
    networkSpeed?: number
  ): Promise<FileChunkingResult> {
    const fileId = generateFileId(file.name)
    
    // Check for cached progress state for resumability
    const cachedProgress = await this.checkForResumableUpload(file, fileId)
    if (cachedProgress) {
      console.log(`🔄 Found resumable upload for ${file.name} with ${cachedProgress.uploadProgress.completedChunks}/${cachedProgress.uploadProgress.totalChunks} chunks completed`)
      return this.buildChunkingResultFromCache(cachedProgress, file)
    }
    
    // Initialize progress tracking
    chunkProgressTracker.initializeFileProgress(fileId, file.name, file.size, 0) // Will update totalChunks after calculation
    
    // Get memory-optimized chunk size
    const memoryStats = memoryManager.getMemoryStats()
    const baseChunkSize = calculateOptimalChunkSize(file.size, this.config, networkSpeed)
    const chunkSize = memoryManager.optimizeChunkSize(baseChunkSize)
    
    const totalChunks = Math.ceil(file.size / chunkSize)
    const chunks: ChunkMetadata[] = []

    console.log(`🔍 Analyzing file: ${file.name} (${file.size} bytes)`)
    console.log(`💾 Memory pressure: ${memoryStats.memoryPressure}, available: ${memoryStats.availableMemoryMB.toFixed(1)}MB`)
    console.log(`📏 Optimal chunk size: ${chunkSize} bytes (${Math.round(chunkSize / (1024 * 1024) * 10) / 10}MB)`)
    console.log(`🧩 Total chunks: ${totalChunks}`)

    // Update file progress with correct total chunks
    const fileProgress = chunkProgressTracker.getFileProgress(fileId)
    if (fileProgress) {
      fileProgress.totalChunks = totalChunks
      fileProgress.pendingChunks = totalChunks
    }

    // Create chunk metadata and initialize progress
    for (let i = 0; i < totalChunks; i++) {
      const startByte = i * chunkSize
      const endByte = Math.min(startByte + chunkSize, file.size)
      const actualSize = endByte - startByte
      const isLastChunk = i === totalChunks - 1

      const chunkMetadata: ChunkMetadata = {
        chunkId: generateChunkId(fileId, i),
        fileId,
        fileName: file.name,
        chunkIndex: i,
        totalChunks,
        chunkSize,
        actualSize,
        checksum: '', // Will be calculated during upload
        startByte,
        endByte,
        isLastChunk
      }

      chunks.push(chunkMetadata)
      
      // Initialize progress tracking for this chunk
      chunkProgressTracker.initializeChunkProgress(chunkMetadata)
    }

    const estimatedUploadTime = networkSpeed 
      ? estimateUploadTime(file.size, networkSpeed)
      : 0

    // Adjust concurrency based on memory pressure
    let recommendedConcurrency = calculateRecommendedConcurrency(
      file.size, 
      chunkSize, 
      networkSpeed
    )

    if (memoryStats.memoryPressure === 'high') {
      recommendedConcurrency = Math.min(recommendedConcurrency, 3)
    } else if (memoryStats.memoryPressure === 'critical') {
      recommendedConcurrency = 1
    }

    console.log(`🎯 Adjusted concurrency for memory pressure: ${recommendedConcurrency}`)

    // Cache the initial progress state for resumability
    await this.cacheFileProgressState(fileId, file, chunks)

    return {
      chunks,
      totalSize: file.size,
      estimatedUploadTime,
      recommendedConcurrency
    }
  }

  /**
   * Upload file using memory-optimized chunking strategy with comprehensive progress tracking
   */
  async uploadFileInChunks(
    file: File,
    options: ChunkUploadOptions = {},
    networkSpeed?: number
  ): Promise<ChunkReassemblyInfo> {
    const chunkingResult = await this.analyzeFile(file, networkSpeed)
    const { chunks, recommendedConcurrency } = chunkingResult
    
    const fileId = chunks[0]?.fileId || generateFileId(file.name)
    
    // Initialize legacy progress tracker for backward compatibility
    this.initializeProgressTracker(fileId, chunks.length)

    // Update file progress status to uploading
    const fileProgress = chunkProgressTracker.getFileProgress(fileId)
    if (fileProgress) {
      fileProgress.status = 'uploading'
    }

    // Register cleanup for this file
    memoryManager.registerCleanupCallback(() => {
      this.cleanupFileResources(fileId)
    })

    console.log(`🚀 Starting memory-optimized chunked upload for ${file.name}`)
    console.log(`📊 Using ${recommendedConcurrency} concurrent uploads`)

    const uploadedChunks: ChunkMetadata[] = []
    const failedChunks: ChunkMetadata[] = []

    try {
      // Upload chunks with controlled concurrency and memory monitoring
      await this.uploadChunksWithMemoryManagement(
        file,
        chunks,
        options,
        recommendedConcurrency,
        uploadedChunks,
        failedChunks
      )

      // Handle any failed chunks with retry
      if (failedChunks.length > 0) {
        console.log(`🔄 Retrying ${failedChunks.length} failed chunks`)
        await this.retryFailedChunks(file, failedChunks, options, uploadedChunks)
      }

      const isComplete = uploadedChunks.length === chunks.length
      
      if (!isComplete) {
        // Mark file as failed
        const fileProgress = chunkProgressTracker.getFileProgress(fileId)
        if (fileProgress) {
          fileProgress.status = 'failed'
        }
        throw new Error(`Upload incomplete: ${uploadedChunks.length}/${chunks.length} chunks uploaded`)
      }

      // Mark file as completed
      const fileProgress = chunkProgressTracker.getFileProgress(fileId)
      if (fileProgress) {
        fileProgress.status = 'completed'
        fileProgress.overallProgress = 100
      }

      console.log(`✅ All chunks uploaded successfully for ${file.name}`)

      // Sort chunks by index to ensure correct order
      uploadedChunks.sort((a, b) => a.chunkIndex - b.chunkIndex)

      return {
        fileId,
        fileName: file.name,
        totalChunks: chunks.length,
        uploadedChunks,
        isComplete
      }
    } finally {
      // Always cleanup file resources
      this.cleanupFileResources(fileId)
    }
  }

  /**
   * Upload chunks with memory management and comprehensive progress monitoring
   */
  private async uploadChunksWithMemoryManagement(
    file: File,
    chunks: ChunkMetadata[],
    options: ChunkUploadOptions,
    concurrency: number,
    uploadedChunks: ChunkMetadata[],
    failedChunks: ChunkMetadata[]
  ): Promise<void> {
    const semaphore = new Array(concurrency).fill(null)
    let chunkIndex = 0

    const uploadNext = async (): Promise<void> => {
      while (chunkIndex < chunks.length) {
        const chunk = chunks[chunkIndex++]
        
        // Update chunk status to uploading
        chunkProgressTracker.updateChunkStatus(chunk.chunkId, 'uploading')
        
        // Check memory pressure before processing chunk
        if (memoryManager.shouldCleanup()) {
          console.log(`🧹 Memory cleanup triggered during chunk processing`)
          await memoryManager.performCleanup()
        }
        
        try {
          const result = await memoryManager.monitorChunkProcessing(
            () => this.uploadSingleChunkOptimized(file, chunk, options),
            `chunk ${chunk.chunkIndex + 1}/${chunks.length}`
          )
          
          if (result.success && chunk.uploadPath) {
            uploadedChunks.push(chunk)
            
            // Update chunk status to completed
            chunkProgressTracker.updateChunkStatus(chunk.chunkId, 'completed')
            chunkProgressTracker.updateChunkBytes(chunk.chunkId, chunk.actualSize)
            
            // Update legacy progress tracker
            this.updateProgress(chunk.fileId, uploadedChunks.length, failedChunks.length)
            
            // Call chunk completion callbacks
            if (options.onChunkComplete) {
              options.onChunkComplete(chunk)
            }
            
            if (options.onChunkProgress) {
              const chunkProgress = chunkProgressTracker.getChunkProgress(chunk.chunkId)
              if (chunkProgress) {
                options.onChunkProgress(chunk, chunkProgress)
              }
            }
          } else {
            failedChunks.push(chunk)
            chunkProgressTracker.updateChunkStatus(chunk.chunkId, 'failed', result.error)
            console.warn(`❌ Chunk upload failed: ${chunk.chunkId}`, result.error)
          }
        } catch (error) {
          failedChunks.push(chunk)
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          chunkProgressTracker.updateChunkStatus(chunk.chunkId, 'failed', errorMessage)
          console.error(`💥 Chunk upload error: ${chunk.chunkId}`, error)
        }

        // Call file progress callback
        if (options.onFileProgress) {
          const fileProgress = chunkProgressTracker.getFileProgress(chunk.fileId)
          if (fileProgress) {
            options.onFileProgress(chunk.fileId, fileProgress)
          }
        }

        // Call legacy progress callback
        if (options.onProgress) {
          const fileProgress = chunkProgressTracker.getFileProgress(chunk.fileId)
          if (fileProgress) {
            options.onProgress(fileProgress.overallProgress)
          }
        }
      }
    }

    // Start concurrent workers
    await Promise.all(semaphore.map(() => uploadNext()))
  }

  /**
   * Upload a single chunk with memory optimization, caching, and progress tracking
   */
  private async uploadSingleChunkOptimized(
    file: File,
    chunkMetadata: ChunkMetadata,
    options: ChunkUploadOptions
  ): Promise<ChunkUploadResult> {
    const { chunkId, startByte, endByte, actualSize, fileId } = chunkMetadata
    const startTime = Date.now()

    let chunkCleanup: (() => void) | undefined

    try {
      // Check for cached chunk first (for resumable uploads)
      const cachedChunk = await defaultCacheManager.getCachedChunk(chunkId)
      if (cachedChunk && cachedChunk.uploadStatus === 'completed' && cachedChunk.uploadPath) {
        console.log(`🔥 Using cached chunk: ${chunkId}`)
        
        // Update metadata with cached info
        chunkMetadata.uploadPath = cachedChunk.uploadPath
        chunkMetadata.checksum = cachedChunk.checksum
        
        // Update progress tracking
        chunkProgressTracker.updateChunkStatus(chunkId, 'completed')
        chunkProgressTracker.updateChunkBytes(chunkId, actualSize)
        
        // Update cached progress state
        await this.updateCachedChunkStatus(fileId, chunkId, 'completed', cachedChunk.uploadPath)

        return {
          success: true,
          chunkId,
          uploadPath: cachedChunk.uploadPath,
          uploadTime: 0 // Instant from cache
        }
      }

      // Create optimized chunk with cleanup tracking
      const { blob: chunkBlob, cleanup } = memoryManager.createOptimizedChunk(
        file, 
        startByte, 
        endByte
      )
      chunkCleanup = cleanup
      this.activeChunkCleanups.set(chunkId, cleanup)
      
      // Validate chunk
      if (!validateChunk(chunkBlob, { expectedSize: actualSize, startByte, endByte })) {
        throw new Error('Chunk validation failed')
      }

      // Calculate checksum with memory monitoring
      const checksum = await memoryManager.monitorChunkProcessing(
        () => calculateChunkChecksum(chunkBlob),
        `checksum calculation for ${chunkId}`
      )
      chunkMetadata.checksum = checksum

      // Cache the chunk blob before upload for fault tolerance
      try {
        await defaultCacheManager.cacheChunk(chunkId, chunkBlob, {
          chunkId,
          fileId,
          chunkIndex: chunkMetadata.chunkIndex,
          checksum,
          uploadStatus: 'uploading',
          retryCount: 0
        })
      } catch (cacheError) {
        console.warn('Failed to cache chunk blob:', cacheError)
        // Continue with upload even if caching fails
      }

      // Update cached progress state
      await this.updateCachedChunkStatus(fileId, chunkId, 'uploading')

      // Simulate progress during upload (for demonstration)
      const progressUpdater = (progress: number) => {
        const bytesUploaded = Math.floor((progress / 100) * actualSize)
        chunkProgressTracker.updateChunkBytes(chunkId, bytesUploaded)
      }

      // Update progress at intervals during upload simulation
      progressUpdater(25)

      // Use the specialized uploadChunk function
      const bucket = options.bucket || 'qa-files'
      const folder = options.folder ? `${options.folder}/chunks` : 'chunks'
      
      progressUpdater(50)
      
      const uploadResult = await uploadChunk(chunkBlob, chunkId, bucket, folder)

      progressUpdater(75)

      if (uploadResult.error || !uploadResult.data) {
        throw uploadResult.error || new Error('Upload failed - no data returned')
      }

      // Update chunk metadata with upload path
      chunkMetadata.uploadPath = uploadResult.data.path

      progressUpdater(100)

      const uploadTime = Date.now() - startTime

      // Update cache with successful upload info
      try {
        await defaultCacheManager.cacheChunk(chunkId, chunkBlob, {
          chunkId,
          fileId,
          chunkIndex: chunkMetadata.chunkIndex,
          checksum,
          uploadStatus: 'completed',
          uploadPath: uploadResult.data.path,
          retryCount: 0
        })
        
        // Update cached progress state
        await this.updateCachedChunkStatus(fileId, chunkId, 'completed', uploadResult.data.path)
      } catch (cacheError) {
        console.warn('Failed to update cache with upload result:', cacheError)
        // Non-critical error, continue
      }

      console.log(`✅ Chunk uploaded: ${chunkId} (${actualSize} bytes) in ${uploadTime}ms`)

      return {
        success: true,
        chunkId,
        uploadPath: uploadResult.data.path,
        uploadTime
      }

    } catch (error) {
      const uploadTime = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown upload error'

      console.error(`❌ Chunk upload failed: ${chunkId}`, error)

      // Update cache with failed status
      try {
        const cachedChunk = await defaultCacheManager.getCachedChunk(chunkId)
        if (cachedChunk) {
          await defaultCacheManager.cacheChunk(chunkId, cachedChunk.value, {
            ...cachedChunk,
            uploadStatus: 'failed',
            retryCount: (cachedChunk.retryCount || 0) + 1
          })
        }
        
        // Update cached progress state
        await this.updateCachedChunkStatus(fileId, chunkId, 'failed', undefined, errorMessage)
      } catch (cacheError) {
        console.warn('Failed to update cache with error status:', cacheError)
      }

      return {
        success: false,
        chunkId,
        error: errorMessage,
        uploadTime
      }
    } finally {
      // Always cleanup chunk resources
      if (chunkCleanup) {
        chunkCleanup()
        this.activeChunkCleanups.delete(chunkId)
      }
    }
  }

  /**
   * Update cached progress state for a specific chunk
   */
  private async updateCachedChunkStatus(
    fileId: string, 
    chunkId: string, 
    status: ChunkState['status'], 
    uploadPath?: string,
    errorMessage?: string
  ): Promise<void> {
    try {
      const cachedProgress = await defaultCacheManager.getCachedFileProgress(fileId)
      if (cachedProgress) {
        const progressState = cachedProgress.value
        const chunkState = progressState.chunkStates.get(chunkId)
        
        if (chunkState) {
          chunkState.status = status
          chunkState.attempts += 1
          chunkState.lastAttempt = Date.now()
          
          if (uploadPath) {
            chunkState.uploadPath = uploadPath
          }
          
          if (errorMessage) {
            chunkState.errorMessage = errorMessage
          }

          // Update progress counters
          const completed = Array.from(progressState.chunkStates.values()).filter(c => c.status === 'completed').length
          const failed = Array.from(progressState.chunkStates.values()).filter(c => c.status === 'failed').length
          
          progressState.uploadProgress.completedChunks = completed
          progressState.uploadProgress.failedChunks = failed
          progressState.uploadProgress.lastUpdateTime = Date.now()
          
          if (status === 'completed') {
            progressState.uploadProgress.bytesUploaded += chunkState.size
          }

          // Update cache
          await defaultCacheManager.cacheFileProgress(fileId, progressState)
        }
      }
    } catch (error) {
      console.warn('Failed to update cached chunk status:', error)
      // Non-critical error, don't throw
    }
  }

  /**
   * Retry failed chunk uploads with memory consideration and progress tracking
   */
  private async retryFailedChunks(
    file: File,
    failedChunks: ChunkMetadata[],
    options: ChunkUploadOptions,
    uploadedChunks: ChunkMetadata[]
  ): Promise<void> {
    const maxRetries = options.maxRetries || 3
    const retryDelay = options.retryDelay || 1000

    for (const chunk of failedChunks) {
      let retryCount = 0
      let success = false

      while (retryCount < maxRetries && !success) {
        retryCount++
        console.log(`🔄 Retrying chunk ${chunk.chunkId}, attempt ${retryCount}/${maxRetries}`)

        // Update chunk status to retrying
        chunkProgressTracker.updateChunkStatus(chunk.chunkId, 'retrying')

        // Wait before retry and check memory
        if (retryCount > 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * retryCount))
        }

        // Perform memory cleanup before retry if needed
        if (memoryManager.shouldCleanup()) {
          await memoryManager.performCleanup()
        }

        try {
          const result = await this.uploadSingleChunkOptimized(file, chunk, options)
          
          if (result.success) {
            uploadedChunks.push(chunk)
            success = true
            
            // Update chunk status to completed
            chunkProgressTracker.updateChunkStatus(chunk.chunkId, 'completed')
            chunkProgressTracker.updateChunkBytes(chunk.chunkId, chunk.actualSize)
            
            console.log(`✅ Chunk retry successful: ${chunk.chunkId}`)
            
            if (options.onChunkComplete) {
              options.onChunkComplete(chunk)
            }

            if (options.onChunkProgress) {
              const chunkProgress = chunkProgressTracker.getChunkProgress(chunk.chunkId)
              if (chunkProgress) {
                options.onChunkProgress(chunk, chunkProgress)
              }
            }
          }
        } catch (error) {
          console.warn(`❌ Chunk retry ${retryCount} failed: ${chunk.chunkId}`, error)
        }
      }

      if (!success) {
        // Mark chunk as permanently failed
        chunkProgressTracker.updateChunkStatus(chunk.chunkId, 'failed', 'Max retries exceeded')
        console.error(`💥 Chunk failed after ${maxRetries} retries: ${chunk.chunkId}`)
      }
    }
  }

  /**
   * Clean up resources for a file
   */
  private cleanupFileResources(fileId: string): void {
    console.log(`🧹 Cleaning up resources for file: ${fileId}`)
    
    // Cancel any pending chunk uploads
    this.cancelUpload(fileId)
    
    // Clean up any active chunk cleanups
    for (const [chunkId, cleanup] of this.activeChunkCleanups.entries()) {
      if (chunkId.includes(fileId)) {
        cleanup()
        this.activeChunkCleanups.delete(chunkId)
      }
    }
    
    // Clean up progress tracker
    this.cleanupProgress(fileId)
    
    // Clean up comprehensive progress tracker
    chunkProgressTracker.cleanupFileProgress(fileId)
  }

  /**
   * Initialize progress tracker for a file
   */
  private initializeProgressTracker(fileId: string, totalChunks: number): void {
    this.progressTrackers.set(fileId, {
      fileId,
      totalChunks,
      completedChunks: 0,
      failedChunks: 0,
      overallProgress: 0,
      uploadSpeed: 0,
      estimatedTimeRemaining: 0,
      lastUpdated: Date.now()
    })
  }

  /**
   * Update progress for a file
   */
  private updateProgress(fileId: string, completedChunks: number, failedChunks: number): void {
    const tracker = this.progressTrackers.get(fileId)
    if (!tracker) return

    const now = Date.now()
    const timeDiff = (now - tracker.lastUpdated) / 1000 // seconds
    
    tracker.completedChunks = completedChunks
    tracker.failedChunks = failedChunks
    tracker.overallProgress = (completedChunks / tracker.totalChunks) * 100

    // Calculate upload speed (rough estimate)
    if (timeDiff > 0 && completedChunks > 0) {
      const chunksPerSecond = (completedChunks - (tracker.completedChunks || 0)) / timeDiff
      tracker.uploadSpeed = chunksPerSecond
      
      const remainingChunks = tracker.totalChunks - completedChunks
      tracker.estimatedTimeRemaining = remainingChunks / Math.max(chunksPerSecond, 0.1)
    }

    tracker.lastUpdated = now
  }

  /**
   * Get progress for a file
   */
  getProgress(fileId: string): ChunkProgressTracker | undefined {
    return this.progressTrackers.get(fileId)
  }

  /**
   * Clean up progress tracker
   */
  cleanupProgress(fileId: string): void {
    this.progressTrackers.delete(fileId)
  }

  /**
   * Cancel upload and cleanup resources
   */
  cancelUpload(fileId: string): void {
    console.log(`🛑 Cancelling upload for file: ${fileId}`)
    
    // Cancel all pending promises for this file
    for (const [promiseId, promise] of this.chunkUploadPromises.entries()) {
      if (promiseId.includes(fileId)) {
        // We can't actually cancel the promise, but we can remove our reference
        this.chunkUploadPromises.delete(promiseId)
      }
    }
    
    // Clean up progress tracker
    this.cleanupProgress(fileId)
  }

  /**
   * Get memory statistics
   */
  getMemoryStats() {
    return {
      memoryManager: memoryManager.getMemoryStats(),
      bufferPool: memoryManager.getBufferPoolStats(),
      activeChunks: this.activeChunkCleanups.size,
      activeTrackers: this.progressTrackers.size
    }
  }

  /**
   * Get comprehensive progress information
   */
  getComprehensiveProgress(fileId: string): {
    legacy: ChunkProgressTracker | undefined
    detailed: FileProgress | undefined
    summary: any
  } {
    return {
      legacy: this.progressTrackers.get(fileId),
      detailed: chunkProgressTracker.getFileProgress(fileId),
      summary: chunkProgressTracker.getProgressSummary()
    }
  }

  /**
   * Get chunk-specific progress
   */
  getChunkProgress(chunkId: string): ChunkProgress | undefined {
    return chunkProgressTracker.getChunkProgress(chunkId)
  }

  /**
   * Get all file progresses
   */
  getAllFileProgresses(): FileProgress[] {
    return chunkProgressTracker.getAllFileProgresses()
  }

  /**
   * Export progress data
   */
  exportProgressData(): string {
    return chunkProgressTracker.exportProgressData()
  }

  private async checkForResumableUpload(file: File, fileId: string): Promise<FileProgressState | null> {
    try {
      // Look for cached progress state
      const cachedEntry = await defaultCacheManager.getCachedFileProgress(fileId)
      if (!cachedEntry) {
        return null
      }

      const cachedState = cachedEntry.value
      
      // Validate that this is the same file (check file size and last modified)
      if (cachedState.fileSize !== file.size || 
          cachedState.lastModified !== file.lastModified) {
        console.log(`📄 File has changed since last upload, clearing cache for ${fileId}`)
        await defaultCacheManager.clearFileCache(fileId)
        return null
      }

      // Check if there are actually completed chunks to resume from
      const completedChunks = Array.from(cachedState.chunkStates.values())
        .filter(chunk => chunk.status === 'completed').length
      
      if (completedChunks === 0) {
        return null
      }

      console.log(`✅ Valid resumable upload found for ${file.name}`)
      return cachedState
    } catch (error) {
      console.error('Error checking for resumable upload:', error)
      return null
    }
  }

  private async buildChunkingResultFromCache(cachedProgress: FileProgressState, file: File): Promise<FileChunkingResult> {
    try {
      const chunks: ChunkMetadata[] = []
      
      // Rebuild chunk metadata from cached state
      for (const [chunkId, chunkState] of cachedProgress.chunkStates) {
        const chunkMetadata: ChunkMetadata = {
          chunkId: chunkState.chunkId,
          fileId: cachedProgress.fileId,
          fileName: cachedProgress.fileName,
          chunkIndex: chunkState.chunkIndex,
          totalChunks: cachedProgress.uploadProgress.totalChunks,
          chunkSize: chunkState.size, 
          actualSize: chunkState.size,
          checksum: chunkState.checksum,
          startByte: chunkState.chunkIndex * chunkState.size,
          endByte: Math.min((chunkState.chunkIndex + 1) * chunkState.size, file.size),
          uploadPath: chunkState.uploadPath,
          isLastChunk: chunkState.chunkIndex === cachedProgress.uploadProgress.totalChunks - 1
        }
        chunks.push(chunkMetadata)
      }

      // Sort chunks by index
      chunks.sort((a, b) => a.chunkIndex - b.chunkIndex)

      // Restore progress tracking state
      chunkProgressTracker.initializeFileProgress(
        cachedProgress.fileId, 
        cachedProgress.fileName, 
        cachedProgress.fileSize, 
        cachedProgress.uploadProgress.totalChunks
      )

      // Update progress tracker with cached state
      const fileProgress = chunkProgressTracker.getFileProgress(cachedProgress.fileId)
      if (fileProgress) {
        fileProgress.completedChunks = cachedProgress.uploadProgress.completedChunks
        fileProgress.failedChunks = cachedProgress.uploadProgress.failedChunks
        fileProgress.bytesUploaded = cachedProgress.uploadProgress.bytesUploaded
        fileProgress.overallProgress = (cachedProgress.uploadProgress.completedChunks / cachedProgress.uploadProgress.totalChunks) * 100
      }

      console.log(`📦 Restored ${chunks.length} chunks from cache for resumable upload`)

      return {
        chunks,
        totalSize: file.size,
        estimatedUploadTime: 0, // Will be recalculated if needed
        recommendedConcurrency: calculateRecommendedConcurrency(file.size, chunks[0]?.chunkSize || 5 * 1024 * 1024)
      }
    } catch (error) {
      console.error('Error building chunking result from cache:', error)
      // Fallback to fresh analysis
      await defaultCacheManager.clearFileCache(cachedProgress.fileId)
      throw error
    }
  }

  private async cacheFileProgressState(fileId: string, file: File, chunks: ChunkMetadata[]): Promise<void> {
    try {
      // Create initial chunk states
      const chunkStates = new Map<string, ChunkState>()
      for (const chunk of chunks) {
        const chunkState: ChunkState = {
          chunkId: chunk.chunkId,
          chunkIndex: chunk.chunkIndex,
          status: 'pending',
          checksum: '', // Will be updated during upload
          size: chunk.actualSize,
          attempts: 0
        }
        chunkStates.set(chunk.chunkId, chunkState)
      }

      // Create file progress state
      const progressState: FileProgressState = {
        fileId,
        fileName: file.name,
        fileSize: file.size,
        fileChecksum: '', // Could be calculated if needed
        lastModified: file.lastModified,
        chunkStates,
        uploadProgress: {
          totalChunks: chunks.length,
          completedChunks: 0,
          failedChunks: 0,
          bytesUploaded: 0,
          totalBytes: file.size,
          startTime: Date.now(),
          lastUpdateTime: Date.now()
        }
      }

      // Cache the progress state
      await defaultCacheManager.cacheFileProgress(fileId, progressState)
      console.log(`💾 Cached initial progress state for ${file.name}`)
    } catch (error) {
      console.error('Error caching file progress state:', error)
      // Non-critical error, continue without caching
    }
  }
} 