import { ChunkMetadata, ChunkReassemblyInfo } from './types'
import { downloadFile, uploadFile, deleteFile } from '../storage'
import { calculateChunkChecksum } from './utils'

export class ReassemblyService {
  
  /**
   * Reassemble chunks back into a complete file
   */
  async reassembleFile(
    reassemblyInfo: ChunkReassemblyInfo,
    bucket: string = 'qa-files',
    outputFolder: string = 'uploads'
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      console.log(`🔧 Starting reassembly for ${reassemblyInfo.fileName}`)
      console.log(`📊 Total chunks to reassemble: ${reassemblyInfo.totalChunks}`)

      // Validate that we have all chunks
      if (reassemblyInfo.uploadedChunks.length !== reassemblyInfo.totalChunks) {
        throw new Error(
          `Missing chunks: have ${reassemblyInfo.uploadedChunks.length}, need ${reassemblyInfo.totalChunks}`
        )
      }

      // Sort chunks by index to ensure correct order
      const sortedChunks = reassemblyInfo.uploadedChunks.sort((a, b) => a.chunkIndex - b.chunkIndex)

      // Validate chunk sequence
      this.validateChunkSequence(sortedChunks)

      // Download and validate all chunks
      const chunkBlobs = await this.downloadAndValidateChunks(sortedChunks, bucket)

      // Combine chunks into single file
      const combinedBlob = new Blob(chunkBlobs, { type: 'application/xliff+xml' })

      // Create final file
      const finalFile = new File([combinedBlob], reassemblyInfo.fileName, {
        type: 'application/xliff+xml'
      })

      // Upload reassembled file
      const uploadResult = await uploadFile(finalFile, bucket, outputFolder)

      if (uploadResult.error || !uploadResult.data) {
        throw uploadResult.error || new Error('Failed to upload reassembled file')
      }

      console.log(`✅ File reassembled successfully: ${uploadResult.data.path}`)

      // Clean up chunk files (optional - could be kept for recovery)
      await this.cleanupChunks(sortedChunks, bucket)

      return {
        success: true,
        filePath: uploadResult.data.path
      }

    } catch (error) {
      console.error(`❌ File reassembly failed for ${reassemblyInfo.fileName}:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown reassembly error'
      }
    }
  }

  /**
   * Validate chunk sequence integrity
   */
  private validateChunkSequence(chunks: ChunkMetadata[]): void {
    // Check for missing chunks
    for (let i = 0; i < chunks.length; i++) {
      if (chunks[i].chunkIndex !== i) {
        throw new Error(`Missing chunk at index ${i}`)
      }
    }

    // Validate byte boundaries
    let expectedStartByte = 0
    for (const chunk of chunks) {
      if (chunk.startByte !== expectedStartByte) {
        throw new Error(
          `Chunk boundary mismatch at index ${chunk.chunkIndex}: expected ${expectedStartByte}, got ${chunk.startByte}`
        )
      }
      expectedStartByte = chunk.endByte
    }

    console.log(`✅ Chunk sequence validated: ${chunks.length} chunks in correct order`)
  }

  /**
   * Download and validate all chunks
   */
  private async downloadAndValidateChunks(
    chunks: ChunkMetadata[],
    bucket: string
  ): Promise<Blob[]> {
    const chunkBlobs: Blob[] = []

    console.log(`📥 Downloading ${chunks.length} chunks...`)

    for (const chunk of chunks) {
      if (!chunk.uploadPath) {
        throw new Error(`Missing upload path for chunk ${chunk.chunkId}`)
      }

      // Download chunk
      const downloadResult = await downloadFile(chunk.uploadPath, bucket)
      
      if (downloadResult.error || !downloadResult.data) {
        throw downloadResult.error || new Error(`Failed to download chunk ${chunk.chunkId}`)
      }

      const chunkBlob = downloadResult.data

      // Validate chunk size
      if (chunkBlob.size !== chunk.actualSize) {
        throw new Error(
          `Chunk size mismatch for ${chunk.chunkId}: expected ${chunk.actualSize}, got ${chunkBlob.size}`
        )
      }

      // Validate checksum if available
      if (chunk.checksum) {
        const calculatedChecksum = await calculateChunkChecksum(chunkBlob)
        if (calculatedChecksum !== chunk.checksum) {
          throw new Error(
            `Chunk checksum mismatch for ${chunk.chunkId}: expected ${chunk.checksum}, got ${calculatedChecksum}`
          )
        }
      }

      chunkBlobs.push(chunkBlob)
      console.log(`✅ Chunk validated and downloaded: ${chunk.chunkId} (${chunkBlob.size} bytes)`)
    }

    return chunkBlobs
  }

  /**
   * Clean up chunk files after successful reassembly
   */
  private async cleanupChunks(chunks: ChunkMetadata[], bucket: string): Promise<void> {
    console.log(`🧹 Cleaning up ${chunks.length} chunk files...`)

    const cleanupPromises = chunks.map(async (chunk) => {
      if (chunk.uploadPath) {
        try {
          const result = await deleteFile(chunk.uploadPath, bucket)
          if (result.error) {
            console.warn(`⚠️ Failed to delete chunk ${chunk.chunkId}:`, result.error)
          } else {
            console.log(`🗑️ Deleted chunk: ${chunk.chunkId}`)
          }
        } catch (error) {
          console.warn(`⚠️ Error deleting chunk ${chunk.chunkId}:`, error)
        }
      }
    })

    await Promise.all(cleanupPromises)
    console.log(`✅ Chunk cleanup completed`)
  }

  /**
   * Verify file integrity after reassembly
   */
  async verifyReassembledFile(
    filePath: string,
    originalFileSize: number,
    bucket: string = 'qa-files'
  ): Promise<{ isValid: boolean; actualSize?: number; error?: string }> {
    try {
      const downloadResult = await downloadFile(filePath, bucket)
      
      if (downloadResult.error || !downloadResult.data) {
        return {
          isValid: false,
          error: downloadResult.error?.message || 'Failed to download reassembled file'
        }
      }

      const actualSize = downloadResult.data.size

      if (actualSize !== originalFileSize) {
        return {
          isValid: false,
          actualSize,
          error: `Size mismatch: expected ${originalFileSize}, got ${actualSize}`
        }
      }

      return {
        isValid: true,
        actualSize
      }

    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown verification error'
      }
    }
  }

  /**
   * Check if all chunks are available for reassembly
   */
  async checkChunkAvailability(
    chunks: ChunkMetadata[],
    bucket: string = 'qa-files'
  ): Promise<{ available: ChunkMetadata[]; missing: ChunkMetadata[] }> {
    const available: ChunkMetadata[] = []
    const missing: ChunkMetadata[] = []

    const checkPromises = chunks.map(async (chunk) => {
      if (!chunk.uploadPath) {
        missing.push(chunk)
        return
      }

      try {
        const downloadResult = await downloadFile(chunk.uploadPath, bucket)
        if (downloadResult.error || !downloadResult.data) {
          missing.push(chunk)
        } else {
          available.push(chunk)
        }
      } catch (error) {
        missing.push(chunk)
      }
    })

    await Promise.all(checkPromises)

    return { available, missing }
  }

  /**
   * Get total size of all chunks
   */
  getTotalChunkSize(chunks: ChunkMetadata[]): number {
    return chunks.reduce((total, chunk) => total + chunk.actualSize, 0)
  }

  /**
   * Resume incomplete reassembly
   */
  async resumeReassembly(
    reassemblyInfo: ChunkReassemblyInfo,
    bucket: string = 'qa-files'
  ): Promise<{ canResume: boolean; missingChunks: ChunkMetadata[] }> {
    const { available, missing } = await this.checkChunkAvailability(
      reassemblyInfo.uploadedChunks,
      bucket
    )

    const canResume = missing.length === 0

    console.log(`🔍 Reassembly resume check: ${available.length}/${reassemblyInfo.totalChunks} chunks available`)
    
    if (missing.length > 0) {
      console.log(`⚠️ Missing chunks for reassembly:`, missing.map(c => c.chunkId))
    }

    return {
      canResume,
      missingChunks: missing
    }
  }
} 