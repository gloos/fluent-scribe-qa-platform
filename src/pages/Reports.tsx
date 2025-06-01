import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Filter, Download, Eye, FileText, RefreshCw, Trash2, Brain, Settings, BarChart3, Grid3X3, User } from "lucide-react";
import Header from "@/components/layout/Header";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { QASession } from "@/lib/types/qa-session";
import { toast } from "@/hooks/use-toast";
import { useReportFilters, type ReportData } from "@/hooks/useReportFilters";
import { AdvancedFilters } from "@/components/filters/AdvancedFilters";
import { ReportsVisualizationDashboard, type ViewMode } from "@/components/reports/ReportsVisualizationDashboard";
import { useDrillDown, type DrillDownLevel } from "@/hooks/useDrillDown";
import { DrillDownModal } from "@/components/reports/DrillDownModal";
import { ReportsExportButton } from "@/components/reports/ReportsExportButton";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { PreferencesModal } from "@/components/preferences/PreferencesModal";

interface ReportFile {
  id: string;
  name: string;
  uploadedAt: string;
  completedAt: string;
  segments: number;
  errors: number;
  score: number;
  status: "pending" | "processing" | "completed" | "failed";
  language: string;
  fileType: string;
  fileSize: number;
  modelUsed?: string;
}

const Reports = () => {
  const [reports, setReports] = useState<ReportFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Use ref to access current reports without dependency
  const reportsRef = useRef<ReportFile[]>([]);
  reportsRef.current = reports;
  
  // Get session ID from URL if specified
  const sessionId = searchParams.get('session');

  // Initialize drill-down functionality
  const drillDown = useDrillDown();

  // User preferences hook
  const {
    preferences,
    loading: preferencesLoading,
    updateVisualizationPreferences,
    updateFilterPreferences,
  } = useUserPreferences();

  // Initialize view mode from user preferences
  const [viewMode, setViewMode] = useState<ViewMode>(preferences.defaultViewMode);

  // Update view mode when preferences change
  useEffect(() => {
    setViewMode(preferences.defaultViewMode);
  }, [preferences.defaultViewMode]);

  // Handle view mode changes and save to preferences
  const handleViewModeChange = async (newViewMode: ViewMode) => {
    setViewMode(newViewMode);
    await updateVisualizationPreferences({ viewMode: newViewMode });
  };

  // Convert ReportFile to ReportData for the hook
  const reportData: ReportData[] = reports.map(report => ({
    id: report.id,
    name: report.name,
    uploadedAt: report.uploadedAt,
    completedAt: report.completedAt,
    status: report.status,
    segments: report.segments,
    errors: report.errors,
    score: report.score,
    language: report.language,
    fileType: report.fileType,
    fileSize: report.fileSize,
    modelUsed: report.modelUsed,
    processingTime: undefined, // Add processing time if available in the future
  }));

  // Use the enhanced filtering system with user preferences
  const {
    filters,
    updateFilter,
    updateFilters,
    resetFilters,
    filteredData,
    isFiltering,
  } = useReportFilters({ 
    data: reportData,
    initialFilters: preferences.defaultFilters,
  });

  // Save filter changes to user preferences (debounced)
  useEffect(() => {
    if (!preferencesLoading) {
      const timeoutId = setTimeout(() => {
        updateFilterPreferences(filters);
      }, 1000); // Debounce filter preference saving

      return () => clearTimeout(timeoutId);
    }
  }, [filters, preferencesLoading, updateFilterPreferences]);

  // Extract available options for filters
  const availableLanguages = Array.from(new Set(reports.map(r => r.language)));
  const availableModels = Array.from(new Set(reports.map(r => r.modelUsed).filter(Boolean))) as string[];
  const availableFileTypes = Array.from(new Set(reports.map(r => r.fileType)));

  useEffect(() => {
    fetchQASessions();
    
    // Set up polling for processing sessions
    const interval = setInterval(() => {
      // Check current reports for processing sessions
      const currentReports = reportsRef.current;
      const hasProcessingSessions = currentReports.some(r => r.status === 'processing' || r.status === 'pending');
      if (hasProcessingSessions) {
        console.log('🔄 Polling for session updates...');
        fetchQASessions();
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, []); // Empty dependency array to avoid infinite loop

  const fetchQASessions = async () => {
    try {
      setLoading(true);
      
      const { data: sessions, error } = await supabase
        .from('qa_sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching QA sessions:', error);
        toast({
          title: "Error loading reports",
          description: "Failed to load QA session reports. Please try again.",
          variant: "destructive",
        });
        return;
      }

      const formattedReports: ReportFile[] = (sessions || []).map((session: QASession) => ({
        id: session.id,
        name: session.file_name,
        uploadedAt: session.upload_timestamp || session.created_at,
        completedAt: session.updated_at,
        segments: session.analysis_results?.segmentCount || 0,
        errors: session.error_count,
        score: session.mqm_score || 0,
        status: session.analysis_status,
        language: extractLanguagePair(session.file_name),
        fileType: session.file_type,
        fileSize: session.file_size,
        modelUsed: session.model_used,
      }));

      setReports(formattedReports);

      // If a specific session was requested, highlight it
      if (sessionId) {
        const foundSession = formattedReports.find(r => r.id === sessionId);
        if (foundSession) {
          toast({
            title: "Report found",
            description: `Showing report for ${foundSession.name}`,
          });
        }
      }

    } catch (error) {
      console.error('Unexpected error fetching sessions:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while loading reports.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteReport = async (reportId: string, reportName: string) => {
    // Show confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to delete the report "${reportName}"?\n\nThis will permanently remove:\n• The QA session data\n• All segment analysis results\n• This action cannot be undone.`
    );
    
    if (!confirmed) return;

    try {
      setDeleting(reportId);
      console.log('🗑️ Deleting report:', reportId);

      // Delete QA segments first (if any)
      const { error: segmentsError } = await supabase
        .from('qa_segments')
        .delete()
        .eq('session_id', reportId);

      if (segmentsError) {
        console.error('❌ Error deleting segments:', segmentsError);
        // Continue anyway - segments might not exist
      } else {
        console.log('✅ Segments deleted for session:', reportId);
      }

      // Delete the QA session
      const { error: sessionError } = await supabase
        .from('qa_sessions')
        .delete()
        .eq('id', reportId);

      if (sessionError) {
        console.error('❌ Error deleting session:', sessionError);
        throw new Error(`Failed to delete report: ${sessionError.message}`);
      }

      console.log('✅ Session deleted:', reportId);
      
      // Remove from local state
      setReports(prev => prev.filter(r => r.id !== reportId));
      
      toast({
        title: "Report deleted",
        description: `Successfully deleted report "${reportName}".`,
      });

    } catch (error) {
      console.error('❌ Error in deleteReport:', error);
      toast({
        title: "Error deleting report",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  };

  const extractLanguagePair = (fileName: string): string => {
    // Extract language pair from filename (e.g., "en-de", "fr-en")
    const langMatch = fileName.match(/([a-z]{2})-([a-z]{2})/i);
    if (langMatch) {
      return `${langMatch[1].toUpperCase()}-${langMatch[2].toUpperCase()}`;
    }
    
    // Fallback: look for single language codes
    const singleLangMatch = fileName.match(/[_\-\.]([a-z]{2})[_\-\.]/i);
    if (singleLangMatch) {
      return singleLangMatch[1].toUpperCase();
    }
    
    return 'Unknown';
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600 bg-green-50 border-green-200";
    if (score >= 70) return "text-yellow-600 bg-yellow-50 border-yellow-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return "text-green-600 bg-green-50 border-green-200";
      case 'processing': return "text-blue-600 bg-blue-50 border-blue-200";
      case 'pending': return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case 'failed': return "text-red-600 bg-red-50 border-red-200";
      default: return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatModelName = (modelName?: string) => {
    if (!modelName) return 'Unknown';
    
    // Format common model names for better display
    const modelMap: Record<string, string> = {
      'claude-3-5-sonnet-simulated': 'Claude 3.5 Sonnet',
      'claude-3-haiku-simulated': 'Claude 3 Haiku',
      'gpt-4o-simulated': 'GPT-4o',
      'gpt-4-turbo-simulated': 'GPT-4 Turbo',
      'simulated-analysis-v1': 'Rule-Based Analysis'
    };
    
    return modelMap[modelName] || modelName;
  };

  // Helper functions for basic filters
  const getSelectedStatus = () => {
    if (filters.status.length === 0) return 'all';
    if (filters.status.length === 1) return filters.status[0];
    return 'all';
  };

  const getSelectedLanguage = () => {
    return filters.languageFilter || 'all';
  };

  const handleStatusChange = (value: string) => {
    if (value === 'all') {
      updateFilter('status', ['pending', 'processing', 'completed', 'failed']);
    } else {
      updateFilter('status', [value]);
    }
  };

  const handleLanguageChange = (value: string) => {
    updateFilter('languageFilter', value);
  };

  const completedReports = reports.filter(r => r.status === 'completed').length;
  const pendingReports = reports.filter(r => r.status === 'processing' || r.status === 'pending').length;
  const failedReports = reports.filter(r => r.status === 'failed').length;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Reports</h1>
            <p className="text-gray-600">
              View and manage all your quality assessment reports
            </p>
          </div>
          <div className="flex gap-2">
            <PreferencesModal currentFilters={filters}>
              <Button variant="outline">
                <User className="h-4 w-4 mr-2" />
                Preferences
              </Button>
            </PreferencesModal>
            <ReportsExportButton
              data={reports}
              filteredData={filteredData}
              isFiltering={isFiltering}
            />
            <Button variant="outline" onClick={fetchQASessions} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Link to="/upload">
              <Button>Upload New File</Button>
            </Link>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-gray-900">{reports.length}</div>
              <div className="text-sm text-gray-600">Total Reports</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-green-600">{completedReports}</div>
              <div className="text-sm text-gray-600">Completed</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-blue-600">{pendingReports}</div>
              <div className="text-sm text-gray-600">Processing</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-red-600">{failedReports}</div>
              <div className="text-sm text-gray-600">Failed</div>
            </CardContent>
          </Card>
        </div>

        {/* Session Filter Notice */}
        {sessionId && (
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-blue-800">
                  <strong>Filtered View:</strong> Showing report for session {sessionId.slice(0, 8)}...
                </div>
                <Link to="/reports">
                  <Button variant="outline" size="sm">
                    View All Reports
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-64">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search reports..."
                    value={filters.searchTerm}
                    onChange={(e) => updateFilter('searchTerm', e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Select value={getSelectedStatus()} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={getSelectedLanguage()} onValueChange={handleLanguageChange}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Languages</SelectItem>
                  {availableLanguages.map((lang) => (
                    <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <AdvancedFilters
                filters={filters}
                onFiltersChange={updateFilters}
                onReset={resetFilters}
                availableLanguages={availableLanguages}
                availableModels={availableModels}
                availableFileTypes={availableFileTypes}
              >
                <Button 
                  variant="outline" 
                  size="sm" 
                  className={isFiltering ? "border-blue-500 text-blue-600" : ""}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  More Filters
                  {isFiltering && <span className="ml-1 text-xs bg-blue-100 text-blue-600 px-1 rounded">•</span>}
                </Button>
              </AdvancedFilters>

              <Button variant="outline" size="sm" onClick={resetFilters}>
                <Filter className="h-4 w-4 mr-2" />
                Reset Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Advanced Filters Dialog */}
        <AdvancedFilters
          filters={filters}
          onFiltersChange={updateFilters}
          onReset={resetFilters}
          availableLanguages={availableLanguages}
          availableModels={availableModels}
          availableFileTypes={availableFileTypes}
        >
          <Button 
            variant="outline" 
            size="sm" 
            className={isFiltering ? "border-blue-500 text-blue-600" : ""}
          >
            <Settings className="h-4 w-4 mr-2" />
            More Filters
            {isFiltering && <span className="ml-1 text-xs bg-blue-100 text-blue-600 px-1 rounded">•</span>}
          </Button>
        </AdvancedFilters>

        {/* Dynamic Visualization Dashboard */}
        {(viewMode === "charts" || viewMode === "mixed") && (
          <ReportsVisualizationDashboard
            data={reportData}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            className="mb-6"
            onDataPointClick={drillDown.drillDown}
            enableDrillDown={true}
          />
        )}

        {/* Reports Table */}
        {(viewMode === "table" || viewMode === "mixed") && (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Quality Assessment Reports</CardTitle>
                  <CardDescription>
                    {loading ? 'Loading...' : `${filteredData.length} of ${reports.length} reports`}
                  </CardDescription>
                </div>
                {/* View Mode Selector */}
                <div className="flex items-center gap-1 bg-muted p-1 rounded-md">
                  <Button
                    variant={viewMode === "table" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => handleViewModeChange("table")}
                    className="h-8"
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    Table
                  </Button>
                  <Button
                    variant={(viewMode as ViewMode) === "charts" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => handleViewModeChange("charts")}
                    className="h-8"
                  >
                    <BarChart3 className="h-4 w-4 mr-1" />
                    Charts
                  </Button>
                  <Button
                    variant={viewMode === "mixed" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => handleViewModeChange("mixed")}
                    className="h-8"
                  >
                    <Grid3X3 className="h-4 w-4 mr-1" />
                    Mixed
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
                  <span className="ml-2 text-gray-600">Loading reports...</span>
                </div>
              ) : filteredData.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No reports found</h3>
                  <p className="text-gray-600 mb-4">
                    {reports.length === 0 
                      ? "Upload your first XLIFF file to generate quality assessment reports." 
                      : "No reports match your current filters. Try adjusting your search criteria."}
                  </p>
                  <Link to="/upload">
                    <Button>Upload Files</Button>
                  </Link>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Language</TableHead>
                      <TableHead>Segments</TableHead>
                      <TableHead>Errors</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Upload Date</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.map((report) => (
                      <TableRow 
                        key={report.id} 
                        className={`${sessionId === report.id ? "bg-blue-50" : ""} ${report.status === 'completed' ? 'hover:bg-gray-50 cursor-pointer' : ''}`}
                        onClick={() => {
                          if (report.status === 'completed') {
                            drillDown.drillDown({
                              type: 'file',
                              value: report.id,
                              label: report.name,
                              filters: { fileId: report.id }
                            });
                          }
                        }}
                      >
                        <TableCell>
                          <div>
                            <div className="font-medium text-gray-900">{report.name}</div>
                            <div className="text-sm text-gray-500">
                              {report.fileType.toUpperCase()} • {formatFileSize(report.fileSize)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getStatusColor(report.status)}>
                            {report.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium">{report.language}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{report.segments.toLocaleString()}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium text-red-600">
                            {report.errors}
                          </span>
                        </TableCell>
                        <TableCell>
                          {report.status === 'completed' && report.score > 0 ? (
                            <Badge variant="outline" className={getScoreColor(report.score)}>
                              {report.score.toFixed(1)}
                            </Badge>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-600">
                            {formatDate(report.uploadedAt)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Brain className="h-4 w-4 text-blue-500" />
                            <span className="text-sm font-medium">
                              {formatModelName(report.modelUsed)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {report.status === 'completed' ? (
                              <>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation(); // Prevent row click
                                    console.log('👁️ View Details button clicked for report:', report.id);
                                    navigate('/report/' + report.id);
                                  }}
                                  title="View detailed report"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  title="Download report"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation(); // Prevent row click
                                    deleteReport(report.id, report.name);
                                  }}
                                  disabled={deleting === report.id}
                                  title="Delete report"
                                  className="text-red-600 hover:text-red-800 hover:bg-red-50"
                                >
                                  {deleting === report.id ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              </>
                            ) : (
                              <>
                                <span className="text-sm text-gray-400">
                                  {report.status === 'processing' || report.status === 'pending' 
                                    ? 'Processing...' 
                                    : 'Failed'}
                                </span>
                                {/* Allow deletion of failed reports */}
                                {report.status === 'failed' && (
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation(); // Prevent row click
                                      deleteReport(report.id, report.name);
                                    }}
                                    disabled={deleting === report.id}
                                    title="Delete failed report"
                                    className="text-red-600 hover:text-red-800 hover:bg-red-50"
                                  >
                                    {deleting === report.id ? (
                                      <RefreshCw className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Drill-Down Modal */}
        <DrillDownModal
          open={drillDown.isModalOpen}
          onOpenChange={drillDown.closeModal}
          navigationPath={drillDown.navigationPath}
          currentLevel={drillDown.currentLevel}
          data={drillDown.data}
          onNavigateBack={drillDown.navigateBack}
          onResetToOverview={drillDown.resetToOverview}
          canNavigateBack={drillDown.canNavigateBack}
        />
      </div>
    </div>
  );
};

export default Reports;
