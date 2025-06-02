import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from "recharts";
import { DrillDownLevel } from "@/hooks/useDrillDown";
import { ErrorDistributionData } from "@/lib/services/analytics-aggregation-service";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

const chartConfig = {
  minor: {
    label: "Minor",
    color: "hsl(47 96% 53%)", // Yellow
  },
  major: {
    label: "Major", 
    color: "hsl(25 95% 53%)", // Orange
  },
  critical: {
    label: "Critical",
    color: "hsl(0 84% 60%)", // Red
  },
} satisfies ChartConfig;

interface ErrorDistributionChartProps {
  data?: ErrorDistributionData[];
  height?: number;
  chartType?: 'pie' | 'bar';
  showTrends?: boolean;
  showLegend?: boolean;
  onDataPointClick?: (level: DrillDownLevel) => void;
  enableDrillDown?: boolean;
  loading?: boolean;
}

export function ErrorDistributionChart({ 
  data, 
  height = 400,
  chartType = 'pie',
  showTrends = true,
  showLegend = true,
  onDataPointClick,
  enableDrillDown = false,
  loading = false
}: ErrorDistributionChartProps) {
  
  const chartData = data?.map(item => ({
    ...item,
    color: getSeverityColor(item.severity),
    displayName: item.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  })) || [];

  const isEmpty = chartData.length === 0;
  const totalErrors = chartData.reduce((sum, item) => sum + item.count, 0);

  const handleDataPointClick = (data: any) => {
    if (enableDrillDown && onDataPointClick && data?.payload) {
      const clickedData = data.payload;
      onDataPointClick({
        type: 'language',
        value: clickedData.category,
        label: `Errors in ${clickedData.displayName}`,
        filters: { 
          errorCategory: clickedData.category,
          severity: clickedData.severity
        }
      });
    }
  };

  const renderTrendIcon = (trend: 'increasing' | 'decreasing' | 'stable') => {
    switch (trend) {
      case 'increasing':
        return <TrendingUp className="w-3 h-3 text-red-500" />;
      case 'decreasing':
        return <TrendingDown className="w-3 h-3 text-green-500" />;
      case 'stable':
        return <Minus className="w-3 h-3 text-gray-500" />;
    }
  };

  const renderPieChart = () => (
    <PieChart>
      <Pie
        data={chartData}
        cx="50%"
        cy="50%"
        innerRadius={60}
        outerRadius={120}
        paddingAngle={2}
        dataKey="count"
        onClick={handleDataPointClick}
        cursor={enableDrillDown ? "pointer" : "default"}
      >
        {chartData.map((entry, index) => (
          <Cell 
            key={`cell-${index}`} 
            fill={entry.color}
            stroke="white"
            strokeWidth={2}
            style={enableDrillDown ? { cursor: 'pointer' } : {}}
          />
        ))}
      </Pie>
      <ChartTooltip
        content={
          <ChartTooltipContent
            formatter={(value, name, props) => [
              `${props.payload.count} error${props.payload.count !== 1 ? 's' : ''} (${props.payload.percentage}%)`,
              props.payload.displayName,
            ]}
            hideLabel
          />
        }
      />
      {showLegend && !isEmpty && (
        <Legend 
          content={renderCustomLegend}
          verticalAlign="bottom"
          height={showTrends ? 80 : 36}
        />
      )}
    </PieChart>
  );

  const renderBarChart = () => (
    <BarChart
      data={chartData}
      margin={{
        top: 20,
        right: 30,
        left: 20,
        bottom: 60,
      }}
    >
      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
      <XAxis 
        dataKey="displayName" 
        tick={{ fontSize: 12 }}
        tickLine={false}
        axisLine={false}
        angle={-45}
        textAnchor="end"
        height={60}
      />
      <YAxis 
        tick={{ fontSize: 12 }}
        tickLine={false}
        axisLine={false}
        label={{ value: 'Error Count', angle: -90, position: 'insideLeft' }}
      />
      <ChartTooltip
        content={
          <ChartTooltipContent
            formatter={(value, name, props) => [
              `${props.payload.count} error${props.payload.count !== 1 ? 's' : ''} (${props.payload.percentage}%)`,
              props.payload.displayName,
            ]}
            labelFormatter={(value) => `Category: ${value}`}
          />
        }
      />
      <Bar 
        dataKey="count" 
        radius={[4, 4, 0, 0]}
        cursor={enableDrillDown ? "pointer" : "default"}
        onClick={handleDataPointClick}
      >
        {chartData.map((entry, index) => (
          <Cell key={`cell-${index}`} fill={entry.color} />
        ))}
      </Bar>
    </BarChart>
  );

  const renderCustomLegend = (props: any) => {
    const { payload } = props;
    
    return (
      <div className="flex flex-wrap justify-center gap-4 mt-4">
        {payload?.map((entry: any, index: number) => {
          const data = chartData[index];
          return (
            <div 
              key={index} 
              className={`flex items-center gap-2 ${enableDrillDown ? 'cursor-pointer hover:opacity-80' : ''}`}
              onClick={() => enableDrillDown && handleDataPointClick({ payload: data })}
            >
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm text-muted-foreground">
                {data?.displayName}
              </span>
              <span className="text-xs text-muted-foreground">
                ({data?.count})
              </span>
              {showTrends && data?.trend && (
                <div className="ml-1">
                  {renderTrendIcon(data.trend)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ height }} className="relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm">Loading error distribution...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height }} className="relative">
      <ChartContainer config={chartConfig}>
        {chartType === 'pie' ? renderPieChart() : renderBarChart()}
      </ChartContainer>

      {/* Center text for pie chart showing total */}
      {chartType === 'pie' && !isEmpty && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">{totalErrors}</div>
            <div className="text-xs text-muted-foreground">
              Total Error{totalErrors !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      )}

      {isEmpty && !loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <p className="text-sm">No error distribution data available</p>
            <p className="text-xs mt-1">
              Try adjusting your date range or filters
            </p>
          </div>
        </div>
      )}

      {enableDrillDown && !isEmpty && (
        <div className="absolute top-2 right-2">
          <div className="text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
            Click {chartType === 'pie' ? 'segments' : 'bars'} to drill down
          </div>
        </div>
      )}

      {/* Trend summary */}
      {showTrends && !isEmpty && (
        <div className="absolute top-2 left-2">
          <div className="text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
            <div className="flex items-center gap-2">
              <span>Trends:</span>
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-red-500" />
                <span>{chartData.filter(d => d.trend === 'increasing').length}</span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingDown className="w-3 h-3 text-green-500" />
                <span>{chartData.filter(d => d.trend === 'decreasing').length}</span>
              </div>
              <div className="flex items-center gap-1">
                <Minus className="w-3 h-3 text-gray-500" />
                <span>{chartData.filter(d => d.trend === 'stable').length}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper functions
function getSeverityColor(severity: 'minor' | 'major' | 'critical'): string {
  return chartConfig[severity]?.color || "hsl(var(--chart-1))";
} 