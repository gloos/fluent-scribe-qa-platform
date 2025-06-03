/**
 * Formula Tester Component
 * 
 * Provides a testing environment for formula expressions with custom input values,
 * real-time evaluation, and comprehensive result display.
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  TestTube,
  Play,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Activity,
  Clock,
  Target,
  TrendingUp,
  BarChart3,
  FileText
} from 'lucide-react';

import type {
  FormulaContext,
  FormulaExecutionResult,
  FormulaTestResult
} from '@/lib/types/scoring-models';

import { FormulaParser } from '@/lib/utils/formula-parser';

interface FormulaTesterProps {
  /** Formula expression to test */
  expression: string;
  /** Current test context */
  context: FormulaContext;
  /** Previous test results */
  testResults: FormulaTestResult[];
  /** Called when context changes */
  onContextChange: (context: FormulaContext) => void;
  /** Called when test is run */
  onTest: (result: FormulaTestResult) => void;
  /** Whether tester is read-only */
  readOnly?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function FormulaTester({
  expression,
  context,
  testResults,
  onContextChange,
  onTest,
  readOnly = false,
  className = ''
}: FormulaTesterProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [currentResult, setCurrentResult] = useState<FormulaExecutionResult | null>(null);
  const [testScenarios, setTestScenarios] = useState<FormulaContext[]>([]);

  // Initialize formula parser
  const parser = useMemo(() => new FormulaParser(), []);

  // Default test scenarios
  const defaultScenarios = useMemo(() => [
    {
      name: 'Basic Test',
      dimensions: { fluency: 85, adequacy: 90, style: 75 },
      errorTypes: { minor: 2, major: 1, critical: 0 },
      weights: { fluency: 30, adequacy: 40, style: 30 },
      unitCount: 100,
      maxScore: 100
    },
    {
      name: 'High Error Count',
      dimensions: { fluency: 70, adequacy: 65, style: 60 },
      errorTypes: { minor: 8, major: 4, critical: 2 },
      weights: { fluency: 30, adequacy: 40, style: 30 },
      unitCount: 100,
      maxScore: 100
    },
    {
      name: 'Perfect Score',
      dimensions: { fluency: 100, adequacy: 100, style: 100 },
      errorTypes: { minor: 0, major: 0, critical: 0 },
      weights: { fluency: 30, adequacy: 40, style: 30 },
      unitCount: 100,
      maxScore: 100
    },
    {
      name: 'Edge Case - Zero',
      dimensions: { fluency: 0, adequacy: 0, style: 0 },
      errorTypes: { minor: 0, major: 0, critical: 0 },
      weights: { fluency: 30, adequacy: 40, style: 30 },
      unitCount: 0,
      maxScore: 100
    }
  ], []);

  // Run formula test
  const runTest = useCallback(async () => {
    if (!expression.trim()) return;

    setIsRunning(true);
    
    try {
      const startTime = performance.now();
      const result = parser.evaluate(expression, context);
      const endTime = performance.now();
      
      const executionResult: FormulaExecutionResult = {
        result: result.result,
        isValid: result.isValid,
        errors: result.errors,
        warnings: result.warnings || [],
        executionTime: endTime - startTime,
        context
      };

      setCurrentResult(executionResult);

      // Create test result
      const testResult: FormulaTestResult = {
        id: `test_${Date.now()}`,
        timestamp: new Date().toISOString(),
        expression,
        context,
        result: executionResult,
        success: result.isValid
      };

      onTest(testResult);
    } catch (error) {
      const executionResult: FormulaExecutionResult = {
        result: null,
        isValid: false,
        errors: [{ 
          message: error instanceof Error ? error.message : 'Unknown error',
          type: 'runtime_error'
        }],
        warnings: [],
        executionTime: 0,
        context
      };

      setCurrentResult(executionResult);

      const testResult: FormulaTestResult = {
        id: `test_${Date.now()}`,
        timestamp: new Date().toISOString(),
        expression,
        context,
        result: executionResult,
        success: false
      };

      onTest(testResult);
    } finally {
      setIsRunning(false);
    }
  }, [expression, context, parser, onTest]);

  // Load test scenario
  const loadScenario = useCallback((scenario: any) => {
    onContextChange({
      ...scenario,
      variables: scenario.variables || {}
    });
  }, [onContextChange]);

  // Reset to default values
  const resetContext = useCallback(() => {
    onContextChange({
      dimensions: { fluency: 85, adequacy: 90, style: 75 },
      errorTypes: { minor: 2, major: 1, critical: 0 },
      weights: { fluency: 30, adequacy: 40, style: 30 },
      variables: {},
      unitCount: 100,
      maxScore: 100
    });
  }, [onContextChange]);

  // Update dimension value
  const updateDimension = useCallback((key: string, value: number) => {
    onContextChange({
      ...context,
      dimensions: {
        ...context.dimensions,
        [key]: value
      }
    });
  }, [context, onContextChange]);

  // Update error type value
  const updateErrorType = useCallback((key: string, value: number) => {
    onContextChange({
      ...context,
      errorTypes: {
        ...context.errorTypes,
        [key]: value
      }
    });
  }, [context, onContextChange]);

  // Update weight value
  const updateWeight = useCallback((key: string, value: number) => {
    onContextChange({
      ...context,
      weights: {
        ...context.weights,
        [key]: value
      }
    });
  }, [context, onContextChange]);

  // Format result for display
  const formatResult = useCallback((result: any): string => {
    if (result === null || result === undefined) return 'null';
    if (typeof result === 'number') {
      return isNaN(result) ? 'NaN' : result.toFixed(3);
    }
    if (typeof result === 'boolean') return result.toString();
    return String(result);
  }, []);

  return (
    <div className={`formula-tester space-y-6 ${className}`}>
      {/* Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <TestTube className="h-5 w-5" />
                Formula Tester
              </CardTitle>
              <CardDescription>
                Test your formula with custom input values and see real-time results
              </CardDescription>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                onClick={runTest}
                disabled={isRunning || !expression.trim() || readOnly}
                className="flex items-center gap-2"
              >
                {isRunning ? (
                  <Activity className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {isRunning ? 'Running...' : 'Run Test'}
              </Button>
              
              <Button 
                variant="outline"
                onClick={resetContext}
                disabled={readOnly}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Current Result */}
        {currentResult && (
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                {currentResult.isValid ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600" />
                )}
                <span className="font-medium">
                  {currentResult.isValid ? 'Success' : 'Error'}
                </span>
              </div>
              
              <Separator orientation="vertical" className="h-6" />
              
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono text-lg">
                  {formatResult(currentResult.result)}
                </span>
              </div>
              
              <Separator orientation="vertical" className="h-6" />
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                {currentResult.executionTime.toFixed(2)}ms
              </div>
            </div>

            {/* Errors and Warnings */}
            {currentResult.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <div className="font-medium">Execution Errors:</div>
                    <ul className="list-disc list-inside space-y-1">
                      {currentResult.errors.map((error, index) => (
                        <li key={index} className="text-sm">{error.message}</li>
                      ))}
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {currentResult.warnings.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <div className="font-medium">Warnings:</div>
                    <ul className="list-disc list-inside space-y-1">
                      {currentResult.warnings.map((warning, index) => (
                        <li key={index} className="text-sm">{warning}</li>
                      ))}
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        )}
      </Card>

      <Tabs defaultValue="input" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="input">Input Values</TabsTrigger>
          <TabsTrigger value="scenarios">Test Scenarios</TabsTrigger>
          <TabsTrigger value="history">Test History</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
        </TabsList>

        {/* Input Values Tab */}
        <TabsContent value="input" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Dimensions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Dimensions</CardTitle>
                <CardDescription className="text-sm">
                  Set score values for each dimension
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(context.dimensions).map(([key, value]) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={`dim-${key}`} className="text-sm">
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                    </Label>
                    <Input
                      id={`dim-${key}`}
                      type="number"
                      value={value}
                      onChange={(e) => updateDimension(key, parseFloat(e.target.value) || 0)}
                      min={0}
                      max={100}
                      step={0.1}
                      disabled={readOnly}
                      className="text-sm"
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Error Types */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Error Types</CardTitle>
                <CardDescription className="text-sm">
                  Set error counts for each type
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(context.errorTypes).map(([key, value]) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={`error-${key}`} className="text-sm">
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                    </Label>
                    <Input
                      id={`error-${key}`}
                      type="number"
                      value={value}
                      onChange={(e) => updateErrorType(key, parseInt(e.target.value) || 0)}
                      min={0}
                      step={1}
                      disabled={readOnly}
                      className="text-sm"
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Weights and Context */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Weights & Context</CardTitle>
                <CardDescription className="text-sm">
                  Set weight values and context variables
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(context.weights).map(([key, value]) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={`weight-${key}`} className="text-sm">
                      {key.charAt(0).toUpperCase() + key.slice(1)} Weight
                    </Label>
                    <Input
                      id={`weight-${key}`}
                      type="number"
                      value={value}
                      onChange={(e) => updateWeight(key, parseFloat(e.target.value) || 0)}
                      min={0}
                      max={100}
                      step={0.1}
                      disabled={readOnly}
                      className="text-sm"
                    />
                  </div>
                ))}
                
                <Separator />
                
                <div className="space-y-2">
                  <Label htmlFor="unit-count" className="text-sm">Unit Count</Label>
                  <Input
                    id="unit-count"
                    type="number"
                    value={context.unitCount}
                    onChange={(e) => onContextChange({
                      ...context,
                      unitCount: parseInt(e.target.value) || 0
                    })}
                    min={0}
                    disabled={readOnly}
                    className="text-sm"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="max-score" className="text-sm">Max Score</Label>
                  <Input
                    id="max-score"
                    type="number"
                    value={context.maxScore}
                    onChange={(e) => onContextChange({
                      ...context,
                      maxScore: parseFloat(e.target.value) || 0
                    })}
                    min={0}
                    disabled={readOnly}
                    className="text-sm"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Test Scenarios Tab */}
        <TabsContent value="scenarios" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Pre-defined Test Scenarios</CardTitle>
              <CardDescription className="text-sm">
                Load common test scenarios to quickly evaluate your formula
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {defaultScenarios.map((scenario, index) => (
                  <Card key={index} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">{scenario.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>Dimensions: {Object.values(scenario.dimensions).join(', ')}</div>
                        <div>Errors: {Object.values(scenario.errorTypes).join(', ')}</div>
                        <div>Weights: {Object.values(scenario.weights).join(', ')}</div>
                      </div>
                      <Button 
                        size="sm" 
                        className="w-full"
                        onClick={() => loadScenario(scenario)}
                        disabled={readOnly}
                      >
                        Load Scenario
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Test History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Test History
              </CardTitle>
              <CardDescription className="text-sm">
                Review previous test results and performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {testResults.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No test results yet. Run a test to see results here.
                    </div>
                  ) : (
                    testResults.slice().reverse().map((test) => (
                      <Card key={test.id} className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {test.success ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-red-600" />
                            )}
                            <span className="text-sm font-medium">
                              Result: {formatResult(test.result.result)}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {new Date(test.timestamp).toLocaleTimeString()}
                          </Badge>
                        </div>
                        
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div>Expression: <code className="bg-muted px-1 rounded">{test.expression}</code></div>
                          <div>Execution time: {test.result.executionTime.toFixed(2)}ms</div>
                          {test.result.errors.length > 0 && (
                            <div className="text-red-600">
                              Errors: {test.result.errors.map(e => e.message).join(', ')}
                            </div>
                          )}
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analysis Tab */}
        <TabsContent value="analysis" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Performance Analysis
              </CardTitle>
              <CardDescription className="text-sm">
                Analysis of test results and formula performance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {testResults.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Run multiple tests to see performance analysis.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="p-4">
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Success Rate</div>
                      <div className="text-2xl font-bold">
                        {Math.round((testResults.filter(t => t.success).length / testResults.length) * 100)}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {testResults.filter(t => t.success).length} of {testResults.length} tests
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Avg Execution Time</div>
                      <div className="text-2xl font-bold">
                        {(testResults.reduce((sum, t) => sum + t.result.executionTime, 0) / testResults.length).toFixed(2)}ms
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Over {testResults.length} tests
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Result Range</div>
                      <div className="text-2xl font-bold">
                        {testResults.filter(t => t.success && typeof t.result.result === 'number').length > 0 ? (
                          `${Math.min(...testResults.filter(t => t.success && typeof t.result.result === 'number').map(t => t.result.result as number)).toFixed(1)} - ${Math.max(...testResults.filter(t => t.success && typeof t.result.result === 'number').map(t => t.result.result as number)).toFixed(1)}`
                        ) : 'N/A'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Min - Max values
                      </div>
                    </div>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default FormulaTester; 