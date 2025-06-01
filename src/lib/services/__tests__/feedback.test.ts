/**
 * Tests for the Feedback Service
 * Tests database operations, business logic, and error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FeedbackService } from '../feedback'
import { FeedbackTargetType, FeedbackStatus } from '@/lib/types/user-feedback'

// Mock Supabase client
const mockSupabase = {
  auth: {
    getUser: vi.fn()
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        order: vi.fn(() => Promise.resolve({ data: [], error: null }))
      }))
    })),
    insert: vi.fn(() => Promise.resolve({ data: { id: 'test-feedback-id' }, error: null })),
    update: vi.fn(() => Promise.resolve({ data: null, error: null })),
    delete: vi.fn(() => Promise.resolve({ data: null, error: null }))
  }))
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase)
}))

describe('FeedbackService', () => {
  let feedbackService: FeedbackService

  beforeEach(() => {
    vi.clearAllMocks()
    feedbackService = new FeedbackService()
    
    // Setup default auth user
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { 
        user: { 
          id: 'test-user-id',
          user_metadata: { role: 'user' }
        }
      },
      error: null
    })
  })

  describe('submitFeedback', () => {
    it('should submit feedback with user data', async () => {
      const feedbackData = {
        target_type: 'error_categorization' as const,
        target_id: 'error-123',
        feedback_type: 'quick_rating' as const,
        rating: 4,
        comment: 'Good categorization'
      }

      const result = await feedbackService.submitFeedback(feedbackData)

      expect(mockSupabase.from).toHaveBeenCalledWith('user_feedback')
      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          ...feedbackData,
          user_id: 'test-user-id',
          user_role: 'user',
          status: 'submitted'
        })
      )
      expect(result).toEqual({ id: 'test-feedback-id' })
    })

    it('should handle authentication errors', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      })

      const feedbackData = {
        target_type: 'error_categorization' as const,
        target_id: 'error-123',
        feedback_type: 'quick_rating' as const,
        rating: 4
      }

      await expect(feedbackService.submitFeedback(feedbackData)).rejects.toThrow('User not authenticated')
    })

    it('should handle database errors', async () => {
      mockSupabase.from().insert.mockResolvedValue({
        data: null,
        error: { message: 'Database error', code: 'DB_ERROR' }
      })

      const feedbackData = {
        target_type: 'error_categorization' as const,
        target_id: 'error-123',
        feedback_type: 'quick_rating' as const,
        rating: 4
      }

      await expect(feedbackService.submitFeedback(feedbackData)).rejects.toThrow('Database error')
    })

    it('should include optional fields when provided', async () => {
      const feedbackData = {
        target_type: 'error_categorization' as const,
        target_id: 'error-123',
        feedback_type: 'detailed_form' as const,
        rating: 4,
        comment: 'Good feedback',
        session_id: 'session-123',
        assessment_result_id: 'assessment-456',
        confidence_level: 0.8,
        category_suggestion: {
          dimension: 'Accuracy',
          category: 'Terminology',
          subcategory: 'Inconsistency',
          confidence: 0.9,
          rationale: 'Better categorization'
        }
      }

      await feedbackService.submitFeedback(feedbackData)

      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          session_id: 'session-123',
          assessment_result_id: 'assessment-456',
          confidence_level: 0.8,
          category_suggestion: feedbackData.category_suggestion
        })
      )
    })
  })

  describe('getFeedbackForTarget', () => {
    it('should retrieve feedback for a specific target', async () => {
      const mockFeedbackData = [
        {
          id: 'feedback-1',
          target_type: 'error_categorization',
          target_id: 'error-123',
          rating: 4,
          comment: 'Good feedback'
        }
      ]

      mockSupabase.from().select().eq().order.mockResolvedValue({
        data: mockFeedbackData,
        error: null
      })

      const result = await feedbackService.getFeedbackForTarget(
        'error_categorization',
        'error-123'
      )

      expect(mockSupabase.from).toHaveBeenCalledWith('user_feedback')
      expect(mockSupabase.from().select().eq).toHaveBeenCalledWith('target_type', 'error_categorization')
      expect(result).toEqual(mockFeedbackData)
    })

    it('should handle query errors', async () => {
      mockSupabase.from().select().eq().order.mockResolvedValue({
        data: null,
        error: { message: 'Query failed' }
      })

      await expect(
        feedbackService.getFeedbackForTarget('error_categorization', 'error-123')
      ).rejects.toThrow('Query failed')
    })
  })

  describe('updateFeedbackStatus', () => {
    it('should update feedback status', async () => {
      await feedbackService.updateFeedbackStatus('feedback-123', 'reviewed')

      expect(mockSupabase.from).toHaveBeenCalledWith('user_feedback')
      expect(mockSupabase.from().update).toHaveBeenCalledWith({
        status: 'reviewed',
        reviewed_at: expect.any(String)
      })
    })

    it('should handle update errors', async () => {
      mockSupabase.from().update.mockResolvedValue({
        data: null,
        error: { message: 'Update failed' }
      })

      await expect(
        feedbackService.updateFeedbackStatus('feedback-123', 'reviewed')
      ).rejects.toThrow('Update failed')
    })
  })

  describe('aggregateFeedbackMetrics', () => {
    it('should aggregate feedback metrics for a target', async () => {
      const mockAggregateData = {
        total_feedback: 10,
        avg_rating: 4.2,
        rating_distribution: { 5: 3, 4: 4, 3: 2, 2: 1, 1: 0 }
      }

      // Mock the database aggregation query
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ 
              data: mockAggregateData, 
              error: null 
            }))
          }))
        }))
      }))
      
      mockSupabase.from = mockFrom

      const result = await feedbackService.aggregateFeedbackMetrics(
        'error_categorization',
        'error-123'
      )

      expect(result).toEqual(mockAggregateData)
    })
  })

  describe('getFeedbackEffectiveness', () => {
    it('should calculate feedback effectiveness metrics', async () => {
      const mockEffectivenessData = {
        feedback_adoption_rate: 0.75,
        accuracy_improvement: 0.15,
        user_satisfaction_score: 4.2
      }

      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            gte: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ 
                data: mockEffectivenessData, 
                error: null 
              }))
            }))
          }))
        }))
      }))
      
      mockSupabase.from = mockFrom

      const result = await feedbackService.getFeedbackEffectiveness(
        new Date('2024-01-01'),
        new Date('2024-02-01')
      )

      expect(result).toEqual(mockEffectivenessData)
    })
  })

  describe('Validation', () => {
    it('should validate required fields', async () => {
      const invalidFeedbackData = {
        target_type: '' as any,
        target_id: '',
        feedback_type: 'quick_rating' as const
      }

      await expect(feedbackService.submitFeedback(invalidFeedbackData)).rejects.toThrow()
    })

    it('should validate rating range', async () => {
      const invalidRatingData = {
        target_type: 'error_categorization' as const,
        target_id: 'error-123',
        feedback_type: 'quick_rating' as const,
        rating: 6 // Invalid rating (should be 1-5)
      }

      await expect(feedbackService.submitFeedback(invalidRatingData)).rejects.toThrow()
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty target_id', async () => {
      const feedbackData = {
        target_type: 'error_categorization' as const,
        target_id: '',
        feedback_type: 'quick_rating' as const,
        rating: 4
      }

      await expect(feedbackService.submitFeedback(feedbackData)).rejects.toThrow()
    })

    it('should handle very long comments', async () => {
      const longComment = 'x'.repeat(10000) // Very long comment
      const feedbackData = {
        target_type: 'error_categorization' as const,
        target_id: 'error-123',
        feedback_type: 'detailed_form' as const,
        rating: 4,
        comment: longComment
      }

      // Should truncate or handle gracefully
      await feedbackService.submitFeedback(feedbackData)
      
      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          comment: expect.any(String)
        })
      )
    })

    it('should handle concurrent feedback submissions', async () => {
      const feedbackData = {
        target_type: 'error_categorization' as const,
        target_id: 'error-123',
        feedback_type: 'quick_rating' as const,
        rating: 4
      }

      // Simulate concurrent submissions
      const promises = Array(5).fill(null).map(() => 
        feedbackService.submitFeedback(feedbackData)
      )

      const results = await Promise.all(promises)
      expect(results).toHaveLength(5)
      results.forEach(result => {
        expect(result).toEqual({ id: 'test-feedback-id' })
      })
    })
  })
}) 