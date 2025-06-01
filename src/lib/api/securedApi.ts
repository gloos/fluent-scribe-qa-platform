import { supabase } from '../supabase';
import { AuthMiddleware, RBACMiddleware } from '../middleware';
import type { AuthContext, QueryFilter } from '../middleware';
import { Permission } from '../types/user';

export interface SecuredApiResponse<T = any> {
  data?: T;
  error?: any;
  context?: AuthContext;
  statusCode: number;
}

/**
 * Secured API wrapper that applies authentication and authorization to database operations
 */
export class SecuredApi {
  
  /**
   * Execute a secured SELECT query with automatic permission filtering
   */
  static async select<T = any>(
    table: string,
    options: {
      columns?: string;
      filters?: Record<string, any>;
      orderBy?: { column: string; ascending?: boolean };
      limit?: number;
      requiredPermission?: Permission;
    } = {}
  ): Promise<SecuredApiResponse<T[]>> {
    try {
      // Validate authentication
      const authResult = await AuthMiddleware.validateSession();
      if (!authResult.success) {
        const authError = authResult as { success: false; error: import('../middleware').AuthError };
        return {
          error: authError.error,
          statusCode: authError.error.statusCode
        };
      }

      // Check permissions if specified
      if (options.requiredPermission) {
        const permResult = await RBACMiddleware.checkPermission(
          authResult.context,
          options.requiredPermission
        );
        if (!permResult.success) {
          const rbacError = permResult as { success: false; error: import('../middleware').RBACError };
          return {
            error: rbacError.error,
            statusCode: rbacError.error.statusCode
          };
        }
      }

      // Get permission-based query filters
      const permissionFilters = await RBACMiddleware.getQueryFilters(
        authResult.context,
        table as any,
        'select'
      );

      // Build the query
      let query = supabase
        .from(table)
        .select(options.columns || '*');

      // Apply permission-based filters
      permissionFilters.forEach(filter => {
        switch (filter.operator) {
          case 'eq':
            query = query.eq(filter.column, filter.value);
            break;
          case 'in':
            query = query.in(filter.column, filter.value);
            break;
          case 'neq':
            query = query.neq(filter.column, filter.value);
            break;
          case 'gte':
            query = query.gte(filter.column, filter.value);
            break;
          case 'lte':
            query = query.lte(filter.column, filter.value);
            break;
          case 'like':
            query = query.like(filter.column, filter.value);
            break;
        }
      });

      // Apply additional user-specified filters
      if (options.filters) {
        Object.entries(options.filters).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }

      // Apply ordering
      if (options.orderBy) {
        query = query.order(options.orderBy.column, { 
          ascending: options.orderBy.ascending ?? true 
        });
      }

      // Apply limit
      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      return {
        data: data as T[],
        error,
        context: authResult.context,
        statusCode: error ? 400 : 200
      };

    } catch (error) {
      console.error('SecuredApi.select error:', error);
      return {
        error: { message: 'Internal server error' },
        statusCode: 500
      };
    }
  }

  /**
   * Execute a secured INSERT operation
   */
  static async insert<T = any>(
    table: string,
    data: any | any[],
    options: {
      requiredPermission?: Permission;
      resourceType?: 'qa_session' | 'file' | 'project' | 'report' | 'user';
    } = {}
  ): Promise<SecuredApiResponse<T>> {
    try {
      // Validate authentication
      const authResult = await AuthMiddleware.validateSession();
      if (!authResult.success) {
        const authError = authResult as { success: false; error: import('../middleware').AuthError };
        return {
          error: authError.error,
          statusCode: authError.error.statusCode
        };
      }

      // Check permissions
      const permission = options.requiredPermission || this.getDefaultPermission(table, 'create');
      const permResult = await RBACMiddleware.checkPermission(
        authResult.context,
        permission
      );
      if (!permResult.success) {
        const rbacError = permResult as { success: false; error: import('../middleware').RBACError };
        return {
          error: rbacError.error,
          statusCode: rbacError.error.statusCode
        };
      }

      // Add user context to data if needed
      const insertData = Array.isArray(data) ? data : [data];
      const enrichedData = insertData.map(item => ({
        ...item,
        // Add user_id if table supports it and not already set
        ...(this.shouldAddUserId(table) && !item.user_id && {
          user_id: authResult.context.userId
        }),
        // Add created_by if table supports it and not already set
        ...(this.shouldAddCreatedBy(table) && !item.created_by && {
          created_by: authResult.context.userId
        })
      }));

      const { data: result, error } = await supabase
        .from(table)
        .insert(enrichedData)
        .select()
        .single();

      return {
        data: result,
        error,
        context: authResult.context,
        statusCode: error ? 400 : 201
      };

    } catch (error) {
      console.error('SecuredApi.insert error:', error);
      return {
        error: { message: 'Internal server error' },
        statusCode: 500
      };
    }
  }

  /**
   * Execute a secured UPDATE operation
   */
  static async update<T = any>(
    table: string,
    id: string,
    updates: any,
    options: {
      requiredPermission?: Permission;
      resourceType?: 'qa_session' | 'file' | 'project' | 'report' | 'user';
    } = {}
  ): Promise<SecuredApiResponse<T>> {
    try {
      // Validate authentication
      const authResult = await AuthMiddleware.validateSession();
      if (!authResult.success) {
        const authError = authResult as { success: false; error: import('../middleware').AuthError };
        return {
          error: authError.error,
          statusCode: authError.error.statusCode
        };
      }

      // Check resource-specific access if resourceType is provided
      if (options.resourceType) {
        const accessResult = await RBACMiddleware.checkResourceAccess(
          authResult.context,
          options.resourceType,
          id,
          'update'
        );
        if (!accessResult.success) {
          const rbacError = accessResult as { success: false; error: import('../middleware').RBACError };
          return {
            error: rbacError.error,
            statusCode: rbacError.error.statusCode
          };
        }
      } else {
        // Check general permission
        const permission = options.requiredPermission || this.getDefaultPermission(table, 'update');
        const permResult = await RBACMiddleware.checkPermission(
          authResult.context,
          permission
        );
        if (!permResult.success) {
          const rbacError = permResult as { success: false; error: import('../middleware').RBACError };
          return {
            error: rbacError.error,
            statusCode: rbacError.error.statusCode
          };
        }
      }

      // Add updated_by and updated_at
      const enrichedUpdates = {
        ...updates,
        ...(this.shouldAddUpdatedBy(table) && {
          updated_by: authResult.context.userId,
          updated_at: new Date().toISOString()
        })
      };

      const { data, error } = await supabase
        .from(table)
        .update(enrichedUpdates)
        .eq('id', id)
        .select()
        .single();

      return {
        data,
        error,
        context: authResult.context,
        statusCode: error ? 400 : 200
      };

    } catch (error) {
      console.error('SecuredApi.update error:', error);
      return {
        error: { message: 'Internal server error' },
        statusCode: 500
      };
    }
  }

  /**
   * Execute a secured DELETE operation
   */
  static async delete(
    table: string,
    id: string,
    options: {
      requiredPermission?: Permission;
      resourceType?: 'qa_session' | 'file' | 'project' | 'report' | 'user';
    } = {}
  ): Promise<SecuredApiResponse<null>> {
    try {
      // Validate authentication
      const authResult = await AuthMiddleware.validateSession();
      if (!authResult.success) {
        const authError = authResult as { success: false; error: import('../middleware').AuthError };
        return {
          error: authError.error,
          statusCode: authError.error.statusCode
        };
      }

      // Check resource-specific access if resourceType is provided
      if (options.resourceType) {
        const accessResult = await RBACMiddleware.checkResourceAccess(
          authResult.context,
          options.resourceType,
          id,
          'delete'
        );
        if (!accessResult.success) {
          const rbacError = accessResult as { success: false; error: import('../middleware').RBACError };
          return {
            error: rbacError.error,
            statusCode: rbacError.error.statusCode
          };
        }
      } else {
        // Check general permission
        const permission = options.requiredPermission || this.getDefaultPermission(table, 'delete');
        const permResult = await RBACMiddleware.checkPermission(
          authResult.context,
          permission
        );
        if (!permResult.success) {
          const rbacError = permResult as { success: false; error: import('../middleware').RBACError };
          return {
            error: rbacError.error,
            statusCode: rbacError.error.statusCode
          };
        }
      }

      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);

      return {
        data: null,
        error,
        context: authResult.context,
        statusCode: error ? 400 : 204
      };

    } catch (error) {
      console.error('SecuredApi.delete error:', error);
      return {
        error: { message: 'Internal server error' },
        statusCode: 500
      };
    }
  }

  /**
   * Get default permission for table/action combination
   */
  private static getDefaultPermission(table: string, action: 'create' | 'update' | 'delete'): Permission {
    const tablePermissions: Record<string, Record<string, Permission>> = {
      'qa_sessions': {
        create: Permission.CREATE_QA_SESSION,
        update: Permission.UPDATE_QA_SESSION,
        delete: Permission.DELETE_QA_SESSION
      },
      'file_uploads': {
        create: Permission.UPLOAD_FILES,
        update: Permission.UPDATE_FILES,
        delete: Permission.DELETE_FILES
      },
      'projects': {
        create: Permission.CREATE_PROJECTS,
        update: Permission.UPDATE_PROJECTS,
        delete: Permission.DELETE_PROJECTS
      },
      'reports': {
        create: Permission.CREATE_REPORTS,
        update: Permission.UPDATE_REPORTS,
        delete: Permission.DELETE_REPORTS
      },
      'profiles': {
        create: Permission.CREATE_USERS,
        update: Permission.UPDATE_USERS,
        delete: Permission.DELETE_USERS
      }
    };

    return tablePermissions[table]?.[action] || Permission.ACCESS_API;
  }

  /**
   * Check if table should have user_id automatically added
   */
  private static shouldAddUserId(table: string): boolean {
    return ['qa_sessions', 'file_uploads', 'reports'].includes(table);
  }

  /**
   * Check if table should have created_by automatically added
   */
  private static shouldAddCreatedBy(table: string): boolean {
    return ['projects', 'reports'].includes(table);
  }

  /**
   * Check if table should have updated_by automatically added
   */
  private static shouldAddUpdatedBy(table: string): boolean {
    return ['qa_sessions', 'projects', 'reports', 'profiles'].includes(table);
  }
} 