import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Filter } from 'lucide-react';
import { UserRole } from '@/lib/rbac';
import { useRBAC } from '@/hooks/useRBAC';

interface UserFiltersProps {
  searchTerm: string;
  roleFilter: UserRole | 'all';
  onSearchChange: (value: string) => void;
  onRoleFilterChange: (value: UserRole | 'all') => void;
}

export const UserFilters: React.FC<UserFiltersProps> = ({
  searchTerm,
  roleFilter,
  onSearchChange,
  onRoleFilterChange,
}) => {
  const { getRoleDisplayName } = useRBAC();

  return (
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
                onChange={(e) => onSearchChange(e.target.value)}
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
              onValueChange={onRoleFilterChange}
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
  );
}; 