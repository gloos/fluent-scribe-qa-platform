import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
  CheckCircle,
  Crown,
  Shield,
  UserCheck,
} from 'lucide-react';
import { UserRole, type UserProfile } from '@/lib/rbac';
import { useRBAC } from '@/hooks/useRBAC';

interface EditRoleDialogProps {
  open: boolean;
  selectedUser: UserProfile | null;
  newRole: UserRole;
  assignableRoles: UserRole[];
  updating: boolean;
  onOpenChange: (open: boolean) => void;
  onRoleChange: (role: UserRole) => void;
  onUpdate: () => void;
}

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

export const EditRoleDialog: React.FC<EditRoleDialogProps> = ({
  open,
  selectedUser,
  newRole,
  assignableRoles,
  updating,
  onOpenChange,
  onRoleChange,
  onUpdate,
}) => {
  const { getRoleDisplayName } = useRBAC();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              onValueChange={onRoleChange}
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
            onClick={() => onOpenChange(false)}
            disabled={updating}
          >
            Cancel
          </Button>
          <Button
            onClick={onUpdate}
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
  );
}; 