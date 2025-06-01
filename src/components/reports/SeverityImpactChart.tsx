import React, { useMemo } from 'react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Legend
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, TrendingUp, Target, Zap } from 'lucide-react';
import { 
  MQMDimension, 
  MQMErrorInstance, 
  MQMSeverity 
} from "@/lib/types/assessment";
import { SEVERITY_CLASSIFICATION_RULES } from "@/lib/utils/mqm-severity-classifier";

interface SeverityImpactData {
  severity: MQMSeverity;
  count: number;
  percentage: number;
  impact_level: 'low' | 'medium' | 'high' | 'critical';
  business_impact: string;
  user_experience_impact: string;
  avg_penalty: number;
  total_penalty: number;
  dimensions: Array<{
    dimension: MQMDimension;
    count: number;
    percentage: number;
  }>;
}

interface SeverityImpactChartProps {
  errors: MQMErrorInstance[];
  className?: string;
}

const chartConfig = {
  critical: {
    label: "Critical",
    color: "hsl(0 84% 60%)",
  },
  major: {
    label: "Major",
    color: "hsl(25 95% 53%)",
  },
  minor: {
    label: "Minor", 
    color: "hsl(47 96% 53%)",
  },
  neutral: {
    label: "Neutral",
    color: "hsl(142 76% 36%)",
  },
} satisfies ChartConfig;

const getSeverityColor = (severity: MQMSeverity): string => {
  switch (severity) {
    case MQMSeverity.CRITICAL:
      return chartConfig.critical.color;
    case MQMSeverity.MAJOR:
      return chartConfig.major.color;
    case MQMSeverity.MINOR:
      return chartConfig.minor.color;
    case MQMSeverity.NEUTRAL:
      return chartConfig.neutral.color;
    default:
      return 'hsl(210 40% 50%)';
  }
};

const getImpactIcon = (impactLevel: string) => {
  switch (impactLevel) {
    case 'critical':
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case 'high':
      return <TrendingUp className="h-4 w-4 text-orange-500" />;
    case 'medium':
      return <Target className="h-4 w-4 text-yellow-500" />;
    case 'low':
      return <Zap className="h-4 w-4 text-green-500" />;
    default:
      return null;
  }
};

export function SeverityImpactChart({ errors, className }: SeverityImpactChartProps) {
  // Process severity impact data
  const severityImpactData = useMemo((): SeverityImpactData[] => {
    const severityGroups = new Map<MQMSeverity, MQMErrorInstance[]>();
    
    // Group errors by severity
    errors.forEach(error => {
      if (!severityGroups.has(error.severity)) {
        severityGroups.set(error.severity, []);
      }
      severityGroups.get(error.severity)!.push(error);
    });

    // Calculate impact data for each severity
    return Array.from(severityGroups.entries()).map(([severity, severityErrors]) => {
      const count = severityErrors.length;
      const percentage = (count / errors.length) * 100;
      
      // Calculate penalty statistics
      const penalties = severityErrors.map(e => e.penalty || 0);
      const total_penalty = penalties.reduce((sum, p) => sum + p, 0);
      const avg_penalty = penalties.length > 0 ? total_penalty / penalties.length : 0;

      // Group by dimension within this severity
      const dimensionGroups = new Map<MQMDimension, number>();
      severityErrors.forEach(error => {
        dimensionGroups.set(error.dimension, (dimensionGroups.get(error.dimension) || 0) + 1);
      });

      const dimensions = Array.from(dimensionGroups.entries()).map(([dimension, dimCount]) => ({
        dimension,
        count: dimCount,
        percentage: (dimCount / count) * 100
      }));

      // Get classification criteria
      const criteria = SEVERITY_CLASSIFICATION_RULES[severity];

      return {
        severity,
        count,
        percentage,
        impact_level: criteria.impact_level,
        business_impact: criteria.business_impact,
        user_experience_impact: criteria.user_experience_impact,
        avg_penalty,
        total_penalty,
        dimensions
      };
    }).sort((a, b) => {
      // Sort by severity level (critical first)
      const severityOrder = [MQMSeverity.CRITICAL, MQMSeverity.MAJOR, MQMSeverity.MINOR, MQMSeverity.NEUTRAL];
      return severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity);
    });
  }, [errors]);

  // Prepare scatter plot data (impact level vs count)
  const scatterData = useMemo(() => {
    const impactLevelMap = {
      'low': 1,
      'medium': 2,
      'high': 3,
      'critical': 4
    };

    return severityImpactData.map(data => ({
      x: data.count,
      y: impactLevelMap[data.impact_level],
      z: data.total_penalty,
      severity: data.severity,
      label: data.severity,
      color: getSeverityColor(data.severity)
    }));
  }, [severityImpactData]);

  // Prepare bar chart data (penalty by severity)
  const penaltyData = useMemo(() => {
    return severityImpactData.map(data => ({
      severity: data.severity,
      total_penalty: data.total_penalty,
      avg_penalty: data.avg_penalty,
      count: data.count,
      fill: getSeverityColor(data.severity)
    }));
  }, [severityImpactData]);

  // Calculate total impact metrics
  const totalImpactMetrics = useMemo(() => {
    const totalErrors = errors.length;
    const criticalCount = severityImpactData.find(d => d.severity === MQMSeverity.CRITICAL)?.count || 0;
    const majorCount = severityImpactData.find(d => d.severity === MQMSeverity.MAJOR)?.count || 0;
    const totalPenalty = severityImpactData.reduce((sum, d) => sum + d.total_penalty, 0);
    
    return {
      totalErrors,
      criticalCount,
      majorCount,
      highImpactRatio: ((criticalCount + majorCount) / totalErrors) * 100,
      totalPenalty,
      avgPenaltyPerError: totalErrors > 0 ? totalPenalty / totalErrors : 0
    };
  }, [severityImpactData, errors]);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Severity Impact Analysis
        </CardTitle>
        <CardDescription>
          Business impact and severity distribution analysis
        </CardDescription>
        
        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">
              {totalImpactMetrics.criticalCount}
            </div>
            <div className="text-sm text-red-800">Critical Issues</div>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">
              {totalImpactMetrics.majorCount}
            </div>
            <div className="text-sm text-orange-800">Major Issues</div>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">
              {totalImpactMetrics.highImpactRatio.toFixed(1)}%
            </div>
            <div className="text-sm text-yellow-800">High Impact Ratio</div>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {totalImpactMetrics.avgPenaltyPerError.toFixed(2)}
            </div>
            <div className="text-sm text-blue-800">Avg Penalty/Error</div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="distribution" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="distribution">Distribution</TabsTrigger>
            <TabsTrigger value="impact">Impact Analysis</TabsTrigger>
            <TabsTrigger value="penalties">Penalty Analysis</TabsTrigger>
          </TabsList>
          
          <TabsContent value="distribution" className="space-y-4">
            <div className="h-80">
              <ChartContainer config={chartConfig}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={severityImpactData}
                      dataKey="count"
                      nameKey="severity"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      innerRadius={40}
                      label={({ severity, percentage }) => `${severity}: ${percentage.toFixed(1)}%`}
                    >
                      {severityImpactData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getSeverityColor(entry.severity)} />
                      ))}
                    </Pie>
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(value) => `Severity: ${value}`}
                          formatter={(value, name) => [
                            `${value} errors (${((value as number) / errors.length * 100).toFixed(1)}%)`,
                            name
                          ]}
                        />
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
            
            {/* Severity Details */}
            <div className="space-y-3">
              {severityImpactData.map((data) => (
                <div key={data.severity} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getImpactIcon(data.impact_level)}
                      <Badge 
                        variant="secondary" 
                        style={{ backgroundColor: getSeverityColor(data.severity), color: 'white' }}
                      >
                        {data.severity}
                      </Badge>
                      <span className="font-medium">{data.count} errors ({data.percentage.toFixed(1)}%)</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Impact Level: {data.impact_level}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground mb-2">
                    <strong>Business Impact:</strong> {data.business_impact}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <strong>User Experience:</strong> {data.user_experience_impact}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="impact" className="space-y-4">
            <div className="h-80">
              <ChartContainer config={chartConfig}>
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart
                    margin={{
                      top: 20,
                      right: 20,
                      bottom: 20,
                      left: 20,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      type="number" 
                      dataKey="x" 
                      name="Error Count"
                      label={{ value: 'Error Count', position: 'insideBottom', offset: -10 }}
                    />
                    <YAxis 
                      type="number" 
                      dataKey="y"
                      domain={[0, 5]}
                      tickFormatter={(value) => {
                        const labels = ['', 'Low', 'Medium', 'High', 'Critical'];
                        return labels[value] || '';
                      }}
                      label={{ value: 'Impact Level', angle: -90, position: 'insideLeft' }}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={() => ''}
                          formatter={(value, name, props) => {
                            const data = props.payload;
                            return [
                              `Severity: ${data.severity}`,
                              `Count: ${data.x}`,
                              `Total Penalty: ${data.z?.toFixed(2)}`
                            ];
                          }}
                        />
                      }
                    />
                    <Scatter name="Severity Impact" data={scatterData} fill="#8884d8">
                      {scatterData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </TabsContent>
          
          <TabsContent value="penalties" className="space-y-4">
            <div className="h-80">
              <ChartContainer config={chartConfig}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={penaltyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="severity" />
                    <YAxis />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(value) => `Severity: ${value}`}
                          formatter={(value, name) => [
                            name === 'total_penalty' ? 
                              `Total: ${(value as number).toFixed(2)}` :
                              `Average: ${(value as number).toFixed(2)}`,
                            name === 'total_penalty' ? 'Total Penalty' : 'Avg Penalty'
                          ]}
                        />
                      }
                    />
                    <Bar dataKey="total_penalty" name="Total Penalty" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
            
            {/* Penalty Statistics Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-200 px-4 py-2 text-left">Severity</th>
                    <th className="border border-gray-200 px-4 py-2 text-right">Count</th>
                    <th className="border border-gray-200 px-4 py-2 text-right">Total Penalty</th>
                    <th className="border border-gray-200 px-4 py-2 text-right">Avg Penalty</th>
                    <th className="border border-gray-200 px-4 py-2 text-right">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {severityImpactData.map((data) => (
                    <tr key={data.severity}>
                      <td className="border border-gray-200 px-4 py-2">
                        <Badge 
                          variant="secondary"
                          style={{ backgroundColor: getSeverityColor(data.severity), color: 'white' }}
                        >
                          {data.severity}
                        </Badge>
                      </td>
                      <td className="border border-gray-200 px-4 py-2 text-right">{data.count}</td>
                      <td className="border border-gray-200 px-4 py-2 text-right">{data.total_penalty.toFixed(2)}</td>
                      <td className="border border-gray-200 px-4 py-2 text-right">{data.avg_penalty.toFixed(2)}</td>
                      <td className="border border-gray-200 px-4 py-2 text-right">{data.percentage.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
} 