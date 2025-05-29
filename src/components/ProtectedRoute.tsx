import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { sessionManager } from '@/lib/sessionManager';
import { toast } from '@/hooks/use-toast';
import SessionStatus from './SessionStatus';

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
  showSessionStatus?: boolean;
}

const ProtectedRoute = ({ 
  children, 
  redirectTo = '/login', 
  showSessionStatus = true 
}: ProtectedRouteProps) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      if (!loading && isAuthenticated) {
        const sessionInfo = await sessionManager.getSessionInfo();
        
        if (sessionInfo.isExpired) {
          toast({
            title: "Session Expired",
            description: "Your session has expired. Please log in again.",
            variant: "destructive"
          });
          
          // Force logout
          await sessionManager.secureLogout();
          setSessionChecked(true);
          return;
        }

        // Check for idle timeout
        if (sessionManager.isUserIdle()) {
          toast({
            title: "Session Timeout",
            description: "You have been logged out due to inactivity.",
            variant: "destructive"
          });
          
          await sessionManager.secureLogout();
          setSessionChecked(true);
          return;
        }

        // Start session monitoring
        sessionManager.startSessionMonitoring();
      }
      
      setSessionChecked(true);
    };

    checkSession();
  }, [isAuthenticated, loading]);

  // Show loading spinner while checking authentication
  if (loading || !sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Verifying session...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return (
      <Navigate 
        to={redirectTo} 
        state={{ from: location }} 
        replace 
      />
    );
  }

  // Render protected content with optional session status
  return (
    <div className="min-h-screen">
      {showSessionStatus && (
        <div className="bg-white border-b border-gray-200 px-4 py-2">
          <div className="max-w-7xl mx-auto">
            <SessionStatus showInline className="justify-end" />
          </div>
        </div>
      )}
      {children}
    </div>
  );
};

export default ProtectedRoute; 