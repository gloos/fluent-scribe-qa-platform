import { TestFileConfig } from '../types'

export class SyntheticFileGenerator {
  /**
   * Generate a synthetic file for testing based on configuration
   */
  static generateFile(config: TestFileConfig): File {
    const { sizeInMB, type, contentPattern = 'random', name } = config
    const sizeInBytes = sizeInMB * 1024 * 1024
    
    let content: string
    
    switch (type) {
      case 'xliff':
        content = this.generateXLIFFContent(sizeInBytes, contentPattern)
        break
      case 'custom':
        content = config.content || this.generateGenericContent(sizeInBytes, contentPattern)
        break
      case 'synthetic':
      default:
        content = this.generateGenericContent(sizeInBytes, contentPattern)
        break
    }
    
    // Create blob with appropriate MIME type
    const mimeType = type === 'xliff' ? 'application/xml' : 'text/plain'
    const blob = new Blob([content], { type: mimeType })
    
    // Create File object with last modified date for cache consistency
    const file = new File([blob], name, {
      type: mimeType,
      lastModified: Date.now()
    })
    
    return file
  }
  
  /**
   * Generate XLIFF file content with realistic structure
   */
  private static generateXLIFFContent(targetSize: number, pattern: string): string {
    const xliffHeader = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="en-US" target-language="es-ES" datatype="plaintext" original="test.txt">
    <body>`
    
    const xliffFooter = `
    </body>
  </file>
</xliff>`
    
    const headerSize = new Blob([xliffHeader]).size
    const footerSize = new Blob([xliffFooter]).size
    const availableSize = targetSize - headerSize - footerSize
    
    let translationUnits = ''
    let currentSize = 0
    let unitId = 1
    
    while (currentSize < availableSize - 200) { // Leave buffer for last unit
      const sourceText = this.generateTextByPattern(pattern, 50 + Math.random() * 100)
      const targetText = this.generateTextByPattern(pattern, 50 + Math.random() * 100)
      
      const unit = `
      <trans-unit id="${unitId}">
        <source>${this.escapeXML(sourceText)}</source>
        <target>${this.escapeXML(targetText)}</target>
      </trans-unit>`
      
      const unitSize = new Blob([unit]).size
      if (currentSize + unitSize > availableSize) break
      
      translationUnits += unit
      currentSize += unitSize
      unitId++
    }
    
    return xliffHeader + translationUnits + xliffFooter
  }
  
  /**
   * Generate generic content based on pattern
   */
  private static generateGenericContent(targetSize: number, pattern: string): string {
    switch (pattern) {
      case 'repeating':
        return this.generateRepeatingContent(targetSize)
      case 'structured':
        return this.generateStructuredContent(targetSize)
      case 'random':
      default:
        return this.generateRandomContent(targetSize)
    }
  }
  
  /**
   * Generate random content with varied character distribution
   */
  private static generateRandomContent(targetSize: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 \n.,!?;:-'
    let content = ''
    
    // Generate in chunks to avoid memory issues with very large files
    const chunkSize = Math.min(1024 * 1024, targetSize) // 1MB chunks max
    const totalChunks = Math.ceil(targetSize / chunkSize)
    
    for (let chunk = 0; chunk < totalChunks; chunk++) {
      const currentChunkSize = chunk === totalChunks - 1 
        ? targetSize - (chunk * chunkSize) 
        : chunkSize
      
      let chunkContent = ''
      for (let i = 0; i < currentChunkSize; i++) {
        chunkContent += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      content += chunkContent
    }
    
    return content
  }
  
  /**
   * Generate repeating pattern content for compression testing
   */
  private static generateRepeatingContent(targetSize: number): string {
    const basePattern = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.\n'
    const patternSize = new Blob([basePattern]).size
    const repetitions = Math.ceil(targetSize / patternSize)
    
    let content = ''
    for (let i = 0; i < repetitions; i++) {
      content += basePattern
      if (new Blob([content]).size >= targetSize) break
    }
    
    return content.substring(0, targetSize)
  }
  
  /**
   * Generate structured content with varying sections
   */
  private static generateStructuredContent(targetSize: number): string {
    let content = ''
    let currentSize = 0
    let sectionNumber = 1
    
    while (currentSize < targetSize - 500) { // Leave buffer
      const sectionHeader = `\n=== SECTION ${sectionNumber} ===\n`
      const sectionContent = this.generateTextByPattern('random', 200 + Math.random() * 800)
      const section = sectionHeader + sectionContent + '\n'
      
      const sectionSize = new Blob([section]).size
      if (currentSize + sectionSize > targetSize) break
      
      content += section
      currentSize += sectionSize
      sectionNumber++
    }
    
    return content
  }
  
  /**
   * Generate text content by pattern with specified length
   */
  private static generateTextByPattern(pattern: string, length: number): string {
    switch (pattern) {
      case 'repeating':
        const baseText = 'This is a repeating pattern for testing purposes. '
        return baseText.repeat(Math.ceil(length / baseText.length)).substring(0, length)
      
      case 'structured':
        return `Section ${Math.floor(Math.random() * 1000)}: ` + 
               'A'.repeat(Math.max(0, length - 20))
      
      case 'random':
      default:
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,!?'
        let text = ''
        for (let i = 0; i < length; i++) {
          text += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        return text
    }
  }
  
  /**
   * Escape XML special characters
   */
  private static escapeXML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }
  
  /**
   * Pre-generate a set of test files for benchmarking
   */
  static generateTestSuite(configs: TestFileConfig[]): Map<string, File> {
    const files = new Map<string, File>()
    
    configs.forEach(config => {
      const file = this.generateFile(config)
      files.set(config.name, file)
    })
    
    return files
  }
  
  /**
   * Calculate the actual file size to ensure accuracy
   */
  static calculateActualSize(file: File): number {
    return file.size
  }
  
  /**
   * Validate file size matches expected configuration
   */
  static validateFileSize(file: File, expectedSizeMB: number, tolerancePercent: number = 1): boolean {
    const expectedBytes = expectedSizeMB * 1024 * 1024
    const actualBytes = file.size
    const tolerance = expectedBytes * (tolerancePercent / 100)
    
    return Math.abs(actualBytes - expectedBytes) <= tolerance
  }
} 