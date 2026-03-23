'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { User, Tournament } from '@/types/database'
import { getTournaments, upsertTournament } from '@/lib/data'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'
import { format, parseISO, differenceInDays } from 'date-fns'
import { ja } from 'date-fns/locale'

export default function TournamentPage() {
  const router = useRouter()
  const [user, setUser] = useState<Pick<User, 'id' | 'name' | 'role'> | null>(null)
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formDate, setFormDate] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const session = localStorage.getItem('rise_note_session')
    if (!session) { router.push('/login'); return }
    const userData = JSON.parse(session)
    if (userData.role !== 'staff') { router.push('/player/dashboard'); return }
    setUser(userData)
    getTournaments().then(t => { setTournaments(t); setLoading(false) })
  }, [router])

  const handleSave = async () => {
    if (!formName.trim() || !formDate) return
    setSaving(true)
    try {
      const result = await upsertTournament({
        ...(editingId ? { id: editingId } : {}),
        name: formName.trim(),
        target_date: formDate,
      })
      if (editingId) {
        setTournaments(prev => prev.map(t => t.id === editingId ? result : t))
      } else {
        setTournaments(prev => [...prev, result])
      }
      resetForm()
    } catch (e) { console.error(e); alert('保存に失敗しました') }
    finally { setSaving(false) }
  }

  const handleEdit = (tournament: Tournament) => {
    setEditingId(tournament.id); setFormName(tournament.name); setFormDate(tournament.target_date); setShowForm(true)
  }

  const resetForm = () => { setShowForm(false); setEditingId(null); setFormName(''); setFormDate('') }

  if (loading || !user) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-pulse text-brand-main text-xl font-bold">読み込み中...</div></div>
  }

  return (
    <div className="min-h-screen bg-brand-bg pb-20 md:pb-8">
      <Header userName={user.name} role="staff" />
      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-brand-dark">大会・目標設定</h2>
            <p className="text-xs text-gray-500">チーム全体の目標となる大会を管理します</p>
          </div>
          {!showForm && (
            <button onClick={() => setShowForm(true)} className="bg-brand-main text-brand-dark font-bold px-4 py-2 rounded-xl hover:bg-yellow-400 transition-colors text-sm shadow-md">+ 新規追加</button>
          )}
        </div>

        {showForm && (
          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-700">{editingId ? '大会を編集' : '新しい大会を追加'}</h3>
            <div>
              <label className="block text-xs text-gray-500 mb-1">大会名</label>
              <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="例: インターハイ予選"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-brand-main focus:outline-none text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">目標日</label>
              <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-brand-main focus:outline-none text-sm" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving || !formName.trim() || !formDate}
                className="flex-1 bg-brand-main text-brand-dark font-bold py-2.5 rounded-xl hover:bg-yellow-400 transition-colors disabled:opacity-50 text-sm">
                {saving ? '保存中...' : '保存する'}
              </button>
              <button onClick={resetForm} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors text-sm">キャンセル</button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {tournaments.length === 0 ? (
            <div className="text-center py-12 text-gray-500"><p className="text-4xl mb-3">🏆</p><p className="text-sm">まだ大会が登録されていません</p></div>
          ) : (
            tournaments.map(tournament => {
              const daysRemaining = differenceInDays(parseISO(tournament.target_date), new Date())
              const isPast = daysRemaining < 0
              return (
                <div key={tournament.id} className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-gray-800">{tournament.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">{format(parseISO(tournament.target_date), 'yyyy年M月d日(E)', { locale: ja })}</p>
                    </div>
                    <div className="text-right">
                      {!isPast ? (<><p className="text-2xl font-bold text-brand-main">{daysRemaining}</p><p className="text-xs text-gray-500">日後</p></>) : (<p className="text-sm text-gray-400">終了</p>)}
                    </div>
                  </div>
                  <button onClick={() => handleEdit(tournament)} className="mt-3 text-xs text-gray-500 hover:text-brand-main transition-colors">編集する →</button>
                </div>
              )
            })
          )}
        </div>
      </main>
      <BottomNav role="staff" />
    </div>
  )
}
