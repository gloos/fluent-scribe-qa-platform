import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const chartConfig = {
  count: {
    label: "Issues Found",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

interface IssueAnalysisData {
  category: string;
  count: number;
}

interface IssueAnalysisChartProps {
  data?: IssueAnalysisData[];
}

export function IssueAnalysisChart({ data }: IssueAnalysisChartProps) {
  // Fallback data if no data is provided
  const fallbackData = [
    { category: "Grammar", count: 45 },
    { category: "Terminology", count: 38 },
    { category: "Spelling", count: 32 },
    { category: "Style", count: 24 },
    { category: "Formatting", count: 17 },
  ];

  const chartData = data || fallbackData;

  return (
    <ChartContainer config={chartConfig}>
      <BarChart
        data={chartData}
        layout="horizontal"
        margin={{
          top: 5,
          right: 30,
          left: 80,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" />
        <YAxis 
          type="category" 
          dataKey="category" 
          width={70}
          tick={{ fontSize: 12 }}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => [
                `${value} issues`,
                "Issues Found",
              ]}
            />
          }
        />
        <Bar 
          dataKey="count" 
          fill="var(--color-count)" 
          radius={[0, 4, 4, 0]}
        />
      </BarChart>
    </ChartContainer>
  );
} 