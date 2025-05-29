import React, { ReactNode, useState, useEffect } from 'react';
import { useRBAC } from '@/hooks/useRBAC';
import { Permission, UserRole } from '@/lib/rbac';
import { rbacService } from '@/lib/rbac';

interface PermissionGuardProps {
  children: ReactNode;
  
  // Permission-based access control
  permission?: Permission;
  permissions?: Permission[];
  requireAll?: boolean; // If true, user must have ALL permissions; if false, ANY permission
  
  // Role-based access control
  role?: UserRole;
  roles?: UserRole[];
  minRole?: UserRole; // Minimum role level required
  
  // Resource-based access control
  resourceOwnerId?: string;
  resourcePermission?: Permission;
  
  // Fallback content
  fallback?: ReactNode;
  
  // Loading state
  showLoadingFallback?: boolean;
  loadingComponent?: ReactNode;
  
  // Additional custom check function
  customCheck?: () => boolean | Promise<boolean>;
}

const PermissionGuard = ({
  children,
  permission,
  permissions,
  requireAll = false,
  role,
  roles,
  minRole,
  resourceOwnerId,
  resourcePermission,
  fallback = null,
  showLoadingFallback = true,
  loadingComponent,
  customCheck
}: PermissionGuardProps) => {
  const {
    userRole,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessResource,
    loading
  } = useRBAC();

  // Show loading state if requested
  if (loading && showLoadingFallback) {
    return (
      <>
        {loadingComponent || (
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        )}
      </>
    );
  }

  // Check permissions
  const hasRequiredPermissions = (): boolean => {
    // Single permission check
    if (permission) {
      return hasPermission(permission);
    }

    // Multiple permissions check
    if (permissions && permissions.length > 0) {
      return requireAll 
        ? hasAllPermissions(permissions)
        : hasAnyPermission(permissions);
    }

    return true; // No permission requirements
  };

  // Check roles
  const hasRequiredRole = (): boolean => {
    // Single role check
    if (role) {
      return userRole === role;
    }

    // Multiple roles check
    if (roles && roles.length > 0) {
      return roles.includes(userRole);
    }

    // Minimum role level check
    if (minRole) {
      const userLevel = rbacService.getRoleLevel(userRole);
      const minLevel = rbacService.getRoleLevel(minRole);
      return userLevel >= minLevel;
    }

    return true; // No role requirements
  };

  // Check resource access (async - handled separately)
  const checkResourceAccess = async (): Promise<boolean> => {
    if (resourceOwnerId && resourcePermission) {
      return await canAccessResource(resourceOwnerId, resourcePermission);
    }
    return true; // No resource requirements
  };

  // Check custom condition
  const checkCustomCondition = async (): Promise<boolean> => {
    if (customCheck) {
      return await customCheck();
    }
    return true; // No custom requirements
  };

  // Synchronous checks
  const permissionsPassed = hasRequiredPermissions();
  const rolesPassed = hasRequiredRole();

  // If synchronous checks fail, show fallback immediately
  if (!permissionsPassed || !rolesPassed) {
    return <>{fallback}</>;
  }

  // For async checks, we need to handle them differently
  // This is a simplified approach - for production, you might want to use React Suspense
  if (resourceOwnerId && resourcePermission) {
    return (
      <AsyncPermissionCheck
        checkFunction={checkResourceAccess}
        customCheck={customCheck}
        fallback={fallback}
      >
        {children}
      </AsyncPermissionCheck>
    );
  }

  if (customCheck) {
    return (
      <AsyncPermissionCheck
        checkFunction={checkCustomCondition}
        fallback={fallback}
      >
        {children}
      </AsyncPermissionCheck>
    );
  }

  // All checks passed
  return <>{children}</>;
};

// Helper component for async permission checks
interface AsyncPermissionCheckProps {
  children: ReactNode;
  checkFunction: () => Promise<boolean>;
  customCheck?: () => boolean | Promise<boolean>;
  fallback?: ReactNode;
}

const AsyncPermissionCheck = ({ 
  children, 
  checkFunction, 
  customCheck, 
  fallback 
}: AsyncPermissionCheckProps) => {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    const performChecks = async () => {
      try {
        const resourceAccessResult = await checkFunction();
        
        if (customCheck) {
          const customResult = await customCheck();
          setHasAccess(resourceAccessResult && customResult);
        } else {
          setHasAccess(resourceAccessResult);
        }
      } catch (error) {
        console.error('Error checking permissions:', error);
        setHasAccess(false);
      }
    };

    performChecks();
  }, [checkFunction, customCheck]);

  if (hasAccess === null) {
    // Still checking
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      </div>
    );
  }

  return hasAccess ? <>{children}</> : <>{fallback}</>;
};

export default PermissionGuard;

// Convenience components for common use cases
export const AdminOnly = ({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) => (
  <PermissionGuard minRole={UserRole.ADMIN} fallback={fallback}>
    {children}
  </PermissionGuard>
);

export const ManagerOrHigher = ({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) => (
  <PermissionGuard minRole={UserRole.MANAGER} fallback={fallback}>
    {children}
  </PermissionGuard>
);

export const RequirePermission = ({ 
  permission, 
  children, 
  fallback 
}: { 
  permission: Permission; 
  children: ReactNode; 
  fallback?: ReactNode;
}) => (
  <PermissionGuard permission={permission} fallback={fallback}>
    {children}
  </PermissionGuard>
);

export const RequireAnyPermission = ({ 
  permissions, 
  children, 
  fallback 
}: { 
  permissions: Permission[]; 
  children: ReactNode; 
  fallback?: ReactNode;
}) => (
  <PermissionGuard permissions={permissions} requireAll={false} fallback={fallback}>
    {children}
  </PermissionGuard>
);

export const RequireAllPermissions = ({ 
  permissions, 
  children, 
  fallback 
}: { 
  permissions: Permission[]; 
  children: ReactNode; 
  fallback?: ReactNode;
}) => (
  <PermissionGuard permissions={permissions} requireAll={true} fallback={fallback}>
    {children}
  </PermissionGuard>
); 