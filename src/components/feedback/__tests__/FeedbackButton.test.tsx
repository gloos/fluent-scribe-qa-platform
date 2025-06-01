/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FeedbackButton } from '../FeedbackButton'
import { FeedbackTargetType, FeedbackType } from '@/lib/types/user-feedback'

// Mock the feedback form component
vi.mock('../FeedbackForm', () => ({
  default: ({ onSubmit, onCancel }: any) => (
    <div data-testid="feedback-form">
      <button data-testid="submit-feedback" onClick={() => onSubmit({
        feedback_type: 'detailed_form',
        rating: 4,
        comment: 'Test feedback'
      })}>
        Submit
      </button>
      <button data-testid="cancel-feedback" onClick={onCancel}>
        Cancel
      </button>
    </div>
  )
}))

// Mock the rating components
vi.mock('../FeedbackRating', () => ({
  QuickThumbsRating: ({ onSubmit }: any) => (
    <div data-testid="quick-thumbs">
      <button data-testid="thumbs-up" onClick={() => onSubmit(5)}>👍</button>
      <button data-testid="thumbs-down" onClick={() => onSubmit(2)}>👎</button>
    </div>
  ),
  StarRatingInline: ({ onSubmit }: any) => (
    <div data-testid="star-rating">
      <button data-testid="star-5" onClick={() => onSubmit(5)}>⭐⭐⭐⭐⭐</button>
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
      expect(screen.getByRole('button')).toBeInTheDocument()
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
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('shows feedback count when provided', () => {
      render(<FeedbackButton {...defaultProps} feedbackCount={5} showFeedbackCount />)
      expect(screen.getByText('5')).toBeInTheDocument()
    })

    it('shows "Feedback provided" indicator when user has given feedback', () => {
      render(<FeedbackButton {...defaultProps} hasUserFeedback />)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('text-blue-600')
    })
  })

  describe('Interactions', () => {
    it('opens feedback form when clicked', async () => {
      const user = userEvent.setup()
      render(<FeedbackButton {...defaultProps} />)
      
      await user.click(screen.getByRole('button'))
      expect(screen.getByTestId('feedback-form')).toBeInTheDocument()
    })

    it('shows quick rating when configured', async () => {
      const user = userEvent.setup()
      render(<FeedbackButton {...defaultProps} showQuickRating />)
      
      await user.click(screen.getByRole('button'))
      expect(screen.getByTestId('quick-thumbs')).toBeInTheDocument()
    })

    it('submits quick rating feedback', async () => {
      const user = userEvent.setup()
      render(<FeedbackButton {...defaultProps} showQuickRating />)
      
      await user.click(screen.getByRole('button'))
      await user.click(screen.getByTestId('thumbs-up'))
      
      await waitFor(() => {
        expect(mockOnFeedbackSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            feedback_type: 'quick_rating',
            rating: 5
          })
        )
      })
    })

    it('submits detailed feedback form', async () => {
      const user = userEvent.setup()
      render(<FeedbackButton {...defaultProps} />)
      
      await user.click(screen.getByRole('button'))
      await user.click(screen.getByTestId('submit-feedback'))
      
      await waitFor(() => {
        expect(mockOnFeedbackSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            feedback_type: 'detailed_form',
            rating: 4,
            comment: 'Test feedback'
          })
        )
      })
    })

    it('closes popup when cancel is clicked', async () => {
      const user = userEvent.setup()
      render(<FeedbackButton {...defaultProps} />)
      
      await user.click(screen.getByRole('button'))
      expect(screen.getByTestId('feedback-form')).toBeInTheDocument()
      
      await user.click(screen.getByTestId('cancel-feedback'))
      await waitFor(() => {
        expect(screen.queryByTestId('feedback-form')).not.toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<FeedbackButton {...defaultProps} />)
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-label', expect.stringContaining('feedback'))
    })

    it('is keyboard accessible', async () => {
      const user = userEvent.setup()
      render(<FeedbackButton {...defaultProps} />)
      
      const button = screen.getByRole('button')
      button.focus()
      expect(button).toHaveFocus()
      
      await user.keyboard('{Enter}')
      expect(screen.getByTestId('feedback-form')).toBeInTheDocument()
    })

    it('respects disabled state', () => {
      render(<FeedbackButton {...defaultProps} disabled />)
      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
    })
  })

  describe('Props Validation', () => {
    it('handles missing onFeedbackSubmit gracefully', async () => {
      const user = userEvent.setup()
      const { targetType, targetId } = defaultProps
      render(<FeedbackButton targetType={targetType} targetId={targetId} onFeedbackSubmit={vi.fn()} />)
      
      await user.click(screen.getByRole('button'))
      await user.click(screen.getByTestId('submit-feedback'))
      
      // Should not throw error
      expect(screen.getByTestId('feedback-form')).toBeInTheDocument()
    })

    it('works with different target types', () => {
      const props = {
        ...defaultProps,
        targetType: FeedbackTargetType.ASSESSMENT_RESULT
      }
      render(<FeedbackButton {...props} />)
      expect(screen.getByRole('button')).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('handles feedback submission errors gracefully', async () => {
      const mockSubmitWithError = vi.fn().mockRejectedValue(new Error('Submission failed'))
      const user = userEvent.setup()
      
      render(<FeedbackButton {...defaultProps} onFeedbackSubmit={mockSubmitWithError} />)
      
      await user.click(screen.getByRole('button'))
      await user.click(screen.getByTestId('submit-feedback'))
      
      await waitFor(() => {
        expect(mockSubmitWithError).toHaveBeenCalled()
      })
      
      // Component should still be functional after error
      expect(screen.getByRole('button')).toBeInTheDocument()
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
      
      await user.click(screen.getByRole('button'))
      expect(screen.getByTestId('feedback-form')).toBeInTheDocument()
    })
  })
}) 