import { Permission, UserRole } from '../types/user';
import { rbacService } from '../rbac';
import type { AuthContext, AuthError } from './authMiddleware';

export interface RBACError {
  type: 'FORBIDDEN' | 'INSUFFICIENT_PERMISSIONS' | 'RESOURCE_ACCESS_DENIED';
  message: string;
  statusCode: number;
  requiredPermissions?: Permission[];
  userPermissions?: Permission[];
}

export interface QueryFilter {
  column: string;
  operator: 'eq' | 'in' | 'neq' | 'gte' | 'lte' | 'like';
  value: any;
}

/**
 * RBAC middleware for role-based permission checking and query filtering
 */
export class RBACMiddleware {
  /**
   * Check if user has required permission(s)
   */
  static async checkPermission(
    context: AuthContext, 
    permission: Permission | Permission[]
  ): Promise<{ success: true } | { success: false; error: RBACError }> {
    try {
      const permissions = Array.isArray(permission) ? permission : [permission];
      const hasPermission = await rbacService.hasAllPermissions(context.userId, permissions);

      if (!hasPermission) {
        const userPermissions = await rbacService.getUserPermissions(context.userId);
        
        return {
          success: false,
          error: {
            type: 'INSUFFICIENT_PERMISSIONS',
            message: `Insufficient permissions. Required: ${permissions.join(', ')}`,
            statusCode: 403,
            requiredPermissions: permissions,
            userPermissions
          }
        };
      }

      return { success: true };
    } catch (error) {
      console.error('Permission check error:', error);
      return {
        success: false,
        error: {
          type: 'FORBIDDEN',
          message: 'Permission validation failed',
          statusCode: 403
        }
      };
    }
  }

  /**
   * Check if user can access a specific resource
   */
  static async checkResourceAccess(
    context: AuthContext,
    resourceType: 'qa_session' | 'file' | 'project' | 'report' | 'user',
    resourceId: string,
    action: 'view' | 'update' | 'delete' | 'create'
  ): Promise<{ success: true } | { success: false; error: RBACError }> {
    try {
      // For create operations, we don't need a specific resource ID
      if (action === 'create') {
        const permission = this.getCreatePermission(resourceType);
        return await this.checkPermission(context, permission);
      }

      // Handle user resource type separately since it's not supported by canModifyResource
      if (resourceType === 'user') {
        const permission = action === 'view' ? Permission.VIEW_USERS : 
                          action === 'update' ? Permission.UPDATE_USERS : Permission.DELETE_USERS;
        return await this.checkPermission(context, permission);
      }

      // Check if user can modify this specific resource
      const canAccess = await rbacService.canModifyResource(
        context.userId,
        resourceType,
        resourceId,
        action
      );

      if (!canAccess) {
        return {
          success: false,
          error: {
            type: 'RESOURCE_ACCESS_DENIED',
            message: `Access denied to ${resourceType} ${resourceId} for action ${action}`,
            statusCode: 403
          }
        };
      }

      return { success: true };
    } catch (error) {
      console.error('Resource access check error:', error);
      return {
        success: false,
        error: {
          type: 'FORBIDDEN',
          message: 'Resource access validation failed',
          statusCode: 403
        }
      };
    }
  }

  /**
   * Generate query filters based on user permissions
   */
  static async getQueryFilters(
    context: AuthContext,
    resourceType: 'qa_sessions' | 'file_uploads' | 'projects' | 'reports' | 'profiles',
    action: 'select' | 'update' | 'delete' = 'select'
  ): Promise<QueryFilter[]> {
    const filters: QueryFilter[] = [];

    try {
      // Check if user has "view all" permissions
      const hasViewAllPermission = await this.hasViewAllPermission(context, resourceType);
      
      if (hasViewAllPermission) {
        // User can see all records, no filtering needed
        return filters;
      }

      // Apply ownership-based filtering for regular users
      switch (resourceType) {
        case 'qa_sessions':
          // Users can only see their own QA sessions unless they have special permissions
          filters.push({
            column: 'user_id',
            operator: 'eq',
            value: context.userId
          });
          break;

        case 'file_uploads':
          // Filter by QA sessions the user owns or has access to
          const accessibleSessionIds = await this.getAccessibleSessionIds(context);
          if (accessibleSessionIds.length > 0) {
            filters.push({
              column: 'session_id',
              operator: 'in',
              value: accessibleSessionIds
            });
          } else {
            // No accessible sessions, return impossible filter
            filters.push({
              column: 'id',
              operator: 'eq',
              value: 'no-access'
            });
          }
          break;

        case 'projects':
          // Filter by projects the user is a member of or has access to
          const accessibleProjectIds = await this.getAccessibleProjectIds(context);
          if (accessibleProjectIds.length > 0) {
            filters.push({
              column: 'id',
              operator: 'in',
              value: accessibleProjectIds
            });
          } else {
            filters.push({
              column: 'id',
              operator: 'eq',
              value: 'no-access'
            });
          }
          break;

        case 'reports':
          // Users can see their own reports or public ones
          filters.push({
            column: 'created_by',
            operator: 'eq',
            value: context.userId
          });
          break;

        case 'profiles':
          // Most users can only see their own profile
          const canViewUsers = await rbacService.hasPermission(context.userId, Permission.VIEW_USERS);
          if (!canViewUsers) {
            filters.push({
              column: 'id',
              operator: 'eq',
              value: context.userId
            });
          }
          break;
      }

      return filters;
    } catch (error) {
      console.error('Error generating query filters:', error);
      // Default to very restrictive filtering on error
      return [{
        column: 'id',
        operator: 'eq',
        value: 'no-access'
      }];
    }
  }

  /**
   * Check if user has "view all" permission for a resource type
   */
  private static async hasViewAllPermission(context: AuthContext, resourceType: string): Promise<boolean> {
    const viewAllPermissions: Record<string, Permission> = {
      'qa_sessions': Permission.VIEW_ALL_QA_SESSIONS,
      'file_uploads': Permission.VIEW_ALL_FILES,
      'projects': Permission.VIEW_ALL_PROJECTS,
      'reports': Permission.VIEW_ALL_REPORTS,
      'profiles': Permission.VIEW_USERS
    };

    const permission = viewAllPermissions[resourceType];
    if (!permission) return false;

    return await rbacService.hasPermission(context.userId, permission);
  }

  /**
   * Get QA session IDs the user has access to
   */
  private static async getAccessibleSessionIds(context: AuthContext): Promise<string[]> {
    try {
      // This would typically involve checking project memberships, team assignments, etc.
      // For now, we'll return sessions owned by the user
      // TODO: Implement proper project membership checking
      return []; // Will be filtered by user_id anyway
    } catch (error) {
      console.error('Error getting accessible session IDs:', error);
      return [];
    }
  }

  /**
   * Get project IDs the user has access to
   */
  private static async getAccessibleProjectIds(context: AuthContext): Promise<string[]> {
    try {
      // This would check project memberships from the database
      // TODO: Implement project membership query
      return []; // Placeholder
    } catch (error) {
      console.error('Error getting accessible project IDs:', error);
      return [];
    }
  }

  /**
   * Get the appropriate create permission for a resource type
   */
  private static getCreatePermission(resourceType: string): Permission {
    const createPermissions: Record<string, Permission> = {
      'qa_session': Permission.CREATE_QA_SESSION,
      'file': Permission.UPLOAD_FILES,
      'project': Permission.CREATE_PROJECTS,
      'report': Permission.CREATE_REPORTS,
      'user': Permission.CREATE_USERS
    };

    return createPermissions[resourceType] || Permission.ACCESS_API;
  }

  /**
   * Validate if user can perform bulk operations
   */
  static async checkBulkOperation(
    context: AuthContext,
    resourceType: string,
    resourceIds: string[],
    action: 'update' | 'delete'
  ): Promise<{ success: true; allowedIds: string[] } | { success: false; error: RBACError }> {
    try {
      const allowedIds: string[] = [];

      for (const resourceId of resourceIds) {
        const accessCheck = await this.checkResourceAccess(context, resourceType as any, resourceId, action);
        if (accessCheck.success) {
          allowedIds.push(resourceId);
        }
      }

      if (allowedIds.length === 0) {
        return {
          success: false,
          error: {
            type: 'RESOURCE_ACCESS_DENIED',
            message: `No permission to ${action} any of the specified ${resourceType} resources`,
            statusCode: 403
          }
        };
      }

      return { success: true, allowedIds };
    } catch (error) {
      console.error('Bulk operation check error:', error);
      return {
        success: false,
        error: {
          type: 'FORBIDDEN',
          message: 'Bulk operation validation failed',
          statusCode: 403
        }
      };
    }
  }
} 