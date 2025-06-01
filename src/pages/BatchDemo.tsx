import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/layout/Header";
import { toast } from "@/hooks/use-toast";
import { FileUpload } from "@/components/forms/FileUpload";
import BatchProgressDashboard from "@/components/batch/BatchProgressDashboard";
import { UploadingFile } from "@/hooks/useFileUpload";
import { UploadError } from "@/lib/uploadErrorHandling";
import { batchAPI, processBatchFiles } from "@/lib/batch";
import { 
  FlaskConical, 
  Play, 
  Settings, 
  BarChart3, 
  FileText,
  Zap,
  Brain,
  Target
} from 'lucide-react';

const BatchDemoPage = () => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadingFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStrategy, setProcessingStrategy] = useState<'conservative' | 'balanced' | 'aggressive'>('balanced');
  const [activeTab, setActiveTab] = useState('upload');

  const handleUploadComplete = (files: UploadingFile[]) => {
    setUploadedFiles(prev => {
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

    toast({
      title: "Upload completed",
      description: `${files.length} file(s) uploaded successfully`,
    });
  };

  const handleUploadError = (file: UploadingFile, error: UploadError) => {
    toast({
      title: "Upload failed",
      description: `Failed to upload ${file.file.name}: ${error.userMessage}`,
      variant: "destructive",
    });
  };

  const handleFileSelect = (files: File[]) => {
    toast({
      title: "Files selected",
      description: `${files.length} file(s) selected for upload`,
    });
  };

  const handleStartBatchProcessing = async () => {
    const completedFiles = uploadedFiles.filter(f => f.status === 'completed');
    
    if (completedFiles.length === 0) {
      toast({
        title: "No files to process",
        description: "Please upload some files first",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      // Start the progress tracking system
      batchAPI.startProgressTracking();
      
      // Set the processing strategy
      batchAPI.setStrategy(processingStrategy);
      
      // Convert UploadingFile to File objects
      const files = completedFiles.map(f => f.file);
      
      // Create and start batch processing
      const batchResult = await processBatchFiles(files, {
        strategy: processingStrategy,
        priority: 1, // High priority for demo
        config: {
          parseOptions: {
            validateSchema: true,
            extractMetadata: true,
            preserveOriginalStructure: true
          },
          analysisOptions: {
            enableMQMScoring: true,
            enableLinguisticAnalysis: true,
            generateQualityReport: true
          },
          validationOptions: {
            checkTranslationUnits: true,
            validateLanguageCodes: true,
            checkFileIntegrity: true
          }
        }
      });

      toast({
        title: "Batch processing started",
        description: `Processing ${files.length} files with ${processingStrategy} strategy`,
      });

      // Switch to dashboard tab to show progress
      setActiveTab('dashboard');

      console.log('Batch processing initiated:', batchResult);
      
    } catch (error) {
      console.error('Failed to start batch processing:', error);
      toast({
        title: "Processing failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getStrategyColor = (strategy: string) => {
    switch (strategy) {
      case 'conservative': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'balanced': return 'bg-green-100 text-green-800 border-green-200';
      case 'aggressive': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStrategyIcon = (strategy: string) => {
    switch (strategy) {
      case 'conservative': return <Target className="h-4 w-4" />;
      case 'balanced': return <Brain className="h-4 w-4" />;
      case 'aggressive': return <Zap className="h-4 w-4" />;
      default: return <Settings className="h-4 w-4" />;
    }
  };

  const completedFilesCount = uploadedFiles.filter(f => f.status === 'completed').length;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <FlaskConical className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Batch Processing Demo</h1>
              <p className="text-gray-600">
                Experience advanced progress tracking and analytics for XLIFF file processing
              </p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium">Files Uploaded</p>
                    <p className="text-2xl font-bold">{uploadedFiles.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-sm font-medium">Ready to Process</p>
                    <p className="text-2xl font-bold">{completedFilesCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  {getStrategyIcon(processingStrategy)}
                  <div>
                    <p className="text-sm font-medium">Strategy</p>
                    <Badge className={getStrategyColor(processingStrategy)} variant="outline">
                      {processingStrategy}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <Button
                  onClick={handleStartBatchProcessing}
                  disabled={completedFilesCount === 0 || isProcessing}
                  className="w-full"
                  size="sm"
                >
                  <Play className="h-4 w-4 mr-2" />
                  {isProcessing ? 'Starting...' : 'Start Processing'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upload">File Upload</TabsTrigger>
            <TabsTrigger value="dashboard">Progress Dashboard</TabsTrigger>
            <TabsTrigger value="settings">Processing Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Upload XLIFF Files</CardTitle>
                <CardDescription>
                  Upload your XLIFF files to get started with batch processing. Files will be queued for analysis once uploaded.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FileUpload
                  onFileSelect={handleFileSelect}
                  onUploadComplete={handleUploadComplete}
                  onUploadError={handleUploadError}
                  acceptedFileTypes={['.xliff', '.xlf', '.mxliff']}
                  maxFileSize={50 * 1024 * 1024} // 50MB
                  maxFiles={20}
                  bucket="qa-files"
                  folder="batch-demo"
                  autoUpload={true}
                  className="mb-6"
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dashboard" className="space-y-6">
            <BatchProgressDashboard 
              className="w-full"
              refreshInterval={1000}
            />
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Processing Strategy</CardTitle>
                <CardDescription>
                  Choose how aggressively the system should process files based on available resources
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card 
                    className={`cursor-pointer transition-all ${
                      processingStrategy === 'conservative' 
                        ? 'ring-2 ring-blue-500 bg-blue-50' 
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setProcessingStrategy('conservative')}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-3 mb-3">
                        <Target className="h-6 w-6 text-blue-600" />
                        <h3 className="font-semibold">Conservative</h3>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">
                        Prioritizes system stability with lower resource usage. Best for shared environments.
                      </p>
                      <ul className="text-xs text-gray-500 space-y-1">
                        <li>• 1-2 concurrent jobs</li>
                        <li>• Lower CPU/memory usage</li>
                        <li>• Reliable performance</li>
                      </ul>
                    </CardContent>
                  </Card>

                  <Card 
                    className={`cursor-pointer transition-all ${
                      processingStrategy === 'balanced' 
                        ? 'ring-2 ring-green-500 bg-green-50' 
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setProcessingStrategy('balanced')}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-3 mb-3">
                        <Brain className="h-6 w-6 text-green-600" />
                        <h3 className="font-semibold">Balanced</h3>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">
                        Optimal balance between performance and resource usage. Recommended for most users.
                      </p>
                      <ul className="text-xs text-gray-500 space-y-1">
                        <li>• 2-4 concurrent jobs</li>
                        <li>• Adaptive resource usage</li>
                        <li>• Good throughput</li>
                      </ul>
                    </CardContent>
                  </Card>

                  <Card 
                    className={`cursor-pointer transition-all ${
                      processingStrategy === 'aggressive' 
                        ? 'ring-2 ring-orange-500 bg-orange-50' 
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setProcessingStrategy('aggressive')}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-3 mb-3">
                        <Zap className="h-6 w-6 text-orange-600" />
                        <h3 className="font-semibold">Aggressive</h3>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">
                        Maximum performance with higher resource usage. Best for dedicated processing.
                      </p>
                      <ul className="text-xs text-gray-500 space-y-1">
                        <li>• 4-8 concurrent jobs</li>
                        <li>• High CPU/memory usage</li>
                        <li>• Maximum throughput</li>
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Processing Configuration</CardTitle>
                <CardDescription>
                  Advanced options for batch processing behavior
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-3">Parse Options</h4>
                    <div className="space-y-2 text-sm">
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" defaultChecked className="rounded" />
                        <span>Validate schema</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" defaultChecked className="rounded" />
                        <span>Extract metadata</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" defaultChecked className="rounded" />
                        <span>Preserve original structure</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Analysis Options</h4>
                    <div className="space-y-2 text-sm">
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" defaultChecked className="rounded" />
                        <span>Enable MQM scoring</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" defaultChecked className="rounded" />
                        <span>Linguistic analysis</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" defaultChecked className="rounded" />
                        <span>Generate quality report</span>
                      </label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default BatchDemoPage; 