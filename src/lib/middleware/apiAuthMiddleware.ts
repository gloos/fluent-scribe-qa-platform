import { Request, Response, NextFunction } from 'express';
import { AuthMiddleware, AuthContext, AuthError } from './authMiddleware';
import { ApiKeyService, ApiKeyValidationResult, RateLimitStatus } from '../services/apiKeyService';

export interface ApiAuthContext extends AuthContext {
  // Additional fields for API key authentication
  apiKeyId?: string;
  authMethod: 'jwt' | 'api_key';
  rateLimits?: RateLimitStatus;
}

export interface ApiAuthError extends AuthError {
  rateLimitInfo?: {
    retryAfter?: number;
    remaining?: number;
  };
}

/**
 * Enhanced request interface with authentication context
 */
export interface AuthenticatedRequest extends Request {
  auth?: ApiAuthContext;
}

/**
 * Authentication middleware that supports both JWT tokens and API keys
 * Implements the authentication schemes defined in the OpenAPI specification
 */
export class ApiAuthMiddleware {
  /**
   * Main authentication middleware that handles both JWT and API key auth
   */
  static authenticate() {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        // Check for API key in X-API-Key header first
        const apiKey = req.headers['x-api-key'] as string;
        if (apiKey) {
          const result = await this.authenticateWithApiKey(req, apiKey);
          if (!result.success) {
            return this.sendErrorResponse(res, result.error);
          }
          req.auth = result.context;
          return next();
        }

        // Check for JWT Bearer token
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          const result = await this.authenticateWithJWT(req, token);
          if (!result.success) {
            return this.sendErrorResponse(res, result.error);
          }
          req.auth = result.context;
          return next();
        }

        // No authentication provided
        return this.sendErrorResponse(res, {
          type: 'MISSING_TOKEN',
          message: 'Authentication required. Provide either X-API-Key or Authorization header.',
          statusCode: 401
        });

      } catch (error) {
        console.error('Authentication middleware error:', error);
        return this.sendErrorResponse(res, {
          type: 'UNAUTHORIZED',
          message: 'Authentication failed',
          statusCode: 500
        });
      }
    };
  }

  /**
   * Authenticate request using API key
   */
  private static async authenticateWithApiKey(
    req: AuthenticatedRequest, 
    apiKey: string
  ): Promise<{ success: true; context: ApiAuthContext } | { success: false; error: ApiAuthError }> {
    try {
      // Validate the API key
      const validation: ApiKeyValidationResult = await ApiKeyService.validateApiKey(apiKey);
      
      if (!validation.is_valid || !validation.key_id || !validation.user_id) {
        return {
          success: false,
          error: {
            type: 'INVALID_TOKEN',
            message: 'Invalid API key',
            statusCode: 401
          }
        };
      }

      // Check rate limits
      const rateLimits = await ApiKeyService.checkRateLimit(validation.key_id);
      if (rateLimits && (!rateLimits.minute_allowed || !rateLimits.hour_allowed || !rateLimits.day_allowed)) {
        let retryAfter = 60; // Default to 1 minute
        
        if (!rateLimits.minute_allowed) {
          retryAfter = 60;
        } else if (!rateLimits.hour_allowed) {
          retryAfter = 3600;
        } else if (!rateLimits.day_allowed) {
          retryAfter = 86400;
        }

        return {
          success: false,
          error: {
            type: 'UNAUTHORIZED',
            message: 'Rate limit exceeded',
            statusCode: 429,
            rateLimitInfo: {
              retryAfter,
              remaining: Math.min(
                rateLimits.minute_remaining,
                rateLimits.hour_remaining,
                rateLimits.day_remaining
              )
            }
          }
        };
      }

      // Create authentication context for API key
      const context: ApiAuthContext = {
        user: {
          id: validation.user_id,
          email: '', // API keys don't have email context
          user_metadata: {},
          app_metadata: {}
        } as any,
        session: null as any, // API keys don't have sessions
        role: 'user' as any, // Default role for API key users
        userId: validation.user_id,
        apiKeyId: validation.key_id,
        authMethod: 'api_key',
        rateLimits
      };

      // Record the API usage (fire and forget)
      this.recordApiUsage(req, validation.key_id).catch(err => {
        console.error('Failed to record API usage:', err);
      });

      return { success: true, context };

    } catch (error) {
      console.error('API key authentication error:', error);
      return {
        success: false,
        error: {
          type: 'UNAUTHORIZED',
          message: 'API key authentication failed',
          statusCode: 401
        }
      };
    }
  }

  /**
   * Authenticate request using JWT token
   */
  private static async authenticateWithJWT(
    req: AuthenticatedRequest,
    token: string
  ): Promise<{ success: true; context: ApiAuthContext } | { success: false; error: ApiAuthError }> {
    try {
      // Use existing JWT authentication
      const result = await AuthMiddleware.validateToken(token);
      
      if (result.success) {
        // Extend the context with API-specific fields
        const context: ApiAuthContext = {
          ...result.context,
          authMethod: 'jwt'
        };

        return { success: true, context };
      } else {
        return {
          success: false,
          error: result.error as ApiAuthError
        };
      }

    } catch (error) {
      console.error('JWT authentication error:', error);
      return {
        success: false,
        error: {
          type: 'UNAUTHORIZED',
          message: 'JWT authentication failed',
          statusCode: 401
        }
      };
    }
  }

  /**
   * Record API usage for analytics and rate limiting
   */
  private static async recordApiUsage(req: AuthenticatedRequest, keyId: string): Promise<void> {
    try {
      const endpoint = req.path;
      const method = req.method;
      const userAgent = req.headers['user-agent'];
      const ipAddress = req.ip || (req.connection as any)?.remoteAddress;
      
      // Get request size
      const requestSize = req.headers['content-length'] ? 
        parseInt(req.headers['content-length'] as string) : undefined;

      await ApiKeyService.recordUsage(
        keyId,
        endpoint,
        method,
        200, // We'll update this in response middleware
        {
          requestSize,
          ipAddress,
          userAgent
        }
      );
    } catch (error) {
      console.error('Error recording API usage:', error);
    }
  }

  /**
   * Send standardized error response
   */
  private static sendErrorResponse(res: Response, error: ApiAuthError): void {
    const response: any = {
      error: {
        code: error.type.toLowerCase(),
        message: error.message
      },
      timestamp: new Date().toISOString()
    };

    // Add rate limit headers if applicable
    if (error.rateLimitInfo) {
      res.set({
        'X-RateLimit-Remaining': error.rateLimitInfo.remaining?.toString() || '0',
        'Retry-After': error.rateLimitInfo.retryAfter?.toString() || '60'
      });
    }

    res.status(error.statusCode).json(response);
  }

  /**
   * Middleware to require specific permissions (for future use)
   */
  static requirePermission(permission: string) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.auth) {
        return this.sendErrorResponse(res, {
          type: 'UNAUTHORIZED',
          message: 'Authentication required',
          statusCode: 401
        });
      }

      // For API keys, check permissions array
      if (req.auth.authMethod === 'api_key') {
        // TODO: Implement permission checking based on API key permissions
        // For now, allow all authenticated API key requests
        return next();
      }

      // For JWT tokens, use existing RBAC system
      // TODO: Integrate with existing RBACMiddleware
      return next();
    };
  }

  /**
   * Response middleware to update usage statistics with response data
   */
  static recordResponse() {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      // Capture original end method
      const originalEnd = res.end;
      let responseSize = 0;
      let responseData = '';

      // Override end method to capture response size
      res.end = function(chunk?: any, encoding?: any) {
        if (chunk) {
          responseData += chunk;
          responseSize = Buffer.byteLength(responseData);
        }

        // Update usage record if this was an API key request
        if (req.auth?.authMethod === 'api_key' && req.auth.apiKeyId) {
          ApiKeyService.recordUsage(
            req.auth.apiKeyId,
            req.path,
            req.method,
            res.statusCode,
            {
              responseSize,
              processingTime: Date.now() - (req as any).startTime
            }
          ).catch(err => {
            console.error('Failed to update API usage record:', err);
          });
        }

        // Call original end method
        return originalEnd.call(this, chunk, encoding);
      };

      // Store request start time for processing time calculation
      (req as any).startTime = Date.now();

      next();
    };
  }

  /**
   * Add additional security headers to responses (supplementing helmet configuration)
   */
  static securityHeaders() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Additional security headers not covered by helmet or with custom values
      res.set({
        // Custom response time header for API monitoring
        'X-Response-Time': `${Date.now() - (req as any).startTime || 0}ms`,
        
        // Clear server information
        'Server': '', // Override any server headers
        
        // Additional security headers for API context
        'X-API-Version': '1.0.0',
        'X-Rate-Limit-Policy': 'per-user-per-hour',
        
        // Content-Type enforcement for API responses
        'X-Content-Type-Validation': 'strict'
      });

      next();
    };
  }
} 