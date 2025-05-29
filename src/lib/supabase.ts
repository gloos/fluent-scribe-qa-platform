import { createClient } from '@supabase/supabase-js'

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://uqprvrrncpqhpfxafeuc.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your_anon_key_here'

// Create Supabase client with enhanced security settings
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Enable automatic token refresh
    autoRefreshToken: true,
    
    // Persist sessions across browser restarts
    persistSession: true,
    
    // Detect session in URL for auth flows
    detectSessionInUrl: true,
    
    // Use secure storage for session tokens
    storage: {
      getItem: (key: string) => {
        if (typeof window !== 'undefined') {
          return localStorage.getItem(key)
        }
        return null
      },
      setItem: (key: string, value: string) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem(key, value)
        }
      },
      removeItem: (key: string) => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(key)
        }
      }
    },
    
    // Enhanced security settings
    flowType: 'pkce', // Use PKCE flow for better security
    debug: process.env.NODE_ENV === 'development'
  },
  
  // Global options
  global: {
    headers: {
      'X-Client-Info': 'fluent-scribe-qa-platform'
    }
  },
  
  // Database options for real-time
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

// Session configuration constants
export const SESSION_CONFIG = {
  // Session warning threshold (5 minutes before expiry)
  WARNING_THRESHOLD: 5 * 60,
  
  // Idle timeout (30 minutes of inactivity)
  IDLE_TIMEOUT: 30 * 60,
  
  // Session refresh threshold (refresh when 10 minutes left)
  REFRESH_THRESHOLD: 10 * 60,
  
  // Maximum session duration (24 hours)
  MAX_SESSION_DURATION: 24 * 60 * 60
} as const;

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