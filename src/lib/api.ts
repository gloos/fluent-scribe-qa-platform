import { supabase } from './supabase'
import { QASession, QAError } from './supabase'

// User Profile Operations
export const getUserProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  return { data, error }
}

export const updateUserProfile = async (userId: string, updates: any) => {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()

  return { data, error }
}

// QA Session Operations
export const createQASession = async (sessionData: Partial<QASession>) => {
  const { data, error } = await supabase
    .from('qa_sessions')
    .insert([sessionData])
    .select()
    .single()

  return { data, error }
}

export const getQASessions = async (userId?: string, limit: number = 50) => {
  let query = supabase
    .from('qa_sessions')
    .select(`
      *,
      qa_errors (
        id,
        severity,
        error_type
      )
    `)
    .order('created_at', { ascending: false })

  if (userId) {
    query = query.eq('user_id', userId)
  }

  const { data, error } = await query.limit(limit)
  return { data, error }
}

export const getQASession = async (sessionId: string) => {
  const { data, error } = await supabase
    .from('qa_sessions')
    .select(`
      *,
      qa_errors (*),
      file_uploads (*)
    `)
    .eq('id', sessionId)
    .single()

  return { data, error }
}

export const updateQASession = async (sessionId: string, updates: Partial<QASession>) => {
  const { data, error } = await supabase
    .from('qa_sessions')
    .update(updates)
    .eq('id', sessionId)
    .select()
    .single()

  return { data, error }
}

export const deleteQASession = async (sessionId: string) => {
  const { error } = await supabase
    .from('qa_sessions')
    .delete()
    .eq('id', sessionId)

  return { error }
}

// QA Error Operations
export const createQAErrors = async (errors: Partial<QAError>[]) => {
  const { data, error } = await supabase
    .from('qa_errors')
    .insert(errors)
    .select()

  return { data, error }
}

export const getQAErrors = async (sessionId: string) => {
  const { data, error } = await supabase
    .from('qa_errors')
    .select('*')
    .eq('session_id', sessionId)
    .order('severity', { ascending: false })
    .order('created_at', { ascending: false })

  return { data, error }
}

export const updateQAError = async (errorId: string, updates: Partial<QAError>) => {
  const { data, error } = await supabase
    .from('qa_errors')
    .update(updates)
    .eq('id', errorId)
    .select()
    .single()

  return { data, error }
}

export const deleteQAError = async (errorId: string) => {
  const { error } = await supabase
    .from('qa_errors')
    .delete()
    .eq('id', errorId)

  return { error }
}

// File Upload Operations
export const createFileUpload = async (uploadData: any) => {
  const { data, error } = await supabase
    .from('file_uploads')
    .insert([uploadData])
    .select()
    .single()

  return { data, error }
}

export const getFileUploads = async (sessionId: string) => {
  const { data, error } = await supabase
    .from('file_uploads')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })

  return { data, error }
}

export const updateFileUpload = async (uploadId: string, updates: any) => {
  const { data, error } = await supabase
    .from('file_uploads')
    .update(updates)
    .eq('id', uploadId)
    .select()
    .single()

  return { data, error }
}

// User Preferences Operations
export const getUserPreferences = async (userId: string) => {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .single()

  return { data, error }
}

export const updateUserPreferences = async (userId: string, preferences: any) => {
  const { data, error } = await supabase
    .from('user_preferences')
    .upsert({ user_id: userId, ...preferences })
    .select()
    .single()

  return { data, error }
}

// Analytics and Reporting
export const getSessionStats = async (userId?: string) => {
  let query = supabase
    .from('qa_sessions')
    .select(`
      analysis_status,
      created_at,
      mqm_score,
      error_count,
      warning_count
    `)

  if (userId) {
    query = query.eq('user_id', userId)
  }

  const { data, error } = await query

  if (error) return { error }

  // Calculate statistics
  const stats = {
    totalSessions: data.length,
    completedSessions: data.filter(s => s.analysis_status === 'completed').length,
    averageMqmScore: data.reduce((acc, s) => acc + (s.mqm_score || 0), 0) / data.length || 0,
    totalErrors: data.reduce((acc, s) => acc + (s.error_count || 0), 0),
    totalWarnings: data.reduce((acc, s) => acc + (s.warning_count || 0), 0),
    sessionsThisWeek: data.filter(s => {
      const sessionDate = new Date(s.created_at)
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      return sessionDate > weekAgo
    }).length
  }

  return { data: stats, error: null }
}

export const getErrorStats = async (sessionId?: string, userId?: string) => {
  let query = supabase
    .from('qa_errors')
    .select(`
      severity,
      error_type,
      error_category,
      created_at,
      qa_sessions!inner (
        id,
        user_id
      )
    `)

  if (sessionId) {
    query = query.eq('session_id', sessionId)
  }

  if (userId) {
    query = query.eq('qa_sessions.user_id', userId)
  }

  const { data, error } = await query

  if (error) return { error }

  // Group errors by type and severity
  const errorStats = {
    bySeverity: data.reduce((acc, error) => {
      acc[error.severity] = (acc[error.severity] || 0) + 1
      return acc
    }, {} as Record<string, number>),
    byType: data.reduce((acc, error) => {
      acc[error.error_type] = (acc[error.error_type] || 0) + 1
      return acc
    }, {} as Record<string, number>),
    byCategory: data.reduce((acc, error) => {
      acc[error.error_category] = (acc[error.error_category] || 0) + 1
      return acc
    }, {} as Record<string, number>),
    total: data.length
  }

  return { data: errorStats, error: null }
}

// Real-time subscriptions
export const subscribeToSessionUpdates = (
  sessionId: string,
  callback: (payload: any) => void
) => {
  return supabase
    .channel(`session-${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'qa_sessions',
        filter: `id=eq.${sessionId}`
      },
      callback
    )
    .subscribe()
}

export const subscribeToErrorUpdates = (
  sessionId: string,
  callback: (payload: any) => void
) => {
  return supabase
    .channel(`errors-${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'qa_errors',
        filter: `session_id=eq.${sessionId}`
      },
      callback
    )
    .subscribe()
} 