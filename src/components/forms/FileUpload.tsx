import React, { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Upload, FileText, X, AlertCircle, CheckCircle } from 'lucide-react'

interface FileUploadProps {
  onFileSelect: (files: File[]) => void
  onFileRemove: (fileId: string) => void
  className?: string
  acceptedFileTypes?: string[]
  maxFileSize?: number
  maxFiles?: number
  uploadProgress?: Record<string, number>
  disabled?: boolean
}

interface UploadedFile {
  id: string
  file: File
  status: 'pending' | 'uploading' | 'completed' | 'error'
  progress?: number
  error?: string
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  onFileRemove,
  className,
  acceptedFileTypes = ['.xliff', '.xlf', '.mxliff'],
  maxFileSize = 50 * 1024 * 1024, // 50MB
  maxFiles = 10,
  uploadProgress = {},
  disabled = false
}) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [dragActive, setDragActive] = useState(false)

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > maxFileSize) {
      return `File size exceeds ${Math.round(maxFileSize / (1024 * 1024))}MB limit`
    }

    // Check file extension
    const extension = file.name.toLowerCase().split('.').pop()
    const acceptedExtensions = acceptedFileTypes.map(type => type.replace('.', ''))
    
    if (!extension || !acceptedExtensions.includes(extension)) {
      return `File type not supported. Please upload: ${acceptedFileTypes.join(', ')}`
    }

    return null
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (disabled) return

    const validFiles: File[] = []
    const newFiles: UploadedFile[] = []

    acceptedFiles.forEach(file => {
      const error = validateFile(file)
      const fileId = `${file.name}-${Date.now()}-${Math.random()}`

      if (error) {
        newFiles.push({
          id: fileId,
          file,
          status: 'error',
          error
        })
      } else {
        validFiles.push(file)
        newFiles.push({
          id: fileId,
          file,
          status: 'pending'
        })
      }
    })

    setUploadedFiles(prev => [...prev, ...newFiles])
    
    if (validFiles.length > 0) {
      onFileSelect(validFiles)
    }
  }, [onFileSelect, disabled, maxFileSize, acceptedFileTypes])

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
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false),
    onDropAccepted: () => setDragActive(false),
    onDropRejected: () => setDragActive(false)
  })

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId))
    onFileRemove(fileId)
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
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

  return (
    <div className={cn("space-y-4", className)}>
      {/* Drop Zone */}
      <Card 
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed transition-colors cursor-pointer",
          isDragActive && "border-primary bg-primary/5",
          isDragAccept && "border-green-500 bg-green-50",
          isDragReject && "border-red-500 bg-red-50",
          disabled && "cursor-not-allowed opacity-50",
          !isDragActive && !disabled && "hover:border-primary/50 hover:bg-primary/5"
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
                Drag and drop your XLIFF files here, or click to browse
              </p>
              <p className="text-xs text-muted-foreground">
                Supports: {acceptedFileTypes.join(', ')} • Max {Math.round(maxFileSize / (1024 * 1024))}MB per file
              </p>
            </div>

            <Button 
              type="button" 
              variant="outline" 
              size="sm"
              disabled={disabled}
            >
              Choose Files
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* File List */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Uploaded Files</h4>
          <div className="space-y-2">
            {uploadedFiles.map((uploadedFile) => {
              const progress = uploadProgress[uploadedFile.id] || 0
              
              return (
                <Card key={uploadedFile.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      {getFileTypeIcon(uploadedFile.file.name)}
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {uploadedFile.file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(uploadedFile.file.size)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {/* Status Badge */}
                      {uploadedFile.status === 'pending' && (
                        <Badge variant="outline">Pending</Badge>
                      )}
                      {uploadedFile.status === 'uploading' && (
                        <Badge variant="secondary">Uploading</Badge>
                      )}
                      {uploadedFile.status === 'completed' && (
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Complete
                        </Badge>
                      )}
                      {uploadedFile.status === 'error' && (
                        <Badge variant="destructive">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Error
                        </Badge>
                      )}

                      {/* Remove Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(uploadedFile.id)}
                        className="h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {uploadedFile.status === 'uploading' && (
                    <div className="mt-3">
                      <Progress value={progress} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-1">
                        {progress}% uploaded
                      </p>
                    </div>
                  )}

                  {/* Error Message */}
                  {uploadedFile.status === 'error' && uploadedFile.error && (
                    <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-xs text-red-600">{uploadedFile.error}</p>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
} 