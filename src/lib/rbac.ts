import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';
import { UserRole, UserProfile, UserStatus, Permission } from './types/user';

// Export the enums and types we need
export { UserRole, UserStatus, Permission } from './types/user';

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

    // Fetch from database with all required fields
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id, email, full_name, first_name, last_name, display_name, avatar_url, phone, bio,
        role, organization_id, department, job_title, manager_id,
        status, is_verified, email_verified_at, last_login_at, last_activity_at, login_count,
        password_changed_at, two_factor_enabled, backup_codes_generated_at, 
        failed_login_attempts, locked_until,
        timezone, locale, date_format, time_format,
        user_agent, ip_address, signup_source, referral_code, marketing_consent,
        created_at, updated_at, created_by, updated_by
      `)
      .eq('id', userId)
      .single();

    if (error || !data) {
      console.error('Error fetching user profile:', error);
      return null;
    }

    const profile: UserProfile = {
      id: data.id,
      email: data.email,
      full_name: data.full_name || undefined,
      first_name: data.first_name || undefined,
      last_name: data.last_name || undefined,
      display_name: data.display_name || undefined,
      avatar_url: data.avatar_url || undefined,
      phone: data.phone || undefined,
      bio: data.bio || undefined,
      
      // Role and permissions
      role: (data.role as UserRole) || UserRole.USER,
      
      // Organization and team structure
      organization_id: data.organization_id || undefined,
      department: data.department || undefined,
      job_title: data.job_title || undefined,
      manager_id: data.manager_id || undefined,
      
      // User status and activity
      status: (data.status as UserStatus) || UserStatus.ACTIVE,
      is_verified: data.is_verified || false,
      email_verified_at: data.email_verified_at || undefined,
      last_login_at: data.last_login_at || undefined,
      last_activity_at: data.last_activity_at || undefined,
      login_count: data.login_count || 0,
      
      // Security fields
      password_changed_at: data.password_changed_at || undefined,
      two_factor_enabled: data.two_factor_enabled || false,
      backup_codes_generated_at: data.backup_codes_generated_at || undefined,
      failed_login_attempts: data.failed_login_attempts || 0,
      locked_until: data.locked_until || undefined,
      
      // User preferences
      timezone: data.timezone || 'UTC',
      locale: data.locale || 'en-US',
      date_format: data.date_format || 'yyyy-MM-dd',
      time_format: data.time_format || '24h',
      
      // Metadata
      user_agent: data.user_agent || undefined,
      ip_address: data.ip_address || undefined,
      signup_source: data.signup_source || undefined,
      referral_code: data.referral_code || undefined,
      marketing_consent: data.marketing_consent || false,
      
      // Audit fields
      created_at: data.created_at,
      updated_at: data.updated_at,
      created_by: data.created_by || undefined,
      updated_by: data.updated_by || undefined
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
        .select(`
          id, email, full_name, first_name, last_name, display_name, avatar_url, phone, bio,
          role, organization_id, department, job_title, manager_id,
          status, is_verified, email_verified_at, last_login_at, last_activity_at, login_count,
          password_changed_at, two_factor_enabled, backup_codes_generated_at, 
          failed_login_attempts, locked_until,
          timezone, locale, date_format, time_format,
          user_agent, ip_address, signup_source, referral_code, marketing_consent,
          created_at, updated_at, created_by, updated_by
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching users:', error);
        return { success: false, error: 'Failed to fetch users' };
      }

      const users: UserProfile[] = data.map(user => ({
        id: user.id,
        email: user.email,
        full_name: user.full_name || undefined,
        first_name: user.first_name || undefined,
        last_name: user.last_name || undefined,
        display_name: user.display_name || undefined,
        avatar_url: user.avatar_url || undefined,
        phone: user.phone || undefined,
        bio: user.bio || undefined,
        
        // Role and permissions
        role: (user.role as UserRole) || UserRole.USER,
        
        // Organization and team structure
        organization_id: user.organization_id || undefined,
        department: user.department || undefined,
        job_title: user.job_title || undefined,
        manager_id: user.manager_id || undefined,
        
        // User status and activity
        status: (user.status as UserStatus) || UserStatus.ACTIVE,
        is_verified: user.is_verified || false,
        email_verified_at: user.email_verified_at || undefined,
        last_login_at: user.last_login_at || undefined,
        last_activity_at: user.last_activity_at || undefined,
        login_count: user.login_count || 0,
        
        // Security fields
        password_changed_at: user.password_changed_at || undefined,
        two_factor_enabled: user.two_factor_enabled || false,
        backup_codes_generated_at: user.backup_codes_generated_at || undefined,
        failed_login_attempts: user.failed_login_attempts || 0,
        locked_until: user.locked_until || undefined,
        
        // User preferences
        timezone: user.timezone || 'UTC',
        locale: user.locale || 'en-US',
        date_format: user.date_format || 'yyyy-MM-dd',
        time_format: user.time_format || '24h',
        
        // Metadata
        user_agent: user.user_agent || undefined,
        ip_address: user.ip_address || undefined,
        signup_source: user.signup_source || undefined,
        referral_code: user.referral_code || undefined,
        marketing_consent: user.marketing_consent || false,
        
        // Audit fields
        created_at: user.created_at,
        updated_at: user.updated_at,
        created_by: user.created_by || undefined,
        updated_by: user.updated_by || undefined
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