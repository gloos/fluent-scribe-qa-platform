import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useRBAC } from '@/hooks/useRBAC';
import { UserRole, Permission } from '@/lib/rbac';
import { PermissionAwareButton } from '@/components/ui/PermissionAwareButton';
import { PermissionAwareSection } from '@/components/ui/PermissionAwareSection';
import PermissionGuard from '@/components/PermissionGuard';
import { 
  Shield, 
  Users, 
  FileText, 
  Settings, 
  BarChart3, 
  Upload,
  CreditCard,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Lock
} from 'lucide-react';

const PermissionDemo: React.FC = () => {
  const { userRole, hasPermission, getRoleDisplayName, loading } = useRBAC();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading permission demo...</p>
        </div>
      </div>
    );
  }

  const allPermissions = Object.values(Permission);
  const userPermissions = allPermissions.filter(permission => hasPermission(permission));

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Permission-Aware UI Components Demo
          </h1>
          <p className="text-gray-600">
            This page demonstrates how UI components adapt based on user roles and permissions.
          </p>
        </div>

        {/* Current User Info */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Current User Information
            </CardTitle>
            <CardDescription>
              Your current role and permissions in the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2">Role</h3>
                <Badge variant="outline" className="text-sm">
                  {getRoleDisplayName(userRole)}
                </Badge>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Permissions ({userPermissions.length})</h3>
                <div className="flex flex-wrap gap-1">
                  {userPermissions.slice(0, 5).map(permission => (
                    <Badge key={permission} variant="secondary" className="text-xs">
                      {permission.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                  {userPermissions.length > 5 && (
                    <Badge variant="outline" className="text-xs">
                      +{userPermissions.length - 5} more
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Permission-Aware Buttons */}
          <Card>
            <CardHeader>
              <CardTitle>Permission-Aware Buttons</CardTitle>
              <CardDescription>
                Buttons that show, hide, or disable based on permissions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">File Upload (requires UPLOAD_FILES)</h4>
                <PermissionAwareButton
                  requiredPermission={Permission.UPLOAD_FILES}
                  className="w-full"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Files
                </PermissionAwareButton>
              </div>

              <div>
                <h4 className="font-medium mb-2">User Management (requires VIEW_USERS + MANAGER role)</h4>
                <PermissionAwareButton
                  requiredPermission={Permission.VIEW_USERS}
                  minRole={UserRole.MANAGER}
                  className="w-full"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Manage Users
                </PermissionAwareButton>
              </div>

              <div>
                <h4 className="font-medium mb-2">Hidden when denied (requires ADMIN role)</h4>
                <PermissionAwareButton
                  minRole={UserRole.ADMIN}
                  hideWhenDenied={true}
                  className="w-full"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Admin Settings
                </PermissionAwareButton>
                {!hasPermission(Permission.VIEW_SYSTEM_LOGS) && (
                  <p className="text-sm text-gray-500 mt-2">
                    Button is hidden because you don't have admin access
                  </p>
                )}
              </div>

              <div>
                <h4 className="font-medium mb-2">Multiple permissions (any of: CREATE_REPORTS, UPDATE_REPORTS)</h4>
                <PermissionAwareButton
                  requiredPermissions={[Permission.CREATE_REPORTS, Permission.UPDATE_REPORTS]}
                  requireAllPermissions={false}
                  className="w-full"
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Manage Reports
                </PermissionAwareButton>
              </div>
            </CardContent>
          </Card>

          {/* Permission-Aware Sections */}
          <Card>
            <CardHeader>
              <CardTitle>Permission-Aware Sections</CardTitle>
              <CardDescription>
                Content sections that adapt based on permissions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <PermissionAwareSection
                requiredPermission={Permission.VIEW_BILLING}
                sectionTitle="Billing Information"
                sectionDescription="View your subscription and billing details"
                placeholderTitle="Billing Access Required"
                placeholderDescription="You need billing permissions to view this content."
              >
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 text-green-800">
                    <CreditCard className="h-4 w-4" />
                    <span className="font-medium">Subscription Active</span>
                  </div>
                  <p className="text-sm text-green-700 mt-1">
                    Your Pro plan is active and billing is up to date.
                  </p>
                </div>
              </PermissionAwareSection>

              <PermissionAwareSection
                requiredPermission={Permission.VIEW_SECURITY_LOGS}
                minRole={UserRole.ADMIN}
                sectionTitle="Security Logs"
                sectionDescription="View system security and audit logs"
                showMinimalInfo={true}
              >
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-800">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">Security Alert</span>
                  </div>
                  <p className="text-sm text-red-700 mt-1">
                    3 failed login attempts detected in the last hour.
                  </p>
                </div>
              </PermissionAwareSection>

              <PermissionAwareSection
                requiredPermissions={[Permission.CREATE_QA_SESSION, Permission.UPDATE_QA_SESSION]}
                requireAllPermissions={true}
                hideWhenDenied={true}
                sectionTitle="QA Session Management"
              >
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 text-blue-800">
                    <FileText className="h-4 w-4" />
                    <span className="font-medium">Active QA Sessions</span>
                  </div>
                  <p className="text-sm text-blue-700 mt-1">
                    You have 2 active QA sessions in progress.
                  </p>
                </div>
              </PermissionAwareSection>
            </CardContent>
          </Card>

          {/* Permission Guards */}
          <Card>
            <CardHeader>
              <CardTitle>Permission Guards</CardTitle>
              <CardDescription>
                Traditional permission guards for conditional rendering
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <PermissionGuard permission={Permission.VIEW_REPORTS}>
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span>You can view reports</span>
                </div>
              </PermissionGuard>

              <PermissionGuard permission={Permission.DELETE_USERS}>
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span>You can delete users</span>
                </div>
              </PermissionGuard>

              <PermissionGuard 
                permission={Permission.DELETE_USERS}
                fallback={
                  <div className="flex items-center gap-2 text-red-600">
                    <XCircle className="h-4 w-4" />
                    <span>You cannot delete users</span>
                  </div>
                }
              >
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span>You can delete users</span>
                </div>
              </PermissionGuard>

              <PermissionGuard 
                role={UserRole.ADMIN}
                fallback={
                  <div className="flex items-center gap-2 text-red-600">
                    <Lock className="h-4 w-4" />
                    <span>Admin access required</span>
                  </div>
                }
              >
                <div className="flex items-center gap-2 text-green-600">
                  <Shield className="h-4 w-4" />
                  <span>You have admin access</span>
                </div>
              </PermissionGuard>
            </CardContent>
          </Card>

          {/* Permission Matrix */}
          <Card>
            <CardHeader>
              <CardTitle>Permission Matrix</CardTitle>
              <CardDescription>
                Overview of key permissions for your role
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  Permission.VIEW_QA_SESSION,
                  Permission.CREATE_QA_SESSION,
                  Permission.UPLOAD_FILES,
                  Permission.VIEW_REPORTS,
                  Permission.CREATE_REPORTS,
                  Permission.VIEW_USERS,
                  Permission.CREATE_USERS,
                  Permission.DELETE_USERS,
                  Permission.VIEW_BILLING,
                  Permission.VIEW_SECURITY_LOGS
                ].map(permission => (
                  <div key={permission} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium">
                      {permission.replace(/_/g, ' ')}
                    </span>
                    {hasPermission(permission) ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator className="my-8" />

        {/* Implementation Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Implementation Notes</CardTitle>
            <CardDescription>
              How the permission-aware UI system works
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              <h4>Key Components:</h4>
              <ul>
                <li><strong>PermissionAwareButton:</strong> Buttons that can hide, disable, or show permission indicators</li>
                <li><strong>PermissionAwareSection:</strong> Content sections with placeholder content for denied access</li>
                <li><strong>PermissionGuard:</strong> Traditional conditional rendering based on permissions</li>
                <li><strong>RoleProtectedRoute:</strong> Route-level protection with graceful unauthorized handling</li>
                <li><strong>RoleBasedNavigationMenu:</strong> Navigation that filters items based on permissions</li>
              </ul>
              
              <h4>Permission Checking:</h4>
              <ul>
                <li>Role hierarchy support (GUEST &lt; USER &lt; QA_ANALYST &lt; MANAGER &lt; ADMIN &lt; SUPER_ADMIN)</li>
                <li>Individual permission checks</li>
                <li>Multiple permission requirements (ALL or ANY)</li>
                <li>Custom access check functions</li>
              </ul>
              
              <h4>Graceful Degradation:</h4>
              <ul>
                <li>Components show appropriate fallback content when access is denied</li>
                <li>Visual indicators (lock icons, tooltips) explain why access is restricted</li>
                <li>Loading states while permissions are being checked</li>
                <li>Helpful error messages with current role information</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PermissionDemo; 