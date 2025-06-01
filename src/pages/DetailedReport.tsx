import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  Info,
  Download,
  RefreshCw,
  MessageSquare,
  Languages
} from "lucide-react";
import Header from "@/components/layout/Header";
import { supabase } from "@/lib/supabase";
import { QASession } from "@/lib/types/qa-session";
import { toast } from "@/hooks/use-toast";

interface SegmentAnalysis {
  id: string;
  segmentNumber: number;
  sourceText: string;
  targetText: string;
  severity: 'critical' | 'major' | 'minor' | 'info' | 'ok';
  category: string;
  description: string;
  suggestion: string;
  confidence: number;
  mqmScore: number;
}

interface DetailedQAReport {
  sessionId: string;
  fileName: string;
  language: string;
  totalSegments: number;
  analysisStatus: string;
  mqmScore: number;
  errorCount: number;
  warningCount: number;
  segments: SegmentAnalysis[];
  metadata: {
    fileSize: number;
    fileType: string;
    uploadedAt: string;
    completedAt: string;
    processingTime: number;
    modelUsed: string;
  };
}

const DetailedReport = () => {
  const { reportId } = useParams<{ reportId: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<DetailedQAReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (reportId) {
      fetchDetailedReport(reportId);
    }
  }, [reportId]);

  const fetchDetailedReport = async (sessionId: string) => {
    try {
      setLoading(true);
      setError(null);

      // Fetch the QA session
      const { data: session, error: sessionError } = await supabase
        .from('qa_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionError || !session) {
        throw new Error('Report not found');
      }

      // Fetch real segments from the database
      console.log('📥 Fetching segments for session:', sessionId);
      const { data: segments, error: segmentsError } = await supabase
        .from('qa_segments')
        .select('*')
        .eq('session_id', sessionId)
        .order('segment_number');

      if (segmentsError) {
        console.error('❌ Error fetching segments:', segmentsError);
        // If no segments found, we'll show a message instead of failing
      }

      console.log('✅ Fetched', segments?.length || 0, 'segments from database');

      // Convert database segments to our display format
      const segmentAnalysis: SegmentAnalysis[] = (segments || []).map(segment => ({
        id: segment.id,
        segmentNumber: segment.segment_number,
        sourceText: segment.source_text,
        targetText: segment.target_text || '',
        severity: segment.severity || 'ok',
        category: segment.category || 'Quality',
        description: segment.issue_description || 'No issues detected',
        suggestion: segment.suggestion || 'No changes suggested',
        confidence: segment.confidence_score || 95,
        mqmScore: segment.mqm_score || 8.5
      }));

      // If no segments were found or stored, show a helpful message
      if (segmentAnalysis.length === 0) {
        console.log('⚠️ No segments found in database for session');
      }

      const detailedReport: DetailedQAReport = {
        sessionId: session.id,
        fileName: session.file_name,
        language: extractLanguagePair(session.file_name),
        totalSegments: segmentAnalysis.length || session.analysis_results?.segmentCount || 0,
        analysisStatus: session.analysis_status,
        mqmScore: session.mqm_score || 7.2,
        errorCount: session.error_count,
        warningCount: session.warning_count || 0,
        segments: segmentAnalysis,
        metadata: {
          fileSize: session.file_size,
          fileType: session.file_type,
          uploadedAt: session.created_at,
          completedAt: session.updated_at,
          processingTime: session.analysis_results?.processingTime || 2500,
          modelUsed: session.model_used || 'Unknown Model'
        }
      };

      setReport(detailedReport);

    } catch (err) {
      console.error('Error fetching detailed report:', err);
      setError(err instanceof Error ? err.message : 'Failed to load report');
      toast({
        title: "Error loading report",
        description: "Failed to load the detailed report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const extractLanguagePair = (fileName: string): string => {
    // Try to extract language pair from filename
    const patterns = [
      /_([a-z]{2})_([a-z]{2})\./i,
      /_([a-z]{2})-([a-z]{2})\./i,
      /([a-z]{2})_to_([a-z]{2})/i,
      /([a-z]{2})-([a-z]{2})/i,
    ];

    for (const pattern of patterns) {
      const match = fileName.match(pattern);
      if (match) {
        return `${match[1].toUpperCase()} → ${match[2].toUpperCase()}`;
      }
    }

    return "EN → DE"; // Default for demo
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'major':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'minor':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'info':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'ok':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'major':
        return <AlertTriangle className="h-4 w-4" />;
      case 'minor':
      case 'info':
        return <Info className="h-4 w-4" />;
      case 'ok':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

  const formatModelName = (modelName: string) => {
    return modelName.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-600">Loading detailed report...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Report not found</h3>
            <p className="text-gray-600 mb-4">{error || 'The requested report could not be found.'}</p>
            <Button onClick={() => navigate('/reports')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Reports
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/reports')}
              className="flex items-center"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Reports
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{report.fileName}</h1>
              <p className="text-gray-600">Detailed Quality Assessment Report</p>
            </div>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Languages className="h-5 w-5 text-blue-500" />
                <div>
                  <div className="text-sm text-gray-600">Language Pair</div>
                  <div className="text-lg font-semibold">{report.language}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-blue-600">{report.totalSegments}</div>
              <div className="text-sm text-gray-600">Total Segments</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-green-600">{report.mqmScore.toFixed(1)}</div>
              <div className="text-sm text-gray-600">Overall MQM Score</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-red-600">{report.errorCount}</div>
              <div className="text-sm text-gray-600">Issues Found</div>
            </CardContent>
          </Card>
        </div>

        {/* File Metadata */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>File Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div>
                <div className="text-gray-600">File Type</div>
                <div className="font-medium">{report.metadata.fileType.toUpperCase()}</div>
              </div>
              <div>
                <div className="text-gray-600">File Size</div>
                <div className="font-medium">{formatFileSize(report.metadata.fileSize)}</div>
              </div>
              <div>
                <div className="text-gray-600">Uploaded</div>
                <div className="font-medium">{formatDate(report.metadata.uploadedAt)}</div>
              </div>
              <div>
                <div className="text-gray-600">Processed</div>
                <div className="font-medium">{formatDate(report.metadata.completedAt)}</div>
              </div>
              <div>
                <div className="text-gray-600">Analysis Model</div>
                <div className="font-medium">{formatModelName(report.metadata.modelUsed)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Segment Analysis */}
        <Card>
          <CardHeader>
            <CardTitle>Segment-by-Segment Analysis</CardTitle>
            <CardDescription>
              {report.segments.length > 0 
                ? "Detailed QA analysis showing source, target, and LLM feedback for each segment"
                : "No segments found - the XLIFF file may not have been parsed yet or parsing failed"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {report.segments.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Segments Available</h3>
                <p className="text-gray-600 mb-4">
                  The XLIFF file segments have not been parsed yet or parsing failed. 
                  This could happen if the file is not a valid XLIFF format or if there was an error during processing.
                </p>
                <Button onClick={() => navigate('/reports')} variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Reports
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {report.segments.map((segment, index) => (
                  <div key={segment.id} className="border rounded-lg p-6 space-y-4">
                    {/* Segment Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="text-sm font-medium text-gray-600">
                          Segment #{segment.segmentNumber}
                        </div>
                        <Badge 
                          variant="outline" 
                          className={getSeverityColor(segment.severity)}
                        >
                          <div className="flex items-center space-x-1">
                            {getSeverityIcon(segment.severity)}
                            <span className="capitalize">{segment.severity}</span>
                          </div>
                        </Badge>
                        <Badge variant="outline">
                          {segment.category}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-600">
                        Confidence: {segment.confidence}% • Score: {segment.mqmScore}
                      </div>
                    </div>

                    {/* Source and Target */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-gray-700">Source Text</div>
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm">
                          {segment.sourceText}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-gray-700">Target Text</div>
                        <div className="p-3 bg-green-50 border border-green-200 rounded text-sm">
                          {segment.targetText || <span className="text-gray-400 italic">No target text</span>}
                        </div>
                      </div>
                    </div>

                    {/* Analysis and Suggestion */}
                    {segment.severity !== 'ok' && (
                      <div className="space-y-3">
                        <div>
                          <div className="text-sm font-medium text-gray-700 mb-1">Issue Description</div>
                          <div className="text-sm text-gray-600">{segment.description}</div>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-700 mb-1">Suggested Improvement</div>
                          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm italic">
                            {segment.suggestion}
                          </div>
                        </div>
                      </div>
                    )}

                    {segment.severity === 'ok' && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800">
                        ✅ This segment meets quality standards. No issues detected.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DetailedReport; 