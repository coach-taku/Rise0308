'use client'

/**
 * StatsViewer.tsx
 * スタッツ閲覧コンポーネント（コーチ・選手共通）。
 *
 * 機能:
 *  - 試合一覧の表示（試合日・対戦相手・試合種別・試合時間）
 *  - 試合を選択すると選手スタッツ一覧を表示（実スタッツ + PER40換算の切り替え）
 *  - KPIライン（3P: 33%, 2P: 50%, FT: 75%）の視覚化
 *  - 折れ線グラフによる選手別スタッツ推移（複数試合選択時）
 *  - コーチのみ：試合の削除ボタンを表示
 *
 * 注意: "mode=player" の場合は特定 userId のスタッツのみ表示する。
 */

import { useState, useEffect, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import { GameStat, GameStatEntry, GameStatWithEntries, STATS_KPI } from '@/types/database'
import { getGameStats, getGameStatWithEntries, deleteGameStat, calcPer40 } from '@/lib/data'

interface Props {
  /** 'coach' ならインポートフォーム外の削除ボタンなどを表示 */
  mode: 'coach' | 'player'
  /** player モード時に表示する選手の user_id */
  userId?: string
}

// スタッツ成功率をパーセント文字列で返すヘルパー
function pct(made: number, attempted: number): string {
  if (attempted === 0) return '-'
  return `${Math.round(made / attempted * 1000) / 10}%`
}

// KPIラベル色
function kpiColor(value: number, target: number): string {
  return value >= target ? 'text-green-500' : 'text-red-400'
}

export default function StatsViewer({ mode, userId }: Props) {
  const [gameList, setGameList]           = useState<GameStat[]>([])
  const [selectedGame, setSelectedGame]   = useState<GameStatWithEntries | null>(null)
  const [viewMode, setViewMode]           = useState<'actual' | 'per40'>('actual')
  const [loading, setLoading]             = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // 折れ線グラフ用: 過去の試合スタッツ推移（最大5試合）
  const [trendGames, setTrendGames]       = useState<GameStatWithEntries[]>([])
  const [trendLoading, setTrendLoading]   = useState(false)
  const [showTrend, setShowTrend]         = useState(false)

  /** 試合一覧を取得する */
  const loadGameList = useCallback(async () => {
    setLoading(true)
    try {
      const list = await getGameStats()
      setGameList(list)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadGameList() }, [loadGameList])

  /** 試合を選択して詳細を取得する */
  const handleSelectGame = async (gameId: string) => {
    // 同じ試合をクリックしたら折り畳む
    if (selectedGame?.id === gameId) { setSelectedGame(null); return }
    setDetailLoading(true)
    try {
      const detail = await getGameStatWithEntries(gameId)
      setSelectedGame(detail)
    } finally {
      setDetailLoading(false)
    }
  }

  /** 折れ線グラフ用の推移データを取得する（最大5試合） */
  const handleShowTrend = async () => {
    if (showTrend) { setShowTrend(false); return }
    setTrendLoading(true)
    try {
      const recent = gameList.slice(0, 5).reverse() // 古い順に並べる
      const results = await Promise.all(recent.map(g => getGameStatWithEntries(g.id)))
      setTrendGames(results.filter(Boolean) as GameStatWithEntries[])
      setShowTrend(true)
    } finally {
      setTrendLoading(false)
    }
  }

  /** 試合を削除する（コーチのみ） */
  const handleDelete = async (gameId: string) => {
    try {
      await deleteGameStat(gameId)
      if (selectedGame?.id === gameId) setSelectedGame(null)
      setDeleteConfirm(null)
      await loadGameList()
    } catch (e) {
      console.error('[StatsViewer] 削除エラー:', e)
      alert('削除に失敗しました。再度お試しください。')
    }
  }

  // 特定選手のスタッツのみに絞り込む（player モード）
  const filterEntries = (entries: GameStatEntry[]): GameStatEntry[] => {
    if (mode === 'player' && userId) {
      return entries.filter(e => e.user_id === userId)
    }
    return entries
  }

  // 推移グラフ用データ生成（特定選手または全選手の合計）
  const buildTrendData = () => {
    if (mode === 'player' && userId) {
      // 選手個人の推移
      return trendGames.map(g => {
        const entry = g.entries.find(e => e.user_id === userId)
        if (!entry) return { date: g.game_date, opponent: g.opponent, points: null, three_pct: null, ft_pct: null }
        const per = calcPer40(entry)
        return {
          date: g.game_date.slice(5), // M-DD 形式
          opponent: g.opponent,
          points: viewMode === 'per40' ? per.points : entry.points,
          three_pct: per.three_pct,
          two_pct: entry.two_attempted > 0 ? Math.round(entry.two_made / entry.two_attempted * 1000) / 10 : null,
          ft_pct: per.ft_pct,
        }
      })
    }
    // コーチ：チーム合計得点の推移
    return trendGames.map(g => ({
      date: g.game_date.slice(5),
      opponent: g.opponent,
      points: g.entries.reduce((s, e) => s + e.points, 0),
      three_pct: (() => {
        const totalM = g.entries.reduce((s, e) => s + e.three_made, 0)
        const totalA = g.entries.reduce((s, e) => s + e.three_attempted, 0)
        return totalA > 0 ? Math.round(totalM / totalA * 1000) / 10 : null
      })(),
      ft_pct: (() => {
        const totalM = g.entries.reduce((s, e) => s + e.ft_made, 0)
        const totalA = g.entries.reduce((s, e) => s + e.ft_attempted, 0)
        return totalA > 0 ? Math.round(totalM / totalA * 1000) / 10 : null
      })(),
    }))
  }

  if (loading) {
    return <div className="text-center py-8 text-gray-400 text-sm">読み込み中...</div>
  }

  if (gameList.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        {mode === 'coach' ? 'まだ試合データがありません。CSVをインポートしてください。' : '試合データがまだありません。'}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 試合一覧 */}
      <div className="space-y-2">
        {gameList.map(game => (
          <div key={game.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {/* 試合ヘッダー行 */}
            <div
              className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => handleSelectGame(game.id)}
            >
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  game.game_type === '公式戦' ? 'bg-red-100 text-red-600' :
                  game.game_type === 'リーグ戦' ? 'bg-blue-100 text-blue-600' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {game.game_type}
                </span>
                <div>
                  <p className="text-sm font-bold text-gray-800">vs {game.opponent}</p>
                  <p className="text-xs text-gray-400">{game.game_date}　{game.game_minutes}分ゲーム</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {mode === 'coach' && (
                  <button
                    onClick={e => { e.stopPropagation(); setDeleteConfirm(game.id) }}
                    className="text-xs text-gray-300 hover:text-red-400 transition-colors p-1"
                    title="削除"
                  >
                    🗑
                  </button>
                )}
                <span className="text-gray-300 text-xs">{selectedGame?.id === game.id ? '▲' : '▼'}</span>
              </div>
            </div>

            {/* 削除確認 */}
            {deleteConfirm === game.id && (
              <div className="px-4 py-3 bg-red-50 border-t border-red-100 flex items-center gap-3">
                <p className="text-xs text-red-600 flex-1">この試合のスタッツを削除しますか？</p>
                <button onClick={() => handleDelete(game.id)} className="text-xs bg-red-500 text-white px-3 py-1 rounded-lg">削除</button>
                <button onClick={() => setDeleteConfirm(null)} className="text-xs text-gray-500 px-3 py-1 rounded-lg border border-gray-200">キャンセル</button>
              </div>
            )}

            {/* 試合詳細（展開時） */}
            {selectedGame?.id === game.id && (
              <div className="border-t border-gray-100 p-4 space-y-3">
                {detailLoading ? (
                  <p className="text-center text-xs text-gray-400">読み込み中...</p>
                ) : (
                  <>
                    {/* 表示切り替えボタン */}
                    <div className="flex gap-2">
                      {(['actual', 'per40'] as const).map(m => (
                        <button
                          key={m}
                          onClick={() => setViewMode(m)}
                          className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                            viewMode === m ? 'bg-brand-main text-black' : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {m === 'actual' ? '実スタッツ' : 'PER40換算'}
                        </button>
                      ))}
                    </div>

                    {/* スタッツ表 */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs min-w-max">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left py-1 px-2 text-gray-400 font-medium sticky left-0 bg-white">選手名</th>
                            <th className="text-right py-1 px-2 text-gray-400 font-medium">出場</th>
                            <th className="text-right py-1 px-2 text-gray-400 font-medium">得点</th>
                            <th className="text-right py-1 px-2 text-gray-400 font-medium">3P%</th>
                            <th className="text-right py-1 px-2 text-gray-400 font-medium">2P%</th>
                            <th className="text-right py-1 px-2 text-gray-400 font-medium">FT%</th>
                            <th className="text-right py-1 px-2 text-gray-400 font-medium">REB</th>
                            <th className="text-right py-1 px-2 text-gray-400 font-medium">AST</th>
                            <th className="text-right py-1 px-2 text-gray-400 font-medium">STL</th>
                            <th className="text-right py-1 px-2 text-gray-400 font-medium">BLK</th>
                            <th className="text-right py-1 px-2 text-gray-400 font-medium">TO</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filterEntries(selectedGame.entries).map(entry => {
                            const per = calcPer40(entry)
                            const threePct = entry.three_attempted > 0 ? Math.round(entry.three_made / entry.three_attempted * 1000) / 10 : 0
                            const twoPct   = entry.two_attempted   > 0 ? Math.round(entry.two_made   / entry.two_attempted   * 1000) / 10 : 0
                            const ftPct    = entry.ft_attempted    > 0 ? Math.round(entry.ft_made    / entry.ft_attempted    * 1000) / 10 : 0

                            return (
                              <tr key={entry.id} className="border-b border-gray-50 hover:bg-gray-50">
                                <td className="py-1 px-2 font-medium text-gray-700 sticky left-0 bg-white">{entry.player_name}</td>
                                <td className="py-1 px-2 text-right text-gray-500">{entry.minutes_played}分</td>
                                <td className="py-1 px-2 text-right font-bold text-brand-main">
                                  {viewMode === 'per40' ? per.points : entry.points}
                                </td>
                                {/* 3P% - KPI: 33% */}
                                <td className={`py-1 px-2 text-right font-medium ${kpiColor(threePct, STATS_KPI.three_pct)}`}>
                                  {viewMode === 'per40'
                                    ? `${per.three_pct}%`
                                    : pct(entry.three_made, entry.three_attempted)
                                  }
                                </td>
                                {/* 2P% - KPI: 50% */}
                                <td className={`py-1 px-2 text-right font-medium ${kpiColor(twoPct, STATS_KPI.two_pct)}`}>
                                  {viewMode === 'per40'
                                    ? `${per.fg_pct}%`
                                    : pct(entry.two_made, entry.two_attempted)
                                  }
                                </td>
                                {/* FT% - KPI: 75% */}
                                <td className={`py-1 px-2 text-right font-medium ${kpiColor(ftPct, STATS_KPI.ft_pct)}`}>
                                  {viewMode === 'per40'
                                    ? `${per.ft_pct}%`
                                    : pct(entry.ft_made, entry.ft_attempted)
                                  }
                                </td>
                                <td className="py-1 px-2 text-right text-gray-600">
                                  {viewMode === 'per40' ? per.rebounds : entry.rebounds}
                                </td>
                                <td className="py-1 px-2 text-right text-gray-600">
                                  {viewMode === 'per40' ? per.assists : entry.assists}
                                </td>
                                <td className="py-1 px-2 text-right text-gray-600">
                                  {viewMode === 'per40' ? per.steals : entry.steals}
                                </td>
                                <td className="py-1 px-2 text-right text-gray-600">
                                  {viewMode === 'per40' ? per.blocks : entry.blocks}
                                </td>
                                <td className="py-1 px-2 text-right text-gray-600">
                                  {viewMode === 'per40' ? per.turnovers : entry.turnovers}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* KPI凡例 */}
                    <div className="flex gap-3 pt-1">
                      <span className="text-xs text-gray-400">KPI目標:</span>
                      <span className="text-xs text-gray-500">3P <span className="text-green-500 font-medium">{STATS_KPI.three_pct}%↑</span></span>
                      <span className="text-xs text-gray-500">2P <span className="text-green-500 font-medium">{STATS_KPI.two_pct}%↑</span></span>
                      <span className="text-xs text-gray-500">FT <span className="text-green-500 font-medium">{STATS_KPI.ft_pct}%↑</span></span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 推移グラフセクション */}
      {gameList.length >= 2 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-brand-dark text-sm">スタッツ推移グラフ</h3>
            <button
              onClick={handleShowTrend}
              disabled={trendLoading}
              className="text-xs text-brand-main font-medium disabled:opacity-50"
            >
              {trendLoading ? '読み込み中...' : showTrend ? '▲ 閉じる' : '▼ 表示する'}
            </button>
          </div>

          {showTrend && trendGames.length > 0 && (
            <div className="space-y-4">
              {/* 得点推移 */}
              <div>
                <p className="text-xs text-gray-400 mb-1">得点推移{viewMode === 'per40' ? '（PER40換算）' : ''}</p>
                <ResponsiveContainer width="100%" height={150}>
                  <LineChart data={buildTrendData()} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ fontSize: 11 }}
                      formatter={(v: number) => [`${v}点`, '得点']}
                      labelFormatter={(l, payload) => payload?.[0]?.payload?.opponent ? `vs ${payload[0].payload.opponent}` : l}
                    />
                    <Line type="monotone" dataKey="points" stroke="#e1c614" strokeWidth={2} dot={{ fill: '#e1c614', r: 3 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* シュート率推移（3P / FT） */}
              <div>
                <p className="text-xs text-gray-400 mb-1">シュート成功率推移（%）</p>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={buildTrendData()} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                    <Tooltip
                      contentStyle={{ fontSize: 11 }}
                      formatter={(v: number, name: string) => [`${v}%`, name]}
                      labelFormatter={(l, payload) => payload?.[0]?.payload?.opponent ? `vs ${payload[0].payload.opponent}` : l}
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    {/* KPI基準ライン */}
                    <ReferenceLine y={STATS_KPI.three_pct} stroke="#6b7280" strokeDasharray="4 4" label={{ value: `3P目標${STATS_KPI.three_pct}%`, position: 'right', fontSize: 9, fill: '#9ca3af' }} />
                    <ReferenceLine y={STATS_KPI.ft_pct}    stroke="#6b7280" strokeDasharray="4 4" label={{ value: `FT目標${STATS_KPI.ft_pct}%`,   position: 'right', fontSize: 9, fill: '#9ca3af' }} />
                    <Line type="monotone" dataKey="three_pct" name="3P%" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} connectNulls />
                    <Line type="monotone" dataKey="ft_pct"    name="FT%" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e', r: 3 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
