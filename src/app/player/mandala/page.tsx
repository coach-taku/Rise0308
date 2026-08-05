'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { User, MandalaChart, MandalaReflection, GoalUpdatePhase, SscPlan, EvaluationAnswer } from '@/types/database'
import {
  getMandalaChart,
  saveMandalaChart,
  getArchivedMandalaCharts,
  archiveAndCreateMandalaChart,
  getMandalaReflections,
  saveMandalaReflection,
  getActiveGoalUpdatePhase,
  getLatestSscPlan,
  getEvaluationAnswersForTarget,
  getEvaluationHistoryForPlayer,
  getEvaluationDeliveries,
  calcCategoryScores,
  EVALUATION_CATEGORIES,
} from '@/lib/data'
import { getSession } from '@/lib/session'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Legend, Tooltip,
  LineChart, Line, CartesianGrid, XAxis, YAxis,
} from 'recharts'

// 成長履歴データ型（選手ページ用）
type EvalHistoryEntry = {
  deliveryId: string
  label: string
  deliveredAt: string
  selfTotal: number | null
  othersTotal: number | null
}

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

  // ---- SSCアクションプラン（10ヶ条評価から連動するサジェスト） ----
  const [sscPlan, setSscPlan] = useState<SscPlan | null>(null)

  // ---- 10ヶ条評価 比較表・推移グラフ用 state ----
  // 自己評価の回答一覧（最新配信分 または 全件）
  const [evalSelfAnswers, setEvalSelfAnswers] = useState<EvaluationAnswer[]>([])
  // 他者評価の回答一覧
  const [evalOthersAnswers, setEvalOthersAnswers] = useState<EvaluationAnswer[]>([])
  // 成長履歴（推移グラフ用）
  const [evalHistory, setEvalHistory] = useState<EvalHistoryEntry[]>([])
  // ローディングフラグ
  const [evalLoading, setEvalLoading] = useState(false)

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
      const [chart, archiveList, reflectionList, phase, ssc] = await Promise.all([
        getMandalaChart(userId),
        getArchivedMandalaCharts(userId),
        getMandalaReflections(userId),
        getActiveGoalUpdatePhase(),
        getLatestSscPlan(userId),
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
      setSscPlan(ssc)
    } catch (e) {
      console.error('[mandala] データ取得に失敗しました:', e)
    } finally {
      setLoading(false)
      setPhaseChecked(true)
    }

    // 10ヶ条評価データを非同期で取得する（ページ描画をブロックしない）
    loadEvalData(userId)
  }

  /**
   * 10ヶ条評価の比較表・推移グラフ用データを取得する。
   * 選手自身のページで表示するため、自分のuser_idを被評価者として取得する。
   *
   * 【修正 2026-08-05】
   * 全配信のデータが混在して正しく表示されない問題を修正。
   * 最新の配信IDで絞り込んだ回答データを取得するよう変更した。
   * 自己評価と他者評価の両データが欠落しないよう、取得ロジックを改善。
   */
  const loadEvalData = async (userId: string) => {
    setEvalLoading(true)
    try {
      // 推移グラフ用の全配信履歴と、配信一覧を並行取得する
      const [history, deliveries] = await Promise.all([
        getEvaluationHistoryForPlayer(userId),
        getEvaluationDeliveries(),
      ])
      setEvalHistory(history)

      if (deliveries.length === 0) {
        // 配信がない場合はデータなし状態にする
        setEvalSelfAnswers([])
        setEvalOthersAnswers([])
        return
      }

      // 最新の配信IDを取得する（配信は降順で返るため先頭が最新）
      const latestDeliveryId = deliveries[0].id

      // 最新配信のデータのみを取得する（複数配信データの混在を防ぐ）
      const allAnswers = await getEvaluationAnswersForTarget(userId, latestDeliveryId)

      // 自己評価（evaluator_id === userId）と他者評価（それ以外）に分ける
      const selfAns = allAnswers.filter(a => a.evaluator_id === userId)
      const othersAns = allAnswers.filter(a => a.evaluator_id !== userId)

      // null/undefined ガード: 空配列で確実に初期化する
      setEvalSelfAnswers(selfAns ?? [])
      setEvalOthersAnswers(othersAns ?? [])
    } catch (e) {
      console.error('[mandala] 10ヶ条評価データ取得に失敗しました:', e)
      // エラー時もクラッシュしないよう空配列でフォールバックする
      setEvalSelfAnswers([])
      setEvalOthersAnswers([])
    } finally {
      setEvalLoading(false)
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

        {/* ====== SSCアクションプラン サジェストバナー ====== */}
        {sscPlan && mode === 'main' && (
          <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-2xl p-4 mb-4 shadow-sm">
            <p className="text-xs font-bold text-orange-700 mb-2">
              🎯 10ヶ条評価のアクションプランが届いています
            </p>
            <div className="space-y-1.5">
              {sscPlan.start_action && (
                <p className="text-xs text-gray-700 bg-green-50 px-3 py-1.5 rounded-lg flex items-start gap-2">
                  <span className="font-bold text-green-600 shrink-0">🚀 Start:</span>
                  <span>{sscPlan.start_action}</span>
                </p>
              )}
              {sscPlan.stop_action && (
                <p className="text-xs text-gray-700 bg-red-50 px-3 py-1.5 rounded-lg flex items-start gap-2">
                  <span className="font-bold text-red-600 shrink-0">🛑 Stop:</span>
                  <span>{sscPlan.stop_action}</span>
                </p>
              )}
              {sscPlan.continue_action && (
                <p className="text-xs text-gray-700 bg-blue-50 px-3 py-1.5 rounded-lg flex items-start gap-2">
                  <span className="font-bold text-blue-600 shrink-0">🔄 Continue:</span>
                  <span>{sscPlan.continue_action}</span>
                </p>
              )}
            </div>
            <p className="text-xs text-orange-600 mt-2">
              💡 空欄のマスに上記のアクションプランをコピーして活用しましょう
            </p>
          </div>
        )}

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

                {/* ====================================================
                    10ヶ条評価 比較表（指導者画面と同等）
                    ==================================================== */}
                <EvaluationComparisonSection
                  userId={user.id}
                  selfAnswers={evalSelfAnswers}
                  othersAnswers={evalOthersAnswers}
                  loading={evalLoading}
                />

                {/* ====================================================
                    10ヶ条評価 推移グラフ（指導者画面と同等）
                    ==================================================== */}
                <EvaluationGrowthSection
                  historyData={evalHistory}
                  loading={evalLoading}
                />
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

// ============================================================
// 10ヶ条評価 比較表コンポーネント（指導者画面と同等のデザイン）
// ============================================================
function EvaluationComparisonSection({
  userId,
  selfAnswers,
  othersAnswers,
  loading,
}: {
  userId: string
  selfAnswers: EvaluationAnswer[]
  othersAnswers: EvaluationAnswer[]
  loading: boolean
}) {
  // null/undefined ガード: 空配列にフォールバックしてクラッシュを防ぐ
  const safeSelfAnswers = selfAnswers ?? []
  const safeOthersAnswers = othersAnswers ?? []

  const selfScores = useMemo(() => calcCategoryScores(safeSelfAnswers, userId), [safeSelfAnswers, userId])
  const othersScores = useMemo(() => calcCategoryScores(safeOthersAnswers), [safeOthersAnswers])

  const selfValues = Object.values(selfScores).filter((s: number) => s > 0)
  const othersValues = Object.values(othersScores).filter((s: number) => s > 0)

  const selfAvg = selfValues.length > 0
    ? Math.round(selfValues.reduce((a: number, b: number) => a + b, 0) / selfValues.length * 10) / 10
    : null
  const othersAvg = othersValues.length > 0
    ? Math.round(othersValues.reduce((a: number, b: number) => a + b, 0) / othersValues.length * 10) / 10
    : null

  // safeOthersAnswers を使ってhasDataを判定する（null ガード済み）
  const hasData = safeSelfAnswers.length > 0 || safeOthersAnswers.length > 0
  // 他者評価データの有無（バー表示判定に使用）
  const hasOthersData = safeOthersAnswers.length > 0

  // レーダーチャート用データ
  const radarData = EVALUATION_CATEGORIES.map(cat => ({
    category: cat,
    自己評価: selfScores[cat] || 0,
    他者評価平均: othersScores[cat] || 0,
  }))

  return (
    <div className="mt-6">
      <h3 className="text-sm font-bold text-gray-700 mb-3">
        📊 今回の自己評価と他者評価の比較
      </h3>

      {loading ? (
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
          <div className="animate-pulse text-brand-main text-sm font-bold">評価データ読み込み中...</div>
        </div>
      ) : !hasData ? (
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
          <p className="text-3xl mb-2">📋</p>
          <p className="text-sm text-gray-500">まだ評価データがありません</p>
          <p className="text-xs text-gray-400 mt-1">
            コーチがアンケートを配信し、回答が完了すると比較表がここに表示されます。
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          {/* 平均スコアサマリー */}
          <div className="flex justify-end gap-2 mb-3 text-xs flex-shrink-0">
            {selfAvg !== null && (
              <span className="text-yellow-600 font-bold bg-yellow-50 px-2 py-0.5 rounded-full">
                自己 {selfAvg}
              </span>
            )}
            {/* 他者評価データがある場合のみ平均を表示する */}
            {hasOthersData && othersAvg !== null && (
              <span className="text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-full">
                他者 {othersAvg}
              </span>
            )}
          </div>

          {/* レーダーチャート */}
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
              <PolarGrid />
              <PolarAngleAxis
                dataKey="category"
                tick={{ fontSize: 9, fill: '#374151' }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 5]}
                tick={{ fontSize: 9 }}
                tickCount={6}
              />
              <Radar
                name="自己評価"
                dataKey="自己評価"
                stroke="#e1c614"
                fill="#e1c614"
                fillOpacity={0.25}
                strokeWidth={2}
              />
              {/* 他者評価データがある場合のみレーダーを表示する */}
              {hasOthersData && (
                <Radar
                  name="他者評価平均"
                  dataKey="他者評価平均"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.1}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                />
              )}
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                formatter={(value: number) => [`${value} / 5`, '']}
              />
            </RadarChart>
          </ResponsiveContainer>

          {/* カテゴリ別バー比較（指導者画面と同等） */}
          <div className="space-y-1.5 mt-3">
            {EVALUATION_CATEGORIES.map((cat: string) => {
              const self = selfScores[cat] || 0
              const other = othersScores[cat] || 0
              // ギャップ判定：両データが揃っている場合のみ
              const catGap = self > 0 && other > 0 ? Math.abs(self - other) : null
              const isCatGap = catGap !== null && catGap >= 1.0
              return (
                <div key={cat}>
                  <div className="flex justify-between items-center mb-0.5">
                    <span className={`text-xs ${isCatGap ? 'font-bold text-red-600' : 'text-gray-500'}`}>
                      {isCatGap && '⚠ '}{cat}
                    </span>
                    <div className="flex gap-2 text-xs">
                      {/* 自己評価の数値（データがある場合のみ） */}
                      {self > 0 && <span className="text-yellow-600">{self}</span>}
                      {/* 他者評価の数値（他者データがある場合のみ、0以外を表示） */}
                      {hasOthersData && other > 0 && <span className="text-blue-500">{other}</span>}
                    </div>
                  </div>
                  <div className="flex gap-0.5 items-center">
                    {/* 自己評価バー */}
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                      <div
                        className="bg-yellow-400 h-1.5 rounded-full"
                        style={{ width: `${(self / 5) * 100}%` }}
                      />
                    </div>
                    {/* 他者評価バー（他者評価データがある場合は常に表示） */}
                    {hasOthersData && (
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div
                          className="bg-blue-400 h-1.5 rounded-full opacity-70"
                          style={{ width: `${(other / 5) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* 凡例 */}
          <div className="flex items-center gap-4 text-xs text-gray-400 justify-end mt-2">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-2 bg-yellow-400 rounded" /> 自己評価
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-2 bg-blue-400 rounded opacity-70" /> 他者評価
            </span>
            <span className="flex items-center gap-1">
              <span className="text-red-500">⚠</span> ギャップ1.0以上
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// 10ヶ条評価 推移グラフコンポーネント（指導者画面と同等のデザイン）
// ============================================================
function EvaluationGrowthSection({
  historyData,
  loading,
}: {
  historyData: EvalHistoryEntry[]
  loading: boolean
}) {
  const hasHistory = historyData.length >= 1

  // 最初と最後の差分（成長バッジ用）
  const firstEntry = historyData[0]
  const lastEntry = historyData[historyData.length - 1]
  const selfDelta =
    hasHistory && historyData.length >= 2 && firstEntry.selfTotal !== null && lastEntry.selfTotal !== null
      ? lastEntry.selfTotal - firstEntry.selfTotal
      : null
  const othersDelta =
    hasHistory && historyData.length >= 2 && firstEntry.othersTotal !== null && lastEntry.othersTotal !== null
      ? lastEntry.othersTotal - firstEntry.othersTotal
      : null

  // チャート用データ（null を undefined に変換 → recharts が線を断絶する）
  const chartData = historyData.map(d => ({
    name: d.label,
    自己評価合計: d.selfTotal ?? undefined,
    他者評価平均合計: d.othersTotal ?? undefined,
  }))

  return (
    <div className="mt-6">
      <h3 className="text-sm font-bold text-gray-700 mb-3">
        📈 過去の自己評価・他者評価の推移
      </h3>

      {loading ? (
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
          <div className="animate-pulse text-brand-main text-sm font-bold">推移データ読み込み中...</div>
        </div>
      ) : !hasHistory ? (
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
          <p className="text-3xl mb-2">📉</p>
          <p className="text-sm text-gray-500">まだ推移データがありません</p>
          <p className="text-xs text-gray-400 mt-1">
            複数回のアンケートに回答すると、ここに成長の軌跡が表示されます。
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* 成長バッジ（2回以上のデータがある場合） */}
          {(selfDelta !== null || othersDelta !== null) && (
            <div className="grid grid-cols-2 gap-3">
              {selfDelta !== null && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-center">
                  <p className="text-xs text-yellow-700 font-bold mb-1">自己評価の伸び</p>
                  <p className={`text-2xl font-black ${
                    selfDelta > 0 ? 'text-green-600' : selfDelta < 0 ? 'text-red-500' : 'text-gray-500'
                  }`}>
                    {selfDelta > 0 ? '+' : ''}{selfDelta}
                    <span className="text-xs font-normal text-gray-400 ml-1">pt</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">初回→最新</p>
                </div>
              )}
              {othersDelta !== null && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
                  <p className="text-xs text-blue-700 font-bold mb-1">他者評価の伸び</p>
                  <p className={`text-2xl font-black ${
                    othersDelta > 0 ? 'text-green-600' : othersDelta < 0 ? 'text-red-500' : 'text-gray-500'
                  }`}>
                    {othersDelta > 0 ? '+' : ''}{othersDelta}
                    <span className="text-xs font-normal text-gray-400 ml-1">pt</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">初回→最新</p>
                </div>
              )}
            </div>
          )}

          {/* 折れ線グラフ */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h4 className="text-sm font-bold text-gray-700 mb-1">
              合計点の推移
              <span className="text-xs font-normal text-gray-400 ml-2">（満点 150点）</span>
            </h4>
            <p className="text-xs text-gray-400 mb-3">
              横軸：配信回、縦軸：30問の合計スコア
            </p>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 150]}
                  ticks={[0, 30, 60, 90, 120, 150]}
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={false}
                  width={30}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '10px', fontSize: '12px', border: '1px solid #e5e7eb' }}
                  formatter={(value: number, name: string) => [`${value} pt`, name]}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                <Line
                  type="monotone"
                  dataKey="自己評価合計"
                  stroke="#e1c614"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#e1c614', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6 }}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="他者評価平均合計"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  strokeDasharray="5 4"
                  dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 履歴テーブル */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h4 className="text-sm font-bold text-gray-700 mb-3">回別スコア一覧</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 pr-2 text-gray-500 font-medium">配信回</th>
                    <th className="text-right py-2 px-2 text-yellow-600 font-bold">自己評価</th>
                    <th className="text-right py-2 pl-2 text-blue-500 font-bold">他者評価平均</th>
                  </tr>
                </thead>
                <tbody>
                  {historyData.map((entry, idx) => (
                    <tr
                      key={entry.deliveryId}
                      className={idx % 2 === 0 ? 'bg-gray-50/50' : ''}
                    >
                      <td className="py-2 pr-2 text-gray-700 font-medium">{entry.label}</td>
                      <td className="py-2 px-2 text-right">
                        {entry.selfTotal !== null
                          ? <span className="font-bold text-yellow-700">{entry.selfTotal}<span className="text-gray-400 font-normal">/150</span></span>
                          : <span className="text-gray-300">—</span>
                        }
                      </td>
                      <td className="py-2 pl-2 text-right">
                        {entry.othersTotal !== null
                          ? <span className="font-bold text-blue-600">{entry.othersTotal}<span className="text-gray-400 font-normal">/150</span></span>
                          : <span className="text-gray-300">—</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
