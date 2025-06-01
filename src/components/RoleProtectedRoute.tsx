import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRBAC } from '@/hooks/useRBAC';
import { sessionManager } from '@/lib/sessionManager';
import { toast } from '@/hooks/use-toast';
import { UserRole, Permission } from '@/lib/rbac';
import SessionStatus from './SessionStatus';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldX, ArrowLeft, Home } from 'lucide-react';

interface RoleProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
  showSessionStatus?: boolean;
  
  // Role-based access control
  requiredRole?: UserRole;
  minRole?: UserRole;
  allowedRoles?: UserRole[];
  
  // Permission-based access control
  requiredPermission?: Permission;
  requiredPermissions?: Permission[];
  requireAllPermissions?: boolean;
  
  // Custom access control
  customAccessCheck?: (userRole: UserRole, permissions: Permission[]) => boolean;
  
  // Unauthorized access handling
  showUnauthorizedMessage?: boolean;
  unauthorizedRedirect?: string;
  customUnauthorizedContent?: React.ReactNode;
}

const RoleProtectedRoute = ({ 
  children, 
  redirectTo = '/login',
  showSessionStatus = true,
  requiredRole,
  minRole,
  allowedRoles,
  requiredPermission,
  requiredPermissions,
  requireAllPermissions = true,
  customAccessCheck,
  showUnauthorizedMessage = true,
  unauthorizedRedirect,
  customUnauthorizedContent
}: RoleProtectedRouteProps) => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { userRole, hasPermission, hasAnyPermission, hasAllPermissions, loading: rbacLoading } = useRBAC();
  const location = useLocation();
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      if (!authLoading && isAuthenticated) {
        const sessionInfo = await sessionManager.getSessionInfo();
        
        if (sessionInfo.isExpired) {
          toast({
            title: "Session Expired",
            description: "Your session has expired. Please log in again.",
            variant: "destructive"
          });
          
          await sessionManager.secureLogout();
          setSessionChecked(true);
          return;
        }

        if (sessionManager.isUserIdle()) {
          toast({
            title: "Session Timeout", 
            description: "You have been logged out due to inactivity.",
            variant: "destructive"
          });
          
          await sessionManager.secureLogout();
          setSessionChecked(true);
          return;
        }

        sessionManager.startSessionMonitoring();
      }
      
      setSessionChecked(true);
    };

    checkSession();
  }, [isAuthenticated, authLoading]);

  // Check if user has required access
  const checkAccess = (): boolean => {
    if (!isAuthenticated) return false;
    
    // Check role requirements
    if (requiredRole && userRole !== requiredRole) {
      return false;
    }
    
    if (minRole) {
      const userLevel = getRoleLevel(userRole);
      const minLevel = getRoleLevel(minRole);
      if (userLevel < minLevel) return false;
    }
    
    if (allowedRoles && !allowedRoles.includes(userRole)) {
      return false;
    }
    
    // Check permission requirements
    if (requiredPermission && !hasPermission(requiredPermission)) {
      return false;
    }
    
    if (requiredPermissions && requiredPermissions.length > 0) {
      const hasPerms = requireAllPermissions 
        ? hasAllPermissions(requiredPermissions)
        : hasAnyPermission(requiredPermissions);
      if (!hasPerms) return false;
    }
    
    // Custom access check
    if (customAccessCheck) {
      const userPermissions = requiredPermissions || [];
      return customAccessCheck(userRole, userPermissions);
    }
    
    return true;
  };

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

  // Show loading spinner while checking authentication and permissions
  if (authLoading || rbacLoading || !sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Verifying session and permissions...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return (
      <Navigate 
        to={redirectTo} 
        state={{ from: location }} 
        replace 
      />
    );
  }

  // Check access permissions
  const hasAccess = checkAccess();
  
  if (!hasAccess) {
    // Handle unauthorized access
    if (unauthorizedRedirect) {
      return <Navigate to={unauthorizedRedirect} replace />;
    }
    
    if (customUnauthorizedContent) {
      return <>{customUnauthorizedContent}</>;
    }
    
    if (showUnauthorizedMessage) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <ShieldX className="w-6 h-6 text-red-600" />
              </div>
              <CardTitle className="text-xl font-semibold text-gray-900">
                Access Denied
              </CardTitle>
              <CardDescription className="text-gray-600">
                You don't have permission to access this page
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertTitle>Current Role: {getRoleDisplayName(userRole)}</AlertTitle>
                <AlertDescription>
                  {requiredRole && `This page requires ${getRoleDisplayName(requiredRole)} access.`}
                  {minRole && `This page requires ${getRoleDisplayName(minRole)} or higher access.`}
                  {allowedRoles && `This page is restricted to: ${allowedRoles.map(getRoleDisplayName).join(', ')}.`}
                  {requiredPermission && `Missing required permission: ${requiredPermission}.`}
                  {requiredPermissions && `Missing required permissions: ${requiredPermissions.join(', ')}.`}
                </AlertDescription>
              </Alert>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => window.history.back()}
                  className="flex-1"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Go Back
                </Button>
                <Button 
                  onClick={() => window.location.href = '/dashboard'}
                  className="flex-1"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }
    
    // Default fallback - redirect to dashboard
    return <Navigate to="/dashboard" replace />;
  }

  // Render protected content with optional session status
  return (
    <div className="min-h-screen">
      {showSessionStatus && (
        <div className="bg-white border-b border-gray-200 px-4 py-2">
          <div className="max-w-7xl mx-auto">
            <SessionStatus showInline className="justify-end" />
          </div>
        </div>
      )}
      {children}
    </div>
  );
};

export default RoleProtectedRoute; 