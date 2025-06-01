import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Shield, 
  User, 
  Calendar,
  Filter,
  Download,
  Eye,
  Clock,
  MapPin,
  Monitor
} from 'lucide-react';
import { auditLogger, AuditLogEntry, AuditEventType, AuditResult, RiskLevel } from '@/lib/security/AuditLogger';
import { formatDistanceToNow, format } from 'date-fns';

interface AuditLogFilters {
  event_type?: AuditEventType;
  result?: AuditResult;
  risk_level?: RiskLevel;
  user_id?: string;
  start_date?: Date;
  end_date?: Date;
  requires_review?: boolean;
}

export const RoleAssignmentHistory: React.FC = () => {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadAuditLogs();
    loadStats();
  }, [filters]);

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const logs = await auditLogger.queryLogs({
        ...filters,
        limit: 100
      });
      setAuditLogs(logs);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const auditStats = await auditLogger.getAuditStats('week');
      setStats(auditStats);
    } catch (error) {
      console.error('Failed to load audit stats:', error);
    }
  };

  const handleMarkAsReviewed = async (logId: string) => {
    try {
      // In a real implementation, you'd get the current user ID
      const currentUserId = 'current-user-id'; // Replace with actual user ID
      const success = await auditLogger.markAsReviewed(logId, currentUserId, 'Reviewed via admin panel');
      if (success) {
        loadAuditLogs(); // Refresh the list
      }
    } catch (error) {
      console.error('Failed to mark as reviewed:', error);
    }
  };

  const getEventIcon = (eventType: AuditEventType) => {
    switch (eventType) {
      case 'ROLE_ASSIGNED':
      case 'ROLE_REMOVED':
        return <Shield className="h-4 w-4" />;
      case 'LOGIN_SUCCESS':
      case 'LOGIN_FAILURE':
        return <User className="h-4 w-4" />;
      case 'PERMISSION_CHECK':
        return <Eye className="h-4 w-4" />;
      default:
        return <CheckCircle className="h-4 w-4" />;
    }
  };

  const getResultBadge = (result: AuditResult) => {
    const variants = {
      SUCCESS: 'default',
      FAILURE: 'destructive',
      DENIED: 'secondary',
      ERROR: 'destructive',
      WARNING: 'outline'
    } as const;

    return (
      <Badge variant={variants[result] || 'default'}>
        {result}
      </Badge>
    );
  };

  const getRiskBadge = (riskLevel?: RiskLevel) => {
    if (!riskLevel) return null;

    const variants = {
      LOW: 'default',
      MEDIUM: 'outline',
      HIGH: 'secondary',
      CRITICAL: 'destructive'
    } as const;

    return (
      <Badge variant={variants[riskLevel]}>
        {riskLevel}
      </Badge>
    );
  };

  const filteredLogs = auditLogs.filter(log => {
    if (!searchTerm) return true;
    return (
      log.actor_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.affected_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.event_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.reason?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Events</p>
                  <p className="text-2xl font-bold">{stats.total_events}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                  <p className="text-2xl font-bold">{stats.success_rate.toFixed(1)}%</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">High Risk Events</p>
                  <p className="text-2xl font-bold">{stats.high_risk_events}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pending Reviews</p>
                  <p className="text-2xl font-bold">{stats.pending_reviews}</p>
                </div>
                <Clock className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="h-5 w-5 mr-2" />
            Audit Log Viewer
          </CardTitle>
          <CardDescription>
            Comprehensive audit trail of all security and role-based access events
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="logs" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="logs">Audit Logs</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="logs" className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="flex-1 min-w-[200px]">
                  <Input
                    placeholder="Search logs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full"
                  />
                </div>
                <Select
                  value={filters.event_type || ''}
                  onValueChange={(value) => setFilters(prev => ({ 
                    ...prev, 
                    event_type: value as AuditEventType || undefined 
                  }))}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Event Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Events</SelectItem>
                    <SelectItem value="ROLE_ASSIGNED">Role Assigned</SelectItem>
                    <SelectItem value="ROLE_REMOVED">Role Removed</SelectItem>
                    <SelectItem value="PERMISSION_CHECK">Permission Check</SelectItem>
                    <SelectItem value="LOGIN_SUCCESS">Login Success</SelectItem>
                    <SelectItem value="LOGIN_FAILURE">Login Failure</SelectItem>
                    <SelectItem value="ACCESS_DENIED">Access Denied</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={filters.risk_level || ''}
                  onValueChange={(value) => setFilters(prev => ({ 
                    ...prev, 
                    risk_level: value as RiskLevel || undefined 
                  }))}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Risk Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Levels</SelectItem>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => setFilters({})}>
                  <Filter className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              </div>

              {/* Audit Logs List */}
              <div className="space-y-2">
                {loading ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Loading audit logs...</p>
                  </div>
                ) : filteredLogs.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No audit logs found matching your criteria.</p>
                  </div>
                ) : (
                  filteredLogs.map((log) => (
                    <Card key={log.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3">
                            <div className="mt-1">
                              {getEventIcon(log.event_type)}
                            </div>
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center space-x-2">
                                <span className="font-medium">{log.event_type.replace('_', ' ')}</span>
                                {getResultBadge(log.result)}
                                {getRiskBadge(log.risk_level)}
                                {log.requires_review && !log.reviewed_at && (
                                  <Badge variant="outline">Needs Review</Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {log.actor_email && (
                                  <span>Actor: {log.actor_email}</span>
                                )}
                                {log.affected_email && (
                                  <span> → Affected: {log.affected_email}</span>
                                )}
                                {log.role_from && log.role_to && (
                                  <span> (Role: {log.role_from} → {log.role_to})</span>
                                )}
                              </div>
                              {log.reason && (
                                <p className="text-sm text-muted-foreground">{log.reason}</p>
                              )}
                              <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                                <span className="flex items-center">
                                  <Calendar className="h-3 w-3 mr-1" />
                                  {log.created_at && formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                                </span>
                                {log.ip_address && (
                                  <span className="flex items-center">
                                    <MapPin className="h-3 w-3 mr-1" />
                                    {log.ip_address}
                                  </span>
                                )}
                                {log.user_agent && (
                                  <span className="flex items-center">
                                    <Monitor className="h-3 w-3 mr-1" />
                                    {log.user_agent.substring(0, 50)}...
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedLog(log)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Details
                            </Button>
                            {log.requires_review && !log.reviewed_at && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleMarkAsReviewed(log.id!)}
                              >
                                Mark Reviewed
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-4">
              {stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Event Type Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {Object.entries(stats.event_type_breakdown).map(([type, count]) => (
                          <div key={type} className="flex justify-between items-center">
                            <span className="text-sm">{type.replace('_', ' ')}</span>
                            <Badge variant="outline">{Number(count)}</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Risk Level Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {Object.entries(stats.risk_level_breakdown).map(([level, count]) => (
                          <div key={level} className="flex justify-between items-center">
                            <span className="text-sm">{level}</span>
                            <Badge variant="outline">{Number(count)}</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Detailed Log Modal */}
      {selectedLog && (
        <Card className="fixed inset-4 z-50 bg-background border shadow-lg overflow-auto">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Audit Log Details</CardTitle>
              <Button variant="outline" onClick={() => setSelectedLog(null)}>
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Event Information</h4>
                <div className="space-y-2 text-sm">
                  <div><strong>Type:</strong> {selectedLog.event_type}</div>
                  <div><strong>Result:</strong> {getResultBadge(selectedLog.result)}</div>
                  <div><strong>Risk Level:</strong> {getRiskBadge(selectedLog.risk_level)}</div>
                  <div><strong>Timestamp:</strong> {selectedLog.created_at && format(new Date(selectedLog.created_at), 'PPpp')}</div>
                </div>
              </div>
              <div>
                <h4 className="font-medium mb-2">Context</h4>
                <div className="space-y-2 text-sm">
                  {selectedLog.actor_email && <div><strong>Actor:</strong> {selectedLog.actor_email}</div>}
                  {selectedLog.affected_email && <div><strong>Affected:</strong> {selectedLog.affected_email}</div>}
                  {selectedLog.ip_address && <div><strong>IP Address:</strong> {selectedLog.ip_address}</div>}
                  {selectedLog.session_id && <div><strong>Session:</strong> {selectedLog.session_id}</div>}
                </div>
              </div>
            </div>
            {selectedLog.reason && (
              <div>
                <h4 className="font-medium mb-2">Reason</h4>
                <p className="text-sm bg-muted p-3 rounded">{selectedLog.reason}</p>
              </div>
            )}
            {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Metadata</h4>
                <pre className="text-xs bg-muted p-3 rounded overflow-auto">
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}; 