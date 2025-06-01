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
import { Search, Filter, Download, Eye, FileText, RefreshCw, Trash2, Brain } from "lucide-react";
import Header from "@/components/layout/Header";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { QASession } from "@/lib/types/qa-session";
import { toast } from "@/hooks/use-toast";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [reports, setReports] = useState<ReportFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Use ref to access current reports without dependency
  const reportsRef = useRef<ReportFile[]>([]);
  reportsRef.current = reports;
  
  // Get session ID from URL if specified
  const sessionId = searchParams.get('session');

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
      setReports(prevReports => prevReports.filter(r => r.id !== reportId));

      toast({
        title: "Report deleted",
        description: `Successfully deleted "${reportName}" and all associated data.`,
      });

      // If we're viewing the deleted report, navigate back to all reports
      if (sessionId === reportId) {
        navigate('/reports');
      }

    } catch (error) {
      console.error('💥 Error deleting report:', error);
      toast({
        title: "Deletion failed",
        description: error instanceof Error ? error.message : "Failed to delete the report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  };

  const extractLanguagePair = (fileName: string): string => {
    // Try to extract language pair from filename (common patterns)
    const patterns = [
      /_([a-z]{2})_([a-z]{2})\./i,  // file_en_de.xliff
      /_([a-z]{2})-([a-z]{2})\./i,  // file_en-de.xliff
      /([a-z]{2})_to_([a-z]{2})/i,  // en_to_de
      /([a-z]{2})-([a-z]{2})/i,     // en-de
    ];

    for (const pattern of patterns) {
      const match = fileName.match(pattern);
      if (match) {
        return `${match[1].toUpperCase()} → ${match[2].toUpperCase()}`;
      }
    }

    return "Unknown";
  };

  const filteredReports = reports.filter((report) => {
    const matchesSearch = report.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || report.status === statusFilter;
    const matchesLanguage = languageFilter === "all" || report.language === languageFilter;
    const matchesSession = !sessionId || report.id === sessionId;
    
    return matchesSearch && matchesStatus && matchesLanguage && matchesSession;
  });

  const getScoreColor = (score: number) => {
    if (score >= 9) return "text-green-600 bg-green-50";
    if (score >= 7) return "text-yellow-600 bg-yellow-50";
    return "text-red-600 bg-red-50";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return "bg-green-100 text-green-800";
      case 'processing':
        return "bg-blue-100 text-blue-800";
      case 'pending':
        return "bg-yellow-100 text-yellow-800";
      case 'failed':
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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
    if (!modelName) return "Unknown";
    
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

  const languages = Array.from(new Set(reports.map(r => r.language)));

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
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
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

              <Select value={languageFilter} onValueChange={setLanguageFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Languages</SelectItem>
                  {languages.map((lang) => (
                    <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                More Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Reports Table */}
        <Card>
          <CardHeader>
            <CardTitle>Quality Assessment Reports</CardTitle>
            <CardDescription>
              {loading ? 'Loading...' : `${filteredReports.length} of ${reports.length} reports`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-600">Loading reports...</span>
              </div>
            ) : filteredReports.length === 0 ? (
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
                  {filteredReports.map((report) => (
                    <TableRow key={report.id} className={sessionId === report.id ? "bg-blue-50" : ""}>
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
                                onClick={() => {
                                  console.log('👁️ View Details button clicked for report:', report.id);
                                  navigate('/report/' + report.id);
                                }}
                                title="View detailed report"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" title="Download report">
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => deleteReport(report.id, report.name)}
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
                                  onClick={() => deleteReport(report.id, report.name)}
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
      </div>
    </div>
  );
};

export default Reports;
