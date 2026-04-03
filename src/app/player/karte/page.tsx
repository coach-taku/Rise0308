'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { User, PhysicalRecord, MaxTrainingRecord } from '@/types/database'
import {
  getPhysicalRecords, savePhysicalRecord, deletePhysicalRecord,
  getMaxTrainingRecords, saveMaxTrainingRecord, deleteMaxTrainingRecord,
} from '@/lib/data'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { format, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'

// タブの種類
type TabType = 'physical' | 'max'

export default function KartePage() {
  const router = useRouter()
  const [user, setUser] = useState<Pick<User, 'id' | 'name' | 'role'> | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('physical')
  const [physicalRecords, setPhysicalRecords] = useState<PhysicalRecord[]>([])
  const [maxRecords, setMaxRecords] = useState<MaxTrainingRecord[]>([])
  const [loading, setLoading] = useState(true)

  // 入力フォーム表示制御
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // 身体測定フォーム
  const [formDate, setFormDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [formHeight, setFormHeight] = useState('')
  const [formWeight, setFormWeight] = useState('')
  const [formBodyFat, setFormBodyFat] = useState('')
  const [formMuscle, setFormMuscle] = useState('')

  // MAX測定フォーム
  const [formBench, setFormBench] = useState('')
  const [formSquat, setFormSquat] = useState('')
  const [formDeadlift, setFormDeadlift] = useState('')

  const [saving, setSaving] = useState(false)

  // データ読み込み
  const loadData = useCallback(async (userId: string) => {
    try {
      const [phys, max] = await Promise.all([
        getPhysicalRecords(userId),
        getMaxTrainingRecords(userId),
      ])
      setPhysicalRecords(phys)
      setMaxRecords(max)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const session = localStorage.getItem('rise_note_session')
    if (!session) { router.push('/login'); return }
    const userData = JSON.parse(session)
    if (userData.role === 'staff') { router.push('/coach/dashboard'); return }
    setUser(userData)
    loadData(userData.id)
  }, [router, loadData])

  // フォームリセット
  const resetForm = () => {
    setShowForm(false)
    setEditingId(null)
    setFormDate(format(new Date(), 'yyyy-MM-dd'))
    setFormHeight(''); setFormWeight(''); setFormBodyFat(''); setFormMuscle('')
    setFormBench(''); setFormSquat(''); setFormDeadlift('')
  }

  // 身体測定の編集開始
  const startEditPhysical = (record: PhysicalRecord) => {
    setActiveTab('physical')
    setEditingId(record.id)
    setFormDate(record.measured_date)
    setFormHeight(record.height_cm?.toString() || '')
    setFormWeight(record.weight_kg?.toString() || '')
    setFormBodyFat(record.body_fat_pct?.toString() || '')
    setFormMuscle(record.muscle_mass_kg?.toString() || '')
    setShowForm(true)
  }

  // MAX測定の編集開始
  const startEditMax = (record: MaxTrainingRecord) => {
    setActiveTab('max')
    setEditingId(record.id)
    setFormDate(record.measured_date)
    setFormBench(record.bench_press_kg?.toString() || '')
    setFormSquat(record.squat_kg?.toString() || '')
    setFormDeadlift(record.deadlift_kg?.toString() || '')
    setShowForm(true)
  }

  // 保存処理
  const handleSave = async () => {
    if (!user || !formDate) return
    setSaving(true)
    try {
      if (activeTab === 'physical') {
        const saved = await savePhysicalRecord({
          user_id: user.id,
          measured_date: formDate,
          height_cm: formHeight ? parseFloat(formHeight) : null,
          weight_kg: formWeight ? parseFloat(formWeight) : null,
          body_fat_pct: formBodyFat ? parseFloat(formBodyFat) : null,
          muscle_mass_kg: formMuscle ? parseFloat(formMuscle) : null,
        })
        // 保存後にリスト更新（リロード不要）
        setPhysicalRecords(prev => {
          const filtered = prev.filter(r => r.id !== saved.id && r.measured_date !== saved.measured_date)
          return [...filtered, saved].sort((a, b) => a.measured_date.localeCompare(b.measured_date))
        })
      } else {
        const saved = await saveMaxTrainingRecord({
          user_id: user.id,
          measured_date: formDate,
          bench_press_kg: formBench ? parseFloat(formBench) : null,
          squat_kg: formSquat ? parseFloat(formSquat) : null,
          deadlift_kg: formDeadlift ? parseFloat(formDeadlift) : null,
        })
        setMaxRecords(prev => {
          const filtered = prev.filter(r => r.id !== saved.id && r.measured_date !== saved.measured_date)
          return [...filtered, saved].sort((a, b) => a.measured_date.localeCompare(b.measured_date))
        })
      }
      resetForm()
    } catch (e) { console.error(e); alert('保存に失敗しました') }
    finally { setSaving(false) }
  }

  // 削除処理
  const handleDeletePhysical = async (record: PhysicalRecord) => {
    if (!confirm(`${record.measured_date} の身体測定データを削除しますか?`)) return
    try {
      await deletePhysicalRecord(record.id)
      setPhysicalRecords(prev => prev.filter(r => r.id !== record.id))
    } catch (e) { console.error(e); alert('削除に失敗しました') }
  }

  const handleDeleteMax = async (record: MaxTrainingRecord) => {
    if (!confirm(`${record.measured_date} のMAX測定データを削除しますか?`)) return
    try {
      await deleteMaxTrainingRecord(record.id)
      setMaxRecords(prev => prev.filter(r => r.id !== record.id))
    } catch (e) { console.error(e); alert('削除に失敗しました') }
  }

  // グラフ用データ
  const physicalChartData = physicalRecords.map(r => ({
    date: format(parseISO(r.measured_date), 'yy/M'),
    '体重(kg)': r.weight_kg,
    '体脂肪率(%)': r.body_fat_pct,
    '筋肉量(kg)': r.muscle_mass_kg,
  }))

  const maxChartData = maxRecords.map(r => ({
    date: format(parseISO(r.measured_date), 'yy/M'),
    'ベンチプレス(kg)': r.bench_press_kg,
    'スクワット(kg)': r.squat_kg,
    'デッドリフト(kg)': r.deadlift_kg,
  }))

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-brand-main text-xl font-bold">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-bg pb-20 md:pb-8">
      <Header userName={user.name} role="player" />
      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* ページタイトル */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-brand-dark">カルテ</h2>
              <p className="text-xs text-gray-500">身体データ・MAX測定の記録と推移</p>
            </div>
            {!showForm && (
              <button
                onClick={() => { resetForm(); setShowForm(true) }}
                className="bg-brand-main text-brand-dark font-bold px-4 py-2 rounded-xl hover:bg-yellow-400 transition-colors text-sm shadow-md"
              >
                + 新規記録
              </button>
            )}
          </div>
        </div>

        {/* タブ切り替え */}
        <div className="flex gap-2">
          <button
            onClick={() => { setActiveTab('physical'); if (showForm && !editingId) resetForm() }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'physical'
                ? 'bg-brand-main text-brand-dark shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            身体測定
          </button>
          <button
            onClick={() => { setActiveTab('max'); if (showForm && !editingId) resetForm() }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'max'
                ? 'bg-brand-main text-brand-dark shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            MAX測定
          </button>
        </div>

        {/* 入力フォーム */}
        {showForm && (
          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-700">
              {editingId ? 'データを編集' : '新しいデータを記録'}
            </h3>

            {/* 測定日 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">測定日</label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-brand-main focus:outline-none text-sm"
              />
            </div>

            {activeTab === 'physical' ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">身長 (cm)</label>
                    <input type="number" step="0.1" value={formHeight} onChange={(e) => setFormHeight(e.target.value)}
                      placeholder="例: 165.0"
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-brand-main focus:outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">体重 (kg)</label>
                    <input type="number" step="0.1" value={formWeight} onChange={(e) => setFormWeight(e.target.value)}
                      placeholder="例: 58.0"
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-brand-main focus:outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">体脂肪率 (%)</label>
                    <input type="number" step="0.1" value={formBodyFat} onChange={(e) => setFormBodyFat(e.target.value)}
                      placeholder="例: 20.0"
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-brand-main focus:outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">筋肉量 (kg)</label>
                    <input type="number" step="0.1" value={formMuscle} onChange={(e) => setFormMuscle(e.target.value)}
                      placeholder="例: 43.0"
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-brand-main focus:outline-none text-sm" />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">ベンチプレス (kg)</label>
                    <input type="number" step="0.5" value={formBench} onChange={(e) => setFormBench(e.target.value)}
                      placeholder="例: 40.0"
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-brand-main focus:outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">スクワット (kg)</label>
                    <input type="number" step="0.5" value={formSquat} onChange={(e) => setFormSquat(e.target.value)}
                      placeholder="例: 60.0"
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-brand-main focus:outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">デッドリフト (kg)</label>
                    <input type="number" step="0.5" value={formDeadlift} onChange={(e) => setFormDeadlift(e.target.value)}
                      placeholder="例: 70.0"
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-brand-main focus:outline-none text-sm" />
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving || !formDate}
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

        {/* グラフ */}
        {activeTab === 'physical' && physicalChartData.length >= 2 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">身体測定の推移</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={physicalChartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line type="monotone" dataKey="体重(kg)" stroke="#e1c614" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="体脂肪率(%)" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="筋肉量(kg)" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {activeTab === 'max' && maxChartData.length >= 2 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">MAX測定の推移</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={maxChartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line type="monotone" dataKey="ベンチプレス(kg)" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="スクワット(kg)" stroke="#e1c614" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="デッドリフト(kg)" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* データが1件以下の場合のメッセージ */}
        {activeTab === 'physical' && physicalChartData.length < 2 && physicalChartData.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm text-center">
            <p className="text-sm text-gray-500">グラフを表示するには2回以上の記録が必要です</p>
          </div>
        )}
        {activeTab === 'max' && maxChartData.length < 2 && maxChartData.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm text-center">
            <p className="text-sm text-gray-500">グラフを表示するには2回以上の記録が必要です</p>
          </div>
        )}

        {/* 履歴リスト */}
        {activeTab === 'physical' && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">身体測定の記録一覧</h3>
            {physicalRecords.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-3xl mb-2">📏</p>
                <p className="text-sm text-gray-500">まだ記録がありません</p>
                <p className="text-xs text-gray-400 mt-1">「+ 新規記録」から測定結果を登録しましょう</p>
              </div>
            ) : (
              <div className="space-y-2">
                {[...physicalRecords].reverse().map(record => (
                  <div key={record.id} className="border border-gray-100 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-800">
                        {format(parseISO(record.measured_date), 'yyyy年M月d日', { locale: ja })}
                      </span>
                      <div className="flex gap-1">
                        <button onClick={() => startEditPhysical(record)}
                          className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1">編集</button>
                        <button onClick={() => handleDeletePhysical(record)}
                          className="text-xs text-red-400 hover:text-red-600 px-2 py-1">削除</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="bg-gray-50 rounded-lg p-1.5">
                        <p className="text-xs text-gray-500">身長</p>
                        <p className="text-sm font-bold text-brand-dark">{record.height_cm ?? '-'}<span className="text-xs font-normal">cm</span></p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-1.5">
                        <p className="text-xs text-gray-500">体重</p>
                        <p className="text-sm font-bold text-brand-dark">{record.weight_kg ?? '-'}<span className="text-xs font-normal">kg</span></p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-1.5">
                        <p className="text-xs text-gray-500">体脂肪</p>
                        <p className="text-sm font-bold text-brand-dark">{record.body_fat_pct ?? '-'}<span className="text-xs font-normal">%</span></p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-1.5">
                        <p className="text-xs text-gray-500">筋肉量</p>
                        <p className="text-sm font-bold text-brand-dark">{record.muscle_mass_kg ?? '-'}<span className="text-xs font-normal">kg</span></p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'max' && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">MAX測定の記録一覧</h3>
            {maxRecords.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-3xl mb-2">🏋️</p>
                <p className="text-sm text-gray-500">まだ記録がありません</p>
                <p className="text-xs text-gray-400 mt-1">「+ 新規記録」から測定結果を登録しましょう</p>
              </div>
            ) : (
              <div className="space-y-2">
                {[...maxRecords].reverse().map(record => (
                  <div key={record.id} className="border border-gray-100 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-800">
                        {format(parseISO(record.measured_date), 'yyyy年M月d日', { locale: ja })}
                      </span>
                      <div className="flex gap-1">
                        <button onClick={() => startEditMax(record)}
                          className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1">編集</button>
                        <button onClick={() => handleDeleteMax(record)}
                          className="text-xs text-red-400 hover:text-red-600 px-2 py-1">削除</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-blue-50 rounded-lg p-1.5">
                        <p className="text-xs text-gray-500">ベンチプレス</p>
                        <p className="text-sm font-bold text-brand-dark">{record.bench_press_kg ?? '-'}<span className="text-xs font-normal">kg</span></p>
                      </div>
                      <div className="bg-yellow-50 rounded-lg p-1.5">
                        <p className="text-xs text-gray-500">スクワット</p>
                        <p className="text-sm font-bold text-brand-dark">{record.squat_kg ?? '-'}<span className="text-xs font-normal">kg</span></p>
                      </div>
                      <div className="bg-red-50 rounded-lg p-1.5">
                        <p className="text-xs text-gray-500">デッドリフト</p>
                        <p className="text-sm font-bold text-brand-dark">{record.deadlift_kg ?? '-'}<span className="text-xs font-normal">kg</span></p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
      <BottomNav role="player" />
    </div>
  )
}
