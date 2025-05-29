import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';

// Define system roles
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  MANAGER = 'manager', 
  QA_ANALYST = 'qa_analyst',
  USER = 'user',
  GUEST = 'guest'
}

// Define system permissions
export enum Permission {
  // User management
  MANAGE_USERS = 'manage_users',
  VIEW_USERS = 'view_users',
  DELETE_USERS = 'delete_users',
  
  // Role management
  MANAGE_ROLES = 'manage_roles',
  ASSIGN_ROLES = 'assign_roles',
  
  // QA Sessions
  CREATE_QA_SESSION = 'create_qa_session',
  VIEW_QA_SESSION = 'view_qa_session',
  VIEW_ALL_QA_SESSIONS = 'view_all_qa_sessions',
  DELETE_QA_SESSION = 'delete_qa_session',
  DELETE_ANY_QA_SESSION = 'delete_any_qa_session',
  
  // File management
  UPLOAD_FILES = 'upload_files',
  DELETE_FILES = 'delete_files',
  DELETE_ANY_FILES = 'delete_any_files',
  
  // Reports and analytics
  VIEW_REPORTS = 'view_reports',
  VIEW_ALL_REPORTS = 'view_all_reports',
  EXPORT_REPORTS = 'export_reports',
  
  // System administration
  VIEW_SYSTEM_LOGS = 'view_system_logs',
  MANAGE_SYSTEM_CONFIG = 'manage_system_config',
  
  // Billing and subscription
  VIEW_BILLING = 'view_billing',
  MANAGE_BILLING = 'manage_billing',
  VIEW_ALL_BILLING = 'view_all_billing'
}

// Role permission mapping
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.SUPER_ADMIN]: [
    // Super admin has all permissions
    ...Object.values(Permission)
  ],
  
  [UserRole.ADMIN]: [
    Permission.MANAGE_USERS,
    Permission.VIEW_USERS,
    Permission.ASSIGN_ROLES,
    Permission.VIEW_ALL_QA_SESSIONS,
    Permission.DELETE_ANY_QA_SESSION,
    Permission.DELETE_ANY_FILES,
    Permission.VIEW_ALL_REPORTS,
    Permission.EXPORT_REPORTS,
    Permission.VIEW_SYSTEM_LOGS,
    Permission.MANAGE_SYSTEM_CONFIG,
    Permission.VIEW_ALL_BILLING,
    Permission.MANAGE_BILLING,
    // Include all regular user permissions
    Permission.CREATE_QA_SESSION,
    Permission.VIEW_QA_SESSION,
    Permission.DELETE_QA_SESSION,
    Permission.UPLOAD_FILES,
    Permission.DELETE_FILES,
    Permission.VIEW_REPORTS,
    Permission.VIEW_BILLING
  ],
  
  [UserRole.MANAGER]: [
    Permission.VIEW_USERS,
    Permission.VIEW_ALL_QA_SESSIONS,
    Permission.VIEW_ALL_REPORTS,
    Permission.EXPORT_REPORTS,
    Permission.MANAGE_BILLING,
    // Include standard user permissions
    Permission.CREATE_QA_SESSION,
    Permission.VIEW_QA_SESSION,
    Permission.DELETE_QA_SESSION,
    Permission.UPLOAD_FILES,
    Permission.DELETE_FILES,
    Permission.VIEW_REPORTS,
    Permission.VIEW_BILLING
  ],
  
  [UserRole.QA_ANALYST]: [
    Permission.CREATE_QA_SESSION,
    Permission.VIEW_QA_SESSION,
    Permission.DELETE_QA_SESSION,
    Permission.UPLOAD_FILES,
    Permission.DELETE_FILES,
    Permission.VIEW_REPORTS,
    Permission.EXPORT_REPORTS,
    Permission.VIEW_BILLING
  ],
  
  [UserRole.USER]: [
    Permission.CREATE_QA_SESSION,
    Permission.VIEW_QA_SESSION,
    Permission.DELETE_QA_SESSION,
    Permission.UPLOAD_FILES,
    Permission.DELETE_FILES,
    Permission.VIEW_REPORTS,
    Permission.VIEW_BILLING
  ],
  
  [UserRole.GUEST]: [
    // Guests have very limited permissions
    Permission.VIEW_QA_SESSION,
    Permission.VIEW_REPORTS
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

interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  full_name?: string;
  phone?: string;
  bio?: string;
  created_at: string;
  updated_at: string;
}

class RBACService {
  private userProfileCache: Map<string, UserProfile> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Get user profile with role information
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    // Check cache first
    const cached = this.userProfileCache.get(userId);
    const expiry = this.cacheExpiry.get(userId);
    
    if (cached && expiry && Date.now() < expiry) {
      return cached;
    }

    // Fetch from database
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, role, full_name, phone, bio, created_at, updated_at')
      .eq('id', userId)
      .single();

    if (error || !data) {
      console.error('Error fetching user profile:', error);
      return null;
    }

    const profile: UserProfile = {
      ...data,
      role: data.role as UserRole || UserRole.USER
    };

    // Cache the result
    this.userProfileCache.set(userId, profile);
    this.cacheExpiry.set(userId, Date.now() + this.CACHE_DURATION);

    return profile;
  }

  /**
   * Get user role
   */
  async getUserRole(userId: string): Promise<UserRole> {
    const profile = await this.getUserProfile(userId);
    return profile?.role || UserRole.USER;
  }

  /**
   * Check if user has specific permission
   */
  async hasPermission(userId: string, permission: Permission): Promise<boolean> {
    const userRole = await this.getUserRole(userId);
    const rolePermissions = ROLE_PERMISSIONS[userRole] || [];
    return rolePermissions.includes(permission);
  }

  /**
   * Check if user has any of the specified permissions
   */
  async hasAnyPermission(userId: string, permissions: Permission[]): Promise<boolean> {
    const userRole = await this.getUserRole(userId);
    const rolePermissions = ROLE_PERMISSIONS[userRole] || [];
    return permissions.some(permission => rolePermissions.includes(permission));
  }

  /**
   * Check if user has all of the specified permissions
   */
  async hasAllPermissions(userId: string, permissions: Permission[]): Promise<boolean> {
    const userRole = await this.getUserRole(userId);
    const rolePermissions = ROLE_PERMISSIONS[userRole] || [];
    return permissions.every(permission => rolePermissions.includes(permission));
  }

  /**
   * Get all permissions for a user
   */
  async getUserPermissions(userId: string): Promise<Permission[]> {
    const userRole = await this.getUserRole(userId);
    return ROLE_PERMISSIONS[userRole] || [];
  }

  /**
   * Check if user can access resource owned by another user
   */
  async canAccessResource(userId: string, resourceOwnerId: string, permission: Permission): Promise<boolean> {
    // Users can always access their own resources if they have the permission
    if (userId === resourceOwnerId) {
      return await this.hasPermission(userId, permission);
    }

    // Check if user has elevated permissions to access others' resources
    const elevatedPermissions = this.getElevatedPermissions(permission);
    return await this.hasAnyPermission(userId, elevatedPermissions);
  }

  /**
   * Get elevated permissions for cross-user resource access
   */
  private getElevatedPermissions(basePermission: Permission): Permission[] {
    const permissionMap: Partial<Record<Permission, Permission[]>> = {
      [Permission.VIEW_QA_SESSION]: [Permission.VIEW_ALL_QA_SESSIONS],
      [Permission.DELETE_QA_SESSION]: [Permission.DELETE_ANY_QA_SESSION],
      [Permission.DELETE_FILES]: [Permission.DELETE_ANY_FILES],
      [Permission.VIEW_REPORTS]: [Permission.VIEW_ALL_REPORTS],
      [Permission.VIEW_BILLING]: [Permission.VIEW_ALL_BILLING],
    };

    return permissionMap[basePermission] || [];
  }

  /**
   * Update user role (admin only)
   */
  async updateUserRole(adminUserId: string, targetUserId: string, newRole: UserRole): Promise<{ success: boolean; error?: string }> {
    // Check if admin has permission to manage roles
    const canManageRoles = await this.hasPermission(adminUserId, Permission.MANAGE_ROLES);
    if (!canManageRoles) {
      return { success: false, error: 'Insufficient permissions to manage roles' };
    }

    // Prevent role elevation above admin's level (except super admin)
    const adminRole = await this.getUserRole(adminUserId);
    const adminLevel = ROLE_HIERARCHY[adminRole];
    const newRoleLevel = ROLE_HIERARCHY[newRole];

    if (adminRole !== UserRole.SUPER_ADMIN && newRoleLevel >= adminLevel) {
      return { success: false, error: 'Cannot assign role equal to or higher than your own' };
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', targetUserId);

      if (error) {
        console.error('Error updating user role:', error);
        return { success: false, error: 'Failed to update user role' };
      }

      // Clear cache for updated user
      this.userProfileCache.delete(targetUserId);
      this.cacheExpiry.delete(targetUserId);

      return { success: true };
    } catch (error) {
      console.error('Unexpected error updating user role:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  /**
   * Get all users with their roles (admin only)
   */
  async getAllUsers(adminUserId: string): Promise<{ success: boolean; users?: UserProfile[]; error?: string }> {
    const canViewUsers = await this.hasPermission(adminUserId, Permission.VIEW_USERS);
    if (!canViewUsers) {
      return { success: false, error: 'Insufficient permissions to view users' };
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, role, full_name, phone, bio, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching users:', error);
        return { success: false, error: 'Failed to fetch users' };
      }

      const users: UserProfile[] = data.map(user => ({
        ...user,
        role: user.role as UserRole || UserRole.USER
      }));

      return { success: true, users };
    } catch (error) {
      console.error('Unexpected error fetching users:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  /**
   * Check if user can perform action on another user
   */
  async canManageUser(adminUserId: string, targetUserId: string): Promise<boolean> {
    // Users cannot manage themselves through admin actions
    if (adminUserId === targetUserId) {
      return false;
    }

    // Check if admin has user management permissions
    const canManageUsers = await this.hasPermission(adminUserId, Permission.MANAGE_USERS);
    if (!canManageUsers) {
      return false;
    }

    // Check role hierarchy - admins cannot manage users of equal or higher level
    const adminRole = await this.getUserRole(adminUserId);
    const targetRole = await this.getUserRole(targetUserId);
    const adminLevel = ROLE_HIERARCHY[adminRole];
    const targetLevel = ROLE_HIERARCHY[targetRole];

    // Super admin can manage anyone
    if (adminRole === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Others cannot manage users of equal or higher level
    return adminLevel > targetLevel;
  }

  /**
   * Clear user cache
   */
  clearUserCache(userId?: string): void {
    if (userId) {
      this.userProfileCache.delete(userId);
      this.cacheExpiry.delete(userId);
    } else {
      this.userProfileCache.clear();
      this.cacheExpiry.clear();
    }
  }

  /**
   * Get role display name
   */
  getRoleDisplayName(role: UserRole): string {
    const roleNames: Record<UserRole, string> = {
      [UserRole.SUPER_ADMIN]: 'Super Administrator',
      [UserRole.ADMIN]: 'Administrator',
      [UserRole.MANAGER]: 'Manager',
      [UserRole.QA_ANALYST]: 'QA Analyst',
      [UserRole.USER]: 'User',
      [UserRole.GUEST]: 'Guest'
    };

    return roleNames[role] || 'Unknown';
  }

  /**
   * Get role hierarchy level
   */
  getRoleLevel(role: UserRole): number {
    return ROLE_HIERARCHY[role] || 0;
  }

  /**
   * Get available roles that a user can assign
   */
  async getAssignableRoles(adminUserId: string): Promise<UserRole[]> {
    const adminRole = await this.getUserRole(adminUserId);
    const adminLevel = ROLE_HIERARCHY[adminRole];

    // Super admin can assign any role
    if (adminRole === UserRole.SUPER_ADMIN) {
      return Object.values(UserRole);
    }

    // Others can only assign roles below their level
    return Object.entries(ROLE_HIERARCHY)
      .filter(([_, level]) => level < adminLevel)
      .map(([role, _]) => role as UserRole);
  }
}

// Create and export singleton instance
export const rbacService = new RBACService();

// Export types and enums
export type { UserProfile };
export { ROLE_PERMISSIONS, ROLE_HIERARCHY }; 