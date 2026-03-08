'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Profile, MandalaChart } from '@/types/database'
import { getMandalaChart, saveMandalaChart } from '@/lib/data'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'

const COLORS = [
  'bg-yellow-100 border-yellow-300',
  'bg-blue-100 border-blue-300',
  'bg-green-100 border-green-300',
  'bg-pink-100 border-pink-300',
  'bg-purple-100 border-purple-300',
  'bg-orange-100 border-orange-300',
  'bg-teal-100 border-teal-300',
  'bg-red-100 border-red-300',
]

export default function MandalaPage() {
  const router = useRouter()
  const [user, setUser] = useState<Profile | null>(null)
  const [coreGoal, setCoreGoal] = useState('')
  const [mainElements, setMainElements] = useState<string[]>(Array(8).fill(''))
  const [subGoals, setSubGoals] = useState<string[][]>(Array(8).fill(null).map(() => Array(8).fill('')))
  const [selectedBlock, setSelectedBlock] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const session = localStorage.getItem('rise_note_session')
    if (!session) { router.push('/login'); return }
    const userData = JSON.parse(session) as Profile
    if (userData.role !== 'player') { router.push('/coach/dashboard'); return }
    setUser(userData)

    getMandalaChart(userData.id).then(chart => {
      if (chart) {
        setCoreGoal(chart.core_goal)
        setMainElements(chart.main_elements)
        setSubGoals(chart.sub_goals)
      }
      setLoading(false)
    })
  }, [router])

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    try {
      await saveMandalaChart({
        user_id: user.id,
        core_goal: coreGoal,
        main_elements: mainElements,
        sub_goals: subGoals,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const updateMainElement = (index: number, value: string) => {
    const updated = [...mainElements]
    updated[index] = value
    setMainElements(updated)
  }

  const updateSubGoal = (blockIndex: number, goalIndex: number, value: string) => {
    const updated = subGoals.map(row => [...row])
    updated[blockIndex][goalIndex] = value
    setSubGoals(updated)
  }

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

      <main className="max-w-4xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-brand-dark">マンダラチャート</h2>
            <p className="text-xs text-gray-500">目標を明確にして、成長の地図を作ろう</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-brand-main text-brand-dark font-bold px-5 py-2 rounded-xl hover:bg-yellow-400 transition-colors disabled:opacity-50 text-sm shadow-md"
          >
            {saving ? '保存中...' : saved ? '保存しました!' : '保存する'}
          </button>
        </div>

        {/* Overview - 3x3 grid showing core + 8 main elements */}
        {selectedBlock === null && (
          <>
            <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
              <p className="text-xs text-gray-500 mb-2 font-medium">コア目標（中心にある最大の目標）</p>
              <input
                type="text"
                value={coreGoal}
                onChange={(e) => setCoreGoal(e.target.value)}
                placeholder="例: インターハイ出場"
                className="w-full text-center text-lg font-bold px-4 py-3 rounded-xl border-2 border-brand-main bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-brand-main"
              />
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {[0, 1, 2, 3, -1, 4, 5, 6, 7].map((idx, gridPos) => {
                if (idx === -1) {
                  // Center cell - core goal
                  return (
                    <div key="core" className="bg-brand-main rounded-xl p-3 flex items-center justify-center min-h-[80px] shadow-md">
                      <p className="text-sm font-bold text-brand-dark text-center leading-tight">
                        {coreGoal || 'コア目標'}
                      </p>
                    </div>
                  )
                }
                const filledCount = subGoals[idx].filter(g => g.trim()).length
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedBlock(idx)}
                    className={`${COLORS[idx]} border-2 rounded-xl p-3 min-h-[80px] flex flex-col items-center justify-center card-hover`}
                  >
                    <p className="text-xs font-bold text-gray-700 text-center leading-tight">
                      {mainElements[idx] || `要素 ${idx + 1}`}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{filledCount}/8</p>
                  </button>
                )
              })}
            </div>

            <p className="text-center text-xs text-gray-500">
              各要素をタップして、具体的な目標を設定しましょう
            </p>
          </>
        )}

        {/* Detail view for a specific block */}
        {selectedBlock !== null && (
          <div className="space-y-4">
            <button
              onClick={() => setSelectedBlock(null)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <span>←</span>
              <span className="text-sm">全体に戻る</span>
            </button>

            <div className={`${COLORS[selectedBlock]} border-2 rounded-2xl p-4`}>
              <p className="text-xs text-gray-500 mb-2">主要要素 {selectedBlock + 1}</p>
              <input
                type="text"
                value={mainElements[selectedBlock]}
                onChange={(e) => updateMainElement(selectedBlock, e.target.value)}
                placeholder={`要素 ${selectedBlock + 1} の名前`}
                className="w-full text-center font-bold px-4 py-3 rounded-xl border-2 border-white bg-white focus:outline-none focus:ring-2 focus:ring-brand-main text-lg"
              />
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-sm font-semibold text-gray-700 mb-3">
                「{mainElements[selectedBlock] || `要素 ${selectedBlock + 1}`}」の具体的な目標・行動（8つ）
              </p>
              <div className="grid grid-cols-1 gap-2">
                {subGoals[selectedBlock].map((goal, goalIdx) => (
                  <div key={goalIdx} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-5 text-center font-mono">{goalIdx + 1}</span>
                    <input
                      type="text"
                      value={goal}
                      onChange={(e) => updateSubGoal(selectedBlock, goalIdx, e.target.value)}
                      placeholder={`具体的な目標・行動 ${goalIdx + 1}`}
                      className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 focus:border-brand-main focus:outline-none text-sm bg-gray-50"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      <BottomNav role="player" />
    </div>
  )
}
