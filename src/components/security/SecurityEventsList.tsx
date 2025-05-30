import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield } from 'lucide-react';
import { SecurityEvent, SecurityEventType } from '@/lib/security/types';
import { SecurityEventItem } from './SecurityEventItem';
import { SecurityEventFilters } from './SecurityEventFilters';

interface SecurityEventsListProps {
  events: SecurityEvent[];
  selectedEventType: SecurityEventType | 'ALL';
  onEventTypeChange: (eventType: SecurityEventType | 'ALL') => void;
  onRefresh: () => void;
  refreshing: boolean;
  compact?: boolean;
  userId?: string;
}

export const SecurityEventsList: React.FC<SecurityEventsListProps> = ({
  events,
  selectedEventType,
  onEventTypeChange,
  onRefresh,
  refreshing,
  compact = false,
  userId
}) => {
  return (
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
          <SecurityEventFilters
            selectedEventType={selectedEventType}
            onEventTypeChange={onEventTypeChange}
            onRefresh={onRefresh}
            refreshing={refreshing}
            compact={compact}
          />
        </div>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No security events found</p>
            <p className="text-sm">
              {selectedEventType === 'ALL' 
                ? 'No security activity recorded yet' 
                : `No ${selectedEventType.toLowerCase().replace(/_/g, ' ')} events found`
              }
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event, index) => (
              <SecurityEventItem
                key={`${event.timestamp}-${index}`}
                event={event}
                compact={compact}
                index={index}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}; 