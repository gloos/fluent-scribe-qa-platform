import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { 
  MessageSquare, 
  ThumbsUp, 
  ThumbsDown, 
  Star, 
  Flag, 
  MoreVertical,
  CheckCircle
} from 'lucide-react'

import FeedbackForm from './FeedbackForm'
import { QuickThumbsRating, StarRatingInline } from './FeedbackRating'
import { 
  FeedbackTargetType, 
  FeedbackType, 
  FeedbackFormData,
  FeedbackRating as FeedbackRatingEnum
} from '@/lib/types/user-feedback'

export interface FeedbackButtonProps {
  // Target information
  targetType: FeedbackTargetType
  targetId: string
  
  // Current error/categorization data for context
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
  onFeedbackSubmit: (feedback: FeedbackFormData) => Promise<void>
  
  // Display options
  variant?: 'button' | 'icon' | 'dropdown' | 'inline' | 'minimal'
  size?: 'sm' | 'md' | 'lg'
  showQuickRating?: boolean
  showFeedbackCount?: boolean
  
  // Current feedback stats (if available)
  currentRating?: FeedbackRatingEnum
  feedbackCount?: number
  hasUserFeedback?: boolean
  
  // Styling
  className?: string
  disabled?: boolean
}

export const FeedbackButton: React.FC<FeedbackButtonProps> = ({
  targetType,
  targetId,
  currentCategorization,
  onFeedbackSubmit,
  variant = 'button',
  size = 'sm',
  showQuickRating = false,
  showFeedbackCount = false,
  currentRating,
  feedbackCount = 0,
  hasUserFeedback = false,
  className,
  disabled = false
}) => {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)
  const [showFullForm, setShowFullForm] = useState(false)

  const handleQuickFeedback = async (rating: FeedbackRatingEnum) => {
    try {
      await onFeedbackSubmit({
        feedback_type: FeedbackType.RATING,
        rating,
        confidence_level: 0.8,
        is_anonymous: false
      })
    } catch (error) {
      console.error('Error submitting quick feedback:', error)
    }
  }

  const handleDetailedFeedback = (type: FeedbackType) => {
    setShowFullForm(true)
    setIsPopoverOpen(false)
  }

  const buttonSizeClass = {
    sm: 'h-7 px-2 text-xs',
    md: 'h-8 px-3 text-sm',
    lg: 'h-9 px-4 text-sm'
  }

  const iconSizeClass = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4', 
    lg: 'h-5 w-5'
  }

  // Convert our size to valid Button size
  const getButtonSize = (size: 'sm' | 'md' | 'lg'): 'sm' | 'lg' | 'default' => {
    if (size === 'lg') return 'lg'
    if (size === 'sm') return 'sm'
    return 'default' // for 'md' size
  }

  if (variant === 'minimal') {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        {showQuickRating ? (
          <StarRatingInline
            onRate={handleQuickFeedback}
            currentRating={currentRating}
            disabled={disabled}
          />
        ) : (
          <QuickThumbsRating
            onRate={handleQuickFeedback}
            disabled={disabled}
          />
        )}
        
        {showFeedbackCount && feedbackCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            {feedbackCount}
          </Badge>
        )}
      </div>
    )
  }

  if (variant === 'icon') {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={disabled}
              className={cn(
                'h-auto p-1',
                hasUserFeedback && 'text-blue-600'
              )}
            >
              <MessageSquare className={iconSizeClass[size]} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <div className="p-3 space-y-3">
              <div className="font-medium text-sm">Quick Feedback</div>
              
              {showQuickRating ? (
                <StarRatingInline
                  onRate={handleQuickFeedback}
                  currentRating={currentRating}
                  disabled={disabled}
                />
              ) : (
                <QuickThumbsRating
                  onRate={handleQuickFeedback}
                  disabled={disabled}
                />
              )}
              
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDetailedFeedback(FeedbackType.CATEGORY_CORRECTION)}
                  className="flex-1"
                >
                  Suggest Change
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDetailedFeedback(FeedbackType.SUGGESTION)}
                  className="flex-1"
                >
                  Comment
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
        
        {showFeedbackCount && feedbackCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            {feedbackCount}
          </Badge>
        )}
        
        {hasUserFeedback && (
          <CheckCircle className="h-3 w-3 text-green-600" />
        )}
      </div>
    )
  }

  if (variant === 'dropdown') {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={disabled}
              className={cn(
                buttonSizeClass[size],
                hasUserFeedback && 'text-blue-600'
              )}
            >
              <MoreVertical className={iconSizeClass[size]} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleQuickFeedback(FeedbackRatingEnum.GOOD)}>
              <ThumbsUp className="h-4 w-4 mr-2" />
              Good categorization
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleQuickFeedback(FeedbackRatingEnum.POOR)}>
              <ThumbsDown className="h-4 w-4 mr-2" />
              Poor categorization
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleDetailedFeedback(FeedbackType.CATEGORY_CORRECTION)}>
              <Star className="h-4 w-4 mr-2" />
              Suggest different category
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDetailedFeedback(FeedbackType.SUGGESTION)}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Add comment
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDetailedFeedback(FeedbackType.COMPLAINT)}>
              <Flag className="h-4 w-4 mr-2" />
              Report issue
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        {showFeedbackCount && feedbackCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            {feedbackCount}
          </Badge>
        )}
      </div>
    )
  }

  if (variant === 'inline') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {showQuickRating ? (
          <StarRatingInline
            onRate={handleQuickFeedback}
            currentRating={currentRating}
            disabled={disabled}
          />
        ) : (
          <QuickThumbsRating
            onRate={handleQuickFeedback}
            disabled={disabled}
          />
        )}
        
        <FeedbackForm
          targetType={targetType}
          targetId={targetId}
          currentCategorization={currentCategorization}
          onSubmit={onFeedbackSubmit}
          variant="modal"
          trigger={
            <Button variant="outline" size="sm" disabled={disabled}>
              <MessageSquare className="h-4 w-4 mr-1" />
              More feedback
            </Button>
          }
        />
        
        {showFeedbackCount && feedbackCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            {feedbackCount} feedback{feedbackCount !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>
    )
  }

  // Default button variant
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <FeedbackForm
        targetType={targetType}
        targetId={targetId}
        currentCategorization={currentCategorization}
        onSubmit={onFeedbackSubmit}
        variant="modal"
        trigger={
          <Button
            variant={hasUserFeedback ? "default" : "outline"}
            size={getButtonSize(size)}
            disabled={disabled}
            className={cn(
              buttonSizeClass[size],
              hasUserFeedback && 'bg-blue-100 text-blue-700 border-blue-200'
            )}
          >
            <MessageSquare className={cn(iconSizeClass[size], 'mr-1')} />
            Feedback
            {hasUserFeedback && (
              <CheckCircle className="h-3 w-3 ml-1" />
            )}
          </Button>
        }
      />
      
      {showFeedbackCount && feedbackCount > 0 && (
        <Badge variant="secondary" className="text-xs">
          {feedbackCount}
        </Badge>
      )}
    </div>
  )
}

// Convenience components for specific use cases
export interface ErrorFeedbackButtonProps {
  errorId: string
  errorData: {
    dimension: string
    category: string
    subcategory?: string
    severity: string
    source_text: string
    target_text: string
    error_description: string
  }
  onFeedbackSubmit: (feedback: FeedbackFormData) => Promise<void>
  className?: string
  variant?: 'button' | 'icon' | 'minimal'
  currentRating?: FeedbackRatingEnum
  feedbackCount?: number
  hasUserFeedback?: boolean
}

export const ErrorFeedbackButton: React.FC<ErrorFeedbackButtonProps> = ({
  errorId,
  errorData,
  onFeedbackSubmit,
  className,
  variant = 'icon',
  currentRating,
  feedbackCount,
  hasUserFeedback
}) => {
  return (
    <FeedbackButton
      targetType={FeedbackTargetType.ERROR_CATEGORIZATION}
      targetId={errorId}
      currentCategorization={errorData}
      onFeedbackSubmit={onFeedbackSubmit}
      variant={variant}
      size="sm"
      showQuickRating={variant === 'minimal'}
      showFeedbackCount={!!feedbackCount}
      currentRating={currentRating}
      feedbackCount={feedbackCount}
      hasUserFeedback={hasUserFeedback}
      className={className}
    />
  )
}

export interface AssessmentFeedbackButtonProps {
  assessmentId: string
  onFeedbackSubmit: (feedback: FeedbackFormData) => Promise<void>
  className?: string
  variant?: 'button' | 'icon' | 'inline'
  currentRating?: FeedbackRatingEnum
  feedbackCount?: number
  hasUserFeedback?: boolean
}

export const AssessmentFeedbackButton: React.FC<AssessmentFeedbackButtonProps> = ({
  assessmentId,
  onFeedbackSubmit,
  className,
  variant = 'button',
  currentRating,
  feedbackCount,
  hasUserFeedback
}) => {
  return (
    <FeedbackButton
      targetType={FeedbackTargetType.ASSESSMENT_RESULT}
      targetId={assessmentId}
      onFeedbackSubmit={onFeedbackSubmit}
      variant={variant}
      size="sm"
      showQuickRating={true}
      showFeedbackCount={!!feedbackCount}
      currentRating={currentRating}
      feedbackCount={feedbackCount}
      hasUserFeedback={hasUserFeedback}
      className={className}
    />
  )
}

export default FeedbackButton 