import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine } from "recharts";

const chartConfig = {
  avgTime: {
    label: "Avg Processing Time (min)",
    color: "hsl(var(--chart-3))",
  },
  target: {
    label: "Target (5 min)",
    color: "hsl(var(--chart-4))",
  },
} satisfies ChartConfig;

interface ProcessingEfficiencyData {
  date: string;
  avgTime: number;
}

interface ProcessingEfficiencyChartProps {
  data?: ProcessingEfficiencyData[];
}

export function ProcessingEfficiencyChart({ data }: ProcessingEfficiencyChartProps) {
  // Fallback data if no data is provided
  const fallbackData = [
    { date: "Jan 08", avgTime: 6.2 },
    { date: "Jan 09", avgTime: 5.8 },
    { date: "Jan 10", avgTime: 4.9 },
    { date: "Jan 11", avgTime: 5.3 },
    { date: "Jan 12", avgTime: 4.1 },
    { date: "Jan 13", avgTime: 4.7 },
    { date: "Jan 14", avgTime: 3.9 },
    { date: "Jan 15", avgTime: 4.2 },
  ];

  const chartData = data || fallbackData;

  return (
    <ChartContainer config={chartConfig}>
      <LineChart
        data={chartData}
        margin={{
          top: 5,
          right: 30,
          left: 20,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="date" 
        />
        <YAxis 
          domain={[0, 8]}
          label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(value) => {
                return `Date: ${value}`;
              }}
              formatter={(value) => [`${value} min`, "Avg Processing Time"]}
            />
          }
        />
        <ReferenceLine 
          y={5} 
          stroke="var(--color-target)" 
          strokeDasharray="5 5" 
          label="Target"
        />
        <Line 
          type="monotone" 
          dataKey="avgTime" 
          stroke="var(--color-avgTime)" 
          strokeWidth={3}
          dot={{ fill: "var(--color-avgTime)", strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ChartContainer>
  );
} 