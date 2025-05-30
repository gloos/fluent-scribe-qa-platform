import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { SecurityStats } from '@/lib/security/types';

interface SecurityStatsCardsProps {
  stats: SecurityStats;
}

export const SecurityStatsCards: React.FC<SecurityStatsCardsProps> = ({ stats }) => {
  const authenticationRate = stats.totalEvents > 0 ? Math.round((stats.successfulLogins / stats.totalEvents) * 100) : 0;
  const securityConcernLevel = stats.failedLogins > stats.successfulLogins * 2 ? 'High' : 'Normal';
  const isFailuresTrending = stats.failedLogins > stats.successfulLogins;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Events */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Events</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalEvents}</div>
          <p className="text-xs text-muted-foreground">Last 24 hours</p>
        </CardContent>
      </Card>

      {/* Successful Logins */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Successful Logins</CardTitle>
          <CheckCircle className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{stats.successfulLogins}</div>
          <div className="flex items-center text-xs text-muted-foreground">
            <TrendingUp className="h-3 w-3 mr-1" />
            Authentication rate: {authenticationRate}%
          </div>
        </CardContent>
      </Card>

      {/* Failed Attempts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Failed Attempts</CardTitle>
          <XCircle className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{stats.failedLogins}</div>
          <div className="flex items-center text-xs text-muted-foreground">
            {isFailuresTrending ? (
              <TrendingUp className="h-3 w-3 mr-1 text-red-500" />
            ) : (
              <TrendingDown className="h-3 w-3 mr-1 text-green-500" />
            )}
            Security concern level: {securityConcernLevel}
          </div>
        </CardContent>
      </Card>

      {/* Security Alerts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Security Alerts</CardTitle>
          <AlertTriangle className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">
            {stats.suspiciousActivity + stats.accountLockouts}
          </div>
          <p className="text-xs text-muted-foreground">
            {stats.accountLockouts} lockouts, {stats.suspiciousActivity} suspicious
          </p>
        </CardContent>
      </Card>
    </div>
  );
}; 