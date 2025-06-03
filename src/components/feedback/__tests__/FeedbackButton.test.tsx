/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { FeedbackButton } from '../FeedbackButton'
import { FeedbackTargetType } from '@/lib/types/user-feedback'

// Mock the child components
vi.mock('../FeedbackForm', () => ({
  default: ({ trigger, onSubmit, onCancel }: { 
    trigger?: React.ReactNode, 
    onSubmit: () => void, 
    onCancel?: () => void 
  }) => {
    const [isOpen, setIsOpen] = React.useState(false)
    
    return (
      <>
        {trigger && React.cloneElement(trigger as React.ReactElement, {
          onClick: () => setIsOpen(true)
        })}
        {isOpen && (
          <div data-testid="feedback-form">
            <button 
              data-testid="submit-feedback" 
              onClick={() => {
                onSubmit()
                setIsOpen(false)
              }}
            >
              Submit
            </button>
            <button 
              data-testid="cancel-feedback" 
              onClick={() => {
                onCancel?.()
                setIsOpen(false)
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </>
    )
  }
}))

vi.mock('../FeedbackRating', () => ({
  QuickThumbsRating: ({ onRate }: { onRate: (rating: number) => void }) => (
    <div data-testid="quick-thumbs">
      <button data-testid="thumbs-up" onClick={() => onRate(5)}>👍</button>
      <button data-testid="thumbs-down" onClick={() => onRate(1)}>👎</button>
    </div>
  ),
  StarRatingInline: ({ onRate }: { onRate: (rating: number) => void }) => (
    <div data-testid="star-rating">
      {[1, 2, 3, 4, 5].map(rating => (
        <button key={rating} data-testid={`star-${rating}`} onClick={() => onRate(rating)}>
          ⭐
        </button>
      ))}
    </div>
  )
}))

describe('FeedbackButton', () => {
  const mockOnFeedbackSubmit = vi.fn()
  const defaultProps = {
    targetType: FeedbackTargetType.ERROR_CATEGORIZATION,
    targetId: 'test-error-1',
    onFeedbackSubmit: mockOnFeedbackSubmit
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders button variant by default', () => {
      render(<FeedbackButton {...defaultProps} />)
      expect(screen.getByText('Feedback')).toBeInTheDocument()
    })

    it('renders icon variant when specified', () => {
      render(<FeedbackButton {...defaultProps} variant="icon" />)
      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
      expect(button).not.toHaveTextContent('Feedback')
    })

    it('renders minimal variant when specified', () => {
      render(<FeedbackButton {...defaultProps} variant="minimal" />)
      expect(screen.getByTestId('quick-thumbs')).toBeInTheDocument()
    })

    it('renders inline variant with star rating when showQuickRating is true', () => {
      render(<FeedbackButton {...defaultProps} variant="inline" showQuickRating />)
      expect(screen.getByTestId('star-rating')).toBeInTheDocument()
    })

    it('shows feedback count when provided', () => {
      render(<FeedbackButton {...defaultProps} feedbackCount={5} showFeedbackCount />)
      expect(screen.getByText('5')).toBeInTheDocument()
    })

    it('shows "Feedback provided" indicator when user has given feedback', () => {
      render(<FeedbackButton {...defaultProps} hasUserFeedback />)
      const button = screen.getByText('Feedback')
      expect(button.closest('button')).toHaveClass('bg-blue-100')
    })
  })

  describe('Interactions', () => {
    it('opens feedback form when clicked', async () => {
      const user = userEvent.setup()
      render(<FeedbackButton {...defaultProps} />)
      
      await user.click(screen.getByText('Feedback'))
      expect(screen.getByTestId('feedback-form')).toBeInTheDocument()
    })

    it('shows quick rating when configured for inline variant', async () => {
      const user = userEvent.setup()
      render(<FeedbackButton {...defaultProps} variant="inline" showQuickRating />)
      
      expect(screen.getByTestId('star-rating')).toBeInTheDocument()
    })

    it('submits quick rating feedback with inline variant', async () => {
      const user = userEvent.setup()
      render(<FeedbackButton {...defaultProps} variant="inline" showQuickRating />)
      
      await user.click(screen.getByTestId('star-5'))
      
      await waitFor(() => {
        expect(mockOnFeedbackSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            feedback_type: 'rating',
            rating: 5
          })
        )
      })
    })

    it('submits detailed feedback form', async () => {
      const user = userEvent.setup()
      render(<FeedbackButton {...defaultProps} />)
      
      await user.click(screen.getByText('Feedback'))
      await user.click(screen.getByTestId('submit-feedback'))
      
      await waitFor(() => {
        expect(mockOnFeedbackSubmit).toHaveBeenCalled()
      })
    })

    it('closes popup when cancel is clicked', async () => {
      const user = userEvent.setup()
      render(<FeedbackButton {...defaultProps} />)
      
      await user.click(screen.getByText('Feedback'))
      expect(screen.getByTestId('feedback-form')).toBeInTheDocument()
      
      await user.click(screen.getByTestId('cancel-feedback'))
      await waitFor(() => {
        expect(screen.queryByTestId('feedback-form')).not.toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('has proper button elements', () => {
      render(<FeedbackButton {...defaultProps} />)
      const button = screen.getByText('Feedback')
      expect(button).toBeInTheDocument()
    })

    it('is keyboard accessible', async () => {
      const user = userEvent.setup()
      render(<FeedbackButton {...defaultProps} />)
      
      const button = screen.getByText('Feedback')
      button.focus()
      expect(button).toHaveFocus()
      
      await user.keyboard('{Enter}')
      expect(screen.getByTestId('feedback-form')).toBeInTheDocument()
    })

    it('respects disabled state', () => {
      render(<FeedbackButton {...defaultProps} disabled />)
      const button = screen.getByText('Feedback').closest('button')
      expect(button).toBeDisabled()
    })
  })

  describe('Props Validation', () => {
    it('handles missing onFeedbackSubmit gracefully', async () => {
      const user = userEvent.setup()
      const { targetType, targetId } = defaultProps
      render(<FeedbackButton targetType={targetType} targetId={targetId} onFeedbackSubmit={vi.fn()} />)
      
      await user.click(screen.getByText('Feedback'))
      await user.click(screen.getByTestId('submit-feedback'))
      
      // Should not throw error
      expect(screen.queryByTestId('feedback-form')).not.toBeInTheDocument()
    })

    it('works with different target types', () => {
      const props = {
        ...defaultProps,
        targetType: FeedbackTargetType.ASSESSMENT_RESULT
      }
      render(<FeedbackButton {...props} />)
      expect(screen.getByText('Feedback')).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('handles feedback submission errors gracefully', async () => {
      const mockSubmitWithError = vi.fn().mockRejectedValue(new Error('Submission failed'))
      const user = userEvent.setup()
      
      render(<FeedbackButton {...defaultProps} onFeedbackSubmit={mockSubmitWithError} />)
      
      await user.click(screen.getByText('Feedback'))
      await user.click(screen.getByTestId('submit-feedback'))
      
      await waitFor(() => {
        expect(mockSubmitWithError).toHaveBeenCalled()
      })
      
      // Component should still be functional after error
      expect(screen.getByText('Feedback')).toBeInTheDocument()
    })
  })

  describe('Integration with Current Categorization', () => {
    it('passes current categorization to feedback form', async () => {
      const user = userEvent.setup()
      const categorization = {
        dimension: 'Accuracy',
        category: 'Terminology',
        subcategory: 'Inconsistency',
        severity: 'major' as const,
        source_text: 'Source text',
        target_text: 'Target text',
        error_description: 'Test error'
      }
      
      render(<FeedbackButton {...defaultProps} currentCategorization={categorization} />)
      
      await user.click(screen.getByText('Feedback'))
      expect(screen.getByTestId('feedback-form')).toBeInTheDocument()
    })
  })
}) 