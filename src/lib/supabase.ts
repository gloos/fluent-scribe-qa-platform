import { createClient } from '@supabase/supabase-js'

// Import comprehensive user types
export * from './types/user'
import type { Database } from './types/user'

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://uqprvrrncpqhpfxafeuc.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your_anon_key_here'

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Create Supabase client with enhanced security settings
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
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

// Auth state change handler
export const onAuthStateChange = (callback: (session: any) => void) => {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(session)
  })
}

// File upload helper
export const uploadFile = async (bucket: string, path: string, file: File) => {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false
    })

  return { data, error }
}

// Get public URL for uploaded file
export const getPublicUrl = (bucket: string, path: string) => {
  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(path)

  return data.publicUrl
}

// Download file
export const downloadFile = async (bucket: string, path: string) => {
  const { data, error } = await supabase.storage
    .from(bucket)
    .download(path)

  return { data, error }
}

// Delete file
export const deleteFile = async (bucket: string, path: string) => {
  const { data, error } = await supabase.storage
    .from(bucket)
    .remove([path])

  return { data, error }
} 