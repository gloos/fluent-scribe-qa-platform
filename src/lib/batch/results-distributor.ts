import {
  AggregatedResult,
  ResultsReport,
  DistributionChannel,
  ExportFormat,
  ResultsQuery,
  SUPPORTED_EXPORT_FORMATS
} from './types'
import { BatchResultsExporter, exportUtils } from './results-exporter'

/**
 * Distribution event interface
 */
export interface DistributionEvent {
  id: string
  channelId: string
  resultId: string
  status: 'pending' | 'processing' | 'delivered' | 'failed' | 'retrying'
  createdAt: number
  deliveredAt?: number
  attempts: number
  maxAttempts: number
  error?: string
  metadata: Record<string, any>
}

/**
 * Distribution configuration
 */
export interface DistributionConfig {
  enabled: boolean
  maxConcurrentDeliveries: number
  retryDelayMs: number
  maxRetryAttempts: number
  timeoutMs: number
  enableMetrics: boolean
  enableAuditLog: boolean
}

/**
 * Distribution metrics
 */
export interface DistributionMetrics {
  totalDeliveries: number
  successfulDeliveries: number
  failedDeliveries: number
  pendingDeliveries: number
  averageDeliveryTime: number
  successRate: number
  channelMetrics: Record<string, {
    deliveries: number
    successes: number
    failures: number
    avgDeliveryTime: number
  }>
}

/**
 * Distribution handler interface
 */
export interface DistributionHandler {
  type: string
  canHandle(channel: DistributionChannel): boolean
  deliver(
    result: AggregatedResult,
    channel: DistributionChannel,
    exportData?: Blob | string
  ): Promise<DistributionResult>
  validate(channel: DistributionChannel): { valid: boolean; errors: string[] }
}

/**
 * Distribution result
 */
export interface DistributionResult {
  success: boolean
  deliveredAt: number
  error?: string
  metadata?: Record<string, any>
}

/**
 * Email distribution handler
 */
export class EmailDistributionHandler implements DistributionHandler {
  type = 'email'

  canHandle(channel: DistributionChannel): boolean {
    return channel.type === 'email'
  }

  async deliver(
    result: AggregatedResult,
    channel: DistributionChannel,
    exportData?: Blob | string
  ): Promise<DistributionResult> {
    try {
      const config = channel.config
      if (!config.recipients || config.recipients.length === 0) {
        throw new Error('No email recipients configured')
      }

      // In a real implementation, this would integrate with an email service
      // For now, we'll simulate the email delivery
      const emailData = {
        to: config.recipients,
        subject: config.subject || `Batch Processing Results - ${result.batchId || result.id}`,
        body: this.generateEmailBody(result, channel),
        attachments: exportData ? [{
          filename: `results-${result.id}.json`,
          data: exportData
        }] : []
      }

      // Simulate email service call
      await this.simulateEmailDelivery(emailData)

      return {
        success: true,
        deliveredAt: Date.now(),
        metadata: {
          recipients: config.recipients.length,
          hasAttachments: !!exportData
        }
      }

    } catch (error) {
      return {
        success: false,
        deliveredAt: Date.now(),
        error: error instanceof Error ? error.message : 'Email delivery failed',
        metadata: { type: 'email' }
      }
    }
  }

  validate(channel: DistributionChannel): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    const config = channel.config

    if (!config.recipients || !Array.isArray(config.recipients)) {
      errors.push('Email recipients are required and must be an array')
    } else if (config.recipients.length === 0) {
      errors.push('At least one email recipient is required')
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      const invalidEmails = config.recipients.filter((email: string) => !emailRegex.test(email))
      if (invalidEmails.length > 0) {
        errors.push(`Invalid email addresses: ${invalidEmails.join(', ')}`)
      }
    }

    return { valid: errors.length === 0, errors }
  }

  private generateEmailBody(result: AggregatedResult, channel: DistributionChannel): string {
    const template = channel.config.template || this.getDefaultTemplate()
    
    return template
      .replace(/\{batchId\}/g, result.batchId || 'N/A')
      .replace(/\{totalJobs\}/g, result.summary.totalJobs.toString())
      .replace(/\{successfulJobs\}/g, result.summary.successfulJobs.toString())
      .replace(/\{failedJobs\}/g, result.summary.failedJobs.toString())
      .replace(/\{qualityScore\}/g, result.qualityMetrics.overallScore?.toFixed(1) || 'N/A')
      .replace(/\{errorRate\}/g, (result.errorAnalysis.errorRate * 100).toFixed(2))
      .replace(/\{completedAt\}/g, new Date(result.completedAt || result.createdAt).toLocaleString())
  }

  private getDefaultTemplate(): string {
    return `
Batch Processing Results

Batch ID: {batchId}
Completed: {completedAt}

Summary:
- Total Jobs: {totalJobs}
- Successful: {successfulJobs}
- Failed: {failedJobs}
- Quality Score: {qualityScore}
- Error Rate: {errorRate}%

This is an automated message from the batch processing system.
    `.trim()
  }

  private async simulateEmailDelivery(emailData: any): Promise<void> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000))
    
    // Simulate occasional failures
    if (Math.random() < 0.05) { // 5% failure rate
      throw new Error('Email service temporarily unavailable')
    }

    console.log(`📧 Email sent to ${emailData.to.length} recipients: ${emailData.subject}`)
  }
}

/**
 * Webhook distribution handler
 */
export class WebhookDistributionHandler implements DistributionHandler {
  type = 'webhook'

  canHandle(channel: DistributionChannel): boolean {
    return channel.type === 'webhook'
  }

  async deliver(
    result: AggregatedResult,
    channel: DistributionChannel,
    exportData?: Blob | string
  ): Promise<DistributionResult> {
    try {
      const config = channel.config
      if (!config.url) {
        throw new Error('Webhook URL is required')
      }

      const payload = {
        event: 'batch.results.aggregated',
        timestamp: Date.now(),
        data: result,
        metadata: {
          channelId: channel.id,
          hasExportData: !!exportData
        }
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'BatchProcessor/1.0',
        ...config.headers
      }

      // Add authentication headers
      if (config.authentication) {
        this.addAuthHeaders(headers, config.authentication)
      }

      const response = await fetch(config.url, {
        method: config.method || 'POST',
        headers,
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error(`Webhook failed with status ${response.status}: ${response.statusText}`)
      }

      return {
        success: true,
        deliveredAt: Date.now(),
        metadata: {
          status: response.status,
          statusText: response.statusText,
          url: config.url
        }
      }

    } catch (error) {
      return {
        success: false,
        deliveredAt: Date.now(),
        error: error instanceof Error ? error.message : 'Webhook delivery failed',
        metadata: { type: 'webhook', url: channel.config.url }
      }
    }
  }

  validate(channel: DistributionChannel): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    const config = channel.config

    if (!config.url) {
      errors.push('Webhook URL is required')
    } else {
      try {
        new URL(config.url)
      } catch {
        errors.push('Invalid webhook URL format')
      }
    }

    if (config.method && !['POST', 'PUT', 'PATCH'].includes(config.method)) {
      errors.push('Webhook method must be POST, PUT, or PATCH')
    }

    return { valid: errors.length === 0, errors }
  }

  private addAuthHeaders(headers: Record<string, string>, auth: any): void {
    switch (auth.type) {
      case 'bearer':
        headers['Authorization'] = `Bearer ${auth.credentials.token}`
        break
      case 'basic':
        const encoded = btoa(`${auth.credentials.username}:${auth.credentials.password}`)
        headers['Authorization'] = `Basic ${encoded}`
        break
      case 'apikey':
        if (auth.credentials.headerName) {
          headers[auth.credentials.headerName] = auth.credentials.apiKey
        } else {
          headers['X-API-Key'] = auth.credentials.apiKey
        }
        break
    }
  }
}

/**
 * API distribution handler
 */
export class APIDistributionHandler implements DistributionHandler {
  type = 'api'

  canHandle(channel: DistributionChannel): boolean {
    return channel.type === 'api'
  }

  async deliver(
    result: AggregatedResult,
    channel: DistributionChannel,
    exportData?: Blob | string
  ): Promise<DistributionResult> {
    try {
      const config = channel.config
      if (!config.endpoint) {
        throw new Error('API endpoint is required')
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey || ''
      }

      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          type: 'batch_results',
          payload: result,
          metadata: {
            channelId: channel.id,
            timestamp: Date.now()
          }
        })
      })

      if (!response.ok) {
        throw new Error(`API call failed with status ${response.status}`)
      }

      return {
        success: true,
        deliveredAt: Date.now(),
        metadata: {
          endpoint: config.endpoint,
          status: response.status
        }
      }

    } catch (error) {
      return {
        success: false,
        deliveredAt: Date.now(),
        error: error instanceof Error ? error.message : 'API delivery failed'
      }
    }
  }

  validate(channel: DistributionChannel): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    const config = channel.config

    if (!config.endpoint) {
      errors.push('API endpoint is required')
    } else {
      try {
        new URL(config.endpoint)
      } catch {
        errors.push('Invalid API endpoint URL')
      }
    }

    return { valid: errors.length === 0, errors }
  }
}

/**
 * Filesystem distribution handler
 */
export class FilesystemDistributionHandler implements DistributionHandler {
  type = 'filesystem'

  canHandle(channel: DistributionChannel): boolean {
    return channel.type === 'filesystem'
  }

  async deliver(
    result: AggregatedResult,
    channel: DistributionChannel,
    exportData?: Blob | string
  ): Promise<DistributionResult> {
    try {
      const config = channel.config
      if (!config.basePath) {
        throw new Error('Filesystem base path is required')
      }

      // Generate filename
      const timestamp = new Date(result.completedAt || result.createdAt)
      const filename = config.fileNaming
        ?.replace('{timestamp}', timestamp.toISOString().slice(0, 19).replace(/:/g, '-'))
        ?.replace('{batchId}', result.batchId || 'unknown')
        ?.replace('{id}', result.id) || `results-${result.id}.json`

      // In a real implementation, this would use Node.js fs module or browser File System Access API
      // For now, we'll simulate file writing
      const filePath = `${config.basePath}/${filename}`
      
      await this.simulateFileWrite(filePath, exportData || JSON.stringify(result, null, 2))

      return {
        success: true,
        deliveredAt: Date.now(),
        metadata: {
          filePath,
          filename,
          compressed: config.compression || false
        }
      }

    } catch (error) {
      return {
        success: false,
        deliveredAt: Date.now(),
        error: error instanceof Error ? error.message : 'Filesystem write failed'
      }
    }
  }

  validate(channel: DistributionChannel): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    const config = channel.config

    if (!config.basePath) {
      errors.push('Filesystem base path is required')
    }

    return { valid: errors.length === 0, errors }
  }

  private async simulateFileWrite(path: string, data: string | Blob): Promise<void> {
    // Simulate file I/O delay
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200))
    
    const size = typeof data === 'string' ? data.length : data.size
    console.log(`💾 File written: ${path} (${size} bytes)`)
  }
}

/**
 * Default distribution configuration
 */
export const DEFAULT_DISTRIBUTION_CONFIG: DistributionConfig = {
  enabled: true,
  maxConcurrentDeliveries: 5,
  retryDelayMs: 5000,
  maxRetryAttempts: 3,
  timeoutMs: 30000,
  enableMetrics: true,
  enableAuditLog: true
}

/**
 * Results distribution manager
 */
export class BatchResultsDistributor {
  private config: DistributionConfig
  private channels: Map<string, DistributionChannel> = new Map()
  private handlers: Map<string, DistributionHandler> = new Map()
  private events: DistributionEvent[] = []
  private exporter: BatchResultsExporter
  private metrics: DistributionMetrics
  private isProcessing = false
  private processingQueue: Array<{ result: AggregatedResult; channels: DistributionChannel[] }> = []

  constructor(
    config: DistributionConfig = DEFAULT_DISTRIBUTION_CONFIG,
    exporter?: BatchResultsExporter
  ) {
    this.config = { ...config }
    this.exporter = exporter || new BatchResultsExporter()
    this.metrics = this.initializeMetrics()
    
    this.initializeHandlers()
    this.startProcessing()
  }

  /**
   * Register a distribution channel
   */
  registerChannel(channel: DistributionChannel): void {
    // Validate channel configuration
    const handler = this.getHandler(channel.type)
    if (handler) {
      const validation = handler.validate(channel)
      if (!validation.valid) {
        throw new Error(`Invalid channel configuration: ${validation.errors.join(', ')}`)
      }
    }

    this.channels.set(channel.id, channel)
    console.log(`📡 Distribution channel registered: ${channel.name} (${channel.type})`)
  }

  /**
   * Unregister a distribution channel
   */
  unregisterChannel(channelId: string): boolean {
    const removed = this.channels.delete(channelId)
    if (removed) {
      console.log(`📡 Distribution channel unregistered: ${channelId}`)
    }
    return removed
  }

  /**
   * Get all registered channels
   */
  getChannels(): DistributionChannel[] {
    return Array.from(this.channels.values())
  }

  /**
   * Get channels by type
   */
  getChannelsByType(type: string): DistributionChannel[] {
    return Array.from(this.channels.values()).filter(channel => channel.type === type)
  }

  /**
   * Distribute results to appropriate channels
   */
  async distribute(result: AggregatedResult): Promise<void> {
    if (!this.config.enabled) {
      console.log('📡 Distribution is disabled')
      return
    }

    // Find matching channels
    const matchingChannels = this.findMatchingChannels(result)
    
    if (matchingChannels.length === 0) {
      console.log(`📡 No matching distribution channels for result: ${result.id}`)
      return
    }

    // Add to processing queue
    this.processingQueue.push({ result, channels: matchingChannels })
    console.log(`📡 Queued result ${result.id} for distribution to ${matchingChannels.length} channels`)
  }

  /**
   * Distribute results to specific channels
   */
  async distributeToChannels(result: AggregatedResult, channelIds: string[]): Promise<void> {
    const channels = channelIds
      .map(id => this.channels.get(id))
      .filter(Boolean) as DistributionChannel[]

    if (channels.length === 0) {
      throw new Error('No valid channels found for the provided IDs')
    }

    this.processingQueue.push({ result, channels })
  }

  /**
   * Get distribution metrics
   */
  getMetrics(): DistributionMetrics {
    return { ...this.metrics }
  }

  /**
   * Get distribution events (audit log)
   */
  getEvents(limit?: number): DistributionEvent[] {
    const sorted = [...this.events].sort((a, b) => b.createdAt - a.createdAt)
    return limit ? sorted.slice(0, limit) : sorted
  }

  /**
   * Configure the distributor
   */
  configure(config: Partial<DistributionConfig>): void {
    this.config = { ...this.config, ...config }
    console.log('⚙️ Distribution configuration updated')
  }

  /**
   * Get current configuration
   */
  getConfig(): DistributionConfig {
    return { ...this.config }
  }

  // ===== Private Methods =====

  /**
   * Initialize distribution handlers
   */
  private initializeHandlers(): void {
    this.handlers.set('email', new EmailDistributionHandler())
    this.handlers.set('webhook', new WebhookDistributionHandler())
    this.handlers.set('api', new APIDistributionHandler())
    this.handlers.set('filesystem', new FilesystemDistributionHandler())
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): DistributionMetrics {
    return {
      totalDeliveries: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      pendingDeliveries: 0,
      averageDeliveryTime: 0,
      successRate: 0,
      channelMetrics: {}
    }
  }

  /**
   * Start processing queue
   */
  private startProcessing(): void {
    if (this.isProcessing) return

    this.isProcessing = true
    this.processQueue()
  }

  /**
   * Process distribution queue
   */
  private async processQueue(): Promise<void> {
    while (this.isProcessing) {
      if (this.processingQueue.length === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        continue
      }

      const activeTasks = Math.min(
        this.config.maxConcurrentDeliveries,
        this.processingQueue.length
      )

      const tasks = []
      for (let i = 0; i < activeTasks; i++) {
        const item = this.processingQueue.shift()
        if (item) {
          tasks.push(this.processDistribution(item.result, item.channels))
        }
      }

      if (tasks.length > 0) {
        await Promise.allSettled(tasks)
      }
    }
  }

  /**
   * Process distribution for a single result
   */
  private async processDistribution(
    result: AggregatedResult,
    channels: DistributionChannel[]
  ): Promise<void> {
    for (const channel of channels) {
      await this.deliverToChannel(result, channel)
    }
  }

  /**
   * Deliver result to a specific channel
   */
  private async deliverToChannel(
    result: AggregatedResult,
    channel: DistributionChannel
  ): Promise<void> {
    const event: DistributionEvent = {
      id: this.generateEventId(),
      channelId: channel.id,
      resultId: result.id,
      status: 'pending',
      createdAt: Date.now(),
      attempts: 0,
      maxAttempts: this.config.maxRetryAttempts,
      metadata: { channelType: channel.type }
    }

    this.events.push(event)
    this.updateMetrics('pending', 1)

    const handler = this.getHandler(channel.type)
    if (!handler) {
      event.status = 'failed'
      event.error = `No handler available for channel type: ${channel.type}`
      this.updateMetrics('failed', 1)
      return
    }

    let exportData: Blob | string | undefined
    
    // Export data if channel requires it
    if (this.shouldExportData(channel)) {
      try {
        const exportResult = await this.exporter.export(result, {
          format: SUPPORTED_EXPORT_FORMATS.json,
          filename: `results-${result.id}.json`
        })
        
        if (exportResult.success && exportResult.data) {
          // Handle different data types from export
          if (exportResult.data instanceof ArrayBuffer) {
            exportData = new Blob([exportResult.data])
          } else {
            exportData = exportResult.data
          }
        }
      } catch (error) {
        console.warn(`Failed to export data for channel ${channel.id}:`, error)
      }
    }

    // Attempt delivery with retries
    let success = false
    while (event.attempts < event.maxAttempts && !success) {
      event.attempts++
      event.status = 'processing'

      try {
        const deliveryResult = await handler.deliver(result, channel, exportData)
        
        if (deliveryResult.success) {
          event.status = 'delivered'
          event.deliveredAt = deliveryResult.deliveredAt
          event.metadata = { ...event.metadata, ...deliveryResult.metadata }
          success = true
          this.updateMetrics('success', 1)
          this.updateChannelMetrics(channel.id, true, deliveryResult.deliveredAt - event.createdAt)
        } else {
          event.error = deliveryResult.error
          if (event.attempts < event.maxAttempts) {
            event.status = 'retrying'
            await this.delay(this.config.retryDelayMs * event.attempts)
          }
        }
      } catch (error) {
        event.error = error instanceof Error ? error.message : 'Unknown delivery error'
        if (event.attempts < event.maxAttempts) {
          event.status = 'retrying'
          await this.delay(this.config.retryDelayMs * event.attempts)
        }
      }
    }

    if (!success) {
      event.status = 'failed'
      this.updateMetrics('failed', 1)
      this.updateChannelMetrics(channel.id, false, 0)
      console.error(`❌ Failed to deliver result ${result.id} to channel ${channel.id} after ${event.attempts} attempts`)
    } else {
      console.log(`✅ Successfully delivered result ${result.id} to channel ${channel.id}`)
    }
  }

  /**
   * Find channels that match the result criteria
   */
  private findMatchingChannels(result: AggregatedResult): DistributionChannel[] {
    return Array.from(this.channels.values()).filter(channel => {
      if (!channel.enabled) return false

      const filters = channel.filters
      
      // Check quality thresholds
      if (filters.qualityThresholds) {
        if (filters.qualityThresholds.minScore && 
            result.qualityMetrics.overallScore &&
            result.qualityMetrics.overallScore < filters.qualityThresholds.minScore) {
          return false
        }
        
        if (filters.qualityThresholds.maxErrorRate &&
            result.errorAnalysis.errorRate > filters.qualityThresholds.maxErrorRate) {
          return false
        }
      }

      // Check batch filters
      if (filters.batchFilters) {
        if (filters.batchFilters.batchIds && 
            result.batchId &&
            !filters.batchFilters.batchIds.includes(result.batchId)) {
          return false
        }
        
        if (filters.batchFilters.projectIds &&
            result.projectId &&
            !filters.batchFilters.projectIds.includes(result.projectId)) {
          return false
        }
      }

      return true
    })
  }

  /**
   * Check if channel needs exported data
   */
  private shouldExportData(channel: DistributionChannel): boolean {
    return channel.type === 'email' || channel.type === 'filesystem'
  }

  /**
   * Get handler for channel type
   */
  private getHandler(type: string): DistributionHandler | undefined {
    return this.handlers.get(type)
  }

  /**
   * Update metrics
   */
  private updateMetrics(type: 'pending' | 'success' | 'failed', count: number): void {
    switch (type) {
      case 'pending':
        this.metrics.pendingDeliveries += count
        break
      case 'success':
        this.metrics.successfulDeliveries += count
        this.metrics.pendingDeliveries = Math.max(0, this.metrics.pendingDeliveries - count)
        break
      case 'failed':
        this.metrics.failedDeliveries += count
        this.metrics.pendingDeliveries = Math.max(0, this.metrics.pendingDeliveries - count)
        break
    }

    this.metrics.totalDeliveries = this.metrics.successfulDeliveries + this.metrics.failedDeliveries
    this.metrics.successRate = this.metrics.totalDeliveries > 0 
      ? this.metrics.successfulDeliveries / this.metrics.totalDeliveries 
      : 0
  }

  /**
   * Update channel-specific metrics
   */
  private updateChannelMetrics(channelId: string, success: boolean, deliveryTime: number): void {
    if (!this.metrics.channelMetrics[channelId]) {
      this.metrics.channelMetrics[channelId] = {
        deliveries: 0,
        successes: 0,
        failures: 0,
        avgDeliveryTime: 0
      }
    }

    const channelMetrics = this.metrics.channelMetrics[channelId]
    channelMetrics.deliveries++
    
    if (success) {
      channelMetrics.successes++
      // Update average delivery time
      channelMetrics.avgDeliveryTime = (
        (channelMetrics.avgDeliveryTime * (channelMetrics.successes - 1) + deliveryTime) /
        channelMetrics.successes
      )
    } else {
      channelMetrics.failures++
    }
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `dist_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Create singleton instance
export const resultsDistributor = new BatchResultsDistributor()

// Default export
export default BatchResultsDistributor 