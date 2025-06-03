import { Request, Response, NextFunction } from 'express';

/**
 * Rate limit information for tracking and response headers
 */
export interface RateLimitInfo {
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

/**
 * Configuration for different rate limiting strategies
 */
export interface RateLimitConfig {
  windowMs: number;        // Time window in milliseconds
  maxRequests: number;     // Max requests per window
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  onLimitReached?: (req: Request, res: Response) => void;
  message?: string;
}

/**
 * In-memory rate limit store for tracking requests
 */
class MemoryRateLimitStore {
  private store: Map<string, { count: number; resetTime: number }> = new Map();

  /**
   * Increment request count for a key
   */
  increment(key: string, windowMs: number): RateLimitInfo {
    const now = Date.now();
    const resetTime = now + windowMs;
    
    const existing = this.store.get(key);
    
    if (!existing || existing.resetTime < now) {
      // Create new or reset expired entry
      this.store.set(key, { count: 1, resetTime });
      return {
        remaining: 0, // Will be calculated by caller
        resetTime
      };
    }
    
    // Increment existing entry
    existing.count++;
    this.store.set(key, existing);
    
    return {
      remaining: 0, // Will be calculated by caller
      resetTime: existing.resetTime
    };
  }

  /**
   * Get current count for a key
   */
  getCount(key: string): number {
    const now = Date.now();
    const existing = this.store.get(key);
    
    if (!existing || existing.resetTime < now) {
      return 0;
    }
    
    return existing.count;
  }

  /**
   * Clean up expired entries (garbage collection)
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.store.entries()) {
      if (value.resetTime < now) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Clear all stored rate limit data (for testing)
   */
  clear(): void {
    this.store.clear();
  }
}

/**
 * Global rate limiting middleware for IP-based protection
 */
export class RateLimitMiddleware {
  private static store = new MemoryRateLimitStore();
  
  // Cleanup expired entries every 10 minutes
  static {
    setInterval(() => {
      RateLimitMiddleware.store.cleanup();
    }, 10 * 60 * 1000);
  }

  /**
   * Create rate limiting middleware
   */
  static create(config: RateLimitConfig) {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        // Generate rate limit key (default: IP address)
        const key = config.keyGenerator ? config.keyGenerator(req) : this.getClientIP(req);
        
        // Check current request count
        const currentCount = this.store.getCount(key);
        
        // If under limit, increment and continue
        if (currentCount < config.maxRequests) {
          const limitInfo = this.store.increment(key, config.windowMs);
          limitInfo.remaining = config.maxRequests - (currentCount + 1);
          
          // Add rate limit headers
          this.addRateLimitHeaders(res, config, limitInfo);
          
          return next();
        }

        // Rate limit exceeded
        const limitInfo = this.store.increment(key, config.windowMs);
        limitInfo.remaining = 0;
        limitInfo.retryAfter = Math.ceil((limitInfo.resetTime - Date.now()) / 1000);

        // Add rate limit headers
        this.addRateLimitHeaders(res, config, limitInfo);

        // Call custom handler if provided
        if (config.onLimitReached) {
          config.onLimitReached(req, res);
          return;
        }

        // Default rate limit response
        res.status(429).json({
          error: {
            code: 'rate_limit_exceeded',
            message: config.message || 'Too many requests. Please try again later.'
          },
          timestamp: new Date().toISOString(),
          retryAfter: limitInfo.retryAfter
        });

      } catch (error) {
        console.error('Rate limiting error:', error);
        // On error, allow the request to continue
        next();
      }
    };
  }

  /**
   * Preset configurations for common scenarios
   */
  static presets = {
    // Very strict: 5 requests per minute
    strict: {
      windowMs: 60 * 1000,     // 1 minute
      maxRequests: 5,
      message: 'Too many requests. Maximum 5 requests per minute allowed.'
    },

    // Standard: 100 requests per 15 minutes  
    standard: {
      windowMs: 15 * 60 * 1000,  // 15 minutes
      maxRequests: 100,
      message: 'Too many requests. Maximum 100 requests per 15 minutes allowed.'
    },

    // Lenient: 1000 requests per hour
    lenient: {
      windowMs: 60 * 60 * 1000,  // 1 hour
      maxRequests: 1000,
      message: 'Too many requests. Maximum 1000 requests per hour allowed.'
    },

    // Auth endpoints: 10 requests per 15 minutes
    auth: {
      windowMs: 15 * 60 * 1000,  // 15 minutes
      maxRequests: 10,
      message: 'Too many authentication attempts. Please try again later.'
    }
  };

  /**
   * Get client IP address from request
   */
  private static getClientIP(req: Request): string {
    return (
      req.headers['x-forwarded-for'] as string ||
      req.headers['x-real-ip'] as string ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      (req.connection as any)?.socket?.remoteAddress ||
      req.ip ||
      'unknown'
    ).split(',')[0].trim();
  }

  /**
   * Add standard rate limit headers to response
   */
  private static addRateLimitHeaders(
    res: Response, 
    config: RateLimitConfig, 
    limitInfo: RateLimitInfo
  ): void {
    res.set({
      'X-RateLimit-Limit': config.maxRequests.toString(),
      'X-RateLimit-Remaining': limitInfo.remaining.toString(),
      'X-RateLimit-Reset': new Date(limitInfo.resetTime).toISOString(),
      ...(limitInfo.retryAfter && { 'Retry-After': limitInfo.retryAfter.toString() })
    });
  }

  /**
   * Create middleware for specific endpoints
   */
  static forEndpoint(endpoint: string, config: Partial<RateLimitConfig> = {}) {
    const fullConfig: RateLimitConfig = {
      ...this.presets.standard,
      ...config,
      keyGenerator: (req) => `${endpoint}:${this.getClientIP(req)}`
    };
    
    return this.create(fullConfig);
  }

  /**
   * Create user-specific rate limiting (requires authentication)
   */
  static forUser(config: Partial<RateLimitConfig> = {}) {
    const fullConfig: RateLimitConfig = {
      ...this.presets.lenient,
      ...config,
      keyGenerator: (req) => {
        const authReq = req as any;
        return authReq.auth?.userId || this.getClientIP(req);
      }
    };
    
    return this.create(fullConfig);
  }

  /**
   * Clear the rate limit store (for testing purposes)
   */
  static clearStore(): void {
    this.store.clear();
  }
} 