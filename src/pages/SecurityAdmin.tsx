import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, AlertTriangle, Settings, Users, Activity } from 'lucide-react';
import SecurityDashboard from '@/components/SecurityDashboard';
import { useRBAC } from '@/hooks/useRBAC';
import { Permission } from '@/lib/rbac';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { securityService } from '@/lib/security';

const SecurityAdmin: React.FC = () => {
  const { hasPermission, userProfile } = useRBAC();

  // Check if user has permission to access security admin
  if (!hasPermission(Permission.VIEW_SYSTEM_LOGS)) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert className="max-w-md mx-auto">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to access the Security Administration panel. 
            Please contact your administrator if you need access.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const handleClearRateLimit = (email: string) => {
    if (email && confirm(`Clear rate limiting for ${email}? This will reset failed login counters.`)) {
      securityService.clearRateLimit(email);
      alert(`Rate limiting cleared for ${email}`);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Shield className="h-8 w-8 text-blue-600" />
              Security Administration
            </h1>
            <p className="text-muted-foreground mt-2">
              Monitor and manage security events, authentication attempts, and system access
            </p>
          </div>
          <Badge variant="outline" className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {userProfile?.role || 'Admin'}
          </Badge>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Settings</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button variant="outline" size="sm" className="w-full justify-start">
                <Shield className="h-4 w-4 mr-2" />
                Configure Rate Limiting
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Security Policies
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">User Management</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full justify-start"
                onClick={() => {
                  const email = prompt('Enter email to clear rate limit:');
                  if (email) handleClearRateLimit(email);
                }}
              >
                <Shield className="h-4 w-4 mr-2" />
                Clear Rate Limits
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start">
                <Users className="h-4 w-4 mr-2" />
                Manage User Access
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button variant="outline" size="sm" className="w-full justify-start">
                <Activity className="h-4 w-4 mr-2" />
                View System Metrics
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Export Security Logs
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Security Dashboard */}
      <SecurityDashboard showUserEvents={false} />
    </div>
  );
};

export default SecurityAdmin; 