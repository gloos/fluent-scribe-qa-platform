import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  FileText, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Eye, 
  Download, 
  Filter,
  Settings,
  BarChart3,
  PieChart,
  Activity,
  Globe,
  Calendar,
  Target,
  Zap,
  Timer,
  MessageSquare
} from "lucide-react";
import Header from "@/components/layout/Header";
import { Link } from "react-router-dom";
import { 
  ReportsOverviewChart, 
  QualityDistributionChart, 
  IssueAnalysisChart, 
  ProcessingEfficiencyChart 
} from "@/components/charts";
import { useReportFilters, type ReportData } from "@/hooks/useReportFilters";
import { AdvancedFilters } from "@/components/filters/AdvancedFilters";
import { TrendIndicator } from "@/components/ui/trend-indicator";
import { DashboardPreferencesModal } from "@/components/dashboard/DashboardPreferences";
import { FeedbackButton } from "@/components/feedback/FeedbackButton";
import { FeedbackTargetType, FeedbackFormData } from "@/lib/types/user-feedback";

interface RecentFile {
  id: string;
  name: string;
  uploadedAt: string;
  status: "processing" | "completed" | "error";
  segments: number;
  errors: number;
  score: number;
  language: string;
  processingTime?: number;
}

const Dashboard = () => {
  const { 
    filters, 
    updateFilter, 
    updateFilters,
    resetFilters, 
    filteredData, 
    chartData, 
    summaryStats,
    isFiltering
  } = useReportFilters();

  const getStatusIcon = (status: RecentFile["status"]) => {
    switch (status) {
      case "processing":
        return <Clock className="h-4 w-4 text-blue-500" />;
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusBadge = (status: RecentFile["status"]) => {
    switch (status) {
      case "processing":
        return <Badge className="bg-blue-100 text-blue-800">Processing</Badge>;
      case "completed":
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 9) return "text-green-600";
    if (score >= 7) return "text-yellow-600";
    return "text-red-600";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Function to get active filters for display
  const getActiveFilters = () => {
    const activeFilters = [];
    
    if (filters.timeRange !== '7d') {
      const timeLabels = {
        '24h': 'Last 24h',
        '7d': 'Last 7 days',
        '30d': 'Last 30 days',
        '90d': 'Last 3 months',
        '1y': 'Last year'
      };
      activeFilters.push({ 
        key: 'timeRange', 
        label: timeLabels[filters.timeRange as keyof typeof timeLabels] || filters.timeRange,
        value: filters.timeRange 
      });
    }
    
    if (filters.reportType !== 'all') {
      activeFilters.push({ 
        key: 'reportType', 
        label: `Type: ${filters.reportType.toUpperCase()}`,
        value: filters.reportType 
      });
    }
    
    if (filters.languageFilter !== 'all') {
      const languageLabels = {
        'en-de': 'EN → DE',
        'fr-en': 'FR → EN',
        'es-en': 'ES → EN',
        'de-en': 'DE → EN',
        'ja-en': 'JA → EN',
        'zh-en': 'ZH → EN'
      };
      activeFilters.push({ 
        key: 'languageFilter', 
        label: languageLabels[filters.languageFilter as keyof typeof languageLabels] || filters.languageFilter,
        value: filters.languageFilter 
      });
    }
    
    if (filters.scoreRange[0] !== 0 || filters.scoreRange[1] !== 10) {
      activeFilters.push({ 
        key: 'scoreRange', 
        label: `Score: ${filters.scoreRange[0]}-${filters.scoreRange[1]}`,
        value: filters.scoreRange 
      });
    }
    
    if (filters.status.length !== 3) {
      activeFilters.push({ 
        key: 'status',
        label: `Status: ${filters.status.join(', ')}`,
        value: filters.status 
      });
    }
    
    if (filters.processingTimeRange[0] !== 0 || filters.processingTimeRange[1] !== 60) {
      activeFilters.push({ 
        key: 'processingTimeRange', 
        label: `Processing: ${filters.processingTimeRange[0]}-${filters.processingTimeRange[1]}min`,
        value: filters.processingTimeRange 
      });
    }
    
    if (filters.fileSize !== 'all') {
      activeFilters.push({ 
        key: 'fileSize', 
        label: `Size: ${filters.fileSize}`,
        value: filters.fileSize 
      });
    }
    
    if (filters.dateRange.from || filters.dateRange.to) {
      const fromDate = filters.dateRange.from ? formatDate(filters.dateRange.from.toISOString()) : '';
      const toDate = filters.dateRange.to ? formatDate(filters.dateRange.to.toISOString()) : '';
      activeFilters.push({ 
        key: 'dateRange', 
        label: `Date: ${fromDate} - ${toDate}`,
        value: filters.dateRange 
      });
    }
    
    return activeFilters;
  };

  const removeFilter = (filterKey: string) => {
    const defaultValues: Record<string, any> = {
      timeRange: '7d',
      reportType: 'all',
      languageFilter: 'all',
      scoreRange: [0, 10],
      dateRange: { from: null, to: null },
      fileSize: 'all',
      processingTimeRange: [0, 60],
      status: ['processing', 'completed', 'error'],
    };
    
    updateFilter(filterKey as keyof typeof filters, defaultValues[filterKey]);
  };

  // Convert filtered data to the format expected by the Recent Files section
  const recentFiles: RecentFile[] = filteredData.slice(0, 4).map((file: ReportData) => ({
    id: file.id,
    name: file.name,
    uploadedAt: file.uploadedAt,
    status: file.status,
    segments: file.segments,
    errors: file.errors,
    score: file.score,
    language: file.language,
    processingTime: file.processingTime,
  }));

  // Handle feedback submission for files and dashboard
  const handleFeedbackSubmit = async (targetId: string, feedbackData: FeedbackFormData) => {
    try {
      console.log('Dashboard feedback submitted:', targetId, feedbackData)
      // In a real application, you would call your feedback service
      // await feedbackService.submitFeedback({
      //   target_type: FeedbackTargetType.ASSESSMENT_RESULT,
      //   target_id: targetId,
      //   ...feedbackData
      // })
      
      alert(`Feedback submitted for ${targetId}!\nType: ${feedbackData.feedback_type}\nRating: ${feedbackData.rating || 'None'}\nComment: ${feedbackData.comment || 'None'}`)
    } catch (error) {
      console.error('Error submitting feedback:', error)
      alert('Error submitting feedback. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Enhanced Header with Filters and Controls */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Reports Dashboard</h1>
            <p className="text-gray-600">
              Comprehensive view of your linguistic quality assessment reports and analytics
            </p>
          </div>
          
          {/* Enhanced Filter Controls */}
          <div className="flex flex-wrap gap-3">
            <Select value={filters.timeRange} onValueChange={(value) => updateFilter('timeRange', value)}>
              <SelectTrigger className="w-36">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24h</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 3 months</SelectItem>
                <SelectItem value="1y">Last year</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.reportType} onValueChange={(value) => updateFilter('reportType', value)}>
              <SelectTrigger className="w-36">
                <FileText className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Report Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="xliff">XLIFF</SelectItem>
                <SelectItem value="mxliff">MXLIFF</SelectItem>
                <SelectItem value="tmx">TMX</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.languageFilter} onValueChange={(value) => updateFilter('languageFilter', value)}>
              <SelectTrigger className="w-36">
                <Globe className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Languages</SelectItem>
                <SelectItem value="en-de">EN → DE</SelectItem>
                <SelectItem value="fr-en">FR → EN</SelectItem>
                <SelectItem value="es-en">ES → EN</SelectItem>
                <SelectItem value="de-en">DE → EN</SelectItem>
                <SelectItem value="ja-en">JA → EN</SelectItem>
                <SelectItem value="zh-en">ZH → EN</SelectItem>
              </SelectContent>
            </Select>

            <AdvancedFilters
              filters={filters}
              onFiltersChange={updateFilters}
              onReset={resetFilters}
            >
              <Button variant="outline" size="sm" className="relative">
                <Filter className="h-4 w-4 mr-2" />
                More Filters
                {getActiveFilters().filter(f => !['timeRange', 'reportType', 'languageFilter'].includes(f.key)).length > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                  >
                    {getActiveFilters().filter(f => !['timeRange', 'reportType', 'languageFilter'].includes(f.key)).length}
                  </Badge>
                )}
              </Button>
            </AdvancedFilters>

            <DashboardPreferencesModal>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Preferences
              </Button>
            </DashboardPreferencesModal>

            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>

            {/* Reset Filters Button */}
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Reset Filters
            </Button>

            <Link to="/upload">
              <Button>Upload New File</Button>
            </Link>
          </div>
        </div>

        {/* Active Filters Display */}
        {getActiveFilters().length > 0 && (
          <div className="mb-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-gray-700 mr-2">Active Filters:</span>
              {getActiveFilters().map((filter) => (
                <Badge 
                  key={filter.key} 
                  variant="secondary" 
                  className="flex items-center gap-1 px-3 py-1"
                >
                  <span>{filter.label}</span>
                  <button
                    onClick={() => removeFilter(filter.key)}
                    className="ml-1 text-gray-500 hover:text-gray-700 focus:outline-none"
                    title="Remove filter"
                  >
                    ×
                  </button>
                </Badge>
              ))}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={resetFilters}
                className="text-gray-600 hover:text-gray-800"
              >
                Clear All
              </Button>
            </div>
          </div>
        )}

        {/* Enhanced KPI Cards - 10 cards in responsive grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Files</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryStats.totalFiles.value}</div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {summaryStats.processing} processing, {summaryStats.completed} completed
                </p>
                <TrendIndicator trend={summaryStats.totalFiles} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Quality Score</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryStats.avgScore.value}/10</div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Based on {summaryStats.completed} completed files
                </p>
                <TrendIndicator trend={summaryStats.avgScore} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Segments</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryStats.totalSegments.value.toLocaleString()}</div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Across all filtered files
                </p>
                <TrendIndicator trend={summaryStats.totalSegments} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Issues Found</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryStats.totalErrors.value}</div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  In completed files
                </p>
                <TrendIndicator trend={summaryStats.totalErrors} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Processing</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryStats.avgProcessingTime.value}min</div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Per file completion
                </p>
                <TrendIndicator trend={summaryStats.avgProcessingTime} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Language Pairs</CardTitle>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryStats.totalLanguagePairs.value}</div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Unique language pairs
                </p>
                <TrendIndicator trend={summaryStats.totalLanguagePairs} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryStats.successRate.value}%</div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Files scoring ≥8.0
                </p>
                <TrendIndicator trend={summaryStats.successRate} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryStats.errorRate.value}%</div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Errors per segment
                </p>
                <TrendIndicator trend={summaryStats.errorRate} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Daily Throughput</CardTitle>
              <Timer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryStats.dailyThroughput.value}</div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Files per day
                </p>
                <TrendIndicator trend={summaryStats.dailyThroughput} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Efficiency</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryStats.efficiencyRatio.value}</div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Segments/min
                </p>
                <TrendIndicator trend={summaryStats.efficiencyRatio} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Area - Enhanced with visualization sections */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
          {/* Reports Overview Chart */}
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Reports Overview
              </CardTitle>
              <CardDescription>
                Volume and quality trends over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80 relative">
                {isFiltering && (
                  <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-sm text-gray-600">Updating...</span>
                    </div>
                  </div>
                )}
                <ReportsOverviewChart data={chartData.reportsOverview} />
              </div>
            </CardContent>
          </Card>

          {/* Quality Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Quality Distribution
              </CardTitle>
              <CardDescription>
                Score ranges breakdown
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80 relative">
                {isFiltering && (
                  <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-sm text-gray-600">Updating...</span>
                    </div>
                  </div>
                )}
                <QualityDistributionChart data={chartData.qualityDistribution} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Issue Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Issue Analysis
              </CardTitle>
              <CardDescription>
                Common error patterns and categories
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <IssueAnalysisChart data={chartData.issueAnalysis} />
              </div>
            </CardContent>
          </Card>

          {/* Processing Time Trends */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Processing Efficiency
              </CardTitle>
              <CardDescription>
                Processing time trends and performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ProcessingEfficiencyChart data={chartData.processingEfficiency} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Tabs Section */}
        <Tabs defaultValue="recent" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="recent">Recent Files</TabsTrigger>
            <TabsTrigger value="analytics">Detailed Analytics</TabsTrigger>
            <TabsTrigger value="trends">Quality Trends</TabsTrigger>
            <TabsTrigger value="reports">Report Management</TabsTrigger>
          </TabsList>

          <TabsContent value="recent">
            <Card>
              <CardHeader>
                <CardTitle>Recent Files</CardTitle>
                <CardDescription>
                  Your most recently uploaded and processed files
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        <FileText className="h-8 w-8 text-blue-600" />
                        <div>
                          <p className="font-medium text-gray-900">{file.name}</p>
                          <p className="text-sm text-gray-500">
                            {formatDate(file.uploadedAt)} • {file.segments} segments • {file.language}
                            {file.processingTime && ` • ${file.processingTime}min`}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          {file.status === "completed" && (
                            <>
                              <p className={`text-sm font-medium ${getScoreColor(file.score)}`}>
                                Score: {file.score}/10
                              </p>
                              <p className="text-xs text-gray-500">
                                {file.errors} issues found
                              </p>
                            </>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-3">
                          {getStatusIcon(file.status)}
                          {getStatusBadge(file.status)}
                          
                          {/* Feedback Button for Completed Files */}
                          {file.status === "completed" && (
                            <FeedbackButton
                              targetType={FeedbackTargetType.ASSESSMENT_RESULT}
                              targetId={file.id}
                              onFeedbackSubmit={(feedbackData) => handleFeedbackSubmit(file.id, feedbackData)}
                              variant="icon"
                              size="sm"
                              showQuickRating={true}
                              showFeedbackCount={true}
                              feedbackCount={Math.floor(Math.random() * 10)} // Demo data
                            />
                          )}
                          
                          {file.status === "completed" && (
                            <Link to={`/reports?fileId=${file.id}`}>
                              <Button size="sm" variant="outline">
                                <Eye className="h-4 w-4 mr-1" />
                                View Report
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Feedback System Showcase Card */}
                  <div className="mt-6 p-4 border-2 border-dashed border-blue-200 rounded-lg bg-blue-50/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <MessageSquare className="h-8 w-8 text-blue-600" />
                        <div>
                          <p className="font-medium text-blue-900">User Feedback System</p>
                          <p className="text-sm text-blue-700">
                            Help us improve our QA system by providing feedback on assessments
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <FeedbackButton
                          targetType={FeedbackTargetType.TAXONOMY_STRUCTURE}
                          targetId="dashboard-system"
                          onFeedbackSubmit={(feedbackData) => handleFeedbackSubmit('dashboard-system', feedbackData)}
                          variant="button"
                          size="sm"
                          showQuickRating={true}
                        />
                        
                        <Link to="/feedback-demo">
                          <Button size="sm" variant="outline">
                            <MessageSquare className="h-4 w-4 mr-1" />
                            View Demo
                          </Button>
                        </Link>
                        
                        <Link to="/qa-errors">
                          <Button size="sm" variant="outline">
                            <AlertTriangle className="h-4 w-4 mr-1" />
                            QA Errors
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            <Card>
              <CardHeader>
                <CardTitle>Detailed Analytics</CardTitle>
                <CardDescription>
                  Deep dive into your quality assessment metrics and trends
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-gray-500">
                  <BarChart3 className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="font-medium mb-2">Advanced Analytics Dashboard</p>
                  <p className="text-sm">Detailed visualizations will be implemented in upcoming subtasks</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trends">
            <Card>
              <CardHeader>
                <CardTitle>Quality Trends</CardTitle>
                <CardDescription>
                  Historical quality metrics and improvement patterns
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-gray-500">
                  <TrendingUp className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="font-medium mb-2">Quality Trend Analysis</p>
                  <p className="text-sm">Time-series visualizations coming soon</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports">
            <Card>
              <CardHeader>
                <CardTitle>Report Management</CardTitle>
                <CardDescription>
                  Manage, export, and organize your quality assessment reports
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-center">
                  <Link to="/reports" className="w-full max-w-sm">
                    <Button className="w-full" size="lg">
                      <FileText className="h-5 w-5 mr-2" />
                      Go to Full Reports View
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;
