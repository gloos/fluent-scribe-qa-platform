import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  MapPin, 
  Monitor,
  Activity,
  TrendingUp,
  TrendingDown,
  RefreshCw
} from 'lucide-react';
import { securityService, SecurityEvent, SecurityEventType } from '@/lib/security';
import { useAuth } from '@/hooks/useAuth';
import { useRBAC } from '@/hooks/useRBAC';
import { Permission } from '@/lib/rbac';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface SecurityDashboardProps {
  userId?: string;
  compact?: boolean;
  showUserEvents?: boolean;
}

const SecurityDashboard: React.FC<SecurityDashboardProps> = ({ 
  userId, 
  compact = false, 
  showUserEvents = true 
}) => {
  const { user } = useAuth();
  const { hasPermission } = useRBAC();
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [stats, setStats] = useState(securityService.getSecurityStats());
  const [refreshing, setRefreshing] = useState(false);
  const [selectedEventType, setSelectedEventType] = useState<SecurityEventType | 'ALL'>('ALL');

  // Check if user has admin permissions to view all security events
  const isAdmin = hasPermission(Permission.VIEW_SYSTEM_LOGS);
  const canViewUserEvents = showUserEvents && (isAdmin || userId === user?.id);

  useEffect(() => {
    refreshData();
  }, [userId, selectedEventType]);

  const refreshData = () => {
    setRefreshing(true);
    
    try {
      // Get filtered events
      const filteredEvents = securityService.getSecurityEvents(
        canViewUserEvents ? userId : user?.id,
        selectedEventType === 'ALL' ? undefined : selectedEventType
      );
      
      setEvents(filteredEvents.slice(0, compact ? 5 : 20));
      setStats(securityService.getSecurityStats());
    } catch (error) {
      console.error('Failed to refresh security data:', error);
      toast({
        title: "Refresh Failed",
        description: "Unable to refresh security data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setRefreshing(false);
    }
  };

  const getEventIcon = (type: SecurityEventType, success: boolean) => {
    switch (type) {
      case 'LOGIN_SUCCESS':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'LOGIN_FAILURE':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'ACCOUNT_LOCKED':
        return <Shield className="h-4 w-4 text-orange-500" />;
      case 'SUSPICIOUS_ACTIVITY':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'DEVICE_CHANGE':
        return <Monitor className="h-4 w-4 text-blue-500" />;
      case 'PASSWORD_RESET':
        return <RefreshCw className="h-4 w-4 text-purple-500" />;
      case 'RATE_LIMIT_EXCEEDED':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getEventBadgeVariant = (type: SecurityEventType, success: boolean): "default" | "secondary" | "destructive" | "outline" => {
    if (!success) return "destructive";
    
    switch (type) {
      case 'LOGIN_SUCCESS':
        return "default";
      case 'DEVICE_CHANGE':
        return "secondary";
      case 'PASSWORD_RESET':
        return "outline";
      default:
        return "secondary";
    }
  };

  const formatEventDescription = (event: SecurityEvent) => {
    switch (event.type) {
      case 'LOGIN_SUCCESS':
        return `Successful login${event.metadata?.isNewDevice ? ' from new device' : ''}`;
      case 'LOGIN_FAILURE':
        return `Failed login attempt${event.metadata?.attempts ? ` (${event.metadata.attempts} total attempts)` : ''}`;
      case 'ACCOUNT_LOCKED':
        return `Account locked after ${event.metadata?.attempts || 'multiple'} failed attempts`;
      case 'SUSPICIOUS_ACTIVITY':
        return `Suspicious activity: ${event.metadata?.reason || 'Unusual login pattern'}`;
      case 'DEVICE_CHANGE':
        return `Login from new device detected`;
      case 'PASSWORD_RESET':
        return `Password reset requested`;
      case 'RATE_LIMIT_EXCEEDED':
        return `Rate limit exceeded: ${event.metadata?.attempts || 'Multiple'} attempts in ${event.metadata?.timeframe || 'short time'}`;
      default:
        return `Security event: ${event.type}`;
    }
  };

  const eventTypeOptions = [
    { value: 'ALL', label: 'All Events' },
    { value: 'LOGIN_SUCCESS', label: 'Successful Logins' },
    { value: 'LOGIN_FAILURE', label: 'Failed Logins' },
    { value: 'ACCOUNT_LOCKED', label: 'Account Lockouts' },
    { value: 'SUSPICIOUS_ACTIVITY', label: 'Suspicious Activity' },
    { value: 'DEVICE_CHANGE', label: 'Device Changes' },
    { value: 'PASSWORD_RESET', label: 'Password Resets' },
  ];

  if (!canViewUserEvents && !isAdmin) {
    return (
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          You don't have permission to view security information.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Security Statistics */}
      {!compact && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Successful Logins</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.successfulLogins}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3 mr-1" />
                Authentication rate: {stats.totalEvents > 0 ? Math.round((stats.successfulLogins / stats.totalEvents) * 100) : 0}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed Attempts</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.failedLogins}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                {stats.failedLogins > stats.successfulLogins ? (
                  <TrendingUp className="h-3 w-3 mr-1 text-red-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 mr-1 text-green-500" />
                )}
                Security concern level: {stats.failedLogins > stats.successfulLogins * 2 ? 'High' : 'Normal'}
              </div>
            </CardContent>
          </Card>

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
      )}

      {/* Security Events */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Events
                {userId && <Badge variant="outline">User Specific</Badge>}
              </CardTitle>
              <CardDescription>
                {compact ? 'Recent security activity' : 'Comprehensive security event monitoring and audit trail'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {!compact && (
                <select 
                  value={selectedEventType} 
                  onChange={(e) => setSelectedEventType(e.target.value as SecurityEventType | 'ALL')}
                  className="px-3 py-1 border rounded-md text-sm"
                >
                  {eventTypeOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={refreshData}
                disabled={refreshing}
              >
                <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
                {!compact && <span className="ml-2">Refresh</span>}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No security events found</p>
              <p className="text-sm">
                {selectedEventType === 'ALL' ? 'No security activity recorded yet' : `No ${selectedEventType.toLowerCase()} events found`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event, index) => (
                <div key={index} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                  <div className="flex-shrink-0 mt-1">
                    {getEventIcon(event.type, event.success)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={getEventBadgeVariant(event.type, event.success)}>
                          {event.type.replace(/_/g, ' ')}
                        </Badge>
                        {event.email && (
                          <span className="text-sm text-muted-foreground truncate">
                            {event.email}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {new Date(event.timestamp).toLocaleString()}
                      </span>
                    </div>
                    
                    <p className="text-sm text-foreground mb-1">
                      {formatEventDescription(event)}
                    </p>
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {event.ipAddress}
                      </span>
                      <span className="flex items-center gap-1">
                        <Monitor className="h-3 w-3" />
                        {event.userAgent.includes('Chrome') ? 'Chrome' :
                         event.userAgent.includes('Firefox') ? 'Firefox' :
                         event.userAgent.includes('Safari') ? 'Safari' : 'Unknown Browser'}
                      </span>
                      {event.deviceFingerprint && (
                        <span className="text-xs font-mono">
                          Device: {event.deviceFingerprint.substring(0, 8)}...
                        </span>
                      )}
                    </div>
                    
                    {event.metadata && Object.keys(event.metadata).length > 0 && !compact && (
                      <details className="mt-2">
                        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                          View Details
                        </summary>
                        <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">
                          {JSON.stringify(event.metadata, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Health Indicator */}
      {!compact && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Security Health Score
            </CardTitle>
            <CardDescription>
              Overall security posture based on recent authentication activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              const totalActivity = stats.successfulLogins + stats.failedLogins;
              const successRate = totalActivity > 0 ? (stats.successfulLogins / totalActivity) * 100 : 100;
              const suspiciousActivityRate = totalActivity > 0 ? ((stats.suspiciousActivity + stats.accountLockouts) / totalActivity) * 100 : 0;
              
              // Calculate health score (0-100)
              const healthScore = Math.max(0, Math.min(100, 
                successRate - (suspiciousActivityRate * 2) - (stats.failedLogins > stats.successfulLogins ? 20 : 0)
              ));
              
              const getHealthColor = (score: number) => {
                if (score >= 80) return 'text-green-600';
                if (score >= 60) return 'text-yellow-600';
                return 'text-red-600';
              };
              
              const getHealthLabel = (score: number) => {
                if (score >= 80) return 'Excellent';
                if (score >= 60) return 'Good';
                if (score >= 40) return 'Fair';
                return 'Poor';
              };

              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold">Overall Score</span>
                    <span className={cn("text-2xl font-bold", getHealthColor(healthScore))}>
                      {Math.round(healthScore)}/100
                    </span>
                  </div>
                  
                  <Progress 
                    value={healthScore} 
                    className="h-3"
                  />
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Status: </span>
                      <span className={getHealthColor(healthScore)}>
                        {getHealthLabel(healthScore)}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Success Rate: </span>
                      <span className={successRate >= 80 ? 'text-green-600' : successRate >= 60 ? 'text-yellow-600' : 'text-red-600'}>
                        {Math.round(successRate)}%
                      </span>
                    </div>
                  </div>
                  
                  {healthScore < 60 && (
                    <Alert className="mt-4">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Security Alert:</strong> Your security score is below optimal. 
                        Consider reviewing recent login attempts and enabling additional security measures.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SecurityDashboard; 