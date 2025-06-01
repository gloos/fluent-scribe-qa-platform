import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts";
import { DrillDownLevel } from "@/hooks/useDrillDown";

const chartConfig = {
  excellent: {
    label: "Excellent (9-10)",
    color: "hsl(142 76% 36%)", // Green
  },
  good: {
    label: "Good (7-8.9)",
    color: "hsl(47 96% 53%)", // Yellow
  },
  fair: {
    label: "Fair (5-6.9)",
    color: "hsl(25 95% 53%)", // Orange
  },
  poor: {
    label: "Poor (<5)",
    color: "hsl(0 84% 60%)", // Red
  },
} satisfies ChartConfig;

interface QualityDistributionData {
  range: string;
  count: number;
  percentage: number;
  color: string;
}

interface QualityDistributionChartProps {
  data?: QualityDistributionData[];
  height?: number;
  showLegend?: boolean;
  innerRadius?: number;
  outerRadius?: number;
  onDataPointClick?: (level: DrillDownLevel) => void;
  enableDrillDown?: boolean;
}

export function QualityDistributionChart({ 
  data, 
  height = 300,
  showLegend = true,
  innerRadius = 40,
  outerRadius = 100,
  onDataPointClick,
  enableDrillDown = false
}: QualityDistributionChartProps) {
  // Fallback data if no data is provided
  const fallbackData = [
    { range: "Excellent (9-10)", count: 9, percentage: 45, color: chartConfig.excellent.color },
    { range: "Good (7-8.9)", count: 7, percentage: 35, color: chartConfig.good.color },
    { range: "Fair (5-6.9)", count: 3, percentage: 15, color: chartConfig.fair.color },
    { range: "Poor (<5)", count: 1, percentage: 5, color: chartConfig.poor.color },
  ];

  const chartData = data || fallbackData;
  const isEmpty = chartData.length === 0;
  const totalReports = chartData.reduce((sum, item) => sum + item.count, 0);

  const handlePieClick = (data: any, index: number) => {
    if (enableDrillDown && onDataPointClick && data) {
      onDataPointClick({
        type: 'language', // Can be customized based on use case
        value: data.range,
        label: `${data.range} Reports`,
        filters: { qualityRange: data.range }
      });
    }
  };

  // Custom legend component for better styling
  const renderCustomLegend = (props: any) => {
    const { payload } = props;
    
    return (
      <div className="flex flex-wrap justify-center gap-4 mt-4">
        {payload?.map((entry: any, index: number) => (
          <div 
            key={index} 
            className={`flex items-center gap-2 ${enableDrillDown ? 'cursor-pointer hover:opacity-80' : ''}`}
            onClick={() => enableDrillDown && handlePieClick(entry.payload, index)}
          >
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm text-muted-foreground">
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ height }} className="relative">
      <ChartContainer config={chartConfig}>
        <PieChart>
          {!isEmpty && (
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              paddingAngle={2}
              dataKey="count"
              onClick={handlePieClick}
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
          )}
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name, props) => [
                  `${props.payload.count} report${props.payload.count !== 1 ? 's' : ''} (${props.payload.percentage}%)`,
                  props.payload.range,
                ]}
                hideLabel
              />
            }
          />
          {showLegend && !isEmpty && (
            <Legend 
              content={renderCustomLegend}
              verticalAlign="bottom"
              height={36}
            />
          )}
        </PieChart>
      </ChartContainer>
      
      {/* Center text showing total */}
      {!isEmpty && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">{totalReports}</div>
            <div className="text-xs text-muted-foreground">
              {totalReports === 1 ? 'Report' : 'Reports'}
            </div>
          </div>
        </div>
      )}
      
      {/* Drill-down indicator */}
      {enableDrillDown && !isEmpty && (
        <div className="absolute top-2 right-2">
          <div className="text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
            Click segments to drill down
          </div>
        </div>
      )}
      
      {/* Empty state */}
      {isEmpty && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <p className="text-sm">No completed reports available</p>
            <p className="text-xs mt-1">Quality distribution requires completed reports</p>
          </div>
        </div>
      )}
    </div>
  );
} 