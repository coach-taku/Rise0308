// ============================================================
// セッション管理ユーティリティ
// localStorage に保存されたセッション情報の読み書き・検証を一元管理する
// ============================================================

import { User } from '@/types/database'
import { isSupabaseConfigured } from './supabase'

const SESSION_KEY = 'rise_note_session'

/** セッションとして保存する最小限のユーザー情報 */
export type SessionUser = Pick<User, 'id' | 'name' | 'role'>

/**
 * UUID v4 の形式かどうかを判定する
 * Supabase の users テーブルの id は UUID 形式のため、
 * デモ用 ID（player-1 等）と区別するのに使う
 */
export function isValidUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

/**
 * 現在のセッションが有効かどうかを検証する
 * - Supabase 接続時: ID が UUID 形式であることを確認
 * - 未接続時: デモ ID でも許可
 */
export function isSessionValid(session: SessionUser): boolean {
  if (!session.id || !session.name || !session.role) {
    return false
  }

  // Supabase が設定されている場合、ID は UUID 形式でなければならない
  if (isSupabaseConfigured() && !isValidUUID(session.id)) {
    console.warn(
      '[session] Supabase 接続中ですが、セッションの ID が UUID 形式ではありません:',
      session.id,
      '→ 再ログインが必要です。'
    )
    return false
  }

  return true
}

/**
 * localStorage からセッション情報を読み込む
 * セッションが無効（デモ ID でのログイン残骸など）の場合は null を返し、
 * 自動的に localStorage からも削除する
 */
export function getSession(): SessionUser | null {
  if (typeof window === 'undefined') return null

  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as SessionUser
    if (!isSessionValid(parsed)) {
      // 無効なセッションは削除して再ログインを促す
      console.info('[session] 無効なセッションを検出しました。クリアします。')
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return parsed
  } catch {
    localStorage.removeItem(SESSION_KEY)
    return null
  }
}

/**
 * セッション情報を localStorage に保存する
 * 保存前に UUID の妥当性を検証する
 */
export function saveSession(user: SessionUser): void {
  if (typeof window === 'undefined') return

  if (isSupabaseConfigured() && !isValidUUID(user.id)) {
    console.error(
      '[session] Supabase 接続中ですが、保存しようとしている ID が UUID 形式ではありません:',
      user.id
    )
    throw new Error('無効なユーザーIDです。再度ログインしてください。')
  }

  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ id: user.id, name: user.name, role: user.role })
  )
}

/**
 * セッションをクリアする（ログアウト時に使用）
 */
export function clearSession(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(SESSION_KEY)
}
