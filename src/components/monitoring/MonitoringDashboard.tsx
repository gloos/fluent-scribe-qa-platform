import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import { 
  Activity, 
  Database, 
  Server, 
  Cpu, 
  HardDrive, 
  MemoryStick, 
  Network,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Settings,
  Play,
  Pause,
  Wifi,
  WifiOff
} from 'lucide-react';

interface SystemMetrics {
  timestamp: number;
  cpu: {
    usage: number;
    temperature: number | null;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  disk: {
    readSpeed: number;
    writeSpeed: number;
    totalSpace: number;
    usedSpace: number;
    freeSpace: number;
    usagePercent: number;
  };
  network: {
    rx: number;
    tx: number;
    rxSec: number;
    txSec: number;
  };
  processes: {
    total: number;
    running: number;
    blocked: number;
    sleeping: number;
  };
}

interface DatabaseMetrics {
  timestamp: number;
  connections: {
    active: number;
    idle: number;
    total: number;
    maxConnections: number;
    usagePercent: number;
  };
  performance: {
    cacheHitRatio: number;
    indexHitRatio: number;
    slowQueries: number;
    totalQueries: number;
    avgQueryTime: number;
  };
  locks: {
    total: number;
    waiting: number;
    granted: number;
  };
  tableStats: {
    sequentialScans: number;
    indexScans: number;
    rowsInserted: number;
    rowsUpdated: number;
    rowsDeleted: number;
  };
}

interface AlertData {
  type: string;
  value: number;
  threshold: number;
  message: string;
  timestamp: number;
  severity: 'warning' | 'critical';
}

interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: number;
}

export const MonitoringDashboard: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [systemActive, setSystemActive] = useState(false);
  const [databaseActive, setDatabaseActive] = useState(false);
  const [databaseAvailable, setDatabaseAvailable] = useState(false);
  
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics[]>([]);
  const [databaseMetrics, setDatabaseMetrics] = useState<DatabaseMetrics[]>([]);
  const [systemAlerts, setSystemAlerts] = useState<AlertData[]>([]);
  const [databaseAlerts, setDatabaseAlerts] = useState<AlertData[]>([]);
  
  const [systemThresholds, setSystemThresholds] = useState({
    cpu: 80,
    memory: 85,
    disk: 90,
    temperature: 80
  });
  
  const [databaseThresholds, setDatabaseThresholds] = useState({
    connectionUsage: 80,
    cacheHitRatio: 95,
    indexHitRatio: 95,
    slowQueryCount: 10
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxHistorySize = 50;

  // WebSocket connection management
  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  const connectWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/v1/monitoring/ws`;

    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      
      // Request current metrics on connection
      sendMessage({
        type: 'get_current_metrics',
        limit: maxHistorySize
      });
    };

    wsRef.current.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        handleWebSocketMessage(message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    wsRef.current.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      
      // Attempt to reconnect after 5 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connectWebSocket();
      }, 5000);
    };

    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };
  };

  const sendMessage = (message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  };

  const handleWebSocketMessage = (message: WebSocketMessage) => {
    switch (message.type) {
      case 'system_metrics':
        setSystemMetrics(prev => {
          const updated = [...prev, message.data].slice(-maxHistorySize);
          return updated;
        });
        break;

      case 'database_metrics':
        setDatabaseMetrics(prev => {
          const updated = [...prev, message.data].slice(-maxHistorySize);
          return updated;
        });
        break;

      case 'system_alert':
        setSystemAlerts(prev => [message.data, ...prev].slice(0, 20));
        break;

      case 'database_alert':
        setDatabaseAlerts(prev => [message.data, ...prev].slice(0, 20));
        break;

      case 'status_update':
        const data = message.data;
        if (data.system) {
          setSystemActive(data.system.active || false);
          if (data.system.current) {
            setSystemMetrics(prev => {
              const updated = [...prev, data.system.current].slice(-maxHistorySize);
              return updated;
            });
          }
          if (data.system.history) {
            setSystemMetrics(data.system.history);
          }
        }
        if (data.database) {
          setDatabaseAvailable(data.database.available || false);
          setDatabaseActive(data.database.active || false);
          if (data.database.current) {
            setDatabaseMetrics(prev => {
              const updated = [...prev, data.database.current].slice(-maxHistorySize);
              return updated;
            });
          }
          if (data.database.history) {
            setDatabaseMetrics(data.database.history);
          }
        }
        break;
    }
  };

  const toggleSystemMonitoring = () => {
    const message = systemActive 
      ? { type: 'stop_system_monitoring' }
      : { type: 'start_system_monitoring', interval: 5000 };
    sendMessage(message);
  };

  const toggleDatabaseMonitoring = () => {
    if (!databaseAvailable) return;
    
    const message = databaseActive 
      ? { type: 'stop_database_monitoring' }
      : { type: 'start_database_monitoring', interval: 10000 };
    sendMessage(message);
  };

  const updateThresholds = () => {
    sendMessage({
      type: 'update_thresholds',
      system: systemThresholds,
      database: databaseThresholds
    });
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getStatusColor = (active: boolean): string => {
    return active ? 'text-green-600' : 'text-gray-400';
  };

  const getAlertColor = (severity: string): string => {
    return severity === 'critical' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800';
  };

  const currentSystemMetrics = systemMetrics[systemMetrics.length - 1];
  const currentDatabaseMetrics = databaseMetrics[databaseMetrics.length - 1];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Resource Monitoring</h1>
          <p className="text-gray-600">Real-time system and database performance monitoring</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            {isConnected ? (
              <Wifi className="h-5 w-5 text-green-600" />
            ) : (
              <WifiOff className="h-5 w-5 text-red-600" />
            )}
            <span className={`text-sm font-medium ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Monitoring</CardTitle>
            <div className="flex items-center space-x-2">
              <Server className={`h-4 w-4 ${getStatusColor(systemActive)}`} />
              <Switch
                checked={systemActive}
                onCheckedChange={toggleSystemMonitoring}
                disabled={!isConnected}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Status:</span>
                <Badge variant={systemActive ? "default" : "secondary"}>
                  {systemActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              {currentSystemMetrics && (
                <>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">CPU:</span>
                    <span className="text-sm font-medium">
                      {currentSystemMetrics.cpu.usage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Memory:</span>
                    <span className="text-sm font-medium">
                      {currentSystemMetrics.memory.usagePercent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Disk:</span>
                    <span className="text-sm font-medium">
                      {currentSystemMetrics.disk.usagePercent.toFixed(1)}%
                    </span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database Monitoring</CardTitle>
            <div className="flex items-center space-x-2">
              <Database className={`h-4 w-4 ${getStatusColor(databaseActive)}`} />
              <Switch
                checked={databaseActive}
                onCheckedChange={toggleDatabaseMonitoring}
                disabled={!isConnected || !databaseAvailable}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Status:</span>
                <Badge variant={databaseActive ? "default" : "secondary"}>
                  {databaseAvailable ? (databaseActive ? 'Active' : 'Inactive') : 'Unavailable'}
                </Badge>
              </div>
              {currentDatabaseMetrics && (
                <>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Connections:</span>
                    <span className="text-sm font-medium">
                      {currentDatabaseMetrics.connections.usagePercent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Cache Hit:</span>
                    <span className="text-sm font-medium">
                      {currentDatabaseMetrics.performance.cacheHitRatio.toFixed(1)}%
                    </span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="system">System Metrics</TabsTrigger>
          <TabsTrigger value="database">Database Metrics</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* System Overview Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Cpu className="h-5 w-5" />
                  <span>System Resources</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={systemMetrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={formatTime}
                      domain={['dataMin', 'dataMax']}
                    />
                    <YAxis domain={[0, 100]} />
                    <Tooltip 
                      labelFormatter={(timestamp) => `Time: ${formatTime(timestamp)}`}
                      formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="cpu.usage" 
                      stroke="#8884d8" 
                      name="CPU" 
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="memory.usagePercent" 
                      stroke="#82ca9d" 
                      name="Memory" 
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="disk.usagePercent" 
                      stroke="#ffc658" 
                      name="Disk" 
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Database Overview Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Database className="h-5 w-5" />
                  <span>Database Performance</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {databaseMetrics.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={databaseMetrics}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="timestamp" 
                        tickFormatter={formatTime}
                        domain={['dataMin', 'dataMax']}
                      />
                      <YAxis domain={[0, 100]} />
                      <Tooltip 
                        labelFormatter={(timestamp) => `Time: ${formatTime(timestamp)}`}
                        formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="connections.usagePercent" 
                        stroke="#8884d8" 
                        name="Connection Usage" 
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="performance.cacheHitRatio" 
                        stroke="#82ca9d" 
                        name="Cache Hit Ratio" 
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="performance.indexHitRatio" 
                        stroke="#ffc658" 
                        name="Index Hit Ratio" 
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-gray-500">
                    <div className="text-center">
                      <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No database metrics available</p>
                      <p className="text-sm">Start database monitoring to see data</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          {/* System Metrics Detail */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>CPU & Memory Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={systemMetrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" tickFormatter={formatTime} />
                    <YAxis domain={[0, 100]} />
                    <Tooltip 
                      labelFormatter={(timestamp) => `Time: ${formatTime(timestamp)}`}
                      formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="cpu.usage" 
                      stackId="1" 
                      stroke="#8884d8" 
                      fill="#8884d8" 
                      fillOpacity={0.3}
                      name="CPU Usage"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="memory.usagePercent" 
                      stackId="2" 
                      stroke="#82ca9d" 
                      fill="#82ca9d" 
                      fillOpacity={0.3}
                      name="Memory Usage"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Network Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={systemMetrics.slice(-10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" tickFormatter={formatTime} />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(timestamp) => `Time: ${formatTime(timestamp)}`}
                      formatter={(value: number, name: string) => [formatBytes(value), name]}
                    />
                    <Bar dataKey="network.rxSec" fill="#8884d8" name="Download" />
                    <Bar dataKey="network.txSec" fill="#82ca9d" name="Upload" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="database">
          {/* Database Metrics Detail */}
          {databaseAvailable ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Connection Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <AreaChart data={databaseMetrics}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="timestamp" tickFormatter={formatTime} />
                      <YAxis />
                      <Tooltip 
                        labelFormatter={(timestamp) => `Time: ${formatTime(timestamp)}`}
                        formatter={(value: number) => [value, 'connections']}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="connections.active" 
                        stackId="1" 
                        stroke="#8884d8" 
                        fill="#8884d8" 
                        fillOpacity={0.6}
                        name="Active"
                      />
                      <Area 
                        type="monotone" 
                        dataKey="connections.idle" 
                        stackId="1" 
                        stroke="#82ca9d" 
                        fill="#82ca9d" 
                        fillOpacity={0.6}
                        name="Idle"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Query Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={databaseMetrics}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="timestamp" tickFormatter={formatTime} />
                      <YAxis />
                      <Tooltip 
                        labelFormatter={(timestamp) => `Time: ${formatTime(timestamp)}`}
                        formatter={(value: number, name: string) => [value.toFixed(2), name]}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="performance.avgQueryTime" 
                        stroke="#8884d8" 
                        name="Avg Query Time (ms)" 
                        strokeWidth={2}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="performance.slowQueries" 
                        stroke="#ff7300" 
                        name="Slow Queries" 
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-center h-[400px] text-gray-500">
                  <div className="text-center">
                    <Database className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-semibold mb-2">Database Monitoring Unavailable</h3>
                    <p>Database monitoring is not configured or unavailable.</p>
                    <p className="text-sm">Check your environment configuration.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* System Alerts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5" />
                  <span>System Alerts</span>
                  <Badge variant="outline">{systemAlerts.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {systemAlerts.length > 0 ? (
                    systemAlerts.map((alert, index) => (
                      <Alert key={index} className={getAlertColor(alert.severity)}>
                        <AlertDescription>
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">{alert.message}</p>
                              <p className="text-sm opacity-75">
                                Value: {alert.value.toFixed(1)} | Threshold: {alert.threshold}
                              </p>
                            </div>
                            <span className="text-xs opacity-75">
                              {formatTime(alert.timestamp)}
                            </span>
                          </div>
                        </AlertDescription>
                      </Alert>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No system alerts</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Database Alerts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Database className="h-5 w-5" />
                  <span>Database Alerts</span>
                  <Badge variant="outline">{databaseAlerts.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {databaseAlerts.length > 0 ? (
                    databaseAlerts.map((alert, index) => (
                      <Alert key={index} className={getAlertColor(alert.severity)}>
                        <AlertDescription>
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">{alert.message}</p>
                              <p className="text-sm opacity-75">
                                Value: {alert.value.toFixed(1)} | Threshold: {alert.threshold}
                              </p>
                            </div>
                            <span className="text-xs opacity-75">
                              {formatTime(alert.timestamp)}
                            </span>
                          </div>
                        </AlertDescription>
                      </Alert>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No database alerts</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* System Alert Thresholds */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Settings className="h-5 w-5" />
                  <span>System Alert Thresholds</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cpu-threshold">CPU Usage (%)</Label>
                  <Input
                    id="cpu-threshold"
                    type="number"
                    value={systemThresholds.cpu}
                    onChange={(e) => setSystemThresholds(prev => ({ 
                      ...prev, 
                      cpu: Number(e.target.value) 
                    }))}
                    min="0"
                    max="100"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="memory-threshold">Memory Usage (%)</Label>
                  <Input
                    id="memory-threshold"
                    type="number"
                    value={systemThresholds.memory}
                    onChange={(e) => setSystemThresholds(prev => ({ 
                      ...prev, 
                      memory: Number(e.target.value) 
                    }))}
                    min="0"
                    max="100"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="disk-threshold">Disk Usage (%)</Label>
                  <Input
                    id="disk-threshold"
                    type="number"
                    value={systemThresholds.disk}
                    onChange={(e) => setSystemThresholds(prev => ({ 
                      ...prev, 
                      disk: Number(e.target.value) 
                    }))}
                    min="0"
                    max="100"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="temp-threshold">Temperature (°C)</Label>
                  <Input
                    id="temp-threshold"
                    type="number"
                    value={systemThresholds.temperature}
                    onChange={(e) => setSystemThresholds(prev => ({ 
                      ...prev, 
                      temperature: Number(e.target.value) 
                    }))}
                    min="0"
                    max="150"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Database Alert Thresholds */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Database className="h-5 w-5" />
                  <span>Database Alert Thresholds</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="conn-threshold">Connection Usage (%)</Label>
                  <Input
                    id="conn-threshold"
                    type="number"
                    value={databaseThresholds.connectionUsage}
                    onChange={(e) => setDatabaseThresholds(prev => ({ 
                      ...prev, 
                      connectionUsage: Number(e.target.value) 
                    }))}
                    min="0"
                    max="100"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cache-threshold">Min Cache Hit Ratio (%)</Label>
                  <Input
                    id="cache-threshold"
                    type="number"
                    value={databaseThresholds.cacheHitRatio}
                    onChange={(e) => setDatabaseThresholds(prev => ({ 
                      ...prev, 
                      cacheHitRatio: Number(e.target.value) 
                    }))}
                    min="0"
                    max="100"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="index-threshold">Min Index Hit Ratio (%)</Label>
                  <Input
                    id="index-threshold"
                    type="number"
                    value={databaseThresholds.indexHitRatio}
                    onChange={(e) => setDatabaseThresholds(prev => ({ 
                      ...prev, 
                      indexHitRatio: Number(e.target.value) 
                    }))}
                    min="0"
                    max="100"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slow-threshold">Max Slow Queries</Label>
                  <Input
                    id="slow-threshold"
                    type="number"
                    value={databaseThresholds.slowQueryCount}
                    onChange={(e) => setDatabaseThresholds(prev => ({ 
                      ...prev, 
                      slowQueryCount: Number(e.target.value) 
                    }))}
                    min="0"
                  />
                </div>
                
                <Button 
                  onClick={updateThresholds}
                  disabled={!isConnected}
                  className="w-full"
                >
                  Update Thresholds
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}; 