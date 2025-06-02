import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  analyticsPerformanceService,
  PerformanceMetrics,
  PerformanceBottleneck
} from '@/lib/services/analytics-performance-service';
import {
  Zap,
  Activity,
  Clock,
  MemoryStick,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Settings,
  BarChart3
} from 'lucide-react';

interface PerformanceDashboardProps {
  organizationId?: string;
  projectId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // in seconds
}

interface ComponentPerformance {
  componentName: string;
  metrics: PerformanceMetrics;
  recommendations: string[];
  lastUpdated: Date;
}

export function PerformanceDashboard({
  organizationId,
  projectId,
  autoRefresh = true,
  refreshInterval = 30
}: PerformanceDashboardProps) {
  const [componentMetrics, setComponentMetrics] = useState<Map<string, ComponentPerformance>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);

  // Aggregate performance metrics
  const aggregatedMetrics = useMemo(() => {
    const components = Array.from(componentMetrics.values());
    if (components.length === 0) {
      return {
        averageRenderTime: 0,
        totalDataPoints: 0,
        averageMemoryUsage: 0,
        overallCacheHitRate: 0,
        criticalBottlenecks: 0,
        totalComponents: 0,
        optimizationLevel: 'none' as const
      };
    }

    const avgRenderTime = components.reduce((sum, comp) => sum + comp.metrics.renderTime, 0) / components.length;
    const totalDataPoints = components.reduce((sum, comp) => sum + comp.metrics.dataPointCount, 0);
    const avgMemoryUsage = components.reduce((sum, comp) => sum + comp.metrics.memoryUsage, 0) / components.length;
    const avgCacheHitRate = components.reduce((sum, comp) => sum + comp.metrics.cacheHitRate, 0) / components.length;
    const criticalBottlenecks = components.reduce((sum, comp) => 
      sum + comp.metrics.bottlenecks.filter(b => b.severity === 'critical' || b.severity === 'high').length, 0
    );

    // Determine overall optimization level
    let optimizationLevel: 'none' | 'basic' | 'advanced' | 'extreme' = 'none';
    if (avgRenderTime > 100) optimizationLevel = 'extreme';
    else if (avgRenderTime > 50) optimizationLevel = 'advanced';
    else if (avgRenderTime > 20) optimizationLevel = 'basic';

    return {
      averageRenderTime: avgRenderTime,
      totalDataPoints,
      averageMemoryUsage: avgMemoryUsage,
      overallCacheHitRate: avgCacheHitRate,
      criticalBottlenecks,
      totalComponents: components.length,
      optimizationLevel
    };
  }, [componentMetrics]);

  // Mock data loading - in real implementation, this would fetch from analytics service
  const loadPerformanceData = async () => {
    setIsLoading(true);
    try {
      // Simulate loading component performance data
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Generate mock performance data for demonstration
      const mockComponents = [
        'quality-trends-main',
        'error-distribution-sidebar',
        'trend-analysis-overview',
        'comparison-charts'
      ];

      const newMetrics = new Map<string, ComponentPerformance>();

      mockComponents.forEach((componentName, index) => {
        const renderTime = Math.random() * 100 + 10; // 10-110ms
        const dataPointCount = Math.floor(Math.random() * 10000) + 100; // 100-10100 points
        const memoryUsage = Math.random() * 50 + 5; // 5-55MB

        const bottlenecks: PerformanceBottleneck[] = [];
        if (renderTime > 50) {
          bottlenecks.push({
            type: 'rendering',
            severity: renderTime > 80 ? 'critical' : 'high',
            description: `Render time ${renderTime.toFixed(2)}ms exceeds performance budget`,
            recommendation: 'Consider implementing data virtualization',
            impact: Math.min(10, Math.floor(renderTime / 10))
          });
        }

        if (dataPointCount > 5000) {
          bottlenecks.push({
            type: 'data-processing',
            severity: 'medium',
            description: `Large dataset with ${dataPointCount} data points`,
            recommendation: 'Implement data sampling and aggregation',
            impact: Math.min(10, Math.floor(dataPointCount / 1000))
          });
        }

        const metrics: PerformanceMetrics = {
          renderTime,
          dataProcessingTime: renderTime * 0.8,
          memoryUsage,
          cacheHitRate: Math.random() * 0.4 + 0.6, // 60-100%
          componentCount: 1,
          dataPointCount,
          optimizationLevel: renderTime > 80 ? 'extreme' : 
                           renderTime > 50 ? 'advanced' : 
                           renderTime > 20 ? 'basic' : 'none',
          bottlenecks
        };

        const recommendations = analyticsPerformanceService.getOptimizationRecommendations(componentName);

        newMetrics.set(componentName, {
          componentName,
          metrics,
          recommendations,
          lastUpdated: new Date()
        });
      });

      setComponentMetrics(newMetrics);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to load performance data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    loadPerformanceData();

    if (autoRefresh) {
      const interval = setInterval(loadPerformanceData, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  const getPerformanceStatus = (renderTime: number) => {
    if (renderTime < 16) return { status: 'excellent', color: 'text-green-600', icon: CheckCircle };
    if (renderTime < 32) return { status: 'good', color: 'text-blue-600', icon: CheckCircle };
    if (renderTime < 50) return { status: 'warning', color: 'text-yellow-600', icon: AlertTriangle };
    return { status: 'critical', color: 'text-red-600', icon: AlertTriangle };
  };

  const getOptimizationBadgeColor = (level: string) => {
    switch (level) {
      case 'none': return 'bg-green-100 text-green-800';
      case 'basic': return 'bg-blue-100 text-blue-800';
      case 'advanced': return 'bg-orange-100 text-orange-800';
      case 'extreme': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Performance Dashboard</h2>
          <p className="text-muted-foreground">
            Real-time analytics performance monitoring and optimization
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={loadPerformanceData}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Render Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {aggregatedMetrics.averageRenderTime.toFixed(1)}ms
            </div>
            <div className="flex items-center gap-2 mt-1">
              {(() => {
                const { status, color, icon: Icon } = getPerformanceStatus(aggregatedMetrics.averageRenderTime);
                return (
                  <>
                    <Icon className={`h-3 w-3 ${color}`} />
                    <span className={`text-xs ${color}`}>{status}</span>
                  </>
                );
              })()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Points</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {aggregatedMetrics.totalDataPoints.toLocaleString()}
            </div>
            <Badge variant="outline" className="mt-1 text-xs">
              {aggregatedMetrics.totalComponents} components
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
            <MemoryStick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {aggregatedMetrics.averageMemoryUsage.toFixed(1)}MB
            </div>
            <Progress 
              value={Math.min(100, aggregatedMetrics.averageMemoryUsage)} 
              className="mt-2 h-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(aggregatedMetrics.overallCacheHitRate * 100).toFixed(1)}%
            </div>
            <div className="flex items-center gap-2 mt-1">
              {aggregatedMetrics.overallCacheHitRate > 0.8 ? (
                <TrendingUp className="h-3 w-3 text-green-600" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-600" />
              )}
              <span className="text-xs text-muted-foreground">
                {aggregatedMetrics.overallCacheHitRate > 0.8 ? 'Excellent' : 'Needs improvement'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Alerts */}
      {aggregatedMetrics.criticalBottlenecks > 0 && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {aggregatedMetrics.criticalBottlenecks} critical performance bottlenecks detected across components.
            <Button variant="link" className="p-0 h-auto ml-1">
              View details below
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Detailed Performance Tabs */}
      <Tabs defaultValue="components" className="space-y-4">
        <TabsList>
          <TabsTrigger value="components">Component Performance</TabsTrigger>
          <TabsTrigger value="bottlenecks">Bottlenecks</TabsTrigger>
          <TabsTrigger value="recommendations">Optimization</TabsTrigger>
        </TabsList>

        <TabsContent value="components">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Array.from(componentMetrics.values()).map((component) => (
              <Card 
                key={component.componentName}
                className={`cursor-pointer transition-all ${
                  selectedComponent === component.componentName ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setSelectedComponent(component.componentName)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">
                      {component.componentName}
                    </CardTitle>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${getOptimizationBadgeColor(component.metrics.optimizationLevel)}`}
                    >
                      {component.metrics.optimizationLevel}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Render:</span>
                      <span className="ml-2 font-medium">
                        {component.metrics.renderTime.toFixed(1)}ms
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Memory:</span>
                      <span className="ml-2 font-medium">
                        {component.metrics.memoryUsage.toFixed(1)}MB
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Data Points:</span>
                      <span className="ml-2 font-medium">
                        {component.metrics.dataPointCount.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Cache:</span>
                      <span className="ml-2 font-medium">
                        {(component.metrics.cacheHitRate * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  
                  {component.metrics.bottlenecks.length > 0 && (
                    <div className="flex gap-1 flex-wrap mt-2">
                      {component.metrics.bottlenecks.map((bottleneck, index) => (
                        <Badge 
                          key={index}
                          variant="destructive" 
                          className={`text-xs ${
                            bottleneck.severity === 'critical' ? 'bg-red-600' :
                            bottleneck.severity === 'high' ? 'bg-red-500' :
                            bottleneck.severity === 'medium' ? 'bg-orange-500' :
                            'bg-yellow-500'
                          }`}
                        >
                          {bottleneck.type}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="bottlenecks">
          <div className="space-y-4">
            {Array.from(componentMetrics.values()).map((component) => 
              component.metrics.bottlenecks.length > 0 && (
                <Card key={component.componentName}>
                  <CardHeader>
                    <CardTitle className="text-sm">{component.componentName}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {component.metrics.bottlenecks.map((bottleneck, index) => (
                        <div key={index} className="border-l-4 border-red-200 pl-4">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge 
                              variant="destructive"
                              className={`text-xs ${
                                bottleneck.severity === 'critical' ? 'bg-red-600' :
                                bottleneck.severity === 'high' ? 'bg-red-500' :
                                bottleneck.severity === 'medium' ? 'bg-orange-500' :
                                'bg-yellow-500'
                              }`}
                            >
                              {bottleneck.severity}
                            </Badge>
                            <span className="text-sm font-medium">{bottleneck.type}</span>
                            <span className="text-xs text-muted-foreground">
                              Impact: {bottleneck.impact}/10
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {bottleneck.description}
                          </p>
                          <p className="text-sm text-blue-600">
                            {bottleneck.recommendation}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            )}
          </div>
        </TabsContent>

        <TabsContent value="recommendations">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Array.from(componentMetrics.values()).map((component) => 
              component.recommendations.length > 0 && (
                <Card key={component.componentName}>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      {component.componentName}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {component.recommendations.map((recommendation, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <Zap className="h-3 w-3 text-blue-500 mt-1 flex-shrink-0" />
                          {recommendation}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
} 