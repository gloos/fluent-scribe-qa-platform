import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

export const RoleExpirationManager: React.FC = () => {
  return (
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
        <div className="text-center py-8">
          <p className="text-muted-foreground">Role expiration management component coming soon...</p>
        </div>
      </CardContent>
    </Card>
  );
}; 