import { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  Shield, 
  AlertTriangle, 
  RefreshCw, 
  LogOut,
  CheckCircle 
} from 'lucide-react';
import { sessionManager, type SessionInfo } from '@/lib/sessionManager';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface SessionStatusProps {
  showInline?: boolean;
  className?: string;
}

const SessionStatus = ({ showInline = false, className }: SessionStatusProps) => {
  const { signOut } = useAuth();
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    let mounted = true;

    // Update session info
    const updateSessionInfo = async () => {
      const info = await sessionManager.getSessionInfo();
      if (mounted) {
        setSessionInfo(info);
      }
    };

    // Initial load
    updateSessionInfo();

    // Set up session warning callback
    const unsubscribeWarning = sessionManager.onSessionWarning((timeLeft) => {
      if (mounted) {
        setShowWarning(true);
        setTimeLeft(timeLeft);
        toast({
          title: "Session Expiring Soon",
          description: `Your session will expire in ${Math.ceil(timeLeft / 60)} minute(s). Please save your work.`,
          variant: "destructive"
        });
      }
    });

    // Set up session expired callback
    const unsubscribeExpired = sessionManager.onSessionExpired(() => {
      if (mounted) {
        toast({
          title: "Session Expired",
          description: "Your session has expired. Please log in again.",
          variant: "destructive"
        });
        signOut();
      }
    });

    // Start monitoring
    sessionManager.startSessionMonitoring();

    // Update session info every 30 seconds
    const interval = setInterval(updateSessionInfo, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
      unsubscribeWarning();
      unsubscribeExpired();
    };
  }, [signOut]);

  const handleRefreshSession = async () => {
    setIsRefreshing(true);
    const result = await sessionManager.refreshSession();
    
    if (result.success) {
      setShowWarning(false);
      toast({
        title: "Session Refreshed",
        description: "Your session has been successfully extended.",
        variant: "default"
      });
    } else {
      toast({
        title: "Session Refresh Failed",
        description: "Unable to refresh your session. Please log in again.",
        variant: "destructive"
      });
    }
    
    setIsRefreshing(false);
  };

  const handleLogout = async () => {
    await sessionManager.secureLogout();
    signOut();
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
  };

  const getSessionStatusColor = (): string => {
    if (!sessionInfo || sessionInfo.isExpired) return 'bg-red-500';
    if (timeLeft > 0 && timeLeft <= 300) return 'bg-yellow-500'; // 5 minutes
    if (sessionInfo.timeUntilExpiry <= 600) return 'bg-orange-500'; // 10 minutes
    return 'bg-green-500';
  };

  const getSessionStatusText = (): string => {
    if (!sessionInfo || sessionInfo.isExpired) return 'Expired';
    if (timeLeft > 0 && timeLeft <= 300) return 'Expiring Soon';
    if (sessionInfo.timeUntilExpiry <= 600) return 'Warning';
    return 'Active';
  };

  if (!sessionInfo || sessionInfo.isExpired) {
    return null; // Don't show anything if no session
  }

  if (showInline) {
    return (
      <div className={cn("flex items-center space-x-2", className)}>
        <Badge 
          variant="outline" 
          className={cn(
            "text-white border-0",
            getSessionStatusColor()
          )}
        >
          <Shield className="h-3 w-3 mr-1" />
          {getSessionStatusText()}
        </Badge>
        
        {showWarning && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefreshSession}
            disabled={isRefreshing}
            className="h-6 px-2 text-xs"
          >
            {isRefreshing ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <RefreshCw className="h-3 w-3 mr-1" />
                Extend
              </>
            )}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      {showWarning && (
        <Alert className="border-yellow-500 bg-yellow-50 mb-4">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <div className="flex items-center justify-between">
              <div>
                <strong>Session Expiring:</strong> Your session will expire in{' '}
                <strong>{formatTime(timeLeft)}</strong>. Please save your work.
              </div>
              <div className="flex space-x-2 ml-4">
                <Button
                  size="sm"
                  onClick={handleRefreshSession}
                  disabled={isRefreshing}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white"
                >
                  {isRefreshing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Refreshing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Extend Session
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleLogout}
                  className="border-yellow-600 text-yellow-700 hover:bg-yellow-100"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Session Status Info */}
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center space-x-3">
          <div className={cn(
            "w-3 h-3 rounded-full",
            getSessionStatusColor()
          )} />
          <div>
            <div className="text-sm font-medium text-gray-900">
              Session Status: {getSessionStatusText()}
            </div>
            <div className="text-xs text-gray-600">
              {sessionInfo.timeUntilExpiry > 3600 ? (
                `Expires in ${Math.floor(sessionInfo.timeUntilExpiry / 3600)}h ${Math.floor((sessionInfo.timeUntilExpiry % 3600) / 60)}m`
              ) : (
                `Expires in ${formatTime(sessionInfo.timeUntilExpiry)}`
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRefreshSession}
            disabled={isRefreshing}
            className="text-gray-600 hover:text-gray-900"
          >
            {isRefreshing ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SessionStatus; 