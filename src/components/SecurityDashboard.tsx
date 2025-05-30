import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield } from 'lucide-react';
import { securityService, SecurityEvent, SecurityEventType } from '@/lib/security';
import { useAuth } from '@/hooks/useAuth';
import { useRBAC } from '@/hooks/useRBAC';
import { Permission } from '@/lib/rbac';
import { toast } from '@/hooks/use-toast';
import {
  SecurityStatsCards,
  SecurityEventsList,
  SecurityHealthScore
} from '@/components/security';

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

  const handleEventTypeChange = (eventType: SecurityEventType | 'ALL') => {
    setSelectedEventType(eventType);
  };

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
      {!compact && <SecurityStatsCards stats={stats} />}

      {/* Security Events */}
      <SecurityEventsList
        events={events}
        selectedEventType={selectedEventType}
        onEventTypeChange={handleEventTypeChange}
        onRefresh={refreshData}
        refreshing={refreshing}
        compact={compact}
        userId={userId}
      />

      {/* Security Health Indicator */}
      {!compact && <SecurityHealthScore stats={stats} />}
    </div>
  );
};

export default SecurityDashboard; 