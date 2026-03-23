import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Check if Supabase is configured (non-empty real values)
export const isSupabaseConfigured = () => {
  return (
    supabaseUrl !== '' &&
    supabaseAnonKey !== '' &&
    !supabaseUrl.includes('placeholder')
  )
}

// Only create client if configured; otherwise provide a dummy that will never be used
export const supabase: SupabaseClient = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createClient('https://placeholder.supabase.co', 'placeholder-key')
