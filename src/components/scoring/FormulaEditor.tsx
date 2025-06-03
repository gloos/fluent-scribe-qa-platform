/**
 * Formula Editor Component
 * 
 * Provides a rich text editor for formula input with syntax highlighting,
 * auto-completion, and real-time validation feedback.
 */

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertCircle, 
  CheckCircle, 
  Edit3, 
  Zap,
  HelpCircle,
  Lightbulb
} from 'lucide-react';

import type {
  FormulaContext,
  FormulaValidationResult,
  FormulaVariable,
  FormulaFunction
} from '@/lib/types/scoring-models';

interface FormulaEditorProps {
  /** Current formula expression */
  expression: string;
  /** Validation result from parser */
  validationResult: FormulaValidationResult;
  /** Context for variable suggestions */
  context: FormulaContext;
  /** Called when expression changes */
  onChange: (expression: string) => void;
  /** Whether editor is read-only */
  readOnly?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Additional CSS classes */
  className?: string;
}

export function FormulaEditor({
  expression,
  validationResult,
  context,
  onChange,
  readOnly = false,
  placeholder = "Enter your formula expression...",
  className = ''
}: FormulaEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{
    text: string;
    type: 'function' | 'variable' | 'operator';
    description?: string;
  }>>([]);

  // Available functions for suggestions
  const availableFunctions = [
    { name: 'dimension', description: 'Get dimension score by ID' },
    { name: 'errorType', description: 'Get error count by type' },
    { name: 'weight', description: 'Get weight value by ID' },
    { name: 'totalErrors', description: 'Get total error count' },
    { name: 'unitCount', description: 'Get unit count' },
    { name: 'maxScore', description: 'Get maximum score' },
    { name: 'min', description: 'Return minimum value' },
    { name: 'max', description: 'Return maximum value' },
    { name: 'avg', description: 'Calculate average' },
    { name: 'sum', description: 'Calculate sum' },
    { name: 'round', description: 'Round to nearest integer' },
    { name: 'abs', description: 'Absolute value' },
    { name: 'if', description: 'Conditional logic' },
    { name: 'and', description: 'Logical AND' },
    { name: 'or', description: 'Logical OR' },
    { name: 'not', description: 'Logical NOT' }
  ];

  // Available variables from context
  const availableVariables = [
    ...Object.keys(context.dimensions).map(id => ({ name: id, type: 'dimension' as const })),
    ...Object.keys(context.errorTypes).map(id => ({ name: id, type: 'errorType' as const })),
    ...Object.keys(context.weights).map(id => ({ name: id, type: 'weight' as const }))
  ];

  // Available operators
  const availableOperators = [
    { name: '+', description: 'Addition' },
    { name: '-', description: 'Subtraction' },
    { name: '*', description: 'Multiplication' },
    { name: '/', description: 'Division' },
    { name: '%', description: 'Modulo' },
    { name: '^', description: 'Exponentiation' },
    { name: '>', description: 'Greater than' },
    { name: '<', description: 'Less than' },
    { name: '>=', description: 'Greater than or equal' },
    { name: '<=', description: 'Less than or equal' },
    { name: '==', description: 'Equal to' },
    { name: '!=', description: 'Not equal to' }
  ];

  // Handle text change
  const handleChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = event.target.value;
    const cursor = event.target.selectionStart;
    
    setCursorPosition(cursor);
    onChange(newValue);
    
    // Check for suggestions trigger
    const textBeforeCursor = newValue.substring(0, cursor);
    const lastWord = textBeforeCursor.split(/[\s\(\),]+/).pop() || '';
    
    if (lastWord.length > 0) {
      generateSuggestions(lastWord);
    } else {
      setShowSuggestions(false);
    }
  }, [onChange]);

  // Generate suggestions based on current input
  const generateSuggestions = useCallback((input: string) => {
    const suggestions = [];
    
    // Function suggestions
    availableFunctions.forEach(func => {
      if (func.name.toLowerCase().startsWith(input.toLowerCase())) {
        suggestions.push({
          text: func.name + '(',
          type: 'function' as const,
          description: func.description
        });
      }
    });
    
    // Variable suggestions (for dimension, errorType, weight functions)
    if (input.includes('"')) {
      const quoteIndex = input.lastIndexOf('"');
      const variableInput = input.substring(quoteIndex + 1);
      
      availableVariables.forEach(variable => {
        if (variable.name.toLowerCase().startsWith(variableInput.toLowerCase())) {
          suggestions.push({
            text: `"${variable.name}"`,
            type: 'variable' as const,
            description: `${variable.type}: ${variable.name}`
          });
        }
      });
    }
    
    // Operator suggestions
    availableOperators.forEach(op => {
      if (op.name.startsWith(input) || op.description.toLowerCase().includes(input.toLowerCase())) {
        suggestions.push({
          text: op.name,
          type: 'operator' as const,
          description: op.description
        });
      }
    });
    
    setSuggestions(suggestions.slice(0, 10)); // Limit to 10 suggestions
    setShowSuggestions(suggestions.length > 0);
  }, [availableFunctions, availableVariables, availableOperators]);

  // Insert suggestion at cursor
  const insertSuggestion = useCallback((suggestion: string) => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    
    // Find the start of the current word
    let wordStart = start;
    while (wordStart > 0 && /[a-zA-Z0-9_"]/.test(text[wordStart - 1])) {
      wordStart--;
    }
    
    const newText = text.substring(0, wordStart) + suggestion + text.substring(end);
    onChange(newText);
    
    // Position cursor after insertion
    setTimeout(() => {
      const newCursorPos = wordStart + suggestion.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
    
    setShowSuggestions(false);
  }, [onChange]);

  // Handle keyboard events
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Tab' && showSuggestions && suggestions.length > 0) {
      event.preventDefault();
      insertSuggestion(suggestions[0].text);
    } else if (event.key === 'Escape') {
      setShowSuggestions(false);
    }
  }, [showSuggestions, suggestions, insertSuggestion]);

  // Calculate line and column from position
  const getLineAndColumn = useCallback((position: number) => {
    const lines = expression.substring(0, position).split('\n');
    return {
      line: lines.length,
      column: lines[lines.length - 1].length + 1
    };
  }, [expression]);

  return (
    <Card className={`formula-editor ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Edit3 className="h-4 w-4" />
              Formula Expression
            </CardTitle>
            <CardDescription>
              Enter your custom scoring formula with mathematical operations and functions
            </CardDescription>
          </div>
          
          {/* Cursor Position Indicator */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Line {getLineAndColumn(cursorPosition).line}, Col {getLineAndColumn(cursorPosition).column}</span>
            {expression.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {expression.length} chars
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Main Editor */}
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={expression}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="font-mono text-sm min-h-[120px] resize-y"
            disabled={readOnly}
            spellCheck={false}
          />
          
          {/* Syntax Highlighting Overlay */}
          <div className="absolute inset-0 pointer-events-none font-mono text-sm whitespace-pre-wrap break-words p-3 text-transparent">
            {/* This would contain syntax highlighted version of the text */}
          </div>
          
          {/* Auto-completion Suggestions */}
          {showSuggestions && suggestions.length > 0 && (
            <Card className="absolute top-full left-0 z-10 mt-1 w-80 border shadow-lg">
              <CardContent className="p-2">
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground mb-2">
                    Suggestions (Press Tab to insert first)
                  </div>
                  <ScrollArea className="max-h-48">
                    {suggestions.map((suggestion, index) => (
                      <Button
                        key={index}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-left h-auto p-2"
                        onClick={() => insertSuggestion(suggestion.text)}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <code className="bg-muted px-1 rounded text-xs">
                              {suggestion.text}
                            </code>
                            <Badge variant="outline" className="text-xs">
                              {suggestion.type}
                            </Badge>
                          </div>
                          {suggestion.description && (
                            <div className="text-xs text-muted-foreground">
                              {suggestion.description}
                            </div>
                          )}
                        </div>
                      </Button>
                    ))}
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Quick Insert Buttons */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Zap className="h-4 w-4" />
            Quick Insert
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {/* Common Functions */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Functions</div>
              <div className="flex flex-wrap gap-1">
                {['dimension', 'errorType', 'weight', 'if', 'max', 'min'].map(func => (
                  <Button
                    key={func}
                    variant="outline"
                    size="sm"
                    className="text-xs h-6"
                    onClick={() => insertSuggestion(`${func}(`)}
                    disabled={readOnly}
                  >
                    {func}
                  </Button>
                ))}
              </div>
            </div>

            {/* Common Operators */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Operators</div>
              <div className="flex flex-wrap gap-1">
                {['+', '-', '*', '/', '>', '<', '=='].map(op => (
                  <Button
                    key={op}
                    variant="outline"
                    size="sm"
                    className="text-xs h-6"
                    onClick={() => insertSuggestion(` ${op} `)}
                    disabled={readOnly}
                  >
                    {op}
                  </Button>
                ))}
              </div>
            </div>

            {/* Available Dimensions */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Dimensions</div>
              <div className="flex flex-wrap gap-1">
                {Object.keys(context.dimensions).slice(0, 4).map(dim => (
                  <Button
                    key={dim}
                    variant="outline"
                    size="sm"
                    className="text-xs h-6"
                    onClick={() => insertSuggestion(`dimension("${dim}")`)}
                    disabled={readOnly}
                  >
                    {dim}
                  </Button>
                ))}
              </div>
            </div>

            {/* Error Types */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Error Types</div>
              <div className="flex flex-wrap gap-1">
                {Object.keys(context.errorTypes).slice(0, 4).map(error => (
                  <Button
                    key={error}
                    variant="outline"
                    size="sm"
                    className="text-xs h-6"
                    onClick={() => insertSuggestion(`errorType("${error}")`)}
                    disabled={readOnly}
                  >
                    {error}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Validation Status */}
        {expression.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {validationResult.isValid ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600" />
              )}
              <span className="text-sm font-medium">
                {validationResult.isValid ? 'Valid Expression' : 'Syntax Errors'}
              </span>
              <Badge variant="outline" className="text-xs">
                Parsed in {validationResult.parseTime.toFixed(1)}ms
              </Badge>
            </div>

            {/* Error Details */}
            {!validationResult.isValid && validationResult.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    {validationResult.errors.map((error, index) => (
                      <div key={index} className="text-sm">
                        {error.message}
                        {error.position && (
                          <span className="text-muted-foreground ml-1">
                            at line {error.position.line}, column {error.position.column}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Suggestions for fixes */}
            {validationResult.suggestedFixes.length > 0 && (
              <Alert>
                <Lightbulb className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <div className="font-medium text-sm">Suggestions:</div>
                    <ul className="list-disc list-inside space-y-1">
                      {validationResult.suggestedFixes.map((fix, index) => (
                        <li key={index} className="text-sm">{fix}</li>
                      ))}
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Help Text */}
        {expression.length === 0 && (
          <Alert>
            <HelpCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="text-sm">
                Start typing your formula expression. Use functions like <code className="bg-muted px-1 rounded">dimension("name")</code>, 
                mathematical operators like <code className="bg-muted px-1 rounded">+</code>, <code className="bg-muted px-1 rounded">*</code>, 
                and conditional logic like <code className="bg-muted px-1 rounded">if(condition, true, false)</code>.
                Press Tab to auto-complete suggestions.
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

export default FormulaEditor; 