/**
 * Formula Builder Component
 * 
 * Advanced formula construction tool for custom scoring calculations.
 * Provides syntax highlighting, real-time validation, template library,
 * and testing environment for scoring formulas.
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertCircle, 
  CheckCircle, 
  Code, 
  Play, 
  Save, 
  BookOpen, 
  TestTube,
  Lightbulb,
  Copy,
  Trash2
} from 'lucide-react';

import type {
  ScoringFormula,
  FormulaTemplate,
  FormulaCategory,
  FormulaContext,
  FormulaValidationResult,
  FormulaExecutionResult,
  FormulaBuilderState
} from '@/lib/types/scoring-models';

import { FormulaParser, FormulaUtils } from '@/lib/utils/formula-parser';
import { 
  getAllFormulaTemplates, 
  getTemplatesByCategory, 
  getPopularTemplates,
  searchTemplates
} from '@/lib/utils/formula-templates';

// Sub-components
import { FormulaEditor } from './FormulaEditor';
import { FormulaLibrary } from './FormulaLibrary';
import { FormulaTester } from './FormulaTester';

interface FormulaBuilderProps {
  /** Current formula being edited */
  formula?: Partial<ScoringFormula>;
  /** Available context variables for the formula */
  context?: Partial<FormulaContext>;
  /** Formula category to filter templates */
  category?: FormulaCategory;
  /** Called when formula is saved */
  onSave?: (formula: ScoringFormula) => void;
  /** Called when formula changes */
  onChange?: (formula: Partial<ScoringFormula>) => void;
  /** Called when formula is deleted */
  onDelete?: (formulaId: string) => void;
  /** Whether the component is in read-only mode */
  readOnly?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function FormulaBuilder({
  formula: initialFormula,
  context: initialContext,
  category = 'custom',
  onSave,
  onChange,
  onDelete,
  readOnly = false,
  className = ''
}: FormulaBuilderProps) {
  // Component state
  const [builderState, setBuilderState] = useState<FormulaBuilderState>({
    currentFormula: {
      id: initialFormula?.id || `formula-${Date.now()}`,
      name: initialFormula?.name || '',
      description: initialFormula?.description || '',
      expression: initialFormula?.expression || '',
      variables: initialFormula?.variables || [],
      functions: initialFormula?.functions || [],
      isValid: false,
      validationErrors: [],
      category,
      tags: initialFormula?.tags || [],
      createdAt: initialFormula?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    validationResult: {
      isValid: false,
      errors: [],
      warnings: [],
      suggestedFixes: [],
      parseTime: 0
    },
    testResults: [],
    availableVariables: [],
    availableFunctions: [],
    isTestMode: false,
    testContext: initialContext ? {
      dimensions: initialContext.dimensions || {},
      errorTypes: initialContext.errorTypes || {},
      weights: initialContext.weights || {},
      totalErrors: initialContext.totalErrors || 0,
      unitCount: initialContext.unitCount || 100,
      errorRate: initialContext.errorRate || 0,
      constants: initialContext.constants || {},
      variables: initialContext.variables || {},
      maxScore: initialContext.maxScore || 100,
      passingThreshold: initialContext.passingThreshold || 85
    } : FormulaUtils.createTestContext()
  });

  // Handle formula expression changes
  const handleExpressionChange = useCallback((expression: string) => {
    const updatedFormula = {
      ...builderState.currentFormula,
      expression,
      updatedAt: new Date().toISOString()
    };

    // Validate the formula
    const validationResult = FormulaParser.validateFormula(expression);
    
    // Extract variables and functions
    const variables = FormulaUtils.extractVariables(expression);
    const functions = FormulaUtils.extractFunctions(expression);

    const newState = {
      ...builderState,
      currentFormula: {
        ...updatedFormula,
        variables,
        functions,
        isValid: validationResult.isValid,
        validationErrors: validationResult.errors.map(e => e.message)
      },
      validationResult
    };

    setBuilderState(newState);
    onChange?.(newState.currentFormula);
  }, [builderState, onChange]);

  // Handle formula metadata changes
  const handleMetadataChange = useCallback((field: keyof ScoringFormula, value: any) => {
    const updatedFormula = {
      ...builderState.currentFormula,
      [field]: value,
      updatedAt: new Date().toISOString()
    };

    const newState = {
      ...builderState,
      currentFormula: updatedFormula
    };

    setBuilderState(newState);
    onChange?.(newState.currentFormula);
  }, [builderState, onChange]);

  // Handle template selection
  const handleTemplateSelect = useCallback((template: FormulaTemplate) => {
    const updatedFormula = {
      ...builderState.currentFormula,
      name: template.name,
      description: template.description,
      expression: template.expression,
      category: template.category,
      tags: template.tags,
      updatedAt: new Date().toISOString()
    };

    handleExpressionChange(template.expression);
    setBuilderState(prev => ({
      ...prev,
      currentFormula: updatedFormula,
      activeTemplate: template
    }));
  }, [builderState, handleExpressionChange]);

  // Handle formula testing
  const handleTest = useCallback(() => {
    if (!builderState.currentFormula.expression) return;

    const result = FormulaParser.executeFormula(
      builderState.currentFormula.expression,
      builderState.testContext
    );

    setBuilderState(prev => ({
      ...prev,
      testResults: [result, ...prev.testResults.slice(0, 9)], // Keep last 10 results
      isTestMode: true
    }));
  }, [builderState]);

  // Handle formula save
  const handleSave = useCallback(() => {
    if (!builderState.validationResult.isValid) return;

    const completeFormula: ScoringFormula = {
      ...builderState.currentFormula,
      isValid: true,
      validationErrors: []
    };

    onSave?.(completeFormula);
  }, [builderState, onSave]);

  // Handle formula deletion
  const handleDelete = useCallback(() => {
    if (builderState.currentFormula.id) {
      onDelete?.(builderState.currentFormula.id);
    }
  }, [builderState.currentFormula.id, onDelete]);

  return (
    <div className={`formula-builder space-y-6 ${className}`}>
      {/* Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                Formula Builder
              </CardTitle>
              <CardDescription>
                Create and edit custom scoring formulas with real-time validation and testing
              </CardDescription>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Validation Status */}
              <Badge variant={builderState.validationResult.isValid ? "default" : "destructive"}>
                {builderState.validationResult.isValid ? (
                  <CheckCircle className="h-3 w-3 mr-1" />
                ) : (
                  <AlertCircle className="h-3 w-3 mr-1" />
                )}
                {builderState.validationResult.isValid ? 'Valid' : 'Invalid'}
              </Badge>

              {/* Action Buttons */}
              {!readOnly && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTest}
                    disabled={!builderState.validationResult.isValid}
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Test
                  </Button>
                  
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleSave}
                    disabled={!builderState.validationResult.isValid}
                  >
                    <Save className="h-4 w-4 mr-1" />
                    Save
                  </Button>

                  {builderState.currentFormula.id && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDelete}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Formula Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="formula-name">Formula Name</Label>
              <Input
                id="formula-name"
                value={builderState.currentFormula.name}
                onChange={(e) => handleMetadataChange('name', e.target.value)}
                placeholder="Enter formula name..."
                disabled={readOnly}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="formula-category">Category</Label>
              <select
                id="formula-category"
                className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
                value={builderState.currentFormula.category}
                onChange={(e) => handleMetadataChange('category', e.target.value as FormulaCategory)}
                disabled={readOnly}
              >
                <option value="dimension_scoring">Dimension Scoring</option>
                <option value="error_penalty">Error Penalty</option>
                <option value="overall_scoring">Overall Scoring</option>
                <option value="quality_level">Quality Level</option>
                <option value="conditional_logic">Conditional Logic</option>
                <option value="statistical">Statistical</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="formula-description">Description</Label>
            <Textarea
              id="formula-description"
              value={builderState.currentFormula.description}
              onChange={(e) => handleMetadataChange('description', e.target.value)}
              placeholder="Describe what this formula calculates..."
              rows={2}
              disabled={readOnly}
            />
          </div>

          {/* Validation Errors */}
          {builderState.validationResult.errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <div className="font-medium">Validation Errors:</div>
                  <ul className="list-disc list-inside space-y-1">
                    {builderState.validationResult.errors.map((error, index) => (
                      <li key={index} className="text-sm">
                        {error.message}
                        {error.position && (
                          <span className="text-muted-foreground ml-1">
                            (line {error.position.line}, column {error.position.column})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Suggested Fixes */}
          {builderState.validationResult.suggestedFixes.length > 0 && (
            <Alert>
              <Lightbulb className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <div className="font-medium">Suggestions:</div>
                  <ul className="list-disc list-inside space-y-1">
                    {builderState.validationResult.suggestedFixes.map((fix, index) => (
                      <li key={index} className="text-sm">{fix}</li>
                    ))}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Main Editor Tabs */}
      <Tabs defaultValue="editor" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="editor" className="flex items-center gap-2">
            <Code className="h-4 w-4" />
            Editor
          </TabsTrigger>
          <TabsTrigger value="library" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="test" className="flex items-center gap-2">
            <TestTube className="h-4 w-4" />
            Test
          </TabsTrigger>
          <TabsTrigger value="docs" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Help
          </TabsTrigger>
        </TabsList>

        {/* Formula Editor Tab */}
        <TabsContent value="editor" className="space-y-4">
          <FormulaEditor
            expression={builderState.currentFormula.expression}
            validationResult={builderState.validationResult}
            context={builderState.testContext}
            onChange={handleExpressionChange}
            readOnly={readOnly}
          />
        </TabsContent>

        {/* Template Library Tab */}
        <TabsContent value="library" className="space-y-4">
          <FormulaLibrary
            category={builderState.currentFormula.category}
            onTemplateSelect={handleTemplateSelect}
            activeTemplate={builderState.activeTemplate}
          />
        </TabsContent>

        {/* Testing Tab */}
        <TabsContent value="test" className="space-y-4">
          <FormulaTester
            expression={builderState.currentFormula.expression}
            context={builderState.testContext}
            testResults={builderState.testResults}
            onContextChange={(context) => setBuilderState(prev => ({ ...prev, testContext: context }))}
            onTest={handleTest}
          />
        </TabsContent>

        {/* Documentation Tab */}
        <TabsContent value="docs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Formula Syntax Reference</CardTitle>
              <CardDescription>
                Learn how to write custom scoring formulas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Mathematical Operations */}
                <div className="space-y-3">
                  <h4 className="font-medium">Mathematical Operations</h4>
                  <div className="space-y-2 text-sm">
                    <div><code className="bg-muted px-1 rounded">+</code> Addition</div>
                    <div><code className="bg-muted px-1 rounded">-</code> Subtraction</div>
                    <div><code className="bg-muted px-1 rounded">*</code> Multiplication</div>
                    <div><code className="bg-muted px-1 rounded">/</code> Division</div>
                    <div><code className="bg-muted px-1 rounded">%</code> Modulo</div>
                    <div><code className="bg-muted px-1 rounded">^</code> Exponentiation</div>
                  </div>
                </div>

                {/* Functions */}
                <div className="space-y-3">
                  <h4 className="font-medium">Built-in Functions</h4>
                  <div className="space-y-2 text-sm">
                    <div><code className="bg-muted px-1 rounded">min(a, b, ...)</code> Minimum value</div>
                    <div><code className="bg-muted px-1 rounded">max(a, b, ...)</code> Maximum value</div>
                    <div><code className="bg-muted px-1 rounded">avg(a, b, ...)</code> Average</div>
                    <div><code className="bg-muted px-1 rounded">sum(a, b, ...)</code> Sum</div>
                    <div><code className="bg-muted px-1 rounded">round(x)</code> Round to nearest integer</div>
                    <div><code className="bg-muted px-1 rounded">abs(x)</code> Absolute value</div>
                  </div>
                </div>

                {/* Scoring Functions */}
                <div className="space-y-3">
                  <h4 className="font-medium">Scoring Functions</h4>
                  <div className="space-y-2 text-sm">
                    <div><code className="bg-muted px-1 rounded">dimension("id")</code> Get dimension score</div>
                    <div><code className="bg-muted px-1 rounded">errorType("id")</code> Get error count</div>
                    <div><code className="bg-muted px-1 rounded">weight("id")</code> Get weight value</div>
                    <div><code className="bg-muted px-1 rounded">totalErrors()</code> Total error count</div>
                    <div><code className="bg-muted px-1 rounded">unitCount()</code> Unit count</div>
                    <div><code className="bg-muted px-1 rounded">maxScore()</code> Maximum score</div>
                  </div>
                </div>

                {/* Conditional Logic */}
                <div className="space-y-3">
                  <h4 className="font-medium">Conditional Logic</h4>
                  <div className="space-y-2 text-sm">
                    <div><code className="bg-muted px-1 rounded">if(condition, true, false)</code> Conditional</div>
                    <div><code className="bg-muted px-1 rounded">and(a, b, ...)</code> Logical AND</div>
                    <div><code className="bg-muted px-1 rounded">or(a, b, ...)</code> Logical OR</div>
                    <div><code className="bg-muted px-1 rounded">not(a)</code> Logical NOT</div>
                    <div><code className="bg-muted px-1 rounded">&gt;, &lt;, &gt;=, &lt;=, ==, !=</code> Comparisons</div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Examples */}
              <div className="space-y-3">
                <h4 className="font-medium">Example Formulas</h4>
                <div className="space-y-3">
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="font-medium text-sm mb-1">Weighted Average</div>
                    <code className="text-sm">dimension("fluency") * 0.4 + dimension("adequacy") * 0.6</code>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="font-medium text-sm mb-1">Error Penalty</div>
                    <code className="text-sm">max(0, 100 - (errorType("major") * 5 + errorType("critical") * 25))</code>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="font-medium text-sm mb-1">Conditional Scoring</div>
                    <code className="text-sm">if(totalErrors() &gt; 10, 0, dimension("overall"))</code>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default FormulaBuilder; 