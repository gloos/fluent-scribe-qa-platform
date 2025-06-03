import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Activity,
  Download,
  Filter,
  Calendar,
  Shield,
  User,
  Settings,
  LogIn,
  LogOut,
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  FileText
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

interface ActivityEvent {
  id: string;
  event_type: string;
  created_at: string;
  result: string;
  reason?: string;
  resource_type?: string;
  ip_address?: string;
  user_agent?: string;
  risk_level?: string;
  metadata?: any;
}

interface ActivityHistoryDisplayProps {
  userId: string;
}

export const ActivityHistoryDisplay: React.FC<ActivityHistoryDisplayProps> = ({ userId }) => {
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [dateRange, setDateRange] = useState('30'); // days
  const [eventTypeFilter, setEventTypeFilter] = useState('all');
  const [riskLevelFilter, setRiskLevelFilter] = useState('all');

  useEffect(() => {
    loadActivityHistory();
  }, [userId, dateRange, eventTypeFilter, riskLevelFilter]);

  const loadActivityHistory = async () => {
    try {
      setIsLoading(true);

      // Calculate date range
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(dateRange));

      let query = supabase
        .from('audit_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(100);

      // Apply event type filter
      if (eventTypeFilter !== 'all') {
        query = query.eq('event_type', eventTypeFilter);
      }

      // Apply risk level filter
      if (riskLevelFilter !== 'all') {
        query = query.eq('risk_level', riskLevelFilter.toUpperCase());
      }

      const { data: auditLogs, error } = await query;

      if (error) {
        console.error('Error loading activity history:', error);
        toast({
          title: "Error",
          description: "Failed to load activity history",
          variant: "destructive"
        });
        return;
      }

      // Also get profile update events (simplified approach)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('updated_at, created_at')
        .eq('id', userId)
        .single();

      let profileEvents: ActivityEvent[] = [];
      if (profile && !profileError) {
        // Add profile creation event if within range
        if (new Date(profile.created_at) >= startDate) {
          profileEvents.push({
            id: `profile-created-${userId}`,
            event_type: 'PROFILE_CREATED',
            created_at: profile.created_at,
            result: 'SUCCESS',
            reason: 'Account profile created',
            resource_type: 'profile'
          });
        }

        // Add profile update event if different from creation and within range
        if (profile.updated_at !== profile.created_at && new Date(profile.updated_at) >= startDate) {
          profileEvents.push({
            id: `profile-updated-${userId}`,
            event_type: 'PROFILE_UPDATED',
            created_at: profile.updated_at,
            result: 'SUCCESS',
            reason: 'Profile information updated',
            resource_type: 'profile'
          });
        }
      }

      // Combine and sort all events
      const allEvents = [...(auditLogs || []), ...profileEvents]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setActivities(allEvents);

    } catch (error) {
      console.error('Error loading activity history:', error);
      toast({
        title: "Error",
        description: "Failed to load activity history",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const exportActivityHistory = async () => {
    try {
      setIsExporting(true);

      // Create CSV content
      const csvHeaders = [
        'Date & Time',
        'Event Type',
        'Result',
        'Description',
        'IP Address',
        'Risk Level',
        'Resource Type'
      ];

      const csvRows = activities.map(activity => [
        new Date(activity.created_at).toLocaleString(),
        formatEventType(activity.event_type),
        activity.result,
        activity.reason || '-',
        activity.ip_address || '-',
        activity.risk_level || 'LOW',
        activity.resource_type || '-'
      ]);

      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `activity-history-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      toast({
        title: "Success",
        description: "Activity history exported successfully",
      });

    } catch (error) {
      console.error('Error exporting activity history:', error);
      toast({
        title: "Error",
        description: "Failed to export activity history",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'LOGIN_SUCCESS':
        return <LogIn className="h-4 w-4 text-green-600" />;
      case 'LOGIN_FAILURE':
        return <LogIn className="h-4 w-4 text-red-600" />;
      case 'LOGOUT':
      case 'SESSION_EXPIRED':
        return <LogOut className="h-4 w-4 text-gray-600" />;
      case 'PROFILE_CREATED':
      case 'PROFILE_UPDATED':
        return <User className="h-4 w-4 text-blue-600" />;
      case 'PASSWORD_CHANGE':
      case 'ROLE_ASSIGNED':
      case 'ROLE_REMOVED':
        return <Shield className="h-4 w-4 text-purple-600" />;
      case 'PERMISSION_CHECK':
      case 'ACCESS_GRANTED':
      case 'ACCESS_DENIED':
        return <Eye className="h-4 w-4 text-orange-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatEventType = (eventType: string) => {
    return eventType
      .toLowerCase()
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getResultBadge = (result: string, riskLevel?: string) => {
    const variant = result === 'SUCCESS' || result === 'granted' ? 'default' : 
                   result === 'FAILURE' || result === 'denied' ? 'destructive' : 'secondary';
    
    const riskColor = riskLevel === 'HIGH' || riskLevel === 'CRITICAL' ? 'text-red-600' : 
                      riskLevel === 'MEDIUM' ? 'text-yellow-600' : 'text-green-600';

    return (
      <div className="flex items-center gap-1">
        <Badge variant={variant} className="text-xs">
          {result}
        </Badge>
        {riskLevel && riskLevel !== 'LOW' && (
          <Badge variant="outline" className={`text-xs ${riskColor} border-current`}>
            {riskLevel}
          </Badge>
        )}
      </div>
    );
  };

  const eventTypeOptions = [
    { value: 'all', label: 'All Events' },
    { value: 'LOGIN_SUCCESS', label: 'Successful Logins' },
    { value: 'LOGIN_FAILURE', label: 'Failed Logins' },
    { value: 'LOGOUT', label: 'Logouts' },
    { value: 'PROFILE_UPDATED', label: 'Profile Updates' },
    { value: 'PASSWORD_CHANGE', label: 'Password Changes' },
    { value: 'ROLE_ASSIGNED', label: 'Role Changes' },
    { value: 'PERMISSION_CHECK', label: 'Permission Checks' },
    { value: 'ACCESS_GRANTED', label: 'Access Granted' },
    { value: 'ACCESS_DENIED', label: 'Access Denied' }
  ];

  const riskLevelOptions = [
    { value: 'all', label: 'All Risk Levels' },
    { value: 'low', label: 'Low Risk' },
    { value: 'medium', label: 'Medium Risk' },
    { value: 'high', label: 'High Risk' },
    { value: 'critical', label: 'Critical Risk' }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Activity History
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Review your account activity including logins, profile changes, and security events.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last year</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {eventTypeOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <Select value={riskLevelFilter} onValueChange={setRiskLevelFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {riskLevelOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={exportActivityHistory}
            disabled={isExporting || activities.length === 0}
            variant="outline"
            size="sm"
          >
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Export'}
          </Button>
        </div>

        <Separator />

        {/* Activity List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4 animate-spin" />
                Loading activity history...
              </div>
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No activity found for the selected filters.</p>
              <p className="text-sm">Try adjusting your date range or filters.</p>
            </div>
          ) : (
            activities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 p-4 border rounded-lg">
                <div className="mt-1">
                  {getEventIcon(activity.event_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">
                        {formatEventType(activity.event_type)}
                      </p>
                      {getResultBadge(activity.result, activity.risk_level)}
                    </div>
                    <time className="text-xs text-muted-foreground">
                      {new Date(activity.created_at).toLocaleString()}
                    </time>
                  </div>
                  {activity.reason && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {activity.reason}
                    </p>
                  )}
                  {activity.ip_address && (
                    <p className="text-xs text-muted-foreground mt-1">
                      IP: {activity.ip_address}
                    </p>
                  )}
                  {activity.resource_type && (
                    <p className="text-xs text-muted-foreground">
                      Resource: {activity.resource_type}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {activities.length > 0 && (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Showing {activities.length} events from the last {dateRange} days
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}; 