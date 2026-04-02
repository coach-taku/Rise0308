import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Supabase の環境変数が正しく設定されているか確認する
export const isSupabaseConfigured = (): boolean => {
  const configured =
    supabaseUrl.length > 0 &&
    supabaseAnonKey.length > 0 &&
    supabaseUrl.startsWith('https://') &&
    !supabaseUrl.includes('placeholder')

  // 設定状況をコンソールに出力（デバッグ用）
  if (!configured) {
    console.warn('[Supabase] 環境変数が未設定またはプレースホルダーのままです。', {
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ? '設定あり' : '未設定',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey ? '設定あり' : '未設定',
    })
  }

  return configured
}

// シングルトン — 環境変数が設定されている場合のみ作成する
let _supabase: SupabaseClient | null = null

export const getSupabase = (): SupabaseClient => {
  if (!_supabase) {
    if (!isSupabaseConfigured()) {
      throw new Error(
        '[Supabase] 接続設定が見つかりません。Vercel の環境変数 NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を確認してください。'
      )
    }
    _supabase = createClient(supabaseUrl, supabaseAnonKey)
    console.info('[Supabase] クライアントを初期化しました。URL:', supabaseUrl)
  }
  return _supabase
}
