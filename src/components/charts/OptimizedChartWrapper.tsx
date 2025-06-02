import React, { memo, useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { analyticsPerformanceService, DatasetComplexity } from '@/lib/services/analytics-performance-service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Zap, 
  TrendingUp, 
  AlertCircle, 
  BarChart3, 
  Settings,
  Eye,
  EyeOff
} from 'lucide-react';

export interface OptimizedChartWrapperProps {
  children: React.ReactElement;
  data: any[];
  chartType: 'line' | 'bar' | 'pie' | 'scatter';
  title?: string;
  description?: string;
  componentName: string;
  height?: number;
  enablePerformanceMonitoring?: boolean;
  autoOptimize?: boolean;
  showPerformanceMetrics?: boolean;
  onPerformanceUpdate?: (metrics: any) => void;
}

interface PerformanceState {
  isOptimized: boolean;
  optimizedData: any[];
  complexity: DatasetComplexity | null;
  renderTime: number;
  recommendations: string[];
  bottlenecks: any[];
  isLoading: boolean;
}

export const OptimizedChartWrapper = memo<OptimizedChartWrapperProps>(function OptimizedChartWrapper({
  children,
  data,
  chartType,
  title,
  description,
  componentName,
  height = 400,
  enablePerformanceMonitoring = true,
  autoOptimize = true,
  showPerformanceMetrics = false,
  onPerformanceUpdate
}) {
  const [performanceState, setPerformanceState] = useState<PerformanceState>({
    isOptimized: false,
    optimizedData: data,
    complexity: null,
    renderTime: 0,
    recommendations: [],
    bottlenecks: [],
    isLoading: false
  });

  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [showOptimizationPanel, setShowOptimizationPanel] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stopMonitoringRef = useRef<(() => void) | null>(null);

  // Memoized data complexity analysis
  const dataComplexity = useMemo(() => {
    if (data.length === 0) return null;
    return analyticsPerformanceService.analyzeDatasetComplexity(data);
  }, [data]);

  // Memoized optimized data based on viewport and complexity
  const optimizedData = useMemo(() => {
    if (!dataComplexity || !autoOptimize || viewportSize.width === 0) {
      return data;
    }

    try {
      return analyticsPerformanceService.optimizeDataForViewport(
        data,
        viewportSize.width,
        chartType
      );
    } catch (error) {
      console.error('Failed to optimize data:', error);
      return data;
    }
  }, [data, dataComplexity, viewportSize.width, chartType, autoOptimize]);

  // Update viewport size on mount and resize
  useEffect(() => {
    const updateViewportSize = () => {
      if (wrapperRef.current) {
        const rect = wrapperRef.current.getBoundingClientRect();
        setViewportSize({ width: rect.width, height: rect.height });
      }
    };

    updateViewportSize();
    window.addEventListener('resize', updateViewportSize);
    return () => window.removeEventListener('resize', updateViewportSize);
  }, []);

  // Performance monitoring setup
  useEffect(() => {
    if (!enablePerformanceMonitoring) return;

    const startMonitoring = () => {
      stopMonitoringRef.current = analyticsPerformanceService.startPerformanceMonitoring(componentName);
    };

    startMonitoring();

    return () => {
      if (stopMonitoringRef.current) {
        stopMonitoringRef.current();
      }
    };
  }, [enablePerformanceMonitoring, componentName]);

  // Measure component render performance
  const measureRenderPerformance = useCallback(async () => {
    if (!enablePerformanceMonitoring) return;

    setPerformanceState(prev => ({ ...prev, isLoading: true }));

    try {
      const { metrics } = await analyticsPerformanceService.measureComponentPerformance(
        componentName,
        async () => {
          // Simulate render operation
          return new Promise(resolve => setTimeout(resolve, 1));
        },
        optimizedData.length
      );

      const recommendations = analyticsPerformanceService.getOptimizationRecommendations(componentName);

      setPerformanceState(prev => ({
        ...prev,
        isOptimized: optimizedData.length < data.length,
        optimizedData,
        complexity: dataComplexity,
        renderTime: metrics.renderTime,
        recommendations,
        bottlenecks: metrics.bottlenecks,
        isLoading: false
      }));

      if (onPerformanceUpdate) {
        onPerformanceUpdate(metrics);
      }
    } catch (error) {
      console.error('Performance measurement failed:', error);
      setPerformanceState(prev => ({ ...prev, isLoading: false }));
    }
  }, [componentName, optimizedData, data, dataComplexity, enablePerformanceMonitoring, onPerformanceUpdate]);

  // Trigger performance measurement when data changes
  useEffect(() => {
    measureRenderPerformance();
  }, [measureRenderPerformance]);

  // Apply auto-optimizations
  useEffect(() => {
    if (autoOptimize && dataComplexity && dataComplexity.complexity >= 6) {
      analyticsPerformanceService.applyOptimizations(componentName, dataComplexity)
        .catch(error => console.error('Auto-optimization failed:', error));
    }
  }, [autoOptimize, dataComplexity, componentName]);

  const handleManualOptimization = useCallback(async () => {
    if (!dataComplexity) return;

    setPerformanceState(prev => ({ ...prev, isLoading: true }));
    
    try {
      await analyticsPerformanceService.applyOptimizations(componentName, dataComplexity);
      await measureRenderPerformance();
    } catch (error) {
      console.error('Manual optimization failed:', error);
      setPerformanceState(prev => ({ ...prev, isLoading: false }));
    }
  }, [dataComplexity, componentName, measureRenderPerformance]);

  const getComplexityColor = (complexity: number) => {
    if (complexity <= 3) return 'bg-green-100 text-green-800';
    if (complexity <= 6) return 'bg-yellow-100 text-yellow-800';
    if (complexity <= 8) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  const getOptimizationBadgeColor = (isOptimized: boolean) => {
    return isOptimized ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800';
  };

  // Clone children with optimized data
  const optimizedChildren = React.cloneElement(children, {
    data: optimizedData,
    height,
    loading: performanceState.isLoading
  });

  return (
    <div ref={wrapperRef} className="relative">
      <Card className="h-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                {title}
                
                {/* Performance Badges */}
                {dataComplexity && (
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${getComplexityColor(dataComplexity.complexity)}`}
                  >
                    Complexity: {dataComplexity.complexity}/10
                  </Badge>
                )}
                
                {performanceState.isOptimized && (
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${getOptimizationBadgeColor(true)}`}
                  >
                    <Zap className="h-3 w-3 mr-1" />
                    Optimized
                  </Badge>
                )}
              </CardTitle>
              
              {description && (
                <CardDescription className="flex items-center gap-2">
                  {description}
                  {performanceState.isOptimized && (
                    <span className="text-xs text-muted-foreground">
                      ({data.length} → {optimizedData.length} points)
                    </span>
                  )}
                </CardDescription>
              )}
            </div>

            {/* Performance Controls */}
            <div className="flex items-center gap-2">
              {performanceState.renderTime > 0 && (
                <Badge variant="outline" className="text-xs">
                  {performanceState.renderTime.toFixed(1)}ms
                </Badge>
              )}
              
              {showPerformanceMetrics && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowOptimizationPanel(!showOptimizationPanel)}
                >
                  {showOptimizationPanel ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              )}
              
              {dataComplexity && dataComplexity.complexity >= 4 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleManualOptimization}
                  disabled={performanceState.isLoading}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Performance Alerts */}
          {performanceState.bottlenecks.length > 0 && (
            <Alert className="mt-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Performance bottlenecks detected. 
                {performanceState.bottlenecks
                  .filter(b => b.severity === 'critical' || b.severity === 'high')
                  .length > 0 && (
                  <Button 
                    variant="link" 
                    className="p-0 h-auto ml-1"
                    onClick={() => setShowOptimizationPanel(true)}
                  >
                    View recommendations
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardHeader>

        {/* Optimization Panel */}
        {showOptimizationPanel && (
          <div className="px-6 pb-3 space-y-3">
            {/* Data Complexity Info */}
            {dataComplexity && (
              <div className="bg-muted/50 rounded-lg p-3">
                <h4 className="font-medium text-sm mb-2">Dataset Analysis</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Size:</span>
                    <Badge variant="outline" className="ml-1 text-xs">
                      {dataComplexity.size}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Dimensions:</span>
                    <Badge variant="outline" className="ml-1 text-xs">
                      {dataComplexity.dimensionality}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Temporal:</span>
                    <Badge variant="outline" className="ml-1 text-xs">
                      {dataComplexity.temporality}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Volatility:</span>
                    <Badge variant="outline" className="ml-1 text-xs">
                      {dataComplexity.volatility}
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            {/* Performance Recommendations */}
            {performanceState.recommendations.length > 0 && (
              <div className="bg-blue-50 rounded-lg p-3">
                <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Optimization Recommendations
                </h4>
                <ul className="text-xs space-y-1">
                  {performanceState.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="w-1 h-1 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Performance Bottlenecks */}
            {performanceState.bottlenecks.length > 0 && (
              <div className="bg-red-50 rounded-lg p-3">
                <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Performance Bottlenecks
                </h4>
                <div className="space-y-2">
                  {performanceState.bottlenecks.map((bottleneck, index) => (
                    <div key={index} className="text-xs">
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
                        <span className="font-medium">{bottleneck.type}</span>
                        <span className="text-muted-foreground">Impact: {bottleneck.impact}/10</span>
                      </div>
                      <p className="text-muted-foreground mb-1">{bottleneck.description}</p>
                      <p className="text-blue-600">{bottleneck.recommendation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <CardContent className="pt-0">
          {/* Loading Overlay */}
          {performanceState.isLoading && (
            <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-10">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">Optimizing performance...</p>
              </div>
            </div>
          )}

          {/* Optimized Chart Component */}
          <div style={{ height }} className="relative">
            {optimizedChildren}
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

export default OptimizedChartWrapper; 