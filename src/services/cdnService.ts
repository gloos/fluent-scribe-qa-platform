import { EventEmitter } from 'events';
import express from 'express';
import path from 'path';
import fs from 'fs';

export interface CDNConfig {
  enabledProviders: CDNProvider[];
  staticAssetsPath: string;
  cacheControl: {
    staticAssets: string;
    dynamicContent: string;
    images: string;
    documents: string;
  };
  compression: {
    enabled: boolean;
    threshold: number; // bytes
    algorithms: string[];
  };
  monitoring: {
    enabled: boolean;
    metricsInterval: number; // seconds
  };
  geoOptimization: {
    enabled: boolean;
    regions: string[];
  };
}

export interface CDNProvider {
  name: string;
  enabled: boolean;
  endpoint?: string;
  apiKey?: string;
  distribution?: string;
  config?: Record<string, any>;
}

export interface CDNMetrics {
  hitRatio: number;
  avgResponseTime: number;
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  bytesServed: number;
  errorRate: number;
  geoDistribution: Record<string, number>;
  timestamp: number;
}

export interface CDNAlert {
  id: string;
  type: 'performance' | 'availability' | 'cache' | 'error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

class CDNService extends EventEmitter {
  private config: CDNConfig;
  private metrics: CDNMetrics;
  private alerts: CDNAlert[] = [];
  private isRunning = false;
  private metricsInterval?: NodeJS.Timeout;
  private requestCounters = new Map<string, number>();
  private responseTimeHistory: number[] = [];
  private lastCacheInvalidation = 0;

  constructor(config?: Partial<CDNConfig>) {
    super();
    
    this.config = {
      enabledProviders: [
        {
          name: 'cloudflare',
          enabled: false
        },
        {
          name: 'fastly',
          enabled: false
        },
        {
          name: 'local',
          enabled: true
        }
      ],
      staticAssetsPath: path.join(process.cwd(), 'dist'),
      cacheControl: {
        staticAssets: 'public, max-age=31536000, immutable', // 1 year for hashed assets
        dynamicContent: 'public, max-age=300', // 5 minutes for dynamic content
        images: 'public, max-age=86400', // 1 day for images
        documents: 'public, max-age=3600' // 1 hour for documents
      },
      compression: {
        enabled: true,
        threshold: 1024, // 1KB threshold
        algorithms: ['gzip', 'br']
      },
      monitoring: {
        enabled: true,
        metricsInterval: 60 // 1 minute
      },
      geoOptimization: {
        enabled: true,
        regions: ['us-east', 'us-west', 'eu-west', 'ap-southeast']
      },
      ...config
    };

    this.metrics = this.initializeMetrics();
  }

  private initializeMetrics(): CDNMetrics {
    return {
      hitRatio: 0,
      avgResponseTime: 0,
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      bytesServed: 0,
      errorRate: 0,
      geoDistribution: {},
      timestamp: Date.now()
    };
  }

  public initialize(): void {
    if (this.isRunning) {
      console.warn('CDN Service is already running');
      return;
    }

    console.log('Initializing CDN Service...');
    
    // Validate static assets path
    if (!fs.existsSync(this.config.staticAssetsPath)) {
      console.warn(`Static assets path does not exist: ${this.config.staticAssetsPath}`);
    }

    // Start metrics collection
    if (this.config.monitoring.enabled) {
      this.startMetricsCollection();
    }

    // Initialize enabled CDN providers
    this.initializeProviders();

    this.isRunning = true;
    this.emit('initialized');
    console.log('CDN Service initialized successfully');
  }

  private initializeProviders(): void {
    this.config.enabledProviders.forEach(provider => {
      if (provider.enabled) {
        console.log(`Initializing CDN provider: ${provider.name}`);
        // Provider-specific initialization would go here
        this.emit('providerInitialized', provider);
      }
    });
  }

  public createStaticMiddleware(): express.RequestHandler {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const startTime = Date.now();
      const cdnService = this;
      
      // Track request
      this.trackRequest(req);

      // Set CDN headers based on content type
      this.setCDNHeaders(req, res);

      // Hook into response finish event for tracking
      res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        const contentLength = res.get('Content-Length');
        const bytes = contentLength ? parseInt(contentLength, 10) : 0;
        cdnService.trackResponse(req, res, responseTime, bytes);
      });

      // Serve static files with proper caching
      if (this.isStaticAsset(req.path)) {
        this.serveStaticAsset(req, res, next);
        return;
      }

      next();
    };
  }

  private trackRequest(req: express.Request): void {
    const path = req.path;
    const currentCount = this.requestCounters.get(path) || 0;
    this.requestCounters.set(path, currentCount + 1);
    
    this.metrics.totalRequests++;
    
    // Track geographic distribution if available
    const country = req.get('CF-IPCountry') || req.get('X-Country') || 'unknown';
    this.metrics.geoDistribution[country] = (this.metrics.geoDistribution[country] || 0) + 1;
  }

  private trackResponse(req: express.Request, res: express.Response, responseTime: number, bytes: number): void {
    // Track response time
    this.responseTimeHistory.push(responseTime);
    if (this.responseTimeHistory.length > 1000) {
      this.responseTimeHistory = this.responseTimeHistory.slice(-500);
    }

    // Track bytes served
    this.metrics.bytesServed += bytes;

    // Track cache hits/misses
    const cacheStatus = res.get('X-Cache-Status');
    if (cacheStatus === 'HIT') {
      this.metrics.cacheHits++;
    } else {
      this.metrics.cacheMisses++;
    }

    // Track errors
    if (res.statusCode >= 400) {
      this.metrics.errorRate = (this.metrics.errorRate * (this.metrics.totalRequests - 1) + 1) / this.metrics.totalRequests;
    }

    // Update average response time
    this.metrics.avgResponseTime = this.responseTimeHistory.reduce((a, b) => a + b, 0) / this.responseTimeHistory.length;
    
    // Update hit ratio
    this.metrics.hitRatio = this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0;

    // Check for performance alerts
    this.checkPerformanceThresholds(responseTime, res.statusCode);
  }

  private setCDNHeaders(req: express.Request, res: express.Response): void {
    const ext = path.extname(req.path).toLowerCase();
    
    // Set appropriate cache control headers
    if (this.isStaticAsset(req.path)) {
      if (this.isHashedAsset(req.path)) {
        res.set('Cache-Control', this.config.cacheControl.staticAssets);
        res.set('X-Cache-Status', 'STATIC');
      } else if (this.isImageAsset(ext)) {
        res.set('Cache-Control', this.config.cacheControl.images);
        res.set('X-Cache-Status', 'IMAGE');
      } else if (this.isDocumentAsset(ext)) {
        res.set('Cache-Control', this.config.cacheControl.documents);
        res.set('X-Cache-Status', 'DOCUMENT');
      }
    } else {
      res.set('Cache-Control', this.config.cacheControl.dynamicContent);
      res.set('X-Cache-Status', 'DYNAMIC');
    }

    // Set CDN-specific headers
    res.set('X-CDN-Provider', this.getActiveProvider());
    res.set('X-CDN-Region', this.getOptimalRegion(req));
    res.set('Vary', 'Accept-Encoding, User-Agent');
  }

  private isStaticAsset(path: string): boolean {
    const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot'];
    const ext = path.split('.').pop()?.toLowerCase();
    return staticExtensions.includes(`.${ext}`);
  }

  private isHashedAsset(path: string): boolean {
    // Check if the file has content hash (Vite pattern: filename-hash.ext)
    return /\-[a-zA-Z0-9]{8,}\.(js|css)$/.test(path);
  }

  private isImageAsset(ext: string): boolean {
    return ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp'].includes(ext);
  }

  private isDocumentAsset(ext: string): boolean {
    return ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.xliff', '.xlf', '.tmx'].includes(ext);
  }

  private serveStaticAsset(req: express.Request, res: express.Response, next: express.NextFunction): void {
    const filePath = path.join(this.config.staticAssetsPath, req.path);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      next();
      return;
    }

    // Get file stats for ETag and Last-Modified
    const stats = fs.statSync(filePath);
    const etag = `"${stats.size}-${stats.mtime.getTime()}"`;
    const lastModified = stats.mtime.toUTCString();

    // Set cache headers
    res.set('ETag', etag);
    res.set('Last-Modified', lastModified);

    // Check if client has cached version
    const clientETag = req.get('If-None-Match');
    const clientLastModified = req.get('If-Modified-Since');

    if (clientETag === etag || clientLastModified === lastModified) {
      res.set('X-Cache-Status', 'HIT');
      res.status(304).end();
      return;
    }

    res.set('X-Cache-Status', 'MISS');
    
    // Set content type
    const ext = path.extname(filePath).toLowerCase();
    const contentType = this.getContentType(ext);
    if (contentType) {
      res.set('Content-Type', contentType);
    }

    // Serve the file
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error('Error serving static file:', err);
        next();
      }
    });
  }

  private getContentType(ext: string): string | null {
    const types: Record<string, string> = {
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.eot': 'application/vnd.ms-fontobject'
    };
    return types[ext] || null;
  }

  private getActiveProvider(): string {
    const activeProvider = this.config.enabledProviders.find(p => p.enabled);
    return activeProvider?.name || 'local';
  }

  private getOptimalRegion(req: express.Request): string {
    // Simple geographic optimization based on headers
    const country = req.get('CF-IPCountry') || req.get('X-Country');
    
    if (!country || !this.config.geoOptimization.enabled) {
      return 'auto';
    }

    // Map countries to regions
    const regionMap: Record<string, string> = {
      'US': 'us-east',
      'CA': 'us-east',
      'GB': 'eu-west',
      'DE': 'eu-west',
      'FR': 'eu-west',
      'JP': 'ap-southeast',
      'SG': 'ap-southeast',
      'AU': 'ap-southeast'
    };

    return regionMap[country] || 'us-east';
  }

  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      this.updateMetrics();
      this.emit('metricsUpdated', this.metrics);
    }, this.config.monitoring.metricsInterval * 1000);
  }

  private updateMetrics(): void {
    this.metrics.timestamp = Date.now();
    
    // Clean up old data
    this.cleanupMetrics();
  }

  private cleanupMetrics(): void {
    // Keep only recent data to prevent memory leaks
    if (this.responseTimeHistory.length > 1000) {
      this.responseTimeHistory = this.responseTimeHistory.slice(-500);
    }

    // Clear old request counters (older than 1 hour)
    const oneHourAgo = Date.now() - 3600000;
    if (this.lastCacheInvalidation < oneHourAgo) {
      this.requestCounters.clear();
      this.lastCacheInvalidation = Date.now();
    }
  }

  private checkPerformanceThresholds(responseTime: number, statusCode: number): void {
    const alerts: CDNAlert[] = [];

    // High response time alert
    if (responseTime > 2000) {
      alerts.push({
        id: `perf-${Date.now()}`,
        type: 'performance',
        severity: responseTime > 5000 ? 'critical' : 'high',
        message: `High response time detected: ${responseTime}ms`,
        timestamp: Date.now(),
        metadata: { responseTime, threshold: 2000 }
      });
    }

    // Low cache hit ratio alert
    if (this.metrics.hitRatio < 0.7 && this.metrics.totalRequests > 100) {
      alerts.push({
        id: `cache-${Date.now()}`,
        type: 'cache',
        severity: 'medium',
        message: `Low cache hit ratio: ${(this.metrics.hitRatio * 100).toFixed(1)}%`,
        timestamp: Date.now(),
        metadata: { hitRatio: this.metrics.hitRatio, threshold: 0.7 }
      });
    }

    // Error rate alert
    if (this.metrics.errorRate > 0.05) {
      alerts.push({
        id: `error-${Date.now()}`,
        type: 'error',
        severity: this.metrics.errorRate > 0.1 ? 'critical' : 'high',
        message: `High error rate: ${(this.metrics.errorRate * 100).toFixed(1)}%`,
        timestamp: Date.now(),
        metadata: { errorRate: this.metrics.errorRate, threshold: 0.05 }
      });
    }

    // Emit alerts
    alerts.forEach(alert => {
      this.alerts.push(alert);
      this.emit('alert', alert);
    });

    // Keep only recent alerts (last 24 hours)
    const oneDayAgo = Date.now() - 86400000;
    this.alerts = this.alerts.filter(alert => alert.timestamp > oneDayAgo);
  }

  public invalidateCache(pattern?: string): void {
    console.log(`Invalidating cache${pattern ? ` for pattern: ${pattern}` : ''}`);
    
    // Reset metrics for affected content
    if (!pattern) {
      this.requestCounters.clear();
      this.metrics.cacheHits = 0;
      this.metrics.cacheMisses = 0;
    }

    this.emit('cacheInvalidated', { pattern, timestamp: Date.now() });
  }

  public getMetrics(): CDNMetrics {
    return { ...this.metrics };
  }

  public getAlerts(): CDNAlert[] {
    return [...this.alerts];
  }

  public getConfiguration(): CDNConfig {
    return { ...this.config };
  }

  public updateConfiguration(config: Partial<CDNConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('configurationUpdated', this.config);
    console.log('CDN configuration updated');
  }

  public stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log('Stopping CDN Service...');
    
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
    }

    this.isRunning = false;
    this.emit('stopped');
    console.log('CDN Service stopped');
  }

  public isServiceRunning(): boolean {
    return this.isRunning;
  }
}

// Export singleton instance
export const cdnService = new CDNService();
export default CDNService; 