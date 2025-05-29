import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Shield, 
  CheckCircle,
  AlertTriangle,
  Calendar,
  Clock,
  MapPin,
  Smartphone,
  RefreshCw
} from 'lucide-react';
import { securityService } from '@/lib/security';
import { sessionManager } from '@/lib/sessionManager';

interface SecurityEvent {
  type: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
  timestamp: number;
  success: boolean;
  metadata?: {
    timestamp?: string;
    ip?: string;
    deviceFingerprint?: string;
  };
}

interface SessionInfo {
  session: any;
  user: any;
  isExpired: boolean;
  timeUntilExpiry: number;
  lastActivity: number;
}

interface SecurityInfoProps {
  userId: string;
}

export const SecurityInfo: React.FC<SecurityInfoProps> = ({ userId }) => {
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSecurityInfo = async () => {
      try {
        // Get recent security events for this user
        const userEvents = securityService.getSecurityEvents(userId).slice(0, 5);
        setSecurityEvents(userEvents);

        // Get current session info
        const sessionData = await sessionManager.getSessionInfo();
        setSessionInfo(sessionData);
      } catch (error) {
        console.error('Error loading security info:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSecurityInfo();
  }, [userId]);

  const formatSecurityEvent = (event: SecurityEvent) => {
    const eventTime = new Date(event.timestamp);
    
    return {
      title: event.type.replace(/_/g, ' ').toUpperCase(),
      description: `${event.success ? 'Successful' : 'Failed'} ${event.type.toLowerCase()}`,
      time: eventTime.toLocaleString(),
      ip: event.ipAddress || event.metadata?.ip || 'Unknown',
      device: event.deviceFingerprint || event.metadata?.deviceFingerprint || 'Unknown Device',
      success: event.success
    };
  };

  const formatTimeRemaining = (milliseconds: number) => {
    const minutes = Math.floor(milliseconds / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Information
            <RefreshCw className="h-4 w-4 animate-spin ml-auto" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Loading security information...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Security Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Session Information */}
        {sessionInfo && (
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Current Session
            </h4>
            <Alert>
              <AlertDescription className="space-y-2">
                <div className="flex justify-between items-center">
                  <span>Status:</span>
                  <Badge variant={sessionInfo.isExpired ? "destructive" : "default"}>
                    {sessionInfo.isExpired ? "Expired" : "Active"}
                  </Badge>
                </div>
                {!sessionInfo.isExpired && (
                  <div className="flex justify-between items-center">
                    <span>Time remaining:</span>
                    <span className="font-mono text-sm">
                      {formatTimeRemaining(sessionInfo.timeUntilExpiry)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span>Last activity:</span>
                  <span className="text-sm">
                    {new Date(sessionInfo.lastActivity).toLocaleString()}
                  </span>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Recent Security Events */}
        <div className="space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Recent Activity
          </h4>
          
          {securityEvents.length === 0 ? (
            <Alert>
              <AlertDescription>
                No recent security events found.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {securityEvents.map((event, index) => {
                const formatted = formatSecurityEvent(event);
                return (
                  <Alert key={index} className={formatted.success ? "" : "border-orange-200"}>
                    <div className="flex items-start gap-3">
                      {formatted.success ? (
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5" />
                      )}
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <h5 className="font-medium text-sm">{formatted.title}</h5>
                          <Badge variant={formatted.success ? "default" : "destructive"}>
                            {formatted.success ? "Success" : "Failed"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatted.description}
                        </p>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatted.time}
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {formatted.ip}
                          </div>
                          <div className="flex items-center gap-1">
                            <Smartphone className="h-3 w-3" />
                            {formatted.device}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Alert>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}; 