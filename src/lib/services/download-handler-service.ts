/**
 * Download Handler Service
 * 
 * Manages secure file generation, temporary storage, download links with expiration,
 * file compression for large exports, and download status tracking.
 */

export interface DownloadRequest {
  id: string;
  filename: string;
  blob: Blob;
  options?: DownloadOptions;
}

export interface DownloadOptions {
  // Security
  expirationTime?: number; // in milliseconds
  maxDownloads?: number;
  requireAuth?: boolean;
  
  // Compression
  compress?: boolean;
  compressionLevel?: number;
  
  // Tracking
  trackDownloads?: boolean;
  onDownloadStart?: (downloadId: string) => void;
  onDownloadComplete?: (downloadId: string, success: boolean) => void;
  onDownloadProgress?: (downloadId: string, progress: number) => void;
  
  // Browser behavior
  forceDownload?: boolean;
  openInNewTab?: boolean;
}

export interface SecureDownloadLink {
  id: string;
  url: string;
  filename: string;
  size: number;
  mimeType: string;
  expiresAt: Date;
  downloadCount: number;
  maxDownloads: number;
  isExpired: boolean;
  metadata: DownloadMetadata;
}

export interface DownloadMetadata {
  createdAt: Date;
  createdBy?: string;
  originalFilename: string;
  compressed: boolean;
  compressionRatio?: number;
  checksum?: string;
  tags?: string[];
}

export interface DownloadStatus {
  id: string;
  status: DownloadStatusType;
  progress: number;
  filename: string;
  size: number;
  downloadedBytes: number;
  startTime?: Date;
  endTime?: Date;
  error?: string;
  estimatedTimeRemaining?: number;
  downloadSpeed?: number; // bytes per second
}

export enum DownloadStatusType {
  PENDING = 'pending',
  STARTING = 'starting',
  DOWNLOADING = 'downloading',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired'
}

export interface DownloadAnalytics {
  totalDownloads: number;
  totalSize: number;
  averageDownloadTime: number;
  popularFormats: { format: string; count: number }[];
  downloadsByDate: { date: string; count: number }[];
  failureRate: number;
}

export class DownloadHandlerService {
  private static instance: DownloadHandlerService;
  private downloadLinks: Map<string, SecureDownloadLink> = new Map();
  private downloadStatuses: Map<string, DownloadStatus> = new Map();
  private downloadHistory: DownloadStatus[] = [];
  private cleanupInterval: NodeJS.Timeout | null = null;

  // Configuration
  private readonly DEFAULT_EXPIRATION = 30 * 60 * 1000; // 30 minutes
  private readonly MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.startCleanupService();
  }

  public static getInstance(): DownloadHandlerService {
    if (!DownloadHandlerService.instance) {
      DownloadHandlerService.instance = new DownloadHandlerService();
    }
    return DownloadHandlerService.instance;
  }

  /**
   * Create a secure download link for a file
   */
  public async createSecureDownload(request: DownloadRequest): Promise<SecureDownloadLink> {
    const { id, filename, blob, options = {} } = request;

    // Validate file size
    if (blob.size > this.MAX_FILE_SIZE) {
      throw new Error(`File size exceeds maximum allowed size of ${this.MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    // Process the blob (compression, etc.)
    const processedBlob = await this.processBlob(blob, options);
    
    // Create object URL
    const url = URL.createObjectURL(processedBlob);

    // Calculate expiration time
    const expirationTime = options.expirationTime || this.DEFAULT_EXPIRATION;
    const expiresAt = new Date(Date.now() + expirationTime);

    // Create download metadata
    const metadata: DownloadMetadata = {
      createdAt: new Date(),
      originalFilename: filename,
      compressed: options.compress || false,
      compressionRatio: options.compress ? blob.size / processedBlob.size : undefined,
      checksum: await this.calculateChecksum(processedBlob),
      tags: []
    };

    // Create secure download link
    const secureLink: SecureDownloadLink = {
      id,
      url,
      filename,
      size: processedBlob.size,
      mimeType: processedBlob.type || 'application/octet-stream',
      expiresAt,
      downloadCount: 0,
      maxDownloads: options.maxDownloads || Infinity,
      isExpired: false,
      metadata
    };

    // Store the link
    this.downloadLinks.set(id, secureLink);

    // Initialize download status
    this.downloadStatuses.set(id, {
      id,
      status: DownloadStatusType.PENDING,
      progress: 0,
      filename,
      size: processedBlob.size,
      downloadedBytes: 0
    });

    return secureLink;
  }

  /**
   * Initiate a download
   */
  public async download(downloadId: string, options: DownloadOptions = {}): Promise<void> {
    const link = this.downloadLinks.get(downloadId);
    if (!link) {
      throw new Error('Download link not found');
    }

    // Check if link is expired
    if (link.isExpired || new Date() > link.expiresAt) {
      link.isExpired = true;
      this.updateDownloadStatus(downloadId, { status: DownloadStatusType.EXPIRED });
      throw new Error('Download link has expired');
    }

    // Check download count
    if (link.downloadCount >= link.maxDownloads) {
      throw new Error('Maximum download count exceeded');
    }

    try {
      // Update status
      this.updateDownloadStatus(downloadId, {
        status: DownloadStatusType.STARTING,
        startTime: new Date()
      });

      // Call download start callback
      if (options.onDownloadStart) {
        options.onDownloadStart(downloadId);
      }

      // Perform the download
      await this.performDownload(link, options);

      // Update counters
      link.downloadCount++;

      // Update status
      this.updateDownloadStatus(downloadId, {
        status: DownloadStatusType.COMPLETED,
        progress: 100,
        downloadedBytes: link.size,
        endTime: new Date()
      });

      // Call completion callback
      if (options.onDownloadComplete) {
        options.onDownloadComplete(downloadId, true);
      }

      // Add to history
      this.addToHistory(downloadId);

    } catch (error) {
      // Update status
      this.updateDownloadStatus(downloadId, {
        status: DownloadStatusType.FAILED,
        error: error instanceof Error ? error.message : 'Unknown error',
        endTime: new Date()
      });

      // Call completion callback
      if (options.onDownloadComplete) {
        options.onDownloadComplete(downloadId, false);
      }

      throw error;
    }
  }

  /**
   * Perform the actual download
   */
  private async performDownload(link: SecureDownloadLink, options: DownloadOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Update status to downloading
        this.updateDownloadStatus(link.id, {
          status: DownloadStatusType.DOWNLOADING,
          progress: 50
        });

        // Create download element
        const a = document.createElement('a');
        a.href = link.url;
        a.download = link.filename;

        // Handle different download behaviors
        if (options.openInNewTab) {
          a.target = '_blank';
        }

        if (options.forceDownload) {
          a.setAttribute('download', link.filename);
        }

        // Track download progress (simulated for blob URLs)
        const startTime = Date.now();
        const simulateProgress = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(95, (elapsed / 1000) * 20); // Simulate progress
          
          this.updateDownloadStatus(link.id, {
            progress,
            downloadedBytes: Math.floor((progress / 100) * link.size),
            downloadSpeed: link.size / (elapsed / 1000)
          });

          if (options.onDownloadProgress) {
            options.onDownloadProgress(link.id, progress);
          }

          if (progress < 95) {
            setTimeout(simulateProgress, 100);
          }
        };

        // Start progress simulation
        setTimeout(simulateProgress, 100);

        // Append to body and click
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Complete after a short delay (simulate download completion)
        setTimeout(() => {
          resolve();
        }, 2000);

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Process blob (compression, etc.)
   */
  private async processBlob(blob: Blob, options: DownloadOptions): Promise<Blob> {
    if (!options.compress) {
      return blob;
    }

    try {
      // For compression, we could use pako or other compression libraries
      // For now, just return the original blob
      // TODO: Implement actual compression when needed
      return blob;
    } catch (error) {
      console.warn('Blob compression failed, returning original:', error);
      return blob;
    }
  }

  /**
   * Calculate file checksum
   */
  private async calculateChecksum(blob: Blob): Promise<string> {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.warn('Checksum calculation failed:', error);
      return '';
    }
  }

  /**
   * Update download status
   */
  private updateDownloadStatus(id: string, updates: Partial<DownloadStatus>): void {
    const current = this.downloadStatuses.get(id);
    if (current) {
      const updated = { ...current, ...updates };
      
      // Calculate estimated time remaining
      if (updated.progress > 0 && updated.progress < 100 && updated.startTime) {
        const elapsed = Date.now() - updated.startTime.getTime();
        const estimatedTotal = (elapsed / updated.progress) * 100;
        updated.estimatedTimeRemaining = estimatedTotal - elapsed;
      }

      this.downloadStatuses.set(id, updated);
    }
  }

  /**
   * Get download status
   */
  public getDownloadStatus(id: string): DownloadStatus | undefined {
    return this.downloadStatuses.get(id);
  }

  /**
   * Get all download statuses
   */
  public getAllDownloadStatuses(): DownloadStatus[] {
    return Array.from(this.downloadStatuses.values());
  }

  /**
   * Cancel a download
   */
  public cancelDownload(id: string): boolean {
    const status = this.downloadStatuses.get(id);
    if (status && status.status === DownloadStatusType.DOWNLOADING) {
      this.updateDownloadStatus(id, {
        status: DownloadStatusType.CANCELLED,
        endTime: new Date()
      });
      return true;
    }
    return false;
  }

  /**
   * Revoke a download link
   */
  public revokeDownloadLink(id: string): boolean {
    const link = this.downloadLinks.get(id);
    if (link) {
      URL.revokeObjectURL(link.url);
      this.downloadLinks.delete(id);
      this.downloadStatuses.delete(id);
      return true;
    }
    return false;
  }

  /**
   * Get download link information
   */
  public getDownloadLink(id: string): SecureDownloadLink | undefined {
    return this.downloadLinks.get(id);
  }

  /**
   * Get all active download links
   */
  public getActiveDownloadLinks(): SecureDownloadLink[] {
    return Array.from(this.downloadLinks.values()).filter(link => !link.isExpired);
  }

  /**
   * Add to download history
   */
  private addToHistory(id: string): void {
    const status = this.downloadStatuses.get(id);
    if (status) {
      this.downloadHistory.push({ ...status });
      
      // Keep only last 1000 downloads in history
      if (this.downloadHistory.length > 1000) {
        this.downloadHistory = this.downloadHistory.slice(-1000);
      }
    }
  }

  /**
   * Get download history
   */
  public getDownloadHistory(limit = 100): DownloadStatus[] {
    return this.downloadHistory.slice(-limit);
  }

  /**
   * Get download analytics
   */
  public getDownloadAnalytics(): DownloadAnalytics {
    const completedDownloads = this.downloadHistory.filter(d => d.status === DownloadStatusType.COMPLETED);
    const failedDownloads = this.downloadHistory.filter(d => d.status === DownloadStatusType.FAILED);

    // Calculate average download time
    const downloadTimes = completedDownloads
      .filter(d => d.startTime && d.endTime)
      .map(d => d.endTime!.getTime() - d.startTime!.getTime());
    
    const averageDownloadTime = downloadTimes.length > 0 
      ? downloadTimes.reduce((sum, time) => sum + time, 0) / downloadTimes.length
      : 0;

    // Calculate total size
    const totalSize = completedDownloads.reduce((sum, d) => sum + d.size, 0);

    // Group downloads by date
    const downloadsByDate = this.groupDownloadsByDate(completedDownloads);

    // Get popular formats
    const formatCounts: Record<string, number> = {};
    completedDownloads.forEach(download => {
      const extension = download.filename.split('.').pop()?.toLowerCase() || 'unknown';
      formatCounts[extension] = (formatCounts[extension] || 0) + 1;
    });

    const popularFormats = Object.entries(formatCounts)
      .map(([format, count]) => ({ format, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalDownloads: completedDownloads.length,
      totalSize,
      averageDownloadTime,
      popularFormats,
      downloadsByDate,
      failureRate: this.downloadHistory.length > 0 
        ? (failedDownloads.length / this.downloadHistory.length) * 100 
        : 0
    };
  }

  /**
   * Group downloads by date
   */
  private groupDownloadsByDate(downloads: DownloadStatus[]): { date: string; count: number }[] {
    const dateGroups: Record<string, number> = {};
    
    downloads.forEach(download => {
      if (download.startTime) {
        const dateKey = download.startTime.toISOString().split('T')[0];
        dateGroups[dateKey] = (dateGroups[dateKey] || 0) + 1;
      }
    });

    return Object.entries(dateGroups)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Start cleanup service
   */
  private startCleanupService(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredLinks();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Clean up expired links
   */
  private cleanupExpiredLinks(): void {
    const now = new Date();
    const expiredLinks: string[] = [];

    this.downloadLinks.forEach((link, id) => {
      if (now > link.expiresAt) {
        link.isExpired = true;
        URL.revokeObjectURL(link.url);
        expiredLinks.push(id);
      }
    });

    // Remove expired links
    expiredLinks.forEach(id => {
      this.downloadLinks.delete(id);
      
      // Update status if still pending
      const status = this.downloadStatuses.get(id);
      if (status && status.status === DownloadStatusType.PENDING) {
        this.updateDownloadStatus(id, { status: DownloadStatusType.EXPIRED });
      }
    });

    if (expiredLinks.length > 0) {
      console.log(`Cleaned up ${expiredLinks.length} expired download links`);
    }
  }

  /**
   * Stop cleanup service
   */
  public stopCleanupService(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clean up all resources
   */
  public cleanup(): void {
    // Revoke all object URLs
    this.downloadLinks.forEach(link => {
      URL.revokeObjectURL(link.url);
    });

    // Clear all data
    this.downloadLinks.clear();
    this.downloadStatuses.clear();

    // Stop cleanup service
    this.stopCleanupService();
  }

  /**
   * Get storage usage
   */
  public getStorageUsage(): { linkCount: number; totalSize: number; oldestLink?: Date } {
    let totalSize = 0;
    let oldestLink: Date | undefined;

    this.downloadLinks.forEach(link => {
      totalSize += link.size;
      if (!oldestLink || link.metadata.createdAt < oldestLink) {
        oldestLink = link.metadata.createdAt;
      }
    });

    return {
      linkCount: this.downloadLinks.size,
      totalSize,
      oldestLink
    };
  }

  /**
   * Bulk create downloads from multiple files
   */
  public async createBulkDownloads(
    files: { id: string; filename: string; blob: Blob }[],
    options: DownloadOptions = {}
  ): Promise<SecureDownloadLink[]> {
    const results: SecureDownloadLink[] = [];

    for (const file of files) {
      try {
        const link = await this.createSecureDownload({
          id: file.id,
          filename: file.filename,
          blob: file.blob,
          options
        });
        results.push(link);
      } catch (error) {
        console.error(`Failed to create download for ${file.filename}:`, error);
      }
    }

    return results;
  }

  /**
   * Create a download with retry mechanism
   */
  public async createDownloadWithRetry(
    request: DownloadRequest,
    maxRetries = 3,
    baseDelay = 1000
  ): Promise<SecureDownloadLink> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.createSecureDownload(request);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Failed to create download after retries');
  }
}

export default DownloadHandlerService; 