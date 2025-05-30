import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Users, 
  Edit, 
  Crown,
  Shield,
  UserCheck,
} from 'lucide-react';
import { UserRole, type UserProfile } from '@/lib/rbac';
import { useRBAC } from '@/hooks/useRBAC';
import PermissionGuard from '@/components/PermissionGuard';

interface UsersTableProps {
  users: UserProfile[];
  onEditUser: (user: UserProfile) => void;
  searchTerm: string;
  roleFilter: UserRole | 'all';
}

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

export const UsersTable: React.FC<UsersTableProps> = ({
  users,
  onEditUser,
  searchTerm,
  roleFilter,
}) => {
  const { getRoleDisplayName, canManageUser } = useRBAC();

  if (users.length === 0) {
    return (
      <div className="text-center py-8">
        <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">
          {searchTerm || roleFilter !== 'all' ? 'No users match your filters' : 'No users found'}
        </p>
      </div>
    );
  }

  return (
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
          {users.map((user) => (
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
                    onClick={() => onEditUser(user)}
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
  );
}; 