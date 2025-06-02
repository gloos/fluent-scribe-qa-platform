import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  Area,
  AreaChart
} from "recharts";
import { 
  TrendAnalysis, 
  TrendPoint, 
  AnomalyPoint,
  TrendAnalysisService 
} from "@/lib/services/trend-analysis-service";
import { AlertCircle, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useState, useEffect } from "react";

const chartConfig = {
  value: {
    label: "Actual",
    color: "hsl(var(--chart-1))",
  },
  predicted: {
    label: "Forecast",
    color: "hsl(var(--chart-2))",
  },
  anomaly: {
    label: "Anomaly",
    color: "hsl(0 84% 60%)",
  },
  trend: {
    label: "Trend",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig;

interface TrendAnalysisChartProps {
  startDate: Date;
  endDate: Date;
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  showForecast?: boolean;
  showAnomalies?: boolean;
  showSeasonality?: boolean;
  analysisType?: 'quality' | 'errors' | 'efficiency' | 'engagement';
  loading?: boolean;
}

export function TrendAnalysisChart({
  startDate,
  endDate,
  height = 400,
  showGrid = true,
  showLegend = true,
  showForecast = true,
  showAnomalies = true,
  showSeasonality = true,
  analysisType = 'quality',
  loading = false
}: TrendAnalysisChartProps) {
  const [trendAnalysis, setTrendAnalysis] = useState<TrendAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(loading);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTrendAnalysis = async () => {
      if (!startDate || !endDate) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        let analysis: TrendAnalysis;
        
        switch (analysisType) {
          case 'quality':
            analysis = await TrendAnalysisService.analyzeQualityTrends(startDate, endDate);
            break;
          case 'errors':
            analysis = await TrendAnalysisService.analyzeErrorTrends(startDate, endDate);
            break;
          case 'efficiency':
            analysis = await TrendAnalysisService.analyzeEfficiencyTrends(startDate, endDate);
            break;
          case 'engagement':
            analysis = await TrendAnalysisService.analyzeEngagementTrends(startDate, endDate);
            break;
          default:
            analysis = await TrendAnalysisService.analyzeQualityTrends(startDate, endDate);
        }
        
        setTrendAnalysis(analysis);
      } catch (err) {
        console.error('Failed to load trend analysis:', err);
        setError('Failed to load trend analysis data');
      } finally {
        setIsLoading(false);
      }
    };

    loadTrendAnalysis();
  }, [startDate, endDate, analysisType]);

  if (isLoading) {
    return (
      <div style={{ height }} className="relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm">Analyzing trends...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ height }} className="relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!trendAnalysis) {
    return (
      <div style={{ height }} className="relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <p className="text-sm">No trend analysis data available</p>
          </div>
        </div>
      </div>
    );
  }

  // Combine historical and forecast data
  const combinedData = [
    ...trendAnalysis.forecast.filter(point => !point.predicted).map(point => ({
      ...point,
      formattedDate: format(parseISO(point.date), 'MMM dd'),
      type: 'actual' as const,
      anomaly: trendAnalysis.anomalies.find(a => a.date === point.date)
    })),
    ...(showForecast ? trendAnalysis.forecast.filter(point => point.predicted).map(point => ({
      ...point,
      formattedDate: format(parseISO(point.date), 'MMM dd'),
      type: 'forecast' as const,
      predictedValue: point.value,
      value: undefined, // Don't show actual value for forecast points
      anomaly: undefined // Forecast points don't have anomalies
    })) : [])
  ];

  const getTrendIcon = () => {
    switch (trendAnalysis.trend) {
      case 'increasing':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'decreasing':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      case 'stable':
        return <Minus className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTrendColor = () => {
    switch (trendAnalysis.trend) {
      case 'increasing':
        return 'text-green-600';
      case 'decreasing':
        return 'text-red-600';
      case 'stable':
        return 'text-gray-600';
    }
  };

  return (
    <div style={{ height }} className="relative">
      {/* Trend Summary Header */}
      <div className="absolute top-2 left-2 z-10">
        <div className="bg-background/90 p-2 rounded-lg border text-xs">
          <div className="flex items-center gap-2 mb-1">
            {getTrendIcon()}
            <span className={`font-medium ${getTrendColor()}`}>
              {trendAnalysis.trend.toUpperCase()} Trend
            </span>
          </div>
          <div className="space-y-1">
            <div>Strength: {(trendAnalysis.strength * 100).toFixed(1)}%</div>
            <div>R²: {(trendAnalysis.correlation * 100).toFixed(1)}%</div>
            {trendAnalysis.seasonality && (
              <div>Seasonality: {trendAnalysis.seasonality.period}</div>
            )}
          </div>
        </div>
      </div>

      {/* Anomalies Summary */}
      {showAnomalies && trendAnalysis.anomalies.length > 0 && (
        <div className="absolute top-2 right-2 z-10">
          <div className="bg-background/90 p-2 rounded-lg border text-xs">
            <div className="flex items-center gap-1 mb-1">
              <AlertCircle className="w-3 h-3 text-orange-500" />
              <span className="font-medium">{trendAnalysis.anomalies.length} Anomalies</span>
            </div>
            <div className="space-y-1">
              <div className="text-red-600">
                High: {trendAnalysis.anomalies.filter(a => a.severity === 'high').length}
              </div>
              <div className="text-orange-600">
                Med: {trendAnalysis.anomalies.filter(a => a.severity === 'medium').length}
              </div>
              <div className="text-yellow-600">
                Low: {trendAnalysis.anomalies.filter(a => a.severity === 'low').length}
              </div>
            </div>
          </div>
        </div>
      )}

      <ChartContainer config={chartConfig}>
        <ComposedChart
          data={combinedData}
          margin={{
            top: 60,
            right: 30,
            left: 20,
            bottom: showLegend ? 60 : 20,
          }}
        >
          {showGrid && <CartesianGrid strokeDasharray="3 3" opacity={0.3} />}
          
          <XAxis 
            dataKey="formattedDate" 
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          
          <YAxis 
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            domain={['dataMin', 'dataMax']}
            label={{ value: 'Value', angle: -90, position: 'insideLeft' }}
          />

          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(value) => `Date: ${value}`}
                formatter={(value, name, props) => {
                  if (name === 'Forecast') {
                    const confidence = props.payload?.confidence || 0;
                    return [`${Number(value).toFixed(2)} (${(confidence * 100).toFixed(0)}% confidence)`, name];
                  }
                  if (name === 'Anomaly') {
                    const anomaly = props.payload?.anomaly;
                    return [
                      `${Number(value).toFixed(2)} (${anomaly?.severity} ${anomaly?.type})`, 
                      name
                    ];
                  }
                  return [`${Number(value).toFixed(2)}`, name];
                }}
              />
            }
          />

          {/* Actual values line */}
          <Line
            type="monotone"
            dataKey="value"
            stroke={chartConfig.value.color}
            strokeWidth={2}
            name="Actual"
            dot={{ fill: chartConfig.value.color, strokeWidth: 2, r: 3 }}
            connectNulls={false}
          />

          {/* Forecast line */}
          {showForecast && (
            <Line
              type="monotone"
              dataKey="predictedValue"
              stroke={chartConfig.predicted.color}
              strokeWidth={2}
              strokeDasharray="5 5"
              name="Forecast"
              dot={{ fill: chartConfig.predicted.color, strokeWidth: 2, r: 3 }}
              connectNulls={false}
            />
          )}

          {/* Anomaly markers */}
          {showAnomalies && (
            <Scatter
              dataKey="value"
              fill={chartConfig.anomaly.color}
              name="Anomaly"
              shape="diamond"
              data={combinedData.filter(d => d.type === 'actual' && d.anomaly)}
            />
          )}

          {/* Trend line */}
          {trendAnalysis.slope !== 0 && (
            <ReferenceLine 
              stroke={chartConfig.trend.color}
              strokeWidth={1}
              strokeDasharray="2 2"
              label={{ value: "Trend", position: "top" }}
            />
          )}

          {showLegend && (
            <Legend 
              verticalAlign="bottom" 
              height={36}
              iconType="line"
            />
          )}
        </ComposedChart>
      </ChartContainer>
    </div>
  );
} 