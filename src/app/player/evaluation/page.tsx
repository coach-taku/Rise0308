'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { User, EvaluationTask, EvaluationAnswer, SscPlan } from '@/types/database'
import {
  EVALUATION_QUESTIONS,
  EVALUATION_CATEGORIES,
  getPendingEvaluationTasks,
  getEvaluationAnswersForTarget,
  getEvaluationHistoryForPlayer,
  getEvaluationDeliveries,
  submitEvaluationAnswers,
  getLatestSscPlan,
  saveSscPlan,
  calcCategoryScores,
  getUsers,
} from '@/lib/data'
import { getSession } from '@/lib/session'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Legend, Tooltip,
  LineChart, Line, CartesianGrid, XAxis, YAxis,
} from 'recharts'

// ============================================================
// 表示モード
// ============================================================
type PageMode =
  | 'task_list'    // タスク一覧（未完了・完了済み）
  | 'answering'    // アンケート回答中
  | 'result'       // 自分への評価結果（レーダーチャート）
  | 'ssc_input'    // Start/Stop/Continue入力
  | 'growth'       // 成長トレンド折れ線グラフ

// 成長履歴データ型
type HistoryEntry = {
  deliveryId: string
  label: string
  deliveredAt: string
  selfTotal: number | null
  othersTotal: number | null
}

export default function EvaluationPage() {
  const router = useRouter()
  const [user, setUser] = useState<Pick<User, 'id' | 'name' | 'role'> | null>(null)
  const [mode, setMode] = useState<PageMode>('task_list')
  const [loading, setLoading] = useState(true)

  // ---- タスク一覧 ----
  const [pendingTasks, setPendingTasks] = useState<EvaluationTask[]>([])
  // 現在回答中のタスク
  const [currentTask, setCurrentTask] = useState<EvaluationTask | null>(null)
  // 回答中タスクの被評価者名
  const [targetUserName, setTargetUserName] = useState('')
  // 全ユーザーマップ（ID → 名前）
  const [userMap, setUserMap] = useState<Record<string, string>>({})

  // ---- アンケート回答 ----
  // 質問番号→スコア（1〜5）
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitDone, setSubmitDone] = useState(false)

  // ---- 結果表示（レーダーチャート） ----
  const [selfAnswers, setSelfAnswers] = useState<EvaluationAnswer[]>([])
  const [allAnswers, setAllAnswers] = useState<EvaluationAnswer[]>([])
  const [resultLoading, setResultLoading] = useState(false)

  // ---- 成長グラフ ----
  const [historyData, setHistoryData] = useState<HistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // ---- SSC入力 ----
  const [existingSscPlan, setExistingSscPlan] = useState<SscPlan | null>(null)
  const [startAction, setStartAction] = useState('')
  const [stopAction, setStopAction] = useState('')
  const [continueAction, setContinueAction] = useState('')
  const [sscSaving, setSscSaving] = useState(false)
  const [sscSaved, setSscSaved] = useState(false)

  useEffect(() => {
    const session = getSession()
    if (!session) { router.push('/login'); return }
    if (session.role === 'staff') { router.push('/coach/dashboard'); return }
    setUser(session)

    const init = async () => {
      try {
        const [tasks, users, sscPlan] = await Promise.all([
          getPendingEvaluationTasks(session.id),
          getUsers(),
          getLatestSscPlan(session.id),
        ])
        setPendingTasks(tasks)
        const map: Record<string, string> = {}
        users.forEach(u => { map[u.id] = u.name })
        setUserMap(map)
        if (sscPlan) {
          setExistingSscPlan(sscPlan)
          setStartAction(sscPlan.start_action)
          setStopAction(sscPlan.stop_action)
          setContinueAction(sscPlan.continue_action)
        }
      } catch (e) {
        console.error('[evaluation] 初期化エラー:', e)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [router])

  // ---- アンケート回答開始 ----
  const startAnswering = (task: EvaluationTask) => {
    setCurrentTask(task)
    setAnswers({})
    setSubmitDone(false)
    setTargetUserName(userMap[task.target_id] || task.target_id)
    setMode('answering')
  }

  // ---- 回答を保存する ----
  const handleSubmitAnswers = async () => {
    if (!currentTask || !user) return
    // 全30問への回答チェック
    const unanswered = EVALUATION_QUESTIONS.filter(q => !answers[q.id])
    if (unanswered.length > 0) {
      alert(`まだ回答していない質問が ${unanswered.length} 問あります。`)
      return
    }
    setSubmitting(true)
    try {
      await submitEvaluationAnswers(
        currentTask.id,
        user.id,
        currentTask.target_id,
        answers,
      )
      // タスクリストを更新する
      setPendingTasks(prev => prev.filter(t => t.id !== currentTask.id))
      setSubmitDone(true)
    } catch (e) {
      console.error('[evaluation] 回答保存エラー:', e)
      alert('保存に失敗しました。もう一度お試しください。')
    } finally {
      setSubmitting(false)
    }
  }

  // ---- 成長グラフを表示する ----
  const showGrowthGraph = async () => {
    if (!user) return
    setHistoryLoading(true)
    try {
      const data = await getEvaluationHistoryForPlayer(user.id)
      setHistoryData(data)
      setMode('growth')
    } catch (e) {
      console.error('[evaluation] 成長履歴取得エラー:', e)
    } finally {
      setHistoryLoading(false)
    }
  }

  // ---- 自分への評価結果を表示する ----
  const showMyResult = async () => {
    if (!user) return
    setResultLoading(true)
    try {
      // 最新の配信IDを取得して、そのデータのみを表示する（複数配信データの混在を防ぐ）
      const deliveries = await getEvaluationDeliveries()
      let answers: EvaluationAnswer[] = []

      if (deliveries.length > 0) {
        // 最新の配信（先頭）のデータのみ取得する
        const latestDeliveryId = deliveries[0].id
        answers = await getEvaluationAnswersForTarget(user.id, latestDeliveryId)
      } else {
        // 配信がない場合は全件取得する（後方互換）
        answers = await getEvaluationAnswersForTarget(user.id)
      }

      // 自己評価のみ（evaluator_id === 自分のID）
      const self = answers.filter(a => a.evaluator_id === user.id)
      // 他者評価のみ（evaluator_id !== 自分のID）
      const others = answers.filter(a => a.evaluator_id !== user.id)

      // null/undefined ガード: 空配列でフォールバックする
      setSelfAnswers(self ?? [])
      setAllAnswers(others ?? [])
      setMode('result')
    } catch (e) {
      console.error('[evaluation] 結果取得エラー:', e)
      // エラー時もクラッシュしないよう空配列で初期化する
      setSelfAnswers([])
      setAllAnswers([])
    } finally {
      setResultLoading(false)
    }
  }

  // ---- レーダーチャートのデータ生成 ----
  const radarData = useMemo(() => {
    const selfScores = calcCategoryScores(selfAnswers, user?.id)
    const othersScores = calcCategoryScores(allAnswers)
    return EVALUATION_CATEGORIES.map(cat => ({
      category: cat,
      自己評価: selfScores[cat] || 0,
      他者評価平均: othersScores[cat] || 0,
    }))
  }, [selfAnswers, allAnswers, user])

  // ---- SSCプランを保存する ----
  const handleSaveSsc = async () => {
    if (!user) return
    if (!startAction.trim() && !stopAction.trim() && !continueAction.trim()) {
      alert('少なくとも1つ入力してください。')
      return
    }
    setSscSaving(true)
    try {
      const deliveryId = existingSscPlan?.delivery_id || `delivery-manual-${user.id}`
      await saveSscPlan({
        user_id: user.id,
        delivery_id: deliveryId,
        start_action: startAction.trim(),
        stop_action: stopAction.trim(),
        continue_action: continueAction.trim(),
        updated_at: new Date().toISOString(),
      })
      setSscSaved(true)
      setTimeout(() => setSscSaved(false), 2500)
    } catch (e) {
      console.error('[evaluation] SSCプラン保存エラー:', e)
      alert('保存に失敗しました。')
    } finally {
      setSscSaving(false)
    }
  }

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-brand-main text-xl font-bold">読み込み中...</div>
      </div>
    )
  }

  // ============================================================
  // 成長グラフ画面
  // ============================================================
  if (mode === 'growth') {
    const hasHistory = historyData.length >= 1

    // 最初と最後の差分（成長バッジ用）
    const firstEntry = historyData[0]
    const lastEntry = historyData[historyData.length - 1]
    const selfDelta =
      hasHistory && firstEntry.selfTotal !== null && lastEntry.selfTotal !== null
        ? lastEntry.selfTotal - firstEntry.selfTotal
        : null
    const othersDelta =
      hasHistory && firstEntry.othersTotal !== null && lastEntry.othersTotal !== null
        ? lastEntry.othersTotal - firstEntry.othersTotal
        : null

    // チャート用データ（null を undefined に変換 → recharts が線を断絶する）
    const chartData = historyData.map(d => ({
      name: d.label,
      自己評価合計: d.selfTotal ?? undefined,
      他者評価平均合計: d.othersTotal ?? undefined,
    }))

    return (
      <div className="min-h-screen bg-brand-bg pb-24 md:pb-8">
        <Header userName={user.name} role="player" />
        <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
          {/* ヘッダー */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <button
              onClick={() => setMode('task_list')}
              className="text-sm text-gray-500 hover:text-gray-700 mb-2 flex items-center gap-1"
            >
              ← 一覧に戻る
            </button>
            <h2 className="text-lg font-bold text-brand-dark">📈 成長グラフ</h2>
            <p className="text-xs text-gray-500 mt-1">
              過去の評価ごとの合計点推移を確認しよう。自己評価（黄）と他者評価平均（青）の変化が成長の証。
            </p>
          </div>

          {!hasHistory ? (
            <div className="bg-white rounded-2xl p-10 shadow-sm text-center">
              <p className="text-4xl mb-3">📭</p>
              <p className="text-gray-500 font-medium">まだ履歴データがありません</p>
              <p className="text-gray-400 text-xs mt-1">
                アンケートを1回以上完了すると、ここに成長の軌跡が表示されます。
              </p>
            </div>
          ) : (
            <>
              {/* 成長バッジ */}
              {(selfDelta !== null || othersDelta !== null) && historyData.length >= 2 && (
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
                <h3 className="text-sm font-bold text-gray-700 mb-1">
                  合計点の推移
                  <span className="text-xs font-normal text-gray-400 ml-2">（満点 150点）</span>
                </h3>
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
                      formatter={(value: number, name: string) => [
                        `${value} pt`,
                        name,
                      ]}
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
                <h3 className="text-sm font-bold text-gray-700 mb-3">回別スコア一覧</h3>
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

              {/* 結果画面へ誘導 */}
              <button
                onClick={showMyResult}
                disabled={resultLoading}
                className="w-full bg-white border border-gray-200 rounded-2xl p-4 hover:shadow-md transition-all text-center disabled:opacity-50"
              >
                <span className="text-xl block">📊</span>
                <span className="text-sm font-bold text-brand-dark">最新のレーダーチャートを見る</span>
              </button>
            </>
          )}
        </main>
        <BottomNav role="player" />
      </div>
    )
  }

  // ============================================================
  // アンケート回答画面
  // ============================================================
  if (mode === 'answering' && currentTask) {
    const isSelf = currentTask.target_id === user.id
    const answeredCount = Object.keys(answers).length
    const totalQ = EVALUATION_QUESTIONS.length

    // カテゴリごとに質問をグループ化する
    const grouped: Record<string, typeof EVALUATION_QUESTIONS> = {}
    for (const q of EVALUATION_QUESTIONS) {
      if (!grouped[q.category]) grouped[q.category] = []
      grouped[q.category].push(q)
    }

    return (
      <div className="min-h-screen bg-brand-bg pb-24 md:pb-8">
        <Header userName={user.name} role="player" />
        <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
          {/* ヘッダー */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <button
              onClick={() => setMode('task_list')}
              className="text-sm text-gray-500 hover:text-gray-700 mb-2 flex items-center gap-1"
            >
              ← 一覧に戻る
            </button>
            <h2 className="text-lg font-bold text-brand-dark">
              {isSelf ? '自己評価アンケート' : `${targetUserName} さんへの評価`}
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              各質問を 1（全くできていない）〜 5（非常によくできている）で評価してください
            </p>
            {/* 進捗バー */}
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>回答済み</span>
                <span>{answeredCount} / {totalQ}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-brand-main h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(answeredCount / totalQ) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* カテゴリごとの質問 */}
          {Object.entries(grouped).map(([category, questions]) => (
            <div key={category} className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-brand-dark flex items-center gap-2">
                <span className="bg-brand-main w-1.5 h-4 rounded-full" />
                {category}
              </h3>
              {questions.map(q => (
                <div key={q.id}>
                  <p className="text-sm text-gray-700 mb-2">{q.id}. {q.text}</p>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(score => (
                      <button
                        key={score}
                        onClick={() => setAnswers(prev => ({ ...prev, [q.id]: score }))}
                        className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                          answers[q.id] === score
                            ? 'bg-brand-main text-brand-dark shadow-md scale-105'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1 px-1">
                    <span>全くできていない</span>
                    <span>非常によくできている</span>
                  </div>
                </div>
              ))}
            </div>
          ))}

          {/* 送信ボタン / 完了メッセージ */}
          {submitDone ? (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
              <p className="text-green-700 font-bold text-lg">✅ 回答を送信しました！</p>
              <p className="text-green-600 text-sm mt-1">
                {isSelf ? '自己評価が完了しました。' : `${targetUserName} さんへの評価が完了しました。`}
              </p>
              <button
                onClick={() => setMode('task_list')}
                className="mt-3 bg-brand-main text-brand-dark font-bold px-6 py-2 rounded-xl hover:bg-yellow-400 transition-colors text-sm"
              >
                一覧に戻る
              </button>
            </div>
          ) : (
            <button
              onClick={handleSubmitAnswers}
              disabled={submitting || answeredCount < totalQ}
              className="w-full bg-brand-main text-brand-dark font-bold py-4 rounded-2xl hover:bg-yellow-400 transition-all disabled:opacity-50 text-lg shadow-lg mb-4"
            >
              {submitting ? '送信中...' : answeredCount < totalQ
                ? `残り ${totalQ - answeredCount} 問回答してください`
                : '回答を送信する'
              }
            </button>
          )}
        </main>
        <BottomNav role="player" />
      </div>
    )
  }

  // ============================================================
  // 評価結果表示（レーダーチャート）
  // ============================================================
  if (mode === 'result') {
    const hasData = selfAnswers.length > 0 || allAnswers.length > 0

    return (
      <div className="min-h-screen bg-brand-bg pb-24 md:pb-8">
        <Header userName={user.name} role="player" />
        <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <button
              onClick={() => setMode('task_list')}
              className="text-sm text-gray-500 hover:text-gray-700 mb-2 flex items-center gap-1"
            >
              ← 一覧に戻る
            </button>
            <h2 className="text-lg font-bold text-brand-dark">📊 あなたの10ヶ条評価結果</h2>
            <p className="text-xs text-gray-500 mt-1">
              自己評価（実線）と他者評価の平均（点線）を比較して、自分の現在地を把握しよう
            </p>
          </div>

          {!hasData ? (
            <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
              <p className="text-gray-500 text-sm">まだ評価データがありません。</p>
              <p className="text-gray-400 text-xs mt-1">アンケートに回答すると結果が表示されます。</p>
            </div>
          ) : (
            <>
              {/* レーダーチャート */}
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <h3 className="text-sm font-bold text-gray-700 mb-3">カテゴリ別スコア</h3>
                <ResponsiveContainer width="100%" height={280}>
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
                    {allAnswers.length > 0 && (
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
              </div>

              {/* カテゴリ別スコア一覧 */}
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <h3 className="text-sm font-bold text-gray-700 mb-3">カテゴリ別スコア詳細</h3>
                <div className="space-y-3">
                  {radarData.map(item => {
                    const gap = Math.abs(item['自己評価'] - item['他者評価平均'])
                    // ギャップ判定：他者評価データが存在する場合のみ
                    const isGap = gap >= 1 && allAnswers.length > 0 && item['他者評価平均'] > 0
                    return (
                      <div key={item.category}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-medium text-gray-700">{item.category}</span>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-yellow-600 font-bold">自己: {item['自己評価']}</span>
                            {/* 他者評価データがある場合のみ数値を表示する（0点でも表示） */}
                            {allAnswers.length > 0 && item['他者評価平均'] > 0 && (
                              <span className="text-blue-500 font-bold">他者: {item['他者評価平均']}</span>
                            )}
                            {isGap && (
                              <span className="text-red-500 font-bold text-[10px] bg-red-50 px-1 py-0.5 rounded">
                                ギャップ！
                              </span>
                            )}
                          </div>
                        </div>
                        {/* 自己評価バー */}
                        <div className="flex gap-1 items-center">
                          <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-yellow-400 h-1.5 rounded-full transition-all"
                              style={{ width: `${(item['自己評価'] / 5) * 100}%` }}
                            />
                          </div>
                        </div>
                        {/* 他者評価バー（他者評価データがある場合は常に表示） */}
                        {allAnswers.length > 0 && (
                          <div className="flex gap-1 items-center mt-0.5">
                            <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                              <div
                                className="bg-blue-400 h-1.5 rounded-full transition-all opacity-60"
                                style={{ width: `${(item['他者評価平均'] / 5) * 100}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* SSCプラン入力へ誘導 */}
              <div className="bg-gradient-to-r from-brand-dark to-gray-700 rounded-2xl p-4 text-white">
                <p className="font-bold text-sm">📝 評価結果からアクションを考えよう</p>
                <p className="text-white/80 text-xs mt-1">
                  ギャップの大きいカテゴリを参考に、Start / Stop / Continue を入力すると
                  日々の目標とマンダラチャートに自動的に反映されます。
                </p>
                <button
                  onClick={() => setMode('ssc_input')}
                  className="mt-3 bg-brand-main text-brand-dark font-bold px-5 py-2 rounded-xl text-sm hover:bg-yellow-400 transition-colors"
                >
                  アクションプランを入力する →
                </button>
              </div>
            </>
          )}
        </main>
        <BottomNav role="player" />
      </div>
    )
  }

  // ============================================================
  // Start / Stop / Continue 入力画面
  // ============================================================
  if (mode === 'ssc_input') {
    return (
      <div className="min-h-screen bg-brand-bg pb-24 md:pb-8">
        <Header userName={user.name} role="player" />
        <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <button
              onClick={() => setMode('result')}
              className="text-sm text-gray-500 hover:text-gray-700 mb-2 flex items-center gap-1"
            >
              ← 結果に戻る
            </button>
            <h2 className="text-lg font-bold text-brand-dark">🎯 アクションプラン</h2>
            <p className="text-xs text-gray-500 mt-1">
              評価結果をもとに、これからの具体的な行動を設定しよう。
              入力した内容は「日々の入力」の目標候補と「マンダラチャート」に自動反映されます。
            </p>
          </div>

          {/* Start */}
          <div className="bg-green-50 rounded-2xl p-4 shadow-sm border border-green-200">
            <h3 className="text-sm font-bold text-green-700 mb-2 flex items-center gap-2">
              <span className="text-lg">🚀</span> Start（新しく始めること）
            </h3>
            <textarea
              value={startAction}
              onChange={e => setStartAction(e.target.value.slice(0, 200))}
              placeholder="例: 毎日の練習後にシュート50本追加する"
              className="w-full px-3 py-2 rounded-xl border border-green-200 focus:border-green-400 focus:outline-none text-sm bg-white resize-none"
              rows={3}
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{startAction.length}/200</p>
          </div>

          {/* Stop */}
          <div className="bg-red-50 rounded-2xl p-4 shadow-sm border border-red-200">
            <h3 className="text-sm font-bold text-red-700 mb-2 flex items-center gap-2">
              <span className="text-lg">🛑</span> Stop（やめること）
            </h3>
            <textarea
              value={stopAction}
              onChange={e => setStopAction(e.target.value.slice(0, 200))}
              placeholder="例: 練習中にスマホを気にするのをやめる"
              className="w-full px-3 py-2 rounded-xl border border-red-200 focus:border-red-400 focus:outline-none text-sm bg-white resize-none"
              rows={3}
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{stopAction.length}/200</p>
          </div>

          {/* Continue */}
          <div className="bg-blue-50 rounded-2xl p-4 shadow-sm border border-blue-200">
            <h3 className="text-sm font-bold text-blue-700 mb-2 flex items-center gap-2">
              <span className="text-lg">🔄</span> Continue（続けること）
            </h3>
            <textarea
              value={continueAction}
              onChange={e => setContinueAction(e.target.value.slice(0, 200))}
              placeholder="例: 練習前後の声出しと挨拶を継続する"
              className="w-full px-3 py-2 rounded-xl border border-blue-200 focus:border-blue-400 focus:outline-none text-sm bg-white resize-none"
              rows={3}
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{continueAction.length}/200</p>
          </div>

          {/* 保存ボタン */}
          <div className="space-y-2">
            {sscSaved && (
              <p className="text-center text-green-600 font-medium text-sm">✅ 保存しました</p>
            )}
            <button
              onClick={handleSaveSsc}
              disabled={sscSaving}
              className="w-full bg-brand-main text-brand-dark font-bold py-4 rounded-2xl hover:bg-yellow-400 transition-all disabled:opacity-50 text-lg shadow-lg"
            >
              {sscSaving ? '保存中...' : 'アクションプランを保存する'}
            </button>
            <button
              onClick={() => router.push('/player/dashboard')}
              className="w-full bg-white text-brand-dark font-medium py-3 rounded-2xl hover:bg-gray-50 transition-colors text-sm"
            >
              ダッシュボードに戻る
            </button>
          </div>
        </main>
        <BottomNav role="player" />
      </div>
    )
  }

  // ============================================================
  // タスク一覧（デフォルト画面）
  // ============================================================
  return (
    <div className="min-h-screen bg-brand-bg pb-24 md:pb-8">
      <Header userName={user.name} role="player" />
      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* タイトルカード */}
        <div className="bg-gradient-to-r from-brand-dark to-gray-700 rounded-2xl p-5 text-white">
          <h2 className="text-xl font-bold">📋 10ヶ条評価</h2>
          <p className="text-white/70 text-sm mt-1">
            自己評価と仲間への評価を通じて、客観的な自分の現在地を知ろう
          </p>
        </div>

        {/* 未完了タスク */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <span className="bg-orange-400 w-1.5 h-5 rounded-full" />
            回答待ちのアンケート
            {pendingTasks.length > 0 && (
              <span className="bg-orange-100 text-orange-600 text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingTasks.length}件
              </span>
            )}
          </h3>
          {pendingTasks.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">
              現在、回答待ちのアンケートはありません 🎉
            </p>
          ) : (
            <div className="space-y-2">
              {pendingTasks.map(task => {
                const isSelf = task.target_id === user.id
                const targetName = userMap[task.target_id] || task.target_id
                return (
                  <div
                    key={task.id}
                    className="flex items-center justify-between bg-orange-50 border border-orange-100 rounded-xl p-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{isSelf ? '🪞' : '👤'}</span>
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {isSelf ? '自己評価（自分）' : `${targetName} さんへの評価`}
                        </p>
                        <p className="text-xs text-gray-500">全30問 / 約5分</p>
                      </div>
                    </div>
                    <button
                      onClick={() => startAnswering(task)}
                      className="bg-brand-main text-brand-dark font-bold px-4 py-2 rounded-xl text-sm hover:bg-yellow-400 transition-colors whitespace-nowrap"
                    >
                      回答する
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 結果確認・SSCプラン・成長グラフへの導線 */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={showMyResult}
            disabled={resultLoading}
            className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all text-center disabled:opacity-50"
          >
            <span className="text-2xl block">📊</span>
            <span className="text-sm font-bold text-brand-dark mt-1 block">評価結果を見る</span>
            <span className="text-xs text-gray-500 block">レーダーチャート</span>
          </button>
          <button
            onClick={() => setMode('ssc_input')}
            className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all text-center"
          >
            <span className="text-2xl block">🎯</span>
            <span className="text-sm font-bold text-brand-dark mt-1 block">アクションプラン</span>
            <span className="text-xs text-gray-500 block">Start / Stop / Continue</span>
          </button>
        </div>
        <button
          onClick={showGrowthGraph}
          disabled={historyLoading}
          className="w-full bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all text-center disabled:opacity-50"
        >
          <span className="text-2xl block">📈</span>
          <span className="text-sm font-bold text-green-800 mt-1 block">
            {historyLoading ? '読み込み中...' : '成長グラフ'}
          </span>
          <span className="text-xs text-green-600 block">自己・他者評価の点数推移</span>
        </button>

        {/* 説明カード */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
          <p className="text-xs font-bold text-yellow-800 mb-2">💡 10ヶ条評価とは？</p>
          <ul className="text-xs text-yellow-700 space-y-1">
            <li>• 礼儀・時間管理・チームワークなど10カテゴリ（計30問）で評価します</li>
            <li>• 自己評価と仲間からの評価を比較することで、自分の強み・課題を客観視できます</li>
            <li>• 評価後にStart/Stop/Continueを入力すると、日々の目標に自動反映されます</li>
          </ul>
        </div>
      </main>
      <BottomNav role="player" />
    </div>
  )
}
