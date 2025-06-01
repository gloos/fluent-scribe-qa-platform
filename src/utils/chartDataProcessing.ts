import { type ReportData } from "@/hooks/useReportFilters";
import { format, parseISO, startOfDay, subDays, eachDayOfInterval } from "date-fns";

export interface ChartDataPoint {
  date: string;
  value: number;
  count?: number;
}

export interface StatusDistribution {
  status: string;
  count: number;
  percentage: number;
  color: string;
}

export interface QualityDistribution {
  range: string;
  count: number;
  percentage: number;
  color: string;
}

export interface LanguageDistribution {
  language: string;
  count: number;
  avgScore: number;
  totalErrors: number;
}

export interface ModelPerformance {
  model: string;
  count: number;
  avgScore: number;
  avgErrors: number;
  avgSegments: number;
}

// Color schemes for consistent theming
export const STATUS_COLORS = {
  completed: "hsl(142 76% 36%)", // Green
  processing: "hsl(47 96% 53%)", // Yellow
  pending: "hsl(217 91% 60%)", // Blue
  failed: "hsl(0 84% 60%)", // Red
} as const;

export const QUALITY_COLORS = {
  excellent: "hsl(142 76% 36%)", // Green
  good: "hsl(47 96% 53%)", // Yellow
  fair: "hsl(25 95% 53%)", // Orange
  poor: "hsl(0 84% 60%)", // Red
} as const;

/**
 * Aggregates report data by date for time-series charts
 */
export function aggregateReportsByDate(
  reports: ReportData[],
  days: number = 30
): ChartDataPoint[] {
  const endDate = new Date();
  const startDate = subDays(endDate, days - 1);
  
  // Create date range
  const dateRange = eachDayOfInterval({ start: startDate, end: endDate });
  
  // Group reports by date
  const reportsByDate = reports.reduce((acc, report) => {
    const reportDate = format(startOfDay(parseISO(report.uploadedAt)), "yyyy-MM-dd");
    if (!acc[reportDate]) {
      acc[reportDate] = [];
    }
    acc[reportDate].push(report);
    return acc;
  }, {} as Record<string, ReportData[]>);
  
  // Create chart data points
  return dateRange.map(date => {
    const dateKey = format(date, "yyyy-MM-dd");
    const dayReports = reportsByDate[dateKey] || [];
    
    return {
      date: format(date, "MMM dd"),
      value: dayReports.length,
      count: dayReports.length,
    };
  });
}

/**
 * Calculates status distribution for pie charts
 */
export function calculateStatusDistribution(reports: ReportData[]): StatusDistribution[] {
  const statusCounts = reports.reduce((acc, report) => {
    acc[report.status] = (acc[report.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const total = reports.length;
  
  return Object.entries(statusCounts).map(([status, count]) => ({
    status,
    count,
    percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    color: STATUS_COLORS[status as keyof typeof STATUS_COLORS] || "hsl(240 10% 50%)",
  }));
}

/**
 * Calculates quality score distribution
 */
export function calculateQualityDistribution(reports: ReportData[]): QualityDistribution[] {
  const completedReports = reports.filter(r => r.status === 'completed' && r.score > 0);
  
  const distributions = {
    excellent: { range: "Excellent (9-10)", count: 0, color: QUALITY_COLORS.excellent },
    good: { range: "Good (7-8.9)", count: 0, color: QUALITY_COLORS.good },
    fair: { range: "Fair (5-6.9)", count: 0, color: QUALITY_COLORS.fair },
    poor: { range: "Poor (<5)", count: 0, color: QUALITY_COLORS.poor },
  };
  
  completedReports.forEach(report => {
    if (report.score >= 9) distributions.excellent.count++;
    else if (report.score >= 7) distributions.good.count++;
    else if (report.score >= 5) distributions.fair.count++;
    else distributions.poor.count++;
  });
  
  const total = completedReports.length;
  
  return Object.values(distributions)
    .map(dist => ({
      ...dist,
      percentage: total > 0 ? Math.round((dist.count / total) * 100) : 0,
    }))
    .filter(dist => dist.count > 0); // Only include categories with data
}

/**
 * Aggregates performance by language
 */
export function aggregateByLanguage(reports: ReportData[]): LanguageDistribution[] {
  const languageGroups = reports.reduce((acc, report) => {
    if (!acc[report.language]) {
      acc[report.language] = [];
    }
    acc[report.language].push(report);
    return acc;
  }, {} as Record<string, ReportData[]>);
  
  return Object.entries(languageGroups).map(([language, languageReports]) => {
    const completedReports = languageReports.filter(r => r.status === 'completed');
    const avgScore = completedReports.length > 0
      ? completedReports.reduce((sum, r) => sum + r.score, 0) / completedReports.length
      : 0;
    const totalErrors = languageReports.reduce((sum, r) => sum + r.errors, 0);
    
    return {
      language,
      count: languageReports.length,
      avgScore: Number(avgScore.toFixed(1)),
      totalErrors,
    };
  }).sort((a, b) => b.count - a.count);
}

/**
 * Aggregates performance by AI model
 */
export function aggregateByModel(reports: ReportData[]): ModelPerformance[] {
  const reportsWithModel = reports.filter(r => r.modelUsed);
  
  const modelGroups = reportsWithModel.reduce((acc, report) => {
    const model = report.modelUsed!;
    if (!acc[model]) {
      acc[model] = [];
    }
    acc[model].push(report);
    return acc;
  }, {} as Record<string, ReportData[]>);
  
  return Object.entries(modelGroups).map(([model, modelReports]) => {
    const completedReports = modelReports.filter(r => r.status === 'completed');
    const avgScore = completedReports.length > 0
      ? completedReports.reduce((sum, r) => sum + r.score, 0) / completedReports.length
      : 0;
    const avgErrors = modelReports.length > 0
      ? modelReports.reduce((sum, r) => sum + r.errors, 0) / modelReports.length
      : 0;
    const avgSegments = modelReports.length > 0
      ? modelReports.reduce((sum, r) => sum + r.segments, 0) / modelReports.length
      : 0;
    
    return {
      model,
      count: modelReports.length,
      avgScore: Number(avgScore.toFixed(1)),
      avgErrors: Number(avgErrors.toFixed(1)),
      avgSegments: Math.round(avgSegments),
    };
  }).sort((a, b) => b.count - a.count);
}

/**
 * Calculates error trends over time
 */
export function calculateErrorTrends(
  reports: ReportData[],
  days: number = 30
): Array<{ date: string; avgErrors: number; totalErrors: number; count: number }> {
  const endDate = new Date();
  const startDate = subDays(endDate, days - 1);
  const dateRange = eachDayOfInterval({ start: startDate, end: endDate });
  
  const reportsByDate = reports.reduce((acc, report) => {
    const reportDate = format(startOfDay(parseISO(report.uploadedAt)), "yyyy-MM-dd");
    if (!acc[reportDate]) {
      acc[reportDate] = [];
    }
    acc[reportDate].push(report);
    return acc;
  }, {} as Record<string, ReportData[]>);
  
  return dateRange.map(date => {
    const dateKey = format(date, "yyyy-MM-dd");
    const dayReports = reportsByDate[dateKey] || [];
    const totalErrors = dayReports.reduce((sum, r) => sum + r.errors, 0);
    const avgErrors = dayReports.length > 0 ? totalErrors / dayReports.length : 0;
    
    return {
      date: format(date, "MMM dd"),
      avgErrors: Number(avgErrors.toFixed(1)),
      totalErrors,
      count: dayReports.length,
    };
  });
}

/**
 * Calculates processing efficiency metrics
 */
export function calculateProcessingEfficiency(reports: ReportData[]) {
  const completedReports = reports.filter(r => r.status === 'completed');
  const totalReports = reports.length;
  const processingReports = reports.filter(r => r.status === 'processing' || r.status === 'pending').length;
  const failedReports = reports.filter(r => r.status === 'failed').length;
  
  const completionRate = totalReports > 0 ? (completedReports.length / totalReports) * 100 : 0;
  const failureRate = totalReports > 0 ? (failedReports / totalReports) * 100 : 0;
  
  return {
    totalReports,
    completedReports: completedReports.length,
    processingReports,
    failedReports,
    completionRate: Number(completionRate.toFixed(1)),
    failureRate: Number(failureRate.toFixed(1)),
  };
} 