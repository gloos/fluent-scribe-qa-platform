import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { QualityTrendsChart } from "@/components/charts/QualityTrendsChart";
import { ErrorDistributionChart } from "@/components/charts/ErrorDistributionChart";
import { TrendAnalysisChart } from "@/components/charts/TrendAnalysisChart";
import { ComparisonChart } from "@/components/charts/ComparisonChart";
import { ViewEditor } from "@/components/analytics/ViewEditor";
import { 
  analyticsAggregationService,
  AnalyticsTimeRange 
} from "@/lib/services/analytics-aggregation-service";
import { ComparativeMetricsService } from "@/lib/services/comparative-metrics-service";
import { analyticsViewService, DashboardView, LayoutConfig } from "@/lib/services/analytics-view-service";
import { useAnalyticsViews } from "@/hooks/useAnalyticsViews";
import { 
  BarChart3, 
  TrendingUp, 
  AlertCircle, 
  Users, 
  Download,
  RefreshCw,
  Settings,
  Eye,
  Layers,
  Plus,
  Edit,
  Copy,
  Trash2,
  Lightbulb,
  MoreVertical
} from "lucide-react";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, subDays, subWeeks, subMonths } from "date-fns";
import { OptimizedChartWrapper } from "@/components/charts/OptimizedChartWrapper";

interface AnalyticsDashboardProps {
  organizationId?: string;
  projectId?: string;
  userId?: string;
  defaultStartDate?: Date;
  defaultEndDate?: Date;
}

export function AnalyticsDashboard({
  organizationId,
  projectId,
  userId,
  defaultStartDate,
  defaultEndDate
}: AnalyticsDashboardProps) {
  // Use the analytics views hook
  const {
    views,
    currentView,
    suggestions,
    isLoading: isLoadingViews,
    isLoadingSuggestions,
    isSaving,
    error: viewError,
    setCurrentView,
    createView,
    updateView,
    deleteView,
    duplicateView,
    refreshViews,
    clearError
  } = useAnalyticsViews({
    userId,
    organizationId,
    includeDefaults: true,
    enableSuggestions: true
  });

  // Date and period state
  const [startDate, setStartDate] = useState<Date>(
    defaultStartDate || subDays(new Date(), 30)
  );
  const [endDate, setEndDate] = useState<Date>(
    defaultEndDate || new Date()
  );
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [isLoading, setIsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(5); // minutes

  // View editor state
  const [isViewEditorOpen, setIsViewEditorOpen] = useState(false);
  const [editingView, setEditingView] = useState<DashboardView | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Analytics data state
  const [qualityData, setQualityData] = useState<any[]>([]);
  const [errorData, setErrorData] = useState<any[]>([]);
  const [processingData, setProcessingData] = useState<any[]>([]);
  const [engagementData, setEngagementData] = useState<any[]>([]);

  const timeRange: AnalyticsTimeRange = {
    start: startDate,
    end: endDate,
    period
  };

  const options = {
    organizationId,
    projectId,
    userId,
    timeRange,
    includeCache: true
  };

  const loadAnalyticsData = async () => {
    setIsLoading(true);
    try {
      const [quality, errors, processing, engagement] = await Promise.all([
        analyticsAggregationService.getQualityTrends(options),
        analyticsAggregationService.getErrorDistribution(options),
        analyticsAggregationService.getProcessingEfficiency(options),
        analyticsAggregationService.getUserEngagement(options)
      ]);

      setQualityData(quality);
      setErrorData(errors);
      setProcessingData(processing);
      setEngagementData(engagement);
    } catch (error) {
      console.error('Failed to load analytics data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnalyticsData();
  }, [startDate, endDate, period, organizationId, projectId, userId]);

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadAnalyticsData();
    }, refreshInterval * 60 * 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  const handleRefresh = () => {
    analyticsAggregationService.clearCache();
    loadAnalyticsData();
    refreshViews();
  };

  const handleExport = () => {
    const exportData = {
      timeRange,
      qualityData,
      errorData,
      processingData,
      engagementData,
      currentView: currentView?.name,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${format(new Date(), 'yyyy-MM-dd-HHmm')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getComponentSize = (size: string) => {
    switch (size) {
      case 'small': return 'col-span-1 row-span-1';
      case 'medium': return 'col-span-1 row-span-2 md:col-span-2 md:row-span-1';
      case 'large': return 'col-span-1 row-span-2 md:col-span-2 md:row-span-2';
      case 'full': return 'col-span-1 row-span-3 md:col-span-4 md:row-span-2';
      default: return 'col-span-1 row-span-1';
    }
  };

  const renderComponent = (config: LayoutConfig) => {
    // Skip rendering if component is not visible
    if (config.isVisible === false) return null;

    const commonProps = {
      height: config.size === 'small' ? 200 : config.size === 'medium' ? 300 : 400,
      loading: isLoading,
      ...config.props
    };

    // Get appropriate data for each component type
    let componentData: any[] = [];
    let chartType: 'line' | 'bar' | 'pie' | 'scatter' = 'line';

    switch (config.component) {
      case 'quality-trends':
        componentData = qualityData;
        chartType = 'line';
        break;
      case 'error-distribution':
        componentData = errorData;
        chartType = config.props?.chartType === 'bar' ? 'bar' : 'pie';
        break;
      case 'trend-analysis':
        componentData = processingData; // Use processing data for trend analysis
        chartType = 'line';
        break;
      case 'comparison':
        componentData = ComparativeMetricsService.createTimeBasedComparison(
          timeRange.end,
          ['week', 'month']
        );
        chartType = 'bar';
        break;
    }

    // Render chart component with optimization wrapper
    const chartComponent = (() => {
      switch (config.component) {
        case 'quality-trends':
          return (
            <QualityTrendsChart
              data={qualityData}
              period={period}
              {...commonProps}
            />
          );
        case 'error-distribution':
          return (
            <ErrorDistributionChart
              data={errorData}
              {...commonProps}
            />
          );
        case 'trend-analysis':
          return (
            <TrendAnalysisChart
              startDate={timeRange.start}
              endDate={timeRange.end}
              {...commonProps}
            />
          );
        case 'comparison':
          const comparisonDatasets = ComparativeMetricsService.createTimeBasedComparison(
            timeRange.end,
            ['week', 'month']
          );
          return (
            <ComparisonChart
              datasets={comparisonDatasets}
              {...commonProps}
            />
          );
        default:
          return <div>Unknown component</div>;
      }
    })();

    // Wrap with performance optimization
    return (
      <OptimizedChartWrapper
        data={componentData}
        chartType={chartType}
        title={config.title}
        componentName={`${config.component}-${config.id}`}
        height={commonProps.height}
        enablePerformanceMonitoring={true}
        autoOptimize={true}
        showPerformanceMetrics={false} // Set to true for development/debugging
        onPerformanceUpdate={(metrics) => {
          // Optional: Handle performance metrics for monitoring
          console.log(`Performance metrics for ${config.component}:`, metrics);
        }}
      >
        {chartComponent}
      </OptimizedChartWrapper>
    );
  };

  const handleViewChange = async (viewId: string) => {
    const view = views.find(v => v.id === viewId);
    if (view) {
      await setCurrentView(view);
    }
  };

  const handleCreateView = () => {
    setEditingView(null);
    setIsViewEditorOpen(true);
  };

  const handleEditView = (view: DashboardView) => {
    setEditingView(view);
    setIsViewEditorOpen(true);
  };

  const handleDuplicateView = async (view: DashboardView) => {
    try {
      await duplicateView(view.id, `${view.name} (Copy)`);
    } catch (error) {
      console.error('Failed to duplicate view:', error);
    }
  };

  const handleDeleteView = async (view: DashboardView) => {
    if (view.isDefault) return;
    
    if (confirm(`Are you sure you want to delete "${view.name}"?`)) {
      try {
        await deleteView(view.id);
      } catch (error) {
        console.error('Failed to delete view:', error);
      }
    }
  };

  const handleViewSave = async (view: DashboardView) => {
    try {
      if (editingView) {
        await updateView(view.id, view);
      } else {
        await createView(view);
      }
    } catch (error) {
      console.error('Failed to save view:', error);
    }
  };

  const applySuggestion = async (suggestion: any) => {
    try {
      const newView = await createView({
        name: `${suggestion.template.name} (Suggested)`,
        description: suggestion.template.description,
        layout: suggestion.template.layout,
        tags: [...suggestion.template.tags, 'suggested']
      });
      await setCurrentView(newView);
      setShowSuggestions(false);
    } catch (error) {
      console.error('Failed to apply suggestion:', error);
    }
  };

  // Get default templates for the editor
  const defaultTemplates = views.filter(view => view.isDefault).map(view => ({
    id: view.id,
    name: view.name,
    description: view.description || '',
    category: 'custom' as const,
    layout: view.layout,
    tags: view.tags || [],
    complexity: 'beginner' as const
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h2>
          <p className="text-muted-foreground">
            Comprehensive quality assurance insights and trends
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* View Suggestions */}
          {suggestions.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSuggestions(!showSuggestions)}
              className="relative"
            >
              <Lightbulb className="h-4 w-4 mr-2" />
              Suggestions
              <Badge variant="secondary" className="ml-2 text-xs">
                {suggestions.length}
              </Badge>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading || isLoadingViews}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading || isLoadingViews ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {viewError && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{viewError}</span>
              <Button variant="outline" size="sm" onClick={clearError}>
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* View Suggestions Panel */}
      {showSuggestions && suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Suggested Views
            </CardTitle>
            <CardDescription>
              AI-recommended dashboard configurations based on your data patterns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {suggestions.map((suggestion, index) => (
                <Card key={index} className="cursor-pointer hover:bg-accent" onClick={() => applySuggestion(suggestion)}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">{suggestion.template.name}</CardTitle>
                    <CardDescription className="text-xs">
                      {suggestion.template.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-xs">
                          {Math.round(suggestion.relevanceScore * 100)}% match
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {suggestion.template.complexity}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {suggestion.reasoning.slice(0, 2).join(', ')}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Date Range */}
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={format(startDate, 'yyyy-MM-dd')}
                onChange={(e) => setStartDate(new Date(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={format(endDate, 'yyyy-MM-dd')}
                onChange={(e) => setEndDate(new Date(e.target.value))}
              />
            </div>

            {/* Period */}
            <div className="space-y-2">
              <Label>Period</Label>
              <Select value={period} onValueChange={(value: any) => setPeriod(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* View Selection */}
            <div className="space-y-2">
              <Label>Dashboard View</Label>
              <div className="flex gap-2">
                <Select 
                  value={currentView?.id || ''} 
                  onValueChange={handleViewChange}
                  disabled={isLoadingViews}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select view..." />
                  </SelectTrigger>
                  <SelectContent>
                    {views.map(view => (
                      <SelectItem key={view.id} value={view.id}>
                        <div className="flex items-center gap-2">
                          <Eye className="h-4 w-4" />
                          {view.name}
                          {view.isDefault && <Badge variant="outline" className="text-xs">Default</Badge>}
                          {view.isCustom && <Badge variant="secondary" className="text-xs">Custom</Badge>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* View Actions */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>View Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleCreateView}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create New View
                    </DropdownMenuItem>
                    {currentView && (
                      <>
                        <DropdownMenuItem onClick={() => handleEditView(currentView)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Current View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicateView(currentView)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate View
                        </DropdownMenuItem>
                        {currentView.isCustom && (
                          <DropdownMenuItem 
                            onClick={() => handleDeleteView(currentView)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete View
                          </DropdownMenuItem>
                        )}
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Auto Refresh */}
            <div className="space-y-2">
              <Label>Auto Refresh</Label>
              <div className="flex items-center gap-2">
                <Switch
                  checked={autoRefresh}
                  onCheckedChange={setAutoRefresh}
                />
                <span className="text-sm text-muted-foreground">
                  {autoRefresh ? `Every ${refreshInterval}m` : 'Off'}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Quality Score</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {qualityData.length > 0 
                ? (qualityData.reduce((sum, d) => sum + d.avgMqmScore, 0) / qualityData.length).toFixed(1)
                : '---'
              }
            </div>
            <Badge variant="secondary" className="mt-1">
              {qualityData.length} sessions
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Errors</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {errorData.reduce((sum, d) => sum + d.count, 0)}
            </div>
            <Badge variant="destructive" className="mt-1">
              {errorData.filter(d => d.severity === 'critical').reduce((sum, d) => sum + d.count, 0)} critical
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing Efficiency</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {processingData.length > 0
                ? (processingData.reduce((sum, d) => sum + d.successRate, 0) / processingData.length).toFixed(1)
                : '---'
              }%
            </div>
            <Badge variant="outline" className="mt-1">
              Success Rate
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {engagementData.length > 0
                ? Math.max(...engagementData.map(d => d.activeUsers))
                : '---'
              }
            </div>
            <Badge variant="outline" className="mt-1">
              Peak Daily
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard Grid */}
      {currentView && currentView.layout && currentView.layout.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 auto-rows-min">
          {currentView.layout.map((config, index) => (
            config.isVisible !== false && (
              <Card key={config.id || index} className={getComponentSize(config.size)}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    {config.title || config.component.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {renderComponent(config)}
                </CardContent>
              </Card>
            )
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground py-8">
              <Layers className="h-12 w-12 mx-auto mb-4" />
              <h3 className="font-semibold mb-2">No Dashboard Layout</h3>
              <p className="mb-4">Create a custom view or select a default template to get started.</p>
              <Button onClick={handleCreateView}>
                <Plus className="h-4 w-4 mr-2" />
                Create Custom View
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* View Editor Modal */}
      <ViewEditor
        isOpen={isViewEditorOpen}
        onClose={() => {
          setIsViewEditorOpen(false);
          setEditingView(null);
        }}
        onSave={handleViewSave}
        view={editingView}
        templates={defaultTemplates}
        userId={userId}
        organizationId={organizationId}
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="p-6">
            <div className="flex items-center space-x-4">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <div>
                <h3 className="font-semibold">Loading Analytics</h3>
                <p className="text-sm text-muted-foreground">
                  Aggregating data and generating insights...
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
} 