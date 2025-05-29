import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Users, 
  Shield, 
  Search, 
  Edit, 
  Trash2, 
  AlertCircle, 
  CheckCircle,
  Crown,
  UserCheck,
  Filter
} from 'lucide-react';
import { useRBAC } from '@/hooks/useRBAC';
import { UserRole, Permission, type UserProfile } from '@/lib/rbac';
import { toast } from '@/hooks/use-toast';
import PermissionGuard, { AdminOnly } from '@/components/PermissionGuard';

const UserManagement = () => {
  const { 
    hasPermission, 
    getAllUsers, 
    updateUserRole, 
    getRoleDisplayName, 
    getAssignableRoles,
    canManageUser,
    userRole,
    loading: rbacLoading 
  } = useRBAC();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  
  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [newRole, setNewRole] = useState<UserRole>(UserRole.USER);
  const [assignableRoles, setAssignableRoles] = useState<UserRole[]>([]);
  const [updating, setUpdating] = useState(false);

  // Load users on component mount
  useEffect(() => {
    loadUsers();
  }, []);

  // Load assignable roles
  useEffect(() => {
    const loadAssignableRoles = async () => {
      const roles = await getAssignableRoles();
      setAssignableRoles(roles);
    };
    
    if (!rbacLoading) {
      loadAssignableRoles();
    }
  }, [getAssignableRoles, rbacLoading]);

  // Filter users based on search and role filter
  useEffect(() => {
    let filtered = users;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(user => 
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
      );
    }

    // Apply role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    setFilteredUsers(filtered);
  }, [users, searchTerm, roleFilter]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await getAllUsers();
      
      if (result.success && result.users) {
        setUsers(result.users);
      } else {
        setError(result.error || 'Failed to load users');
      }
    } catch (err) {
      console.error('Error loading users:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = async (user: UserProfile) => {
    // Check if current user can manage this user
    const canManage = await canManageUser(user.id);
    if (!canManage) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to manage this user.",
        variant: "destructive"
      });
      return;
    }

    setSelectedUser(user);
    setNewRole(user.role);
    setEditDialogOpen(true);
  };

  const handleUpdateRole = async () => {
    if (!selectedUser) return;

    try {
      setUpdating(true);
      
      const result = await updateUserRole(selectedUser.id, newRole);
      
      if (result.success) {
        toast({
          title: "Role Updated",
          description: `${selectedUser.email}'s role has been updated to ${getRoleDisplayName(newRole)}.`,
          variant: "default"
        });
        
        // Refresh users list
        await loadUsers();
        setEditDialogOpen(false);
        setSelectedUser(null);
      } else {
        toast({
          title: "Update Failed",
          description: result.error || "Failed to update user role.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error updating user role:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive"
      });
    } finally {
      setUpdating(false);
    }
  };

  const getRoleBadgeVariant = (role: UserRole) => {
    switch (role) {
      case UserRole.SUPER_ADMIN:
        return 'destructive';
      case UserRole.ADMIN:
        return 'secondary';
      case UserRole.MANAGER:
        return 'default';
      case UserRole.QA_ANALYST:
        return 'outline';
      case UserRole.USER:
        return 'outline';
      case UserRole.GUEST:
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case UserRole.SUPER_ADMIN:
        return <Crown className="h-3 w-3" />;
      case UserRole.ADMIN:
        return <Shield className="h-3 w-3" />;
      case UserRole.MANAGER:
        return <UserCheck className="h-3 w-3" />;
      default:
        return null;
    }
  };

  if (rbacLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading user management...</p>
        </div>
      </div>
    );
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
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <Label htmlFor="search" className="text-sm font-medium">
                    Search Users
                  </Label>
                  <div className="relative mt-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="search"
                      placeholder="Search by email or name..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="sm:w-48">
                  <Label htmlFor="roleFilter" className="text-sm font-medium">
                    Filter by Role
                  </Label>
                  <Select 
                    value={roleFilter} 
                    onValueChange={(value) => setRoleFilter(value as UserRole | 'all')}
                  >
                    <SelectTrigger className="mt-1">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      {Object.values(UserRole).map((role) => (
                        <SelectItem key={role} value={role}>
                          {getRoleDisplayName(role)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

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
              {filteredUsers.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">
                    {searchTerm || roleFilter !== 'all' ? 'No users match your filters' : 'No users found'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium text-gray-900">
                                {user.full_name || 'No name provided'}
                              </div>
                              <div className="text-sm text-gray-600">{user.email}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={getRoleBadgeVariant(user.role)}
                              className="flex items-center w-fit"
                            >
                              {getRoleIcon(user.role)}
                              <span className={getRoleIcon(user.role) ? 'ml-1' : ''}>
                                {getRoleDisplayName(user.role)}
                              </span>
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {new Date(user.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <PermissionGuard
                              customCheck={() => canManageUser(user.id)}
                              fallback={
                                <span className="text-sm text-gray-400">No access</span>
                              }
                            >
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditUser(user)}
                                className="flex items-center"
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Edit Role
                              </Button>
                            </PermissionGuard>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Edit Role Dialog */}
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit User Role</DialogTitle>
                <DialogDescription>
                  Change the role for {selectedUser?.email}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="newRole">New Role</Label>
                  <Select 
                    value={newRole} 
                    onValueChange={(value) => setNewRole(value as UserRole)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {assignableRoles.map((role) => (
                        <SelectItem key={role} value={role}>
                          <div className="flex items-center">
                            {getRoleIcon(role)}
                            <span className={getRoleIcon(role) ? 'ml-2' : ''}>
                              {getRoleDisplayName(role)}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                  disabled={updating}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateRole}
                  disabled={updating || newRole === selectedUser?.role}
                >
                  {updating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Update Role
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </AdminOnly>
  );
};

export default UserManagement; 