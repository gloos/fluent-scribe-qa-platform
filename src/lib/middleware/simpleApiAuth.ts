import { Request, Response, NextFunction } from 'express';
import { AuthMiddleware } from './authMiddleware';
import { ApiKeyService } from '../services/apiKeyService';

export interface SimpleAuthContext {
  userId: string;
  userRole?: string;
  authMethod: 'jwt' | 'api_key';
  apiKeyId?: string;
}

export interface AuthenticatedRequest extends Request {
  auth?: SimpleAuthContext;
}

/**
 * Simplified authentication middleware that supports both JWT and API key auth
 */
export class SimpleApiAuthMiddleware {
  /**
   * Authentication middleware
   */
  static authenticate() {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        // Try API key authentication first
        const apiKey = req.headers['x-api-key'] as string;
        if (apiKey) {
          const authResult = await this.authenticateApiKey(apiKey);
          if (authResult) {
            req.auth = authResult;
            return next();
          }
          return this.sendError(res, 401, 'INVALID_API_KEY', 'Invalid API key');
        }

        // Try JWT authentication
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          const authResult = await this.authenticateJWT(token);
          if (authResult) {
            req.auth = authResult;
            return next();
          }
          return this.sendError(res, 401, 'INVALID_TOKEN', 'Invalid JWT token');
        }

        // No authentication provided
        return this.sendError(res, 401, 'MISSING_AUTH', 'Authentication required');

      } catch (error) {
        console.error('Authentication error:', error);
        return this.sendError(res, 500, 'AUTH_ERROR', 'Authentication failed');
      }
    };
  }

  /**
   * Authenticate with API key
   */
  private static async authenticateApiKey(apiKey: string): Promise<SimpleAuthContext | null> {
    try {
      const validation = await ApiKeyService.validateApiKey(apiKey);
      
      if (!validation.is_valid || !validation.key_id || !validation.user_id) {
        return null;
      }

      // Check rate limits
      const rateLimits = await ApiKeyService.checkRateLimit(validation.key_id);
      if (rateLimits && (!rateLimits.minute_allowed || !rateLimits.hour_allowed || !rateLimits.day_allowed)) {
        return null; // Rate limit exceeded
      }

      return {
        userId: validation.user_id,
        authMethod: 'api_key',
        apiKeyId: validation.key_id
      };
    } catch (error) {
      console.error('API key validation error:', error);
      return null;
    }
  }

  /**
   * Authenticate with JWT
   */
  private static async authenticateJWT(token: string): Promise<SimpleAuthContext | null> {
    try {
      const result = await AuthMiddleware.validateToken(token);
      
      if (result.success) {
        return {
          userId: result.context.userId,
          userRole: result.context.role,
          authMethod: 'jwt'
        };
      }
      
      return null;
    } catch (error) {
      console.error('JWT validation error:', error);
      return null;
    }
  }

  /**
   * Send error response
   */
  private static sendError(res: Response, status: number, code: string, message: string): void {
    res.status(status).json({
      error: {
        code,
        message
      },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Require authentication (middleware)
   */
  static requireAuth() {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.auth) {
        return this.sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      }
      next();
    };
  }

  /**
   * Add security headers
   */
  static securityHeaders() {
    return (req: Request, res: Response, next: NextFunction) => {
      res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
      });
      next();
    };
  }
} 