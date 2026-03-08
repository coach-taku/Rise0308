'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Profile, Tournament, DailyRecord, MandalaChart } from '@/types/database'
import { getActiveTournament, getDailyRecords, getMandalaChart, getProfile } from '@/lib/data'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts'
import { format, differenceInDays, subDays, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'

export default function PlayerDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<Profile | null>(null)
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [records, setRecords] = useState<DailyRecord[]>([])
  const [mandala, setMandala] = useState<MandalaChart | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const session = localStorage.getItem('rise_note_session')
    if (!session) {
      router.push('/login')
      return
    }
    const userData = JSON.parse(session) as Profile
    if (userData.role !== 'player') {
      router.push('/coach/dashboard')
      return
    }
    setUser(userData)

    const loadData = async () => {
      try {
        const [t, r, m, latestProfile] = await Promise.all([
          getActiveTournament(),
          getDailyRecords(userData.id, format(subDays(new Date(), 30), 'yyyy-MM-dd')),
          getMandalaChart(userData.id),
          getProfile(userData.id),
        ])
        setTournament(t)
        setRecords(r)
        setMandala(m)
        if (latestProfile) setUser(latestProfile)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [router])

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-brand-main text-xl font-bold">読み込み中...</div>
      </div>
    )
  }

  // Calculate stats
  const now = new Date()
  const weekRecords = records.filter(r => {
    const d = parseISO(r.target_date)
    return differenceInDays(now, d) <= 7
  })

  const weekAvgEval = weekRecords.length > 0
    ? (weekRecords.reduce((sum, r) => sum + r.self_evaluation, 0) / weekRecords.length).toFixed(1)
    : '-'

  const weekPoints = weekRecords.reduce((sum, r) => sum + r.earned_points, 0)
  const daysRemaining = tournament ? differenceInDays(parseISO(tournament.target_date), now) : null

  // Achievement rate calculation (based on self evaluation average)
  const allEvalAvg = records.length > 0
    ? Math.round((records.reduce((sum, r) => sum + r.self_evaluation, 0) / records.length) * 10)
    : 0

  // Participation stats
  const participationCounts = records.reduce((acc, r) => {
    acc[r.participation_status] = (acc[r.participation_status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Chart data
  const chartData = records.slice(-14).map(r => ({
    date: format(parseISO(r.target_date), 'M/d'),
    evaluation: r.self_evaluation,
    fatigue: r.fatigue_level,
    sleep: r.sleep_hours,
  }))

  return (
    <div className="min-h-screen bg-brand-bg pb-20 md:pb-8">
      <Header userName={user.name} role="player" />
      
      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Welcome message */}
        <div className="bg-gradient-to-r from-brand-dark to-gray-700 rounded-2xl p-5 text-white">
          <p className="text-sm text-gray-300">おかえりなさい</p>
          <h2 className="text-xl font-bold mt-1">{user.name}</h2>
          <p className="text-brand-main text-sm mt-2 font-semibold">
            累計ポイント: {user.total_points} pt
          </p>
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
            {/* Progress bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>達成度</span>
                <span>{allEvalAvg}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-brand-main h-3 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, allEvalAvg)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Weekly summary cards */}
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
            <p className="text-xs text-gray-500">記録日数</p>
            <p className="text-2xl font-bold text-brand-dark mt-1">{weekRecords.length}</p>
            <p className="text-xs text-gray-400">/7日</p>
          </div>
        </div>

        {/* Participation stats */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">参加状況（直近30日）</h3>
          <div className="flex flex-wrap gap-2">
            {['参加', 'リハビリ', '体調不良で欠席', '通院のため欠席', 'REST'].map(status => (
              <span key={status} className="inline-flex items-center gap-1 bg-gray-100 px-3 py-1.5 rounded-lg text-xs">
                <span className="font-medium text-gray-700">{status}</span>
                <span className="font-bold text-brand-dark">{participationCounts[status] || 0}日</span>
              </span>
            ))}
          </div>
        </div>

        {/* Growth chart */}
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
                <Tooltip
                  contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                  formatter={(value: number, name: string) => {
                    const labels: Record<string, string> = { evaluation: '自己評価', fatigue: '疲労度', sleep: '睡眠' }
                    return [value, labels[name] || name]
                  }}
                />
                <Area type="monotone" dataKey="evaluation" stroke="#e1c614" fill="url(#evalGradient)" strokeWidth={2} />
                <Line type="monotone" dataKey="fatigue" stroke="#ef4444" strokeWidth={1.5} dot={{ r: 2 }} strokeDasharray="4 4" />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-4 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-brand-main inline-block" /> 自己評価
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-red-500 inline-block" style={{ borderTop: '1px dashed' }} /> 疲労度
              </span>
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => router.push('/player/daily')}
            className="bg-brand-main text-brand-dark font-bold py-4 rounded-2xl shadow-md hover:bg-yellow-400 transition-all card-hover text-center"
          >
            <span className="text-2xl block">✏️</span>
            <span className="text-sm mt-1 block">今日の記録を書く</span>
          </button>
          <button
            onClick={() => router.push('/player/mandala')}
            className="bg-white text-brand-dark font-bold py-4 rounded-2xl shadow-sm hover:shadow-md transition-all card-hover text-center"
          >
            <span className="text-2xl block">🎯</span>
            <span className="text-sm mt-1 block">目標を確認する</span>
          </button>
        </div>
      </main>

      <BottomNav role="player" />
    </div>
  )
}
