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

export const uploadFile = async (
  file: File,
  bucket: string = storageConfig.buckets.qaFiles,
  folder: string = ''
): Promise<UploadResult> => {
  try {
    // Validate file type
    const fileExtension = file.name.split('.').pop()?.toLowerCase()
    if (!fileExtension || !Object.keys(storageConfig.allowedFileTypes).includes(fileExtension)) {
      return {
        error: new Error(`File type .${fileExtension} is not supported. Supported types: ${Object.keys(storageConfig.allowedFileTypes).join(', ')}`)
      }
    }

    // Validate file size
    if (file.size > storageConfig.maxFileSize) {
      return {
        error: new Error(`File size exceeds maximum limit of ${storageConfig.maxFileSize / (1024 * 1024)}MB`)
      }
    }

    // Generate unique filename
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2)
    const fileName = `${timestamp}_${randomId}_${file.name}`
    const filePath = folder ? `${folder}/${fileName}` : fileName

    // Upload file
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
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
    return {
      error: error instanceof Error ? error : new Error('Unknown upload error')
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