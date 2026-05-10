'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { User, DailyRecordWithUser, Tournament } from '@/types/database'
import { getUsers, getAllDailyRecords, getActiveTournament, addComment } from '@/lib/data'
import { getSession } from '@/lib/session'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'
import { format, parseISO, subDays } from 'date-fns'
import { ja } from 'date-fns/locale'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

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
  const [activeTab, setActiveTab] = useState<'condition' | 'timeline' | 'growth'>('condition')

  useEffect(() => {
    const session = getSession()
    if (!session) { router.push('/login'); return }
    if (session.role !== 'staff') { router.push('/player/dashboard'); return }
    setUser(session)
    loadData()
  }, [router])

  const loadData = async () => {
    try {
      const startDate = format(subDays(new Date(), 14), 'yyyy-MM-dd')
      const [users, records, t] = await Promise.all([getUsers(), getAllDailyRecords(startDate), getActiveTournament()])
      setAllUsers(users)
      setRecentRecords(records)
      setTournament(t)
      const today = format(new Date(), 'yyyy-MM-dd')
      setTodayRecords(records.filter(r => r.record_date === today))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const handleDateChange = (date: string) => {
    setSelectedDate(date)
    setTodayRecords(recentRecords.filter(r => r.record_date === date))
  }

  const handleAddComment = async (recordId: string) => {
    if (!user || !commentInputs[recordId]?.trim()) return
    try {
      const newComment = await addComment(recordId, user.id, commentInputs[recordId].trim())
      setRecentRecords(prev => prev.map(r => r.id === recordId ? { ...r, comments: [...(r.comments || []), newComment] } : r))
      setCommentInputs(prev => ({ ...prev, [recordId]: '' }))
    } catch (e) { console.error(e) }
  }

  const players = allUsers.filter(u => u.role === 'player')
  const getUserName = (userId: string) => allUsers.find(u => u.id === userId)?.name || '不明'

  const fatigueData = players.map(player => {
    const latestRecord = recentRecords.find(r => r.user_id === player.id)
    return {
      name: player.name.split(' ')[1] || player.name,
      fatigue: latestRecord?.fatigue_level || 0,
      sleep: latestRecord?.sleep_hours || 0,
      hasPain: latestRecord?.has_pain || false,
    }
  })

  if (loading || !user) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-pulse text-brand-main text-xl font-bold">読み込み中...</div></div>
  }

  return (
    <div className="min-h-screen bg-brand-bg pb-20 md:pb-8">
      <Header userName={user.name} role="staff" />
      <main className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 gap-3">
          <div>
            <h2 className="text-xl font-bold text-brand-dark">チームダッシュボード</h2>
            <p className="text-xs text-gray-500">
              {tournament ? `${tournament.name}まで ${Math.max(0, Math.ceil((new Date(tournament.target_date).getTime() - Date.now()) / 86400000))}日` : '大会未設定'}
            </p>
          </div>
          <input type="date" value={selectedDate} onChange={(e) => handleDateChange(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-main focus:outline-none" />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {([
            { key: 'condition', label: 'コンディション', icon: '❤️' },
            { key: 'timeline', label: 'タイムライン', icon: '📝' },
            { key: 'growth', label: '成長・達成度', icon: '📈' },
          ] as const).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === tab.key ? 'bg-brand-main text-brand-dark shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}>
              <span>{tab.icon}</span><span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Condition Tab */}
        {activeTab === 'condition' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-bold text-gray-700 mb-3">疲労度一覧</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={fatigueData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} formatter={(value: number, name: string) => [value, name === 'fatigue' ? '疲労度' : '睡眠時間']} />
                  <Bar dataKey="fatigue" name="疲労度" radius={[4, 4, 0, 0]}>
                    {fatigueData.map((entry, index) => (
                      <Cell key={index} fill={entry.fatigue >= 8 ? '#ef4444' : entry.fatigue >= 6 ? '#f59e0b' : '#22c55e'} />
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
                  <div key={player.id} className={`bg-white rounded-xl p-4 shadow-sm border-l-4 ${
                    displayRecord && displayRecord.fatigue_level >= 8 ? 'border-red-500' : displayRecord && displayRecord.fatigue_level >= 6 ? 'border-orange-400' : 'border-green-400'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-gray-800">{player.name}</h4>
                      {!record && <span className="text-xs text-gray-400">最新データ</span>}
                    </div>
                    {displayRecord ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">疲労度</span>
                          <span className={`font-bold ${displayRecord.fatigue_level >= 8 ? 'text-red-500' : displayRecord.fatigue_level >= 6 ? 'text-orange-500' : 'text-green-500'}`}>{displayRecord.fatigue_level}/10</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">睡眠</span>
                          <span className={`font-medium ${displayRecord.sleep_hours < 6 ? 'text-red-500' : 'text-gray-700'}`}>{displayRecord.sleep_hours}時間</span>
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
                    ) : <p className="text-xs text-gray-400">データなし</p>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Timeline Tab */}
        {activeTab === 'timeline' && (
          <div className="space-y-3">
            {recentRecords.length === 0 ? (
              <div className="text-center py-12 text-gray-500"><p className="text-4xl mb-3">📝</p><p className="text-sm">まだ投稿がありません</p></div>
            ) : (
              recentRecords.slice(0, 20).map(record => {
                const profileName = record.users?.name || getUserName(record.user_id)
                const comments = record.comments || []
                const isExpanded = showComments[record.id]
                return (
                  <div key={record.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600">{profileName.charAt(0)}</div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{profileName}</p>
                            <p className="text-xs text-gray-400">{format(parseISO(record.record_date), 'M月d日(E)', { locale: ja })}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium">評価 {record.self_evaluation}/10</span>
                          {record.fatigue_level >= 7 && <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">疲労 {record.fatigue_level}</span>}
                        </div>
                      </div>
                      {record.target_items.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {record.target_items.map((goal, idx) => <span key={idx} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{goal}</span>)}
                        </div>
                      )}
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{record.reflection}</p>
                      <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                        <span>😴 {record.sleep_hours}h</span>
                        <span className={record.fatigue_level >= 7 ? 'text-red-500 font-medium' : ''}>疲労 {record.fatigue_level}/10</span>
                        {record.has_pain && <span className="text-red-500">⚠️ {record.pain_detail}</span>}
                      </div>
                    </div>
                    <div className="border-t border-gray-100">
                      <button onClick={() => setShowComments(prev => ({ ...prev, [record.id]: !prev[record.id] }))}
                        className="w-full px-4 py-2 text-xs text-gray-500 hover:bg-gray-50 flex items-center justify-between">
                        <span>💬 コメント ({comments.length})</span><span>{isExpanded ? '▲' : '▼'}</span>
                      </button>
                      {isExpanded && (
                        <div className="px-4 pb-3">
                          {comments.length > 0 && (
                            <div className="space-y-2 mb-3">
                              {comments.map(comment => (
                                <div key={comment.id} className="bg-blue-50 border border-blue-100 px-3 py-2 rounded-lg text-xs">
                                  <span className="font-semibold text-gray-700">{comment.users?.name || getUserName(comment.user_id)}</span>
                                  <p className="text-gray-600 mt-0.5">{comment.content}</p>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="flex gap-2">
                            <input type="text" value={commentInputs[record.id] || ''}
                              onChange={(e) => setCommentInputs(prev => ({ ...prev, [record.id]: e.target.value }))}
                              placeholder="選手にコメントを送る..."
                              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 focus:border-brand-main focus:outline-none text-xs"
                              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(record.id) } }} />
                            <button onClick={() => handleAddComment(record.id)}
                              className="bg-brand-main text-brand-dark font-medium px-4 py-2 rounded-lg text-xs hover:bg-yellow-400 transition-colors">送信</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* Growth Tab */}
        {activeTab === 'growth' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {players.map(player => {
              const playerRecords = recentRecords.filter(r => r.user_id === player.id)
              const avgEval = playerRecords.length > 0 ? (playerRecords.reduce((sum, r) => sum + r.self_evaluation, 0) / playerRecords.length).toFixed(1) : '-'
              const totalPoints = playerRecords.reduce((sum, r) => sum + r.points, 0)
              const recordCount = playerRecords.length
              const participationCounts = playerRecords.reduce((acc, r) => { acc[r.participation_status] = (acc[r.participation_status] || 0) + 1; return acc }, {} as Record<string, number>)
              return (
                <div key={player.id} className="bg-white rounded-xl p-4 shadow-sm">
                  <h4 className="font-semibold text-gray-800 mb-3">{player.name}</h4>
                  <div className="grid grid-cols-3 gap-2 text-center mb-3">
                    <div className="bg-gray-50 rounded-lg p-2"><p className="text-lg font-bold text-brand-dark">{avgEval}</p><p className="text-xs text-gray-500">平均評価</p></div>
                    <div className="bg-gray-50 rounded-lg p-2"><p className="text-lg font-bold text-brand-main">{totalPoints}</p><p className="text-xs text-gray-500">獲得pt</p></div>
                    <div className="bg-gray-50 rounded-lg p-2"><p className="text-lg font-bold text-brand-dark">{recordCount}</p><p className="text-xs text-gray-500">記録数</p></div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(participationCounts).map(([status, count]) => (
                      <span key={status} className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">{status}: {count}日</span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
      <BottomNav role="staff" />
    </div>
  )
}
