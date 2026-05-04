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

// トースト通知の型
type ToastType = 'success' | 'error'
interface Toast {
  id: number
  type: ToastType
  message: string
}

export default function KartePage() {
  const router = useRouter()
  const [user, setUser] = useState<Pick<User, 'id' | 'name' | 'role'> | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('physical')
  const [physicalRecords, setPhysicalRecords] = useState<PhysicalRecord[]>([])
  const [maxRecords, setMaxRecords] = useState<MaxTrainingRecord[]>([])
  const [loading, setLoading] = useState(true)

  // トースト通知
  const [toasts, setToasts] = useState<Toast[]>([])

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

  // --- トースト通知ヘルパー ---
  const showToast = useCallback((type: ToastType, message: string) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, type, message }])
    // 3秒後に自動で消す
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  // --- データ読み込み ---
  const loadData = useCallback(async (userId: string) => {
    try {
      const [phys, max] = await Promise.all([
        getPhysicalRecords(userId),
        getMaxTrainingRecords(userId),
      ])
      setPhysicalRecords(phys)
      setMaxRecords(max)
    } catch (e) {
      console.error('[KartePage] データ読み込みエラー:', e)
      showToast('error', 'データの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    const session = localStorage.getItem('rise_note_session')
    if (!session) { router.push('/login'); return }
    const userData = JSON.parse(session)
    if (userData.role === 'staff') { router.push('/coach/dashboard'); return }
    setUser(userData)
    loadData(userData.id)
  }, [router, loadData])

  // --- フォームリセット ---
  const resetForm = () => {
    setShowForm(false)
    setEditingId(null)
    setFormDate(format(new Date(), 'yyyy-MM-dd'))
    setFormHeight(''); setFormWeight(''); setFormBodyFat(''); setFormMuscle('')
    setFormBench(''); setFormSquat(''); setFormDeadlift('')
  }

  // --- 身体測定の編集開始 ---
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

  // --- MAX測定の編集開始 ---
  const startEditMax = (record: MaxTrainingRecord) => {
    setActiveTab('max')
    setEditingId(record.id)
    setFormDate(record.measured_date)
    setFormBench(record.bench_press_kg?.toString() || '')
    setFormSquat(record.squat_kg?.toString() || '')
    setFormDeadlift(record.deadlift_kg?.toString() || '')
    setShowForm(true)
  }

  // --- 保存処理 ---
  const handleSave = async () => {
    if (!user) return

    // バリデーション: 測定日は必須
    if (!formDate) {
      showToast('error', '測定日を入力してください')
      return
    }

    // バリデーション: 少なくとも1つの値が入力されていること
    if (activeTab === 'physical') {
      if (!formHeight && !formWeight && !formBodyFat && !formMuscle) {
        showToast('error', '少なくとも1つの測定値を入力してください')
        return
      }
    } else {
      if (!formBench && !formSquat && !formDeadlift) {
        showToast('error', '少なくとも1つの測定値を入力してください')
        return
      }
    }

    setSaving(true)
    try {
      if (activeTab === 'physical') {
        // 編集時は editingId を渡してIDベースの更新を行う
        const saved = await savePhysicalRecord(
          {
            user_id: user.id,
            measured_date: formDate,
            height_cm: formHeight ? parseFloat(formHeight) : null,
            weight_kg: formWeight ? parseFloat(formWeight) : null,
            body_fat_pct: formBodyFat ? parseFloat(formBodyFat) : null,
            muscle_mass_kg: formMuscle ? parseFloat(formMuscle) : null,
          },
          editingId // 編集時は既存IDを渡す
        )
        // 保存後にローカルのリストを即時更新（グラフ・履歴に即反映）
        setPhysicalRecords(prev => {
          const filtered = prev.filter(r => {
            if (editingId && r.id === editingId) return false
            if (r.id === saved.id) return false
            if (r.measured_date === saved.measured_date) return false
            return true
          })
          return [...filtered, saved].sort((a, b) => a.measured_date.localeCompare(b.measured_date))
        })
        showToast('success', editingId ? '身体測定データを更新しました' : '身体測定データを保存しました')
      } else {
        // MAX測定の保存
        const saved = await saveMaxTrainingRecord(
          {
            user_id: user.id,
            measured_date: formDate,
            bench_press_kg: formBench ? parseFloat(formBench) : null,
            squat_kg: formSquat ? parseFloat(formSquat) : null,
            deadlift_kg: formDeadlift ? parseFloat(formDeadlift) : null,
          },
          editingId // 編集時は既存IDを渡す
        )
        setMaxRecords(prev => {
          const filtered = prev.filter(r => {
            if (editingId && r.id === editingId) return false
            if (r.id === saved.id) return false
            if (r.measured_date === saved.measured_date) return false
            return true
          })
          return [...filtered, saved].sort((a, b) => a.measured_date.localeCompare(b.measured_date))
        })
        showToast('success', editingId ? 'MAX測定データを更新しました' : 'MAX測定データを保存しました')
      }
      resetForm()
      // 保存成功後にサーバーから最新データを再取得（グラフ・履歴の整合性保証）
      try {
        const [phys, max] = await Promise.all([
          getPhysicalRecords(user.id),
          getMaxTrainingRecords(user.id),
        ])
        setPhysicalRecords(phys)
        setMaxRecords(max)
      } catch (reloadErr) {
        console.warn('[KartePage] 保存後のデータ再取得に失敗 (ローカルデータは最新):', reloadErr)
      }
    } catch (e) {
      console.error('[KartePage] 保存エラー:', e)
      const errorMessage = e instanceof Error ? e.message : '不明なエラー'
      // エラーメッセージが長すぎる場合は短縮
      const displayMessage = errorMessage.length > 100 ? errorMessage.substring(0, 100) + '...' : errorMessage
      showToast('error', `保存に失敗しました: ${displayMessage}`)
    } finally {
      setSaving(false)
    }
  }

  // --- 削除処理 ---
  const handleDeletePhysical = async (record: PhysicalRecord) => {
    if (!confirm(`${format(parseISO(record.measured_date), 'yyyy年M月d日', { locale: ja })} の身体測定データを削除しますか?`)) return
    try {
      await deletePhysicalRecord(record.id)
      setPhysicalRecords(prev => prev.filter(r => r.id !== record.id))
      showToast('success', '身体測定データを削除しました')
    } catch (e) {
      console.error('[KartePage] 削除エラー:', e)
      const errorMessage = e instanceof Error ? e.message : '不明なエラー'
      showToast('error', `削除に失敗しました: ${errorMessage}`)
    }
  }

  const handleDeleteMax = async (record: MaxTrainingRecord) => {
    if (!confirm(`${format(parseISO(record.measured_date), 'yyyy年M月d日', { locale: ja })} のMAX測定データを削除しますか?`)) return
    try {
      await deleteMaxTrainingRecord(record.id)
      setMaxRecords(prev => prev.filter(r => r.id !== record.id))
      showToast('success', 'MAX測定データを削除しました')
    } catch (e) {
      console.error('[KartePage] 削除エラー:', e)
      const errorMessage = e instanceof Error ? e.message : '不明なエラー'
      showToast('error', `削除に失敗しました: ${errorMessage}`)
    }
  }

  // --- グラフ用データ ---
  const physicalChartData = physicalRecords.map(r => ({
    date: format(parseISO(r.measured_date), 'yy/M/d'),
    '体重(kg)': r.weight_kg,
    '体脂肪率(%)': r.body_fat_pct,
    '筋肉量(kg)': r.muscle_mass_kg,
  }))

  const maxChartData = maxRecords.map(r => ({
    date: format(parseISO(r.measured_date), 'yy/M/d'),
    'ベンチプレス(kg)': r.bench_press_kg,
    'スクワット(kg)': r.squat_kg,
    'デッドリフト(kg)': r.deadlift_kg,
  }))

  // --- ローディング表示 ---
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

      {/* トースト通知 */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-slide-in flex items-center gap-2 max-w-xs ${
              toast.type === 'success'
                ? 'bg-green-500 text-white'
                : 'bg-red-500 text-white'
            }`}
            onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
          >
            <span>{toast.type === 'success' ? '✅' : '❌'}</span>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

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
              <label className="block text-xs text-gray-500 mb-1">測定日 <span className="text-red-400">*</span></label>
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
                {saving ? '保存中...' : editingId ? '更新する' : '保存する'}
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
                <Line type="monotone" dataKey="体重(kg)" stroke="#e1c614" strokeWidth={2} dot={{ r: 4 }} connectNulls />
                <Line type="monotone" dataKey="体脂肪率(%)" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} connectNulls />
                <Line type="monotone" dataKey="筋肉量(kg)" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} connectNulls />
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
                <Line type="monotone" dataKey="ベンチプレス(kg)" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} connectNulls />
                <Line type="monotone" dataKey="スクワット(kg)" stroke="#e1c614" strokeWidth={2} dot={{ r: 4 }} connectNulls />
                <Line type="monotone" dataKey="デッドリフト(kg)" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} connectNulls />
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

        {/* 履歴リスト: 身体測定 */}
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

        {/* 履歴リスト: MAX測定 */}
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
