'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { User, Tournament, DailyRecord, EvaluationTask, Notice } from '@/types/database'
import { getActiveTournament, getDailyRecords, calculateStreak, getPendingEvaluationTasks, getNotices, createNotice, completeNotice, uncompleteNotice } from '@/lib/data'
import { getSession } from '@/lib/session'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'
import { AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format, differenceInDays, subDays, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'

export default function PlayerDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<Pick<User, 'id' | 'name' | 'role'> | null>(null)
  const [tournament, setTournament] = useState<Tournament | null>(null)
  // 全件レコード（累計計算・ストリーク計算に使用）
  const [allRecords, setAllRecords] = useState<DailyRecord[]>([])
  // 直近30日のレコード（週間サマリー・グラフに使用）
  const [recentRecords, setRecentRecords] = useState<DailyRecord[]>([])
  // 未完了の10ヶ条評価タスク（通知バナー表示用）
  const [pendingEvalTasks, setPendingEvalTasks] = useState<EvaluationTask[]>([])
  const [loading, setLoading] = useState(true)
  // 連絡事項・TODOリスト
  const [notices, setNotices] = useState<Notice[]>([])
  // 連絡事項・TODO作成モーダル
  const [showNoticeModal, setShowNoticeModal] = useState(false)
  const [noticeTitle, setNoticeTitle] = useState('')
  const [noticeBody, setNoticeBody] = useState('')
  const [noticeType, setNoticeType] = useState<'notice' | 'todo'>('notice')
  const [noticeSaving, setNoticeSaving] = useState(false)

  useEffect(() => {
    const session = getSession()
    if (!session) { router.push('/login'); return }
    if (session.role === 'staff') { router.push('/coach/dashboard'); return }
    setUser(session)
    const userData = session

    const loadData = async () => {
      try {
        // 全件と直近30日を並列で取得する
        const [t, allR, recentR, evalTasks] = await Promise.all([
          getActiveTournament(),
          // startDate未指定で全期間のデータを取得（累計記録数・ストリーク計算用）
          getDailyRecords(userData.id),
          // 直近30日（週間サマリー・グラフ用）
          getDailyRecords(userData.id, format(subDays(new Date(), 30), 'yyyy-MM-dd')),
          // 未完了の10ヶ条評価タスク（通知バナー用）
          getPendingEvaluationTasks(userData.id),
        ])
        setTournament(t)
        setAllRecords(allR)
        setRecentRecords(recentR)
        setPendingEvalTasks(evalTasks)
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
      // 連絡事項・TODOを非同期で取得する（ページ描画をブロックしない）
      getNotices(userData.id).then(data => setNotices(data)).catch(e => console.error('[player] 連絡事項取得エラー:', e))
    }
    loadData()
  }, [router])

  /** 連絡事項・TODOチェック処理 */
  const handleToggleNoticeComplete = async (noticeId: string, isCompleted: boolean) => {
    if (!user) return
    try {
      if (isCompleted) {
        await uncompleteNotice(noticeId, user.id)
      } else {
        await completeNotice(noticeId, user.id)
      }
      // チェック後は自分の画面からは消える（再取得で最新状態に）
      const data = await getNotices(user.id)
      setNotices(data)
    } catch (e) {
      console.error('[player] チェック処理エラー:', e)
    }
  }

  /** 連絡事項・TODO作成処理（選手からも追加可） */
  const handleCreateNotice = async () => {
    if (!user || !noticeTitle.trim()) return
    setNoticeSaving(true)
    try {
      const newNotice = await createNotice(user.id, noticeTitle.trim(), noticeBody.trim() || null, noticeType)
      setNotices(prev => [newNotice, ...prev])
      setNoticeTitle('')
      setNoticeBody('')
      setNoticeType('notice')
      setShowNoticeModal(false)
    } catch (e) {
      console.error('[player] 連絡事項作成エラー:', e)
      alert('作成に失敗しました。再度お試しください。')
    } finally {
      setNoticeSaving(false)
    }
  }

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-brand-main text-xl font-bold">読み込み中...</div>
      </div>
    )
  }

  const now = new Date()

  // 週間サマリー（直近7日）
  const weekRecords = recentRecords.filter(r => differenceInDays(now, parseISO(r.record_date)) <= 7)
  const weekAvgEval = weekRecords.length > 0
    ? (weekRecords.reduce((sum, r) => sum + r.self_evaluation, 0) / weekRecords.length).toFixed(1)
    : '-'
  const weekPoints = weekRecords.reduce((sum, r) => sum + r.points, 0)

  // 累計ポイント・累計記録数は全件データを使用
  const totalPoints = allRecords.reduce((sum, r) => sum + r.points, 0)
  const totalRecordCount = allRecords.length

  // 連続記録日数（過去全データから算出）
  const streakDays = calculateStreak(allRecords)

  const daysRemaining = tournament ? differenceInDays(parseISO(tournament.target_date), now) : null
  const allEvalAvg = recentRecords.length > 0
    ? Math.round((recentRecords.reduce((sum, r) => sum + r.self_evaluation, 0) / recentRecords.length) * 10)
    : 0

  const participationCounts = recentRecords.reduce((acc, r) => {
    acc[r.participation_status] = (acc[r.participation_status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // グラフは直近14件を使用
  const chartData = recentRecords.slice(-14).map(r => ({
    date: format(parseISO(r.record_date), 'M/d'),
    evaluation: r.self_evaluation,
    fatigue: r.fatigue_level,
  }))

  return (
    <div className="min-h-screen bg-brand-bg pb-20 md:pb-8">
      <Header userName={user.name} role="player" />
      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* ====== 連絡事項・TODOリスト（ダッシュボード最上部） ====== */}
        <PlayerNoticeBoard
          notices={notices}
          currentUserId={user.id}
          onToggleComplete={handleToggleNoticeComplete}
          onAddClick={() => setShowNoticeModal(true)}
        />

        {/* 10ヶ条評価タスク通知バナー */}
        {pendingEvalTasks.length > 0 && (
          <div
            className="bg-gradient-to-r from-orange-500 to-yellow-400 rounded-2xl p-4 shadow-md flex items-center justify-between cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => router.push('/player/evaluation')}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">📋</span>
              <div>
                <p className="text-white font-bold text-sm">今月の10ヶ条評価が届いています！</p>
                <p className="text-white/80 text-xs mt-0.5">
                  未回答 {pendingEvalTasks.length} 件 — タップして回答する
                </p>
              </div>
            </div>
            <span className="text-white text-lg">→</span>
          </div>
        )}

        {/* Welcome */}
        <div className="bg-gradient-to-r from-brand-dark to-gray-700 rounded-2xl p-5 text-white">
          <p className="text-sm text-gray-300">おかえりなさい</p>
          <h2 className="text-xl font-bold mt-1">{user.name}</h2>
          <p className="text-brand-main text-sm mt-2 font-semibold">累計ポイント: {totalPoints} pt</p>
        </div>

        {/* 連続記録・累計記録カード */}
        <div className="grid grid-cols-2 gap-3">
          {/* 連続記録日数（ストリーク） */}
          <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
            <p className="text-xs text-gray-500">🔥 連続記録</p>
            <p className="text-3xl font-bold text-brand-main mt-1">{streakDays}</p>
            <p className="text-xs text-gray-400">日継続中</p>
            {streakDays >= 3 && (
              <p className="text-xs text-orange-500 font-medium mt-1">
                {streakDays >= 30 ? '🏆 すごい!1ヶ月突破!' :
                  streakDays >= 14 ? '⭐ 2週間継続!' :
                  streakDays >= 7 ? '✨ 1週間達成!' : '🔥 連続中!'}
              </p>
            )}
          </div>
          {/* 累計記録日数 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
            <p className="text-xs text-gray-500">📝 累計記録</p>
            <p className="text-3xl font-bold text-brand-dark mt-1">{totalRecordCount}</p>
            <p className="text-xs text-gray-400">日分の記録</p>
          </div>
        </div>

        {/* Tournament countdown */}
        {tournament && daysRemaining !== null && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">次の目標</p>
                <p className="text-lg font-bold text-brand-dark mt-1">{tournament.name}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {format(parseISO(tournament.target_date), 'yyyy年M月d日(E)', { locale: ja })}
                </p>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-brand-main">{Math.max(0, daysRemaining)}</div>
                <div className="text-xs text-gray-500">日</div>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>達成度</span><span>{allEvalAvg}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div className="bg-brand-main h-3 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, allEvalAvg)}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* Weekly summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <p className="text-xs text-gray-500">週間評価</p>
            <p className="text-2xl font-bold text-brand-dark mt-1">{weekAvgEval}</p>
            <p className="text-xs text-gray-400">/10点</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <p className="text-xs text-gray-500">週間ポイント</p>
            <p className="text-2xl font-bold text-brand-main mt-1">{weekPoints}</p>
            <p className="text-xs text-gray-400">pt</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <p className="text-xs text-gray-500">今週記録</p>
            <p className="text-2xl font-bold text-brand-dark mt-1">{weekRecords.length}</p>
            <p className="text-xs text-gray-400">/7日</p>
          </div>
        </div>

        {/* Participation stats */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">参加状況（直近30日）</h3>
          <div className="flex flex-wrap gap-2">
            {['参加', 'リハビリ', '体調不良', '通院', 'REST'].map(status => (
              <span key={status} className="inline-flex items-center gap-1 bg-gray-100 px-3 py-1.5 rounded-lg text-xs">
                <span className="font-medium text-gray-700">{status}</span>
                <span className="font-bold text-brand-dark">{participationCounts[status] || 0}日</span>
              </span>
            ))}
          </div>
        </div>

        {/* Chart */}
        {chartData.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">成長推移グラフ</h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="evalGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e1c614" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#e1c614" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                  formatter={(value: number, name: string) => {
                    const labels: Record<string, string> = { evaluation: '自己評価', fatigue: '疲労度' }
                    return [value, labels[name] || name]
                  }}
                />
                <Area type="monotone" dataKey="evaluation" stroke="#e1c614" fill="url(#evalGradient)" strokeWidth={2} />
                <Line type="monotone" dataKey="fatigue" stroke="#ef4444" strokeWidth={1.5} dot={{ r: 2 }} strokeDasharray="4 4" />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-4 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-brand-main inline-block" /> 自己評価</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-500 inline-block" /> 疲労度</span>
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => router.push('/player/daily')} className="bg-brand-main text-brand-dark font-bold py-4 rounded-2xl shadow-md hover:bg-yellow-400 transition-all card-hover text-center">
            <span className="text-2xl block">✏️</span>
            <span className="text-sm mt-1 block">今日の記録を書く</span>
          </button>
          <button onClick={() => router.push('/player/mandala')} className="bg-white text-brand-dark font-bold py-4 rounded-2xl shadow-sm hover:shadow-md transition-all card-hover text-center">
            <span className="text-2xl block">🎯</span>
            <span className="text-sm mt-1 block">目標を確認する</span>
          </button>
        </div>

        {/* 連絡＆TODOボタン */}
        <button
          onClick={() => setShowNoticeModal(true)}
          className="w-full bg-blue-50 border-2 border-blue-200 text-blue-700 font-bold py-3 rounded-2xl hover:bg-blue-100 transition-all text-center text-sm"
        >
          📢 連絡＆TODO を追加する
        </button>
      </main>
      <BottomNav role="player" />

      {/* ====== 連絡事項・TODO作成モーダル ====== */}
      {showNoticeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-bold text-gray-800 mb-4">📢 連絡事項・TODOを追加</h3>

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setNoticeType('notice')}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${noticeType === 'notice' ? 'bg-blue-500 text-white shadow-md' : 'bg-gray-100 text-gray-600'}`}
              >
                📢 連絡事項
              </button>
              <button
                onClick={() => setNoticeType('todo')}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${noticeType === 'todo' ? 'bg-green-500 text-white shadow-md' : 'bg-gray-100 text-gray-600'}`}
              >
                ✅ TODO
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                タイトル・内容 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={noticeTitle}
                onChange={(e) => setNoticeTitle(e.target.value)}
                placeholder="例: 明日の自主練に参加します"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-main focus:outline-none text-sm"
              />
            </div>

            <div className="mb-5">
              <label className="block text-sm font-semibold text-gray-700 mb-2">詳細（省略可）</label>
              <textarea
                value={noticeBody}
                onChange={(e) => setNoticeBody(e.target.value)}
                placeholder="詳細を入力"
                rows={3}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-main focus:outline-none text-sm resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowNoticeModal(false); setNoticeTitle(''); setNoticeBody('') }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleCreateNotice}
                disabled={noticeSaving || !noticeTitle.trim()}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${noticeSaving || !noticeTitle.trim() ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-brand-main text-brand-dark hover:bg-yellow-400 shadow-md'}`}
              >
                {noticeSaving ? '保存中...' : '追加する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// 選手ダッシュボード用 連絡事項・TODOボード
// ============================================================
function PlayerNoticeBoard({
  notices,
  currentUserId,
  onToggleComplete,
  onAddClick,
}: {
  notices: Notice[]
  currentUserId: string
  onToggleComplete: (noticeId: string, isCompleted: boolean) => void
  onAddClick: () => void
}) {
  // 自分がチェック済みのものを除外して表示
  const visibleNotices = notices.filter(n => {
    const completedByMe = (n.completions || []).some(c => c.user_id === currentUserId)
    return !completedByMe
  })

  if (visibleNotices.length === 0) return null

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-gray-700">📢 連絡事項・TODOリスト</h3>
      </div>
      <div className="space-y-2">
        {visibleNotices.map(n => {
          const completedByMe = (n.completions || []).some(c => c.user_id === currentUserId)
          return (
            <div key={n.id} className="bg-white rounded-2xl p-3 shadow-sm flex items-start gap-3">
              <button
                onClick={() => onToggleComplete(n.id, completedByMe)}
                className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors mt-0.5 ${completedByMe ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-green-400'}`}
              >
                {completedByMe && (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${n.notice_type === 'todo' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                    {n.notice_type === 'todo' ? '✅ TODO' : '📢 連絡'}
                  </span>
                  <p className="text-sm font-medium text-gray-800 leading-tight">{n.title}</p>
                </div>
                {n.body && (
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed whitespace-pre-wrap">{n.body}</p>
                )}
                <p className="text-xs text-gray-400 mt-0.5">
                  {n.creator?.name || '不明'}・{new Date(n.created_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
