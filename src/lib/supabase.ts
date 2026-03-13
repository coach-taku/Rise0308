import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      'Accept': 'application/json',
    },
  },
})

// Check if Supabase is configured
export const isSupabaseConfigured = () => {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL !== undefined &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co' &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== undefined &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== 'placeholder-key'
  )
}

// Helper: ensure the user is authenticated with Supabase Auth
// This is needed for RLS policies that check auth.uid()
export async function ensureAuthSession(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user?.id) {
    return session.user.id
  }
  return null
}

// Helper: get current auth user ID or redirect to login
// Use this in page components to validate auth state
export async function getAuthUserId(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user?.id || null
}
