import { useState, useCallback, useRef } from 'react'
import { uploadFile } from '@/lib/storage'
import { 
  uploadErrorHandler, 
  UploadError, 
  createUserFriendlyErrorMessage,
  isRetriableError 
} from '@/lib/uploadErrorHandling'

export interface UploadingFile {
  id: string
  file: File
  status: 'pending' | 'uploading' | 'completed' | 'error' | 'cancelled'
  progress: number
  error?: string
  uploadResult?: {
    path: string
    fullPath: string
    publicUrl: string
  }
  xhr?: XMLHttpRequest
  // Enhanced progress tracking
  uploadSpeed?: number // bytes per second
  estimatedTimeRemaining?: number // seconds
  queuePosition?: number
  startTime?: number
  bytesUploaded?: number
  // Enhanced error handling
  uploadError?: UploadError
  retryAttempt?: number
  retryDelay?: number
  lastRetryTime?: number
}

interface UseFileUploadOptions {
  onUploadComplete?: (file: UploadingFile) => void
  onUploadError?: (file: UploadingFile, error: UploadError) => void
  onUploadProgress?: (file: UploadingFile, progress: number) => void
  onRetryAttempt?: (file: UploadingFile, attempt: number) => void
  bucket?: string
  folder?: string
  maxConcurrentUploads?: number // New option for queue management
  enableRetry?: boolean
  maxRetryAttempts?: number
}

export const useFileUpload = (options: UseFileUploadOptions = {}) => {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])
  const uploadRefs = useRef<Map<string, XMLHttpRequest>>(new Map())
  const retryTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map())
  
  const { 
    maxConcurrentUploads = 3, 
    enableRetry = true, 
    maxRetryAttempts = 3 
  } = options

  // Configure error handler with user options
  if (maxRetryAttempts !== 3) {
    uploadErrorHandler.updateRetryConfig({ maxAttempts: maxRetryAttempts })
  }

  const updateFileStatus = useCallback((
    fileId: string, 
    updates: Partial<UploadingFile>
  ) => {
    setUploadingFiles(prev => 
      prev.map(f => f.id === fileId ? { ...f, ...updates } : f)
    )
  }, [])

  const calculateUploadMetrics = useCallback((
    fileId: string,
    bytesUploaded: number,
    totalBytes: number,
    startTime: number
  ) => {
    const currentTime = Date.now()
    const elapsedTime = (currentTime - startTime) / 1000 // seconds
    
    if (elapsedTime > 0) {
      const uploadSpeed = bytesUploaded / elapsedTime // bytes per second
      const remainingBytes = totalBytes - bytesUploaded
      const estimatedTimeRemaining = remainingBytes / uploadSpeed // seconds
      
      updateFileStatus(fileId, {
        uploadSpeed,
        estimatedTimeRemaining: estimatedTimeRemaining > 0 ? estimatedTimeRemaining : 0,
        bytesUploaded
      })
    }
  }, [updateFileStatus])

  const updateQueuePositions = useCallback(() => {
    setUploadingFiles(prev => {
      const pendingFiles = prev.filter(f => f.status === 'pending')
      return prev.map(file => {
        if (file.status === 'pending') {
          const position = pendingFiles.findIndex(f => f.id === file.id) + 1
          return { ...file, queuePosition: position }
        }
        return file
      })
    })
  }, [])

  const handleUploadError = useCallback((
    uploadingFile: UploadingFile,
    error: any,
    startTime: number,
    attempt: number = 1
  ) => {
    const duration = Date.now() - startTime
    
    // Classify the error using our error handling system
    const uploadError = uploadErrorHandler.classifyError(error, {
      fileId: uploadingFile.id,
      fileName: uploadingFile.file.name,
      fileSize: uploadingFile.file.size,
      attempt
    })

    // Log the error for analytics and debugging
    uploadErrorHandler.logError(
      uploadingFile.id,
      uploadingFile.file.name,
      uploadingFile.file.size,
      uploadError,
      attempt,
      duration
    )

    // Create user-friendly error message
    const userErrorMessage = createUserFriendlyErrorMessage(uploadError, uploadingFile.file.name)

    // Update file with error information
    updateFileStatus(uploadingFile.id, {
      status: 'error',
      error: userErrorMessage,
      uploadError,
      retryAttempt: attempt
    })

    // Check if we should retry
    if (enableRetry && uploadErrorHandler.shouldRetry(uploadError, attempt)) {
      const retryDelay = uploadErrorHandler.calculateRetryDelay(attempt, uploadError)
      
      console.log(`⏳ Retrying upload for ${uploadingFile.file.name} in ${retryDelay}ms (attempt ${attempt + 1}/${maxRetryAttempts})`)
      
      updateFileStatus(uploadingFile.id, {
        retryDelay: retryDelay,
        lastRetryTime: Date.now()
      })

      // Schedule retry
      const timeoutId = setTimeout(() => {
        console.log(`🔄 Retrying upload for ${uploadingFile.file.name} (attempt ${attempt + 1})`)
        
        updateFileStatus(uploadingFile.id, {
          status: 'pending',
          progress: 0,
          error: undefined,
          uploadSpeed: 0,
          estimatedTimeRemaining: 0,
          bytesUploaded: 0,
          retryDelay: undefined
        })

        // Notify about retry attempt
        if (options.onRetryAttempt) {
          options.onRetryAttempt(uploadingFile, attempt + 1)
        }

        // Process queue to start the retry
        setTimeout(() => {
          updateQueuePositions()
          processUploadQueue()
        }, 100)

        retryTimeouts.current.delete(uploadingFile.id)
      }, retryDelay)

      retryTimeouts.current.set(uploadingFile.id, timeoutId)
    } else {
      // No retry, call error callback
      if (options.onUploadError) {
        options.onUploadError(uploadingFile, uploadError)
      }
    }
  }, [updateFileStatus, enableRetry, maxRetryAttempts, options, updateQueuePositions])

  const uploadSingleFile = useCallback(async (uploadingFile: UploadingFile) => {
    const { file, id } = uploadingFile
    const startTime = Date.now()
    const currentAttempt = (uploadingFile.retryAttempt || 0) + 1
    
    updateFileStatus(id, { 
      status: 'uploading', 
      progress: 0, 
      startTime,
      bytesUploaded: 0,
      uploadSpeed: 0,
      estimatedTimeRemaining: 0,
      retryAttempt: currentAttempt
    })

    try {
      // Use Supabase storage upload directly with XMLHttpRequest for progress tracking
      const result = await new Promise<{ data?: any, error?: any }>((resolve) => {
        // Create XMLHttpRequest for real progress tracking
        const xhr = new XMLHttpRequest()
        uploadRefs.current.set(id, xhr)

        // Setup progress tracking
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100)
            updateFileStatus(id, { progress })
            
            // Calculate upload metrics
            calculateUploadMetrics(id, event.loaded, event.total, startTime)
            
            options.onUploadProgress?.(uploadingFile, progress)
          }
        })

        // Setup completion handler
        xhr.addEventListener('load', async () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              // Use the existing uploadFile function as fallback
              const uploadResult = await uploadFile(file, options.bucket, options.folder)
              
              if (uploadResult.error) {
                throw uploadResult.error
              }

              updateFileStatus(id, {
                status: 'completed',
                progress: 100,
                uploadResult: uploadResult.data,
                estimatedTimeRemaining: 0,
                uploadError: undefined,
                error: undefined
              })
              
              // Get the updated file object with the new status and upload result
              const updatedFile: UploadingFile = {
                ...uploadingFile,
                status: 'completed',
                progress: 100,
                uploadResult: uploadResult.data,
                estimatedTimeRemaining: 0,
                uploadError: undefined,
                error: undefined
              }
              
              options.onUploadComplete?.(updatedFile)
              resolve({ data: uploadResult.data })
            } catch (error) {
              handleUploadError(uploadingFile, error, startTime, currentAttempt)
              resolve({ error })
            }
          } else {
            const error = { status: xhr.status, message: `Upload failed with status: ${xhr.status}` }
            handleUploadError(uploadingFile, error, startTime, currentAttempt)
            resolve({ error })
          }
          uploadRefs.current.delete(id)
        })

        // Setup error handler
        xhr.addEventListener('error', () => {
          const error = { name: 'NetworkError', message: 'Network error during upload' }
          handleUploadError(uploadingFile, error, startTime, currentAttempt)
          uploadRefs.current.delete(id)
          resolve({ error })
        })

        // Setup abort handler
        xhr.addEventListener('abort', () => {
          const error = { name: 'AbortError', code: 'CANCELLED', message: 'Upload cancelled' }
          const uploadError = uploadErrorHandler.classifyError(error)
          
          updateFileStatus(id, { 
            status: 'cancelled',
            uploadError,
            error: 'Upload cancelled by user'
          })
          uploadRefs.current.delete(id)
          resolve({ error: 'Upload cancelled' })
        })

        // Setup timeout handler (30 seconds)
        xhr.timeout = 30000
        xhr.addEventListener('timeout', () => {
          const error = { name: 'TimeoutError', code: 'TIMEOUT', message: 'Upload timeout' }
          handleUploadError(uploadingFile, error, startTime, currentAttempt)
          uploadRefs.current.delete(id)
          resolve({ error })
        })

        // For now, simulate the upload since we're using the uploadFile function
        // In production, this would be a direct request to Supabase Storage
        let progress = 0
        const progressInterval = setInterval(async () => {
          progress += Math.random() * 15 + 5
          if (progress >= 100) {
            progress = 100
            clearInterval(progressInterval)
            
            try {
              const result = await uploadFile(file, options.bucket, options.folder)
              
              if (result.error) {
                throw result.error
              }

              updateFileStatus(id, {
                status: 'completed',
                progress: 100,
                uploadResult: result.data,
                estimatedTimeRemaining: 0,
                uploadError: undefined,
                error: undefined
              })
              
              // Get the updated file object with the new status and upload result
              const updatedFile: UploadingFile = {
                ...uploadingFile,
                status: 'completed',
                progress: 100,
                uploadResult: result.data,
                estimatedTimeRemaining: 0,
                uploadError: undefined,
                error: undefined
              }
              
              options.onUploadComplete?.(updatedFile)
              resolve({ data: result.data })
            } catch (error) {
              handleUploadError(uploadingFile, error, startTime, currentAttempt)
              resolve({ error })
            }
            uploadRefs.current.delete(id)
          } else {
            const bytesUploaded = Math.round((progress / 100) * file.size)
            updateFileStatus(id, { progress })
            calculateUploadMetrics(id, bytesUploaded, file.size, startTime)
            options.onUploadProgress?.(uploadingFile, progress)
          }
        }, 200)

        // Store interval for cancellation
        uploadRefs.current.set(id, { 
          abort: () => {
            clearInterval(progressInterval)
            const error = { name: 'AbortError', code: 'CANCELLED', message: 'Upload cancelled' }
            const uploadError = uploadErrorHandler.classifyError(error)
            
            updateFileStatus(id, { 
              status: 'cancelled',
              uploadError,
              error: 'Upload cancelled by user'
            })
          } 
        } as any)
      })

    } catch (error) {
      handleUploadError(uploadingFile, error, startTime, currentAttempt)
      uploadRefs.current.delete(id)
    }
  }, [updateFileStatus, options, calculateUploadMetrics, handleUploadError])

  const processUploadQueue = useCallback(() => {
    setUploadingFiles(prev => {
      const uploadingCount = prev.filter(f => f.status === 'uploading').length
      const pendingFiles = prev.filter(f => f.status === 'pending')
      
      // Start uploads for files that can be processed
      const filesToStart = pendingFiles.slice(0, maxConcurrentUploads - uploadingCount)
      
      filesToStart.forEach(file => {
        uploadSingleFile(file)
      })
      
      return prev
    })
  }, [uploadSingleFile, maxConcurrentUploads])

  const addFiles = useCallback((files: File[]) => {
    const newUploadingFiles = files.map((file, index) => ({
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2)}`,
      file,
      status: 'pending' as const,
      progress: 0,
      queuePosition: index + 1,
      retryAttempt: 0
    }))

    setUploadingFiles(prev => [...prev, ...newUploadingFiles])

    // Update queue positions and start processing
    setTimeout(() => {
      updateQueuePositions()
      processUploadQueue()
    }, 0)

    return newUploadingFiles
  }, [updateQueuePositions, processUploadQueue])

  const cancelUpload = useCallback((fileId: string) => {
    // Clear any pending retry timeout
    const retryTimeout = retryTimeouts.current.get(fileId)
    if (retryTimeout) {
      clearTimeout(retryTimeout)
      retryTimeouts.current.delete(fileId)
    }

    const xhr = uploadRefs.current.get(fileId)
    if (xhr) {
      if ('abort' in xhr && typeof xhr.abort === 'function') {
        xhr.abort()
      }
      uploadRefs.current.delete(fileId)
    }
    
    const error = { name: 'AbortError', code: 'CANCELLED', message: 'Upload cancelled' }
    const uploadError = uploadErrorHandler.classifyError(error)
    
    updateFileStatus(fileId, { 
      status: 'cancelled',
      uploadError,
      error: 'Upload cancelled by user'
    })
    
    // Process next file in queue
    setTimeout(processUploadQueue, 100)
  }, [updateFileStatus, processUploadQueue])

  const retryUpload = useCallback((fileId: string) => {
    // Clear any pending retry timeout
    const retryTimeout = retryTimeouts.current.get(fileId)
    if (retryTimeout) {
      clearTimeout(retryTimeout)
      retryTimeouts.current.delete(fileId)
    }

    updateFileStatus(fileId, { 
      status: 'pending', 
      progress: 0, 
      error: undefined,
      uploadSpeed: 0,
      estimatedTimeRemaining: 0,
      bytesUploaded: 0,
      uploadError: undefined,
      retryDelay: undefined
    })
    
    // Update queue positions and process queue
    setTimeout(() => {
      updateQueuePositions()
      processUploadQueue()
    }, 0)
  }, [updateFileStatus, updateQueuePositions, processUploadQueue])

  const removeFile = useCallback((fileId: string) => {
    // Cancel upload if in progress
    cancelUpload(fileId)
    
    // Remove from list
    setUploadingFiles(prev => prev.filter(f => f.id !== fileId))
    
    // Update queue positions for remaining files
    setTimeout(updateQueuePositions, 0)
  }, [cancelUpload, updateQueuePositions])

  const clearCompleted = useCallback(() => {
    setUploadingFiles(prev => prev.filter(f => f.status !== 'completed'))
  }, [])

  const clearAll = useCallback(() => {
    // Cancel all active uploads and clear timeouts
    uploadingFiles.forEach(file => {
      if (file.status === 'uploading') {
        cancelUpload(file.id)
      }
    })
    
    // Clear all retry timeouts
    retryTimeouts.current.forEach((timeout) => clearTimeout(timeout))
    retryTimeouts.current.clear()
    
    setUploadingFiles([])
  }, [uploadingFiles, cancelUpload])

  // Get error statistics for monitoring
  const getErrorStats = useCallback(() => {
    return uploadErrorHandler.getErrorStats()
  }, [])

  return {
    uploadingFiles,
    addFiles,
    cancelUpload,
    retryUpload,
    removeFile,
    clearCompleted,
    clearAll,
    getErrorStats,
    isUploading: uploadingFiles.some(f => f.status === 'uploading'),
    completedCount: uploadingFiles.filter(f => f.status === 'completed').length,
    errorCount: uploadingFiles.filter(f => f.status === 'error').length,
    pendingCount: uploadingFiles.filter(f => f.status === 'pending').length,
    queueLength: uploadingFiles.filter(f => f.status === 'pending').length,
    isOnline: uploadErrorHandler.isOnline()
  }
} 