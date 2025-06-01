import React, { useMemo, useState } from 'react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, Minus, Calendar, BarChart3 } from 'lucide-react';
import { 
  MQMDimension, 
  MQMErrorInstance, 
  MQMSeverity 
} from "@/lib/types/assessment";

interface TimeSeriesDataPoint {
  date: string;
  timestamp: number;
  totalErrors: number;
  criticalErrors: number;
  majorErrors: number;
  minorErrors: number;
  neutralErrors: number;
  avgSeverity: number;
  qualityScore: number;
  dimensions: Record<MQMDimension, number>;
  errorRate: number; // errors per 100 segments
  trend: 'improving' | 'declining' | 'stable';
}

interface TrendMetrics {
  direction: 'improving' | 'declining' | 'stable';
  magnitude: number;
  confidence: number;
  description: string;
}

interface TrendAnalysisChartProps {
  errors: MQMErrorInstance[];
  timeRange?: '7d' | '30d' | '90d' | '1y';
  className?: string;
}

const chartConfig = {
  totalErrors: {
    label: "Total Errors",
    color: "hsl(221 83% 53%)",
  },
  criticalErrors: {
    label: "Critical",
    color: "hsl(0 84% 60%)",
  },
  majorErrors: {
    label: "Major",
    color: "hsl(25 95% 53%)",
  },
  minorErrors: {
    label: "Minor",
    color: "hsl(47 96% 53%)",
  },
  qualityScore: {
    label: "Quality Score",
    color: "hsl(142 76% 36%)",
  },
} satisfies ChartConfig;

const getTrendIcon = (trend: 'improving' | 'declining' | 'stable') => {
  switch (trend) {
    case 'improving':
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    case 'declining':
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    case 'stable':
      return <Minus className="h-4 w-4 text-gray-500" />;
  }
};

const formatDate = (dateStr: string, granularity: 'day' | 'week' | 'month') => {
  const date = new Date(dateStr);
  switch (granularity) {
    case 'day':
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    case 'week':
      return `Week of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    case 'month':
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    default:
      return dateStr;
  }
};

export function TrendAnalysisChart({ errors, timeRange = '30d', className }: TrendAnalysisChartProps) {
  const [selectedMetric, setSelectedMetric] = useState<'errors' | 'severity' | 'quality'>('errors');
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('day');

  // Process time series data
  const timeSeriesData = useMemo((): TimeSeriesDataPoint[] => {
    if (errors.length === 0) return [];

    // Determine time range
    const now = new Date();
    const daysBack = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - daysBack);

    // Group errors by time period
    const timeGroups = new Map<string, MQMErrorInstance[]>();
    
    errors.forEach(error => {
      const errorDate = new Date(error.timestamp || Date.now());
      if (errorDate < startDate) return;

      let periodKey: string;
      if (granularity === 'day') {
        periodKey = errorDate.toISOString().split('T')[0];
      } else if (granularity === 'week') {
        const weekStart = new Date(errorDate);
        weekStart.setDate(weekStart.getDate() - errorDate.getDay());
        periodKey = weekStart.toISOString().split('T')[0];
      } else {
        periodKey = `${errorDate.getFullYear()}-${(errorDate.getMonth() + 1).toString().padStart(2, '0')}`;
      }

      if (!timeGroups.has(periodKey)) {
        timeGroups.set(periodKey, []);
      }
      timeGroups.get(periodKey)!.push(error);
    });

    // Convert to time series data points
    const dataPoints: TimeSeriesDataPoint[] = [];
    const sortedDates = Array.from(timeGroups.keys()).sort();

    sortedDates.forEach(dateKey => {
      const periodErrors = timeGroups.get(dateKey)!;
      const totalErrors = periodErrors.length;

      // Count by severity
      const severityCounts = {
        [MQMSeverity.CRITICAL]: 0,
        [MQMSeverity.MAJOR]: 0,
        [MQMSeverity.MINOR]: 0,
        [MQMSeverity.NEUTRAL]: 0
      };

      periodErrors.forEach(error => {
        severityCounts[error.severity]++;
      });

      // Count by dimension
      const dimensionCounts = {} as Record<MQMDimension, number>;
      Object.values(MQMDimension).forEach(dim => {
        dimensionCounts[dim] = periodErrors.filter(e => e.dimension === dim).length;
      });

      // Calculate average severity (weighted)
      const severityWeights = {
        [MQMSeverity.CRITICAL]: 4,
        [MQMSeverity.MAJOR]: 3,
        [MQMSeverity.MINOR]: 2,
        [MQMSeverity.NEUTRAL]: 1
      };

      const totalSeverityWeight = periodErrors.reduce((sum, error) => 
        sum + severityWeights[error.severity], 0
      );
      const avgSeverity = totalErrors > 0 ? totalSeverityWeight / totalErrors : 0;

      // Estimate quality score (inverse relationship with error density)
      const qualityScore = Math.max(0, Math.min(10, 10 - (totalErrors * 0.5)));

      // Calculate error rate (errors per 100 segments, estimated)
      const estimatedSegments = Math.max(100, totalErrors * 5); // Rough estimate
      const errorRate = (totalErrors / estimatedSegments) * 100;

      dataPoints.push({
        date: dateKey,
        timestamp: new Date(dateKey).getTime(),
        totalErrors,
        criticalErrors: severityCounts[MQMSeverity.CRITICAL],
        majorErrors: severityCounts[MQMSeverity.MAJOR],
        minorErrors: severityCounts[MQMSeverity.MINOR],
        neutralErrors: severityCounts[MQMSeverity.NEUTRAL],
        avgSeverity,
        qualityScore,
        dimensions: dimensionCounts,
        errorRate,
        trend: 'stable' // Will be calculated below
      });
    });

    // Calculate trends
    dataPoints.forEach((point, index) => {
      if (index === 0) return;
      
      const prevPoint = dataPoints[index - 1];
      const errorChange = point.totalErrors - prevPoint.totalErrors;
      const qualityChange = point.qualityScore - prevPoint.qualityScore;
      
      if (errorChange > 2 || qualityChange < -0.5) {
        point.trend = 'declining';
      } else if (errorChange < -2 || qualityChange > 0.5) {
        point.trend = 'improving';
      } else {
        point.trend = 'stable';
      }
    });

    return dataPoints;
  }, [errors, timeRange, granularity]);

  // Calculate overall trend metrics
  const trendMetrics = useMemo((): TrendMetrics => {
    if (timeSeriesData.length < 2) {
      return {
        direction: 'stable',
        magnitude: 0,
        confidence: 0,
        description: 'Insufficient data for trend analysis'
      };
    }

    const firstHalf = timeSeriesData.slice(0, Math.floor(timeSeriesData.length / 2));
    const secondHalf = timeSeriesData.slice(Math.floor(timeSeriesData.length / 2));

    const firstAvgErrors = firstHalf.reduce((sum, p) => sum + p.totalErrors, 0) / firstHalf.length;
    const secondAvgErrors = secondHalf.reduce((sum, p) => sum + p.totalErrors, 0) / secondHalf.length;

    const firstAvgQuality = firstHalf.reduce((sum, p) => sum + p.qualityScore, 0) / firstHalf.length;
    const secondAvgQuality = secondHalf.reduce((sum, p) => sum + p.qualityScore, 0) / secondHalf.length;

    const errorChange = secondAvgErrors - firstAvgErrors;
    const qualityChange = secondAvgQuality - firstAvgQuality;

    let direction: 'improving' | 'declining' | 'stable';
    let magnitude: number;
    let description: string;

    if (errorChange > 1 || qualityChange < -0.3) {
      direction = 'declining';
      magnitude = Math.abs(errorChange) + Math.abs(qualityChange * 2);
      description = `Quality declining: ${errorChange > 0 ? 'more errors' : ''} ${qualityChange < 0 ? 'lower quality scores' : ''}`;
    } else if (errorChange < -1 || qualityChange > 0.3) {
      direction = 'improving';
      magnitude = Math.abs(errorChange) + Math.abs(qualityChange * 2);
      description = `Quality improving: ${errorChange < 0 ? 'fewer errors' : ''} ${qualityChange > 0 ? 'higher quality scores' : ''}`;
    } else {
      direction = 'stable';
      magnitude = 0;
      description = 'Quality metrics remain stable';
    }

    const confidence = Math.min(100, timeSeriesData.length * 10); // More data = higher confidence

    return { direction, magnitude, confidence, description };
  }, [timeSeriesData]);

  // Format chart data based on selected metric
  const chartData = useMemo(() => {
    return timeSeriesData.map(point => ({
      ...point,
      formattedDate: formatDate(point.date, granularity)
    }));
  }, [timeSeriesData, granularity]);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Trend Analysis
              {getTrendIcon(trendMetrics.direction)}
            </CardTitle>
            <CardDescription>
              Quality trends and error patterns over time
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Select value={granularity} onValueChange={(value: 'day' | 'week' | 'month') => setGranularity(value)}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Daily</SelectItem>
                <SelectItem value="week">Weekly</SelectItem>
                <SelectItem value="month">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Trend Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
            {getTrendIcon(trendMetrics.direction)}
            <div>
              <div className="font-medium">Overall Trend</div>
              <div className="text-sm text-muted-foreground capitalize">
                {trendMetrics.direction}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
            <Calendar className="h-4 w-4" />
            <div>
              <div className="font-medium">Data Points</div>
              <div className="text-sm text-muted-foreground">
                {timeSeriesData.length} periods
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
            <TrendingUp className="h-4 w-4" />
            <div>
              <div className="font-medium">Confidence</div>
              <div className="text-sm text-muted-foreground">
                {trendMetrics.confidence}%
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs value={selectedMetric} onValueChange={(value: string) => setSelectedMetric(value as 'errors' | 'severity' | 'quality')}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="errors">Error Trends</TabsTrigger>
            <TabsTrigger value="severity">Severity Trends</TabsTrigger>
            <TabsTrigger value="quality">Quality Trends</TabsTrigger>
          </TabsList>
          
          <TabsContent value="errors" className="space-y-4">
            <div className="h-80">
              <ChartContainer config={chartConfig}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="formattedDate"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                    />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(value) => `Date: ${value}`}
                        />
                      }
                    />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="totalErrors"
                      stackId="1"
                      stroke={chartConfig.totalErrors.color}
                      fill={chartConfig.totalErrors.color}
                      fillOpacity={0.6}
                      name="Total Errors"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="errorRate"
                      stroke="#82ca9d"
                      strokeWidth={2}
                      name="Error Rate (%)"
                      dot={{ fill: '#82ca9d', strokeWidth: 2, r: 4 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </TabsContent>
          
          <TabsContent value="severity" className="space-y-4">
            <div className="h-80">
              <ChartContainer config={chartConfig}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="formattedDate"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                    />
                    <YAxis />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(value) => `Date: ${value}`}
                        />
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="criticalErrors"
                      stackId="1"
                      stroke={chartConfig.criticalErrors.color}
                      fill={chartConfig.criticalErrors.color}
                      name="Critical"
                    />
                    <Area
                      type="monotone"
                      dataKey="majorErrors"
                      stackId="1"
                      stroke={chartConfig.majorErrors.color}
                      fill={chartConfig.majorErrors.color}
                      name="Major"
                    />
                    <Area
                      type="monotone"
                      dataKey="minorErrors"
                      stackId="1"
                      stroke={chartConfig.minorErrors.color}
                      fill={chartConfig.minorErrors.color}
                      name="Minor"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </TabsContent>
          
          <TabsContent value="quality" className="space-y-4">
            <div className="h-80">
              <ChartContainer config={chartConfig}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="formattedDate"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                    />
                    <YAxis domain={[0, 10]} />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(value) => `Date: ${value}`}
                          formatter={(value, name) => [
                            `${(value as number).toFixed(2)}`,
                            name
                          ]}
                        />
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="qualityScore"
                      stroke={chartConfig.qualityScore.color}
                      strokeWidth={3}
                      name="Quality Score"
                      dot={{ fill: chartConfig.qualityScore.color, strokeWidth: 2, r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="avgSeverity"
                      stroke="#ff7300"
                      strokeWidth={2}
                      name="Avg Severity"
                      dot={{ fill: '#ff7300', strokeWidth: 2, r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </TabsContent>
        </Tabs>

        {/* Trend Insights */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium mb-2">Trend Analysis</h4>
          <p className="text-sm text-muted-foreground mb-3">{trendMetrics.description}</p>
          
          {timeSeriesData.length >= 2 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium">Latest Period:</span>
                <div className="mt-1">
                  {timeSeriesData[timeSeriesData.length - 1]?.totalErrors || 0} errors
                </div>
              </div>
              <div>
                <span className="font-medium">Previous Period:</span>
                <div className="mt-1">
                  {timeSeriesData[timeSeriesData.length - 2]?.totalErrors || 0} errors
                </div>
              </div>
              <div>
                <span className="font-medium">Change:</span>
                <div className="mt-1 flex items-center gap-1">
                  {(() => {
                    const latest = timeSeriesData[timeSeriesData.length - 1]?.totalErrors || 0;
                    const previous = timeSeriesData[timeSeriesData.length - 2]?.totalErrors || 0;
                    const change = latest - previous;
                    const isPositive = change > 0;
                    return (
                      <>
                        {isPositive ? '+' : ''}{change}
                        {isPositive ? 
                          <TrendingUp className="h-3 w-3 text-red-500" /> : 
                          <TrendingDown className="h-3 w-3 text-green-500" />
                        }
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 