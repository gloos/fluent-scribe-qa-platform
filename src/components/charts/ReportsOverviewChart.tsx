import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";

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
}

export function ReportsOverviewChart({ data }: ReportsOverviewChartProps) {
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

  return (
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
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="date" 
        />
        <YAxis yAxisId="left" />
        <YAxis yAxisId="right" orientation="right" domain={[0, 10]} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(value) => {
                return `Date: ${value}`;
              }}
            />
          }
        />
        <Bar 
          yAxisId="left" 
          dataKey="files" 
          fill="var(--color-files)" 
          name="Files Processed"
          radius={[4, 4, 0, 0]}
        />
        <Line 
          yAxisId="right" 
          type="monotone" 
          dataKey="avgScore" 
          stroke="var(--color-avgScore)" 
          strokeWidth={3}
          name="Avg Quality Score"
          dot={{ fill: "var(--color-avgScore)", strokeWidth: 2, r: 4 }}
        />
      </ComposedChart>
    </ChartContainer>
  );
} 