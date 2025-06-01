import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { 
  rbacService, 
  UserRole, 
  Permission, 
  type UserProfile,
  PERMISSION_MATRIX,
  hasRequiredPermission,
  getRequiredPermissions
} from '@/lib/rbac';

interface RBACState {
  userProfile: UserProfile | null;
  userRole: UserRole;
  permissions: Permission[];
  loading: boolean;
  error: string | null;
}

interface RBACHookReturn extends RBACState {
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
  canAccessResource: (resourceOwnerId: string, permission: Permission) => Promise<boolean>;
  canManageUser: (targetUserId: string) => Promise<boolean>;
  updateUserRole: (targetUserId: string, newRole: UserRole) => Promise<{ success: boolean; error?: string }>;
  getAllUsers: () => Promise<{ success: boolean; users?: UserProfile[]; error?: string }>;
  getRoleDisplayName: (role?: UserRole) => string;
  getAssignableRoles: () => Promise<UserRole[]>;
  refreshUserProfile: () => Promise<void>;
  clearCache: () => void;
  
  // Enhanced permission methods
  hasProjectPermission: (projectId: string, permission: Permission) => Promise<boolean>;
  hasOrganizationPermission: (organizationId: string, permission: Permission) => Promise<boolean>;
  getContextualPermissions: (context: { type: 'project' | 'organization' | 'global'; resourceId?: string }) => Promise<Permission[]>;
  canModifyResource: (resourceType: 'qa_session' | 'file' | 'project' | 'report', resourceId: string, action: 'view' | 'update' | 'delete') => Promise<boolean>;
  resolvePermissionConflicts: (requestedPermissions: Permission[]) => Promise<{ granted: Permission[]; denied: Permission[]; conflicts: Array<{ permission: Permission; reason: string }> }>;
  
  // Permission matrix helpers
  hasResourcePermission: (resource: keyof typeof PERMISSION_MATRIX, action: string) => boolean;
  getRequiredPermissionsForAction: (resource: keyof typeof PERMISSION_MATRIX, action: string) => Permission[];
}

export const useRBAC = (): RBACHookReturn => {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<RBACState>({
    userProfile: null,
    userRole: UserRole.USER,
    permissions: [],
    loading: true,
    error: null
  });

  // Load user profile and permissions
  const loadUserProfile = useCallback(async () => {
    if (!user?.id || !isAuthenticated) {
      setState({
        userProfile: null,
        userRole: UserRole.USER,
        permissions: [],
        loading: false,
        error: null
      });
      return;
    }

    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const [userProfile, permissions] = await Promise.all([
        rbacService.getUserProfile(user.id),
        rbacService.getUserPermissions(user.id)
      ]);

      setState({
        userProfile,
        userRole: userProfile?.role || UserRole.USER,
        permissions,
        loading: false,
        error: null
      });
    } catch (error) {
      console.error('Error loading user profile:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to load user profile'
      }));
    }
  }, [user?.id, isAuthenticated]);

  // Load profile when user changes
  useEffect(() => {
    loadUserProfile();
  }, [loadUserProfile]);

  // Permission checking functions
  const hasPermission = useCallback((permission: Permission): boolean => {
    return state.permissions.includes(permission);
  }, [state.permissions]);

  const hasAnyPermission = useCallback((permissions: Permission[]): boolean => {
    return permissions.some(permission => state.permissions.includes(permission));
  }, [state.permissions]);

  const hasAllPermissions = useCallback((permissions: Permission[]): boolean => {
    return permissions.every(permission => state.permissions.includes(permission));
  }, [state.permissions]);

  // Resource access checking
  const canAccessResource = useCallback(async (resourceOwnerId: string, permission: Permission): Promise<boolean> => {
    if (!user?.id) return false;
    return await rbacService.canAccessResource(user.id, resourceOwnerId, permission);
  }, [user?.id]);

  // User management functions
  const canManageUser = useCallback(async (targetUserId: string): Promise<boolean> => {
    if (!user?.id) return false;
    return await rbacService.canManageUser(user.id, targetUserId);
  }, [user?.id]);

  const updateUserRole = useCallback(async (targetUserId: string, newRole: UserRole): Promise<{ success: boolean; error?: string }> => {
    if (!user?.id) return { success: false, error: 'Not authenticated' };
    
    const result = await rbacService.updateUserRole(user.id, targetUserId, newRole);
    
    // Refresh our own profile if we updated ourselves (shouldn't happen but just in case)
    if (result.success && targetUserId === user.id) {
      await loadUserProfile();
    }
    
    return result;
  }, [user?.id, loadUserProfile]);

  const getAllUsers = useCallback(async (): Promise<{ success: boolean; users?: UserProfile[]; error?: string }> => {
    if (!user?.id) return { success: false, error: 'Not authenticated' };
    return await rbacService.getAllUsers(user.id);
  }, [user?.id]);

  // Utility functions
  const getRoleDisplayName = useCallback((role?: UserRole): string => {
    return rbacService.getRoleDisplayName(role || state.userRole);
  }, [state.userRole]);

  const getAssignableRoles = useCallback(async (): Promise<UserRole[]> => {
    if (!user?.id) return [];
    return await rbacService.getAssignableRoles(user.id);
  }, [user?.id]);

  // Cache management
  const refreshUserProfile = useCallback(async (): Promise<void> => {
    if (user?.id) {
      rbacService.clearUserCache(user.id);
      await loadUserProfile();
    }
  }, [user?.id, loadUserProfile]);

  const clearCache = useCallback((): void => {
    rbacService.clearUserCache();
  }, []);

  // Enhanced permission methods
  const hasProjectPermission = useCallback(async (projectId: string, permission: Permission): Promise<boolean> => {
    if (!user?.id) return false;
    return await rbacService.hasProjectPermission(user.id, projectId, permission);
  }, [user?.id]);

  const hasOrganizationPermission = useCallback(async (organizationId: string, permission: Permission): Promise<boolean> => {
    if (!user?.id) return false;
    return await rbacService.hasOrganizationPermission(user.id, organizationId, permission);
  }, [user?.id]);

  const getContextualPermissions = useCallback(async (context: { type: 'project' | 'organization' | 'global'; resourceId?: string }): Promise<Permission[]> => {
    if (!user?.id) return [];
    return await rbacService.getContextualPermissions(user.id, context);
  }, [user?.id]);

  const canModifyResource = useCallback(async (resourceType: 'qa_session' | 'file' | 'project' | 'report', resourceId: string, action: 'view' | 'update' | 'delete'): Promise<boolean> => {
    if (!user?.id) return false;
    return await rbacService.canModifyResource(user.id, resourceType, resourceId, action);
  }, [user?.id]);

  const resolvePermissionConflicts = useCallback(async (requestedPermissions: Permission[]): Promise<{ granted: Permission[]; denied: Permission[]; conflicts: Array<{ permission: Permission; reason: string }> }> => {
    if (!user?.id) return { granted: [], denied: [], conflicts: [] };
    return await rbacService.resolvePermissionConflicts(user.id, requestedPermissions);
  }, [user?.id]);

  // Permission matrix helpers
  const hasResourcePermission = useCallback((resource: keyof typeof PERMISSION_MATRIX, action: string): boolean => {
    return hasRequiredPermission(state.permissions, resource, action);
  }, [state.permissions]);

  const getRequiredPermissionsForAction = useCallback((resource: keyof typeof PERMISSION_MATRIX, action: string): Permission[] => {
    return getRequiredPermissions(resource, action);
  }, []);

  return {
    ...state,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessResource,
    canManageUser,
    updateUserRole,
    getAllUsers,
    getRoleDisplayName,
    getAssignableRoles,
    refreshUserProfile,
    clearCache,
    hasProjectPermission,
    hasOrganizationPermission,
    getContextualPermissions,
    canModifyResource,
    resolvePermissionConflicts,
    hasResourcePermission,
    getRequiredPermissionsForAction
  };
}; 