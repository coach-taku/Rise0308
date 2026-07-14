'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { User, MandalaChart, MandalaReflection, GoalUpdatePhase } from '@/types/database'
import {
  getMandalaChart,
  saveMandalaChart,
  getArchivedMandalaCharts,
  archiveAndCreateMandalaChart,
  getMandalaReflections,
  saveMandalaReflection,
  getActiveGoalUpdatePhase,
} from '@/lib/data'
import { getSession } from '@/lib/session'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'

const COLORS = [
  'bg-yellow-100 border-yellow-300', 'bg-blue-100 border-blue-300',
  'bg-green-100 border-green-300', 'bg-pink-100 border-pink-300',
  'bg-purple-100 border-purple-300', 'bg-orange-100 border-orange-300',
  'bg-teal-100 border-teal-300', 'bg-red-100 border-red-300',
]

/** 表示モード */
type PageMode =
  | 'main'           // 通常のマンダラチャート表示・編集
  | 'reflection'     // 大会振り返り入力（新チャート作成前の必須ステップ）
  | 'new_chart'      // 新しいマンダラチャート作成フォーム
  | 'archive_list'   // アーカイブ一覧（過去の成長の軌跡）
  | 'archive_detail' // アーカイブ詳細閲覧

export default function MandalaPage() {
  const router = useRouter()
  const [user, setUser] = useState<Pick<User, 'id' | 'name' | 'role'> | null>(null)

  // ---- アクティブチャート ----
  const [coreGoal, setCoreGoal] = useState('')
  const [elements, setElements] = useState<string[]>(Array(8).fill(''))
  const [actions, setActions] = useState<string[][]>(Array(8).fill(null).map(() => Array(8).fill('')))
  const [selectedBlock, setSelectedBlock] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeChart, setActiveChart] = useState<MandalaChart | null>(null)

  // ---- モード管理 ----
  const [mode, setMode] = useState<PageMode>('main')

  // ---- アーカイブ一覧 ----
  const [archives, setArchives] = useState<MandalaChart[]>([])
  const [selectedArchive, setSelectedArchive] = useState<MandalaChart | null>(null)
  const [reflections, setReflections] = useState<MandalaReflection[]>([])

  // ---- 目標更新フェーズ（コーチが起動した更新フラグ） ----
  const [activePhase, setActivePhase] = useState<GoalUpdatePhase | null>(null)
  const [phaseChecked, setPhaseChecked] = useState(false)

  // ---- 振り返り入力 ----
  const [reflectionTermLabel, setReflectionTermLabel] = useState('')
  const [reflectionAchievement, setReflectionAchievement] = useState('')
  const [reflectionChallenges, setReflectionChallenges] = useState('')
  const [reflectionPlanB, setReflectionPlanB] = useState('')
  const [reflectionSaving, setReflectionSaving] = useState(false)

  // ---- 新チャート入力 ----
  const [newCoreGoal, setNewCoreGoal] = useState('')
  const [newElements, setNewElements] = useState<string[]>(Array(8).fill(''))
  const [newActions, setNewActions] = useState<string[][]>(Array(8).fill(null).map(() => Array(8).fill('')))
  const [newTermLabel, setNewTermLabel] = useState('')
  const [newSelectedBlock, setNewSelectedBlock] = useState<number | null>(null)
  const [newChartSaving, setNewChartSaving] = useState(false)
  const [newChartSaved, setNewChartSaved] = useState(false)

  useEffect(() => {
    const session = getSession()
    if (!session) { router.push('/login'); return }
    if (session.role === 'staff') { router.push('/coach/dashboard'); return }
    setUser(session)
    loadAll(session.id)
  }, [router])

  const loadAll = async (userId: string) => {
    try {
      const [chart, archiveList, reflectionList, phase] = await Promise.all([
        getMandalaChart(userId),
        getArchivedMandalaCharts(userId),
        getMandalaReflections(userId),
        getActiveGoalUpdatePhase(),
      ])
      if (chart) {
        setActiveChart(chart)
        setCoreGoal(chart.core_goal)
        setElements(chart.elements)
        setActions(chart.actions)
      }
      setArchives(archiveList)
      setReflections(reflectionList)
      setActivePhase(phase)
    } catch (e) {
      console.error('[mandala] データ取得に失敗しました:', e)
    } finally {
      setLoading(false)
      setPhaseChecked(true)
    }
  }

  // アクティブなフェーズが存在し、かつ生徒がまだ振り返り・新チャートを作成していない場合は
  // 振り返りモードに自動遷移する（メインモードの表示後に通知する）
  useEffect(() => {
    if (!phaseChecked || !activePhase) return
    // アクティブフェーズが存在する場合のみ通知（モード自動変更はしない）
  }, [phaseChecked, activePhase])

  // ---------- アクティブチャートの保存 ----------
  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    try {
      await saveMandalaChart({
        user_id: user.id,
        core_goal: coreGoal,
        elements,
        actions,
        term_label: activeChart?.term_label || null,
        status: 'active',
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  const updateElement = (index: number, value: string) => {
    const updated = [...elements]; updated[index] = value; setElements(updated)
  }

  const updateAction = (blockIndex: number, goalIndex: number, value: string) => {
    const updated = actions.map(row => [...row])
    updated[blockIndex][goalIndex] = value
    setActions(updated)
  }

  // ---------- 振り返りの保存 ----------
  const handleSaveReflection = async () => {
    if (!user || !activeChart) return
    if (!reflectionTermLabel.trim()) {
      alert('対象大会ターム名を入力してください')
      return
    }
    setReflectionSaving(true)
    try {
      await saveMandalaReflection({
        user_id: user.id,
        mandala_chart_id: activeChart.id,
        term_label: reflectionTermLabel.trim(),
        achievement_note: reflectionAchievement.trim(),
        challenges: reflectionChallenges.trim(),
        plan_b: reflectionPlanB.trim(),
      })
      // LLMスコアリングをバックグラウンドで実行する（fire-and-forget）
      const reflectionText = `【成果】${reflectionAchievement}\n【課題】${reflectionChallenges}\n【Plan B】${reflectionPlanB}`
      fetch('/api/scoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reflection: reflectionText, context: 'mandala_reflection' }),
      }).catch(e => console.warn('[mandala] スコアリングAPIの呼び出しに失敗しました:', e))

      // 振り返り完了 → 新チャート作成フォームへ遷移
      setNewTermLabel(activePhase?.term_label || '')
      setMode('new_chart')
    } catch (e) {
      console.error('[mandala] 振り返りの保存に失敗しました:', e)
      alert('振り返りの保存に失敗しました。再度お試しください。')
    } finally {
      setReflectionSaving(false)
    }
  }

  // ---------- 新チャートの保存（アーカイブ＋新規作成＋タイムライン投稿） ----------
  const handleSaveNewChart = async () => {
    if (!user) return
    setNewChartSaving(true)
    try {
      const created = await archiveAndCreateMandalaChart(
        user.id,
        {
          user_id: user.id,
          core_goal: newCoreGoal,
          elements: newElements,
          actions: newActions,
          target_date: null,
          term_label: newTermLabel.trim() || null,
        },
        reflectionTermLabel.trim() || (activePhase?.term_label || '前回大会'),
      )
      // 新しいチャートをアクティブとして画面に反映する
      setActiveChart(created)
      setCoreGoal(created.core_goal)
      setElements(created.elements)
      setActions(created.actions)
      setNewChartSaved(true)
      // アーカイブ一覧を再取得する
      const archiveList = await getArchivedMandalaCharts(user.id)
      setArchives(archiveList)
      setTimeout(() => {
        setNewChartSaved(false)
        setMode('main')
      }, 2000)
    } catch (e) {
      console.error('[mandala] 新チャートの作成に失敗しました:', e)
      alert('チャートの作成に失敗しました。再度お試しください。')
    } finally {
      setNewChartSaving(false)
    }
  }

  // ---------- 新チャート用の要素・行動更新 ----------
  const updateNewElement = (index: number, value: string) => {
    const updated = [...newElements]; updated[index] = value; setNewElements(updated)
  }
  const updateNewAction = (blockIndex: number, goalIndex: number, value: string) => {
    const updated = newActions.map(row => [...row])
    updated[blockIndex][goalIndex] = value
    setNewActions(updated)
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

        {/* ====== タブナビ ====== */}
        <div className="flex gap-2 mb-4 overflow-x-auto">
          <button
            onClick={() => { setMode('main'); setSelectedBlock(null) }}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              mode === 'main' ? 'bg-brand-main text-brand-dark shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            📋 現在の目標
          </button>
          <button
            onClick={() => { setMode('archive_list'); setSelectedArchive(null) }}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              (mode === 'archive_list' || mode === 'archive_detail') ? 'bg-brand-main text-brand-dark shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            📚 成長の軌跡 ({archives.length})
          </button>
        </div>

        {/* ====== アクティブフェーズ通知バナー ====== */}
        {activePhase && mode === 'main' && (
          <div className="bg-orange-50 border-2 border-orange-300 rounded-2xl p-4 mb-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-bold text-orange-700">🏆 目標更新フェーズが開始されました</p>
                <p className="text-xs text-orange-600 mt-1">
                  「{activePhase.term_label}」の振り返りを入力し、新しいマンダラチャートを作成しましょう。
                </p>
              </div>
              <button
                onClick={() => {
                  setReflectionTermLabel(activePhase.term_label)
                  setMode('reflection')
                }}
                className="bg-orange-500 text-white font-bold px-4 py-2 rounded-xl hover:bg-orange-600 transition-colors text-sm whitespace-nowrap shadow-md"
              >
                振り返りを始める →
              </button>
            </div>
          </div>
        )}

        {/* ====== 現在の目標（通常モード） ====== */}
        {mode === 'main' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-brand-dark">マンダラチャート</h2>
                {activeChart?.term_label && (
                  <p className="text-xs text-brand-main font-medium">🏆 {activeChart.term_label}</p>
                )}
                <p className="text-xs text-gray-500">目標を明確にして、成長の地図を作ろう</p>
              </div>
              <div className="flex gap-2">
                {/* 目標更新ボタン（フェーズ中でなくても手動で更新可能） */}
                <button
                  onClick={() => {
                    setReflectionTermLabel(activePhase?.term_label || '')
                    setMode('reflection')
                  }}
                  className="bg-white border-2 border-brand-main text-brand-dark font-bold px-3 py-2 rounded-xl hover:bg-yellow-50 transition-colors text-xs shadow-sm"
                >
                  🔄 目標更新
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-brand-main text-brand-dark font-bold px-5 py-2 rounded-xl hover:bg-yellow-400 transition-colors disabled:opacity-50 text-sm shadow-md"
                >
                  {saving ? '保存中...' : saved ? '保存しました!' : '保存する'}
                </button>
              </div>
            </div>

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
                  {[0, 1, 2, 3, -1, 4, 5, 6, 7].map((idx) => {
                    if (idx === -1) {
                      return (
                        <div key="core" className="bg-brand-main rounded-xl p-3 flex items-center justify-center min-h-[80px] shadow-md">
                          <p className="text-sm font-bold text-brand-dark text-center leading-tight">{coreGoal || 'コア目標'}</p>
                        </div>
                      )
                    }
                    const filledCount = actions[idx].filter(g => g.trim()).length
                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedBlock(idx)}
                        className={`${COLORS[idx]} border-2 rounded-xl p-3 min-h-[80px] flex flex-col items-center justify-center card-hover`}
                      >
                        <p className="text-xs font-bold text-gray-700 text-center leading-tight">{elements[idx] || `要素 ${idx + 1}`}</p>
                        <p className="text-xs text-gray-500 mt-1">{filledCount}/8</p>
                      </button>
                    )
                  })}
                </div>
                <p className="text-center text-xs text-gray-500">各要素をタップして、具体的な目標を設定しましょう</p>
              </>
            )}

            {selectedBlock !== null && (
              <div className="space-y-4">
                <button
                  onClick={() => setSelectedBlock(null)}
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  <span>←</span><span className="text-sm">全体に戻る</span>
                </button>
                <div className={`${COLORS[selectedBlock]} border-2 rounded-2xl p-4`}>
                  <p className="text-xs text-gray-500 mb-2">主要要素 {selectedBlock + 1}</p>
                  <input
                    type="text"
                    value={elements[selectedBlock]}
                    onChange={(e) => updateElement(selectedBlock, e.target.value)}
                    placeholder={`要素 ${selectedBlock + 1} の名前`}
                    className="w-full text-center font-bold px-4 py-3 rounded-xl border-2 border-white bg-white focus:outline-none focus:ring-2 focus:ring-brand-main text-lg"
                  />
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-sm">
                  <p className="text-sm font-semibold text-gray-700 mb-3">
                    「{elements[selectedBlock] || `要素 ${selectedBlock + 1}`}」の具体的な目標・行動（8つ）
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    {actions[selectedBlock].map((goal, goalIdx) => (
                      <div key={goalIdx} className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-5 text-center font-mono">{goalIdx + 1}</span>
                        <input
                          type="text"
                          value={goal}
                          onChange={(e) => updateAction(selectedBlock, goalIdx, e.target.value)}
                          placeholder={`具体的な目標・行動 ${goalIdx + 1}`}
                          className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 focus:border-brand-main focus:outline-none text-sm bg-gray-50"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ====== 大会振り返り入力モード ====== */}
        {mode === 'reflection' && (
          <div className="space-y-4">
            <button
              onClick={() => setMode('main')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <span>←</span><span className="text-sm">戻る</span>
            </button>

            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h2 className="text-lg font-bold text-brand-dark mb-1">🏆 大会振り返り</h2>
              <p className="text-xs text-gray-500 mb-5">
                新しいマンダラチャートを作成する前に、前回の目標を振り返り、次への戦略（Plan B）を立てましょう。
              </p>

              {/* 対象大会ターム */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  対象大会ターム <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={reflectionTermLabel}
                  onChange={(e) => setReflectionTermLabel(e.target.value)}
                  placeholder="例: 2026年 インターハイ予選"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-main focus:outline-none text-sm"
                />
              </div>

              {/* 達成度・成果 */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  達成度・成果
                </label>
                <textarea
                  value={reflectionAchievement}
                  onChange={(e) => setReflectionAchievement(e.target.value)}
                  placeholder="この大会期間で達成できたこと、成長したことを書いてください"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-main focus:outline-none text-sm resize-none"
                />
              </div>

              {/* 課題 */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  次期への課題
                </label>
                <textarea
                  value={reflectionChallenges}
                  onChange={(e) => setReflectionChallenges(e.target.value)}
                  placeholder="うまくいかなかったこと、次回に改善したいことを具体的に書いてください"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-main focus:outline-none text-sm resize-none"
                />
              </div>

              {/* Plan B */}
              <div className="mb-5">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  具体的な行動戦略（Plan B）
                </label>
                <textarea
                  value={reflectionPlanB}
                  onChange={(e) => setReflectionPlanB(e.target.value)}
                  placeholder="課題を克服するための具体的な行動プランを書いてください（いつ、何を、どのくらい）"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-main focus:outline-none text-sm resize-none"
                />
              </div>

              <p className="text-xs text-gray-400 mb-4 bg-gray-50 rounded-lg p-3">
                💡 振り返りを保存すると、AIがあなたの思考の深さを分析してフィードバックします。
                そのまま新しいマンダラチャートの作成画面に進みます。
              </p>

              <button
                onClick={handleSaveReflection}
                disabled={reflectionSaving || !reflectionTermLabel.trim()}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
                  reflectionSaving || !reflectionTermLabel.trim()
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-brand-main text-brand-dark hover:bg-yellow-400 shadow-md'
                }`}
              >
                {reflectionSaving ? '保存中...' : '振り返りを保存して、新しい目標を設定する →'}
              </button>
            </div>
          </div>
        )}

        {/* ====== 新チャート作成モード ====== */}
        {mode === 'new_chart' && (
          <div className="space-y-4">
            <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-4 shadow-sm">
              <p className="text-sm font-bold text-green-700">✅ 振り返りを保存しました！</p>
              <p className="text-xs text-green-600 mt-1">
                次のターム「{newTermLabel || '次の大会'}」の新しいマンダラチャートを作成しましょう。
              </p>
            </div>

            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-lg font-bold text-brand-dark">新しいマンダラチャート</h2>
                <p className="text-xs text-gray-500">次の大会に向けた目標を設定しましょう</p>
              </div>
              <button
                onClick={handleSaveNewChart}
                disabled={newChartSaving || !newCoreGoal.trim()}
                className={`font-bold px-5 py-2 rounded-xl transition-colors text-sm shadow-md ${
                  newChartSaving || !newCoreGoal.trim()
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-brand-main text-brand-dark hover:bg-yellow-400'
                }`}
              >
                {newChartSaving ? '保存中...' : newChartSaved ? '✅ 保存しました!' : '保存して完了'}
              </button>
            </div>

            {/* 対象大会ターム入力 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-xs text-gray-500 mb-2 font-medium">対象大会ターム（例: 2026年 インターハイ予選）</p>
              <input
                type="text"
                value={newTermLabel}
                onChange={(e) => setNewTermLabel(e.target.value)}
                placeholder="例: 2026年 ウインターカップ予選"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-main focus:outline-none text-sm"
              />
            </div>

            {newSelectedBlock === null && (
              <>
                <div className="bg-white rounded-2xl p-4 shadow-sm">
                  <p className="text-xs text-gray-500 mb-2 font-medium">コア目標（中心にある最大の目標）</p>
                  <input
                    type="text"
                    value={newCoreGoal}
                    onChange={(e) => setNewCoreGoal(e.target.value)}
                    placeholder="例: インターハイ出場"
                    className="w-full text-center text-lg font-bold px-4 py-3 rounded-xl border-2 border-brand-main bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-brand-main"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[0, 1, 2, 3, -1, 4, 5, 6, 7].map((idx) => {
                    if (idx === -1) {
                      return (
                        <div key="core" className="bg-brand-main rounded-xl p-3 flex items-center justify-center min-h-[80px] shadow-md">
                          <p className="text-sm font-bold text-brand-dark text-center leading-tight">{newCoreGoal || 'コア目標'}</p>
                        </div>
                      )
                    }
                    const filledCount = newActions[idx].filter(g => g.trim()).length
                    return (
                      <button
                        key={idx}
                        onClick={() => setNewSelectedBlock(idx)}
                        className={`${COLORS[idx]} border-2 rounded-xl p-3 min-h-[80px] flex flex-col items-center justify-center card-hover`}
                      >
                        <p className="text-xs font-bold text-gray-700 text-center leading-tight">{newElements[idx] || `要素 ${idx + 1}`}</p>
                        <p className="text-xs text-gray-500 mt-1">{filledCount}/8</p>
                      </button>
                    )
                  })}
                </div>
                <p className="text-center text-xs text-gray-500">各要素をタップして、具体的な目標を設定しましょう</p>
              </>
            )}

            {newSelectedBlock !== null && (
              <div className="space-y-4">
                <button
                  onClick={() => setNewSelectedBlock(null)}
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  <span>←</span><span className="text-sm">全体に戻る</span>
                </button>
                <div className={`${COLORS[newSelectedBlock]} border-2 rounded-2xl p-4`}>
                  <p className="text-xs text-gray-500 mb-2">主要要素 {newSelectedBlock + 1}</p>
                  <input
                    type="text"
                    value={newElements[newSelectedBlock]}
                    onChange={(e) => updateNewElement(newSelectedBlock, e.target.value)}
                    placeholder={`要素 ${newSelectedBlock + 1} の名前`}
                    className="w-full text-center font-bold px-4 py-3 rounded-xl border-2 border-white bg-white focus:outline-none focus:ring-2 focus:ring-brand-main text-lg"
                  />
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-sm">
                  <p className="text-sm font-semibold text-gray-700 mb-3">
                    「{newElements[newSelectedBlock] || `要素 ${newSelectedBlock + 1}`}」の具体的な目標・行動（8つ）
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    {newActions[newSelectedBlock].map((goal, goalIdx) => (
                      <div key={goalIdx} className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-5 text-center font-mono">{goalIdx + 1}</span>
                        <input
                          type="text"
                          value={goal}
                          onChange={(e) => updateNewAction(newSelectedBlock, goalIdx, e.target.value)}
                          placeholder={`具体的な目標・行動 ${goalIdx + 1}`}
                          className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 focus:border-brand-main focus:outline-none text-sm bg-gray-50"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ====== 成長の軌跡（アーカイブ一覧） ====== */}
        {mode === 'archive_list' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-brand-dark">📚 成長の軌跡</h2>
              <p className="text-xs text-gray-500">過去の大会ごとの目標と振り返りを確認できます</p>
            </div>

            {archives.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 shadow-sm text-center text-gray-400">
                <p className="text-3xl mb-2">📖</p>
                <p className="text-sm">まだアーカイブされた目標はありません</p>
                <p className="text-xs mt-2">「目標更新」を行うと、過去のチャートがここに保存されます</p>
              </div>
            ) : (
              archives.map(archive => {
                const reflection = reflections.find(r => r.mandala_chart_id === archive.id)
                return (
                  <div key={archive.id} className="bg-white rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-xs text-orange-500 font-medium">
                          🏆 {archive.term_label || 'ターム未設定'}
                        </p>
                        <p className="font-bold text-gray-800">{archive.core_goal || 'コア目標なし'}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {archive.archived_at
                            ? `アーカイブ日: ${new Date(archive.archived_at).toLocaleDateString('ja-JP')}`
                            : `作成日: ${new Date(archive.created_at).toLocaleDateString('ja-JP')}`
                          }
                        </p>
                      </div>
                      <button
                        onClick={() => { setSelectedArchive(archive); setMode('archive_detail') }}
                        className="text-xs bg-brand-main text-brand-dark px-3 py-1.5 rounded-xl font-medium hover:bg-yellow-400 transition-colors"
                      >
                        詳細を見る
                      </button>
                    </div>
                    {reflection && (
                      <div className="bg-gray-50 rounded-xl p-3 text-xs">
                        <p className="font-medium text-gray-700 mb-1">📝 振り返り</p>
                        <p className="text-gray-600 line-clamp-2">{reflection.plan_b || reflection.challenges}</p>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ====== アーカイブ詳細 ====== */}
        {mode === 'archive_detail' && selectedArchive && (
          <div className="space-y-4">
            <button
              onClick={() => { setMode('archive_list'); setSelectedArchive(null) }}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <span>←</span><span className="text-sm">一覧に戻る</span>
            </button>

            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <p className="text-xs text-orange-500 font-medium mb-1">
                🏆 {selectedArchive.term_label || 'ターム未設定'}
              </p>
              <h2 className="text-xl font-bold text-brand-dark mb-4">{selectedArchive.core_goal || 'コア目標なし'}</h2>

              {/* 要素一覧（グリッド表示） */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[0, 1, 2, 3, -1, 4, 5, 6, 7].map((idx) => {
                  if (idx === -1) {
                    return (
                      <div key="core" className="bg-brand-main rounded-xl p-3 flex items-center justify-center min-h-[70px] shadow-md">
                        <p className="text-xs font-bold text-brand-dark text-center leading-tight">{selectedArchive.core_goal || 'コア目標'}</p>
                      </div>
                    )
                  }
                  return (
                    <div key={idx} className={`${COLORS[idx]} border-2 rounded-xl p-3 min-h-[70px] flex items-center justify-center`}>
                      <p className="text-xs font-bold text-gray-700 text-center leading-tight">
                        {selectedArchive.elements[idx] || `要素 ${idx + 1}`}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 振り返りデータ */}
            {(() => {
              const reflection = reflections.find(r => r.mandala_chart_id === selectedArchive.id)
              if (!reflection) return (
                <div className="bg-white rounded-2xl p-5 shadow-sm text-center text-gray-400">
                  <p className="text-sm">この期間の振り返りデータはありません</p>
                </div>
              )
              return (
                <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
                  <h3 className="font-bold text-gray-700">📝 大会振り返り</h3>

                  {reflection.mindset_score && (
                    <div className={`px-4 py-3 rounded-xl border-2 ${
                      reflection.mindset_score >= 4 ? 'bg-green-50 border-green-300' :
                      reflection.mindset_score >= 3 ? 'bg-blue-50 border-blue-200' :
                      reflection.mindset_score >= 2 ? 'bg-orange-50 border-orange-300' :
                      'bg-red-50 border-red-300'
                    }`}>
                      <p className="text-xs font-bold text-gray-700">
                        🧠 メタ認知スコア: {reflection.mindset_score}/4
                      </p>
                      {reflection.mindset_feedback && (
                        <p className="text-xs text-gray-600 mt-1">{reflection.mindset_feedback}</p>
                      )}
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">✅ 達成度・成果</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3">
                      {reflection.achievement_note || '（未入力）'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">⚠️ 課題</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3">
                      {reflection.challenges || '（未入力）'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">🚀 Plan B（行動戦略）</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3">
                      {reflection.plan_b || '（未入力）'}
                    </p>
                  </div>
                </div>
              )
            })()}
          </div>
        )}

      </main>
      <BottomNav role="player" />
    </div>
  )
}
