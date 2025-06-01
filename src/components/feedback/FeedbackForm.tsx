import React, { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Tooltip } from '@/components/feedback/Tooltip'
import FeedbackRating from './FeedbackRating'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { 
  FeedbackFormData, 
  FeedbackType, 
  FeedbackRating as FeedbackRatingEnum,
  CategorySuggestion,
  FeedbackTargetType,
  FeedbackSource
} from '@/lib/types/user-feedback'

import { 
  MessageSquare, 
  Star, 
  AlertTriangle, 
  CheckCircle, 
  Settings, 
  HelpCircle,
  Lightbulb,
  Flag,
  Edit3,
  Eye,
  X
} from 'lucide-react'

// Form validation schema
const feedbackFormSchema = z.object({
  feedback_type: z.nativeEnum(FeedbackType),
  rating: z.nativeEnum(FeedbackRatingEnum).optional(),
  category_suggestion: z.object({
    suggested_category: z.string().min(1, 'Category is required'),
    suggested_subcategory: z.string().optional(),
    suggested_severity: z.string().min(1, 'Severity is required'),
    reasoning: z.string().min(10, 'Please provide reasoning (minimum 10 characters)'),
    confidence: z.number().min(0).max(1),
    supporting_evidence: z.array(z.string()).optional()
  }).optional(),
  comment: z.string().optional(),
  confidence_level: z.number().min(0).max(1).default(0.8),
  is_anonymous: z.boolean().default(false)
})

type FeedbackFormValues = z.infer<typeof feedbackFormSchema>

export interface FeedbackFormProps {
  // Target information
  targetType: FeedbackTargetType
  targetId: string
  
  // Current error/categorization data
  currentCategorization?: {
    dimension: string
    category: string
    subcategory?: string
    severity: string
    source_text: string
    target_text: string
    error_description: string
  }
  
  // Callback functions
  onSubmit: (data: FeedbackFormData) => Promise<void>
  onCancel?: () => void
  
  // UI configuration
  variant?: 'modal' | 'inline' | 'sidebar'
  trigger?: React.ReactNode
  title?: string
  description?: string
  
  // Form behavior
  allowAnonymous?: boolean
  requireRating?: boolean
  showConfidenceSlider?: boolean
  prefilledType?: FeedbackType
  
  // Styling
  className?: string
}

// Available MQM categories and severities for suggestions
const mqmCategories = [
  'Accuracy',
  'Fluency', 
  'Terminology',
  'Style',
  'Locale Conventions',
  'Audience Appropriateness',
  'Design and Markup'
]

const mqmSeverities = [
  'Minor',
  'Major', 
  'Critical'
]

export const FeedbackForm: React.FC<FeedbackFormProps> = ({
  targetType,
  targetId,
  currentCategorization,
  onSubmit,
  onCancel,
  variant = 'modal',
  trigger,
  title = 'Provide Feedback',
  description = 'Help us improve error categorization accuracy',
  allowAnonymous = true,
  requireRating = false,
  showConfidenceSlider = true,
  prefilledType,
  className
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState('feedback')

  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(feedbackFormSchema),
    defaultValues: {
      feedback_type: prefilledType || FeedbackType.RATING,
      confidence_level: 0.8,
      is_anonymous: false,
      category_suggestion: currentCategorization ? {
        suggested_category: currentCategorization.category,
        suggested_subcategory: currentCategorization.subcategory || '',
        suggested_severity: currentCategorization.severity,
        reasoning: '',
        confidence: 0.8
      } : undefined
    }
  })

  const selectedFeedbackType = form.watch('feedback_type')
  const isRatingType = selectedFeedbackType === FeedbackType.RATING
  const isCategoryCorrection = selectedFeedbackType === FeedbackType.CATEGORY_CORRECTION || 
                               selectedFeedbackType === FeedbackType.SEVERITY_CORRECTION

  const handleSubmit = async (data: FeedbackFormValues) => {
    setIsSubmitting(true)
    try {
      await onSubmit(data as FeedbackFormData)
      setIsOpen(false)
      form.reset()
    } catch (error) {
      console.error('Error submitting feedback:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    setIsOpen(false)
    form.reset()
    onCancel?.()
  }

  const renderCurrentCategorizationInfo = () => {
    if (!currentCategorization) return null
    
    return (
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Current Categorization</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="font-medium">Dimension:</span>
              <Badge variant="outline" className="ml-2">
                {currentCategorization.dimension}
              </Badge>
            </div>
            <div>
              <span className="font-medium">Severity:</span>
              <Badge 
                variant={
                  currentCategorization.severity === 'Critical' ? 'destructive' :
                  currentCategorization.severity === 'Major' ? 'secondary' : 'secondary'
                }
                className="ml-2"
              >
                {currentCategorization.severity}
              </Badge>
            </div>
          </div>
          <div className="text-xs">
            <span className="font-medium">Category:</span>{' '}
            {currentCategorization.category}
            {currentCategorization.subcategory && ` > ${currentCategorization.subcategory}`}
          </div>
          <div className="text-xs bg-muted p-2 rounded">
            <div className="font-medium mb-1">Error Text:</div>
            <div className="italic">"{currentCategorization.target_text}"</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderFeedbackTypeSelection = () => (
    <FormField
      control={form.control}
      name="feedback_type"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Feedback Type</FormLabel>
          <FormControl>
            <RadioGroup
              onValueChange={field.onChange}
              value={field.value}
              className="grid grid-cols-1 gap-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value={FeedbackType.RATING} id="rating" />
                <Label htmlFor="rating" className="flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  Quick Rating
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value={FeedbackType.CATEGORY_CORRECTION} id="category" />
                <Label htmlFor="category" className="flex items-center gap-2">
                  <Edit3 className="h-4 w-4" />
                  Suggest Category Change
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value={FeedbackType.SEVERITY_CORRECTION} id="severity" />
                <Label htmlFor="severity" className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Suggest Severity Change
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value={FeedbackType.SUGGESTION} id="suggestion" />
                <Label htmlFor="suggestion" className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" />
                  General Suggestion
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value={FeedbackType.COMPLAINT} id="complaint" />
                <Label htmlFor="complaint" className="flex items-center gap-2">
                  <Flag className="h-4 w-4" />
                  Report Issue
                </Label>
              </div>
            </RadioGroup>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )

  const renderRatingSection = () => {
    if (!isRatingType && !requireRating) return null
    
    return (
      <FormField
        control={form.control}
        name="rating"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              {isRatingType ? 'Rate this categorization' : 'Overall Rating'} 
              {requireRating && <span className="text-red-500">*</span>}
            </FormLabel>
            <FormControl>
              <FeedbackRating
                value={field.value}
                onChange={field.onChange}
                variant="stars"
                size="md"
                showLabels
              />
            </FormControl>
            <FormDescription>
              Rate the accuracy and helpfulness of this error categorization
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    )
  }

  const renderCategorySuggestion = () => {
    if (!isCategoryCorrection) return null
    
    return (
      <div className="space-y-4">
        <FormField
          control={form.control}
          name="category_suggestion.suggested_category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Suggested Category</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {mqmCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="category_suggestion.suggested_subcategory"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Suggested Subcategory (Optional)</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., Addition, Omission, Mistranslation"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="category_suggestion.suggested_severity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Suggested Severity</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select severity" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {mqmSeverities.map((severity) => (
                    <SelectItem key={severity} value={severity}>
                      {severity}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="category_suggestion.reasoning"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reasoning</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Explain why you think this categorization should be changed..."
                  className="min-h-[80px]"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Please provide detailed reasoning for your suggestion
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {showConfidenceSlider && (
          <FormField
            control={form.control}
            name="category_suggestion.confidence"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  Confidence Level
                  <Tooltip content="How confident are you in this suggestion?">
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </Tooltip>
                </FormLabel>
                <FormControl>
                  <div className="space-y-2">
                    <Slider
                      min={0}
                      max={1}
                      step={0.1}
                      value={[field.value || 0.8]}
                      onValueChange={(values) => field.onChange(values[0])}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Low</span>
                      <span>{Math.round((field.value || 0.8) * 100)}%</span>
                      <span>High</span>
                    </div>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </div>
    )
  }

  const renderCommentSection = () => (
    <FormField
      control={form.control}
      name="comment"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Additional Comments</FormLabel>
          <FormControl>
            <Textarea
              placeholder="Share any additional thoughts or context..."
              className="min-h-[100px]"
              {...field}
            />
          </FormControl>
          <FormDescription>
            Optional: Provide any additional context or suggestions
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  )

  const renderFormOptions = () => (
    <div className="space-y-4">
      {showConfidenceSlider && !isCategoryCorrection && (
        <FormField
          control={form.control}
          name="confidence_level"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                Confidence in Feedback
                <Tooltip content="How confident are you in the accuracy of your feedback?">
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </Tooltip>
              </FormLabel>
              <FormControl>
                <div className="space-y-2">
                  <Slider
                    min={0}
                    max={1}
                    step={0.1}
                    value={[field.value]}
                    onValueChange={(values) => field.onChange(values[0])}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Low</span>
                    <span>{Math.round(field.value * 100)}%</span>
                    <span>High</span>
                  </div>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {allowAnonymous && (
        <FormField
          control={form.control}
          name="is_anonymous"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Anonymous Feedback</FormLabel>
                <FormDescription className="text-sm">
                  Submit this feedback without associating it with your account
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />
      )}
    </div>
  )

  const formContent = (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {renderCurrentCategorizationInfo()}
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="feedback">Feedback</TabsTrigger>
            <TabsTrigger value="options">Options</TabsTrigger>
          </TabsList>
          
          <TabsContent value="feedback" className="space-y-4">
            {renderFeedbackTypeSelection()}
            {renderRatingSection()}
            {renderCategorySuggestion()}
            {renderCommentSection()}
          </TabsContent>
          
          <TabsContent value="options" className="space-y-4">
            {renderFormOptions()}
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
          </Button>
        </div>
      </form>
    </Form>
  )

  if (variant === 'modal') {
    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="outline" size="sm">
              <MessageSquare className="h-4 w-4 mr-2" />
              Feedback
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {formContent}
        </DialogContent>
      </Dialog>
    )
  }

  if (variant === 'inline') {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          {formContent}
        </CardContent>
      </Card>
    )
  }

  // Sidebar variant
  return (
    <div className={cn('space-y-4', className)}>
      <div>
        <h3 className="text-lg font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {formContent}
    </div>
  )
}

export default FeedbackForm 