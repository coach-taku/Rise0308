'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { User, GameStat } from '@/types/database'
import { getGameStats, calcPer40, calcPct } from '@/lib/data'
import { getSession } from '@/lib/session'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'

// ============================================================
// ユーティリティ
// ============================================================

function kpiStatus(pct: number | null, target: number): 'good' | 'warning' | 'none' {
  if (pct === null) return 'none'
  return pct >= target ? 'good' : 'warning'
}

function formatGameDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'M/d', { locale: ja })
  } catch {
    return dateStr
  }
}

// ============================================================
// メインコンポーネント
// ============================================================

export default function PlayerStatsPage() {
  const router = useRouter()
  const [user, setUser] = useState<Pick<User, 'id' | 'name' | 'role'> | null>(null)

  // 全スタッツ（閲覧のみ）
  const [allStats, setAllStats] = useState<GameStat[]>([])
  const [loading, setLoading] = useState(true)

  // 自分の名前でフィルタされたスタッツ
  const [myStats, setMyStats] = useState<GameStat[]>([])
  const [userName, setUserName] = useState<string>('')

  // 選択中の選手名（自分または閲覧したい選手）
  const [selectedName, setSelectedName] = useState<string>('')

  // タブ
  const [activeTab, setActiveTab] = useState<'list' | 'graph'>('list')
  // 表示モード
  const [viewMode, setViewMode] = useState<'standard' | 'per40'>('standard')
  // 試合種別フィルタ
  const [filterGameType, setFilterGameType] = useState<string>('')

  useEffect(() => {
    const session = getSession()
    if (!session) { router.push('/login'); return }
    if (session.role !== 'player') { router.push('/coach/dashboard'); return }
    setUser(session)
    setUserName(session.name)
    setSelectedName(session.name)
    loadStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const loadStats = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getGameStats()
      setAllStats(data)
    } catch (e) {
      console.error('[PlayerStats] スタッツ取得エラー:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * player_name に「 / 」が含まれる場合は対戦相手の選手と判定する。
   * 選手ページでは対戦相手データは除外し、自分のデータのみ表示する。
   */
  const isOpponent = (playerName: string) => playerName.includes(' / ')

  // selectedName が変わったとき（または allStats が変わったとき）に自分のスタッツを更新する
  useEffect(() => {
    if (!selectedName) {
      setMyStats([])
      return
    }
    // 対戦相手のデータ（「 / 」を含むエントリ）は除外し自分のデータのみ取得
    const filtered = allStats.filter(s =>
      !isOpponent(s.player_name) && s.player_name === selectedName
    )
    setMyStats(filtered)
  }, [selectedName, allStats])

  // 試合種別のユニークリスト
  const gameTypes = Array.from(new Set(allStats.map(s => s.game_type))).sort()
  // 選手名のユニークリスト（対戦相手は除外し自チーム選手者のみ表示）
  const playerNames = Array.from(
    new Set(allStats.filter(s => !isOpponent(s.player_name)).map(s => s.player_name))
  ).sort()

  // フィルタ後のスタッツ
  const filteredStats = myStats.filter(s =>
    !filterGameType || s.game_type === filterGameType
  )

  // グラフ用データ
  const graphData = filteredStats
    .slice()
    .reverse()
    .map(s => {
      const fg3Pct = calcPct(s.fg3_made, s.fg3_attempted)
      const fg2Pct = calcPct(s.fg2_made, s.fg2_attempted)
      const ftPct = calcPct(s.ft_made, s.ft_attempted)
      const p40 = calcPer40(s)
      return {
        date: formatGameDate(s.game_date),
        opponent: s.opponent,
        得点: s.points,
        リバウンド: s.rebounds,
        アシスト: s.assists,
        '3P%': fg3Pct,
        '2P%': fg2Pct,
        'FT%': ftPct,
        '得点(P40)': p40.points_per40,
      }
    })

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
        <div className="mb-4">
          <h2 className="text-xl font-bold text-brand-dark">🏀 スタッツ</h2>
          <p className="text-xs text-gray-500">
            試合ごとのパフォーマンスデータを確認できます
          </p>
        </div>

        {/* ====== 選手選択 ====== */}
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3">👤 表示する選手</h3>
          <div className="flex flex-wrap gap-2">
            {playerNames.length === 0 ? (
              <p className="text-xs text-gray-400">スタッツデータがまだありません</p>
            ) : (
              playerNames.map(name => (
                <button
                  key={name}
                  onClick={() => setSelectedName(name)}
                  className={`px-3 py-1.5 rounded-xl border text-sm font-medium transition-all ${
                    selectedName === name
                      ? 'bg-brand-main border-yellow-400 text-brand-dark shadow-md'
                      : name === userName
                      ? 'bg-gray-100 border-gray-300 text-gray-700'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'
                  }`}
                >
                  {name}
                  {name === userName && <span className="ml-1 text-xs text-gray-400">（自分）</span>}
                </button>
              ))
            )}
          </div>
        </div>

        {/* 試合種別フィルタ */}
        {myStats.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
            <h3 className="text-sm font-bold text-gray-700 mb-2">🔍 試合種別で絞り込み</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilterGameType('')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  !filterGameType ? 'bg-brand-main text-brand-dark' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                すべて
              </button>
              {gameTypes.map(gt => (
                <button
                  key={gt}
                  onClick={() => setFilterGameType(gt)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    filterGameType === gt ? 'bg-brand-main text-brand-dark' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {gt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ====== タブ ====== */}
        <div className="flex gap-2 mb-4">
          {([
            { key: 'list',  label: '一覧',       icon: '📋' },
            { key: 'graph', label: 'グラフ推移', icon: '📈' },
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

        {/* ====== 一覧タブ ====== */}
        {activeTab === 'list' && (
          <div className="space-y-4">

            {/* 表示モード切り替え */}
            {filteredStats.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">表示:</span>
                <button
                  onClick={() => setViewMode('standard')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    viewMode === 'standard' ? 'bg-brand-main text-brand-dark' : 'bg-white text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  通常
                </button>
                <button
                  onClick={() => setViewMode('per40')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    viewMode === 'per40' ? 'bg-brand-main text-brand-dark' : 'bg-white text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  PER40換算
                </button>
              </div>
            )}

            {filteredStats.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 shadow-sm text-center text-gray-400">
                <p className="text-3xl mb-2">🏀</p>
                <p className="text-sm">
                  {allStats.length === 0
                    ? 'スタッツデータがまだありません。\nコーチがCSVからデータを取り込むと表示されます'
                    : `${selectedName || '選択した選手'}のデータがありません`}
                </p>
              </div>
            ) : (
              filteredStats.map(stat => {
                const fg3Pct = calcPct(stat.fg3_made, stat.fg3_attempted)
                const fg2Pct = calcPct(stat.fg2_made, stat.fg2_attempted)
                const ftPct = calcPct(stat.ft_made, stat.ft_attempted)
                const p40 = calcPer40(stat)

                return (
                  <div key={stat.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    {/* カードヘッダー */}
                    <div className="px-4 pt-4 pb-2">
                      <p className="font-bold text-gray-800">{stat.game_date} vs {stat.opponent}</p>
                      <p className="text-xs text-gray-500">
                        <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full mr-2">{stat.game_type}</span>
                        出場: {stat.minutes_played}分
                      </p>
                    </div>

                    <div className="px-4 pb-4">
                      {viewMode === 'standard' ? (
                        <>
                          {/* 基本スタッツ */}
                          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mb-3">
                            {[
                              { label: '得点', value: stat.points, highlight: true },
                              { label: 'REB', value: stat.rebounds, highlight: false },
                              { label: 'AST', value: stat.assists, highlight: false },
                              { label: 'STL', value: stat.steals, highlight: false },
                              { label: 'BLK', value: stat.blocks, highlight: false },
                              { label: 'TO', value: stat.turnovers, highlight: false },
                              { label: 'FOUL', value: stat.fouls, highlight: false },
                            ].map(item => (
                              <div key={item.label} className="bg-gray-50 rounded-lg p-2 text-center">
                                <p className={`text-lg font-bold ${item.highlight ? 'text-brand-dark' : 'text-gray-700'}`}>
                                  {item.value}
                                </p>
                                <p className="text-xs text-gray-400">{item.label}</p>
                              </div>
                            ))}
                          </div>

                          {/* シュート成功率（KPIカラー） */}
                          <div className="grid grid-cols-3 gap-2">
                            <div className={`rounded-xl p-2.5 text-center ${
                              kpiStatus(fg3Pct, 33) === 'good' ? 'bg-green-50 border border-green-200'
                              : kpiStatus(fg3Pct, 33) === 'warning' ? 'bg-red-50 border border-red-200'
                              : 'bg-gray-50 border border-gray-100'
                            }`}>
                              <p className={`text-base font-bold ${
                                kpiStatus(fg3Pct, 33) === 'good' ? 'text-green-600'
                                : kpiStatus(fg3Pct, 33) === 'warning' ? 'text-red-500'
                                : 'text-gray-400'
                              }`}>
                                {fg3Pct !== null ? `${fg3Pct}%` : '-'}
                              </p>
                              <p className="text-xs text-gray-500">3P（目標33%）</p>
                              <p className="text-xs text-gray-400">{stat.fg3_made}/{stat.fg3_attempted}</p>
                            </div>
                            <div className={`rounded-xl p-2.5 text-center ${
                              kpiStatus(fg2Pct, 50) === 'good' ? 'bg-green-50 border border-green-200'
                              : kpiStatus(fg2Pct, 50) === 'warning' ? 'bg-red-50 border border-red-200'
                              : 'bg-gray-50 border border-gray-100'
                            }`}>
                              <p className={`text-base font-bold ${
                                kpiStatus(fg2Pct, 50) === 'good' ? 'text-green-600'
                                : kpiStatus(fg2Pct, 50) === 'warning' ? 'text-red-500'
                                : 'text-gray-400'
                              }`}>
                                {fg2Pct !== null ? `${fg2Pct}%` : '-'}
                              </p>
                              <p className="text-xs text-gray-500">2P（目標50%）</p>
                              <p className="text-xs text-gray-400">{stat.fg2_made}/{stat.fg2_attempted}</p>
                            </div>
                            <div className={`rounded-xl p-2.5 text-center ${
                              kpiStatus(ftPct, 75) === 'good' ? 'bg-green-50 border border-green-200'
                              : kpiStatus(ftPct, 75) === 'warning' ? 'bg-red-50 border border-red-200'
                              : 'bg-gray-50 border border-gray-100'
                            }`}>
                              <p className={`text-base font-bold ${
                                kpiStatus(ftPct, 75) === 'good' ? 'text-green-600'
                                : kpiStatus(ftPct, 75) === 'warning' ? 'text-red-500'
                                : 'text-gray-400'
                              }`}>
                                {ftPct !== null ? `${ftPct}%` : '-'}
                              </p>
                              <p className="text-xs text-gray-500">FT（目標75%）</p>
                              <p className="text-xs text-gray-400">{stat.ft_made}/{stat.ft_attempted}</p>
                            </div>
                          </div>
                        </>
                      ) : (
                        /* PER40換算モード */
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                          {[
                            { label: '得点(P40)', value: p40.points_per40 },
                            { label: 'REB(P40)', value: p40.rebounds_per40 },
                            { label: 'AST(P40)', value: p40.assists_per40 },
                            { label: 'STL(P40)', value: p40.steals_per40 },
                            { label: 'BLK(P40)', value: p40.blocks_per40 },
                            { label: 'TO(P40)', value: p40.turnovers_per40 },
                          ].map(item => (
                            <div key={item.label} className="bg-gray-50 rounded-lg p-2 text-center">
                              <p className="text-lg font-bold text-brand-dark">
                                {item.value !== null ? item.value : '-'}
                              </p>
                              <p className="text-xs text-gray-400">{item.label}</p>
                            </div>
                          ))}
                          <p className="col-span-full text-xs text-gray-400 mt-1">
                            ※ PER40 = 各スタッツ ÷ 出場時間（{stat.minutes_played}分）× 40分換算
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ====== グラフタブ ====== */}
        {activeTab === 'graph' && (
          <div className="space-y-4">
            {graphData.length < 2 ? (
              <div className="bg-white rounded-2xl p-10 shadow-sm text-center text-gray-400">
                <p className="text-3xl mb-2">📈</p>
                <p className="text-sm">グラフ表示には2試合以上のデータが必要です</p>
              </div>
            ) : (
              <>
                {/* 得点・リバウンド・アシスト */}
                <div className="bg-white rounded-2xl p-4 shadow-sm">
                  <h3 className="text-sm font-bold text-gray-700 mb-1">🏀 得点・リバウンド・アシストの推移</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={graphData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                        formatter={(v, name) => [`${v}`, name as string]}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Line type="monotone" dataKey="得点" stroke="#e1c614" strokeWidth={2.5} dot={{ r: 4 }} connectNulls={false} />
                      <Line type="monotone" dataKey="リバウンド" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                      <Line type="monotone" dataKey="アシスト" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* シュート成功率（KPI基準線付き） */}
                <div className="bg-white rounded-2xl p-4 shadow-sm">
                  <h3 className="text-sm font-bold text-gray-700 mb-1">🎯 シュート成功率の推移</h3>
                  <p className="text-xs text-gray-400 mb-3">
                    破線: KPI基準（3P: 33% / 2P: 50% / FT: 75%）
                  </p>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={graphData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
                      <Tooltip
                        contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                        formatter={(v, name) => [v !== null ? `${v}%` : '-', name as string]}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <ReferenceLine y={33} stroke="#ef4444" strokeDasharray="6 3" strokeOpacity={0.6} />
                      <ReferenceLine y={50} stroke="#3b82f6" strokeDasharray="6 3" strokeOpacity={0.6} />
                      <ReferenceLine y={75} stroke="#22c55e" strokeDasharray="6 3" strokeOpacity={0.6} />
                      <Line type="monotone" dataKey="3P%" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 4 }} connectNulls={false} />
                      <Line type="monotone" dataKey="2P%" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4 }} connectNulls={false} />
                      <Line type="monotone" dataKey="FT%" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 4 }} connectNulls={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>
        )}

      </main>
      <BottomNav role="player" />
    </div>
  )
}
