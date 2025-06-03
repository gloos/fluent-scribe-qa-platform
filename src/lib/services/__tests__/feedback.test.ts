/**
 * Tests for the Feedback Service
 * Tests database operations, business logic, and error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Create a comprehensive mock for Supabase query chains
let mockSupabaseData: any = null;
let mockSupabaseError: any = null;
let mockAuthUser: any = null;
let mockAuthError: any = null;

// Create a complete mock chain that properly handles all query operations
const createMockQuery = () => {
  const mockQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(() => {
      return Promise.resolve({ data: mockSupabaseData, error: mockSupabaseError });
    }),
    // This handles queries without .single()
    then: vi.fn().mockImplementation((callback) => {
      return Promise.resolve({ data: mockSupabaseData, error: mockSupabaseError }).then(callback);
    })
  };

  // Make all chaining methods return the same mock object
  mockQuery.select.mockReturnValue(mockQuery);
  mockQuery.eq.mockReturnValue(mockQuery);
  mockQuery.order.mockReturnValue(mockQuery);
  mockQuery.limit.mockReturnValue(mockQuery);
  mockQuery.insert.mockReturnValue(mockQuery);
  mockQuery.update.mockReturnValue(mockQuery);

  return mockQuery;
};

// Mock auth
const mockAuth = {
  getUser: vi.fn().mockImplementation(() => 
    Promise.resolve({ 
      data: { user: mockAuthError ? null : mockAuthUser }, 
      error: mockAuthError 
    })
  )
};

// Main Supabase mock
const mockSupabase = {
  auth: mockAuth,
  from: vi.fn().mockImplementation(() => createMockQuery())
};

// Helper functions to control mock behavior
const setMockData = (data: any) => {
  mockSupabaseData = data;
  mockSupabaseError = null;
};

const setMockError = (error: any) => {
  mockSupabaseData = null;
  mockSupabaseError = error;
};

const setMockAuth = (user: any, error: any = null) => {
  mockAuthUser = user;
  mockAuthError = error;
};

// Mock the Supabase module
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase)
}))

describe('FeedbackService', () => {
  let FeedbackService: any
  let feedbackService: any
  let FeedbackTargetType: any
  let FeedbackStatus: any
  let FeedbackType: any
  let FeedbackRating: any

  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Reset mock state
    mockSupabaseData = null;
    mockSupabaseError = null;
    mockAuthUser = {
      id: 'test-user-id',
      user_metadata: { role: 'user' }
    };
    mockAuthError = null;
    
    // Import modules inside beforeEach to ensure mocks are set up
    const feedbackModule = await import('../feedback')
    const typesModule = await import('@/lib/types/user-feedback')
    
    FeedbackService = feedbackModule.FeedbackService
    FeedbackTargetType = typesModule.FeedbackTargetType
    FeedbackStatus = typesModule.FeedbackStatus
    FeedbackType = typesModule.FeedbackType
    FeedbackRating = typesModule.FeedbackRating
    
    feedbackService = new FeedbackService()
  })

  describe('submitFeedback', () => {
    it('should submit feedback with user data', async () => {
      const feedbackData = {
        target_type: FeedbackTargetType.ERROR_CATEGORIZATION,
        target_id: 'error-123',
        feedback_type: FeedbackType.RATING,
        rating: FeedbackRating.GOOD,
        comment: 'Good categorization'
      }

      // Set mock to return successful feedback creation
      setMockData({ id: 'test-feedback-id' });

      const result = await feedbackService.submitFeedback(feedbackData)

      expect(mockSupabase.from).toHaveBeenCalledWith('user_feedback')
      expect(result).toEqual({ id: 'test-feedback-id' })
    })

    it('should handle authentication errors', async () => {
      // Set mock auth to fail
      setMockAuth(null, { message: 'Auth failed' });

      const feedbackData = {
        target_type: FeedbackTargetType.ERROR_CATEGORIZATION,
        target_id: 'error-123',
        feedback_type: FeedbackType.RATING,
        rating: FeedbackRating.GOOD
      }

      await expect(feedbackService.submitFeedback(feedbackData)).rejects.toThrow('User not authenticated')
    })

    it('should handle database errors', async () => {
      const feedbackData = {
        target_type: FeedbackTargetType.ERROR_CATEGORIZATION,
        target_id: 'error-123',
        feedback_type: FeedbackType.RATING,
        rating: FeedbackRating.HELPFUL,
        comment: 'Test feedback'
      }

      // Set mock to return database error
      setMockError({ message: 'Database error' });

      await expect(feedbackService.submitFeedback(feedbackData)).rejects.toThrow('Failed to submit feedback: Database error')
    })

    it('should include optional fields when provided', async () => {
      const feedbackData = {
        target_type: FeedbackTargetType.ERROR_CATEGORIZATION,
        target_id: 'error-123',
        feedback_type: FeedbackType.CATEGORY_CORRECTION,
        rating: FeedbackRating.HELPFUL,
        comment: 'Category should be different',
        confidence_level: 0.9,
        session_id: 'session-123',
        assessment_result_id: 'assessment-456'
      }

      // Set mock to return successful feedback creation
      setMockData({ id: 'test-feedback-id' });

      await feedbackService.submitFeedback(feedbackData)

      expect(mockSupabase.from).toHaveBeenCalledWith('user_feedback')
      
      // Get the query object that was created
      const mockQuery = mockSupabase.from.mock.results[0].value;
      expect(mockQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          session_id: 'session-123',
          assessment_result_id: 'assessment-456',
          comment: 'Category should be different',
          confidence_level: 0.9
        })
      )
    })
  })

  describe('getFeedbackForTarget', () => {
    it('should retrieve feedback for a specific target', async () => {
      const mockFeedbackData = [{
        id: 'feedback-1',
        target_type: 'error_categorization',
        target_id: 'error-123',
        rating: 4,
        comment: 'Good feedback'
      }]

      // Set mock to return the expected data
      setMockData(mockFeedbackData);

      const result = await feedbackService.getFeedbackForTarget(
        FeedbackTargetType.ERROR_CATEGORIZATION,
        'error-123'
      )

      expect(mockSupabase.from).toHaveBeenCalledWith('user_feedback')
      expect(result).toEqual(mockFeedbackData)
    })

    it('should handle query errors', async () => {
      // Set mock to return error
      setMockError({ message: 'Query failed' });

      await expect(
        feedbackService.getFeedbackForTarget(FeedbackTargetType.ERROR_CATEGORIZATION, 'error-123')
      ).rejects.toThrow('Failed to fetch feedback: Query failed')
    })
  })

  describe('updateFeedbackStatus', () => {
    it('should update feedback status', async () => {
      const mockUpdatedFeedback = {
        id: 'feedback-123',
        status: FeedbackStatus.ACCEPTED,
        reviewed_by: 'test-user-id',
        reviewed_at: expect.any(String)
      }

      // Set mock to return success
      setMockData(mockUpdatedFeedback);

      const result = await feedbackService.updateFeedbackStatus('feedback-123', FeedbackStatus.ACCEPTED)

      expect(mockSupabase.from).toHaveBeenCalledWith('user_feedback')
      expect(result).toEqual(mockUpdatedFeedback)
    })

    it('should handle update errors', async () => {
      // Set mock to return error
      setMockError({ message: 'Update failed' });

      await expect(
        feedbackService.updateFeedbackStatus('feedback-123', FeedbackStatus.ACCEPTED)
      ).rejects.toThrow('Failed to update feedback: Update failed')
    })
  })

  describe('submitQuickRating', () => {
    it('should submit quick rating feedback', async () => {
      // Set mock to return success
      setMockData({ id: 'test-feedback-id' });

      const result = await feedbackService.submitQuickRating(
        FeedbackTargetType.ERROR_CATEGORIZATION,
        'error-123',
        FeedbackRating.EXCELLENT
      )

      expect(mockSupabase.from).toHaveBeenCalledWith('user_feedback')
      expect(result).toEqual({ id: 'test-feedback-id' })
    })
  })

  describe('getFeedbackStats', () => {
    it('should return feedback statistics', async () => {
      const mockFeedbackData = [
        { 
          id: 'feedback-1', 
          feedback_type: FeedbackType.RATING,
          rating: 5,
          target_type: 'error_categorization',
          target_id: 'error-123'
        },
        { 
          id: 'feedback-2', 
          feedback_type: FeedbackType.RATING,
          rating: 4,
          target_type: 'error_categorization',
          target_id: 'error-123'
        }
      ]

      // Set mock to return feedback data
      setMockData(mockFeedbackData);

      const result = await feedbackService.getFeedbackStats(
        FeedbackTargetType.ERROR_CATEGORIZATION,
        'error-123'
      )

      expect(result).toHaveProperty('total', 2)
      expect(result).toHaveProperty('averageRating', 4.5)
      expect(result).toHaveProperty('ratingDistribution')
      expect(result.ratingDistribution).toEqual({ 4: 1, 5: 1 })
    })
  })

  describe('hasUserProvidedFeedback', () => {
    it('should check if user has provided feedback', async () => {
      // Set mock to return existing feedback (array with items means feedback exists)
      setMockData([{ id: 'feedback-1' }]);

      const result = await feedbackService.hasUserProvidedFeedback(
        FeedbackTargetType.ERROR_CATEGORIZATION,
        'error-123'
      )

      expect(result).toBe(true)
    })

    it('should return false when no feedback found', async () => {
      // Set mock to return empty array (no feedback found)
      setMockData([]);

      const result = await feedbackService.hasUserProvidedFeedback(
        FeedbackTargetType.ERROR_CATEGORIZATION,
        'error-123'
      )

      expect(result).toBe(false)
    })
  })
}) 