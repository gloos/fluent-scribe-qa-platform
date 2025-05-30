import React from 'react';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  MapPin, 
  Monitor,
  Activity,
  RefreshCw
} from 'lucide-react';
import type { SecurityEvent, SecurityEventType } from '@/lib/security/types';

interface SecurityEventItemProps {
  event: SecurityEvent;
  compact?: boolean;
  index: number;
}

export const SecurityEventItem: React.FC<SecurityEventItemProps> = ({ 
  event, 
  compact = false, 
  index 
}) => {
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

  const getBrowserName = (userAgent: string) => {
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    return 'Unknown Browser';
  };

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
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
            {getBrowserName(event.userAgent)}
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
  );
}; 