import { useState, useEffect, useCallback } from 'react';
import { UserRole, type UserProfile } from '@/lib/rbac';
import { useRBAC } from '@/hooks/useRBAC';
import { toast } from '@/hooks/use-toast';

export const useUserManagement = () => {
  const { 
    getAllUsers, 
    updateUserRole, 
    getRoleDisplayName, 
    getAssignableRoles,
    canManageUser,
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

  // Load assignable roles
  useEffect(() => {
    const loadAssignableRoles = async () => {
      const roles = await getAssignableRoles();
      setAssignableRoles(roles);
    };
    
    loadAssignableRoles();
  }, [getAssignableRoles]);

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

  const loadUsers = useCallback(async () => {
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
  }, [getAllUsers]);

  const handleEditUser = useCallback(async (user: UserProfile) => {
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
  }, [canManageUser]);

  const handleUpdateRole = useCallback(async () => {
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
  }, [selectedUser, newRole, updateUserRole, getRoleDisplayName, loadUsers]);

  return {
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
  };
}; 