import React, { useState, useEffect, useMemo } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  BookOpen, 
  Download, 
  Share2, 
  MessageSquare, 
  Plus, 
  Edit3, 
  History, 
  Search, 
  Filter,
  FileText,
  Code,
  Settings,
  AlertTriangle,
  CheckCircle,
  Info,
  ExternalLink,
  Copy,
  Eye,
  EyeOff
} from 'lucide-react';
import { 
  CustomScoringModel,
  ScoringModelDocumentation,
  ModelAnnotation,
  DocumentationExportConfig,
  DocumentationSection,
  ModelChangeRecord
} from '@/lib/types/scoring-models';
import { ScoringModelDocumentationEngine } from '@/lib/utils/scoring-model-documentation-engine';
import { toast } from 'sonner';

interface ModelDocumentationInterfaceProps {
  model: CustomScoringModel;
  documentation?: ScoringModelDocumentation;
  onDocumentationUpdate?: (documentation: ScoringModelDocumentation) => void;
  readOnly?: boolean;
  className?: string;
}

export function ModelDocumentationInterface({
  model,
  documentation: initialDocumentation,
  onDocumentationUpdate,
  readOnly = false,
  className = ''
}: ModelDocumentationInterfaceProps) {
  const [documentation, setDocumentation] = useState<ScoringModelDocumentation | null>(
    initialDocumentation || null
  );
  const [activeSection, setActiveSection] = useState<DocumentationSection>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [newAnnotation, setNewAnnotation] = useState({
    type: 'comment' as const,
    content: '',
    section: 'overview' as DocumentationSection,
    priority: 'medium' as const
  });

  const documentationEngine = useMemo(() => 
    ScoringModelDocumentationEngine.getInstance(), 
    []
  );

  // Generate documentation if not provided
  useEffect(() => {
    if (!documentation && !isGenerating) {
      generateDocumentation();
    }
  }, [model]);

  const generateDocumentation = async () => {
    setIsGenerating(true);
    try {
      const newDoc = documentationEngine.generateDocumentation(model, {
        includeImplementation: true,
        includeUsage: true,
        includeExamples: true,
        language: 'en'
      });
      setDocumentation(newDoc);
      onDocumentationUpdate?.(newDoc);
      toast.success('Documentation generated successfully');
    } catch (error) {
      console.error('Error generating documentation:', error);
      toast.error('Failed to generate documentation');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = async (format: string) => {
    if (!documentation) return;
    
    setIsExporting(true);
    try {
      const config: DocumentationExportConfig = {
        format: format as any,
        sections: ['overview', 'specifications', 'implementation', 'usage'],
        includeTableOfContents: true,
        includeAnnotations: showAnnotations,
        includeChangeHistory: true,
        includeInternalNotes: !readOnly,
        redactSensitiveInfo: readOnly
      };

      const result = await documentationEngine.exportDocumentation(documentation, config);
      
      if (result.success && result.content) {
        // Create download link
        const blob = new Blob([result.content], { 
          type: getContentType(format) 
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${model.name}-documentation.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        toast.success(`Documentation exported as ${format.toUpperCase()}`);
      } else {
        throw new Error(result.errors?.[0] || 'Export failed');
      }
    } catch (error) {
      console.error('Error exporting documentation:', error);
      toast.error('Failed to export documentation');
    } finally {
      setIsExporting(false);
    }
  };

  const handleAddAnnotation = () => {
    if (!documentation || !newAnnotation.content.trim()) return;

    const annotation = documentationEngine.addAnnotation(documentation, {
      type: newAnnotation.type,
      content: newAnnotation.content,
      context: {
        section: newAnnotation.section,
        elementType: 'general'
      },
      priority: newAnnotation.priority,
      status: 'open',
      tags: [],
      replies: [],
      relatedAnnotations: []
    });

    setDocumentation({ ...documentation });
    onDocumentationUpdate?.(documentation);
    
    // Reset form
    setNewAnnotation({
      type: 'comment',
      content: '',
      section: activeSection,
      priority: 'medium'
    });
    
    toast.success('Annotation added successfully');
  };

  const filteredAnnotations = useMemo(() => {
    if (!documentation) return [];
    
    return documentation.annotations.filter(annotation => {
      if (filterType !== 'all' && annotation.type !== filterType) return false;
      if (searchQuery) {
        return annotation.content.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    });
  }, [documentation, filterType, searchQuery]);

  const getContentType = (format: string): string => {
    const types: Record<string, string> = {
      'html': 'text/html',
      'pdf': 'application/pdf',
      'markdown': 'text/markdown',
      'json': 'application/json',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };
    return types[format] || 'text/plain';
  };

  const getAnnotationIcon = (type: string) => {
    const icons: Record<string, React.ReactNode> = {
      'comment': <MessageSquare className="h-4 w-4" />,
      'warning': <AlertTriangle className="h-4 w-4" />,
      'tip': <Info className="h-4 w-4" />,
      'note': <FileText className="h-4 w-4" />,
      'todo': <Edit3 className="h-4 w-4" />,
      'review': <Eye className="h-4 w-4" />
    };
    return icons[type] || <MessageSquare className="h-4 w-4" />;
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isGenerating) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="text-muted-foreground">Generating documentation...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!documentation) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto" />
            <div>
              <h3 className="text-lg font-semibold">No Documentation Available</h3>
              <p className="text-muted-foreground">Generate documentation for this scoring model</p>
            </div>
            <Button onClick={generateDocumentation}>
              Generate Documentation
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                {documentation.modelName} Documentation
              </CardTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline">v{documentation.version}</Badge>
                <Badge variant="secondary">{documentation.language.toUpperCase()}</Badge>
                {documentation.isPublic && <Badge variant="default">Public</Badge>}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search documentation..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>

              {/* Export */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={isExporting}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleExport('html')}>
                    <FileText className="h-4 w-4 mr-2" />
                    HTML
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('pdf')}>
                    <FileText className="h-4 w-4 mr-2" />
                    PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('markdown')}>
                    <Code className="h-4 w-4 mr-2" />
                    Markdown
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('json')}>
                    <Code className="h-4 w-4 mr-2" />
                    JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Annotation Toggle */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAnnotations(!showAnnotations)}
              >
                {showAnnotations ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span className="ml-2">{showAnnotations ? 'Hide' : 'Show'} Annotations</span>
              </Button>

              {/* Regenerate */}
              {!readOnly && (
                <Button variant="outline" size="sm" onClick={generateDocumentation}>
                  <Settings className="h-4 w-4 mr-2" />
                  Regenerate
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Documentation Content */}
        <div className="lg:col-span-3">
          <Tabs value={activeSection} onValueChange={(value) => setActiveSection(value as DocumentationSection)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="specifications">Specifications</TabsTrigger>
              <TabsTrigger value="implementation">Implementation</TabsTrigger>
              <TabsTrigger value="usage">Usage</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Model Overview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Purpose</h4>
                    <p className="text-muted-foreground">{documentation.overview.purpose}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Scope</h4>
                    <p className="text-muted-foreground">{documentation.overview.scope}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Target Audience</h4>
                    <div className="flex flex-wrap gap-2">
                      {documentation.overview.targetAudience.map((audience, index) => (
                        <Badge key={index} variant="secondary">{audience}</Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Key Features</h4>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      {documentation.overview.keyFeatures.map((feature, index) => (
                        <li key={index}>{feature}</li>
                      ))}
                    </ul>
                  </div>
                  
                  {documentation.overview.limitations.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Limitations
                      </h4>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        {documentation.overview.limitations.map((limitation, index) => (
                          <li key={index}>{limitation}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Specifications Tab */}
            <TabsContent value="specifications" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Scoring Configuration</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm font-medium">Max Score</p>
                      <p className="text-2xl font-bold">{documentation.specifications.scoringConfiguration.maxScore}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Passing Threshold</p>
                      <p className="text-2xl font-bold">{documentation.specifications.scoringConfiguration.passingThreshold}%</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Scoring Unit</p>
                      <p className="text-2xl font-bold capitalize">{documentation.specifications.scoringConfiguration.scoringUnit}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Unit Count</p>
                      <p className="text-2xl font-bold">{documentation.specifications.scoringConfiguration.unitCount}</p>
                    </div>
                  </div>
                  <Separator className="my-4" />
                  <p className="text-muted-foreground">{documentation.specifications.scoringConfiguration.explanation}</p>
                </CardContent>
              </Card>

              {/* Dimensions */}
              <Card>
                <CardHeader>
                  <CardTitle>Quality Dimensions ({documentation.specifications.dimensions.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="w-full">
                    {documentation.specifications.dimensions.map((dimension, index) => (
                      <AccordionItem key={dimension.id} value={dimension.id}>
                        <AccordionTrigger className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="font-medium">{dimension.name}</span>
                            <Badge variant="outline">{dimension.weight}% weight</Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4">
                          <p className="text-muted-foreground">{dimension.description}</p>
                          
                          {dimension.subcriteria.length > 0 && (
                            <div>
                              <h5 className="font-medium mb-2">Subcriteria</h5>
                              <div className="space-y-2">
                                {dimension.subcriteria.map((sub, subIndex) => (
                                  <div key={sub.id} className="flex items-center justify-between p-2 bg-muted rounded">
                                    <span className="text-sm">{sub.name}</span>
                                    <Badge variant="secondary">{sub.weight}%</Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {dimension.examples.length > 0 && (
                            <div>
                              <h5 className="font-medium mb-2">Examples</h5>
                              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                                {dimension.examples.map((example, exIndex) => (
                                  <li key={exIndex}>{example}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>

              {/* Error Types */}
              <Card>
                <CardHeader>
                  <CardTitle>Error Types ({documentation.specifications.errorTypes.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="w-full">
                    {documentation.specifications.errorTypes.map((errorType, index) => (
                      <AccordionItem key={errorType.id} value={errorType.id}>
                        <AccordionTrigger className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="font-medium">{errorType.type}</span>
                            <Badge variant="outline">{errorType.weight}% weight</Badge>
                            <Badge variant={
                              errorType.severity === 'critical' ? 'destructive' :
                              errorType.severity === 'major' ? 'secondary' : 'outline'
                            }>
                              {errorType.severity}
                            </Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4">
                          <p className="text-muted-foreground">{errorType.description}</p>
                          
                          <div>
                            <h5 className="font-medium mb-2">Detection Criteria</h5>
                            <p className="text-sm text-muted-foreground">{errorType.detectionCriteria}</p>
                          </div>
                          
                          <div>
                            <h5 className="font-medium mb-2">Penalty Calculation</h5>
                            <p className="text-sm text-muted-foreground">{errorType.penaltyCalculation}</p>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Implementation Tab */}
            <TabsContent value="implementation" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Architecture Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{documentation.implementation.architecture.overview}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Data Flow</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{documentation.implementation.architecture.dataFlow}</p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Usage Tab */}
            <TabsContent value="usage" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Quick Start</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">{documentation.usage.quickStart.overview}</p>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Prerequisites</h4>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      {documentation.usage.quickStart.prerequisites.map((prereq, index) => (
                        <li key={index}>{prereq}</li>
                      ))}
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Basic Usage Steps</h4>
                    <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                      {documentation.usage.quickStart.basicUsage.map((step, index) => (
                        <li key={index}>{step}</li>
                      ))}
                    </ol>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Annotations Panel */}
          {showAnnotations && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Annotations</CardTitle>
                  <div className="flex items-center gap-2">
                    <Select value={filterType} onValueChange={setFilterType}>
                      <SelectTrigger className="w-24 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="comment">Comments</SelectItem>
                        <SelectItem value="warning">Warnings</SelectItem>
                        <SelectItem value="tip">Tips</SelectItem>
                        <SelectItem value="note">Notes</SelectItem>
                        <SelectItem value="todo">Todos</SelectItem>
                        <SelectItem value="review">Reviews</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    {!readOnly && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline">
                            <Plus className="h-3 w-3" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add Annotation</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <label className="text-sm font-medium">Type</label>
                              <Select value={newAnnotation.type} onValueChange={(value: any) => 
                                setNewAnnotation({...newAnnotation, type: value})
                              }>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="comment">Comment</SelectItem>
                                  <SelectItem value="warning">Warning</SelectItem>
                                  <SelectItem value="tip">Tip</SelectItem>
                                  <SelectItem value="note">Note</SelectItem>
                                  <SelectItem value="todo">Todo</SelectItem>
                                  <SelectItem value="review">Review</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div>
                              <label className="text-sm font-medium">Section</label>
                              <Select value={newAnnotation.section} onValueChange={(value: any) => 
                                setNewAnnotation({...newAnnotation, section: value})
                              }>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="overview">Overview</SelectItem>
                                  <SelectItem value="specifications">Specifications</SelectItem>
                                  <SelectItem value="implementation">Implementation</SelectItem>
                                  <SelectItem value="usage">Usage</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div>
                              <label className="text-sm font-medium">Priority</label>
                              <Select value={newAnnotation.priority} onValueChange={(value: any) => 
                                setNewAnnotation({...newAnnotation, priority: value})
                              }>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="low">Low</SelectItem>
                                  <SelectItem value="medium">Medium</SelectItem>
                                  <SelectItem value="high">High</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div>
                              <label className="text-sm font-medium">Content</label>
                              <Textarea
                                value={newAnnotation.content}
                                onChange={(e) => setNewAnnotation({...newAnnotation, content: e.target.value})}
                                placeholder="Enter annotation content..."
                                rows={3}
                              />
                            </div>
                            
                            <Button onClick={handleAddAnnotation} className="w-full">
                              Add Annotation
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-3">
                    {filteredAnnotations.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No annotations found
                      </p>
                    ) : (
                      filteredAnnotations.map((annotation) => (
                        <div key={annotation.id} className="p-3 bg-muted rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {getAnnotationIcon(annotation.type)}
                              <Badge variant="outline">
                                {annotation.type}
                              </Badge>
                              <Badge variant={
                                annotation.priority === 'high' ? 'destructive' :
                                annotation.priority === 'medium' ? 'secondary' : 'outline'
                              }>
                                {annotation.priority}
                              </Badge>
                            </div>
                            <Badge variant="outline">
                              {annotation.context.section}
                            </Badge>
                          </div>
                          <p className="text-sm">{annotation.content}</p>
                          {annotation.author && (
                            <p className="text-xs text-muted-foreground">
                              by {annotation.author} • {formatTimestamp(annotation.createdAt)}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Change History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <History className="h-4 w-4" />
                Recent Changes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-32">
                {documentation.changeHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No changes recorded
                  </p>
                ) : (
                  <div className="space-y-2">
                    {documentation.changeHistory.slice(0, 5).map((change) => (
                      <div key={change.id} className="p-2 bg-muted rounded text-xs">
                        <p className="font-medium">{change.summary}</p>
                        <p className="text-muted-foreground">
                          {formatTimestamp(change.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Model Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Model Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created:</span>
                <span>{formatTimestamp(model.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Updated:</span>
                <span>{formatTimestamp(model.updatedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Version:</span>
                <span>{model.version}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Framework:</span>
                <span className="capitalize">{model.framework}</span>
              </div>
              {model.tags.length > 0 && (
                <div>
                  <span className="text-muted-foreground">Tags:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {model.tags.map((tag, index) => (
                      <Badge key={index} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 