import { useState, useCallback, useRef } from 'react'
import { 
  createChunkingService, 
  createReassemblyService,
  ChunkReassemblyInfo,
  ChunkProgressTracker,
  ChunkingConfig 
} from '@/lib/chunking'
import { uploadFile } from '@/lib/storage'
import { 
  uploadErrorHandler, 
  UploadError, 
  createUserFriendlyErrorMessage 
} from '@/lib/uploadErrorHandling'

export interface ChunkedUploadingFile {
  id: string
  file: File
  status: 'pending' | 'analyzing' | 'uploading' | 'reassembling' | 'completed' | 'error' | 'cancelled'
  progress: number
  error?: string
  uploadResult?: {
    path: string
    fullPath: string
    publicUrl: string
  }
  // Chunking-specific properties
  isChunked: boolean
  chunkingProgress?: ChunkProgressTracker
  reassemblyInfo?: ChunkReassemblyInfo
  totalChunks?: number
  completedChunks?: number
  failedChunks?: number
  chunkSize?: number
  uploadSpeed?: number
  estimatedTimeRemaining?: number
  networkSpeed?: number
  startTime?: number
}

interface UseChunkedFileUploadOptions {
  onUploadComplete?: (file: ChunkedUploadingFile) => void
  onUploadError?: (file: ChunkedUploadingFile, error: UploadError) => void
  onUploadProgress?: (file: ChunkedUploadingFile, progress: number) => void
  bucket?: string
  folder?: string
  maxConcurrentUploads?: number
  enableRetry?: boolean
  maxRetryAttempts?: number
  // Chunking configuration
  chunkingConfig?: Partial<ChunkingConfig>
  chunkingThreshold?: number // File size threshold to enable chunking (default: 10MB)
  enableChunking?: boolean // Whether to enable chunking at all
}

export const useChunkedFileUpload = (options: UseChunkedFileUploadOptions = {}) => {
  const [uploadingFiles, setUploadingFiles] = useState<ChunkedUploadingFile[]>([])
  const chunkingService = useRef(createChunkingService(options.chunkingConfig))
  const reassemblyService = useRef(createReassemblyService())
  const networkSpeedRef = useRef<number>(0)
  
  const { 
    maxConcurrentUploads = 3,
    enableRetry = true,
    maxRetryAttempts = 3,
    chunkingThreshold = 10 * 1024 * 1024, // 10MB
    enableChunking = true
  } = options

  const updateFileStatus = useCallback((
    fileId: string, 
    updates: Partial<ChunkedUploadingFile>
  ) => {
    setUploadingFiles(prev => 
      prev.map(f => f.id === fileId ? { ...f, ...updates } : f)
    )
  }, [])

  const shouldUseChunking = useCallback((file: File): boolean => {
    return enableChunking && file.size > chunkingThreshold
  }, [enableChunking, chunkingThreshold])

  const measureNetworkSpeed = useCallback((
    bytesUploaded: number,
    timeElapsed: number // milliseconds
  ): number => {
    if (timeElapsed <= 0) return 0
    const speed = (bytesUploaded / timeElapsed) * 1000 // bytes per second
    networkSpeedRef.current = speed
    return speed
  }, [])

  const uploadFileWithChunking = useCallback(async (
    uploadingFile: ChunkedUploadingFile
  ): Promise<void> => {
    const { file, id } = uploadingFile
    const startTime = Date.now()

    try {
      updateFileStatus(id, { 
        status: 'analyzing',
        startTime,
        networkSpeed: networkSpeedRef.current
      })

      // Analyze file and create chunking plan
      const chunkingResult = await chunkingService.current.analyzeFile(
        file, 
        networkSpeedRef.current || undefined
      )

      updateFileStatus(id, {
        status: 'uploading',
        totalChunks: chunkingResult.chunks.length,
        chunkSize: chunkingResult.chunks[0]?.chunkSize || 0,
        estimatedTimeRemaining: chunkingResult.estimatedUploadTime
      })

      console.log(`🚀 Starting chunked upload for ${file.name}`)
      console.log(`📊 Total chunks: ${chunkingResult.chunks.length}`)

      // Upload file in chunks
      const reassemblyInfo = await chunkingService.current.uploadFileInChunks(
        file,
        {
          bucket: options.bucket,
          folder: options.folder,
          onProgress: (progress) => {
            updateFileStatus(id, { progress })
            if (options.onUploadProgress) {
              const currentFile = uploadingFiles.find(f => f.id === id)
              if (currentFile) {
                options.onUploadProgress(currentFile, progress)
              }
            }
          },
          onChunkComplete: (chunk) => {
            const tracker = chunkingService.current.getProgress(chunk.fileId)
            if (tracker) {
              const currentSpeed = measureNetworkSpeed(
                tracker.completedChunks * (uploadingFile.chunkSize || 0),
                Date.now() - startTime
              )

              updateFileStatus(id, {
                completedChunks: tracker.completedChunks,
                failedChunks: tracker.failedChunks,
                chunkingProgress: tracker,
                uploadSpeed: currentSpeed,
                estimatedTimeRemaining: tracker.estimatedTimeRemaining
              })
            }
          },
          maxRetries: maxRetryAttempts
        },
        networkSpeedRef.current || undefined
      )

      updateFileStatus(id, { 
        status: 'reassembling',
        reassemblyInfo,
        progress: 90 // Chunking complete, starting reassembly
      })

      console.log(`🔧 Starting reassembly for ${file.name}`)

      // Reassemble chunks into final file
      const reassemblyResult = await reassemblyService.current.reassembleFile(
        reassemblyInfo,
        options.bucket,
        options.folder
      )

      if (!reassemblyResult.success || !reassemblyResult.filePath) {
        throw new Error(reassemblyResult.error || 'Reassembly failed')
      }

      // Get public URL for the reassembled file
      const publicUrl = `${process.env.REACT_APP_SUPABASE_URL}/storage/v1/object/public/${options.bucket || 'qa-files'}/${reassemblyResult.filePath}`

      const finalResult = {
        path: reassemblyResult.filePath,
        fullPath: reassemblyResult.filePath,
        publicUrl
      }

      updateFileStatus(id, {
        status: 'completed',
        progress: 100,
        uploadResult: finalResult
      })

      // Clean up progress tracker
      chunkingService.current.cleanupProgress(reassemblyInfo.fileId)

      console.log(`✅ Chunked upload completed for ${file.name}`)

      if (options.onUploadComplete) {
        const completedFile = uploadingFiles.find(f => f.id === id)
        if (completedFile) {
          options.onUploadComplete(completedFile)
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown upload error'
      console.error(`❌ Chunked upload failed for ${file.name}:`, error)

      const uploadError = uploadErrorHandler.classifyError(error, {
        fileId: id,
        fileName: file.name,
        fileSize: file.size,
        attempt: 1
      })

      updateFileStatus(id, {
        status: 'error',
        error: createUserFriendlyErrorMessage(uploadError, file.name)
      })

      if (options.onUploadError) {
        const failedFile = uploadingFiles.find(f => f.id === id)
        if (failedFile) {
          options.onUploadError(failedFile, uploadError)
        }
      }
    }
  }, [options, uploadingFiles, measureNetworkSpeed, updateFileStatus, maxRetryAttempts])

  const uploadFileRegularly = useCallback(async (
    uploadingFile: ChunkedUploadingFile
  ): Promise<void> => {
    const { file, id } = uploadingFile
    const startTime = Date.now()

    try {
      updateFileStatus(id, { 
        status: 'uploading',
        progress: 0,
        startTime
      })

      const uploadResult = await uploadFile(
        file,
        options.bucket,
        options.folder
      )

      if (uploadResult.error || !uploadResult.data) {
        throw uploadResult.error || new Error('Upload failed - no data returned')
      }

      const uploadTime = Date.now() - startTime
      const speed = measureNetworkSpeed(file.size, uploadTime)

      updateFileStatus(id, {
        status: 'completed',
        progress: 100,
        uploadResult: uploadResult.data,
        uploadSpeed: speed
      })

      console.log(`✅ Regular upload completed for ${file.name} in ${uploadTime}ms`)

      if (options.onUploadComplete) {
        const completedFile = uploadingFiles.find(f => f.id === id)
        if (completedFile) {
          options.onUploadComplete(completedFile)
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown upload error'
      console.error(`❌ Regular upload failed for ${file.name}:`, error)

      const uploadError = uploadErrorHandler.classifyError(error, {
        fileId: id,
        fileName: file.name,
        fileSize: file.size,
        attempt: 1
      })

      updateFileStatus(id, {
        status: 'error',
        error: createUserFriendlyErrorMessage(uploadError, file.name)
      })

      if (options.onUploadError) {
        const failedFile = uploadingFiles.find(f => f.id === id)
        if (failedFile) {
          options.onUploadError(failedFile, uploadError)
        }
      }
    }
  }, [options, uploadingFiles, measureNetworkSpeed, updateFileStatus])

  const addFiles = useCallback((files: File[]) => {
    const newFiles: ChunkedUploadingFile[] = files.map(file => {
      const id = `${Date.now()}_${Math.random().toString(36).substring(2)}`
      const isChunked = shouldUseChunking(file)

      console.log(`📁 Adding file: ${file.name} (${file.size} bytes) - Chunking: ${isChunked}`)

      return {
        id,
        file,
        status: 'pending',
        progress: 0,
        isChunked,
        startTime: Date.now()
      }
    })

    setUploadingFiles(prev => [...prev, ...newFiles])

    // Start uploads
    newFiles.forEach(uploadingFile => {
      if (uploadingFile.isChunked) {
        uploadFileWithChunking(uploadingFile)
      } else {
        uploadFileRegularly(uploadingFile)
      }
    })
  }, [shouldUseChunking, uploadFileWithChunking, uploadFileRegularly])

  const removeFile = useCallback((fileId: string) => {
    // Cancel any ongoing upload
    const file = uploadingFiles.find(f => f.id === fileId)
    if (file?.reassemblyInfo) {
      chunkingService.current.cancelUpload(file.reassemblyInfo.fileId)
    }

    setUploadingFiles(prev => prev.filter(f => f.id !== fileId))
  }, [uploadingFiles])

  const clearCompleted = useCallback(() => {
    setUploadingFiles(prev => prev.filter(f => f.status !== 'completed'))
  }, [])

  const getUploadStats = useCallback(() => {
    const total = uploadingFiles.length
    const completed = uploadingFiles.filter(f => f.status === 'completed').length
    const errors = uploadingFiles.filter(f => f.status === 'error').length
    const uploading = uploadingFiles.filter(f => 
      ['analyzing', 'uploading', 'reassembling'].includes(f.status)
    ).length

    return { total, completed, errors, uploading }
  }, [uploadingFiles])

  return {
    uploadingFiles,
    addFiles,
    removeFile,
    clearCompleted,
    getUploadStats,
    isUploading: uploadingFiles.some(f => 
      ['analyzing', 'uploading', 'reassembling'].includes(f.status)
    ),
    networkSpeed: networkSpeedRef.current
  }
} 