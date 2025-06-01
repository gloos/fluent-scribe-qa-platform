import { supabase } from '../supabase';
import type { User, Session } from '@supabase/supabase-js';
import { UserRole } from '../types/user';

export interface AuthContext {
  user: User;
  session: Session;
  role: UserRole;
  userId: string;
}

export interface AuthError {
  type: 'UNAUTHORIZED' | 'INVALID_TOKEN' | 'EXPIRED_TOKEN' | 'MISSING_TOKEN' | 'INVALID_ROLE';
  message: string;
  statusCode: number;
}

/**
 * Authentication middleware for validating JWT tokens and extracting user context
 */
export class AuthMiddleware {
  /**
   * Validate the current session and extract user context
   */
  static async validateSession(): Promise<{ success: true; context: AuthContext } | { success: false; error: AuthError }> {
    try {
      // Get current session from Supabase
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        return {
          success: false,
          error: {
            type: 'INVALID_TOKEN',
            message: 'Session validation failed',
            statusCode: 401
          }
        };
      }

      if (!session) {
        return {
          success: false,
          error: {
            type: 'MISSING_TOKEN',
            message: 'No active session found',
            statusCode: 401
          }
        };
      }

      // Check if session is expired
      if (session.expires_at && session.expires_at < Date.now() / 1000) {
        return {
          success: false,
          error: {
            type: 'EXPIRED_TOKEN',
            message: 'Session has expired',
            statusCode: 401
          }
        };
      }

      const user = session.user;
      if (!user) {
        return {
          success: false,
          error: {
            type: 'UNAUTHORIZED',
            message: 'Invalid user session',
            statusCode: 401
          }
        };
      }

      // Extract role from user metadata or fetch from database
      const role = await this.extractUserRole(user.id);
      
      if (!role) {
        return {
          success: false,
          error: {
            type: 'INVALID_ROLE',
            message: 'User role not found or invalid',
            statusCode: 403
          }
        };
      }

      const context: AuthContext = {
        user,
        session,
        role,
        userId: user.id
      };

      return { success: true, context };

    } catch (error) {
      console.error('Auth middleware error:', error);
      return {
        success: false,
        error: {
          type: 'UNAUTHORIZED',
          message: 'Authentication failed',
          statusCode: 401
        }
      };
    }
  }

  /**
   * Extract user role from database
   */
  private static async extractUserRole(userId: string): Promise<UserRole | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (error || !data) {
        console.error('Error fetching user role:', error);
        return null;
      }

      return data.role as UserRole;
    } catch (error) {
      console.error('Error extracting user role:', error);
      return null;
    }
  }

  /**
   * Validate token from authorization header (for API key scenarios)
   */
  static async validateToken(token: string): Promise<{ success: true; context: AuthContext } | { success: false; error: AuthError }> {
    try {
      // Verify JWT token with Supabase
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error || !user) {
        return {
          success: false,
          error: {
            type: 'INVALID_TOKEN',
            message: 'Invalid authorization token',
            statusCode: 401
          }
        };
      }

      // Extract role for the user
      const role = await this.extractUserRole(user.id);
      
      if (!role) {
        return {
          success: false,
          error: {
            type: 'INVALID_ROLE',
            message: 'User role not found',
            statusCode: 403
          }
        };
      }

      // Create a minimal session context for token-based auth
      const context: AuthContext = {
        user,
        session: null as any, // Token-based auth doesn't have full session
        role,
        userId: user.id
      };

      return { success: true, context };

    } catch (error) {
      console.error('Token validation error:', error);
      return {
        success: false,
        error: {
          type: 'INVALID_TOKEN',
          message: 'Token validation failed',
          statusCode: 401
        }
      };
    }
  }

  /**
   * Refresh session if needed
   */
  static async refreshSession(): Promise<{ success: boolean; error?: AuthError }> {
    try {
      const { error } = await supabase.auth.refreshSession();
      
      if (error) {
        return {
          success: false,
          error: {
            type: 'EXPIRED_TOKEN',
            message: 'Session refresh failed',
            statusCode: 401
          }
        };
      }

      return { success: true };
    } catch (error) {
      console.error('Session refresh error:', error);
      return {
        success: false,
        error: {
          type: 'UNAUTHORIZED',
          message: 'Session refresh failed',
          statusCode: 401
        }
      };
    }
  }
} 