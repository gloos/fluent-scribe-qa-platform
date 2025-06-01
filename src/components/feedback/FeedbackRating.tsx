import React, { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/feedback/Tooltip'
import { Star, ThumbsUp, ThumbsDown, Meh, Smile, Frown } from 'lucide-react'
import { FeedbackRating as FeedbackRatingEnum, FeedbackSource } from '@/lib/types/user-feedback'

export interface FeedbackRatingProps {
  value?: FeedbackRatingEnum
  onChange?: (rating: FeedbackRatingEnum) => void
  onSubmit?: (rating: FeedbackRatingEnum, source: FeedbackSource) => void
  
  // Display options
  variant?: 'stars' | 'thumbs' | 'faces' | 'numbers'
  size?: 'sm' | 'md' | 'lg'
  showLabels?: boolean
  showSubmitButton?: boolean
  allowClear?: boolean
  disabled?: boolean
  
  // Interaction behavior
  autoSubmit?: boolean // Submit immediately on selection
  requireConfirmation?: boolean
  
  // Styling
  className?: string
  activeColor?: string
  inactiveColor?: string
  
  // Context
  targetId?: string
  targetType?: string
  currentRating?: FeedbackRatingEnum
}

const ratingLabels = {
  [FeedbackRatingEnum.VERY_POOR]: 'Very Poor',
  [FeedbackRatingEnum.POOR]: 'Poor', 
  [FeedbackRatingEnum.FAIR]: 'Fair',
  [FeedbackRatingEnum.GOOD]: 'Good',
  [FeedbackRatingEnum.EXCELLENT]: 'Excellent'
}

const ratingIcons = {
  stars: [Star, Star, Star, Star, Star],
  thumbs: [ThumbsDown, ThumbsDown, Meh, ThumbsUp, ThumbsUp],
  faces: [Frown, Frown, Meh, Smile, Smile],
  numbers: ['1', '2', '3', '4', '5']
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5', 
  lg: 'h-6 w-6'
}

export const FeedbackRating: React.FC<FeedbackRatingProps> = ({
  value,
  onChange,
  onSubmit,
  variant = 'stars',
  size = 'md',
  showLabels = false,
  showSubmitButton = false,
  allowClear = true,
  disabled = false,
  autoSubmit = false,
  requireConfirmation = false,
  className,
  activeColor = 'text-yellow-400 fill-yellow-400',
  inactiveColor = 'text-gray-300',
  targetId,
  targetType,
  currentRating
}) => {
  const [hoverValue, setHoverValue] = useState<FeedbackRatingEnum | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasInteracted, setHasInteracted] = useState(false)

  const handleRatingClick = useCallback(async (rating: FeedbackRatingEnum) => {
    if (disabled) return
    
    setHasInteracted(true)
    onChange?.(rating)
    
    if (autoSubmit && onSubmit) {
      setIsSubmitting(true)
      try {
        await onSubmit(rating, FeedbackSource.QUICK_RATING)
      } finally {
        setIsSubmitting(false)
      }
    }
  }, [disabled, onChange, autoSubmit, onSubmit])

  const handleSubmit = useCallback(async () => {
    if (!value || !onSubmit) return
    
    setIsSubmitting(true)
    try {
      await onSubmit(value, FeedbackSource.GUIDED_FEEDBACK)
    } finally {
      setIsSubmitting(false)
    }
  }, [value, onSubmit])

  const handleClear = useCallback(() => {
    if (!allowClear || disabled) return
    onChange?.(undefined as any)
    setHasInteracted(false)
  }, [allowClear, disabled, onChange])

  const renderRatingItem = (rating: FeedbackRatingEnum, index: number) => {
    const isActive = value ? rating <= value : false
    const isHovered = hoverValue ? rating <= hoverValue : false
    const isInteractive = !disabled && !isSubmitting
    
    let IconComponent: any
    let iconContent: React.ReactNode
    
    if (variant === 'numbers') {
      iconContent = rating.toString()
    } else {
      IconComponent = ratingIcons[variant][index]
      iconContent = <IconComponent className={sizeClasses[size]} />
    }
    
    const itemContent = (
      <button
        type="button"
        onClick={() => handleRatingClick(rating)}
        onMouseEnter={() => isInteractive && setHoverValue(rating)}
        onMouseLeave={() => isInteractive && setHoverValue(null)}
        disabled={disabled || isSubmitting}
        className={cn(
          'transition-all duration-150 ease-in-out',
          'hover:scale-110 active:scale-95',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded',
          isInteractive ? 'cursor-pointer' : 'cursor-default',
          variant === 'numbers' && 'flex items-center justify-center font-medium min-w-[2rem] h-8',
          (isActive || isHovered) ? activeColor : inactiveColor,
          disabled && 'opacity-50'
        )}
        aria-label={`Rate ${ratingLabels[rating]}`}
      >
        {iconContent}
      </button>
    )

    if (showLabels) {
      return (
        <Tooltip
          key={rating}
          content={ratingLabels[rating]}
          position="top"
        >
          {itemContent}
        </Tooltip>
      )
    }

    return <React.Fragment key={rating}>{itemContent}</React.Fragment>
  }

  const showCurrentRatingInfo = currentRating && currentRating !== value && hasInteracted
  
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* Current rating display */}
      {showCurrentRatingInfo && (
        <div className="text-xs text-muted-foreground">
          Current: {ratingLabels[currentRating]} → {value ? ratingLabels[value] : 'None'}
        </div>
      )}
      
      {/* Rating input */}
      <div className="flex items-center gap-1">
        {Object.values(FeedbackRatingEnum)
          .filter((rating): rating is FeedbackRatingEnum => typeof rating === 'number')
          .map((rating, index) => renderRatingItem(rating, index))
        }
        
        {/* Clear button */}
        {allowClear && value && !autoSubmit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={disabled || isSubmitting}
            className="ml-2 h-auto p-1 text-xs"
          >
            Clear
          </Button>
        )}
      </div>
      
      {/* Labels display */}
      {showLabels && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{ratingLabels[FeedbackRatingEnum.VERY_POOR]}</span>
          <span>{ratingLabels[FeedbackRatingEnum.EXCELLENT]}</span>
        </div>
      )}
      
      {/* Submit button */}
      {showSubmitButton && !autoSubmit && (
        <Button
          onClick={handleSubmit}
          disabled={!value || disabled || isSubmitting}
          size="sm"
          className="self-start"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Rating'}
        </Button>
      )}
      
      {/* Confirmation message */}
      {autoSubmit && hasInteracted && !isSubmitting && (
        <div className="text-xs text-green-600">
          ✓ Rating submitted
        </div>
      )}
    </div>
  )
}

// Quick rating components for different use cases
export interface QuickRatingProps {
  onRate: (rating: FeedbackRatingEnum) => void
  className?: string
  disabled?: boolean
}

export const QuickThumbsRating: React.FC<QuickRatingProps> = ({ 
  onRate, 
  className, 
  disabled 
}) => {
  const [submitted, setSubmitted] = useState(false)
  
  const handleRate = (rating: FeedbackRatingEnum) => {
    onRate(rating)
    setSubmitted(true)
    setTimeout(() => setSubmitted(false), 2000)
  }
  
  if (submitted) {
    return (
      <div className={cn('flex items-center gap-1 text-green-600 text-sm', className)}>
        <Star className="h-4 w-4 fill-current" />
        Thanks for your feedback!
      </div>
    )
  }
  
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="text-sm text-muted-foreground">How was this categorization?</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleRate(FeedbackRatingEnum.POOR)}
        disabled={disabled}
        className="hover:bg-red-50 hover:text-red-600"
      >
        <ThumbsDown className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleRate(FeedbackRatingEnum.GOOD)}
        disabled={disabled}
        className="hover:bg-green-50 hover:text-green-600"
      >
        <ThumbsUp className="h-4 w-4" />
      </Button>
    </div>
  )
}

export const StarRatingInline: React.FC<QuickRatingProps & { 
  currentRating?: FeedbackRatingEnum 
}> = ({ 
  onRate, 
  className, 
  disabled,
  currentRating 
}) => {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="text-sm text-muted-foreground">Rate this:</span>
      <FeedbackRating
        variant="stars"
        size="sm"
        autoSubmit
        onSubmit={async (rating) => onRate(rating)}
        disabled={disabled}
        currentRating={currentRating}
      />
    </div>
  )
}

export default FeedbackRating 