'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { User, GameStat } from '@/types/database'
import { getGameStats, deleteGameStat, calcPer40, calcPct } from '@/lib/data'
import { getSession } from '@/lib/session'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'
import StatsImport from '@/components/StatsImport'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'

// ============================================================
// ユーティリティ
// ============================================================

/** KPI達成状況を判定する */
function kpiStatus(pct: number | null, target: number): 'good' | 'warning' | 'none' {
  if (pct === null) return 'none'
  return pct >= target ? 'good' : 'warning'
}

/** 日付をM月d日形式に変換する */
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

export default function CoachStatsPage() {
  const router = useRouter()
  const [user, setUser] = useState<Pick<User, 'id' | 'name' | 'role'> | null>(null)
  const [stats, setStats] = useState<GameStat[]>([])
  const [loading, setLoading] = useState(true)

  // フィルタ
  const [filterPlayerName, setFilterPlayerName] = useState<string>('')
  const [filterGameType, setFilterGameType] = useState<string>('')
  // 自チーム / 相手チームフィルタ ('all' | 'my' | 'opponent')
  const [filterTeamSide, setFilterTeamSide] = useState<'all' | 'my' | 'opponent'>('all')

  // タブ切り替え
  const [activeTab, setActiveTab] = useState<'list' | 'graph' | 'import'>('list')

  // 一覧の表示モード
  const [viewMode, setViewMode] = useState<'standard' | 'per40'>('standard')

  // 削除確認
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    const session = getSession()
    if (!session) { router.push('/login'); return }
    if (session.role !== 'staff') { router.push('/player/dashboard'); return }
    setUser(session)
    loadStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const loadStats = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getGameStats()
      setStats(data)
    } catch (e) {
      console.error('[CoachStats] スタッツ取得エラー:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * player_name が「チーム名 / 選手名」形式かどうかで相手チーム選手を判定する。
   * スラッシュ（ / ）を含む場合は対戦相手の選手。
   */
  const isOpponent = (playerName: string) => playerName.includes(' / ')

  // フィルタ後のスタッツ
  const filteredStats = stats.filter(s => {
    if (filterPlayerName && s.player_name !== filterPlayerName) return false
    if (filterGameType && s.game_type !== filterGameType) return false
    if (filterTeamSide === 'my' && isOpponent(s.player_name)) return false
    if (filterTeamSide === 'opponent' && !isOpponent(s.player_name)) return false
    return true
  })

  // 選手名・試合種別のユニークリスト
  const playerNames = Array.from(new Set(stats.map(s => s.player_name))).sort()
  const gameTypes = Array.from(new Set(stats.map(s => s.game_type))).sort()

  // グラフ用データ（フィルタ後の選手のスタッツ推移）
  const graphStats = filteredStats
    .slice()
    .reverse() // 古い順に並べる
  const graphData = graphStats.map(s => {
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
      '出場時間': s.minutes_played,
    }
  })

  /** スタッツを削除する */
  const handleDelete = async (statId: string) => {
    if (!window.confirm('このスタッツデータを削除しますか？')) return
    setDeletingId(statId)
    try {
      await deleteGameStat(statId)
      setStats(prev => prev.filter(s => s.id !== statId))
    } catch (e) {
      console.error('[CoachStats] 削除エラー:', e)
      alert('削除に失敗しました。再度お試しください。')
    } finally {
      setDeletingId(null)
    }
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
      <Header userName={user.name} role="staff" />
      <main className="max-w-6xl mx-auto px-4 py-4">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-brand-dark">🏀 スタッツ管理</h2>
          <p className="text-xs text-gray-500">
            試合スタッツの閲覧・管理・CSVインポートができます
          </p>
        </div>

        {/* ====== タブ ====== */}
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {([
            { key: 'list',   label: '一覧',         icon: '📋' },
            { key: 'graph',  label: 'グラフ推移',   icon: '📈' },
            { key: 'import', label: 'CSVインポート', icon: '⬆️' },
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

        {/* ====== フィルタパネル（一覧・グラフ共通） ====== */}
        {(activeTab === 'list' || activeTab === 'graph') && (
          <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3">🔍 絞り込み</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* 選手名フィルタ */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">選手名</label>
                <select
                  value={filterPlayerName}
                  onChange={e => setFilterPlayerName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-brand-main focus:outline-none text-sm"
                >
                  <option value="">全員</option>
                  {playerNames.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              {/* 試合種別フィルタ */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">試合種別</label>
                <select
                  value={filterGameType}
                  onChange={e => setFilterGameType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-brand-main focus:outline-none text-sm"
                >
                  <option value="">全種別</option>
                  {gameTypes.map(gt => (
                    <option key={gt} value={gt}>{gt}</option>
                  ))}
                </select>
              </div>
            </div>
            {/* 自チーム / 相手フィルタ */}
            <div className="mt-3">
              <label className="block text-xs text-gray-500 mb-1">表示対象</label>
              <div className="flex gap-2 flex-wrap">
                {([
                  { value: 'all',      label: '全員' },
                  { value: 'my',       label: '🏠 自チームのみ' },
                  { value: 'opponent', label: '⚔️ 対戦相手のみ' },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setFilterTeamSide(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      filterTeamSide === opt.value
                        ? 'bg-brand-main text-brand-dark border-brand-main'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {(filterPlayerName || filterGameType || filterTeamSide !== 'all') && (
              <button
                onClick={() => { setFilterPlayerName(''); setFilterGameType(''); setFilterTeamSide('all') }}
                className="mt-2 text-xs text-gray-400 hover:text-gray-600 underline"
              >
                フィルタをクリア
              </button>
            )}
          </div>
        )}

        {/* ====== 一覧タブ ====== */}
        {activeTab === 'list' && (
          <div className="space-y-4">

            {/* 表示モード切り替え */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">表示モード:</span>
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

            {filteredStats.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 shadow-sm text-center text-gray-400">
                <p className="text-3xl mb-2">📊</p>
                <p className="text-sm">
                  {stats.length === 0
                    ? 'スタッツデータがありません。CSVインポートタブからデータを取り込んでください'
                    : 'この条件に一致するデータがありません'}
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
                    <div className="px-4 pt-4 pb-2 flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-gray-800">{stat.player_name}</p>
                          {isOpponent(stat.player_name) ? (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">⚔️ 対戦相手</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full">🏠 自チーム</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          {stat.game_date} vs {stat.opponent}
                          <span className="ml-2 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{stat.game_type}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">出場: {stat.minutes_played}分</span>
                        <button
                          onClick={() => handleDelete(stat.id)}
                          disabled={deletingId === stat.id}
                          className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
                        >
                          {deletingId === stat.id ? '削除中...' : '削除'}
                        </button>
                      </div>
                    </div>

                    {/* スタッツグリッド */}
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

                          {/* シュート成功率（KPIカラーコーディング） */}
                          <div className="grid grid-cols-3 gap-2">
                            {/* 3P */}
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

                            {/* 2P */}
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

                            {/* FT */}
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
                <p className="text-sm">
                  {stats.length === 0
                    ? 'まだデータがありません'
                    : 'グラフ表示には選手を1名に絞り込み、2試合以上のデータが必要です'}
                </p>
              </div>
            ) : (
              <>
                {/* 得点推移 */}
                <div className="bg-white rounded-2xl p-4 shadow-sm">
                  <h3 className="text-sm font-bold text-gray-700 mb-1">🏀 得点・リバウンド・アシストの推移</h3>
                  <p className="text-xs text-gray-400 mb-3">折れ線グラフ（試合順）</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={graphData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                        formatter={(value, name) => [`${value}`, name as string]}
                        labelFormatter={(label) => `${label}`}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Line type="monotone" dataKey="得点" stroke="#e1c614" strokeWidth={2.5} dot={{ r: 4 }} connectNulls={false} />
                      <Line type="monotone" dataKey="リバウンド" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                      <Line type="monotone" dataKey="アシスト" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* シュート成功率推移（KPI基準線付き） */}
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
                        formatter={(value, name) => [value !== null ? `${value}%` : '-', name as string]}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      {/* KPI基準線 */}
                      <ReferenceLine y={33} stroke="#ef4444" strokeDasharray="6 3" strokeOpacity={0.6} />
                      <ReferenceLine y={50} stroke="#3b82f6" strokeDasharray="6 3" strokeOpacity={0.6} />
                      <ReferenceLine y={75} stroke="#22c55e" strokeDasharray="6 3" strokeOpacity={0.6} />
                      <Line type="monotone" dataKey="3P%" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 4 }} connectNulls={false} />
                      <Line type="monotone" dataKey="2P%" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4 }} connectNulls={false} />
                      <Line type="monotone" dataKey="FT%" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 4 }} connectNulls={false} />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-4 h-px bg-red-400 border-dashed border-t-2 border-red-400" /> 3P目標33%
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-4 h-px bg-blue-400 border-dashed border-t-2 border-blue-400" /> 2P目標50%
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-4 h-px bg-green-400 border-dashed border-t-2 border-green-400" /> FT目標75%
                    </span>
                  </div>
                </div>

                {/* PER40推移（選手1名を選択した場合のみ表示） */}
                {filterPlayerName && (
                  <div className="bg-white rounded-2xl p-4 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-700 mb-1">📊 得点（PER40換算）の推移</h3>
                    <p className="text-xs text-gray-400 mb-3">
                      40分出場した場合の換算値。出場時間の長短に関わらず公平に比較できます
                    </p>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={graphData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                          formatter={(v) => [`${v}`, '得点(PER40)']}
                        />
                        <Line type="monotone" dataKey="得点(P40)" stroke="#f97316" strokeWidth={2.5} dot={{ r: 4 }} connectNulls={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ====== CSVインポートタブ ====== */}
        {activeTab === 'import' && user && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-700 mb-4">⬆️ CSVインポート（コーチ専用）</h3>
            <StatsImport
              coachId={user.id}
              onImported={() => {
                loadStats()
                setActiveTab('list')
              }}
            />
          </div>
        )}

      </main>
      <BottomNav role="staff" />
    </div>
  )
}
