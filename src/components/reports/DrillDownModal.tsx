import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  Home, 
  FileText, 
  BarChart3, 
  Calendar,
  Globe,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  RefreshCw
} from "lucide-react";

import { DrillDownLevel, DrillDownData, DrillDownSegment } from "@/hooks/useDrillDown";
import { ReportsOverviewChart } from "@/components/charts/ReportsOverviewChart";
import { QualityDistributionChart } from "@/components/charts/QualityDistributionChart";

interface DrillDownModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  navigationPath: DrillDownLevel[];
  currentLevel: DrillDownLevel;
  data: DrillDownData;
  onNavigateBack: () => void;
  onResetToOverview: () => void;
  canNavigateBack: boolean;
}

export function DrillDownModal({
  open,
  onOpenChange,
  navigationPath,
  currentLevel,
  data,
  onNavigateBack,
  onResetToOverview,
  canNavigateBack,
}: DrillDownModalProps) {
  const [activeTab, setActiveTab] = useState("overview");

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getIssueIcon = (severity?: string) => {
    switch (severity?.toLowerCase()) {
      case 'major':
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'minor':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-green-600 bg-green-50 border-green-200";
    if (score >= 6) return "text-yellow-600 bg-yellow-50 border-yellow-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  const BreadcrumbNavigation = () => (
    <div className="flex items-center gap-2 mb-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={onResetToOverview}
        className="p-1"
      >
        <Home className="h-4 w-4" />
      </Button>
      
      {navigationPath.map((level, index) => (
        <div key={index} className="flex items-center gap-2">
          {index > 0 && <span className="text-muted-foreground">/</span>}
          <span className={index === navigationPath.length - 1 ? "font-medium" : "text-muted-foreground"}>
            {level.label}
          </span>
        </div>
      ))}
      
      {canNavigateBack && (
        <Button
          variant="outline"
          size="sm"
          onClick={onNavigateBack}
          className="ml-auto"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
      )}
    </div>
  );

  const OverviewTab = () => {
    if (data.loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-600">Loading data...</span>
        </div>
      );
    }

    if (data.error) {
      return (
        <div className="text-center py-12">
          <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Data</h3>
          <p className="text-gray-600">{data.error}</p>
        </div>
      );
    }

    const stats = calculateStats();

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">{stats.totalItems}</div>
                  <div className="text-sm text-muted-foreground">
                    {currentLevel.type === 'file' ? 'Segments' : 'Reports'}
                  </div>
                </div>
                <FileText className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">{stats.avgScore.toFixed(1)}</div>
                  <div className="text-sm text-muted-foreground">Avg Score</div>
                </div>
                <BarChart3 className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">{stats.totalErrors}</div>
                  <div className="text-sm text-muted-foreground">Total Issues</div>
                </div>
                <AlertTriangle className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">{stats.completionRate}%</div>
                  <div className="text-sm text-muted-foreground">Success Rate</div>
                </div>
                <CheckCircle className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts for Reports */}
        {data.reports && data.reports.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quality Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <QualityDistributionChart data={getQualityDistributionData()} height={250} />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Processing Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <ReportsOverviewChart data={getTimelineData()} height={250} />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    );
  };

  const DataTab = () => {
    if (data.loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-600">Loading data...</span>
        </div>
      );
    }

    if (currentLevel.type === 'file' && data.segments) {
      return <SegmentsTable segments={data.segments} />;
    }

    if (data.reports) {
      return <ReportsTable reports={data.reports} />;
    }

    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Available</h3>
        <p className="text-gray-600">No data found for the current selection.</p>
      </div>
    );
  };

  const ReportsTable = ({ reports }: { reports: any[] }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>File Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Score</TableHead>
          <TableHead>Errors</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {reports.map((report) => (
          <TableRow key={report.id}>
            <TableCell className="font-medium">{report.file_name}</TableCell>
            <TableCell>
              <Badge variant="outline">{report.analysis_status}</Badge>
            </TableCell>
            <TableCell>
              <Badge variant="outline" className={getScoreColor(report.mqm_score || 0)}>
                {(report.mqm_score || 0).toFixed(1)}
              </Badge>
            </TableCell>
            <TableCell>{report.error_count || 0}</TableCell>
            <TableCell>{formatDate(report.created_at)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  const SegmentsTable = ({ segments }: { segments: DrillDownSegment[] }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Segment</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Target</TableHead>
          <TableHead>Issue</TableHead>
          <TableHead>Severity</TableHead>
          <TableHead>Score</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {segments.map((segment) => (
          <TableRow key={segment.id}>
            <TableCell className="font-medium">#{segment.segment_index}</TableCell>
            <TableCell className="max-w-xs truncate">{segment.source_text}</TableCell>
            <TableCell className="max-w-xs truncate">{segment.target_text}</TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                {getIssueIcon(segment.issue_severity)}
                {segment.issue_type || 'No issues'}
              </div>
            </TableCell>
            <TableCell>
              {segment.issue_severity && (
                <Badge variant="outline">{segment.issue_severity}</Badge>
              )}
            </TableCell>
            <TableCell>
              <Badge variant="outline" className={getScoreColor(segment.mqm_score)}>
                {segment.mqm_score.toFixed(1)}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  // Helper functions for calculations
  const calculateStats = () => {
    const items = data.segments || data.reports || [];
    const totalItems = items.length;
    
    let avgScore = 0;
    let totalErrors = 0;
    let completionRate = 0;

    if (data.segments) {
      avgScore = items.reduce((sum: number, seg: any) => sum + (seg.mqm_score || 0), 0) / totalItems || 0;
      totalErrors = items.filter((seg: any) => seg.issue_type).length;
      completionRate = ((totalItems - totalErrors) / totalItems * 100) || 0;
    } else if (data.reports) {
      avgScore = items.reduce((sum: number, rep: any) => sum + (rep.mqm_score || 0), 0) / totalItems || 0;
      totalErrors = items.reduce((sum: number, rep: any) => sum + (rep.error_count || 0), 0);
      const completedReports = items.filter((rep: any) => rep.analysis_status === 'completed').length;
      completionRate = (completedReports / totalItems * 100) || 0;
    }

    return {
      totalItems,
      avgScore,
      totalErrors,
      completionRate: Math.round(completionRate),
    };
  };

  const getQualityDistributionData = () => {
    if (!data.reports) return [];
    
    const totalReports = data.reports.length;
    const excellent = data.reports.filter(r => (r.mqm_score || 0) >= 9).length;
    const good = data.reports.filter(r => (r.mqm_score || 0) >= 7 && (r.mqm_score || 0) < 9).length;
    const fair = data.reports.filter(r => (r.mqm_score || 0) >= 5 && (r.mqm_score || 0) < 7).length;
    const poor = data.reports.filter(r => (r.mqm_score || 0) < 5).length;

    return [
      { 
        range: "Excellent (9-10)", 
        count: excellent, 
        percentage: totalReports > 0 ? Math.round((excellent / totalReports) * 100) : 0,
        color: "hsl(142 76% 36%)" // Green
      },
      { 
        range: "Good (7-8.9)", 
        count: good, 
        percentage: totalReports > 0 ? Math.round((good / totalReports) * 100) : 0,
        color: "hsl(47 96% 53%)" // Yellow
      },
      { 
        range: "Fair (5-6.9)", 
        count: fair, 
        percentage: totalReports > 0 ? Math.round((fair / totalReports) * 100) : 0,
        color: "hsl(25 95% 53%)" // Orange
      },
      { 
        range: "Poor (<5)", 
        count: poor, 
        percentage: totalReports > 0 ? Math.round((poor / totalReports) * 100) : 0,
        color: "hsl(0 84% 60%)" // Red
      },
    ];
  };

  const getTimelineData = () => {
    if (!data.reports) return [];
    
    const groupedByDate = data.reports.reduce((acc: any, report: any) => {
      const date = new Date(report.created_at).toLocaleDateString();
      if (!acc[date]) {
        acc[date] = { files: 0, totalScore: 0, count: 0 };
      }
      acc[date].files++;
      acc[date].totalScore += report.mqm_score || 0;
      acc[date].count++;
      return acc;
    }, {});

    return Object.entries(groupedByDate).map(([date, data]: [string, any]) => ({
      date,
      files: data.files,
      avgScore: data.totalScore / data.count,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {currentLevel.type === 'date' && <Calendar className="h-5 w-5" />}
            {currentLevel.type === 'language' && <Globe className="h-5 w-5" />}
            {currentLevel.type === 'file' && <FileText className="h-5 w-5" />}
            {currentLevel.type === 'segments' && <BarChart3 className="h-5 w-5" />}
            Drill-Down: {currentLevel.label}
          </DialogTitle>
          <DialogDescription>
            Detailed view for {currentLevel.type} analysis
          </DialogDescription>
        </DialogHeader>

        <BreadcrumbNavigation />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="data">
              {currentLevel.type === 'file' ? 'Segments' : 'Reports'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <OverviewTab />
          </TabsContent>

          <TabsContent value="data" className="mt-6">
            <DataTab />
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 