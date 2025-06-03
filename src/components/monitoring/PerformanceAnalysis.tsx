import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, CheckCircle, XCircle, Activity, Database, Cpu, HardDrive, RefreshCw } from 'lucide-react';
import {
  PerformanceAnalysisService,
  PerformanceReport,
  BottleneckAnalysis,
  LoadTestResult,
} from '@/services/performanceAnalysisService';
import { ResourceMonitoringService } from '@/services/resourceMonitoringService';
import { DatabaseMonitoringService } from '@/services/databaseMonitoringService';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface PerformanceAnalysisProps {
  className?: string;
}

export const PerformanceAnalysis: React.FC<PerformanceAnalysisProps> = ({ className }) => {
  const [performanceService, setPerformanceService] = useState<PerformanceAnalysisService | null>(null);
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<LoadTestResult[]>([]);

  // Initialize performance analysis service
  useEffect(() => {
    const initializeService = async () => {
      try {
        // Create monitoring services
        const resourceMonitoring = new ResourceMonitoringService();
        const databaseMonitoring = new DatabaseMonitoringService(
          'https://uqprvrrncpqhpfxafeuc.supabase.co',
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxcHJ2cnJuY3BxaHBmeGFmZXVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzODExNjcsImV4cCI6MjA2Mzk1NzE2N30.k589z5xDaS10D4CZaNq16Egixr8CBk5C0InRt1BTdTE'
        );

        const perfService = new PerformanceAnalysisService(resourceMonitoring, databaseMonitoring);
        setPerformanceService(perfService);

        // Load existing test results for analysis
        await loadExistingTestResults(perfService);
      } catch (err) {
        setError('Failed to initialize performance analysis service');
        console.error('Performance service initialization error:', err);
      }
    };

    initializeService();
  }, []);

  const loadExistingTestResults = async (service: PerformanceAnalysisService) => {
    try {
      // Simulate loading JTL results from the existing test run
      const jtlContent = `timeStamp,elapsed,label,responseCode,responseMessage,threadName,dataType,success,failureMessage,bytes,sentBytes,grpThreads,allThreads,URL,Latency,IdleTime,Connect
1748976368944,3,Insert User Feedback,null 0,java.sql.SQLException: Cannot load JDBC driver class 'org.postgresql.Driver',Write Operations 2-1,text,false,,53,0,1,1,null,0,0,3
1748976370954,1,Update User Activity,null 0,java.sql.SQLException: Cannot load JDBC driver class 'org.postgresql.Driver',Write Operations 2-1,text,false,,53,0,1,1,null,0,0,1
1748976372965,1,Insert User Feedback,null 0,java.sql.SQLException: Cannot load JDBC driver class 'org.postgresql.Driver',Write Operations 2-1,text,false,,53,0,2,2,null,0,0,1`;

      const results = service.parseJTLResults(jtlContent);
      setTestResults(results);
    } catch (err) {
      console.warn('Failed to load existing test results:', err);
    }
  };

  const runPerformanceAnalysis = useCallback(async () => {
    if (!performanceService) return;

    setLoading(true);
    setError(null);

    try {
      // Generate performance report with current data
      const analysisReport = await performanceService.analyzeFromFiles('test_results.jtl', 'test_20250603_194243');
      setReport(analysisReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run performance analysis');
    } finally {
      setLoading(false);
    }
  }, [performanceService]);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'medium':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'database':
        return <Database className="h-4 w-4" />;
      case 'system':
        return <Cpu className="h-4 w-4" />;
      case 'network':
        return <Activity className="h-4 w-4" />;
      default:
        return <HardDrive className="h-4 w-4" />;
    }
  };

  const formatMetricValue = (value: number, unit: string) => {
    if (unit === 'ms') {
      return `${value.toFixed(1)}ms`;
    } else if (unit === '%') {
      return `${value.toFixed(1)}%`;
    } else if (unit === 'req/s') {
      return `${value.toFixed(2)} req/s`;
    }
    return `${value.toFixed(2)} ${unit}`;
  };

  const getGoalStatusColor = (status: 'pass' | 'fail') => {
    return status === 'pass' ? 'text-green-600' : 'text-red-600';
  };

  if (error) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Performance Analysis Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Performance Analysis & Bottleneck Identification</h2>
          <p className="text-muted-foreground">
            Analyze load test results to identify performance bottlenecks and optimization opportunities
          </p>
        </div>
        <Button 
          onClick={runPerformanceAnalysis} 
          disabled={loading || !performanceService}
          className="min-w-[140px]"
        >
          {loading ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Activity className="mr-2 h-4 w-4" />
              Run Analysis
            </>
          )}
        </Button>
      </div>

      {/* Performance Report */}
      {report && (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="bottlenecks">Bottlenecks</TabsTrigger>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
            <TabsTrigger value="metrics">Detailed Metrics</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Performance Goals */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Goals Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.entries(report.performanceGoals).map(([goal, data]) => (
                    <div key={goal} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium capitalize">{goal.replace(/([A-Z])/g, ' $1')}</span>
                        {data.status === 'pass' ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>Current:</span>
                          <span className={getGoalStatusColor(data.status)}>
                            {formatMetricValue(data.current, goal === 'throughput' ? 'req/s' : goal === 'responseTime' ? 'ms' : '%')}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>Target:</span>
                          <span>
                            {formatMetricValue(data.target, goal === 'throughput' ? 'req/s' : goal === 'responseTime' ? 'ms' : '%')}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Test Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Test Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{report.summary.totalRequests}</div>
                    <div className="text-sm text-muted-foreground">Total Requests</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{report.summary.successfulRequests}</div>
                    <div className="text-sm text-muted-foreground">Successful</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{report.summary.failedRequests}</div>
                    <div className="text-sm text-muted-foreground">Failed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{report.summary.errorRate.toFixed(1)}%</div>
                    <div className="text-sm text-muted-foreground">Error Rate</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Critical Issues Alert */}
            {report.bottlenecks.filter(b => b.severity === 'critical').length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Critical Performance Issues Detected</AlertTitle>
                <AlertDescription>
                  {report.bottlenecks.filter(b => b.severity === 'critical').length} critical bottleneck(s) require immediate attention.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          {/* Bottlenecks Tab */}
          <TabsContent value="bottlenecks" className="space-y-4">
            {report.bottlenecks.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                    <p>No performance bottlenecks detected</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              report.bottlenecks.map((bottleneck) => (
                <Card key={bottleneck.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getTypeIcon(bottleneck.type)}
                        <CardTitle className="text-lg">{bottleneck.description}</CardTitle>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={getSeverityColor(bottleneck.severity) as any}>
                          {bottleneck.severity}
                        </Badge>
                        <div className="flex items-center space-x-1">
                          {getSeverityIcon(bottleneck.severity)}
                          <span className="text-sm font-medium">Impact: {bottleneck.impact}/10</span>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Metrics */}
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <span>Current Value:</span>
                        <span className="font-medium">
                          {formatMetricValue(bottleneck.metrics.current, bottleneck.metrics.unit)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <span>Threshold:</span>
                        <span className="font-medium">
                          {formatMetricValue(bottleneck.metrics.threshold, bottleneck.metrics.unit)}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Performance vs Threshold</span>
                          <span>
                            {((bottleneck.metrics.current / bottleneck.metrics.threshold) * 100).toFixed(1)}%
                          </span>
                        </div>
                        <Progress 
                          value={Math.min(100, (bottleneck.metrics.current / bottleneck.metrics.threshold) * 100)}
                          className="h-2"
                        />
                      </div>

                      {/* Affected Operations */}
                      <div>
                        <h4 className="font-medium mb-2">Affected Operations:</h4>
                        <div className="flex flex-wrap gap-2">
                          {bottleneck.affectedOperations.map((operation, index) => (
                            <Badge key={index} variant="outline">
                              {operation}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Recommendations */}
                      <div>
                        <h4 className="font-medium mb-2">Recommendations:</h4>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          {bottleneck.recommendations.map((rec, index) => (
                            <li key={index}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Recommendations Tab */}
          <TabsContent value="recommendations" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Immediate Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-red-600">Immediate Actions</CardTitle>
                  <p className="text-sm text-muted-foreground">Critical issues requiring immediate attention</p>
                </CardHeader>
                <CardContent>
                  {report.recommendations.immediate.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No immediate actions required</p>
                  ) : (
                    <ul className="space-y-2">
                      {report.recommendations.immediate.map((rec, index) => (
                        <li key={index} className="text-sm flex items-start space-x-2">
                          <span className="text-red-600 font-bold">•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              {/* Short-term Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-orange-600">Short-term Actions</CardTitle>
                  <p className="text-sm text-muted-foreground">Actions to implement within 1-4 weeks</p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {report.recommendations.shortTerm.map((rec, index) => (
                      <li key={index} className="text-sm flex items-start space-x-2">
                        <span className="text-orange-600 font-bold">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Long-term Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-blue-600">Long-term Actions</CardTitle>
                  <p className="text-sm text-muted-foreground">Strategic improvements for scalability</p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {report.recommendations.longTerm.map((rec, index) => (
                      <li key={index} className="text-sm flex items-start space-x-2">
                        <span className="text-blue-600 font-bold">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Detailed Metrics Tab */}
          <TabsContent value="metrics" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Response Time Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Response Time Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>Average: {report.summary.avgResponseTime.toFixed(1)}ms</div>
                      <div>Maximum: {report.summary.maxResponseTime.toFixed(1)}ms</div>
                    </div>
                    {/* Response time chart would go here */}
                    <div className="h-32 bg-muted rounded flex items-center justify-center text-muted-foreground">
                      Response Time Chart (Data visualization would appear here)
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Throughput Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle>Throughput Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>Requests/sec: {report.summary.throughput.toFixed(2)}</div>
                      <div>Total Duration: {report.duration.toFixed(1)}s</div>
                    </div>
                    <div className="h-32 bg-muted rounded flex items-center justify-center text-muted-foreground">
                      Throughput Chart (Data visualization would appear here)
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}

      {!report && !loading && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-4" />
              <p>Click "Run Analysis" to generate a performance report</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}; 