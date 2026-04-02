'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getUsers, loginUser } from '@/lib/data'
import { User } from '@/types/database'

export default function LoginPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [selectedName, setSelectedName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  // ユーザー一覧の読み込み中状態を管理する
  const [loadingUsers, setLoadingUsers] = useState(true)
  // ユーザー一覧の取得エラーを管理する（接続失敗などを画面に表示するため）
  const [fetchError, setFetchError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // すでにログイン済みであれば該当画面に遷移する
    const session = localStorage.getItem('rise_note_session')
    if (session) {
      const user = JSON.parse(session) as User
      router.push(user.role === 'staff' ? '/coach/dashboard' : '/player/dashboard')
      return
    }

    // ユーザー一覧をデータベースから取得する
    setLoadingUsers(true)
    setFetchError('')
    getUsers()
      .then((data) => {
        setUsers(data)
        if (data.length === 0) {
          // データは取得できたが件数が0件の場合
          setFetchError('登録済みのユーザーが見つかりませんでした。管理者に連絡してください。')
        }
      })
      .catch((err) => {
        // Supabase 接続エラーや設定ミスの場合
        console.error('[LoginPage] ユーザー一覧の取得に失敗しました:', err)
        setFetchError(
          'ユーザー情報の読み込みに失敗しました。\n' +
          'ネットワーク接続を確認するか、管理者にお問い合わせください。'
        )
      })
      .finally(() => {
        setLoadingUsers(false)
      })
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!selectedName) { setError('名前を選択してください'); return }
    if (!password) { setError('合言葉を入力してください'); return }

    setLoading(true)
    try {
      const user = await loginUser(selectedName, password)
      if (user) {
        localStorage.setItem('rise_note_session', JSON.stringify({
          id: user.id,
          name: user.name,
          role: user.role,
        }))
        router.push(user.role === 'staff' ? '/coach/dashboard' : '/player/dashboard')
      } else {
        setError('合言葉が正しくありません')
      }
    } catch {
      setError('ログインに失敗しました。しばらくしてからもう一度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'linear-gradient(135deg, #333333 0%, #555555 100%)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-block bg-brand-main text-brand-dark px-6 py-3 rounded-xl mb-4">
            <h1 className="text-2xl font-bold tracking-wider">KUKI GYMRATS</h1>
            <p className="text-3xl font-bold tracking-widest">RISE NOTE</p>
          </div>
          <p className="text-gray-300 text-sm mt-3">本気になれば、何者にもなれる</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-2xl p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">名前を選択</label>

            {/* ユーザー一覧読み込み中の表示 */}
            {loadingUsers && (
              <div className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-gray-50 text-gray-400 text-sm">
                読み込み中...
              </div>
            )}

            {/* ユーザー一覧取得エラーの表示 */}
            {!loadingUsers && fetchError && (
              <div className="w-full px-4 py-3 rounded-xl border-2 border-red-200 bg-red-50 text-red-600 text-sm whitespace-pre-line">
                {fetchError}
              </div>
            )}

            {/* 正常にユーザー一覧を取得できた場合のプルダウン */}
            {!loadingUsers && !fetchError && (
              <select
                value={selectedName}
                onChange={(e) => setSelectedName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-main focus:outline-none transition-colors bg-gray-50 text-gray-800 text-base"
              >
                <option value="">-- 選択してください --</option>
                <optgroup label="選手">
                  {users.filter(u => u.role === 'player').map(u => (
                    <option key={u.id} value={u.name}>{u.name}</option>
                  ))}
                </optgroup>
                <optgroup label="スタッフ">
                  {users.filter(u => u.role === 'staff').map(u => (
                    <option key={u.id} value={u.name}>{u.name}</option>
                  ))}
                </optgroup>
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">合言葉</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="チームの合言葉を入力"
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-main focus:outline-none transition-colors bg-gray-50 text-base"
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center bg-red-50 py-2 rounded-lg">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading || loadingUsers || !!fetchError}
            className="w-full bg-brand-main text-brand-dark font-bold py-3 rounded-xl hover:bg-yellow-400 transition-colors disabled:opacity-50 text-lg shadow-md"
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>

        <p className="text-center text-gray-400 text-xs mt-6">KUKI GYMRATS BASKETBALL CLUB</p>
      </div>
    </div>
  )
}
