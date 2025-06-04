import { createClient } from '@supabase/supabase-js'
import { 
  UserFeedback, 
  FeedbackFormData, 
  FeedbackAggregation,
  FeedbackEffectivenessMetrics,
  FeedbackTargetType,
  FeedbackType,
  FeedbackRating,
  FeedbackStatus,
  FeedbackSource
} from '@/lib/types/user-feedback'

// Supabase client for feedback storage
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
)

export class FeedbackService {
  /**
   * Submit user feedback
   */
  async submitFeedback(feedbackData: FeedbackFormData & {
    target_type: FeedbackTargetType;
    target_id: string;
    session_id?: string;
    assessment_result_id?: string;
  }): Promise<UserFeedback> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const feedback = {
      target_type: feedbackData.target_type,
      target_id: feedbackData.target_id,
      user_id: user.id,
      user_role: user.user_metadata?.role || 'user',
      feedback_type: feedbackData.feedback_type,
      rating: feedbackData.rating,
      category_suggestion: feedbackData.category_suggestion,
      comment: feedbackData.comment,
      confidence_level: feedbackData.confidence_level || 0.75,
      is_expert_feedback: false,
      feedback_source: FeedbackSource.MANUAL_REVIEW,
      status: FeedbackStatus.PENDING,
      session_id: feedbackData.session_id,
      assessment_result_id: feedbackData.assessment_result_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('user_feedback')
      .insert(feedback)
      .select()
      .single()

    if (error) throw new Error(`Failed to submit feedback: ${error.message}`)
    return data as UserFeedback
  }

  /**
   * Get feedback for a specific target
   */
  async getFeedbackForTarget(
    targetType: FeedbackTargetType, 
    targetId: string
  ): Promise<UserFeedback[]> {
    const { data, error } = await supabase
      .from('user_feedback')
      .select(`
        *,
        user:profiles!user_id(id, display_name, role),
        reviewer:profiles!reviewed_by(id, display_name)
      `)
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch feedback: ${error.message}`)
    return data as UserFeedback[]
  }

  /**
   * Get feedback submitted by current user
   */
  async getUserFeedback(): Promise<UserFeedback[]> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { data, error } = await supabase
      .from('user_feedback')
      .select(`
        *,
        reviewer:profiles!reviewed_by(id, display_name)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch user feedback: ${error.message}`)
    return data as UserFeedback[]
  }

  /**
   * Get pending feedback for review (admin/manager)
   */
  async getPendingFeedback(): Promise<UserFeedback[]> {
    const { data, error } = await supabase
      .from('user_feedback')
      .select(`
        *,
        user:profiles!user_id(id, display_name, role)
      `)
      .eq('status', FeedbackStatus.PENDING)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch pending feedback: ${error.message}`)
    return data as UserFeedback[]
  }

  /**
   * Update feedback status (review workflow)
   */
  async updateFeedbackStatus(
    feedbackId: string, 
    status: FeedbackStatus, 
    resolutionNotes?: string
  ): Promise<UserFeedback> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const updates = {
      status,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...(resolutionNotes && { resolution_notes: resolutionNotes })
    }

    const { data, error } = await supabase
      .from('user_feedback')
      .update(updates)
      .eq('id', feedbackId)
      .select()
      .single()

    if (error) throw new Error(`Failed to update feedback: ${error.message}`)
    return data as UserFeedback
  }

  /**
   * Submit quick rating feedback
   */
  async submitQuickRating(
    targetType: FeedbackTargetType,
    targetId: string,
    rating: FeedbackRating,
    context?: {
      session_id?: string;
      assessment_result_id?: string;
      comment?: string;
    }
  ): Promise<UserFeedback> {
    const feedbackData = {
      target_type: targetType,
      target_id: targetId,
      feedback_type: FeedbackType.RATING,
      rating: rating,
      confidence_level: 0.8,
      comment: context?.comment,
      session_id: context?.session_id,
      assessment_result_id: context?.assessment_result_id
    }

    return this.submitFeedback(feedbackData)
  }

  /**
   * Submit category correction feedback
   */
  async submitCategoryCorrection(
    targetType: FeedbackTargetType,
    targetId: string,
    originalCategorization: any,
    suggestedCategorization: any,
    comment?: string,
    confidence?: number
  ): Promise<UserFeedback> {
    const feedbackData = {
      target_type: targetType,
      target_id: targetId,
      feedback_type: FeedbackType.CATEGORY_CORRECTION,
      category_suggestion: {
        suggested_category: suggestedCategorization.category,
        suggested_subcategory: suggestedCategorization.subcategory,
        suggested_severity: suggestedCategorization.severity,
        reasoning: comment || 'Category correction suggested',
        confidence: confidence || 0.75
      },
      comment,
      confidence_level: confidence || 0.75
    }

    return this.submitFeedback(feedbackData)
  }

  /**
   * Calculate feedback statistics for a target
   */
  async getFeedbackStats(
    targetType: FeedbackTargetType,
    targetId: string
  ): Promise<{
    total: number
    averageRating: number
    ratingDistribution: Record<number, number>
    feedbackTypes: Record<string, number>
    recentFeedback: UserFeedback[]
  }> {
    const feedback = await this.getFeedbackForTarget(targetType, targetId)

    const total = feedback.length
    const ratingsOnly = feedback.filter(f => f.rating !== null && f.rating !== undefined)
    const averageRating = ratingsOnly.length > 0 
      ? ratingsOnly.reduce((sum, f) => sum + (f.rating || 0), 0) / ratingsOnly.length
      : 0

    const ratingDistribution = ratingsOnly.reduce((acc, f) => {
      const rating = f.rating || 0
      acc[rating] = (acc[rating] || 0) + 1
      return acc
    }, {} as Record<number, number>)

    const feedbackTypes = feedback.reduce((acc, f) => {
      acc[f.feedback_type] = (acc[f.feedback_type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const recentFeedback = feedback.slice(0, 5) // Last 5 feedback items

    return {
      total,
      averageRating,
      ratingDistribution,
      feedbackTypes,
      recentFeedback
    }
  }

  /**
   * Get feedback for a QA session
   */
  async getSessionFeedback(sessionId: string): Promise<UserFeedback[]> {
    const { data, error } = await supabase
      .from('user_feedback')
      .select(`
        *,
        user:profiles!user_id(id, display_name, role)
      `)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch session feedback: ${error.message}`)
    return data as UserFeedback[]
  }

  /**
   * Get feedback for assessment results
   */
  async getAssessmentFeedback(assessmentResultId: string): Promise<UserFeedback[]> {
    const { data, error } = await supabase
      .from('user_feedback')
      .select(`
        *,
        user:profiles!user_id(id, display_name, role)
      `)
      .eq('assessment_result_id', assessmentResultId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch assessment feedback: ${error.message}`)
    return data as UserFeedback[]
  }

  /**
   * Check if user has already provided feedback for a target
   */
  async hasUserProvidedFeedback(
    targetType: FeedbackTargetType,
    targetId: string,
    feedbackType?: FeedbackType
  ): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    let query = supabase
      .from('user_feedback')
      .select('id')
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .eq('user_id', user.id)

    if (feedbackType) {
      query = query.eq('feedback_type', feedbackType)
    }

    const { data, error } = await query

    if (error) return false
    return data && data.length > 0
  }
}

export const feedbackService = new FeedbackService() 