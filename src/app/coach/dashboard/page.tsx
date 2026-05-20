'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { User, DailyRecord, DailyRecordWithUser, Tournament, PhysicalRecord, MaxTrainingRecord } from '@/types/database'
import { getUsers, getAllDailyRecords, getActiveTournament, addComment, getTeamConditionRecords, getAllPhysicalRecords, getAllMaxTrainingRecords } from '@/lib/data'
import { getSession } from '@/lib/session'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'
import { format, parseISO, subDays } from 'date-fns'
import { ja } from 'date-fns/locale'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
  LineChart, Line, Legend,
} from 'recharts'

// ============================================================
// チームダッシュボード用の型・ユーティリティ
// ============================================================

/** 日付ごとの平均値を表す型（折れ線グラフ用） */
interface DailyAverage {
  date: string          // 表示用ラベル "M/d"
  rawDate: string       // ソート用 "YYYY-MM-DD"
  avgFatigue: number | null
  avgSleep: number | null
}

/**
 * 選択された選手のレコードから日次平均疲労度・睡眠時間を計算する。
 * データのない日は null を返す。
 */
function calcDailyAverages(
  records: DailyRecord[],
  selectedIds: string[]
): DailyAverage[] {
  const result: DailyAverage[] = []
  const today = new Date()

  // 過去21日間（直近3週間）の日付列を生成
  for (let i = 20; i >= 0; i--) {
    const d = subDays(today, i)
    const rawDate = format(d, 'yyyy-MM-dd')
    const dateLabel = format(d, 'M/d')

    const dayRecords = records.filter(
      r => r.record_date === rawDate && selectedIds.includes(r.user_id)
    )

    if (dayRecords.length === 0) {
      result.push({ date: dateLabel, rawDate, avgFatigue: null, avgSleep: null })
    } else {
      const avgFatigue =
        Math.round(
          (dayRecords.reduce((s, r) => s + r.fatigue_level, 0) / dayRecords.length) * 10
        ) / 10
      const avgSleep =
        Math.round(
          (dayRecords.reduce((s, r) => s + r.sleep_hours, 0) / dayRecords.length) * 10
        ) / 10
      result.push({ date: dateLabel, rawDate, avgFatigue, avgSleep })
    }
  }
  return result
}

// ============================================================
// メインコンポーネント
// ============================================================

export default function CoachDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<Pick<User, 'id' | 'name' | 'role'> | null>(null)
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [todayRecords, setTodayRecords] = useState<DailyRecordWithUser[]>([])
  const [recentRecords, setRecentRecords] = useState<DailyRecordWithUser[]>([])
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})
  const [showComments, setShowComments] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'condition' | 'timeline' | 'growth' | 'team' | 'karte'>('condition')

  // ---- タイムラインタブ用：日付フィルタ state ----
  // '' = 全件表示、'YYYY-MM-DD' = 選択日のみ表示
  const [timelineDate, setTimelineDate] = useState<string>('')
  // タイムライン用データ（別途広い期間で取得）
  const [timelineRecords, setTimelineRecords] = useState<DailyRecordWithUser[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)

  // ---- カルテタブ用 state ----
  const [allPhysicalRecords, setAllPhysicalRecords] = useState<PhysicalRecord[]>([])
  const [allMaxRecords, setAllMaxRecords] = useState<MaxTrainingRecord[]>([])
  const [karteLoading, setKarteLoading] = useState(false)
  const [selectedKartePlayerId, setSelectedKartePlayerId] = useState<string | null>(null)
  const [karteTab, setKarteTab] = useState<'physical' | 'max'>('physical')

  // ---- チームダッシュボード用 state ----
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([])
  const [teamRecords, setTeamRecords] = useState<DailyRecord[]>([])
  const [teamLoading, setTeamLoading] = useState(false)

  useEffect(() => {
    const session = getSession()
    if (!session) { router.push('/login'); return }
    if (session.role !== 'staff') { router.push('/player/dashboard'); return }
    setUser(session)
    loadData()
  }, [router])

  const loadData = async () => {
    try {
      // コンディション・成長タブ用は過去14日間で取得
      const startDate = format(subDays(new Date(), 14), 'yyyy-MM-dd')
      const [users, records, t] = await Promise.all([
        getUsers(),
        getAllDailyRecords(startDate),
        getActiveTournament(),
      ])
      setAllUsers(users)
      setRecentRecords(records)
      setTournament(t)
      const todayStr = format(new Date(), 'yyyy-MM-dd')
      setTodayRecords(records.filter(r => r.record_date === todayStr))

      // 全選手を初期選択状態にする
      const playerIds = users.filter(u => u.role === 'player').map(u => u.id)
      setSelectedPlayerIds(playerIds)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  /**
   * タイムラインタブ用のデータを取得する。
   * 日付未選択時は過去90日間の全件、日付選択時は選択日のみ取得する。
   */
  const loadTimelineRecords = useCallback(async (dateFilter: string) => {
    setTimelineLoading(true)
    try {
      if (dateFilter) {
        // 選択日のみ取得
        const data = await getAllDailyRecords(dateFilter, dateFilter)
        setTimelineRecords(data)
      } else {
        // 全件（過去90日間）取得
        const startDate = format(subDays(new Date(), 89), 'yyyy-MM-dd')
        const data = await getAllDailyRecords(startDate)
        setTimelineRecords(data)
      }
    } catch (e) {
      console.error('[Timeline] データ取得エラー:', e)
    } finally {
      setTimelineLoading(false)
    }
  }, [])

  /** チームタブ用に過去21日間のコンディションデータを取得する */
  const loadTeamRecords = useCallback(async (ids: string[]) => {
    if (ids.length === 0) {
      setTeamRecords([])
      return
    }
    setTeamLoading(true)
    try {
      const startDate = format(subDays(new Date(), 20), 'yyyy-MM-dd')
      const endDate = format(new Date(), 'yyyy-MM-dd')
      const data = await getTeamConditionRecords(ids, startDate, endDate)
      setTeamRecords(data)
    } catch (e) {
      console.error('[TeamDashboard] データ取得エラー:', e)
    } finally {
      setTeamLoading(false)
    }
  }, [])

  // タイムラインタブがアクティブになった / 日付フィルタが変わったときにデータ再取得
  useEffect(() => {
    if (activeTab === 'timeline') {
      loadTimelineRecords(timelineDate)
    }
  }, [activeTab, timelineDate, loadTimelineRecords])

  // チームタブがアクティブになった / 選択選手が変わったときにデータ再取得
  useEffect(() => {
    if (activeTab === 'team') {
      loadTeamRecords(selectedPlayerIds)
    }
  }, [activeTab, selectedPlayerIds, loadTeamRecords])

  /** カルテタブがアクティブになったときにデータを取得する */
  const loadKarteData = useCallback(async () => {
    setKarteLoading(true)
    try {
      const [phys, max] = await Promise.all([
        getAllPhysicalRecords(),
        getAllMaxTrainingRecords(),
      ])
      setAllPhysicalRecords(phys)
      setAllMaxRecords(max)
    } catch (e) {
      console.error('[KarteDashboard] データ取得エラー:', e)
    } finally {
      setKarteLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'karte') {
      loadKarteData()
    }
  }, [activeTab, loadKarteData])

  const handleDateChange = (date: string) => {
    setSelectedDate(date)
    setTodayRecords(recentRecords.filter(r => r.record_date === date))
  }

  const handleAddComment = async (recordId: string) => {
    if (!user || !commentInputs[recordId]?.trim()) return
    try {
      const newComment = await addComment(recordId, user.id, commentInputs[recordId].trim())
      // recentRecords（コンディション・成長タブ用）を更新
      setRecentRecords(prev =>
        prev.map(r =>
          r.id === recordId ? { ...r, comments: [...(r.comments || []), newComment] } : r
        )
      )
      // timelineRecords（タイムラインタブ用）も更新
      setTimelineRecords(prev =>
        prev.map(r =>
          r.id === recordId ? { ...r, comments: [...(r.comments || []), newComment] } : r
        )
      )
      setCommentInputs(prev => ({ ...prev, [recordId]: '' }))
    } catch (e) {
      console.error(e)
    }
  }

  /** 選手チェックボックスのトグル */
  const togglePlayer = (playerId: string) => {
    setSelectedPlayerIds(prev =>
      prev.includes(playerId)
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    )
  }

  /** 全選択 / 全解除 */
  const toggleAll = () => {
    const allPlayerIds = players.map(p => p.id)
    if (selectedPlayerIds.length === allPlayerIds.length) {
      setSelectedPlayerIds([])
    } else {
      setSelectedPlayerIds(allPlayerIds)
    }
  }

  const players = allUsers.filter(u => u.role === 'player')
  const getUserName = (userId: string) => allUsers.find(u => u.id === userId)?.name || '不明'

  // コンディションタブ用の棒グラフデータ
  const fatigueData = players.map(player => {
    const latestRecord = recentRecords.find(r => r.user_id === player.id)
    return {
      name: player.name.split(' ')[1] || player.name,
      fatigue: latestRecord?.fatigue_level || 0,
      sleep: latestRecord?.sleep_hours || 0,
      hasPain: latestRecord?.has_pain || false,
    }
  })

  // チーム推移タブ用の折れ線グラフデータ（選択選手の日次平均）
  const dailyAverages = calcDailyAverages(teamRecords, selectedPlayerIds)

  // 21日間の全体平均（サマリー表示用）
  const validFatigue = dailyAverages.filter(d => d.avgFatigue !== null).map(d => d.avgFatigue as number)
  const validSleep = dailyAverages.filter(d => d.avgSleep !== null).map(d => d.avgSleep as number)
  const overallAvgFatigue = validFatigue.length > 0
    ? Math.round(validFatigue.reduce((s, v) => s + v, 0) / validFatigue.length * 10) / 10
    : null
  const overallAvgSleep = validSleep.length > 0
    ? Math.round(validSleep.reduce((s, v) => s + v, 0) / validSleep.length * 10) / 10
    : null

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-brand-main text-xl font-bold">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-bg pb-20 md:pb-8">
      <Header userName={user.name} role="staff" />
      <main className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 gap-3">
          <div>
            <h2 className="text-xl font-bold text-brand-dark">チームダッシュボード</h2>
            <p className="text-xs text-gray-500">
              {tournament
                ? `${tournament.name}まで ${Math.max(0, Math.ceil((new Date(tournament.target_date).getTime() - Date.now()) / 86400000))}日`
                : '大会未設定'}
            </p>
          </div>
          {/* チーム推移・カルテタブでは日付セレクターを非表示 */}
          {activeTab !== 'team' && activeTab !== 'karte' && (
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-main focus:outline-none"
            />
          )}
        </div>

        {/* ====== タブ ====== */}
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {([
            { key: 'condition', label: 'コンディション', icon: '❤️' },
            { key: 'timeline',  label: 'タイムライン',   icon: '📝' },
            { key: 'growth',    label: '成長・達成度',   icon: '📈' },
            { key: 'team',      label: 'チーム推移',     icon: '📊' },
            { key: 'karte',     label: 'カルテ',         icon: '📋' },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === tab.key
                  ? 'bg-brand-main text-brand-dark shadow-md'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span>{tab.icon}</span><span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ====== コンディションタブ ====== */}
        {activeTab === 'condition' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-bold text-gray-700 mb-3">疲労度一覧</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={fatigueData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value: number, name: string) => [value, name === 'fatigue' ? '疲労度' : '睡眠時間']}
                  />
                  <Bar dataKey="fatigue" name="疲労度" radius={[4, 4, 0, 0]}>
                    {fatigueData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={entry.fatigue >= 8 ? '#ef4444' : entry.fatigue >= 6 ? '#f59e0b' : '#22c55e'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {players.map(player => {
                const record = todayRecords.find(r => r.user_id === player.id)
                const latestRecord = recentRecords.find(r => r.user_id === player.id)
                const displayRecord = record || latestRecord
                return (
                  <div
                    key={player.id}
                    className={`bg-white rounded-xl p-4 shadow-sm border-l-4 ${
                      displayRecord && displayRecord.fatigue_level >= 8
                        ? 'border-red-500'
                        : displayRecord && displayRecord.fatigue_level >= 6
                        ? 'border-orange-400'
                        : 'border-green-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-gray-800">{player.name}</h4>
                      {!record && <span className="text-xs text-gray-400">最新データ</span>}
                    </div>
                    {displayRecord ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">疲労度</span>
                          <span className={`font-bold ${
                            displayRecord.fatigue_level >= 8 ? 'text-red-500'
                              : displayRecord.fatigue_level >= 6 ? 'text-orange-500'
                              : 'text-green-500'
                          }`}>
                            {displayRecord.fatigue_level}/10
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">睡眠</span>
                          <span className={`font-medium ${displayRecord.sleep_hours < 6 ? 'text-red-500' : 'text-gray-700'}`}>
                            {displayRecord.sleep_hours}時間
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">参加</span>
                          <span className="text-gray-700">{displayRecord.participation_status}</span>
                        </div>
                        {displayRecord.has_pain && (
                          <div className="bg-red-50 px-2 py-1.5 rounded-lg mt-1">
                            <p className="text-xs text-red-600 font-medium">⚠️ 痛みあり: {displayRecord.pain_detail}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">データなし</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ====== タイムラインタブ ====== */}
        {activeTab === 'timeline' && (
          <div className="space-y-3">

            {/* ---- 日付フィルタ パネル ---- */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-sm font-bold text-gray-700">📅 日付を選択</span>
                  <input
                    type="date"
                    value={timelineDate}
                    max={format(new Date(), 'yyyy-MM-dd')}
                    onChange={(e) => setTimelineDate(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-brand-main focus:outline-none text-sm transition-colors"
                  />
                </div>
                {timelineDate && (
                  <button
                    onClick={() => setTimelineDate('')}
                    className="text-xs text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-xl transition-colors whitespace-nowrap"
                  >
                    ✕ 絞り込みを解除
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {timelineDate
                  ? `${format(parseISO(timelineDate), 'yyyy年M月d日(E)', { locale: ja })} のデータを表示中`
                  : '過去90日間のデータを表示中（日付を選択すると絞り込めます）'}
              </p>
            </div>

            {/* ---- ローディング ---- */}
            {timelineLoading && (
              <div className="flex items-center justify-center py-16">
                <div className="animate-pulse text-brand-main font-bold">データ読み込み中...</div>
              </div>
            )}

            {/* ---- レコード一覧 ---- */}
            {!timelineLoading && timelineRecords.length === 0 && (
              <div className="text-center py-12 text-gray-500 bg-white rounded-2xl shadow-sm">
                <p className="text-4xl mb-3">📝</p>
                <p className="text-sm">
                  {timelineDate ? 'この日の記録はありません' : 'まだ記録がありません'}
                </p>
                {timelineDate && (
                  <button
                    onClick={() => setTimelineDate('')}
                    className="mt-3 text-xs text-brand-dark bg-brand-main px-4 py-2 rounded-xl hover:bg-yellow-400 transition-colors"
                  >
                    全件表示に戻す
                  </button>
                )}
              </div>
            )}

            {!timelineLoading && timelineRecords.map(record => {
              const profileName = record.users?.name || getUserName(record.user_id)
              const comments = record.comments || []
              const isExpanded = showComments[record.id]
              return (
                <div key={record.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600">
                          {profileName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{profileName}</p>
                          <p className="text-xs text-gray-400">
                            {format(parseISO(record.record_date), 'M月d日(E)', { locale: ja })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium">
                          評価 {record.self_evaluation}/10
                        </span>
                        {record.fatigue_level >= 7 && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">
                            疲労 {record.fatigue_level}
                          </span>
                        )}
                      </div>
                    </div>
                    {record.target_items.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {record.target_items.map((goal, idx) => (
                          <span key={idx} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            {goal}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{record.reflection}</p>
                    <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                      <span>😴 {record.sleep_hours}h</span>
                      <span className={record.fatigue_level >= 7 ? 'text-red-500 font-medium' : ''}>
                        疲労 {record.fatigue_level}/10
                      </span>
                      {record.has_pain && <span className="text-red-500">⚠️ {record.pain_detail}</span>}
                    </div>
                  </div>
                  <div className="border-t border-gray-100">
                    <button
                      onClick={() => setShowComments(prev => ({ ...prev, [record.id]: !prev[record.id] }))}
                      className="w-full px-4 py-2 text-xs text-gray-500 hover:bg-gray-50 flex items-center justify-between"
                    >
                      <span>💬 コメント ({comments.length})</span>
                      <span>{isExpanded ? '▲' : '▼'}</span>
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-3">
                        {comments.length > 0 && (
                          <div className="space-y-2 mb-3">
                            {comments.map(comment => (
                              <div key={comment.id} className="bg-blue-50 border border-blue-100 px-3 py-2 rounded-lg text-xs">
                                <span className="font-semibold text-gray-700">
                                  {comment.users?.name || getUserName(comment.user_id)}
                                </span>
                                <p className="text-gray-600 mt-0.5">{comment.content}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={commentInputs[record.id] || ''}
                            onChange={(e) => setCommentInputs(prev => ({ ...prev, [record.id]: e.target.value }))}
                            placeholder="選手にコメントを送る..."
                            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 focus:border-brand-main focus:outline-none text-xs"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                handleAddComment(record.id)
                              }
                            }}
                          />
                          <button
                            onClick={() => handleAddComment(record.id)}
                            className="bg-brand-main text-brand-dark font-medium px-4 py-2 rounded-lg text-xs hover:bg-yellow-400 transition-colors"
                          >
                            送信
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ====== 成長・達成度タブ ====== */}
        {activeTab === 'growth' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {players.map(player => {
              const playerRecords = recentRecords.filter(r => r.user_id === player.id)
              const avgEval = playerRecords.length > 0
                ? (playerRecords.reduce((sum, r) => sum + r.self_evaluation, 0) / playerRecords.length).toFixed(1)
                : '-'
              const totalPoints = playerRecords.reduce((sum, r) => sum + r.points, 0)
              const recordCount = playerRecords.length
              const participationCounts = playerRecords.reduce((acc, r) => {
                acc[r.participation_status] = (acc[r.participation_status] || 0) + 1
                return acc
              }, {} as Record<string, number>)
              return (
                <div key={player.id} className="bg-white rounded-xl p-4 shadow-sm">
                  <h4 className="font-semibold text-gray-800 mb-3">{player.name}</h4>
                  <div className="grid grid-cols-3 gap-2 text-center mb-3">
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-lg font-bold text-brand-dark">{avgEval}</p>
                      <p className="text-xs text-gray-500">平均評価</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-lg font-bold text-brand-main">{totalPoints}</p>
                      <p className="text-xs text-gray-500">獲得pt</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-lg font-bold text-brand-dark">{recordCount}</p>
                      <p className="text-xs text-gray-500">記録数</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(participationCounts).map(([status, count]) => (
                      <span key={status} className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">
                        {status}: {count}日
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ====== チーム推移タブ ====== */}
        {activeTab === 'team' && (
          <div className="space-y-4">

            {/* 選手選択パネル */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-700">📋 表示する選手を選択</h3>
                <button
                  onClick={toggleAll}
                  className="text-xs text-brand-dark bg-brand-main px-3 py-1 rounded-lg font-medium hover:bg-yellow-400 transition-colors"
                >
                  {selectedPlayerIds.length === players.length ? '全員解除' : '全員選択'}
                </button>
              </div>

              {players.length === 0 ? (
                <p className="text-xs text-gray-400">選手が登録されていません</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {players.map(player => {
                    const checked = selectedPlayerIds.includes(player.id)
                    return (
                      <label
                        key={player.id}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm cursor-pointer select-none transition-all ${
                          checked
                            ? 'bg-brand-main border-yellow-400 text-brand-dark font-medium'
                            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePlayer(player.id)}
                          className="sr-only"
                        />
                        <span
                          className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] flex-shrink-0 ${
                            checked ? 'bg-brand-dark border-brand-dark text-white' : 'border-gray-400'
                          }`}
                        >
                          {checked && '✓'}
                        </span>
                        <span>{player.name}</span>
                      </label>
                    )
                  })}
                </div>
              )}

              <p className="text-xs text-gray-400 mt-3">
                {selectedPlayerIds.length}名選択中 / 全{players.length}名
              </p>
            </div>

            {/* ローディング中 */}
            {teamLoading && (
              <div className="flex items-center justify-center py-16">
                <div className="animate-pulse text-brand-main font-bold">データ読み込み中...</div>
              </div>
            )}

            {/* 選手未選択 */}
            {!teamLoading && selectedPlayerIds.length === 0 && (
              <div className="bg-white rounded-2xl p-10 shadow-sm text-center text-gray-400">
                <p className="text-3xl mb-2">👆</p>
                <p className="text-sm">上のリストから選手を選択してください</p>
              </div>
            )}

            {/* グラフエリア */}
            {!teamLoading && selectedPlayerIds.length > 0 && (
              <>
                {/* サマリーカード */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-xl p-4 shadow-sm text-center">
                    <p className="text-xs text-gray-500 mb-1">疲労度 21日平均</p>
                    <p className={`text-2xl font-bold ${
                      overallAvgFatigue !== null && overallAvgFatigue >= 8
                        ? 'text-red-500'
                        : overallAvgFatigue !== null && overallAvgFatigue >= 6
                        ? 'text-orange-500'
                        : 'text-green-500'
                    }`}>
                      {overallAvgFatigue !== null ? overallAvgFatigue : '-'}
                    </p>
                    <p className="text-xs text-gray-400">/ 10点</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 shadow-sm text-center">
                    <p className="text-xs text-gray-500 mb-1">睡眠時間 21日平均</p>
                    <p className={`text-2xl font-bold ${
                      overallAvgSleep !== null && overallAvgSleep < 6 ? 'text-red-500' : 'text-blue-500'
                    }`}>
                      {overallAvgSleep !== null ? overallAvgSleep : '-'}
                    </p>
                    <p className="text-xs text-gray-400">時間</p>
                  </div>
                </div>

                {/* 疲労度折れ線グラフ */}
                <div className="bg-white rounded-2xl p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-gray-700 mb-1">😓 疲労度の平均推移（過去3週間）</h3>
                  <p className="text-xs text-gray-400 mb-4">
                    対象: {selectedPlayerIds.length}名 ／ Y軸: 疲労度スコア（0〜10）
                  </p>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={dailyAverages} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={2} />
                      <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} tickCount={6} />
                      <Tooltip
                        contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                        formatter={(value) => [`${value}`, '疲労度（平均）']}
                      />
                      <Legend
                        formatter={() => `疲労度平均（${selectedPlayerIds.length}名）`}
                        wrapperStyle={{ fontSize: '11px' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="avgFatigue"
                        name="疲労度（平均）"
                        stroke="#ef4444"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: '#ef4444' }}
                        activeDot={{ r: 5 }}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  {/* 判定基準補足 */}
                  <div className="flex gap-3 mt-2 justify-end flex-wrap">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <span className="inline-block w-3 h-0.5 bg-red-400 rounded" /> 8以上: 要注意
                    </span>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <span className="inline-block w-3 h-0.5 bg-yellow-400 rounded" /> 6〜7: 注意
                    </span>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <span className="inline-block w-3 h-0.5 bg-green-400 rounded" /> 〜5: 良好
                    </span>
                  </div>
                </div>

                {/* 睡眠時間折れ線グラフ */}
                <div className="bg-white rounded-2xl p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-gray-700 mb-1">😴 睡眠時間の平均推移（過去3週間）</h3>
                  <p className="text-xs text-gray-400 mb-4">
                    対象: {selectedPlayerIds.length}名 ／ Y軸: 睡眠時間（時間）
                  </p>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={dailyAverages} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={2} />
                      <YAxis domain={[0, 12]} tick={{ fontSize: 11 }} tickCount={7} />
                      <Tooltip
                        contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                        formatter={(value) => [`${value}h`, '睡眠時間（平均）']}
                      />
                      <Legend
                        formatter={() => `睡眠時間平均（${selectedPlayerIds.length}名）`}
                        wrapperStyle={{ fontSize: '11px' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="avgSleep"
                        name="睡眠時間（平均）"
                        stroke="#3b82f6"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: '#3b82f6' }}
                        activeDot={{ r: 5 }}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  {/* 判定基準補足 */}
                  <div className="flex gap-3 mt-2 justify-end flex-wrap">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <span className="inline-block w-3 h-0.5 bg-red-400 rounded" /> 6時間未満: 要注意
                    </span>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <span className="inline-block w-3 h-0.5 bg-blue-400 rounded" /> 推奨: 7〜9時間
                    </span>
                  </div>
                </div>

                {/* 集計期間の補足 */}
                <div className="bg-white rounded-2xl p-4 shadow-sm">
                  <h3 className="text-sm font-bold text-gray-700 mb-1">📌 集計対象期間</h3>
                  <p className="text-xs text-gray-500">
                    {format(subDays(new Date(), 20), 'yyyy年M月d日')} 〜 {format(new Date(), 'yyyy年M月d日')}（直近21日間）
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    ※ データ未入力の日はグラフに点が表示されません。選手が入力した日のみ平均値を算出します。
                  </p>
                </div>
              </>
            )}

          </div>
        )}

        {/* ====== カルテタブ ====== */}
        {activeTab === 'karte' && (
          <KarteTab
            players={players}
            allPhysicalRecords={allPhysicalRecords}
            allMaxRecords={allMaxRecords}
            loading={karteLoading}
            selectedPlayerId={selectedKartePlayerId}
            onSelectPlayer={setSelectedKartePlayerId}
            karteTab={karteTab}
            onKarteTabChange={setKarteTab}
          />
        )}

      </main>
      <BottomNav role="staff" />
    </div>
  )
}

// ============================================================
// カルテタブ コンポーネント
// ============================================================

/** 測定日ラベルを短く整形する（例: 2026-04-01 → 26/4） */
function formatMeasuredDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${String(d.getFullYear()).slice(2)}/${d.getMonth() + 1}`
}

/** 数値配列の平均を計算する（null/undefined を除外） */
function avg(values: (number | null | undefined)[]): number | null {
  const valid = values.filter((v): v is number => v !== null && v !== undefined)
  if (valid.length === 0) return null
  return Math.round((valid.reduce((s, v) => s + v, 0) / valid.length) * 10) / 10
}

interface KarteTabProps {
  players: User[]
  allPhysicalRecords: PhysicalRecord[]
  allMaxRecords: MaxTrainingRecord[]
  loading: boolean
  selectedPlayerId: string | null
  onSelectPlayer: (id: string | null) => void
  karteTab: 'physical' | 'max'
  onKarteTabChange: (tab: 'physical' | 'max') => void
}

function KarteTab({
  players,
  allPhysicalRecords,
  allMaxRecords,
  loading,
  selectedPlayerId,
  onSelectPlayer,
  karteTab,
  onKarteTabChange,
}: KarteTabProps) {
  // 表示対象の選手データ
  const selectedPlayer = players.find(p => p.id === selectedPlayerId)

  // 選択選手の個人データ
  const personalPhysical = allPhysicalRecords
    .filter(r => r.user_id === selectedPlayerId)
    .sort((a, b) => a.measured_date.localeCompare(b.measured_date))
  const personalMax = allMaxRecords
    .filter(r => r.user_id === selectedPlayerId)
    .sort((a, b) => a.measured_date.localeCompare(b.measured_date))

  // 測定日の全ユニークリストを取得する（チーム平均の基準日）
  const allPhysicalDates = Array.from(new Set(allPhysicalRecords.map(r => r.measured_date))).sort()
  const allMaxDates = Array.from(new Set(allMaxRecords.map(r => r.measured_date))).sort()

  // チーム平均を日付ごとに計算（身体測定）
  const teamPhysicalAvg = allPhysicalDates.map(date => {
    const dayRecords = allPhysicalRecords.filter(r => r.measured_date === date)
    return {
      date: formatMeasuredDate(date),
      rawDate: date,
      'チーム平均_体重': avg(dayRecords.map(r => r.weight_kg)),
      'チーム平均_体脂肪率': avg(dayRecords.map(r => r.body_fat_pct)),
      'チーム平均_筋肉量': avg(dayRecords.map(r => r.muscle_mass_kg)),
    }
  })

  // チーム平均を日付ごとに計算（MAX測定）
  const teamMaxAvg = allMaxDates.map(date => {
    const dayRecords = allMaxRecords.filter(r => r.measured_date === date)
    return {
      date: formatMeasuredDate(date),
      rawDate: date,
      'チーム平均_ベンチプレス': avg(dayRecords.map(r => r.bench_press_kg)),
      'チーム平均_スクワット': avg(dayRecords.map(r => r.squat_kg)),
      'チーム平均_デッドリフト': avg(dayRecords.map(r => r.deadlift_kg)),
    }
  })

  // 個人 + チーム平均のグラフデータをマージする（身体測定）
  const physicalChartData = allPhysicalDates.map(date => {
    const personalRec = personalPhysical.find(r => r.measured_date === date)
    const teamRec = teamPhysicalAvg.find(r => r.rawDate === date)
    return {
      date: formatMeasuredDate(date),
      '個人_体重': personalRec?.weight_kg ?? null,
      '個人_体脂肪率': personalRec?.body_fat_pct ?? null,
      '個人_筋肉量': personalRec?.muscle_mass_kg ?? null,
      'チーム平均_体重': teamRec?.['チーム平均_体重'] ?? null,
      'チーム平均_体脂肪率': teamRec?.['チーム平均_体脂肪率'] ?? null,
      'チーム平均_筋肉量': teamRec?.['チーム平均_筋肉量'] ?? null,
    }
  })

  // 個人 + チーム平均のグラフデータをマージする（MAX測定）
  const maxChartData = allMaxDates.map(date => {
    const personalRec = personalMax.find(r => r.measured_date === date)
    const teamRec = teamMaxAvg.find(r => r.rawDate === date)
    return {
      date: formatMeasuredDate(date),
      '個人_ベンチプレス': personalRec?.bench_press_kg ?? null,
      '個人_スクワット': personalRec?.squat_kg ?? null,
      '個人_デッドリフト': personalRec?.deadlift_kg ?? null,
      'チーム平均_ベンチプレス': teamRec?.['チーム平均_ベンチプレス'] ?? null,
      'チーム平均_スクワット': teamRec?.['チーム平均_スクワット'] ?? null,
      'チーム平均_デッドリフト': teamRec?.['チーム平均_デッドリフト'] ?? null,
    }
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-brand-main font-bold">データ読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* ---- 選手選択パネル ---- */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h3 className="text-sm font-bold text-gray-700 mb-3">📋 選手を選択してカルテを閲覧</h3>
        {players.length === 0 ? (
          <p className="text-xs text-gray-400">選手が登録されていません</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {players.map(player => {
              const isSelected = selectedPlayerId === player.id
              return (
                <button
                  key={player.id}
                  onClick={() => onSelectPlayer(isSelected ? null : player.id)}
                  className={`px-3 py-1.5 rounded-xl border text-sm font-medium transition-all ${
                    isSelected
                      ? 'bg-brand-main border-yellow-400 text-brand-dark shadow-md'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
                  }`}
                >
                  {player.name}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ---- 選手未選択時 ---- */}
      {!selectedPlayerId && (
        <div className="bg-white rounded-2xl p-10 shadow-sm text-center text-gray-400">
          <p className="text-3xl mb-2">👆</p>
          <p className="text-sm">上のリストから選手を選んでカルテを表示します</p>
        </div>
      )}

      {/* ---- 選手選択済み ---- */}
      {selectedPlayer && (
        <>
          {/* 選手名ヘッダー */}
          <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-main flex items-center justify-center text-brand-dark font-bold text-lg">
              {selectedPlayer.name.charAt(0)}
            </div>
            <div>
              <p className="font-bold text-gray-800">{selectedPlayer.name}</p>
              <p className="text-xs text-gray-400">{selectedPlayer.position || 'ポジション未設定'}</p>
            </div>
          </div>

          {/* INBODY / MAX タブ切り替え */}
          <div className="flex gap-2">
            <button
              onClick={() => onKarteTabChange('physical')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                karteTab === 'physical'
                  ? 'bg-brand-main text-brand-dark shadow-md'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              INBODY測定
            </button>
            <button
              onClick={() => onKarteTabChange('max')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                karteTab === 'max'
                  ? 'bg-brand-main text-brand-dark shadow-md'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              MAX測定
            </button>
          </div>

          {/* ---- INBODY測定 ---- */}
          {karteTab === 'physical' && (
            <div className="space-y-4">
              {/* 一覧表 */}
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <h3 className="text-sm font-bold text-gray-700 mb-3">📏 INBODY測定 一覧</h3>
                {personalPhysical.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">まだ記録がありません</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-center">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="py-2 px-2 text-gray-500 text-left">測定日</th>
                          <th className="py-2 px-2 text-gray-500">身長(cm)</th>
                          <th className="py-2 px-2 text-gray-500">体重(kg)</th>
                          <th className="py-2 px-2 text-gray-500">体脂肪(%)</th>
                          <th className="py-2 px-2 text-gray-500">筋肉量(kg)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...personalPhysical].reverse().map(r => (
                          <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-2 px-2 text-left font-medium text-gray-700">
                              {r.measured_date}
                            </td>
                            <td className="py-2 px-2 text-gray-800">{r.height_cm ?? '-'}</td>
                            <td className="py-2 px-2 text-gray-800">{r.weight_kg ?? '-'}</td>
                            <td className="py-2 px-2 text-gray-800">{r.body_fat_pct ?? '-'}</td>
                            <td className="py-2 px-2 text-gray-800">{r.muscle_mass_kg ?? '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* グラフ（2件以上あるとき表示） */}
              {physicalChartData.length >= 2 && (
                <>
                  {/* 体重グラフ */}
                  <div className="bg-white rounded-2xl p-4 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-700 mb-1">⚖️ 体重の推移</h3>
                    <p className="text-xs text-gray-400 mb-3">実線: 個人 ／ 破線: チーム平均</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={physicalChartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} formatter={(v) => [`${v} kg`, '']} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Line type="monotone" dataKey="個人_体重" name="個人" stroke="#e1c614" strokeWidth={2.5} dot={{ r: 4 }} connectNulls={false} />
                        <Line type="monotone" dataKey="チーム平均_体重" name="チーム平均" stroke="#e1c614" strokeWidth={1.5} strokeDasharray="5 3" dot={{ r: 3 }} connectNulls={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* 体脂肪率グラフ */}
                  <div className="bg-white rounded-2xl p-4 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-700 mb-1">🔥 体脂肪率の推移</h3>
                    <p className="text-xs text-gray-400 mb-3">実線: 個人 ／ 破線: チーム平均</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={physicalChartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} formatter={(v) => [`${v} %`, '']} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Line type="monotone" dataKey="個人_体脂肪率" name="個人" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 4 }} connectNulls={false} />
                        <Line type="monotone" dataKey="チーム平均_体脂肪率" name="チーム平均" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="5 3" dot={{ r: 3 }} connectNulls={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* 筋肉量グラフ */}
                  <div className="bg-white rounded-2xl p-4 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-700 mb-1">💪 筋肉量の推移</h3>
                    <p className="text-xs text-gray-400 mb-3">実線: 個人 ／ 破線: チーム平均</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={physicalChartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} formatter={(v) => [`${v} kg`, '']} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Line type="monotone" dataKey="個人_筋肉量" name="個人" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 4 }} connectNulls={false} />
                        <Line type="monotone" dataKey="チーム平均_筋肉量" name="チーム平均" stroke="#22c55e" strokeWidth={1.5} strokeDasharray="5 3" dot={{ r: 3 }} connectNulls={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}

              {physicalChartData.length === 1 && (
                <div className="bg-white rounded-2xl p-5 shadow-sm text-center">
                  <p className="text-sm text-gray-400">グラフを表示するには2回以上の記録が必要です</p>
                </div>
              )}
            </div>
          )}

          {/* ---- MAX測定 ---- */}
          {karteTab === 'max' && (
            <div className="space-y-4">
              {/* 一覧表 */}
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <h3 className="text-sm font-bold text-gray-700 mb-3">🏋️ MAX測定 一覧</h3>
                {personalMax.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">まだ記録がありません</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-center">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="py-2 px-2 text-gray-500 text-left">測定日</th>
                          <th className="py-2 px-2 text-gray-500">ベンチ(kg)</th>
                          <th className="py-2 px-2 text-gray-500">スクワット(kg)</th>
                          <th className="py-2 px-2 text-gray-500">デッド(kg)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...personalMax].reverse().map(r => (
                          <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-2 px-2 text-left font-medium text-gray-700">
                              {r.measured_date}
                            </td>
                            <td className="py-2 px-2 text-gray-800">{r.bench_press_kg ?? '-'}</td>
                            <td className="py-2 px-2 text-gray-800">{r.squat_kg ?? '-'}</td>
                            <td className="py-2 px-2 text-gray-800">{r.deadlift_kg ?? '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* グラフ（2件以上あるとき表示） */}
              {maxChartData.length >= 2 && (
                <>
                  {/* ベンチプレスグラフ */}
                  <div className="bg-white rounded-2xl p-4 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-700 mb-1">🔵 ベンチプレスの推移</h3>
                    <p className="text-xs text-gray-400 mb-3">実線: 個人 ／ 破線: チーム平均</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={maxChartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} formatter={(v) => [`${v} kg`, '']} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Line type="monotone" dataKey="個人_ベンチプレス" name="個人" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4 }} connectNulls={false} />
                        <Line type="monotone" dataKey="チーム平均_ベンチプレス" name="チーム平均" stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="5 3" dot={{ r: 3 }} connectNulls={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* スクワットグラフ */}
                  <div className="bg-white rounded-2xl p-4 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-700 mb-1">🟡 スクワットの推移</h3>
                    <p className="text-xs text-gray-400 mb-3">実線: 個人 ／ 破線: チーム平均</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={maxChartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} formatter={(v) => [`${v} kg`, '']} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Line type="monotone" dataKey="個人_スクワット" name="個人" stroke="#e1c614" strokeWidth={2.5} dot={{ r: 4 }} connectNulls={false} />
                        <Line type="monotone" dataKey="チーム平均_スクワット" name="チーム平均" stroke="#e1c614" strokeWidth={1.5} strokeDasharray="5 3" dot={{ r: 3 }} connectNulls={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* デッドリフトグラフ */}
                  <div className="bg-white rounded-2xl p-4 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-700 mb-1">🔴 デッドリフトの推移</h3>
                    <p className="text-xs text-gray-400 mb-3">実線: 個人 ／ 破線: チーム平均</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={maxChartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} formatter={(v) => [`${v} kg`, '']} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Line type="monotone" dataKey="個人_デッドリフト" name="個人" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 4 }} connectNulls={false} />
                        <Line type="monotone" dataKey="チーム平均_デッドリフト" name="チーム平均" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="5 3" dot={{ r: 3 }} connectNulls={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}

              {maxChartData.length === 1 && (
                <div className="bg-white rounded-2xl p-5 shadow-sm text-center">
                  <p className="text-sm text-gray-400">グラフを表示するには2回以上の記録が必要です</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
