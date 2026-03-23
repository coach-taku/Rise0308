import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Check if Supabase is configured with real (non-placeholder) values
export const isSupabaseConfigured = (): boolean => {
  return (
    supabaseUrl.length > 0 &&
    supabaseAnonKey.length > 0 &&
    supabaseUrl.startsWith('https://') &&
    !supabaseUrl.includes('placeholder')
  )
}

// Lazily-initialised singleton – only created when truly configured
let _supabase: SupabaseClient | null = null

export const getSupabase = (): SupabaseClient => {
  if (!_supabase) {
    if (!isSupabaseConfigured()) {
      throw new Error(
        'Supabase is not configured. All data access should go through demo helpers in data.ts.'
      )
    }
    _supabase = createClient(supabaseUrl, supabaseAnonKey)
  }
  return _supabase
}
