import React, { useCallback, useEffect, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Upload, FileText, X, AlertCircle, CheckCircle, RotateCcw, AlertTriangle, Wifi, WifiOff, Clock } from 'lucide-react'
import { useFileUpload, UploadingFile } from '@/hooks/useFileUpload'
import { validateFiles, ValidationResult } from '@/lib/fileValidation'
import { UploadError } from '@/lib/uploadErrorHandling'

interface FileUploadProps {
  onFileSelect?: (files: File[]) => void
  onFileRemove?: (fileId: string) => void
  onUploadComplete?: (files: UploadingFile[]) => void
  onUploadError?: (file: UploadingFile, error: UploadError) => void
  onValidationError?: (files: { file: File, validation: ValidationResult }[]) => void
  className?: string
  acceptedFileTypes?: string[]
  maxFileSize?: number
  maxFiles?: number
  disabled?: boolean
  bucket?: string
  folder?: string
  autoUpload?: boolean
  validateContent?: boolean
  showWarnings?: boolean
  enableRetry?: boolean
  maxRetryAttempts?: number
}

interface FileWithValidation {
  file: File
  validation: ValidationResult
}

interface RetryCountdownProps {
  file: UploadingFile
  onRetryNow: () => void
}

const RetryCountdown: React.FC<RetryCountdownProps> = ({ file, onRetryNow }) => {
  const [countdown, setCountdown] = useState<number>(0)

  useEffect(() => {
    if (file.retryDelay && file.lastRetryTime) {
      const endTime = file.lastRetryTime + file.retryDelay
      
      const updateCountdown = () => {
        const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000))
        setCountdown(remaining)
        
        if (remaining <= 0) {
          setCountdown(0)
        }
      }

      updateCountdown()
      const interval = setInterval(updateCountdown, 1000)
      
      return () => clearInterval(interval)
    }
  }, [file.retryDelay, file.lastRetryTime])

  if (countdown <= 0) return null

  return (
    <div className="flex items-center space-x-2 text-xs text-amber-600">
      <Clock className="h-3 w-3" />
      <span>Retrying in {countdown}s</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={onRetryNow}
        className="h-6 px-2 text-xs"
      >
        Retry Now
      </Button>
    </div>
  )
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  onFileRemove,
  onUploadComplete,
  onUploadError,
  onValidationError,
  className,
  acceptedFileTypes = ['.xliff', '.xlf', '.mxliff'],
  maxFileSize = 50 * 1024 * 1024, // 50MB
  maxFiles = 10,
  disabled = false,
  bucket,
  folder,
  autoUpload = true,
  validateContent = false,
  showWarnings = true,
  enableRetry = true,
  maxRetryAttempts = 3
}) => {
  const [validationResults, setValidationResults] = useState<FileWithValidation[]>([])
  
  const {
    uploadingFiles,
    addFiles,
    cancelUpload,
    retryUpload,
    removeFile,
    clearCompleted,
    getErrorStats,
    isUploading,
    completedCount,
    errorCount,
    isOnline
  } = useFileUpload({
    onUploadComplete: (file) => {
      console.log('📁 FileUpload: Upload completed for', file.file.name, 'Status:', file.status, 'Has result:', !!file.uploadResult);
      if (onUploadComplete) {
        onUploadComplete([file])
      }
    },
    onUploadError: (file, error) => {
      if (onUploadError) {
        onUploadError(file, error)
      }
    },
    onRetryAttempt: (file, attempt) => {
      console.log(`🔄 Retry attempt ${attempt} for ${file.file.name}`)
    },
    bucket,
    folder,
    enableRetry,
    maxRetryAttempts
  })

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (disabled) return

    // Get existing files for duplicate detection
    const existingFiles = uploadingFiles.map(f => f.file)

    // Validate all files at once
    const { validFiles, invalidFiles } = await validateFiles(acceptedFiles, {
      maxFileSize,
      allowedExtensions: acceptedFileTypes.map(type => type.replace('.', '')),
      checkForDuplicates: true,
      existingFiles,
      validateContent
    })

    // Check max files limit
    const currentValidFiles = uploadingFiles.filter(f => f.status !== 'error').length
    const filesToAdd = validFiles.slice(0, Math.max(0, maxFiles - currentValidFiles))
    
    if (filesToAdd.length < validFiles.length) {
      console.warn(`Only ${filesToAdd.length} files added due to max files limit of ${maxFiles}`)
    }

    // Store validation results for display
    if (invalidFiles.length > 0) {
      setValidationResults(prev => [...prev, ...invalidFiles])
      if (onValidationError) {
        onValidationError(invalidFiles)
      }
    }

    if (filesToAdd.length > 0) {
      // Call legacy onFileSelect if provided
      if (onFileSelect) {
        onFileSelect(filesToAdd)
      }

      // Add files to upload queue
      if (autoUpload) {
        addFiles(filesToAdd)
      }
    }
  }, [onFileSelect, disabled, maxFileSize, acceptedFileTypes, maxFiles, uploadingFiles, addFiles, autoUpload, validateContent, onValidationError])

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragReject,
    isDragAccept
  } = useDropzone({
    onDrop,
    accept: {
      'application/xliff+xml': acceptedFileTypes,
      'text/xml': acceptedFileTypes,
      'application/xml': acceptedFileTypes
    },
    maxFiles,
    disabled,
    noClick: isUploading // Prevent clicking while uploading
  })

  const handleRemoveFile = (fileId: string) => {
    removeFile(fileId)
    if (onFileRemove) {
      onFileRemove(fileId)
    }
  }

  const clearValidationResults = () => {
    setValidationResults([])
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatUploadSpeed = (bytesPerSecond: number): string => {
    if (bytesPerSecond === 0) return '0 B/s'
    const k = 1024
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s']
    const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k))
    return parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const formatTimeRemaining = (seconds: number): string => {
    if (seconds === 0 || !isFinite(seconds)) return ''
    
    if (seconds < 60) return `${Math.round(seconds)}s remaining`
    if (seconds < 3600) return `${Math.round(seconds / 60)}m remaining`
    return `${Math.round(seconds / 3600)}h remaining`
  }

  const getFileTypeIcon = (fileName: string) => {
    const extension = fileName.toLowerCase().split('.').pop()
    switch (extension) {
      case 'xliff':
      case 'xlf':
      case 'mxliff':
        return <FileText className="h-5 w-5 text-blue-500" />
      default:
        return <FileText className="h-5 w-5 text-gray-500" />
    }
  }

  const getErrorTypeColor = (errorType?: string) => {
    switch (errorType) {
      case 'network':
        return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'timeout':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'authentication':
        return 'text-purple-600 bg-purple-50 border-purple-200'
      case 'storage':
        return 'text-red-600 bg-red-50 border-red-200'
      case 'server':
        return 'text-red-600 bg-red-50 border-red-200'
      default:
        return 'text-red-600 bg-red-50 border-red-200'
    }
  }

  const getErrorIcon = (errorType?: string) => {
    switch (errorType) {
      case 'network':
        return <WifiOff className="h-3 w-3" />
      case 'timeout':
        return <Clock className="h-3 w-3" />
      default:
        return <AlertCircle className="h-3 w-3" />
    }
  }

  const getStatusBadge = (status: UploadingFile['status'], queuePosition?: number, uploadError?: UploadError) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="outline" className="text-amber-600 border-amber-300">
            {queuePosition ? `Queue #${queuePosition}` : 'Pending'}
          </Badge>
        )
      case 'uploading':
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800 animate-pulse">
            Uploading
          </Badge>
        )
      case 'completed':
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Complete
          </Badge>
        )
      case 'error':
        const errorTypeColor = getErrorTypeColor(uploadError?.type)
        return (
          <Badge variant="destructive" className={cn('flex items-center', errorTypeColor)}>
            {getErrorIcon(uploadError?.type)}
            <span className="ml-1 capitalize">{uploadError?.type || 'Error'}</span>
          </Badge>
        )
      case 'cancelled':
        return <Badge variant="outline" className="text-gray-500">Cancelled</Badge>
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Network Status Indicator */}
      {!isOnline && (
        <div className="flex items-center space-x-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <WifiOff className="h-5 w-5 text-orange-500" />
          <span className="text-sm text-orange-700">
            You're offline. Uploads will retry automatically when connection is restored.
          </span>
        </div>
      )}

      {/* Drop Zone */}
      <Card 
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed transition-colors cursor-pointer",
          isDragActive && "border-primary bg-primary/5",
          isDragAccept && "border-green-500 bg-green-50",
          isDragReject && "border-red-500 bg-red-50",
          (disabled || isUploading) && "cursor-not-allowed opacity-50",
          !isDragActive && !disabled && !isUploading && "hover:border-primary/50 hover:bg-primary/5"
        )}
      >
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <input {...getInputProps()} />
          
          <div className="flex flex-col items-center space-y-4">
            <div className={cn(
              "p-4 rounded-full",
              isDragActive ? "bg-primary/10" : "bg-muted/50"
            )}>
              <Upload className={cn(
                "h-8 w-8",
                isDragActive ? "text-primary" : "text-muted-foreground"
              )} />
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold">
                {isDragActive ? "Drop files here..." : "Upload XLIFF Files"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {isUploading 
                  ? "Upload in progress..." 
                  : "Drag and drop your XLIFF files here, or click to browse"
                }
              </p>
              <p className="text-xs text-muted-foreground">
                Supports: {acceptedFileTypes.join(', ')} • Max {Math.round(maxFileSize / (1024 * 1024))}MB per file • Max {maxFiles} files
              </p>
              
              {/* Connection Status */}
              <div className="flex items-center justify-center space-x-1 text-xs">
                {isOnline ? (
                  <>
                    <Wifi className="h-3 w-3 text-green-500" />
                    <span className="text-green-600">Online</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3 w-3 text-orange-500" />
                    <span className="text-orange-600">Offline</span>
                  </>
                )}
                {enableRetry && (
                  <span className="text-muted-foreground ml-2">• Auto-retry enabled</span>
                )}
              </div>
            </div>

            <Button 
              type="button" 
              variant="outline" 
              size="sm"
              disabled={disabled || isUploading}
            >
              {isUploading ? "Uploading..." : "Choose Files"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Validation Errors */}
      {validationResults.length > 0 && (
        <Card className="border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <h4 className="font-medium text-red-700">File Validation Issues</h4>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearValidationResults}
                className="text-xs"
              >
                Clear
              </Button>
            </div>
            
            <div className="space-y-3">
              {validationResults.map((result, index) => (
                <div key={index} className="border border-red-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2 mb-2">
                    {getFileTypeIcon(result.file.name)}
                    <span className="font-medium text-sm">{result.file.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({formatFileSize(result.file.size)})
                    </span>
                  </div>
                  
                  {result.validation.errors.length > 0 && (
                    <div className="mb-2">
                      <div className="text-xs font-medium text-red-700 mb-1">Errors:</div>
                      <ul className="list-disc list-inside space-y-1">
                        {result.validation.errors.map((error, errorIndex) => (
                          <li key={errorIndex} className="text-xs text-red-600">{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {showWarnings && result.validation.warnings.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-yellow-700 mb-1">Warnings:</div>
                      <ul className="list-disc list-inside space-y-1">
                        {result.validation.warnings.map((warning, warningIndex) => (
                          <li key={warningIndex} className="text-xs text-yellow-600 flex items-start">
                            <AlertTriangle className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0" />
                            {warning}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Summary */}
      {uploadingFiles.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="text-sm text-muted-foreground">
            {uploadingFiles.length} file(s) • {completedCount} completed • {errorCount} errors
            {uploadingFiles.filter(f => f.status === 'pending').length > 0 && (
              <span> • {uploadingFiles.filter(f => f.status === 'pending').length} in queue</span>
            )}
            {isUploading && (
              <span> • {uploadingFiles.filter(f => f.status === 'uploading').length} uploading</span>
            )}
          </div>
          <div className="flex space-x-2">
            {completedCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearCompleted}
                className="text-xs"
              >
                Clear Completed
              </Button>
            )}
            {(isUploading || uploadingFiles.filter(f => f.status === 'pending').length > 0) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Cancel all uploads and clear queue
                  uploadingFiles.forEach(file => {
                    if (file.status === 'uploading' || file.status === 'pending') {
                      cancelUpload(file.id)
                    }
                  })
                }}
                className="text-xs text-red-600 hover:text-red-700"
              >
                Cancel All
              </Button>
            )}
          </div>
        </div>
      )}

      {/* File List */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Files</h4>
          <div className="space-y-2">
            {uploadingFiles.map((uploadingFile) => (
              <Card key={uploadingFile.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    {getFileTypeIcon(uploadingFile.file.name)}
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {uploadingFile.file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(uploadingFile.file.size)}
                        {uploadingFile.retryAttempt && uploadingFile.retryAttempt > 1 && (
                          <span className="ml-2 text-amber-600">
                            • Attempt {uploadingFile.retryAttempt}/{maxRetryAttempts}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {/* Status Badge */}
                    {getStatusBadge(uploadingFile.status, uploadingFile.queuePosition, uploadingFile.uploadError)}

                    {/* Retry Button for Errors */}
                    {uploadingFile.status === 'error' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => retryUpload(uploadingFile.id)}
                        className="h-8 w-8 p-0"
                        title="Retry upload"
                        disabled={!isOnline && uploadingFile.uploadError?.type !== 'network'}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}

                    {/* Cancel/Remove Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (uploadingFile.status === 'uploading') {
                          cancelUpload(uploadingFile.id)
                        } else {
                          handleRemoveFile(uploadingFile.id)
                        }
                      }}
                      className="h-8 w-8 p-0"
                      title={uploadingFile.status === 'uploading' ? 'Cancel upload' : 'Remove file'}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Progress Bar */}
                {uploadingFile.status === 'uploading' && (
                  <div className="mt-3 space-y-2">
                    <Progress 
                      value={uploadingFile.progress} 
                      className="h-3" 
                      showAnimation={true}
                    />
                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                      <span>{uploadingFile.progress}% uploaded</span>
                      <div className="flex items-center space-x-2">
                        {uploadingFile.uploadSpeed && uploadingFile.uploadSpeed > 0 && (
                          <span>{formatUploadSpeed(uploadingFile.uploadSpeed)}</span>
                        )}
                        {uploadingFile.estimatedTimeRemaining && uploadingFile.estimatedTimeRemaining > 0 && (
                          <span>• {formatTimeRemaining(uploadingFile.estimatedTimeRemaining)}</span>
                        )}
                      </div>
                    </div>
                    {uploadingFile.bytesUploaded && (
                      <div className="text-xs text-muted-foreground">
                        {formatFileSize(uploadingFile.bytesUploaded)} of {formatFileSize(uploadingFile.file.size)}
                      </div>
                    )}
                  </div>
                )}

                {/* Queue Status */}
                {uploadingFile.status === 'pending' && uploadingFile.queuePosition && (
                  <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-md">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-amber-700">
                        Position #{uploadingFile.queuePosition} in queue
                      </p>
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-amber-400 rounded-full animate-queue-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-amber-400 rounded-full animate-queue-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-amber-400 rounded-full animate-queue-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Retry Countdown */}
                {uploadingFile.status === 'error' && uploadingFile.retryDelay && uploadingFile.lastRetryTime && (
                  <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-md">
                    <RetryCountdown
                      file={uploadingFile}
                      onRetryNow={() => retryUpload(uploadingFile.id)}
                    />
                  </div>
                )}

                {/* Enhanced Error Message */}
                {uploadingFile.status === 'error' && uploadingFile.error && (
                  <div className={cn('mt-3 p-3 rounded-md border', getErrorTypeColor(uploadingFile.uploadError?.type))}>
                    <div className="flex items-start space-x-2">
                      {getErrorIcon(uploadingFile.uploadError?.type)}
                      <div className="flex-1">
                        <p className="text-xs font-medium">
                          {uploadingFile.uploadError?.type ? `${uploadingFile.uploadError.type.toUpperCase()} ERROR` : 'ERROR'}
                        </p>
                        <p className="text-xs mt-1">{uploadingFile.error}</p>
                        {uploadingFile.uploadError?.isRetriable && enableRetry && (
                          <p className="text-xs mt-1 opacity-75">
                            {isOnline || uploadingFile.uploadError.type === 'network' 
                              ? 'This error can be retried automatically.' 
                              : 'Will retry when connection is restored.'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Success Message */}
                {uploadingFile.status === 'completed' && uploadingFile.uploadResult && (
                  <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-md">
                    <p className="text-xs text-green-600">
                      Upload completed successfully
                    </p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
} 