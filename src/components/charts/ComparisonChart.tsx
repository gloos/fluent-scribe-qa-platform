import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from "recharts";
import {
  MetricComparison,
  ComparisonDataset,
  ComparativeMetricsService,
  BenchmarkConfig
} from "@/lib/services/comparative-metrics-service";
import { TrendingUp, TrendingDown, Target, Award, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";

const chartConfig = {
  value: {
    label: "Value",
    color: "hsl(var(--chart-1))",
  },
  benchmark: {
    label: "Benchmark",
    color: "hsl(var(--chart-5))",
  },
  best: {
    label: "Best Performing",
    color: "hsl(142 76% 36%)",
  },
  worst: {
    label: "Worst Performing", 
    color: "hsl(0 84% 60%)",
  },
  average: {
    label: "Average",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig;

interface ComparisonChartProps {
  datasets: ComparisonDataset[];
  metric?: string;
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  showBenchmark?: boolean;
  benchmarkConfig?: BenchmarkConfig;
  chartType?: 'bar' | 'radar';
  loading?: boolean;
}

export function ComparisonChart({
  datasets,
  metric,
  height = 400,
  showGrid = true,
  showLegend = true,
  showBenchmark = false,
  benchmarkConfig,
  chartType = 'bar',
  loading = false
}: ComparisonChartProps) {
  const [comparisonData, setComparisonData] = useState<MetricComparison[]>([]);
  const [isLoading, setIsLoading] = useState(loading);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadComparisonData = async () => {
      if (!datasets || datasets.length === 0) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const comparisons = await ComparativeMetricsService.compareQualityMetrics(
          datasets,
          benchmarkConfig
        );
        setComparisonData(comparisons);
      } catch (err) {
        console.error('Failed to load comparison data:', err);
        setError('Failed to load comparison data');
      } finally {
        setIsLoading(false);
      }
    };

    loadComparisonData();
  }, [datasets, benchmarkConfig]);

  if (isLoading) {
    return (
      <div style={{ height }} className="relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm">Loading comparison...</p>
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
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Filter to specific metric if provided
  const filteredData = metric 
    ? comparisonData.filter(comp => comp.metric === metric)
    : comparisonData;

  if (filteredData.length === 0) {
    return (
      <div style={{ height }} className="relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <p className="text-sm">No comparison data available</p>
          </div>
        </div>
      </div>
    );
  }

  // Prepare chart data
  const chartData = filteredData.flatMap(comparison => 
    comparison.datasets.map(dataset => ({
      metric: comparison.metric,
      dataset: dataset.datasetName,
      value: dataset.value,
      count: dataset.count,
      confidence: dataset.confidence,
      benchmark: comparison.benchmark || 0,
      isBest: dataset.datasetName === comparison.analysis.bestPerforming,
      isWorst: dataset.datasetName === comparison.analysis.worstPerforming,
      color: dataset.datasetName === comparison.analysis.bestPerforming 
        ? chartConfig.best.color
        : dataset.datasetName === comparison.analysis.worstPerforming
        ? chartConfig.worst.color
        : chartConfig.value.color
    }))
  );

  // For radar chart, transform data differently
  const radarData = datasets.map(dataset => {
    const datasetMetrics = filteredData.reduce((acc, comparison) => {
      const datasetMetric = comparison.datasets.find(d => d.datasetName === dataset.name);
      if (datasetMetric) {
        acc[comparison.metric] = datasetMetric.value;
      }
      return acc;
    }, {} as Record<string, number>);

    return {
      dataset: dataset.name,
      ...datasetMetrics
    };
  });

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
      {showGrid && <CartesianGrid strokeDasharray="3 3" opacity={0.3} />}
      
      <XAxis 
        dataKey="dataset" 
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
        label={{ value: 'Value', angle: -90, position: 'insideLeft' }}
      />

      <ChartTooltip
        content={
          <ChartTooltipContent
            formatter={(value, name, props) => {
              const confidence = props.payload?.confidence || 0;
              const count = props.payload?.count || 0;
              return [
                `${Number(value).toFixed(2)} (n=${count}, ${(confidence * 100).toFixed(0)}% confidence)`,
                name
              ];
            }}
            labelFormatter={(value) => `Dataset: ${value}`}
          />
        }
      />

      <Bar 
        dataKey="value" 
        radius={[4, 4, 0, 0]}
        name="Value"
      >
        {chartData.map((entry, index) => (
          <Cell key={`cell-${index}`} fill={entry.color} />
        ))}
      </Bar>

      {/* Benchmark line */}
      {showBenchmark && chartData.some(d => d.benchmark > 0) && (
        <ReferenceLine 
          y={chartData[0]?.benchmark} 
          stroke={chartConfig.benchmark.color}
          strokeDasharray="3 3"
          label={{ value: "Benchmark", position: "top" }}
        />
      )}

      {showLegend && (
        <Legend 
          verticalAlign="bottom" 
          height={36}
        />
      )}
    </BarChart>
  );

  const renderRadarChart = () => (
    <RadarChart
      data={radarData}
      margin={{
        top: 20,
        right: 30,
        left: 20,
        bottom: 20,
      }}
    >
      <PolarGrid />
      <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10 }} />
      <PolarRadiusAxis 
        tick={{ fontSize: 10 }}
        domain={[0, 'dataMax']}
      />

      {datasets.map((dataset, index) => (
        <Radar
          key={dataset.id}
          name={dataset.name}
          dataKey={dataset.name}
          stroke={`hsl(var(--chart-${(index % 5) + 1}))`}
          fill={`hsl(var(--chart-${(index % 5) + 1}))`}
          fillOpacity={0.1}
          strokeWidth={2}
        />
      ))}

      <ChartTooltip
        content={
          <ChartTooltipContent
            formatter={(value, name) => [`${Number(value).toFixed(2)}`, name]}
          />
        }
      />

      {showLegend && (
        <Legend 
          verticalAlign="bottom" 
          height={36}
        />
      )}
    </RadarChart>
  );

  // Summary stats for the first comparison
  const summaryComparison = filteredData[0];

  return (
    <div style={{ height }} className="relative">
      {/* Summary Header */}
      {summaryComparison && (
        <div className="absolute top-2 left-2 z-10">
          <div className="bg-background/90 p-2 rounded-lg border text-xs max-w-xs">
            <div className="flex items-center gap-2 mb-2">
              <Award className="w-4 h-4 text-green-500" />
              <span className="font-medium">Performance Summary</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-green-500" />
                <span>Best: {summaryComparison.analysis.bestPerforming}</span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingDown className="w-3 h-3 text-red-500" />
                <span>Worst: {summaryComparison.analysis.worstPerforming}</span>
              </div>
              <div>Avg: {summaryComparison.analysis.averageValue.toFixed(2)}</div>
              <div>CV: {(summaryComparison.analysis.coefficientOfVariation * 100).toFixed(1)}%</div>
            </div>
          </div>
        </div>
      )}

      {/* Benchmark Info */}
      {showBenchmark && summaryComparison?.benchmark && (
        <div className="absolute top-2 right-2 z-10">
          <div className="bg-background/90 p-2 rounded-lg border text-xs">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-3 h-3 text-blue-500" />
              <span className="font-medium">Benchmark</span>
            </div>
            <div>{summaryComparison.benchmark.toFixed(2)}</div>
          </div>
        </div>
      )}

      <ChartContainer config={chartConfig}>
        {chartType === 'bar' ? renderBarChart() : renderRadarChart()}
      </ChartContainer>

      {/* Recommendations */}
      {summaryComparison?.analysis.recommendations.length > 0 && (
        <div className="absolute bottom-2 left-2 right-2 z-10">
          <div className="bg-background/90 p-2 rounded-lg border text-xs">
            <div className="font-medium mb-1">Recommendations:</div>
            <div className="space-y-1">
              {summaryComparison.analysis.recommendations.slice(0, 2).map((rec, index) => (
                <div key={index} className="text-muted-foreground">
                  • {rec}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 