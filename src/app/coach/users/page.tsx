'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { User } from '@/types/database'
import { getUsers, createUser, updateUser, updateUserPassword } from '@/lib/data'
import { getSession } from '@/lib/session'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'

// 編集フォームの初期値
const EMPTY_FORM = {
  name: '',
  role: 'player' as 'player' | 'staff',
  position: '',
  password: '',
}

export default function UsersPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<Pick<User, 'id' | 'name' | 'role'> | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  // 新規登録・編集フォームの表示制御
  const [showForm, setShowForm] = useState(false)
  // 編集対象のユーザーID（nullなら新規登録）
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // パスワード変更モーダルの状態
  const [passwordTargetId, setPasswordTargetId] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  // 操作結果のフィードバックメッセージ
  const [successMsg, setSuccessMsg] = useState('')

  // 選手名検索キーワード
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const session = getSession()
    // 未ログインまたはスタッフ以外はリダイレクト
    if (!session) { router.push('/login'); return }
    if (session.role !== 'staff') { router.push('/player/dashboard'); return }
    setCurrentUser(session)
    loadUsers()
  }, [router])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const data = await getUsers()
      setUsers(data)
    } catch (e) {
      console.error('[UsersPage] ユーザー一覧の取得に失敗しました:', e)
    } finally {
      setLoading(false)
    }
  }

  // フォームを閉じてリセットする
  const resetForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError('')
  }

  // 編集ボタンを押したときにフォームを開く
  const handleEdit = (user: User) => {
    setEditingId(user.id)
    setForm({
      name: user.name,
      role: user.role,
      position: user.position || '',
      password: '',  // パスワードは編集フォームでは表示しない（別途変更）
    })
    setFormError('')
    setShowForm(true)
  }

  // 新規登録・編集の保存
  const handleSave = async () => {
    setFormError('')
    if (!form.name.trim()) { setFormError('名前を入力してください'); return }
    if (!editingId && !form.password.trim()) { setFormError('パスワードを入力してください'); return }

    setSaving(true)
    try {
      if (editingId) {
        // 既存ユーザーの基本情報を更新
        const updated = await updateUser(editingId, {
          name: form.name.trim(),
          role: form.role,
          position: form.position.trim() || undefined,
        })
        setUsers(prev => prev.map(u => u.id === editingId ? { ...u, ...updated } : u))
        showSuccess('ユーザー情報を更新しました')
      } else {
        // 新規ユーザーを登録
        const created = await createUser({
          name: form.name.trim(),
          role: form.role,
          password: form.password.trim(),
          position: form.position.trim() || undefined,
        })
        setUsers(prev => [...prev, created])
        showSuccess('新しいユーザーを登録しました')
      }
      resetForm()
    } catch (e) {
      console.error('[UsersPage] 保存に失敗しました:', e)
      setFormError('保存に失敗しました。もう一度お試しください。')
    } finally {
      setSaving(false)
    }
  }

  // パスワード変更モーダルを開く
  const handleOpenPasswordModal = (userId: string) => {
    setPasswordTargetId(userId)
    setNewPassword('')
    setPasswordError('')
  }

  // パスワード変更の保存
  const handlePasswordSave = async () => {
    setPasswordError('')
    if (!newPassword.trim()) { setPasswordError('新しいパスワードを入力してください'); return }
    if (newPassword.trim().length < 4) { setPasswordError('パスワードは4文字以上で設定してください'); return }
    if (!passwordTargetId) return

    setPasswordSaving(true)
    try {
      await updateUserPassword(passwordTargetId, newPassword.trim())
      setPasswordTargetId(null)
      setNewPassword('')
      showSuccess('パスワードを変更しました')
    } catch (e) {
      console.error('[UsersPage] パスワード変更に失敗しました:', e)
      setPasswordError('パスワードの変更に失敗しました。もう一度お試しください。')
    } finally {
      setPasswordSaving(false)
    }
  }

  // 成功メッセージを一定時間後に消す
  const showSuccess = (msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  // 検索キーワードを正規化（全角スペース→半角・前後空白除去・小文字化）
  const normalizeText = (text: string) =>
    text.replace(/　/g, ' ').trim().toLowerCase()

  const normalizedQuery = normalizeText(searchQuery)

  // 全ユーザーをロール別に分類し、検索キーワードで絞り込む
  const allPlayers = users.filter(u => u.role === 'player')
  const allStaffs = users.filter(u => u.role === 'staff')

  const players = normalizedQuery
    ? allPlayers.filter(u => normalizeText(u.name).includes(normalizedQuery))
    : allPlayers

  const staffs = normalizedQuery
    ? allStaffs.filter(u => normalizeText(u.name).includes(normalizedQuery))
    : allStaffs

  // パスワード変更対象のユーザー名を取得
  const passwordTargetName = users.find(u => u.id === passwordTargetId)?.name || ''

  if (loading || !currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-brand-main text-xl font-bold">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-bg pb-24 md:pb-8">
      <Header userName={currentUser.name} role="staff" />

      <main className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {/* ページタイトル */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-brand-dark">ユーザー管理</h2>
            <p className="text-xs text-gray-500">選手・スタッフの登録・情報修正・パスワード変更ができます</p>
          </div>
          {!showForm && (
            <button
              onClick={() => { resetForm(); setShowForm(true) }}
              className="bg-brand-main text-brand-dark font-bold px-4 py-2 rounded-xl hover:bg-yellow-400 transition-colors text-sm shadow-md"
            >
              + 新規登録
            </button>
          )}
        </div>

        {/* 選手名検索ボックス */}
        <div className="relative">
          <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400">
            🔍
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="選手名で検索..."
            className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-gray-200 focus:border-brand-main focus:outline-none text-sm bg-white shadow-sm"
          />
          {/* 検索欄クリアボタン */}
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors text-xs"
              aria-label="検索をクリア"
            >
              ✕
            </button>
          )}
        </div>

        {/* 成功メッセージ */}
        {successMsg && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl">
            ✅ {successMsg}
          </div>
        )}

        {/* 新規登録・編集フォーム */}
        {showForm && (
          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-700">
              {editingId ? 'ユーザー情報を編集' : '新しいユーザーを登録'}
            </h3>

            {/* 名前 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">名前 <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="例: 山田 花子"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-brand-main focus:outline-none text-sm"
              />
            </div>

            {/* ロール */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">ロール <span className="text-red-500">*</span></label>
              <select
                value={form.role}
                onChange={(e) => setForm(prev => ({ ...prev, role: e.target.value as 'player' | 'staff' }))}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-brand-main focus:outline-none text-sm bg-white"
              >
                <option value="player">選手（プレイヤー）</option>
                <option value="staff">スタッフ（コーチ・監督）</option>
              </select>
            </div>

            {/* ポジション（選手のみ） */}
            {form.role === 'player' && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">ポジション</label>
                <input
                  type="text"
                  value={form.position}
                  onChange={(e) => setForm(prev => ({ ...prev, position: e.target.value }))}
                  placeholder="例: PG / SG / SF / PF / C"
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-brand-main focus:outline-none text-sm"
                />
              </div>
            )}

            {/* パスワード（新規登録時のみ） */}
            {!editingId && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">パスワード <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.password}
                  onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="初期パスワードを設定"
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-brand-main focus:outline-none text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">※ 登録後はユーザー一覧からパスワードを変更できます</p>
              </div>
            )}

            {formError && (
              <div className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{formError}</div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-brand-main text-brand-dark font-bold py-2.5 rounded-xl hover:bg-yellow-400 transition-colors disabled:opacity-50 text-sm"
              >
                {saving ? '保存中...' : '保存する'}
              </button>
              <button
                onClick={resetForm}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors text-sm"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        {/* 選手一覧 */}
        <section>
          <h3 className="text-sm font-bold text-gray-600 mb-2">
            選手（{players.length}名{normalizedQuery ? ` / 全${allPlayers.length}名` : ''}）
          </h3>
          <div className="space-y-2">
            {players.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm bg-white rounded-xl">
                {normalizedQuery
                  ? '該当する選手が見つかりません'
                  : '登録されている選手がいません'}
              </div>
            ) : (
              players.map(user => (
                <UserCard
                  key={user.id}
                  user={user}
                  onEdit={() => handleEdit(user)}
                  onChangePassword={() => handleOpenPasswordModal(user.id)}
                />
              ))
            )}
          </div>
        </section>

        {/* スタッフ一覧（検索中は表示しない） */}
        {!normalizedQuery && (
          <section>
            <h3 className="text-sm font-bold text-gray-600 mb-2">
              スタッフ（{staffs.length}名）
            </h3>
            <div className="space-y-2">
              {staffs.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm bg-white rounded-xl">
                  登録されているスタッフがいません
                </div>
              ) : (
                staffs.map(user => (
                  <UserCard
                    key={user.id}
                    user={user}
                    onEdit={() => handleEdit(user)}
                    onChangePassword={() => handleOpenPasswordModal(user.id)}
                  />
                ))
              )}
            </div>
          </section>
        )}
      </main>

      {/* パスワード変更モーダル */}
      {passwordTargetId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-gray-700">
              パスワードを変更
            </h3>
            <p className="text-xs text-gray-500">
              対象: <span className="font-semibold text-gray-700">{passwordTargetName}</span>
            </p>

            <div>
              <label className="block text-xs text-gray-500 mb-1">新しいパスワード</label>
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="新しいパスワードを入力"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-brand-main focus:outline-none text-sm"
                autoFocus
              />
            </div>

            {passwordError && (
              <div className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{passwordError}</div>
            )}

            <p className="text-xs text-gray-400">
              ※ 変更後、該当ユーザーは次回ログイン時から新しいパスワードでのみログインできます
            </p>

            <div className="flex gap-2">
              <button
                onClick={handlePasswordSave}
                disabled={passwordSaving}
                className="flex-1 bg-brand-main text-brand-dark font-bold py-2.5 rounded-xl hover:bg-yellow-400 transition-colors disabled:opacity-50 text-sm"
              >
                {passwordSaving ? '変更中...' : '変更する'}
              </button>
              <button
                onClick={() => { setPasswordTargetId(null); setNewPassword(''); setPasswordError('') }}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors text-sm"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav role="staff" />
    </div>
  )
}

// ユーザー1件分のカードコンポーネント
function UserCard({
  user,
  onEdit,
  onChangePassword,
}: {
  user: User
  onEdit: () => void
  onChangePassword: () => void
}) {
  // パスワードを表示/非表示する状態
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-800 text-sm">{user.name}</span>
            {user.position && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {user.position}
              </span>
            )}
          </div>
          {/* パスワード表示欄 */}
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="text-xs text-gray-500">パスワード:</span>
            <span className="text-xs font-mono text-gray-700">
              {showPassword ? user.password : '●'.repeat(Math.min(user.password?.length || 0, 8))}
            </span>
            <button
              onClick={() => setShowPassword(prev => !prev)}
              className="text-xs text-gray-400 hover:text-brand-main transition-colors underline"
            >
              {showPassword ? '隠す' : '表示'}
            </button>
          </div>
        </div>
        {/* 操作ボタン */}
        <div className="flex gap-1.5 ml-2 flex-shrink-0">
          <button
            onClick={onEdit}
            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg transition-colors"
          >
            編集
          </button>
          <button
            onClick={onChangePassword}
            className="text-xs bg-brand-main hover:bg-yellow-400 text-brand-dark font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            PW変更
          </button>
        </div>
      </div>
    </div>
  )
}
