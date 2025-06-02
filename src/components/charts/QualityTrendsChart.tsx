import React, { memo, useMemo, useCallback } from 'react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { 
  ComposedChart, 
  Line, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  ResponsiveContainer,
  Legend
} from "recharts";
import { DrillDownLevel } from "@/hooks/useDrillDown";
import { QualityTrendData } from "@/lib/services/analytics-aggregation-service";
import { format, parseISO } from "date-fns";

const chartConfig = {
  avgMqmScore: {
    label: "MQM Score",
    color: "hsl(var(--chart-1))",
  },
  avgOverallScore: {
    label: "Overall Score",
    color: "hsl(var(--chart-2))",
  },
  avgFluencyScore: {
    label: "Fluency Score",
    color: "hsl(var(--chart-3))",
  },
  avgAdequacyScore: {
    label: "Adequacy Score",
    color: "hsl(var(--chart-4))",
  },
  totalSessions: {
    label: "Sessions",
    color: "hsl(var(--chart-5))",
  },
  errorCount: {
    label: "Errors",
    color: "hsl(0 84% 60%)",
  },
} satisfies ChartConfig;

interface QualityTrendsChartProps {
  data?: QualityTrendData[];
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  period?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  metrics?: ('mqm' | 'overall' | 'fluency' | 'adequacy' | 'sessions' | 'errors')[];
  onDataPointClick?: (level: DrillDownLevel) => void;
  enableDrillDown?: boolean;
  loading?: boolean;
}

export const QualityTrendsChart = memo<QualityTrendsChartProps>(function QualityTrendsChart({ 
  data, 
  height = 400,
  showGrid = true,
  showLegend = true,
  period = 'daily',
  metrics = ['mqm', 'overall', 'sessions'],
  onDataPointClick,
  enableDrillDown = false,
  loading = false
}) {
  
  // Memoize the chart data transformation to avoid recalculation on every render
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    return data.map(item => ({
      ...item,
      period: formatPeriodLabel(item.period, period),
      displayDate: item.timestamp
    }));
  }, [data, period]);

  // Memoize expensive calculations
  const { isEmpty, maxSessions, maxErrors } = useMemo(() => {
    const isEmpty = chartData.length === 0;
    const maxSessions = isEmpty ? 0 : Math.max(...chartData.map(d => d.totalSessions), 0);
    const maxErrors = isEmpty ? 0 : Math.max(...chartData.map(d => d.errorCount), 0);
    
    return { isEmpty, maxSessions, maxErrors };
  }, [chartData]);

  // Memoize the data point click handler
  const handleDataPointClick = useCallback((data: any) => {
    if (enableDrillDown && onDataPointClick && data?.payload) {
      const clickedData = data.payload;
      onDataPointClick({
        type: 'date',
        value: clickedData.period,
        label: `Quality trends for ${clickedData.period}`,
        filters: { 
          period: clickedData.period,
          timestamp: clickedData.timestamp 
        }
      });
    }
  }, [enableDrillDown, onDataPointClick]);

  // Memoize metric line rendering
  const metricLines = useMemo(() => {
    return metrics.map((metric) => {
      const config = getMetricConfig(metric);
      if (!config) return null;

      return (
        <Line
          key={metric}
          yAxisId={config.yAxisId}
          type="monotone"
          dataKey={config.dataKey}
          stroke={config.color}
          strokeWidth={2}
          name={config.label}
          dot={{ 
            fill: config.color, 
            strokeWidth: 2, 
            r: 4,
            cursor: enableDrillDown ? "pointer" : "default"
          }}
          connectNulls={false}
        />
      );
    });
  }, [metrics, enableDrillDown]);

  // Memoize metric bar rendering
  const metricBars = useMemo(() => {
    return metrics.map((metric) => {
      const config = getMetricConfig(metric);
      if (!config || !config.isBar) return null;

      return (
        <Bar
          key={metric}
          yAxisId={config.yAxisId}
          dataKey={config.dataKey}
          fill={config.color}
          name={config.label}
          opacity={0.6}
          radius={[2, 2, 0, 0]}
          cursor={enableDrillDown ? "pointer" : "default"}
          onClick={handleDataPointClick}
        />
      );
    });
  }, [metrics, enableDrillDown, handleDataPointClick]);

  // Memoize chart margins
  const chartMargins = useMemo(() => ({
    top: 20,
    right: 30,
    left: 20,
    bottom: showLegend ? 60 : 20,
  }), [showLegend]);

  // Memoize Y-axis domain calculations
  const yAxisDomain = useMemo(() => ({
    scores: [0, 10],
    counts: [0, Math.max(maxSessions, maxErrors) * 1.1]
  }), [maxSessions, maxErrors]);

  // Early return for loading state
  if (loading) {
    return (
      <div style={{ height }} className="relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm">Loading quality trends...</p>
          </div>
        </div>
      </div>
    );
  }

  // Early return for empty data
  if (isEmpty) {
    return (
      <div style={{ height }} className="relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <p className="text-sm">No quality trend data available</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height }} className="relative">
      <ChartContainer config={chartConfig}>
        <ComposedChart
          data={chartData}
          margin={chartMargins}
        >
          {showGrid && <CartesianGrid strokeDasharray="3 3" opacity={0.3} />}
          
          <XAxis 
            dataKey="period" 
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            angle={period === 'daily' ? -45 : 0}
            textAnchor={period === 'daily' ? 'end' : 'middle'}
            height={period === 'daily' ? 60 : 30}
          />
          
          {/* Left Y-axis for scores (0-10) */}
          <YAxis 
            yAxisId="scores" 
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            domain={yAxisDomain.scores}
            label={{ value: 'Quality Scores', angle: -90, position: 'insideLeft' }}
          />
          
          {/* Right Y-axis for counts */}
          {(metrics.includes('sessions') || metrics.includes('errors')) && (
            <YAxis 
              yAxisId="counts" 
              orientation="right" 
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              domain={yAxisDomain.counts}
              label={{ value: 'Counts', angle: 90, position: 'insideRight' }}
            />
          )}

          <ChartTooltip 
            content={
              <ChartTooltipContent
                formatter={(value, name, props) => {
                  const numValue = typeof value === 'number' ? value : 0;
                  const nameStr = String(name || '');
                  if (nameStr.includes('Score')) {
                    return [numValue.toFixed(2), name];
                  }
                  return [numValue.toLocaleString(), name];
                }}
                labelFormatter={(label) => `Period: ${label}`}
              />
            }
          />

          {/* Render metric lines */}
          {metricLines}

          {/* Render metric bars */}
          {metricBars}

          {showLegend && (
            <Legend 
              verticalAlign="bottom" 
              height={36}
              iconType="line"
              wrapperStyle={{ paddingTop: '20px' }}
            />
          )}
        </ComposedChart>
      </ChartContainer>
    </div>
  );
});

// Helper function for formatting period labels
function formatPeriodLabel(period: string, periodType: string): string {
  try {
    const date = parseISO(period);
    
    switch (periodType) {
      case 'daily':
        return format(date, 'MMM dd');
      case 'weekly':
        return format(date, 'MMM dd');
      case 'monthly':
        return format(date, 'MMM yyyy');
      case 'quarterly':
        return format(date, 'QQQ yyyy');
      case 'yearly':
        return format(date, 'yyyy');
      default:
        return period;
    }
  } catch (error) {
    return period;
  }
}

// Optimize metric configuration with memoization
const getMetricConfig = (() => {
  const configCache = new Map();
  
  return (metric: string) => {
    if (configCache.has(metric)) {
      return configCache.get(metric);
    }
    
    let config;
    switch (metric) {
      case 'mqm':
        config = {
          dataKey: 'avgMqmScore',
          color: 'hsl(var(--chart-1))',
          label: 'MQM Score',
          yAxisId: 'scores'
        };
        break;
      case 'overall':
        config = {
          dataKey: 'avgOverallScore',
          color: 'hsl(var(--chart-2))',
          label: 'Overall Score',
          yAxisId: 'scores'
        };
        break;
      case 'fluency':
        config = {
          dataKey: 'avgFluencyScore',
          color: 'hsl(var(--chart-3))',
          label: 'Fluency Score',
          yAxisId: 'scores'
        };
        break;
      case 'adequacy':
        config = {
          dataKey: 'avgAdequacyScore',
          color: 'hsl(var(--chart-4))',
          label: 'Adequacy Score',
          yAxisId: 'scores'
        };
        break;
      case 'sessions':
        config = {
          dataKey: 'totalSessions',
          color: 'hsl(var(--chart-5))',
          label: 'Sessions',
          yAxisId: 'counts',
          isBar: true
        };
        break;
      case 'errors':
        config = {
          dataKey: 'errorCount',
          color: 'hsl(0 84% 60%)',
          label: 'Errors',
          yAxisId: 'counts',
          isBar: true
        };
        break;
      default:
        config = null;
    }
    
    if (config) {
      configCache.set(metric, config);
    }
    
    return config;
  };
})();

export default QualityTrendsChart; 