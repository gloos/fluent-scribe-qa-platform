import React from 'react';
import { useRBAC } from '@/hooks/useRBAC';
import { UserRole, Permission } from '@/lib/rbac';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Shield, Lock, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PermissionAwareSectionProps {
  children: React.ReactNode;
  className?: string;
  
  // Permission requirements
  requiredPermission?: Permission;
  requiredPermissions?: Permission[];
  requireAllPermissions?: boolean;
  
  // Role requirements
  minRole?: UserRole;
  allowedRoles?: UserRole[];
  
  // Behavior when permission is missing
  hideWhenDenied?: boolean; // Hide section completely
  showPlaceholder?: boolean; // Show placeholder content when denied
  showMinimalInfo?: boolean; // Show minimal info that content exists but is restricted
  
  // Custom access check
  customAccessCheck?: (userRole: UserRole, hasPermission: (permission: Permission) => boolean) => boolean;
  
  // Placeholder content
  placeholderTitle?: string;
  placeholderDescription?: string;
  placeholderContent?: React.ReactNode;
  
  // Section info for restricted content
  sectionTitle?: string;
  sectionDescription?: string;
  
  // Loading state
  showLoadingPlaceholder?: boolean;
}

export const PermissionAwareSection: React.FC<PermissionAwareSectionProps> = ({
  children,
  className,
  requiredPermission,
  requiredPermissions,
  requireAllPermissions = true,
  minRole,
  allowedRoles,
  hideWhenDenied = false,
  showPlaceholder = true,
  showMinimalInfo = false,
  customAccessCheck,
  placeholderTitle = "Restricted Content",
  placeholderDescription = "You don't have permission to view this content.",
  placeholderContent,
  sectionTitle,
  sectionDescription,
  showLoadingPlaceholder = true
}) => {
  const { userRole, hasPermission, hasAnyPermission, hasAllPermissions, loading } = useRBAC();

  // Helper function to get role hierarchy level
  const getRoleLevel = (role: UserRole): number => {
    const levels = {
      [UserRole.GUEST]: 0,
      [UserRole.USER]: 1,
      [UserRole.QA_ANALYST]: 2,
      [UserRole.MANAGER]: 3,
      [UserRole.ADMIN]: 4,
      [UserRole.SUPER_ADMIN]: 5
    };
    return levels[role] || 0;
  };

  // Get user-friendly role name
  const getRoleDisplayName = (role: UserRole): string => {
    const names = {
      [UserRole.GUEST]: 'Guest',
      [UserRole.USER]: 'User',
      [UserRole.QA_ANALYST]: 'QA Analyst',
      [UserRole.MANAGER]: 'Manager',
      [UserRole.ADMIN]: 'Administrator',
      [UserRole.SUPER_ADMIN]: 'Super Administrator'
    };
    return names[role] || role;
  };

  // Check if user has required access
  const checkAccess = (): boolean => {
    // Check minimum role requirement
    if (minRole) {
      const userLevel = getRoleLevel(userRole);
      const minLevel = getRoleLevel(minRole);
      if (userLevel < minLevel) return false;
    }

    // Check allowed roles
    if (allowedRoles && !allowedRoles.includes(userRole)) {
      return false;
    }

    // Check single permission
    if (requiredPermission && !hasPermission(requiredPermission)) {
      return false;
    }

    // Check multiple permissions
    if (requiredPermissions && requiredPermissions.length > 0) {
      if (requireAllPermissions) {
        if (!hasAllPermissions(requiredPermissions)) return false;
      } else {
        if (!hasAnyPermission(requiredPermissions)) return false;
      }
    }

    // Custom access check
    if (customAccessCheck && !customAccessCheck(userRole, hasPermission)) {
      return false;
    }

    return true;
  };

  // Show loading state
  if (loading && showLoadingPlaceholder) {
    return (
      <div className={cn("animate-pulse p-4", className)}>
        <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          <div className="h-4 bg-gray-200 rounded w-4/6"></div>
        </div>
      </div>
    );
  }

  const hasAccess = checkAccess();

  // Show content if access is granted
  if (hasAccess) {
    return <div className={className}>{children}</div>;
  }

  // Hide section completely if access is denied and hideWhenDenied is true
  if (hideWhenDenied) {
    return null;
  }

  // Show minimal info that content exists but is restricted
  if (showMinimalInfo) {
    return (
      <div className={cn("relative", className)}>
        <div className="blur-sm pointer-events-none select-none">
          {children}
        </div>
        <div className="absolute inset-0 bg-black/5 flex items-center justify-center">
          <Card className="w-auto max-w-sm">
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <EyeOff className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-sm font-medium">Content Restricted</p>
                <p className="text-xs text-muted-foreground">
                  {sectionTitle || "This section"} requires additional permissions
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show custom placeholder content
  if (placeholderContent) {
    return <div className={className}>{placeholderContent}</div>;
  }

  // Show default placeholder content
  if (showPlaceholder) {
    return (
      <div className={className}>
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            {placeholderTitle}
          </AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{placeholderDescription}</p>
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Your role:</strong> {getRoleDisplayName(userRole)}</p>
              {requiredPermission && (
                <p><strong>Required permission:</strong> {requiredPermission}</p>
              )}
              {requiredPermissions && (
                <p><strong>Required permissions:</strong> {requiredPermissions.join(', ')}</p>
              )}
              {minRole && (
                <p><strong>Minimum role required:</strong> {getRoleDisplayName(minRole)}</p>
              )}
              {allowedRoles && (
                <p><strong>Allowed roles:</strong> {allowedRoles.map(getRoleDisplayName).join(', ')}</p>
              )}
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Default fallback - hide content
  return null;
}; 