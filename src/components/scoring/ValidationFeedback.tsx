/**
 * ValidationFeedback Component
 * 
 * Displays real-time validation results for scoring models with clear error messaging,
 * suggested fixes, and visual indicators for different severity levels.
 */

import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  CheckCircle2, 
  ChevronDown, 
  ChevronRight,
  Target,
  TrendingUp,
  Clock,
  Lightbulb,
  Bug,
  Zap
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { 
  ValidationResult, 
  ValidationViolation, 
  ValidationSeverity,
  FieldValidationResult
} from '@/lib/types/scoring-models';

interface ValidationFeedbackProps {
  validationResult: ValidationResult;
  onFixSuggestion?: (ruleId: string, suggestedFix: string) => void;
  onShowField?: (fieldPath: string) => void;
  compact?: boolean;
  showRecommendations?: boolean;
  showTimingInfo?: boolean;
}

export const ValidationFeedback: React.FC<ValidationFeedbackProps> = ({
  validationResult,
  onFixSuggestion,
  onShowField,
  compact = false,
  showRecommendations = true,
  showTimingInfo = false
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['errors']));
  const [activeTab, setActiveTab] = useState('violations');

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const getSeverityConfig = (severity: ValidationSeverity) => {
    switch (severity) {
      case 'error':
        return {
          icon: AlertTriangle,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          badgeVariant: 'destructive' as const
        };
      case 'warning':
        return {
          icon: AlertCircle,
          color: 'text-orange-600',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          badgeVariant: 'secondary' as const
        };
      case 'info':
        return {
          icon: Info,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          badgeVariant: 'outline' as const
        };
    }
  };

  const overallStatus = useMemo(() => {
    if (validationResult.isValid) {
      return {
        icon: CheckCircle2,
        text: 'Validation Passed',
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200'
      };
    } else if (validationResult.errors.length > 0) {
      return {
        icon: AlertTriangle,
        text: 'Validation Failed',
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200'
      };
    } else {
      return {
        icon: AlertCircle,
        text: 'Has Warnings',
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200'
      };
    }
  }, [validationResult.isValid, validationResult.errors.length]);

  if (compact) {
    return (
      <CompactValidationFeedback 
        validationResult={validationResult}
        overallStatus={overallStatus}
        onShowField={onShowField}
      />
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <overallStatus.icon className={`h-5 w-5 ${overallStatus.color}`} />
            Validation Results
          </CardTitle>
          <div className="flex items-center gap-3">
            <Badge 
              variant={validationResult.isValid ? 'default' : 'destructive'}
              className="text-sm"
            >
              Score: {validationResult.score}%
            </Badge>
            {showTimingInfo && (
              <Badge variant="outline" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                {validationResult.validationDuration}ms
              </Badge>
            )}
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Completion</span>
            <span>{validationResult.summary.completionPercentage}%</span>
          </div>
          <Progress 
            value={validationResult.summary.completionPercentage} 
            className="h-2"
          />
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {validationResult.summary.passedRules}
            </div>
            <div className="text-xs text-gray-500">Passed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {validationResult.summary.errorCount}
            </div>
            <div className="text-xs text-gray-500">Errors</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {validationResult.summary.warningCount}
            </div>
            <div className="text-xs text-gray-500">Warnings</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {validationResult.summary.infoCount}
            </div>
            <div className="text-xs text-gray-500">Info</div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="violations">
              Issues ({validationResult.errors.length + validationResult.warnings.length})
            </TabsTrigger>
            <TabsTrigger value="fields">
              Fields ({Object.keys(validationResult.fieldValidation).length})
            </TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
          </TabsList>

          <TabsContent value="violations" className="space-y-4">
            {validationResult.errors.length > 0 && (
              <ViolationSection
                title="Errors"
                violations={validationResult.errors}
                severity="error"
                expanded={expandedSections.has('errors')}
                onToggle={() => toggleSection('errors')}
                onFixSuggestion={onFixSuggestion}
                onShowField={onShowField}
              />
            )}

            {validationResult.warnings.length > 0 && (
              <ViolationSection
                title="Warnings"
                violations={validationResult.warnings}
                severity="warning"
                expanded={expandedSections.has('warnings')}
                onToggle={() => toggleSection('warnings')}
                onFixSuggestion={onFixSuggestion}
                onShowField={onShowField}
              />
            )}

            {validationResult.info.length > 0 && (
              <ViolationSection
                title="Information"
                violations={validationResult.info}
                severity="info"
                expanded={expandedSections.has('info')}
                onToggle={() => toggleSection('info')}
                onFixSuggestion={onFixSuggestion}
                onShowField={onShowField}
              />
            )}

            {validationResult.errors.length === 0 && 
             validationResult.warnings.length === 0 && 
             validationResult.info.length === 0 && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>All Good!</AlertTitle>
                <AlertDescription>
                  No validation issues found. Your scoring model is ready to use.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          <TabsContent value="fields" className="space-y-4">
            <FieldValidationResults 
              fieldResults={validationResult.fieldValidation}
              onShowField={onShowField}
            />
          </TabsContent>

          <TabsContent value="summary" className="space-y-4">
            <ValidationSummary 
              result={validationResult}
              showRecommendations={showRecommendations}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

interface ViolationSectionProps {
  title: string;
  violations: ValidationViolation[];
  severity: ValidationSeverity;
  expanded: boolean;
  onToggle: () => void;
  onFixSuggestion?: (ruleId: string, suggestedFix: string) => void;
  onShowField?: (fieldPath: string) => void;
}

const ViolationSection: React.FC<ViolationSectionProps> = ({
  title,
  violations,
  severity,
  expanded,
  onToggle,
  onFixSuggestion,
  onShowField
}) => {
  const config = getSeverityConfig(severity);

  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between p-0 h-auto">
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <config.icon className={`h-4 w-4 ${config.color}`} />
            <span className="font-medium">{title}</span>
            <Badge variant={config.badgeVariant}>{violations.length}</Badge>
          </div>
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="space-y-3 pt-3">
        {violations.map((violation, index) => (
          <ViolationItem
            key={`${violation.ruleId}-${index}`}
            violation={violation}
            severity={severity}
            onFixSuggestion={onFixSuggestion}
            onShowField={onShowField}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
};

interface ViolationItemProps {
  violation: ValidationViolation;
  severity: ValidationSeverity;
  onFixSuggestion?: (ruleId: string, suggestedFix: string) => void;
  onShowField?: (fieldPath: string) => void;
}

const ViolationItem: React.FC<ViolationItemProps> = ({
  violation,
  severity,
  onFixSuggestion,
  onShowField
}) => {
  const config = getSeverityConfig(severity);

  return (
    <Alert className={`${config.bgColor} ${config.borderColor}`}>
      <config.icon className={`h-4 w-4 ${config.color}`} />
      <AlertTitle className="flex items-center justify-between">
        <span>{violation.ruleName}</span>
        {violation.field && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={() => onShowField?.(violation.field!)}
          >
            <Target className="h-3 w-3 mr-1" />
            {violation.field}
          </Button>
        )}
      </AlertTitle>
      
      <AlertDescription>
        <div className="space-y-2">
          <p>{violation.message}</p>
          
          {(violation.actualValue !== undefined || violation.expectedValue !== undefined) && (
            <div className="text-sm space-y-1">
              {violation.actualValue !== undefined && (
                <div>
                  <span className="font-medium">Current:</span> {violation.actualValue}
                </div>
              )}
              {violation.expectedValue !== undefined && (
                <div>
                  <span className="font-medium">Expected:</span> {violation.expectedValue}
                </div>
              )}
            </div>
          )}
          
          {violation.suggestedFix && (
            <div className="flex items-start gap-2 mt-2 p-2 bg-blue-50 rounded-md">
              <Lightbulb className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-sm text-blue-800 font-medium">Suggested Fix:</div>
                <div className="text-sm text-blue-700">{violation.suggestedFix}</div>
                {onFixSuggestion && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 h-6 text-xs"
                    onClick={() => onFixSuggestion(violation.ruleId, violation.suggestedFix!)}
                  >
                    <Zap className="h-3 w-3 mr-1" />
                    Apply Fix
                  </Button>
                )}
              </div>
            </div>
          )}
          
          {violation.helpText && (
            <div className="text-sm text-gray-600 italic">
              💡 {violation.helpText}
            </div>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
};

interface FieldValidationResultsProps {
  fieldResults: Record<string, FieldValidationResult>;
  onShowField?: (fieldPath: string) => void;
}

const FieldValidationResults: React.FC<FieldValidationResultsProps> = ({
  fieldResults,
  onShowField
}) => {
  const sortedFields = Object.entries(fieldResults).sort(([, a], [, b]) => {
    // Sort by severity: error > warning > info, then by field name
    const severityOrder = { error: 3, warning: 2, info: 1 };
    const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
    if (severityDiff !== 0) return severityDiff;
    return a.field.localeCompare(b.field);
  });

  if (sortedFields.length === 0) {
    return (
      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertTitle>All Fields Valid</AlertTitle>
        <AlertDescription>
          No field-level validation issues detected.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      {sortedFields.map(([fieldPath, result]) => {
        const config = getSeverityConfig(result.severity);
        
        return (
          <Alert 
            key={fieldPath}
            className={`${config.bgColor} ${config.borderColor}`}
          >
            <config.icon className={`h-4 w-4 ${config.color}`} />
            <AlertTitle className="flex items-center justify-between">
              <span>{fieldPath}</span>
              <div className="flex items-center gap-2">
                <Badge variant={config.badgeVariant} className="text-xs">
                  {result.messages.length} issue{result.messages.length === 1 ? '' : 's'}
                </Badge>
                {onShowField && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => onShowField(fieldPath)}
                  >
                    <Target className="h-3 w-3 mr-1" />
                    Show
                  </Button>
                )}
              </div>
            </AlertTitle>
            
            <AlertDescription>
              <div className="space-y-1">
                {result.messages.map((message, index) => (
                  <div key={index} className="text-sm">{message}</div>
                ))}
                
                {result.suggestedFixes.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <div className="text-sm font-medium text-gray-700">Suggested fixes:</div>
                    {result.suggestedFixes.map((fix, index) => (
                      <div key={index} className="text-sm text-gray-600">• {fix}</div>
                    ))}
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        );
      })}
    </div>
  );
};

interface ValidationSummaryProps {
  result: ValidationResult;
  showRecommendations?: boolean;
}

const ValidationSummary: React.FC<ValidationSummaryProps> = ({
  result,
  showRecommendations = true
}) => {
  return (
    <div className="space-y-4">
      {/* Health Score */}
      <Alert className={result.isValid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
        <TrendingUp className={`h-4 w-4 ${result.isValid ? 'text-green-600' : 'text-red-600'}`} />
        <AlertTitle>Validation Health Score</AlertTitle>
        <AlertDescription>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex-1">
              <Progress value={result.score} className="h-3" />
            </div>
            <Badge 
              variant={result.score >= 80 ? 'default' : result.score >= 60 ? 'secondary' : 'destructive'}
              className="text-lg px-3 py-1"
            >
              {result.score}%
            </Badge>
          </div>
          <div className="text-sm mt-2">
            {result.summary.passedRules} of {result.summary.totalRules} rules passed
          </div>
        </AlertDescription>
      </Alert>

      {/* Recommendations */}
      {showRecommendations && result.summary.recommendations.length > 0 && (
        <Alert className="bg-blue-50 border-blue-200">
          <Lightbulb className="h-4 w-4 text-blue-600" />
          <AlertTitle>Recommendations</AlertTitle>
          <AlertDescription>
            <ul className="space-y-1 mt-2">
              {result.summary.recommendations.map((recommendation, index) => (
                <li key={index} className="text-sm flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>{recommendation}</span>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Detailed Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Rule Execution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Total Rules:</span>
              <span className="font-medium">{result.summary.totalRules}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Passed:</span>
              <span className="font-medium text-green-600">{result.summary.passedRules}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Failed:</span>
              <span className="font-medium text-red-600">{result.summary.failedRules}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Skipped:</span>
              <span className="font-medium text-gray-600">{result.summary.skippedRules}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Issue Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Errors:</span>
              <span className="font-medium text-red-600">{result.summary.errorCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Warnings:</span>
              <span className="font-medium text-orange-600">{result.summary.warningCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Info:</span>
              <span className="font-medium text-blue-600">{result.summary.infoCount}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-sm">
              <span>Completion:</span>
              <span className="font-medium">{result.summary.completionPercentage}%</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

interface CompactValidationFeedbackProps {
  validationResult: ValidationResult;
  overallStatus: any;
  onShowField?: (fieldPath: string) => void;
}

const CompactValidationFeedback: React.FC<CompactValidationFeedbackProps> = ({
  validationResult,
  overallStatus,
  onShowField
}) => {
  return (
    <Alert className={`${overallStatus.bgColor} ${overallStatus.borderColor}`}>
      <overallStatus.icon className={`h-4 w-4 ${overallStatus.color}`} />
      <AlertTitle className="flex items-center justify-between">
        <span>{overallStatus.text}</span>
        <Badge variant={validationResult.isValid ? 'default' : 'destructive'}>
          {validationResult.score}%
        </Badge>
      </AlertTitle>
      <AlertDescription>
        <div className="flex items-center gap-4 text-sm">
          {validationResult.summary.errorCount > 0 && (
            <span className="text-red-600">
              {validationResult.summary.errorCount} error{validationResult.summary.errorCount === 1 ? '' : 's'}
            </span>
          )}
          {validationResult.summary.warningCount > 0 && (
            <span className="text-orange-600">
              {validationResult.summary.warningCount} warning{validationResult.summary.warningCount === 1 ? '' : 's'}
            </span>
          )}
          {validationResult.summary.errorCount === 0 && validationResult.summary.warningCount === 0 && (
            <span className="text-green-600">All checks passed</span>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
};

// Helper function - moved outside component to avoid re-creation
const getSeverityConfig = (severity: ValidationSeverity) => {
  switch (severity) {
    case 'error':
      return {
        icon: AlertTriangle,
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        badgeVariant: 'destructive' as const
      };
    case 'warning':
      return {
        icon: AlertCircle,
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
        badgeVariant: 'secondary' as const
      };
    case 'info':
      return {
        icon: Info,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        badgeVariant: 'outline' as const
      };
  }
};

export default ValidationFeedback; 