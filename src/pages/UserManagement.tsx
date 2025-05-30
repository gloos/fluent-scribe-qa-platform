import React, { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Shield, 
  AlertCircle,
} from 'lucide-react';
import { useRBAC } from '@/hooks/useRBAC';
import PermissionGuard, { AdminOnly } from '@/components/PermissionGuard';
import { UserFilters, UsersTable, EditRoleDialog, LoadingState } from '@/components/user-management';
import { useUserManagement } from '@/hooks/useUserManagement';

const UserManagement = () => {
  const { 
    getRoleDisplayName,
    userRole,
    loading: rbacLoading 
  } = useRBAC();

  const {
    users,
    filteredUsers,
    loading,
    error,
    searchTerm,
    roleFilter,
    editDialogOpen,
    selectedUser,
    newRole,
    assignableRoles,
    updating,
    setSearchTerm,
    setRoleFilter,
    setEditDialogOpen,
    setNewRole,
    loadUsers,
    handleEditUser,
    handleUpdateRole
  } = useUserManagement();

  // Load users on component mount
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  if (rbacLoading || loading) {
    return <LoadingState />;
  }

  return (
    <AdminOnly fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Alert className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to access user management.
          </AlertDescription>
        </Alert>
      </div>
    }>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
              <p className="text-gray-600 mt-1">Manage user accounts and permissions</p>
            </div>
            <Badge variant="secondary" className="text-sm">
              <Shield className="h-4 w-4 mr-1" />
              {getRoleDisplayName(userRole)}
            </Badge>
          </div>

          {/* Filters */}
          <UserFilters
            searchTerm={searchTerm}
            roleFilter={roleFilter}
            onSearchChange={setSearchTerm}
            onRoleFilterChange={setRoleFilter}
          />

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Users Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="h-5 w-5 mr-2" />
                Users ({filteredUsers.length})
              </CardTitle>
              <CardDescription>
                Manage user roles and permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UsersTable 
                users={filteredUsers}
                onEditUser={handleEditUser}
                searchTerm={searchTerm}
                roleFilter={roleFilter}
              />
            </CardContent>
          </Card>

          {/* Edit Role Dialog */}
          <EditRoleDialog
            open={editDialogOpen}
            selectedUser={selectedUser}
            newRole={newRole}
            assignableRoles={assignableRoles}
            updating={updating}
            onOpenChange={setEditDialogOpen}
            onRoleChange={setNewRole}
            onUpdate={handleUpdateRole}
          />
        </div>
      </div>
    </AdminOnly>
  );
};

export default UserManagement; 