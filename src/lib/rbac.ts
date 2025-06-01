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
      // QA Sessions
      [Permission.VIEW_QA_SESSION]: [Permission.VIEW_ALL_QA_SESSIONS],
      [Permission.UPDATE_QA_SESSION]: [Permission.VIEW_ALL_QA_SESSIONS, Permission.MANAGE_PROJECTS],
      [Permission.DELETE_QA_SESSION]: [Permission.DELETE_ANY_QA_SESSION],
      
      // Files
      [Permission.VIEW_FILES]: [Permission.VIEW_ALL_FILES],
      [Permission.UPDATE_FILES]: [Permission.VIEW_ALL_FILES, Permission.MANAGE_PROJECTS],
      [Permission.DELETE_FILES]: [Permission.DELETE_ANY_FILES],
      
      // Reports
      [Permission.VIEW_REPORTS]: [Permission.VIEW_ALL_REPORTS],
      [Permission.CREATE_REPORTS]: [Permission.VIEW_ALL_REPORTS, Permission.MANAGE_PROJECTS],
      [Permission.UPDATE_REPORTS]: [Permission.VIEW_ALL_REPORTS, Permission.MANAGE_PROJECTS],
      [Permission.DELETE_REPORTS]: [Permission.VIEW_ALL_REPORTS, Permission.MANAGE_PROJECTS],
      
      // Projects
      [Permission.VIEW_PROJECTS]: [Permission.VIEW_ALL_PROJECTS, Permission.MANAGE_PROJECTS],
      [Permission.UPDATE_PROJECTS]: [Permission.MANAGE_PROJECTS],
      [Permission.DELETE_PROJECTS]: [Permission.DELETE_ANY_PROJECT, Permission.MANAGE_PROJECTS],
      
      // Users
      [Permission.VIEW_USERS]: [Permission.MANAGE_USERS],
      [Permission.UPDATE_USERS]: [Permission.MANAGE_USERS],
      [Permission.DELETE_USERS]: [Permission.MANAGE_USERS],
      
      // Organizations
      [Permission.VIEW_ORGANIZATIONS]: [Permission.VIEW_ALL_ORGANIZATIONS, Permission.MANAGE_ORGANIZATIONS],
      [Permission.UPDATE_ORGANIZATIONS]: [Permission.MANAGE_ORGANIZATIONS],
      [Permission.DELETE_ORGANIZATIONS]: [Permission.MANAGE_ORGANIZATIONS],
      
      // Billing
      [Permission.VIEW_BILLING]: [Permission.VIEW_ALL_BILLING, Permission.MANAGE_BILLING],
      [Permission.UPDATE_BILLING]: [Permission.MANAGE_BILLING],
      
      // User Preferences
      [Permission.VIEW_USER_PREFERENCES]: [Permission.MANAGE_USER_PREFERENCES],
      [Permission.UPDATE_USER_PREFERENCES]: [Permission.MANAGE_USER_PREFERENCES],
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

  /**
   * Check if user has permission for a specific resource within a project context
   */
  async hasProjectPermission(
    userId: string, 
    projectId: string, 
    permission: Permission
  ): Promise<boolean> {
    // First check if user has the basic permission
    const hasBasicPermission = await this.hasPermission(userId, permission);
    if (!hasBasicPermission) {
      return false;
    }

    // For project-specific resources, check if user has access to the project
    const projectPermissions = [
      Permission.VIEW_PROJECTS,
      Permission.UPDATE_PROJECTS,
      Permission.DELETE_PROJECTS,
      Permission.MANAGE_PROJECT_MEMBERS,
      Permission.ADD_PROJECT_MEMBERS,
      Permission.REMOVE_PROJECT_MEMBERS,
      Permission.UPDATE_PROJECT_MEMBERS
    ];

    if (projectPermissions.includes(permission)) {
      // Check if user is a project member or has elevated access
      return await this.isProjectMember(userId, projectId) || 
             await this.hasAnyPermission(userId, [
               Permission.VIEW_ALL_PROJECTS, 
               Permission.MANAGE_PROJECTS
             ]);
    }

    return true;
  }

  /**
   * Check if user has permission for a specific resource within an organization context
   */
  async hasOrganizationPermission(
    userId: string, 
    organizationId: string, 
    permission: Permission
  ): Promise<boolean> {
    // First check if user has the basic permission
    const hasBasicPermission = await this.hasPermission(userId, permission);
    if (!hasBasicPermission) {
      return false;
    }

    // Check if user belongs to the organization
    const userProfile = await this.getUserProfile(userId);
    if (userProfile?.organization_id === organizationId) {
      return true;
    }

    // Check if user has elevated organization permissions
    return await this.hasAnyPermission(userId, [
      Permission.VIEW_ALL_ORGANIZATIONS,
      Permission.MANAGE_ORGANIZATIONS
    ]);
  }

  /**
   * Check if user is a member of a specific project
   */
  private async isProjectMember(userId: string, projectId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('project_members')
        .select('id')
        .eq('user_id', userId)
        .eq('project_id', projectId)
        .eq('status', 'active')
        .single();

      return !error && !!data;
    } catch {
      return false;
    }
  }

  /**
   * Get user's effective permissions for a specific resource context
   */
  async getContextualPermissions(
    userId: string, 
    context: {
      type: 'project' | 'organization' | 'global';
      resourceId?: string;
    }
  ): Promise<Permission[]> {
    const basePermissions = await this.getUserPermissions(userId);
    
    if (context.type === 'global' || !context.resourceId) {
      return basePermissions;
    }

    // Filter permissions based on context
    const contextualPermissions: Permission[] = [];
    
    for (const permission of basePermissions) {
      let hasContextualAccess = false;
      
      if (context.type === 'project') {
        hasContextualAccess = await this.hasProjectPermission(userId, context.resourceId, permission);
      } else if (context.type === 'organization') {
        hasContextualAccess = await this.hasOrganizationPermission(userId, context.resourceId, permission);
      }
      
      if (hasContextualAccess) {
        contextualPermissions.push(permission);
      }
    }
    
    return contextualPermissions;
  }

  /**
   * Check resource ownership and permission inheritance
   */
  async canModifyResource(
    userId: string,
    resourceType: 'qa_session' | 'file' | 'project' | 'report',
    resourceId: string,
    action: 'view' | 'update' | 'delete'
  ): Promise<boolean> {
    // Define permission mappings for each resource type and action
    const permissionMap: Record<string, Record<string, Permission[]>> = {
      qa_session: {
        view: [Permission.VIEW_QA_SESSION, Permission.VIEW_ALL_QA_SESSIONS],
        update: [Permission.UPDATE_QA_SESSION, Permission.VIEW_ALL_QA_SESSIONS],
        delete: [Permission.DELETE_QA_SESSION, Permission.DELETE_ANY_QA_SESSION]
      },
      file: {
        view: [Permission.VIEW_FILES, Permission.VIEW_ALL_FILES],
        update: [Permission.UPDATE_FILES, Permission.VIEW_ALL_FILES],
        delete: [Permission.DELETE_FILES, Permission.DELETE_ANY_FILES]
      },
      project: {
        view: [Permission.VIEW_PROJECTS, Permission.VIEW_ALL_PROJECTS],
        update: [Permission.UPDATE_PROJECTS, Permission.MANAGE_PROJECTS],
        delete: [Permission.DELETE_PROJECTS, Permission.DELETE_ANY_PROJECT]
      },
      report: {
        view: [Permission.VIEW_REPORTS, Permission.VIEW_ALL_REPORTS],
        update: [Permission.UPDATE_REPORTS, Permission.VIEW_ALL_REPORTS],
        delete: [Permission.DELETE_REPORTS, Permission.VIEW_ALL_REPORTS]
      }
    };

    const requiredPermissions = permissionMap[resourceType]?.[action];
    if (!requiredPermissions) {
      return false;
    }

    // Check if user has any of the required permissions
    return await this.hasAnyPermission(userId, requiredPermissions);
  }

  /**
   * Validate permission hierarchy and resolve conflicts
   */
  async resolvePermissionConflicts(
    userId: string,
    requestedPermissions: Permission[]
  ): Promise<{
    granted: Permission[];
    denied: Permission[];
    conflicts: Array<{ permission: Permission; reason: string }>;
  }> {
    const userPermissions = await this.getUserPermissions(userId);
    const granted: Permission[] = [];
    const denied: Permission[] = [];
    const conflicts: Array<{ permission: Permission; reason: string }> = [];

    for (const permission of requestedPermissions) {
      if (userPermissions.includes(permission)) {
        granted.push(permission);
      } else {
        // Check for elevated permissions
        const elevatedPermissions = this.getElevatedPermissions(permission);
        const hasElevated = elevatedPermissions.some(ep => userPermissions.includes(ep));
        
        if (hasElevated) {
          granted.push(permission);
        } else {
          denied.push(permission);
          conflicts.push({
            permission,
            reason: `Insufficient permissions. Required: ${permission}, User role: ${await this.getUserRole(userId)}`
          });
        }
      }
    }

    return { granted, denied, conflicts };
  }
}

// Create and export singleton instance
export const rbacService = new RBACService();

// Permission matrix for better understanding of resource-action-permission relationships
export const PERMISSION_MATRIX = {
  // User management
  users: {
    create: [Permission.CREATE_USERS, Permission.MANAGE_USERS],
    read: [Permission.VIEW_USERS, Permission.MANAGE_USERS],
    update: [Permission.UPDATE_USERS, Permission.MANAGE_USERS], 
    delete: [Permission.DELETE_USERS, Permission.MANAGE_USERS],
    manage: [Permission.MANAGE_USERS]
  },
  
  // Organization management
  organizations: {
    create: [Permission.CREATE_ORGANIZATIONS, Permission.MANAGE_ORGANIZATIONS],
    read: [Permission.VIEW_ORGANIZATIONS, Permission.VIEW_ALL_ORGANIZATIONS, Permission.MANAGE_ORGANIZATIONS],
    update: [Permission.UPDATE_ORGANIZATIONS, Permission.MANAGE_ORGANIZATIONS],
    delete: [Permission.DELETE_ORGANIZATIONS, Permission.MANAGE_ORGANIZATIONS],
    manage: [Permission.MANAGE_ORGANIZATIONS]
  },
  
  // Project management
  projects: {
    create: [Permission.CREATE_PROJECTS, Permission.MANAGE_PROJECTS],
    read: [Permission.VIEW_PROJECTS, Permission.VIEW_ALL_PROJECTS, Permission.MANAGE_PROJECTS],
    update: [Permission.UPDATE_PROJECTS, Permission.MANAGE_PROJECTS],
    delete: [Permission.DELETE_PROJECTS, Permission.DELETE_ANY_PROJECT, Permission.MANAGE_PROJECTS],
    manage: [Permission.MANAGE_PROJECTS],
    managemembers: [Permission.MANAGE_PROJECT_MEMBERS, Permission.MANAGE_PROJECTS]
  },
  
  // QA Session management
  qa_sessions: {
    create: [Permission.CREATE_QA_SESSION],
    read: [Permission.VIEW_QA_SESSION, Permission.VIEW_ALL_QA_SESSIONS],
    update: [Permission.UPDATE_QA_SESSION, Permission.VIEW_ALL_QA_SESSIONS],
    delete: [Permission.DELETE_QA_SESSION, Permission.DELETE_ANY_QA_SESSION]
  },
  
  // File management
  files: {
    create: [Permission.UPLOAD_FILES],
    read: [Permission.VIEW_FILES, Permission.VIEW_ALL_FILES],
    update: [Permission.UPDATE_FILES, Permission.VIEW_ALL_FILES],
    delete: [Permission.DELETE_FILES, Permission.DELETE_ANY_FILES]
  },
  
  // Report management
  reports: {
    create: [Permission.CREATE_REPORTS],
    read: [Permission.VIEW_REPORTS, Permission.VIEW_ALL_REPORTS],
    update: [Permission.UPDATE_REPORTS, Permission.VIEW_ALL_REPORTS],
    delete: [Permission.DELETE_REPORTS, Permission.VIEW_ALL_REPORTS],
    export: [Permission.EXPORT_REPORTS]
  },
  
  // Role management
  roles: {
    read: [Permission.VIEW_ROLES, Permission.MANAGE_ROLES],
    assign: [Permission.ASSIGN_ROLES, Permission.MANAGE_ROLES],
    manage: [Permission.MANAGE_ROLES]
  },
  
  // Billing management
  billing: {
    read: [Permission.VIEW_BILLING, Permission.VIEW_ALL_BILLING, Permission.MANAGE_BILLING],
    update: [Permission.UPDATE_BILLING, Permission.MANAGE_BILLING],
    manage: [Permission.MANAGE_BILLING]
  },
  
  // System administration
  system: {
    logs: [Permission.VIEW_SYSTEM_LOGS, Permission.VIEW_AUDIT_LOGS],
    config: [Permission.MANAGE_SYSTEM_CONFIG],
    security: [Permission.MANAGE_SECURITY_SETTINGS, Permission.VIEW_SECURITY_LOGS]
  },
  
  // API access
  api: {
    access: [Permission.ACCESS_API],
    manage: [Permission.MANAGE_API_KEYS]
  }
} as const;

// Resource ownership patterns for determining who owns what
export const RESOURCE_OWNERSHIP = {
  qa_sessions: {
    ownerField: 'user_id',
    table: 'qa_sessions',
    projectField: 'project_id'
  },
  files: {
    ownerField: 'user_id', 
    table: 'file_uploads',
    sessionField: 'session_id'
  },
  projects: {
    ownerField: 'created_by',
    table: 'projects',
    organizationField: 'organization_id'
  },
  reports: {
    ownerField: 'created_by',
    table: 'reports',
    projectField: 'project_id'
  }
} as const;

// Helper function to get required permissions for resource action
export function getRequiredPermissions(
  resource: keyof typeof PERMISSION_MATRIX,
  action: string
): Permission[] {
  const resourcePermissions = PERMISSION_MATRIX[resource] as any;
  return resourcePermissions[action] ? [...resourcePermissions[action]] : [];
}

// Helper function to check if a permission grants access to a resource action
export function hasRequiredPermission(
  userPermissions: Permission[],
  resource: keyof typeof PERMISSION_MATRIX,
  action: string
): boolean {
  const requiredPermissions = getRequiredPermissions(resource, action);
  return requiredPermissions.some(permission => userPermissions.includes(permission));
}

// Export types and enums
export type { UserProfile };
export { ROLE_PERMISSIONS, ROLE_HIERARCHY }; 