import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  BarChart3, 
  PieChart as PieChartIcon, 
  TrendingUp, 
  Activity,
  Table as TableIcon,
  Grid3X3,
  Download,
  Settings,
  Calendar,
  RefreshCw,
  FileImage,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

import { ReportsOverviewChart } from "@/components/charts/ReportsOverviewChart";
import { QualityDistributionChart } from "@/components/charts/QualityDistributionChart";
import { IssueAnalysisChart } from "@/components/charts/IssueAnalysisChart";
import { ProcessingEfficiencyChart } from "@/components/charts/ProcessingEfficiencyChart";

import { useChartData, type ChartDatasets } from "@/hooks/useChartData";
import { type ReportData } from "@/hooks/useReportFilters";
import { type DrillDownLevel } from "@/hooks/useDrillDown";
import {
  aggregateReportsByDate,
  calculateQualityDistribution,
  aggregateByLanguage,
  aggregateByModel,
} from "@/utils/chartDataProcessing";
import { toast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';

export type ViewMode = "table" | "charts" | "mixed";
export type ChartLayout = "grid" | "stacked" | "carousel";
export type TimeframeOption = 7 | 14 | 30 | 60 | 90;

interface ReportsVisualizationDashboardProps {
  data: ReportData[];
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  className?: string;
  onDataPointClick?: (level: DrillDownLevel) => void;
  enableDrillDown?: boolean;
}

const TIMEFRAME_OPTIONS: Array<{ value: TimeframeOption; label: string }> = [
  { value: 7, label: "Last 7 days" },
  { value: 14, label: "Last 2 weeks" },
  { value: 30, label: "Last 30 days" },
  { value: 60, label: "Last 2 months" },
  { value: 90, label: "Last 3 months" },
];

export function ReportsVisualizationDashboard({
  data,
  viewMode,
  onViewModeChange,
  className,
  onDataPointClick,
  enableDrillDown = false,
}: ReportsVisualizationDashboardProps) {
  const [timeframe, setTimeframe] = useState<TimeframeOption>(30);
  const [chartLayout, setChartLayout] = useState<ChartLayout>("grid");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Get dynamic chart data based on filtered reports
  const chartData = useChartData({ data, timeframeDays: timeframe });

  // Transform data for existing chart components
  const reportsOverTimeData = chartData.reportsOverTime.map(point => ({
    date: point.date,
    files: point.value,
    avgScore: data.length > 0 ? 
      data.filter(r => r.status === 'completed')
           .reduce((avg, r, _, arr) => avg + r.score / arr.length, 0) : 0
  }));

  const qualityDistData = chartData.qualityDistribution;

  // Transform language data for IssueAnalysisChart (category -> language, count -> error count)
  const languageData = chartData.languagePerformance.map(lang => ({
    category: lang.language,
    count: lang.totalErrors,
  }));

  // Transform error trends for ProcessingEfficiencyChart (date -> processing time chart)
  const efficiencyData = chartData.errorTrends.map(trend => ({
    date: trend.date,
    avgTime: trend.avgErrors, // Using avgErrors as a proxy for processing complexity
  }));

  const handleExport = async (format: 'pdf' | 'excel' | 'json' | 'csv') => {
    setIsExporting(true);
    
    try {
      switch (format) {
        case 'pdf':
          await exportToPDF();
          break;
        case 'excel':
          exportToExcel();
          break;
        case 'json':
          exportToJSON();
          break;
        case 'csv':
          exportToCSV();
          break;
      }

      toast({
        title: "Export successful",
        description: `Charts and data exported as ${format.toUpperCase()}`,
      });
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: "Export failed",
        description: "There was an error exporting the charts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const exportToPDF = async () => {
    const doc = new jsPDF('landscape', 'mm', 'a4');
    
    // Add title and metadata
    doc.setFontSize(20);
    doc.text('Reports Dashboard Export', 20, 20);
    
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 30);
    doc.text(`Timeframe: Last ${timeframe} days`, 20, 35);
    doc.text(`Total reports: ${data.length}`, 20, 40);
    
    // Add summary statistics
    doc.setFontSize(14);
    doc.text('Summary Statistics', 20, 55);
    
    const summaryData = [
      ['Metric', 'Value'],
      ['Total Reports', chartData.summaryStats.totalReports.toString()],
      ['Average Quality Score', `${chartData.summaryStats.avgQualityScore}/10`],
      ['Total Errors', chartData.summaryStats.totalErrors.toString()],
      ['Completion Rate', `${chartData.processingEfficiency.completionRate}%`],
    ];

    (doc as any).autoTable({
      head: [summaryData[0]],
      body: summaryData.slice(1),
      startY: 60,
      theme: 'grid',
      styles: { fontSize: 10 },
      headStyles: { fillColor: [66, 139, 202] },
      columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 40 } }
    });

    // Add chart data tables
    let yPosition = (doc as any).lastAutoTable.finalY + 20;

    // Reports over time data
    doc.setFontSize(12);
    doc.text('Reports Over Time', 20, yPosition);
    
    const reportsTimeData = [
      ['Date', 'Reports Count', 'Average Score'],
      ...chartData.reportsOverTime.slice(0, 10).map(item => [
        new Date(item.date).toLocaleDateString(),
        item.value.toString(),
        'N/A'
      ])
    ];

    (doc as any).autoTable({
      head: [reportsTimeData[0]],
      body: reportsTimeData.slice(1),
      startY: yPosition + 5,
      theme: 'striped',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 139, 202] }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 15;

    // Language performance data
    doc.text('Language Performance', 20, yPosition);
    
    const languageData = [
      ['Language', 'Total Reports', 'Total Errors', 'Avg Score'],
      ...chartData.languagePerformance.slice(0, 8).map(item => [
        item.language,
        item.count.toString(),
        item.totalErrors.toString(),
        item.avgScore.toFixed(2)
      ])
    ];

    (doc as any).autoTable({
      head: [languageData[0]],
      body: languageData.slice(1),
      startY: yPosition + 5,
      theme: 'striped',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 139, 202] }
    });

    // Try to capture charts as images if possible
    if (chartContainerRef.current) {
      try {
        const canvas = await html2canvas(chartContainerRef.current, {
          height: 600,
          width: 1200,
          scale: 0.5
        });
        
        const imgData = canvas.toDataURL('image/png');
        doc.addPage();
        doc.text('Charts Visualization', 20, 20);
        doc.addImage(imgData, 'PNG', 20, 30, 250, 150);
      } catch (error) {
        console.warn('Could not capture charts as image:', error);
      }
    }

    doc.save(`dashboard-export-${Date.now()}.pdf`);
  };

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    
    // Summary sheet
    const summaryData = [
      ['Dashboard Export Summary'],
      [''],
      ['Generated on', new Date().toISOString()],
      ['Timeframe', `Last ${timeframe} days`],
      ['Total Reports', chartData.summaryStats.totalReports],
      ['Average Quality Score', chartData.summaryStats.avgQualityScore],
      ['Total Errors', chartData.summaryStats.totalErrors],
      ['Completion Rate', `${chartData.processingEfficiency.completionRate}%`],
    ];
    
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

    // Reports over time sheet
    const reportsTimeData = [
      ['Date', 'Reports Count'],
      ...chartData.reportsOverTime.map(item => [
        item.date,
        item.value
      ])
    ];
    
    const reportsTimeWs = XLSX.utils.aoa_to_sheet(reportsTimeData);
    XLSX.utils.book_append_sheet(wb, reportsTimeWs, 'Reports Over Time');

    // Language performance sheet
    const languageData = [
      ['Language', 'Total Reports', 'Total Errors', 'Average Score'],
      ...chartData.languagePerformance.map(item => [
        item.language,
        item.count,
        item.totalErrors,
        item.avgScore
      ])
    ];
    
    const languageWs = XLSX.utils.aoa_to_sheet(languageData);
    XLSX.utils.book_append_sheet(wb, languageWs, 'Language Performance');

    // Quality distribution sheet
    const qualityData = [
      ['Quality Range', 'Count'],
      ...chartData.qualityDistribution.map(item => [
        item.range,
        item.count
      ])
    ];
    
    const qualityWs = XLSX.utils.aoa_to_sheet(qualityData);
    XLSX.utils.book_append_sheet(wb, qualityWs, 'Quality Distribution');

    XLSX.writeFile(wb, `dashboard-export-${Date.now()}.xlsx`);
  };

  const exportToJSON = () => {
    const exportData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        timeframe: timeframe,
        totalReports: data.length,
        exportType: 'dashboard_charts'
      },
      summaryStats: chartData.summaryStats,
      processingEfficiency: chartData.processingEfficiency,
      charts: {
        reportsOverTime: chartData.reportsOverTime,
        qualityDistribution: chartData.qualityDistribution,
        languagePerformance: chartData.languagePerformance,
        errorTrends: chartData.errorTrends,
        modelPerformance: chartData.modelPerformance
      },
      rawData: data
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dashboard-export-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportToCSV = () => {
    // Export summary statistics as CSV
    const headers = ['Metric', 'Value'];
    const rows = [
      ['Total Reports', chartData.summaryStats.totalReports],
      ['Average Quality Score', chartData.summaryStats.avgQualityScore],
      ['Total Errors', chartData.summaryStats.totalErrors],
      ['Completion Rate', `${chartData.processingEfficiency.completionRate}%`],
      [''], // Empty row
      ['Date', 'Reports Count'],
      ...chartData.reportsOverTime.map(item => [
        item.date,
        item.value
      ])
    ];

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dashboard-export-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const ViewModeSelector = () => (
    <div className="flex items-center gap-1 bg-muted p-1 rounded-md">
      <Button
        variant={viewMode === "table" ? "default" : "ghost"}
        size="sm"
        onClick={() => onViewModeChange("table")}
        className="h-8"
      >
        <TableIcon className="h-4 w-4 mr-1" />
        Table
      </Button>
      <Button
        variant={viewMode === "charts" ? "default" : "ghost"}
        size="sm"
        onClick={() => onViewModeChange("charts")}
        className="h-8"
      >
        <BarChart3 className="h-4 w-4 mr-1" />
        Charts
      </Button>
      <Button
        variant={viewMode === "mixed" ? "default" : "ghost"}
        size="sm"
        onClick={() => onViewModeChange("mixed")}
        className="h-8"
      >
        <Grid3X3 className="h-4 w-4 mr-1" />
        Mixed
      </Button>
    </div>
  );

  const ChartControls = () => (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <Select value={timeframe.toString()} onValueChange={(value) => setTimeframe(Number(value) as TimeframeOption)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIMEFRAME_OPTIONS.map(option => (
              <SelectItem key={option.value} value={option.value.toString()}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={isExporting}>
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Export Charts'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>
            Export Dashboard
            <div className="text-xs text-muted-foreground font-normal">
              Charts and data for {timeframe} days
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={() => handleExport('pdf')}>
            <FileImage className="h-4 w-4 mr-2" />
            PDF Report
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => handleExport('excel')}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Excel Workbook
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => handleExport('csv')}>
            <TableIcon className="h-4 w-4 mr-2" />
            CSV Data
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => handleExport('json')}>
            <FileText className="h-4 w-4 mr-2" />
            JSON Data
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="outline"
        size="sm"
        onClick={() => setAutoRefresh(!autoRefresh)}
        className={autoRefresh ? "bg-blue-50 border-blue-200" : ""}
      >
        <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
        Auto Refresh
      </Button>
    </div>
  );

  const SummaryCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-foreground">
                {chartData.summaryStats.totalReports}
              </div>
              <div className="text-sm text-muted-foreground">Total Reports</div>
            </div>
            <BarChart3 className="h-8 w-8 text-blue-500" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-foreground">
                {chartData.summaryStats.avgQualityScore}/10
              </div>
              <div className="text-sm text-muted-foreground">Avg Quality Score</div>
            </div>
            <TrendingUp className="h-8 w-8 text-green-500" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-foreground">
                {chartData.summaryStats.totalErrors}
              </div>
              <div className="text-sm text-muted-foreground">Total Errors</div>
            </div>
            <Activity className="h-8 w-8 text-red-500" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-foreground">
                {chartData.processingEfficiency.completionRate}%
              </div>
              <div className="text-sm text-muted-foreground">Completion Rate</div>
            </div>
            <PieChartIcon className="h-8 w-8 text-purple-500" />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  if (viewMode === "table") {
    return null; // Table view is handled by parent component
  }

  return (
    <div className={className}>
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-4">
          <ViewModeSelector />
          <Badge variant="outline" className="text-xs">
            {data.length} report{data.length !== 1 ? 's' : ''} • {timeframe} days
          </Badge>
        </div>
        <ChartControls />
      </div>

      {/* Summary Cards */}
      <SummaryCards />

      {/* Chart Grid */}
      <div ref={chartContainerRef} className={`grid gap-6 ${
        chartLayout === "grid" 
          ? "grid-cols-1 lg:grid-cols-2" 
          : "grid-cols-1"
      }`}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Reports Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ReportsOverviewChart 
              data={reportsOverTimeData}
              height={300}
              timeframeDays={timeframe}
              onDataPointClick={onDataPointClick}
              enableDrillDown={enableDrillDown}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5" />
              Quality Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <QualityDistributionChart 
              data={qualityDistData}
              height={300}
              onDataPointClick={onDataPointClick}
              enableDrillDown={enableDrillDown}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Language Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <IssueAnalysisChart 
              data={languageData}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Processing Efficiency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ProcessingEfficiencyChart 
              data={efficiencyData}
            />
          </CardContent>
        </Card>
      </div>

      {/* Data Insights */}
      {data.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Key Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium mb-2">Performance Highlights</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Most active language: {chartData.summaryStats.mostActiveLanguage}</li>
                  <li>• Best performing model: {chartData.summaryStats.bestPerformingModel}</li>
                  <li>• Average errors per report: {chartData.summaryStats.avgErrorsPerReport}</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Processing Status</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Completed: {chartData.processingEfficiency.completedReports} reports</li>
                  <li>• Processing: {chartData.processingEfficiency.processingReports} reports</li>
                  <li>• Failed: {chartData.processingEfficiency.failedReports} reports</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 