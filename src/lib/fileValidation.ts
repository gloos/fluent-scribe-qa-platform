export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export interface FileValidationOptions {
  maxFileSize?: number
  allowedExtensions?: string[]
  allowedMimeTypes?: string[]
  maxFileNameLength?: number
  checkForDuplicates?: boolean
  existingFiles?: File[]
  validateContent?: boolean
}

const DEFAULT_OPTIONS: Required<FileValidationOptions> = {
  maxFileSize: 50 * 1024 * 1024, // 50MB
  allowedExtensions: ['xliff', 'xlf', 'mxliff'],
  allowedMimeTypes: [
    'application/xliff+xml',
    'text/xml',
    'application/xml',
    'text/plain' // Some XLIFF files might be served as plain text
  ],
  maxFileNameLength: 255,
  checkForDuplicates: true,
  existingFiles: [],
  validateContent: false
}

/**
 * Validates a file against XLIFF upload requirements
 */
export const validateFile = async (
  file: File, 
  options: FileValidationOptions = {}
): Promise<ValidationResult> => {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const errors: string[] = []
  const warnings: string[] = []

  // 1. File name validation
  const fileNameValidation = validateFileName(file.name, opts.maxFileNameLength)
  if (!fileNameValidation.isValid) {
    errors.push(...fileNameValidation.errors)
  }
  warnings.push(...fileNameValidation.warnings)

  // 2. File size validation
  const sizeValidation = validateFileSize(file.size, opts.maxFileSize)
  if (!sizeValidation.isValid) {
    errors.push(...sizeValidation.errors)
  }
  warnings.push(...sizeValidation.warnings)

  // 3. File extension validation
  const extensionValidation = validateFileExtension(file.name, opts.allowedExtensions)
  if (!extensionValidation.isValid) {
    errors.push(...extensionValidation.errors)
  }
  warnings.push(...extensionValidation.warnings)

  // 4. MIME type validation
  const mimeValidation = validateMimeType(file, opts.allowedMimeTypes)
  if (!mimeValidation.isValid) {
    errors.push(...mimeValidation.errors)
  }
  warnings.push(...mimeValidation.warnings)

  // 5. Duplicate file validation
  if (opts.checkForDuplicates && opts.existingFiles.length > 0) {
    const duplicateValidation = validateForDuplicates(file, opts.existingFiles)
    if (!duplicateValidation.isValid) {
      errors.push(...duplicateValidation.errors)
    }
    warnings.push(...duplicateValidation.warnings)
  }

  // 6. Content validation (if enabled)
  if (opts.validateContent) {
    try {
      const contentValidation = await validateXLIFFContent(file)
      if (!contentValidation.isValid) {
        errors.push(...contentValidation.errors)
      }
      warnings.push(...contentValidation.warnings)
    } catch (error) {
      warnings.push('Could not validate file content - proceeding with upload')
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validates file name for length and invalid characters
 */
const validateFileName = (fileName: string, maxLength: number): ValidationResult => {
  const errors: string[] = []
  const warnings: string[] = []

  // Check length
  if (fileName.length > maxLength) {
    errors.push(`File name is too long (${fileName.length} characters). Maximum allowed is ${maxLength} characters.`)
  }

  // Check for invalid characters
  const invalidChars = /[<>:"/\\|?*\x00-\x1f]/
  if (invalidChars.test(fileName)) {
    errors.push('File name contains invalid characters. Please use only letters, numbers, spaces, hyphens, and underscores.')
  }

  // Check for reserved names (Windows)
  const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9']
  const baseName = fileName.split('.')[0].toUpperCase()
  if (reservedNames.includes(baseName)) {
    errors.push('File name uses a reserved system name. Please rename the file.')
  }

  // Warnings
  if (fileName.includes(' ')) {
    warnings.push('File name contains spaces. Consider using underscores or hyphens for better compatibility.')
  }

  return { isValid: errors.length === 0, errors, warnings }
}

/**
 * Validates file size
 */
const validateFileSize = (fileSize: number, maxSize: number): ValidationResult => {
  const errors: string[] = []
  const warnings: string[] = []

  if (fileSize === 0) {
    errors.push('File appears to be empty (0 bytes). Please select a valid XLIFF file.')
    return { isValid: false, errors, warnings }
  }

  if (fileSize > maxSize) {
    const maxSizeMB = Math.round(maxSize / (1024 * 1024))
    const fileSizeMB = Math.round(fileSize / (1024 * 1024))
    errors.push(`File size (${fileSizeMB}MB) exceeds the maximum allowed size of ${maxSizeMB}MB.`)
  }

  // Warning for very large files
  const warningThreshold = maxSize * 0.8 // 80% of max size
  if (fileSize > warningThreshold && fileSize <= maxSize) {
    const fileSizeMB = Math.round(fileSize / (1024 * 1024))
    warnings.push(`Large file detected (${fileSizeMB}MB). Upload may take longer than usual.`)
  }

  return { isValid: errors.length === 0, errors, warnings }
}

/**
 * Validates file extension
 */
const validateFileExtension = (fileName: string, allowedExtensions: string[]): ValidationResult => {
  const errors: string[] = []
  const warnings: string[] = []

  const extension = fileName.toLowerCase().split('.').pop()
  
  if (!extension) {
    errors.push('File has no extension. XLIFF files should have .xliff, .xlf, or .mxliff extension.')
    return { isValid: false, errors, warnings }
  }

  if (!allowedExtensions.includes(extension)) {
    errors.push(`File type '.${extension}' is not supported. Please upload files with these extensions: ${allowedExtensions.map(ext => `.${ext}`).join(', ')}.`)
  }

  return { isValid: errors.length === 0, errors, warnings }
}

/**
 * Validates MIME type
 */
const validateMimeType = (file: File, allowedMimeTypes: string[]): ValidationResult => {
  const errors: string[] = []
  const warnings: string[] = []

  if (!file.type) {
    warnings.push('File MIME type could not be determined. Proceeding based on file extension.')
    return { isValid: true, errors, warnings }
  }

  if (!allowedMimeTypes.includes(file.type)) {
    // Don't fail validation, but warn user
    warnings.push(`File MIME type '${file.type}' may not be fully supported. Expected: ${allowedMimeTypes.join(', ')}.`)
  }

  return { isValid: true, errors, warnings }
}

/**
 * Checks for duplicate files based on name, size, and last modified date
 */
const validateForDuplicates = (file: File, existingFiles: File[]): ValidationResult => {
  const errors: string[] = []
  const warnings: string[] = []

  const duplicate = existingFiles.find(existing => 
    existing.name === file.name && 
    existing.size === file.size &&
    existing.lastModified === file.lastModified
  )

  if (duplicate) {
    errors.push(`File '${file.name}' appears to be a duplicate. Please select a different file or rename this one.`)
  }

  // Check for files with same name but different content
  const sameName = existingFiles.find(existing => existing.name === file.name)
  if (sameName && !duplicate) {
    warnings.push(`A file named '${file.name}' is already selected. Consider renaming to avoid confusion.`)
  }

  return { isValid: errors.length === 0, errors, warnings }
}

/**
 * Validates basic XLIFF content structure
 */
const validateXLIFFContent = async (file: File): Promise<ValidationResult> => {
  const errors: string[] = []
  const warnings: string[] = []

  try {
    // Read first 1KB of file for quick validation
    const slice = file.slice(0, 1024)
    const text = await slice.text()
    
    // Check for XML declaration
    if (!text.includes('<?xml')) {
      warnings.push('File does not appear to start with XML declaration. May not be a valid XLIFF file.')
    }

    // Check for XLIFF namespace
    const hasXLIFFNamespace = text.includes('xliff') || text.includes('XLIFF')
    if (!hasXLIFFNamespace) {
      warnings.push('File does not appear to contain XLIFF namespace. May not be a valid XLIFF file.')
    }

    // Check for basic XLIFF structure
    const hasFileElement = text.includes('<file') || text.includes('<File')
    if (!hasFileElement) {
      warnings.push('File does not appear to contain XLIFF file elements. May not be a valid XLIFF file.')
    }

    // Check encoding
    if (text.includes('encoding=') && !text.includes('UTF-8') && !text.includes('utf-8')) {
      warnings.push('File encoding may not be UTF-8. Consider converting to UTF-8 for best compatibility.')
    }

  } catch (error) {
    warnings.push('Could not read file content for validation.')
  }

  return { isValid: true, errors, warnings }
}

/**
 * Validates multiple files at once
 */
export const validateFiles = async (
  files: File[], 
  options: FileValidationOptions = {}
): Promise<{ validFiles: File[], invalidFiles: { file: File, validation: ValidationResult }[] }> => {
  const validFiles: File[] = []
  const invalidFiles: { file: File, validation: ValidationResult }[] = []

  for (const file of files) {
    const validation = await validateFile(file, { 
      ...options, 
      existingFiles: [...(options.existingFiles || []), ...validFiles] 
    })
    
    if (validation.isValid) {
      validFiles.push(file)
    } else {
      invalidFiles.push({ file, validation })
    }
  }

  return { validFiles, invalidFiles }
}

/**
 * Gets a human-readable summary of validation results
 */
export const getValidationSummary = (results: ValidationResult[]): string => {
  const totalFiles = results.length
  const validFiles = results.filter(r => r.isValid).length
  const invalidFiles = totalFiles - validFiles
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0)
  const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0)

  let summary = `${validFiles} of ${totalFiles} files passed validation`
  
  if (invalidFiles > 0) {
    summary += `, ${invalidFiles} failed`
  }
  
  if (totalErrors > 0) {
    summary += ` (${totalErrors} errors)`
  }
  
  if (totalWarnings > 0) {
    summary += ` (${totalWarnings} warnings)`
  }

  return summary
} 