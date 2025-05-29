import { createClient } from '@supabase/supabase-js'

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://uqprvrrncpqhpfxafeuc.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your_anon_key_here'

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// Types for our database tables
export interface User {
  id: string
  email: string
  created_at: string
  updated_at: string
}

export interface QASession {
  id: string
  user_id: string
  file_name: string
  file_type: string
  file_size: number
  upload_timestamp: string
  analysis_status: 'pending' | 'processing' | 'completed' | 'failed'
  mqm_score?: number
  error_count?: number
  warning_count?: number
  created_at: string
  updated_at: string
}

export interface QAError {
  id: string
  session_id: string
  segment_id: string
  error_type: string
  error_category: string
  severity: 'minor' | 'major' | 'critical'
  source_text: string
  target_text: string
  error_description: string
  suggestion?: string
  created_at: string
} 