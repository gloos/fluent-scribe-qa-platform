import { useMemo } from "react";
import { type ReportData } from "@/hooks/useReportFilters";
import {
  aggregateReportsByDate,
  calculateStatusDistribution,
  calculateQualityDistribution,
  aggregateByLanguage,
  aggregateByModel,
  calculateErrorTrends,
  calculateProcessingEfficiency,
  type ChartDataPoint,
  type StatusDistribution,
  type QualityDistribution,
  type LanguageDistribution,
  type ModelPerformance,
} from "@/utils/chartDataProcessing";

export interface ChartDatasets {
  // Time-based charts
  reportsOverTime: ChartDataPoint[];
  errorTrends: Array<{ date: string; avgErrors: number; totalErrors: number; count: number }>;
  
  // Distribution charts
  statusDistribution: StatusDistribution[];
  qualityDistribution: QualityDistribution[];
  
  // Performance analysis
  languagePerformance: LanguageDistribution[];
  modelPerformance: ModelPerformance[];
  
  // Efficiency metrics
  processingEfficiency: {
    totalReports: number;
    completedReports: number;
    processingReports: number;
    failedReports: number;
    completionRate: number;
    failureRate: number;
  };
  
  // Aggregated stats for summary cards
  summaryStats: {
    totalReports: number;
    avgQualityScore: number;
    totalErrors: number;
    avgErrorsPerReport: number;
    mostActiveLanguage: string;
    bestPerformingModel: string;
  };
}

export interface UseChartDataProps {
  data: ReportData[];
  timeframeDays?: number;
}

/**
 * Hook that provides comprehensive chart datasets that update dynamically
 * with filtered data changes
 */
export function useChartData({ 
  data, 
  timeframeDays = 30 
}: UseChartDataProps): ChartDatasets {
  
  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        reportsOverTime: [],
        errorTrends: [],
        statusDistribution: [],
        qualityDistribution: [],
        languagePerformance: [],
        modelPerformance: [],
        processingEfficiency: {
          totalReports: 0,
          completedReports: 0,
          processingReports: 0,
          failedReports: 0,
          completionRate: 0,
          failureRate: 0,
        },
        summaryStats: {
          totalReports: 0,
          avgQualityScore: 0,
          totalErrors: 0,
          avgErrorsPerReport: 0,
          mostActiveLanguage: "-",
          bestPerformingModel: "-",
        },
      };
    }

    // Generate all chart datasets
    const reportsOverTime = aggregateReportsByDate(data, timeframeDays);
    const errorTrends = calculateErrorTrends(data, timeframeDays);
    const statusDistribution = calculateStatusDistribution(data);
    const qualityDistribution = calculateQualityDistribution(data);
    const languagePerformance = aggregateByLanguage(data);
    const modelPerformance = aggregateByModel(data);
    const processingEfficiency = calculateProcessingEfficiency(data);

    // Calculate summary statistics
    const completedReports = data.filter(r => r.status === 'completed');
    const avgQualityScore = completedReports.length > 0
      ? completedReports.reduce((sum, r) => sum + r.score, 0) / completedReports.length
      : 0;
    
    const totalErrors = data.reduce((sum, r) => sum + r.errors, 0);
    const avgErrorsPerReport = data.length > 0 ? totalErrors / data.length : 0;
    
    const mostActiveLanguage = languagePerformance[0]?.language || "-";
    const bestPerformingModel = modelPerformance
      .filter(m => m.count >= 3) // Require at least 3 reports for statistical significance
      .sort((a, b) => b.avgScore - a.avgScore)[0]?.model || "-";

    const summaryStats = {
      totalReports: data.length,
      avgQualityScore: Number(avgQualityScore.toFixed(1)),
      totalErrors,
      avgErrorsPerReport: Number(avgErrorsPerReport.toFixed(1)),
      mostActiveLanguage,
      bestPerformingModel,
    };

    return {
      reportsOverTime,
      errorTrends,
      statusDistribution,
      qualityDistribution,
      languagePerformance,
      modelPerformance,
      processingEfficiency,
      summaryStats,
    };
  }, [data, timeframeDays]);

  return chartData;
}

/**
 * Hook for getting specific chart data with caching
 */
export function useSpecificChartData<T extends keyof ChartDatasets>(
  data: ReportData[],
  chartType: T,
  timeframeDays?: number
): ChartDatasets[T] {
  const allChartData = useChartData({ data, timeframeDays });
  return allChartData[chartType];
}

/**
 * Hook for real-time chart updates - returns whether data has changed
 * in the last update cycle
 */
export function useChartDataChangeDetection(data: ReportData[]) {
  const chartData = useChartData({ data });
  
  // This could be enhanced with more sophisticated change detection
  // For now, we'll just track the total count and last update
  const changeIndicators = useMemo(() => ({
    totalReports: chartData.summaryStats.totalReports,
    lastUpdate: Date.now(),
    hasProcessingReports: chartData.processingEfficiency.processingReports > 0,
  }), [chartData]);
  
  return changeIndicators;
} 