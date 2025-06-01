export { AuthMiddleware, type AuthContext, type AuthError } from './authMiddleware';
export { RBACMiddleware, type RBACError, type QueryFilter } from './rbacMiddleware';

import { AuthMiddleware, type AuthContext, type AuthError } from './authMiddleware';
import { RBACMiddleware, type RBACError } from './rbacMiddleware';
import { Permission } from '../types/user';

/**
 * Combined authentication and authorization middleware
 */
export class APIMiddleware {
  /**
   * Validate session and check permissions in one call
   */
  static async validateAndAuthorize(
    permission: Permission | Permission[]
  ): Promise<
    | { success: true; context: AuthContext }
    | { success: false; error: AuthError | RBACError }
  > {
    // First validate the session
    const authResult = await AuthMiddleware.validateSession();
    
    if (!authResult.success) {
      // Type guard: if success is false, error property exists
      return { success: false, error: (authResult as { success: false; error: AuthError }).error };
    }

    // Then check permissions
    const permissionResult = await RBACMiddleware.checkPermission(
      authResult.context,
      permission
    );

    if (!permissionResult.success) {
      // Type guard: if success is false, error property exists
      return { success: false, error: (permissionResult as { success: false; error: RBACError }).error };
    }

    // Both auth and permission checks passed
    return { success: true, context: authResult.context };
  }

  /**
   * Validate session and check resource access in one call
   */
  static async validateAndAuthorizeResource(
    resourceType: 'qa_session' | 'file' | 'project' | 'report' | 'user',
    resourceId: string,
    action: 'view' | 'update' | 'delete' | 'create'
  ): Promise<
    | { success: true; context: AuthContext }
    | { success: false; error: AuthError | RBACError }
  > {
    // First validate the session
    const authResult = await AuthMiddleware.validateSession();
    
    if (!authResult.success) {
      // Type guard: if success is false, error property exists
      return { success: false, error: (authResult as { success: false; error: AuthError }).error };
    }

    // Then check resource access
    const accessResult = await RBACMiddleware.checkResourceAccess(
      authResult.context,
      resourceType,
      resourceId,
      action
    );

    if (!accessResult.success) {
      // Type guard: if success is false, error property exists
      return { success: false, error: (accessResult as { success: false; error: RBACError }).error };
    }

    // Both auth and access checks passed
    return { success: true, context: authResult.context };
  }

  /**
   * Get authenticated user context with query filters for a resource type
   */
  static async getContextWithFilters(
    resourceType: 'qa_sessions' | 'file_uploads' | 'projects' | 'reports' | 'profiles',
    action: 'select' | 'update' | 'delete' = 'select'
  ): Promise<
    | { success: true; context: AuthContext; filters: import('./rbacMiddleware').QueryFilter[] }
    | { success: false; error: AuthError }
  > {
    // Validate the session
    const authResult = await AuthMiddleware.validateSession();
    
    if (!authResult.success) {
      // Type guard: if success is false, error property exists
      return { success: false, error: (authResult as { success: false; error: AuthError }).error };
    }

    // Get query filters based on user permissions
    const filters = await RBACMiddleware.getQueryFilters(
      authResult.context,
      resourceType,
      action
    );

    return {
      success: true,
      context: authResult.context,
      filters
    };
  }

  /**
   * Handle common API error responses
   */
  static formatErrorResponse(error: AuthError | RBACError) {
    return {
      error: true,
      message: error.message,
      statusCode: error.statusCode,
      type: error.type,
      ...(('requiredPermissions' in error) && {
        requiredPermissions: error.requiredPermissions,
        userPermissions: error.userPermissions
      })
    };
  }
} 