import { supabase } from './supabase'

export interface UploadResult {
  data?: {
    path: string
    fullPath: string
    publicUrl: string
  }
  error?: Error | null
}

export const storageConfig = {
  buckets: {
    qaFiles: 'qa-files',
    reports: 'reports',
    exports: 'exports'
  },
  allowedFileTypes: {
    xliff: ['application/xliff+xml', 'text/xml', 'application/xml'],
    xlf: ['application/xliff+xml', 'text/xml', 'application/xml'],
    mxliff: ['application/xliff+xml', 'text/xml', 'application/xml']
  },
  maxFileSize: 50 * 1024 * 1024 // 50MB
}

// Helper function to get the correct MIME type for XLIFF files
const getCorrectMimeType = (file: File, fileExtension: string): string => {
  // Map of file extensions to their correct MIME types
  const mimeTypeMap: Record<string, string> = {
    'xliff': 'application/xliff+xml',
    'xlf': 'application/xliff+xml', 
    'mxliff': 'application/xliff+xml'
  }

  // Return the correct MIME type based on extension, fallback to file.type
  return mimeTypeMap[fileExtension] || file.type || 'application/xliff+xml'
}

export const uploadFile = async (
  file: File | Blob,
  bucket: string = storageConfig.buckets.qaFiles,
  folder: string = '',
  fileName?: string
): Promise<UploadResult> => {
  try {
    // Handle blob uploads (for chunks)
    if (file instanceof Blob && !(file instanceof File)) {
      if (!fileName) {
        return {
          error: new Error('fileName is required when uploading Blob objects')
        }
      }

      // Generate unique filename for blob
      const timestamp = Date.now()
      const randomId = Math.random().toString(36).substring(2)
      const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
      const fullFileName = `${timestamp}_${randomId}_${sanitizedName}`
      const filePath = folder ? `${folder}/${fullFileName}` : fullFileName

      // Upload blob with binary content type
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'application/octet-stream'
        })

      if (error) {
        console.error('Supabase blob upload error:', error)
        return { error }
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath)

      return {
        data: {
          path: data.path,
          fullPath: data.fullPath,
          publicUrl
        }
      }
    }

    // Handle regular file uploads
    const fileObj = file as File
    
    // Validate file type for XLIFF files
    const fileExtension = fileObj.name.split('.').pop()?.toLowerCase()
    if (!fileExtension || !Object.keys(storageConfig.allowedFileTypes).includes(fileExtension)) {
      return {
        error: new Error(`File type .${fileExtension} is not supported. Supported types: ${Object.keys(storageConfig.allowedFileTypes).join(', ')}`)
      }
    }

    // Validate file size
    if (fileObj.size > storageConfig.maxFileSize) {
      return {
        error: new Error(`File size exceeds maximum limit of ${storageConfig.maxFileSize / (1024 * 1024)}MB`)
      }
    }

    // Generate unique filename
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2)
    const finalFileName = fileName || fileObj.name
    const sanitizedName = finalFileName.replace(/[^a-zA-Z0-9.-]/g, '_')
    const fullFileName = `${timestamp}_${randomId}_${sanitizedName}`
    const filePath = folder ? `${folder}/${fullFileName}` : fullFileName

    // Get the correct MIME type for the file
    const correctMimeType = getCorrectMimeType(fileObj, fileExtension)

    // Create a new File object with the correct MIME type if needed
    const fileToUpload = fileObj.type === 'application/octet-stream' || !fileObj.type 
      ? new File([fileObj], fileObj.name, { type: correctMimeType })
      : fileObj

    console.log(`Uploading file with MIME type: ${fileToUpload.type}`)

    // Upload file with explicit content type
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, fileToUpload, {
        cacheControl: '3600',
        upsert: false,
        contentType: correctMimeType
      })

    if (error) {
      console.error('Supabase upload error:', error)
      return { error }
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath)

    return {
      data: {
        path: data.path,
        fullPath: data.fullPath,
        publicUrl
      }
    }
  } catch (error) {
    console.error('Upload catch error:', error)
    return {
      error: error instanceof Error ? error : new Error('Unknown upload error')
    }
  }
}

/**
 * Specialized function for uploading file chunks
 */
export const uploadChunk = async (
  chunkBlob: Blob,
  chunkId: string,
  bucket: string = storageConfig.buckets.qaFiles,
  folder: string = 'chunks'
): Promise<UploadResult> => {
  try {
    const chunkFileName = `${chunkId}.chunk`
    return await uploadFile(chunkBlob, bucket, folder, chunkFileName)
  } catch (error) {
    console.error('Chunk upload error:', error)
    return {
      error: error instanceof Error ? error : new Error('Unknown chunk upload error')
    }
  }
}

export const deleteFile = async (
  filePath: string,
  bucket: string = storageConfig.buckets.qaFiles
): Promise<{ error?: Error | null }> => {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath])

    return { error }
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error('Unknown delete error')
    }
  }
}

export const getFileUrl = (
  filePath: string,
  bucket: string = storageConfig.buckets.qaFiles
): string => {
  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath)
  
  return data.publicUrl
}

export const downloadFile = async (
  filePath: string,
  bucket: string = storageConfig.buckets.qaFiles
): Promise<{ data?: Blob; error?: Error | null }> => {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(filePath)

    return { data, error }
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error('Unknown download error')
    }
  }
}

export const listFiles = async (
  folder: string = '',
  bucket: string = storageConfig.buckets.qaFiles
) => {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(folder, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' }
      })

    return { data, error }
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error('Unknown list error')
    }
  }
} 