import React from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { useRBAC } from '@/hooks/useRBAC';
import { UserRole, Permission } from '@/lib/rbac';
import { Shield, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface PermissionAwareButtonProps extends ButtonProps {
  // Permission requirements
  requiredPermission?: Permission;
  requiredPermissions?: Permission[];
  requireAllPermissions?: boolean;
  
  // Role requirements
  minRole?: UserRole;
  allowedRoles?: UserRole[];
  
  // Behavior when permission is missing
  hideWhenDenied?: boolean; // Hide button completely
  disableWhenDenied?: boolean; // Disable button but show it
  showPermissionIndicator?: boolean; // Show lock icon when disabled
  
  // Custom access check
  customAccessCheck?: (userRole: UserRole, hasPermission: (permission: Permission) => boolean) => boolean;
  
  // Tooltip for denied access
  deniedAccessTooltip?: string;
}

export const PermissionAwareButton: React.FC<PermissionAwareButtonProps> = ({
  children,
  className,
  requiredPermission,
  requiredPermissions,
  requireAllPermissions = true,
  minRole,
  allowedRoles,
  hideWhenDenied = false,
  disableWhenDenied = true,
  showPermissionIndicator = true,
  customAccessCheck,
  deniedAccessTooltip,
  onClick,
  disabled,
  ...props
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
  if (loading) {
    return (
      <Button 
        disabled 
        className={cn("animate-pulse", className)}
        {...props}
      >
        {children}
      </Button>
    );
  }

  const hasAccess = checkAccess();

  // Hide button if access is denied and hideWhenDenied is true
  if (!hasAccess && hideWhenDenied) {
    return null;
  }

  // Determine if button should be disabled
  const isDisabled = disabled || (!hasAccess && disableWhenDenied);

  // Create button element
  const button = (
    <Button
      className={cn(
        className,
        !hasAccess && disableWhenDenied && "opacity-50 cursor-not-allowed"
      )}
      disabled={isDisabled}
      onClick={hasAccess ? onClick : undefined}
      {...props}
    >
      <div className="flex items-center gap-2">
        {!hasAccess && showPermissionIndicator && (
          <Lock className="h-4 w-4" />
        )}
        {children}
      </div>
    </Button>
  );

  // Wrap with tooltip if access is denied and tooltip is provided
  if (!hasAccess && (deniedAccessTooltip || disableWhenDenied)) {
    const tooltipText = deniedAccessTooltip || 
      `Insufficient permissions. ${requiredPermission ? `Required: ${requiredPermission}` : ''}${
        minRole ? `Minimum role: ${minRole}` : ''
      }`;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {button}
          </TooltipTrigger>
          <TooltipContent>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              {tooltipText}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
}; 