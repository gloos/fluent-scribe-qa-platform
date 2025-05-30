import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

const chartConfig = {
  excellent: {
    label: "Excellent (9-10)",
    color: "hsl(142 76% 36%)", // Green
  },
  good: {
    label: "Good (7-8.9)",
    color: "hsl(47 96% 53%)", // Yellow
  },
  needsImprovement: {
    label: "Needs Improvement (<7)",
    color: "hsl(0 84% 60%)", // Red
  },
} satisfies ChartConfig;

interface QualityDistributionData {
  name: string;
  value: number;
  count: number;
}

interface QualityDistributionChartProps {
  data?: QualityDistributionData[];
}

const COLORS = [
  chartConfig.excellent.color,
  chartConfig.good.color,
  chartConfig.needsImprovement.color,
];

export function QualityDistributionChart({ data }: QualityDistributionChartProps) {
  // Fallback data if no data is provided
  const fallbackData = [
    { name: "Excellent (9-10)", value: 45, count: 9 },
    { name: "Good (7-8.9)", value: 35, count: 7 },
    { name: "Needs Improvement (<7)", value: 20, count: 4 },
  ];

  const chartData = data || fallbackData;
  
  // Calculate percentages for display
  const total = chartData.reduce((sum, item) => sum + item.value, 0);
  const displayData = chartData.map(item => ({
    ...item,
    percentage: total > 0 ? Math.round((item.value / total) * 100) : 0,
  }));

  return (
    <ChartContainer config={chartConfig}>
      <PieChart>
        <Pie
          data={displayData}
          cx="50%"
          cy="50%"
          innerRadius={40}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
        >
          {displayData.map((entry, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={COLORS[index]} 
            />
          ))}
        </Pie>
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name, props) => [
                `${props.payload.percentage}% (${props.payload.count} files)`,
                props.payload.name,
              ]}
              hideLabel
            />
          }
        />
      </PieChart>
    </ChartContainer>
  );
} 