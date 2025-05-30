import React from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SecurityEventType } from '@/lib/security/types';

interface SecurityEventFiltersProps {
  selectedEventType: SecurityEventType | 'ALL';
  onEventTypeChange: (eventType: SecurityEventType | 'ALL') => void;
  onRefresh: () => void;
  refreshing: boolean;
  compact?: boolean;
}

const eventTypeOptions = [
  { value: 'ALL', label: 'All Events' },
  { value: 'LOGIN_SUCCESS', label: 'Successful Logins' },
  { value: 'LOGIN_FAILURE', label: 'Failed Logins' },
  { value: 'ACCOUNT_LOCKED', label: 'Account Lockouts' },
  { value: 'SUSPICIOUS_ACTIVITY', label: 'Suspicious Activity' },
  { value: 'DEVICE_CHANGE', label: 'Device Changes' },
  { value: 'PASSWORD_RESET', label: 'Password Resets' },
] as const;

export const SecurityEventFilters: React.FC<SecurityEventFiltersProps> = ({
  selectedEventType,
  onEventTypeChange,
  onRefresh,
  refreshing,
  compact = false
}) => {
  return (
    <div className="flex items-center gap-2">
      {!compact && (
        <select 
          value={selectedEventType} 
          onChange={(e) => onEventTypeChange(e.target.value as SecurityEventType | 'ALL')}
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
        onClick={onRefresh}
        disabled={refreshing}
      >
        <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
        {!compact && <span className="ml-2">Refresh</span>}
      </Button>
    </div>
  );
}; 