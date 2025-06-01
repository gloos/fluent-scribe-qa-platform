import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { DrillDownLevel } from "@/hooks/useDrillDown";

const chartConfig = {
  files: {
    label: "Files Processed",
    color: "hsl(var(--chart-1))",
  },
  avgScore: {
    label: "Avg Quality Score",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

interface ReportsOverviewData {
  date: string;
  files: number;
  avgScore: number;
}

interface ReportsOverviewChartProps {
  data?: ReportsOverviewData[];
  height?: number;
  showGrid?: boolean;
  timeframeDays?: number;
  onDataPointClick?: (level: DrillDownLevel) => void;
  enableDrillDown?: boolean;
}

export function ReportsOverviewChart({ 
  data, 
  height = 300,
  showGrid = true,
  timeframeDays = 30,
  onDataPointClick,
  enableDrillDown = false
}: ReportsOverviewChartProps) {
  // Fallback data if no data is provided
  const fallbackData = [
    { date: "Jan 08", files: 3, avgScore: 8.2 },
    { date: "Jan 09", files: 5, avgScore: 8.5 },
    { date: "Jan 10", files: 2, avgScore: 9.1 },
    { date: "Jan 11", files: 7, avgScore: 8.7 },
    { date: "Jan 12", files: 4, avgScore: 8.9 },
    { date: "Jan 13", files: 6, avgScore: 8.3 },
    { date: "Jan 14", files: 8, avgScore: 8.6 },
    { date: "Jan 15", files: 5, avgScore: 8.8 },
  ];

  const chartData = data || fallbackData;
  const isEmpty = chartData.length === 0;
  const maxFiles = Math.max(...chartData.map(d => d.files), 0);

  const handleBarClick = (data: any, index: number) => {
    if (enableDrillDown && onDataPointClick && data?.payload) {
      const clickedData = data.payload;
      onDataPointClick({
        type: 'date',
        value: clickedData.date,
        label: `Reports for ${clickedData.date}`,
        filters: { date: clickedData.date }
      });
    }
  };

  return (
    <div style={{ height }} className="relative">
      <ChartContainer config={chartConfig}>
        <ComposedChart
          data={chartData}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          {showGrid && <CartesianGrid strokeDasharray="3 3" />}
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            yAxisId="left" 
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            domain={[0, maxFiles > 0 ? Math.ceil(maxFiles * 1.1) : 10]}
          />
          <YAxis 
            yAxisId="right" 
            orientation="right" 
            domain={[0, 10]}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(value) => {
                  return `Date: ${value}`;
                }}
                formatter={(value, name) => {
                  if (name === "Files Processed") {
                    return [`${value} file${Number(value) !== 1 ? 's' : ''}`, name];
                  }
                  if (name === "Avg Quality Score") {
                    return [`${Number(value).toFixed(1)}/10`, name];
                  }
                  return [value, name];
                }}
              />
            }
          />
          {!isEmpty && (
            <>
              <Bar 
                yAxisId="left" 
                dataKey="files" 
                fill="var(--color-files)" 
                name="Files Processed"
                radius={[4, 4, 0, 0]}
                opacity={0.8}
                cursor={enableDrillDown ? "pointer" : "default"}
                onClick={handleBarClick}
                style={enableDrillDown ? { cursor: 'pointer' } : {}}
              />
              <Line 
                yAxisId="right" 
                type="monotone" 
                dataKey="avgScore" 
                stroke="var(--color-avgScore)" 
                strokeWidth={3}
                name="Avg Quality Score"
                dot={{ 
                  fill: "var(--color-avgScore)", 
                  strokeWidth: 2, 
                  r: 4,
                  cursor: enableDrillDown ? "pointer" : "default"
                }}
                connectNulls={false}
              />
            </>
          )}
        </ComposedChart>
      </ChartContainer>
      {isEmpty && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <p className="text-sm">No data available for the selected timeframe</p>
            <p className="text-xs mt-1">
              {enableDrillDown ? "Try adjusting your filters or date range" : "Try adjusting your filters or date range"}
            </p>
          </div>
        </div>
      )}
      {enableDrillDown && !isEmpty && (
        <div className="absolute top-2 right-2">
          <div className="text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
            Click bars to drill down
          </div>
        </div>
      )}
    </div>
  );
} 