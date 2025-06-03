import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';
import { UserRole, UserProfile, UserStatus, Permission } from './types/user';
import { databaseCache } from '../services/databaseCacheService';

// Import types needed for caching
interface OrganizationMembership {
  organization_id: string;
  role: string;
  organizations: Array<{
    id: string;
    name: string;
    description?: string;
    created_at: string;
  }>;
}

interface ProjectMembership {
  project_id: string;
  role: string;
  projects: Array<{
    id: string;
    name: string;
    description?: string;
    status: string;
    created_at: string;
    organization_id: string;
  }>;
}

// Export the enums and types we need
export { UserRole, UserStatus, Permission } from './types/user';

// Enhanced RBAC Service with caching
export class CachedRBACService {
  private static instance: CachedRBACService;
  
  private constructor() {
    // Setup cache event listeners for monitoring
    databaseCache.on('cache_hit', (event) => {
      if (event.key.includes('user_') || event.key.includes('role_')) {
        console.log(`🎯 RBAC Cache Hit: ${event.key} (${event.responseTime}ms)`);
      }
    });

    databaseCache.on('cache_miss', (event) => {
      if (event.key.includes('user_') || event.key.includes('role_')) {
        console.log(`⚠️ RBAC Cache Miss: ${event.key} (${event.responseTime}ms)`);
      }
    });
  }

  static getInstance(): CachedRBACService {
    if (!CachedRBACService.instance) {
      CachedRBACService.instance = new CachedRBACService();
    }
    return CachedRBACService.instance;
  }

  /**
   * Get user profile with caching
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      return await databaseCache.getUserProfile(userId);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }

  /**
   * Get user role with caching
   */
  async getUserRole(userId: string): Promise<UserRole> {
    try {
      const role = await databaseCache.getUserRole(userId);
      return (role as UserRole) || UserRole.USER; // Default to USER if no role found
    } catch (error) {
      console.error('Error fetching user role:', error);
      return UserRole.USER;
    }
  }

  /**
   * Check if user has specific permission with caching
   */
  async hasPermission(userId: string, permission: Permission): Promise<boolean> {
    try {
      const permissions = await this.getUserPermissions(userId);
      return permissions.includes(permission);
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }

  /**
   * Check if user has any of the specified permissions
   */
  async hasAnyPermission(userId: string, permissions: Permission[]): Promise<boolean> {
    try {
      const userPermissions = await this.getUserPermissions(userId);
      return permissions.some(permission => userPermissions.includes(permission));
    } catch (error) {
      console.error('Error checking any permission:', error);
      return false;
    }
  }

  /**
   * Check if user has all specified permissions
   */
  async hasAllPermissions(userId: string, permissions: Permission[]): Promise<boolean> {
    try {
      const userPermissions = await this.getUserPermissions(userId);
      return permissions.every(permission => userPermissions.includes(permission));
    } catch (error) {
      console.error('Error checking all permissions:', error);
      return false;
    }
  }

  /**
   * Get all permissions for a user with caching
   */
  async getUserPermissions(userId: string): Promise<Permission[]> {
    return databaseCache.get(
      `user_permissions:${userId}`,
      async () => {
        const role = await this.getUserRole(userId);
        return this.getRolePermissions(role);
      },
      {
        ttl: 15 * 60 * 1000, // 15 minutes
        tags: ['user', 'permissions', `user:${userId}`]
      }
    );
  }

  /**
   * Get organizations for a user with caching
   */
  async getUserOrganizations(userId: string): Promise<OrganizationMembership[]> {
    return databaseCache.getUserOrganizations(userId);
  }

  /**
   * Get projects for a user with caching
   */
  async getUserProjects(userId: string): Promise<ProjectMembership[]> {
    return databaseCache.getUserProjects(userId);
  }

  /**
   * Check project-specific permissions with caching
   */
  async hasProjectPermission(
    userId: string, 
    projectId: string, 
    permission: Permission
  ): Promise<boolean> {
    return databaseCache.get(
      `project_permission:${userId}:${projectId}:${permission}`,
      async () => {
        // First check global permissions
        const globalPermissions = await this.getUserPermissions(userId);
        if (globalPermissions.includes(permission)) {
          return true;
        }

        // Check if user is project member
        const isProjectMember = await this.isProjectMember(userId, projectId);
        if (!isProjectMember) {
          return false;
        }

        // Check project-specific permissions based on role
        const projectMemberRole = await this.getProjectMemberRole(userId, projectId);
        const projectPermissions = this.getProjectRolePermissions(projectMemberRole);
        
        return projectPermissions.includes(permission);
      },
      {
        ttl: 10 * 60 * 1000, // 10 minutes
        tags: ['user', 'project', 'permission', `user:${userId}`, `project:${projectId}`]
      }
    );
  }

  /**
   * Check organization-specific permissions with caching
   */
  async hasOrganizationPermission(
    userId: string, 
    organizationId: string, 
    permission: Permission
  ): Promise<boolean> {
    return databaseCache.get(
      `org_permission:${userId}:${organizationId}:${permission}`,
      async () => {
        // First check global permissions
        const globalPermissions = await this.getUserPermissions(userId);
        if (globalPermissions.includes(permission)) {
          return true;
        }

        // Check if user is organization member
        const isOrgMember = await this.isOrganizationMember(userId, organizationId);
        if (!isOrgMember) {
          return false;
        }

        // Check organization-specific permissions based on role
        const orgMemberRole = await this.getOrganizationMemberRole(userId, organizationId);
        const orgPermissions = this.getOrganizationRolePermissions(orgMemberRole);
        
        return orgPermissions.includes(permission);
      },
      {
        ttl: 10 * 60 * 1000, // 10 minutes
        tags: ['user', 'organization', 'permission', `user:${userId}`, `org:${organizationId}`]
      }
    );
  }

  /**
   * Update user role and invalidate related cache
   */
  async updateUserRole(
    adminUserId: string, 
    targetUserId: string, 
    newRole: UserRole
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if admin can perform this action
      const canManage = await this.canManageUser(adminUserId, targetUserId);
      if (!canManage) {
        return { success: false, error: 'Insufficient permissions to update user role' };
      }

      // Update role in database
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', targetUserId);

      if (error) {
        return { success: false, error: error.message };
      }

      // Invalidate cache for the target user
      this.invalidateUserCache(targetUserId);
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get all users (admin function) with caching
   */
  async getAllUsers(adminUserId: string): Promise<{ success: boolean; users?: UserProfile[]; error?: string }> {
    try {
      // Check admin permissions
      const hasPermission = await this.hasPermission(adminUserId, Permission.VIEW_USERS);
      if (!hasPermission) {
        return { success: false, error: 'Insufficient permissions to view users' };
      }

      const users = await databaseCache.get(
        'all_users',
        async () => {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

          if (error) throw error;
          return data;
        },
        {
          ttl: 5 * 60 * 1000, // 5 minutes (shorter TTL for admin data)
          tags: ['users', 'admin']
        }
      );

      return { success: true, users };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Cache invalidation methods
   */
  invalidateUserCache(userId: string): void {
    databaseCache.invalidateUser(userId);
    // Also invalidate related caches
    databaseCache.invalidateByTags(['users', 'admin']); // For getAllUsers cache
  }

  invalidateOrganizationCache(organizationId: string): void {
    databaseCache.invalidateOrganization(organizationId);
  }

  invalidateProjectCache(projectId: string): void {
    databaseCache.invalidateProject(projectId);
  }

  clearAllUserCaches(): void {
    databaseCache.invalidateByTags(['user', 'users']);
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats() {
    return databaseCache.getStats();
  }

  // Private helper methods
  private async isProjectMember(userId: string, projectId: string): Promise<boolean> {
    return databaseCache.get(
      `project_member:${userId}:${projectId}`,
      async () => {
        const { data, error } = await supabase
          .from('project_members')
          .select('id')
          .eq('user_id', userId)
          .eq('project_id', projectId)
          .single();

        return !error && !!data;
      },
      {
        ttl: 15 * 60 * 1000,
        tags: ['user', 'project', `user:${userId}`, `project:${projectId}`]
      }
    );
  }

  private async isOrganizationMember(userId: string, organizationId: string): Promise<boolean> {
    return databaseCache.get(
      `org_member:${userId}:${organizationId}`,
      async () => {
        const { data, error } = await supabase
          .from('organization_members')
          .select('id')
          .eq('user_id', userId)
          .eq('organization_id', organizationId)
          .single();

        return !error && !!data;
      },
      {
        ttl: 15 * 60 * 1000,
        tags: ['user', 'organization', `user:${userId}`, `org:${organizationId}`]
      }
    );
  }

  private async getProjectMemberRole(userId: string, projectId: string): Promise<string> {
    return databaseCache.get(
      `project_member_role:${userId}:${projectId}`,
      async () => {
        const { data, error } = await supabase
          .from('project_members')
          .select('role')
          .eq('user_id', userId)
          .eq('project_id', projectId)
          .single();

        return data?.role || 'member';
      },
      {
        ttl: 15 * 60 * 1000,
        tags: ['user', 'project', `user:${userId}`, `project:${projectId}`]
      }
    );
  }

  private async getOrganizationMemberRole(userId: string, organizationId: string): Promise<string> {
    return databaseCache.get(
      `org_member_role:${userId}:${organizationId}`,
      async () => {
        const { data, error } = await supabase
          .from('organization_members')
          .select('role')
          .eq('user_id', userId)
          .eq('organization_id', organizationId)
          .single();

        return data?.role || 'member';
      },
      {
        ttl: 15 * 60 * 1000,
        tags: ['user', 'organization', `user:${userId}`, `org:${organizationId}`]
      }
    );
  }

  private async canManageUser(adminUserId: string, targetUserId: string): Promise<boolean> {
    // Check if admin has user management permissions
    const hasManagePermission = await this.hasPermission(adminUserId, Permission.MANAGE_USERS);
    if (!hasManagePermission) {
      return false;
    }

    // Additional checks can be added here (e.g., role hierarchy)
    const adminRole = await this.getUserRole(adminUserId);
    const targetRole = await this.getUserRole(targetUserId);
    
    // Prevent lower roles from managing higher roles
    const adminLevel = this.getRoleLevel(adminRole);
    const targetLevel = this.getRoleLevel(targetRole);
    
    return adminLevel > targetLevel;
  }

  private getRolePermissions(role: UserRole): Permission[] {
    // Define role permissions (from main RBAC system)
    const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
      [UserRole.SUPER_ADMIN]: [
        // Super admin has all permissions
        ...Object.values(Permission)
      ],
      
      [UserRole.ADMIN]: [
        // User management
        Permission.MANAGE_USERS,
        Permission.VIEW_USERS,
        Permission.CREATE_USERS,
        Permission.UPDATE_USERS,
        Permission.DELETE_USERS,
        
        // Role management
        Permission.MANAGE_ROLES,
        Permission.ASSIGN_ROLES,
        Permission.VIEW_ROLES,
        
        // Organization management
        Permission.MANAGE_ORGANIZATIONS,
        Permission.VIEW_ORGANIZATIONS,
        Permission.UPDATE_ORGANIZATIONS,
        Permission.VIEW_ALL_ORGANIZATIONS,
        
        // Project management
        Permission.MANAGE_PROJECTS,
        Permission.VIEW_PROJECTS,
        Permission.CREATE_PROJECTS,
        Permission.UPDATE_PROJECTS,
        Permission.DELETE_PROJECTS,
        Permission.VIEW_ALL_PROJECTS,
        Permission.DELETE_ANY_PROJECT,
        
        // Project member management
        Permission.MANAGE_PROJECT_MEMBERS,
        Permission.ADD_PROJECT_MEMBERS,
        Permission.REMOVE_PROJECT_MEMBERS,
        Permission.UPDATE_PROJECT_MEMBERS,
        
        // QA Sessions - full access
        Permission.CREATE_QA_SESSION,
        Permission.VIEW_QA_SESSION,
        Permission.UPDATE_QA_SESSION,
        Permission.VIEW_ALL_QA_SESSIONS,
        Permission.DELETE_QA_SESSION,
        Permission.DELETE_ANY_QA_SESSION,
        
        // File management - full access
        Permission.UPLOAD_FILES,
        Permission.VIEW_FILES,
        Permission.UPDATE_FILES,
        Permission.DELETE_FILES,
        Permission.DELETE_ANY_FILES,
        Permission.VIEW_ALL_FILES,
        
        // Reports and analytics - full access
        Permission.VIEW_REPORTS,
        Permission.CREATE_REPORTS,
        Permission.UPDATE_REPORTS,
        Permission.DELETE_REPORTS,
        Permission.VIEW_ALL_REPORTS,
        Permission.EXPORT_REPORTS,
        
        // User preferences
        Permission.MANAGE_USER_PREFERENCES,
        Permission.UPDATE_USER_PREFERENCES,
        Permission.VIEW_USER_PREFERENCES,
        
        // System administration
        Permission.VIEW_SYSTEM_LOGS,
        Permission.MANAGE_SYSTEM_CONFIG,
        Permission.VIEW_AUDIT_LOGS,
        Permission.EXPORT_AUDIT_LOGS,
        
        // Billing - full access
        Permission.VIEW_BILLING,
        Permission.MANAGE_BILLING,
        Permission.UPDATE_BILLING,
        Permission.VIEW_ALL_BILLING,
        
        // API access
        Permission.ACCESS_API,
        Permission.MANAGE_API_KEYS,
        
        // Security
        Permission.MANAGE_SECURITY_SETTINGS,
        Permission.VIEW_SECURITY_LOGS
      ],
      
      [UserRole.MANAGER]: [
        // User management - limited
        Permission.VIEW_USERS,
        
        // Organization - view only
        Permission.VIEW_ORGANIZATIONS,
        
        // Project management - full for assigned projects
        Permission.VIEW_PROJECTS,
        Permission.CREATE_PROJECTS,
        Permission.UPDATE_PROJECTS,
        Permission.DELETE_PROJECTS,
        Permission.VIEW_ALL_PROJECTS,
        
        // Project member management
        Permission.MANAGE_PROJECT_MEMBERS,
        Permission.ADD_PROJECT_MEMBERS,
        Permission.REMOVE_PROJECT_MEMBERS,
        Permission.UPDATE_PROJECT_MEMBERS,
        
        // QA Sessions - view all, manage own
        Permission.CREATE_QA_SESSION,
        Permission.VIEW_QA_SESSION,
        Permission.UPDATE_QA_SESSION,
        Permission.VIEW_ALL_QA_SESSIONS,
        Permission.DELETE_QA_SESSION,
        
        // File management - standard plus view all
        Permission.UPLOAD_FILES,
        Permission.VIEW_FILES,
        Permission.UPDATE_FILES,
        Permission.DELETE_FILES,
        Permission.VIEW_ALL_FILES,
        
        // Reports - full access for oversight
        Permission.VIEW_REPORTS,
        Permission.CREATE_REPORTS,
        Permission.UPDATE_REPORTS,
        Permission.VIEW_ALL_REPORTS,
        Permission.EXPORT_REPORTS,
        
        // User preferences - own only
        Permission.UPDATE_USER_PREFERENCES,
        Permission.VIEW_USER_PREFERENCES,
        
        // Billing - view and manage
        Permission.VIEW_BILLING,
        Permission.MANAGE_BILLING,
        Permission.UPDATE_BILLING,
        Permission.VIEW_ALL_BILLING,
        
        // API access
        Permission.ACCESS_API
      ],
      
      [UserRole.QA_ANALYST]: [
        // QA Sessions - full access to own
        Permission.CREATE_QA_SESSION,
        Permission.VIEW_QA_SESSION,
        Permission.UPDATE_QA_SESSION,
        Permission.DELETE_QA_SESSION,
        
        // File management - standard access
        Permission.UPLOAD_FILES,
        Permission.VIEW_FILES,
        Permission.UPDATE_FILES,
        Permission.DELETE_FILES,
        
        // Projects - view and update assigned projects
        Permission.VIEW_PROJECTS,
        Permission.UPDATE_PROJECTS,
        
        // Reports - create, view, export own
        Permission.VIEW_REPORTS,
        Permission.CREATE_REPORTS,
        Permission.UPDATE_REPORTS,
        Permission.EXPORT_REPORTS,
        
        // User preferences - own only
        Permission.UPDATE_USER_PREFERENCES,
        Permission.VIEW_USER_PREFERENCES,
        
        // Billing - view own
        Permission.VIEW_BILLING,
        
        // API access
        Permission.ACCESS_API
      ],
      
      [UserRole.USER]: [
        // QA Sessions - basic access to own
        Permission.CREATE_QA_SESSION,
        Permission.VIEW_QA_SESSION,
        Permission.UPDATE_QA_SESSION,
        Permission.DELETE_QA_SESSION,
        
        // File management - basic access to own
        Permission.UPLOAD_FILES,
        Permission.VIEW_FILES,
        Permission.UPDATE_FILES,
        Permission.DELETE_FILES,
        
        // Projects - view assigned projects
        Permission.VIEW_PROJECTS,
        
        // Reports - view and export own
        Permission.VIEW_REPORTS,
        Permission.EXPORT_REPORTS,
        
        // User preferences - own only
        Permission.UPDATE_USER_PREFERENCES,
        Permission.VIEW_USER_PREFERENCES,
        
        // Billing - view own
        Permission.VIEW_BILLING,
        
        // API access - basic
        Permission.ACCESS_API
      ],
      
      [UserRole.GUEST]: [
        // Very limited permissions
        Permission.VIEW_QA_SESSION,
        Permission.VIEW_REPORTS,
        Permission.VIEW_PROJECTS,
        Permission.VIEW_USER_PREFERENCES
      ]
    };

    // Role hierarchy (lower roles inherit from higher roles when appropriate)
    const ROLE_HIERARCHY: Record<UserRole, number> = {
      [UserRole.SUPER_ADMIN]: 100,
      [UserRole.ADMIN]: 80,
      [UserRole.MANAGER]: 60,
      [UserRole.QA_ANALYST]: 40,
      [UserRole.USER]: 20,
      [UserRole.GUEST]: 10
    };

    return ROLE_PERMISSIONS[role] || [];
  }

  private getProjectRolePermissions(role: string): Permission[] {
    // Project-specific role permissions
    const PROJECT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
      'admin': [
        Permission.VIEW_PROJECTS,
        Permission.UPDATE_PROJECTS,
        Permission.DELETE_PROJECTS,
        Permission.MANAGE_PROJECT_MEMBERS,
      ],
      'manager': [
        Permission.VIEW_PROJECTS,
        Permission.UPDATE_PROJECTS,
        Permission.MANAGE_PROJECT_MEMBERS,
      ],
      'member': [
        Permission.VIEW_PROJECTS,
        Permission.CREATE_QA_SESSION,
        Permission.VIEW_QA_SESSION,
      ]
    };

    return PROJECT_ROLE_PERMISSIONS[role] || [];
  }

  private getOrganizationRolePermissions(role: string): Permission[] {
    // Organization-specific role permissions
    const ORG_ROLE_PERMISSIONS: Record<string, Permission[]> = {
      'admin': [
        Permission.VIEW_ORGANIZATIONS,
        Permission.UPDATE_ORGANIZATIONS,
        Permission.MANAGE_USERS,
        Permission.MANAGE_PROJECTS,
      ],
      'manager': [
        Permission.VIEW_ORGANIZATIONS,
        Permission.VIEW_PROJECTS,
        Permission.CREATE_PROJECTS,
      ],
      'member': [
        Permission.VIEW_ORGANIZATIONS,
        Permission.VIEW_PROJECTS,
      ]
    };

    return ORG_ROLE_PERMISSIONS[role] || [];
  }

  private getRoleLevel(role: UserRole): number {
    const ROLE_LEVELS: Record<UserRole, number> = {
      [UserRole.SUPER_ADMIN]: 100,
      [UserRole.ADMIN]: 80,
      [UserRole.MANAGER]: 60,
      [UserRole.QA_ANALYST]: 40,
      [UserRole.USER]: 20,
      [UserRole.GUEST]: 10
    };

    return ROLE_LEVELS[role] || 0;
  }
}

// Create and export singleton instance
export const cachedRBACService = CachedRBACService.getInstance(); 