import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Shield, 
  Users, 
  Clock, 
  CheckCircle, 
  XCircle,
  AlertTriangle,
  Plus,
  Filter,
  Download,
  Upload
} from 'lucide-react';
import { useRBAC } from '@/hooks/useRBAC';
import PermissionGuard from '@/components/PermissionGuard';
import { Permission } from '@/lib/types/user';
import { 
  ApprovalRequestsTable,
  BulkRoleAssignment,
  RoleExpirationManager,
  RoleAssignmentHistory,
  RoleTemplateManager 
} from '@/components/role-management';

const AdminRoleManagement = () => {
  const { hasPermission, userRole, loading } = useRBAC();
  const [activeTab, setActiveTab] = useState('pending-approvals');
  const [stats, setStats] = useState({
    pendingApprovals: 0,
    expiringSoon: 0,
    totalActiveRoles: 0,
    recentChanges: 0
  });

  useEffect(() => {
    // Load role management stats
    loadRoleStats();
  }, []);

  const loadRoleStats = async () => {
    // This would fetch real data from the backend
    setStats({
      pendingApprovals: 5,
      expiringSoon: 12,
      totalActiveRoles: 186,
      recentChanges: 8
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading role management...</p>
        </div>
      </div>
    );
  }

  return (
    <PermissionGuard 
      permission={Permission.MANAGE_ROLES} 
      fallback={
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to access role management.
          </AlertDescription>
        </Alert>
      }
    >
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Role Management</h1>
            <p className="text-muted-foreground">
              Manage user roles, approvals, and access control
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Bulk Import
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.pendingApprovals}</p>
                  <p className="text-sm text-muted-foreground">Pending Approvals</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.expiringSoon}</p>
                  <p className="text-sm text-muted-foreground">Expiring Soon</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalActiveRoles}</p>
                  <p className="text-sm text-muted-foreground">Active Roles</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.recentChanges}</p>
                  <p className="text-sm text-muted-foreground">Recent Changes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="pending-approvals">
              Pending Approvals
              {stats.pendingApprovals > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {stats.pendingApprovals}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="bulk-assignment">Bulk Assignment</TabsTrigger>
            <TabsTrigger value="role-expiration">Role Expiration</TabsTrigger>
            <TabsTrigger value="templates">Role Templates</TabsTrigger>
            <TabsTrigger value="history">Assignment History</TabsTrigger>
          </TabsList>

          <TabsContent value="pending-approvals" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="h-5 w-5 mr-2" />
                  Pending Role Assignment Approvals
                </CardTitle>
                <CardDescription>
                  Review and approve pending role change requests
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ApprovalRequestsTable />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bulk-assignment" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  Bulk Role Assignment
                </CardTitle>
                <CardDescription>
                  Assign roles to multiple users for organizational changes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BulkRoleAssignment />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="role-expiration" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <AlertTriangle className="h-5 w-5 mr-2" />
                  Role Expiration Management
                </CardTitle>
                <CardDescription>
                  Manage temporary access and role expiration dates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RoleExpirationManager />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="h-5 w-5 mr-2" />
                  Role Templates
                </CardTitle>
                <CardDescription>
                  Manage role templates and approval workflows
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RoleTemplateManager />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Role Assignment History
                </CardTitle>
                <CardDescription>
                  View audit trail of all role changes and assignments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RoleAssignmentHistory />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGuard>
  );
};

export default AdminRoleManagement; 