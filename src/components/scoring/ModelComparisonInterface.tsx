import React, { useState, useEffect, useMemo } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ComparisonChart } from '@/components/charts/ComparisonChart';
import { 
  BarChart3, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Download,
  Play,
  Settings,
  Eye,
  Target
} from 'lucide-react';

import type { CustomScoringModel } from '@/lib/types/scoring-models';
import { ErrorSeverity } from '@/lib/types/assessment';
import { 
  ModelComparisonEngine,
  type ModelComparisonOptions,
  type ComprehensiveComparisonResult,
  type ModelDifference,
  type SensitivityAnalysisResult,
  type ScenarioComparisonResult,
  type TestScenario
} from '@/lib/utils/model-comparison-engine';

interface ModelComparisonInterfaceProps {
  models: CustomScoringModel[];
  onModelSelect?: (models: CustomScoringModel[]) => void;
  className?: string;
}

export function ModelComparisonInterface({
  models: initialModels,
  onModelSelect,
  className
}: ModelComparisonInterfaceProps) {
  const [selectedModels, setSelectedModels] = useState<CustomScoringModel[]>(
    initialModels.slice(0, 4) // Limit to 4 models for performance
  );
  const [comparisonResult, setComparisonResult] = useState<ComprehensiveComparisonResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [comparisonOptions, setComparisonOptions] = useState<ModelComparisonOptions>({
    includeWeightAnalysis: true,
    includeFormulaAnalysis: true,
    includeSensitivityAnalysis: true,
    sensitivityRange: 10,
    testScenarios: []
  });

  const comparisonEngine = useMemo(() => ModelComparisonEngine.getInstance(), []);

  // Pre-defined test scenarios
  const defaultScenarios: TestScenario[] = [
    {
      id: 'light-editing',
      name: 'Light Editing Scenario',
      description: 'Minimal errors, mostly minor issues',
      errorPattern: [
        { errorType: 'style', severity: ErrorSeverity.MINOR, count: 2 },
        { errorType: 'punctuation', severity: ErrorSeverity.MINOR, count: 1 },
      ],
      unitCount: 1000
    },
    {
      id: 'moderate-revision',
      name: 'Moderate Revision Scenario',
      description: 'Mixed error types with moderate severity',
      errorPattern: [
        { errorType: 'accuracy', severity: ErrorSeverity.MAJOR, count: 4 },
        { errorType: 'fluency', severity: ErrorSeverity.MINOR, count: 8 },
        { errorType: 'terminology', severity: ErrorSeverity.MAJOR, count: 2 },
        { errorType: 'style', severity: ErrorSeverity.MINOR, count: 5 }
      ],
      unitCount: 1000
    },
    {
      id: 'heavy-revision',
      name: 'Heavy Revision Scenario',
      description: 'High error density with critical issues',
      errorPattern: [
        { errorType: 'accuracy', severity: ErrorSeverity.CRITICAL, count: 3 },
        { errorType: 'accuracy', severity: ErrorSeverity.MAJOR, count: 8 },
        { errorType: 'fluency', severity: ErrorSeverity.MAJOR, count: 6 },
        { errorType: 'terminology', severity: ErrorSeverity.CRITICAL, count: 2 },
        { errorType: 'style', severity: ErrorSeverity.MINOR, count: 12 }
      ],
      unitCount: 1000
    }
  ];

  // Run comparison analysis
  const runComparison = async () => {
    if (selectedModels.length < 2) return;

    setIsAnalyzing(true);
    try {
      const options: ModelComparisonOptions = {
        ...comparisonOptions,
        testScenarios: defaultScenarios
      };

      const result = await comparisonEngine.compareModels(selectedModels, options);
      setComparisonResult(result);
    } catch (error) {
      console.error('Comparison failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Auto-run comparison when models change
  useEffect(() => {
    if (selectedModels.length >= 2) {
      runComparison();
    }
  }, [selectedModels]);

  const handleModelSelectionChange = (modelId: string, isSelected: boolean) => {
    if (isSelected) {
      const model = initialModels.find(m => m.id === modelId);
      if (model && selectedModels.length < 4) {
        setSelectedModels(prev => [...prev, model]);
      }
    } else {
      setSelectedModels(prev => prev.filter(m => m.id !== modelId));
    }
  };

  const getDifferenceColor = (significance: 'high' | 'medium' | 'low') => {
    switch (significance) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
    }
  };

  const getSensitivityColor = (sensitivity: 'high' | 'medium' | 'low') => {
    switch (sensitivity) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Model Comparison</h2>
          <p className="text-muted-foreground">
            Compare scoring models side-by-side with comprehensive analysis
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={runComparison}
            disabled={selectedModels.length < 2 || isAnalyzing}
            className="gap-2"
          >
            <Play className="h-4 w-4" />
            {isAnalyzing ? 'Analyzing...' : 'Run Analysis'}
          </Button>
          {comparisonResult && (
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export Report
            </Button>
          )}
        </div>
      </div>

      {/* Model Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Model Selection
          </CardTitle>
          <CardDescription>
            Select 2-4 models to compare ({selectedModels.length}/4 selected)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {initialModels.map((model) => {
              const isSelected = selectedModels.some(m => m.id === model.id);
              const isDisabled = !isSelected && selectedModels.length >= 4;
              
              return (
                <Card 
                  key={model.id} 
                  className={`cursor-pointer transition-all ${
                    isSelected 
                      ? 'ring-2 ring-primary bg-primary/5' 
                      : isDisabled 
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:shadow-md'
                  }`}
                  onClick={() => !isDisabled && handleModelSelectionChange(model.id, !isSelected)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium">{model.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {model.framework} • v{model.version}
                        </p>
                        <div className="flex gap-2 mt-2">
                          <Badge variant="secondary" className="text-xs">
                            {model.config.dimensions.length} dimensions
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {model.config.errorTypes.length} error types
                          </Badge>
                        </div>
                      </div>
                      {isSelected && (
                        <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {selectedModels.length < 2 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Select at least 2 models to begin comparison analysis.
          </AlertDescription>
        </Alert>
      )}

      {selectedModels.length >= 2 && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="overview" className="gap-2">
              <Eye className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="differences" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Differences
            </TabsTrigger>
            <TabsTrigger value="sensitivity" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Sensitivity
            </TabsTrigger>
            <TabsTrigger value="scenarios" className="gap-2">
              <Target className="h-4 w-4" />
              Scenarios
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {comparisonResult && (
              <>
                {/* Key Insights */}
                <Card>
                  <CardHeader>
                    <CardTitle>Key Insights</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground">Most Similar Models</h4>
                        <p className="font-medium">
                          {comparisonResult.overallAnalysis.mostSimilarPair.join(' vs ')}
                        </p>
                      </div>
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground">Most Different Models</h4>
                        <p className="font-medium">
                          {comparisonResult.overallAnalysis.mostDifferentPair.join(' vs ')}
                        </p>
                      </div>
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground">Recommended Model</h4>
                        <p className="font-medium text-primary">
                          {comparisonResult.overallAnalysis.recommendedModel}
                        </p>
                      </div>
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground">Risk Factors</h4>
                        <p className="text-sm">
                          {comparisonResult.overallAnalysis.riskFactors.length} identified
                        </p>
                      </div>
                    </div>

                    {/* Usage Recommendations */}
                    <div>
                      <h4 className="font-medium mb-2">Usage Recommendations</h4>
                      <ul className="space-y-1">
                        {comparisonResult.overallAnalysis.usageRecommendations.map((rec, index) => (
                          <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-primary">•</span>
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>

                {/* Model Comparison Table */}
                <Card>
                  <CardHeader>
                    <CardTitle>Model Specifications</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Model</TableHead>
                          <TableHead>Max Score</TableHead>
                          <TableHead>Passing Threshold</TableHead>
                          <TableHead>Dimensions</TableHead>
                          <TableHead>Error Types</TableHead>
                          <TableHead>Framework</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedModels.map((model) => (
                          <TableRow key={model.id}>
                            <TableCell className="font-medium">{model.name}</TableCell>
                            <TableCell>{model.maxScore}</TableCell>
                            <TableCell>{model.passingThreshold}%</TableCell>
                            <TableCell>{model.config.dimensions.length}</TableCell>
                            <TableCell>{model.config.errorTypes.length}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{model.framework}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            )}

            {isAnalyzing && (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Running comprehensive analysis...</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Differences Tab */}
          <TabsContent value="differences" className="space-y-6">
            {comparisonResult && (
              <Card>
                <CardHeader>
                  <CardTitle>Model Differences</CardTitle>
                  <CardDescription>
                    Key differences between selected models sorted by significance
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {comparisonResult.differences.map((diff, index) => (
                      <div 
                        key={index} 
                        className={`p-4 rounded-lg border ${getDifferenceColor(diff.significance)}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className="text-xs">
                                {diff.fieldType}
                              </Badge>
                              <Badge 
                                variant={diff.significance === 'high' ? 'destructive' : 'secondary'}
                                className="text-xs"
                              >
                                {diff.significance} impact
                              </Badge>
                            </div>
                            <h4 className="font-medium">{diff.field}</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              {diff.impact}
                            </p>
                          </div>
                          <div className="text-right text-sm">
                            <div>Model A: <span className="font-mono">{diff.modelA}</span></div>
                            <div>Model B: <span className="font-mono">{diff.modelB}</span></div>
                            <div className="text-muted-foreground">
                              Difference: {diff.difference}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Sensitivity Tab */}
          <TabsContent value="sensitivity" className="space-y-6">
            {comparisonResult && (
              <Card>
                <CardHeader>
                  <CardTitle>Sensitivity Analysis</CardTitle>
                  <CardDescription>
                    How sensitive each model parameter is to changes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {comparisonResult.sensitivityAnalysis.map((analysis, index) => (
                      <div key={index} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium">{analysis.parameter}</h4>
                          <Badge 
                            variant="outline"
                            className={getSensitivityColor(analysis.sensitivity)}
                          >
                            {analysis.sensitivity} sensitivity
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Original Value:</span>
                            <span className="ml-2 font-mono">{analysis.originalValue}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Max Variation:</span>
                            <span className="ml-2 font-mono">{analysis.maxVariation.toFixed(2)}%</span>
                          </div>
                        </div>
                        
                        {analysis.recommendations.length > 0 && (
                          <div className="mt-3">
                            <h5 className="text-sm font-medium mb-1">Recommendations:</h5>
                            <ul className="text-sm text-muted-foreground space-y-1">
                              {analysis.recommendations.map((rec, recIndex) => (
                                <li key={recIndex} className="flex items-start gap-2">
                                  <span className="text-primary">•</span>
                                  {rec}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Scenarios Tab */}
          <TabsContent value="scenarios" className="space-y-6">
            {comparisonResult && (
              <div className="space-y-6">
                {comparisonResult.scenarioResults.map((scenarioResult, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <CardTitle>{scenarioResult.scenario.name}</CardTitle>
                      <CardDescription>{scenarioResult.scenario.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Scenario Summary */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Score Spread:</span>
                            <span className="ml-2 font-mono">{scenarioResult.analysis.scoreSpread.toFixed(1)}%</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Avg Score:</span>
                            <span className="ml-2 font-mono">{scenarioResult.analysis.avgScore.toFixed(1)}%</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Best:</span>
                            <span className="ml-2 text-green-600">{scenarioResult.analysis.bestPerforming}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Consistency:</span>
                            <span className="ml-2 font-mono">{scenarioResult.analysis.consistencyScore.toFixed(1)}%</span>
                          </div>
                        </div>

                        <Separator />

                        {/* Model Results */}
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Model</TableHead>
                              <TableHead>Score</TableHead>
                              <TableHead>Percentage</TableHead>
                              <TableHead>Quality Level</TableHead>
                              <TableHead>Total Penalty</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {scenarioResult.modelResults.map((result) => (
                              <TableRow key={result.modelId}>
                                <TableCell className="font-medium">{result.modelName}</TableCell>
                                <TableCell className="font-mono">{result.score.toFixed(1)}</TableCell>
                                <TableCell className="font-mono">{result.percentageScore.toFixed(1)}%</TableCell>
                                <TableCell>
                                  <Badge variant="outline">{result.qualityLevel}</Badge>
                                </TableCell>
                                <TableCell className="font-mono">{result.breakdown.totalPenalty}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>

                        {/* Recommendations */}
                        {scenarioResult.analysis.recommendations.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2">Scenario Insights:</h4>
                            <ul className="text-sm text-muted-foreground space-y-1">
                              {scenarioResult.analysis.recommendations.map((rec, recIndex) => (
                                <li key={recIndex} className="flex items-start gap-2">
                                  <span className="text-primary">•</span>
                                  {rec}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

export default ModelComparisonInterface; 