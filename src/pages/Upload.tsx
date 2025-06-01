import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Header from "@/components/layout/Header";
import { toast } from "@/hooks/use-toast";
import { FileUpload } from "@/components/forms/FileUpload";
import { UploadingFile } from "@/hooks/useFileUpload";
import { processUploadedFile, ProcessedFileResult } from "@/lib/qa-processing";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, AlertCircle, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface ProcessedSession {
  sessionId: string;
  fileName: string;
  status: 'processing' | 'completed' | 'failed';
  uploadedFile: UploadingFile;
}

const UploadPage = () => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadingFile[]>([]);
  const [processedSessions, setProcessedSessions] = useState<ProcessedSession[]>([]);
  const [isProcessing, setIsProcessing] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  const handleUploadComplete = async (files: UploadingFile[]) => {
    setUploadedFiles(prev => {
      // Update or add completed files
      const updatedFiles = [...prev];
      files.forEach(newFile => {
        const existingIndex = updatedFiles.findIndex(f => f.id === newFile.id);
        if (existingIndex >= 0) {
          updatedFiles[existingIndex] = newFile;
        } else {
          updatedFiles.push(newFile);
        }
      });
      return updatedFiles;
    });

    // Process each uploaded file
    for (const file of files) {
      if (file.status === 'completed' && file.uploadResult) {
        setIsProcessing(prev => new Set(prev).add(file.id));
        
        try {
          const result: ProcessedFileResult = await processUploadedFile(
            file.uploadResult,
            {
              name: file.file.name,
              size: file.file.size,
              type: file.file.type
            },
            { autoStart: true }
          );

          if (result.success && result.sessionId) {
            setProcessedSessions(prev => [...prev, {
              sessionId: result.sessionId!,
              fileName: file.file.name,
              status: 'processing',
              uploadedFile: file
            }]);

            toast({
              title: "QA Session Created",
              description: `Analysis started for ${file.file.name}`,
            });

            // Poll for completion (simple implementation)
            pollSessionStatus(result.sessionId!, file.file.name);
          } else {
            toast({
              title: "Processing Failed",
              description: result.error || `Failed to create QA session for ${file.file.name}`,
              variant: "destructive",
            });
          }
        } catch (error) {
          toast({
            title: "Processing Error",
            description: `Error processing ${file.file.name}: ${error}`,
            variant: "destructive",
          });
        } finally {
          setIsProcessing(prev => {
            const newSet = new Set(prev);
            newSet.delete(file.id);
            return newSet;
          });
        }
      }
    }

    toast({
      title: "Upload completed",
      description: `${files.length} file(s) uploaded successfully`,
    });
  };

  const pollSessionStatus = async (sessionId: string, fileName: string) => {
    const maxAttempts = 15; // Reduced to 30 seconds (15 * 2s)
    let attempts = 0;
    let isActive = true; // Flag to cancel polling if component unmounts

    const poll = async () => {
      if (!isActive) return; // Exit if polling should stop
      
      try {
        attempts++;
        console.log(`📊 Polling attempt ${attempts}/${maxAttempts} for session: ${sessionId.slice(0, 8)}...`);
        
        const { data: sessions, error } = await supabase
          .from('qa_sessions')
          .select('analysis_status')
          .eq('id', sessionId)
          .single();

        if (error) {
          console.error('❌ Error polling session:', error);
          // If session doesn't exist, stop polling
          if (error.code === 'PGRST116') {
            console.log('⚠️ Session not found, stopping polling');
            return;
          }
        }

        if (sessions) {
          if (sessions.analysis_status === 'completed') {
            console.log('✅ Session completed, updating UI');
            setProcessedSessions(prev => 
              prev.map(session => 
                session.sessionId === sessionId 
                  ? { ...session, status: 'completed' }
                  : session
              )
            );
            
            toast({
              title: "Analysis Complete",
              description: `QA analysis finished for ${fileName}`,
            });
            return; // Stop polling
          } else if (sessions.analysis_status === 'failed') {
            console.log('❌ Session failed, updating UI');
            setProcessedSessions(prev => 
              prev.map(session => 
                session.sessionId === sessionId 
                  ? { ...session, status: 'failed' }
                  : session
              )
            );
            
            toast({
              title: "Analysis Failed",
              description: `QA analysis failed for ${fileName}`,
              variant: "destructive",
            });
            return; // Stop polling
          }
        }

        // Continue polling if still processing and not at max attempts
        if (attempts < maxAttempts && isActive) {
          setTimeout(poll, 2000); // Poll every 2 seconds
        } else if (attempts >= maxAttempts) {
          console.log('⏰ Polling timeout reached for session:', sessionId.slice(0, 8));
          toast({
            title: "Analysis Status Unknown",
            description: `Unable to get final status for ${fileName}. Check reports page.`,
            variant: "default",
          });
        }
      } catch (error) {
        console.error('💥 Unexpected error polling session status:', error);
        // Stop polling on unexpected errors
        isActive = false;
      }
    };

    // Start polling after a short delay
    setTimeout(poll, 2000);
    
    // Return cleanup function
    return () => {
      isActive = false;
    };
  };

  const handleUploadError = (file: UploadingFile, error: any) => {
    const errorMessage = typeof error === 'string' ? error : 
                        error?.message || error?.error || 'Upload failed';
    toast({
      title: "Upload failed",
      description: `Failed to upload ${file.file.name}: ${errorMessage}`,
      variant: "destructive",
    });
  };

  const handleFileSelect = (files: File[]) => {
    toast({
      title: "Files selected",
      description: `${files.length} file(s) selected for upload`,
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-blue-600" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'processing':
        return 'secondary';
      case 'failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Upload Files</h1>
          <p className="text-gray-600">
            Upload XLIFF 1.2, 2.0, or MXLIFF files for AI-powered linguistic quality assessment
          </p>
        </div>

        {/* Enhanced File Upload Component */}
        <FileUpload
          onFileSelect={handleFileSelect}
          onUploadComplete={handleUploadComplete}
          onUploadError={handleUploadError}
          acceptedFileTypes={['.xliff', '.xlf', '.mxliff']}
          maxFileSize={50 * 1024 * 1024} // 50MB
          maxFiles={10}
          bucket="qa-files"
          folder="uploads"
          autoUpload={true}
          className="mb-8"
        />

        {/* Processing Summary */}
        {uploadedFiles.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Upload Summary</CardTitle>
              <CardDescription>
                Overview of your uploaded files and processing status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {uploadedFiles.length}
                  </div>
                  <div className="text-sm text-blue-600">Total Files</div>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {uploadedFiles.filter(f => f.status === 'completed').length}
                  </div>
                  <div className="text-sm text-green-600">Completed</div>
                </div>
                <div className="p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">
                    {uploadedFiles.filter(f => f.status === 'error').length}
                  </div>
                  <div className="text-sm text-red-600">Errors</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* QA Sessions */}
        {processedSessions.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>QA Analysis Sessions</CardTitle>
                  <CardDescription>
                    Track the progress of your quality assessment analysis
                  </CardDescription>
                </div>
                <Button 
                  variant="outline"
                  onClick={() => navigate('/reports')}
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  View All Reports
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Debug Info */}
              <div className="mb-4 p-3 bg-gray-100 rounded-lg text-xs">
                <div className="font-semibold mb-2">Debug Info:</div>
                {processedSessions.map((session, index) => (
                  <div key={session.sessionId} className="mb-1">
                    Session {index + 1}: Status = "{session.status}" | ID = {session.sessionId.slice(0, 8)}...
                    {session.status === 'completed' && <span className="text-green-600 font-semibold"> ✅ SHOULD SHOW BUTTON</span>}
                  </div>
                ))}
              </div>
              
              <div className="space-y-4">
                {processedSessions.map((session) => (
                  <Card key={session.sessionId} className="border-l-4 border-l-blue-500">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(session.status)}
                            <h4 className="text-sm font-medium">{session.fileName}</h4>
                            <Badge variant={getStatusVariant(session.status)}>
                              {session.status === 'processing' ? 'Processing' : 
                               session.status === 'completed' ? 'Completed' : 'Failed'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Session ID: {session.sessionId}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          {/* Always show View Report button for debugging */}
                          <Button
                            size="sm"
                            onClick={() => {
                              console.log('🔗 DEBUG View Report button clicked for session:', session.sessionId);
                              console.log('🔗 Session status:', session.status);
                              console.log('🔗 Session data:', session);
                              try {
                                const reportUrl = `/reports?session=${session.sessionId}`;
                                console.log('🔗 Navigating to:', reportUrl);
                                navigate(reportUrl);
                                console.log('🔗 Navigation called successfully');
                              } catch (error) {
                                console.error('❌ Navigation error:', error);
                              }
                            }}
                            className="bg-red-500 hover:bg-red-600 text-white" // Make it obvious
                          >
                            {session.status === 'completed' ? 'View Report' : `View Report (${session.status})`}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              console.log('🔗 All Reports button clicked');
                              try {
                                console.log('🔗 Navigating to: /reports');
                                navigate('/reports');
                                console.log('🔗 All Reports navigation called successfully');
                              } catch (error) {
                                console.error('❌ All Reports navigation error:', error);
                              }
                            }}
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            All Reports
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default UploadPage;
