import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Form, 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';

import { 
  Plus, 
  Trash2, 
  GripVertical, 
  Eye, 
  Settings, 
  Save, 
  AlertCircle,
  Info,
  CheckCircle2,
  EyeOff,
  Shield,
  ShieldCheck,
  ShieldAlert,
  BookTemplate
} from 'lucide-react';

import type { AssessmentFramework, ErrorSeverity } from '@/lib/types/assessment';
import type { 
  ScoringModelDimension, 
  ScoringModelErrorType, 
  ValidationResult,
  CustomScoringModel 
} from '@/lib/types/scoring-models';
import ModelStructureVisualization from './ModelStructureVisualization';
import WeightingSystem, { type WeightedItem } from './WeightingSystem';
import ValidationFeedback from './ValidationFeedback';
import TemplateManager from './TemplateManager';
import { 
  dimensionsToWeightedItems,
  errorTypesToWeightedItems,
  weightedItemsToDimensions,
  weightedItemsToErrorTypes
} from '@/lib/utils/scoring-model-weights';
import { 
  ScoringModelValidationEngine, 
  ValidationUtils, 
  DEFAULT_VALIDATION_CONFIG 
} from '@/lib/utils/scoring-model-validation';

// Schema for model definition validation
const scoringModelSchema = z.object({
  name: z.string().min(1, 'Model name is required').max(100, 'Name too long'),
  description: z.string().optional(),
  framework: z.enum(['CUSTOM', 'MQM', 'DQF', 'LISA_QA', 'SAE_J2450'] as const),
  version: z.string().default('1.0'),
  maxScore: z.number().min(0).max(1000).default(100),
  passingThreshold: z.number().min(0).max(100).default(85),
  isGlobal: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  
  // Scoring configuration
  scoringUnit: z.enum(['words', 'segments', 'characters']).default('words'),
  unitCount: z.number().min(1).default(100),
  wordCountBased: z.boolean().default(true),
  segmentLevelScoring: z.boolean().default(false),
  
  // Dimensions configuration
  dimensions: z.array(z.object({
    id: z.string(),
    name: z.string().min(1, 'Dimension name required'),
    weight: z.number().min(0).max(100),
    description: z.string().optional(),
    subcriteria: z.array(z.object({
      id: z.string(),
      name: z.string().min(1, 'Subcriteria name required'),
      weight: z.number().min(0).max(100),
      description: z.string().optional()
    })).default([])
  })).default([]),
  
  // Error types configuration
  errorTypes: z.array(z.object({
    id: z.string(),
    type: z.string().min(1, 'Error type required'),
    severity: z.enum(['minor', 'major', 'critical', 'neutral'] as const),
    weight: z.number().min(0).max(100),
    description: z.string().optional()
  })).default([])
});

type ScoringModelFormData = z.infer<typeof scoringModelSchema>;

interface ModelDefinitionInterfaceProps {
  initialData?: Partial<ScoringModelFormData>;
  onSave?: (data: ScoringModelFormData) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  mode?: 'create' | 'edit' | 'view';
}

export const ModelDefinitionInterface: React.FC<ModelDefinitionInterfaceProps> = ({
  initialData,
  onSave,
  onCancel,
  isLoading = false,
  mode = 'create'
}) => {
  const [activeTab, setActiveTab] = useState('basic');
  const [previewMode, setPreviewMode] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);

  const form = useForm<ScoringModelFormData>({
    resolver: zodResolver(scoringModelSchema),
    defaultValues: {
      name: '',
      description: '',
      framework: 'CUSTOM',
      version: '1.0',
      maxScore: 100,
      passingThreshold: 85,
      isGlobal: false,
      tags: [],
      scoringUnit: 'words',
      unitCount: 100,
      wordCountBased: true,
      segmentLevelScoring: false,
      dimensions: [],
      errorTypes: [],
      ...initialData
    }
  });

  const { watch, setValue, getValues } = form;
  const watchedDimensions = watch('dimensions');
  const watchedErrorTypes = watch('errorTypes');
  const watchedTags = watch('tags');
  const watchedMaxScore = watch('maxScore');
  const watchedPassingThreshold = watch('passingThreshold');
  const watchedScoringUnit = watch('scoringUnit');
  const watchedUnitCount = watch('unitCount');

  // Calculate total weights for validation
  const totalDimensionWeight = watchedDimensions.reduce((sum, dim) => sum + dim.weight, 0);
  const totalErrorWeight = watchedErrorTypes.reduce((sum, error) => sum + error.weight, 0);

  // Convert form data to validation model format
  const getValidationModel = useCallback((): Partial<CustomScoringModel> => {
    const formData = getValues();
    return {
      id: 'temp',
      name: formData.name,
      description: formData.description,
      framework: formData.framework as AssessmentFramework,
      version: formData.version,
      isGlobal: formData.isGlobal,
      tags: formData.tags,
      maxScore: formData.maxScore,
      passingThreshold: formData.passingThreshold,
      config: {
        scoringUnit: formData.scoringUnit,
        unitCount: formData.unitCount,
        wordCountBased: formData.wordCountBased,
        segmentLevelScoring: formData.segmentLevelScoring,
        dimensions: formData.dimensions.map(d => ({
          id: d.id,
          name: d.name,
          weight: d.weight,
          description: d.description,
          subcriteria: d.subcriteria || []
        })) as ScoringModelDimension[],
        errorTypes: formData.errorTypes.map(e => ({
          id: e.id,
          type: e.type,
          severity: e.severity as ErrorSeverity,
          weight: e.weight,
          description: e.description
        })) as ScoringModelErrorType[]
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'current-user'
    };
  }, [getValues]);

  // Run validation
  const runValidation = useCallback(async () => {
    if (isValidating) return;
    
    setIsValidating(true);
    try {
      const model = getValidationModel();
      const result = await ValidationUtils.quickValidate(model, DEFAULT_VALIDATION_CONFIG);
      setValidationResult(result);
    } catch (error) {
      console.error('Validation error:', error);
      setValidationResult(null);
    } finally {
      setIsValidating(false);
    }
  }, [getValidationModel, isValidating]);

  // Watch for form changes and trigger validation
  useEffect(() => {
    const subscription = form.watch(() => {
      // Debounce validation to avoid excessive calls
      const timeoutId = setTimeout(runValidation, 500);
      return () => clearTimeout(timeoutId);
    });
    return () => subscription.unsubscribe();
  }, [form, runValidation]);

  // Handle validation fix suggestions
  const handleFixSuggestion = useCallback((ruleId: string, suggestedFix: string) => {
    // Auto-apply certain fixes
    if (ruleId.includes('auto_balance')) {
      if (ruleId.includes('dimension')) {
        autoBalanceWeights('dimensions');
      } else if (ruleId.includes('error')) {
        autoBalanceWeights('errorTypes');
      }
    }
    
    // For other fixes, you could show a dialog or apply smart fixes
    console.log('Fix suggestion for rule:', ruleId, suggestedFix);
  }, []);

  // Handle field focus from validation
  const handleShowField = useCallback((fieldPath: string) => {
    // Navigate to appropriate tab based on field path
    if (fieldPath.includes('dimension')) {
      setActiveTab('dimensions');
    } else if (fieldPath.includes('errorType')) {
      setActiveTab('errors');
    } else if (fieldPath.includes('maxScore') || fieldPath.includes('passingThreshold')) {
      setActiveTab('scoring');
    } else {
      setActiveTab('basic');
    }
    
    // You could also scroll to the specific field or highlight it
    console.log('Navigate to field:', fieldPath);
  }, []);

  // Add new dimension
  const addDimension = useCallback(() => {
    const newDimension = {
      id: `dim_${Date.now()}`,
      name: '',
      weight: 0,
      description: '',
      subcriteria: []
    };
    setValue('dimensions', [...watchedDimensions, newDimension]);
  }, [watchedDimensions, setValue]);

  // Remove dimension
  const removeDimension = useCallback((index: number) => {
    const updatedDimensions = watchedDimensions.filter((_, i) => i !== index);
    setValue('dimensions', updatedDimensions);
  }, [watchedDimensions, setValue]);

  // Add subcriteria to dimension
  const addSubcriteria = useCallback((dimensionIndex: number) => {
    const updatedDimensions = [...watchedDimensions];
    const newSubcriteria = {
      id: `sub_${Date.now()}`,
      name: '',
      weight: 0,
      description: ''
    };
    updatedDimensions[dimensionIndex].subcriteria.push(newSubcriteria);
    setValue('dimensions', updatedDimensions);
  }, [watchedDimensions, setValue]);

  // Add error type
  const addErrorType = useCallback(() => {
    const newErrorType = {
      id: `error_${Date.now()}`,
      type: '',
      severity: 'minor' as const,
      weight: 0,
      description: ''
    };
    setValue('errorTypes', [...watchedErrorTypes, newErrorType]);
  }, [watchedErrorTypes, setValue]);

  // Remove error type
  const removeErrorType = useCallback((index: number) => {
    const updatedErrorTypes = watchedErrorTypes.filter((_, i) => i !== index);
    setValue('errorTypes', updatedErrorTypes);
  }, [watchedErrorTypes, setValue]);

  // Add tag
  const addTag = useCallback(() => {
    if (tagInput.trim() && !watchedTags.includes(tagInput.trim())) {
      setValue('tags', [...watchedTags, tagInput.trim()]);
      setTagInput('');
    }
  }, [tagInput, watchedTags, setValue]);

  // Remove tag
  const removeTag = useCallback((tagToRemove: string) => {
    setValue('tags', watchedTags.filter(tag => tag !== tagToRemove));
  }, [watchedTags, setValue]);

  // Auto-balance weights
  const autoBalanceWeights = useCallback((type: 'dimensions' | 'errorTypes') => {
    const items = type === 'dimensions' ? watchedDimensions : watchedErrorTypes;
    if (items.length === 0) return;

    const equalWeight = Math.floor(100 / items.length);
    const remainder = 100 % items.length;

    const updatedItems = items.map((item, index) => ({
      ...item,
      weight: equalWeight + (index < remainder ? 1 : 0)
    }));

    setValue(type, updatedItems);
  }, [watchedDimensions, watchedErrorTypes, setValue]);

  // Handle template load
  const handleTemplateLoad = useCallback((model: CustomScoringModel) => {
    // Reset form with template data
    form.reset({
      name: `${model.name} (Copy)`,
      description: model.description || '',
      framework: model.framework,
      version: model.version,
      maxScore: model.maxScore,
      passingThreshold: model.passingThreshold,
      isGlobal: model.isGlobal,
      tags: model.tags || [],
      scoringUnit: model.config.scoringUnit,
      unitCount: model.config.unitCount,
      wordCountBased: model.config.wordCountBased,
      segmentLevelScoring: model.config.segmentLevelScoring,
      dimensions: model.config.dimensions || [],
      errorTypes: model.config.errorTypes || []
    });
    
    // Close template manager and switch to basic tab
    setShowTemplateManager(false);
    setActiveTab('basic');
  }, [form]);

  // Calculate validation status by tab
  const getTabValidationStatus = useCallback((tabName: string) => {
    if (!validationResult) return null;
    
    const relevantViolations = validationResult.errors.concat(validationResult.warnings).filter(violation => {
      switch (tabName) {
        case 'basic':
          return violation.field && ['name', 'description', 'framework', 'version', 'tags'].some(field => 
            violation.field?.includes(field)
          );
        case 'scoring':
          return violation.field && ['maxScore', 'passingThreshold', 'scoringUnit', 'unitCount'].some(field => 
            violation.field?.includes(field)
          );
        case 'dimensions':
          return violation.field && violation.field.includes('dimension');
        case 'errors':
          return violation.field && violation.field.includes('errorType');
        default:
          return false;
      }
    });

    if (relevantViolations.some(v => v.severity === 'error')) {
      return { icon: ShieldAlert, color: 'text-red-500' };
    } else if (relevantViolations.some(v => v.severity === 'warning')) {
      return { icon: Shield, color: 'text-orange-500' };
    } else {
      return { icon: ShieldCheck, color: 'text-green-500' };
    }
  }, [validationResult]);

  const onSubmit = (data: ScoringModelFormData) => {
    onSave?.(data);
  };

  const isReadOnly = mode === 'view';

  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {mode === 'create' ? 'Create' : mode === 'edit' ? 'Edit' : 'View'} Scoring Model
          </h1>
          <p className="text-gray-600 mt-1">
            {mode === 'create' 
              ? 'Define a custom scoring model for quality assessment'
              : mode === 'edit'
              ? 'Modify the scoring model configuration'
              : 'View the scoring model details'
            }
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {!isReadOnly && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setPreviewMode(!previewMode)}
              className="flex items-center gap-2"
            >
              {previewMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {previewMode ? 'Edit Mode' : 'Preview Mode'}
            </Button>
          )}
        </div>
      </div>

      {/* Progress indicator */}
      {!isReadOnly && !previewMode && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Configuration Progress</span>
                <span>{Math.round((totalDimensionWeight + totalErrorWeight) / 2)}%</span>
              </div>
              <Progress value={(totalDimensionWeight + totalErrorWeight) / 2} className="h-2" />
              <div className="flex gap-4 text-xs text-gray-600">
                <span>Dimensions: {Math.round(totalDimensionWeight)}%</span>
                <span>Error Types: {Math.round(totalErrorWeight)}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Mode */}
      {previewMode && (
        <ModelStructureVisualization
          dimensions={watchedDimensions as ScoringModelDimension[]}
          errorTypes={watchedErrorTypes as ScoringModelErrorType[]}
          maxScore={watchedMaxScore}
          passingThreshold={watchedPassingThreshold}
          scoringUnit={watchedScoringUnit}
          unitCount={watchedUnitCount}
        />
      )}

      {/* Form Mode */}
      {!previewMode && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="basic" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Basic Info
                  {(() => {
                    const status = getTabValidationStatus('basic');
                    return status ? <status.icon className={`h-3 w-3 ${status.color}`} /> : null;
                  })()}
                </TabsTrigger>
                <TabsTrigger value="templates" className="flex items-center gap-2">
                  <BookTemplate className="h-4 w-4" />
                  Templates
                </TabsTrigger>
                <TabsTrigger value="scoring" className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Scoring Rules
                  {(() => {
                    const status = getTabValidationStatus('scoring');
                    return status ? <status.icon className={`h-3 w-3 ${status.color}`} /> : null;
                  })()}
                </TabsTrigger>
                <TabsTrigger value="dimensions" className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4" />
                  Dimensions
                  {(() => {
                    const status = getTabValidationStatus('dimensions');
                    return status ? <status.icon className={`h-3 w-3 ${status.color}`} /> : null;
                  })()}
                </TabsTrigger>
                <TabsTrigger value="errors" className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Error Types
                  {(() => {
                    const status = getTabValidationStatus('errors');
                    return status ? <status.icon className={`h-3 w-3 ${status.color}`} /> : null;
                  })()}
                </TabsTrigger>
              </TabsList>

              {/* Basic Information Tab */}
              <TabsContent value="basic" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Model Information</CardTitle>
                    <CardDescription>
                      Define the basic information and configuration for your scoring model
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Model Name *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Enter model name" 
                                {...field}
                                disabled={isReadOnly}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="framework"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Framework</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isReadOnly}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select framework" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="CUSTOM">Custom</SelectItem>
                                <SelectItem value="MQM">MQM (Multidimensional Quality Metrics)</SelectItem>
                                <SelectItem value="DQF">DQF (Dynamic Quality Framework)</SelectItem>
                                <SelectItem value="LISA_QA">LISA QA Model</SelectItem>
                                <SelectItem value="SAE_J2450">SAE J2450</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Describe the purpose and usage of this scoring model"
                              className="min-h-[100px]"
                              {...field}
                              disabled={isReadOnly}
                            />
                          </FormControl>
                          <FormDescription>
                            Provide a clear description of what this model assesses and how it should be used
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="version"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Version</FormLabel>
                            <FormControl>
                              <Input placeholder="1.0" {...field} disabled={isReadOnly} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="maxScore"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Maximum Score</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                placeholder="100"
                                {...field}
                                onChange={(e) => field.onChange(Number(e.target.value))}
                                disabled={isReadOnly}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="passingThreshold"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Passing Threshold (%)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                placeholder="85"
                                {...field}
                                onChange={(e) => field.onChange(Number(e.target.value))}
                                disabled={isReadOnly}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Tags */}
                    <div className="space-y-2">
                      <Label>Tags</Label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {watchedTags.map((tag, index) => (
                          <Badge key={index} variant="secondary" className="flex items-center gap-1">
                            {tag}
                            {!isReadOnly && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-4 w-4 p-0 hover:bg-transparent"
                                onClick={() => removeTag(tag)}
                              >
                                ×
                              </Button>
                            )}
                          </Badge>
                        ))}
                      </div>
                      {!isReadOnly && (
                        <div className="flex gap-2">
                          <Input
                            placeholder="Add tag"
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                          />
                          <Button type="button" onClick={addTag}>Add</Button>
                        </div>
                      )}
                    </div>

                    <FormField
                      control={form.control}
                      name="isGlobal"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Global Model</FormLabel>
                            <FormDescription>
                              Make this model available to all users in the organization
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              disabled={isReadOnly}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Templates Tab */}
              <TabsContent value="templates" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Templates</CardTitle>
                    <CardDescription>
                      Manage and load templates for your scoring model
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* Template management components */}
                    <TemplateManager
                      currentModel={getValidationModel() as CustomScoringModel}
                      onTemplateLoad={handleTemplateLoad}
                      publicOnly={false}
                      userId="current-user"
                      organizationId="current-org"
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Scoring Rules Tab */}
              <TabsContent value="scoring" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Scoring Configuration</CardTitle>
                    <CardDescription>
                      Define how scoring calculations should be performed
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="scoringUnit"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Scoring Unit</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isReadOnly}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="words">Per Words</SelectItem>
                                <SelectItem value="segments">Per Segments</SelectItem>
                                <SelectItem value="characters">Per Characters</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Unit for penalty calculation (e.g., errors per 100 words)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="unitCount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Unit Count</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                placeholder="100"
                                {...field}
                                onChange={(e) => field.onChange(Number(e.target.value))}
                                disabled={isReadOnly}
                              />
                            </FormControl>
                            <FormDescription>
                              Number of units for penalty calculation
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="wordCountBased"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Word Count Based Scoring</FormLabel>
                              <FormDescription>
                                Use word count for penalty normalization
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                disabled={isReadOnly}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="segmentLevelScoring"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Segment Level Scoring</FormLabel>
                              <FormDescription>
                                Calculate scores at the individual segment level
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                disabled={isReadOnly}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Dimensions Tab */}
              <TabsContent value="dimensions" className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Quality Dimensions</CardTitle>
                        <CardDescription>
                          Define the quality dimensions and their weights for assessment
                        </CardDescription>
                      </div>
                      {!isReadOnly && (
                        <Button
                          type="button"
                          onClick={addDimension}
                          size="sm"
                          className="flex items-center gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Add Dimension
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {watchedDimensions.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-500">No dimensions defined yet.</p>
                        {!isReadOnly && (
                          <Button
                            type="button"
                            onClick={addDimension}
                            className="mt-2"
                          >
                            Add First Dimension
                          </Button>
                        )}
                      </div>
                    ) : (
                      <WeightingSystem
                        items={dimensionsToWeightedItems(watchedDimensions.filter(d => d.id && d.name && typeof d.weight === 'number') as ScoringModelDimension[])}
                        onItemsChange={(items) => {
                          const updatedDimensions = weightedItemsToDimensions(items, watchedDimensions.filter(d => d.id && d.name && typeof d.weight === 'number') as ScoringModelDimension[]);
                          setValue('dimensions', updatedDimensions);
                        }}
                        title="Dimension Weights"
                        description="Drag to reorder, adjust weights, and balance dimensions"
                        allowReordering={!isReadOnly}
                        showSliders={true}
                        isReadOnly={isReadOnly}
                        className="border-0 shadow-none"
                      />
                    )}

                    {/* Dimension Details */}
                    {watchedDimensions.length > 0 && (
                      <div className="mt-6 space-y-4">
                        <Separator />
                        <h4 className="font-medium">Dimension Details</h4>
                        <ScrollArea className="h-[300px] pr-4">
                          <div className="space-y-4">
                            {watchedDimensions.map((dimension, index) => (
                              <Card key={dimension.id} className="border-dashed">
                                <CardContent className="pt-4">
                                  <div className="flex items-start gap-4">
                                    <div className="flex-1 space-y-4">
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField
                                          control={form.control}
                                          name={`dimensions.${index}.name`}
                                          render={({ field }) => (
                                            <FormItem>
                                              <FormLabel>Dimension Name</FormLabel>
                                              <FormControl>
                                                <Input 
                                                  placeholder="e.g., Accuracy" 
                                                  {...field}
                                                  disabled={isReadOnly}
                                                />
                                              </FormControl>
                                              <FormMessage />
                                            </FormItem>
                                          )}
                                        />

                                        {!isReadOnly && (
                                          <div className="flex items-end">
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              onClick={() => addSubcriteria(index)}
                                            >
                                              Add Subcriteria
                                            </Button>
                                          </div>
                                        )}
                                      </div>

                                      <FormField
                                        control={form.control}
                                        name={`dimensions.${index}.description`}
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>Description</FormLabel>
                                            <FormControl>
                                              <Textarea 
                                                placeholder="Describe what this dimension assesses"
                                                {...field}
                                                disabled={isReadOnly}
                                              />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />

                                      {/* Subcriteria */}
                                      {dimension.subcriteria.length > 0 && (
                                        <div className="pl-4 border-l-2 border-gray-200 space-y-2">
                                          <Label className="text-sm font-medium">Subcriteria ({dimension.subcriteria.length})</Label>
                                          {dimension.subcriteria.map((sub, subIndex) => (
                                            <div key={sub.id} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                              <FormField
                                                control={form.control}
                                                name={`dimensions.${index}.subcriteria.${subIndex}.name`}
                                                render={({ field }) => (
                                                  <FormItem>
                                                    <FormControl>
                                                      <Input 
                                                        placeholder="Subcriteria name" 
                                                        {...field}
                                                        disabled={isReadOnly}
                                                      />
                                                    </FormControl>
                                                    <FormMessage />
                                                  </FormItem>
                                                )}
                                              />

                                              <FormField
                                                control={form.control}
                                                name={`dimensions.${index}.subcriteria.${subIndex}.weight`}
                                                render={({ field }) => (
                                                  <FormItem>
                                                    <FormControl>
                                                      <Input 
                                                        type="number" 
                                                        placeholder="Weight"
                                                        {...field}
                                                        onChange={(e) => field.onChange(Number(e.target.value))}
                                                        disabled={isReadOnly}
                                                      />
                                                    </FormControl>
                                                    <FormMessage />
                                                  </FormItem>
                                                )}
                                              />

                                              <FormField
                                                control={form.control}
                                                name={`dimensions.${index}.subcriteria.${subIndex}.description`}
                                                render={({ field }) => (
                                                  <FormItem>
                                                    <FormControl>
                                                      <Input 
                                                        placeholder="Description" 
                                                        {...field}
                                                        disabled={isReadOnly}
                                                      />
                                                    </FormControl>
                                                    <FormMessage />
                                                  </FormItem>
                                                )}
                                              />
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>

                                    {!isReadOnly && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeDimension(index)}
                                        className="text-red-600 hover:text-red-700"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Error Types Tab */}
              <TabsContent value="errors" className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Error Types</CardTitle>
                        <CardDescription>
                          Define error types, their severity levels, and penalty weights
                        </CardDescription>
                      </div>
                      {!isReadOnly && (
                        <Button
                          type="button"
                          onClick={addErrorType}
                          size="sm"
                          className="flex items-center gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Add Error Type
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {watchedErrorTypes.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-500">No error types defined yet.</p>
                        {!isReadOnly && (
                          <Button
                            type="button"
                            onClick={addErrorType}
                            className="mt-2"
                          >
                            Add First Error Type
                          </Button>
                        )}
                      </div>
                    ) : (
                      <WeightingSystem
                        items={errorTypesToWeightedItems(watchedErrorTypes.filter(e => e.id && e.type && typeof e.weight === 'number' && e.severity) as ScoringModelErrorType[])}
                        onItemsChange={(items) => {
                          const updatedErrorTypes = weightedItemsToErrorTypes(items, watchedErrorTypes.filter(e => e.id && e.type && typeof e.weight === 'number' && e.severity) as ScoringModelErrorType[]);
                          setValue('errorTypes', updatedErrorTypes);
                        }}
                        title="Error Type Weights"
                        description="Drag to reorder, adjust penalty weights, and balance error types"
                        allowReordering={!isReadOnly}
                        showSliders={true}
                        isReadOnly={isReadOnly}
                        className="border-0 shadow-none"
                      />
                    )}

                    {/* Error Type Details */}
                    {watchedErrorTypes.length > 0 && (
                      <div className="mt-6 space-y-4">
                        <Separator />
                        <h4 className="font-medium">Error Type Details</h4>
                        <ScrollArea className="h-[300px] pr-4">
                          <div className="space-y-4">
                            {watchedErrorTypes.map((errorType, index) => (
                              <Card key={errorType.id} className="border-dashed">
                                <CardContent className="pt-4">
                                  <div className="flex items-start gap-4">
                                    <div className="flex-1 space-y-4">
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField
                                          control={form.control}
                                          name={`errorTypes.${index}.type`}
                                          render={({ field }) => (
                                            <FormItem>
                                              <FormLabel>Error Type</FormLabel>
                                              <FormControl>
                                                <Input 
                                                  placeholder="e.g., Grammar Error" 
                                                  {...field}
                                                  disabled={isReadOnly}
                                                />
                                              </FormControl>
                                              <FormMessage />
                                            </FormItem>
                                          )}
                                        />

                                        <FormField
                                          control={form.control}
                                          name={`errorTypes.${index}.severity`}
                                          render={({ field }) => (
                                            <FormItem>
                                              <FormLabel>Severity</FormLabel>
                                              <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isReadOnly}>
                                                <FormControl>
                                                  <SelectTrigger>
                                                    <SelectValue />
                                                  </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                  <SelectItem value="minor">Minor</SelectItem>
                                                  <SelectItem value="major">Major</SelectItem>
                                                  <SelectItem value="critical">Critical</SelectItem>
                                                  <SelectItem value="neutral">Neutral</SelectItem>
                                                </SelectContent>
                                              </Select>
                                              <FormMessage />
                                            </FormItem>
                                          )}
                                        />
                                      </div>

                                      <FormField
                                        control={form.control}
                                        name={`errorTypes.${index}.description`}
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>Description</FormLabel>
                                            <FormControl>
                                              <Textarea 
                                                placeholder="Describe this error type and when to apply it"
                                                {...field}
                                                disabled={isReadOnly}
                                              />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                    </div>

                                    {!isReadOnly && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeErrorType(index)}
                                        className="text-red-600 hover:text-red-700"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Actions */}
            {!isReadOnly && (
              <div className="flex items-center justify-between pt-6 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                >
                  Cancel
                </Button>

                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={isLoading || totalDimensionWeight !== 100 || totalErrorWeight !== 100}
                    className="flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {isLoading ? 'Saving...' : 'Save Model'}
                  </Button>
                </div>
              </div>
            )}

            {/* Real-time Validation Feedback */}
            {validationResult && (
              <div className="mt-6">
                <ValidationFeedback
                  validationResult={validationResult}
                  onFixSuggestion={handleFixSuggestion}
                  onShowField={handleShowField}
                  showRecommendations={true}
                  showTimingInfo={false}
                />
              </div>
            )}
          </form>
        </Form>
      )}
    </div>
  );
};

export default ModelDefinitionInterface; 