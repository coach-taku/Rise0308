'use client'

/**
 * StatsImport.tsx
 * コーチ専用CSVインポートコンポーネント。
 * CSV を選択すると各行を解析してプレビュー表示し、
 * 「インポート確定」でデータベースに一括登録する。
 *
 * 期待するCSVフォーマット（ヘッダー行あり）:
 * player_name,minutes_played,fg_made,fg_attempted,three_made,three_attempted,
 * ft_made,ft_attempted,rebounds,assists,steals,blocks,turnovers,points
 *
 * ※ two_made / two_attempted は fg - three から自動計算する。
 */

import { useState, useRef } from 'react'
import { GameStat, GameStatEntry } from '@/types/database'
import { createGameStat, createGameStatEntries } from '@/lib/data'

interface Props {
  coachUserId: string
  /** インポート完了後に呼ばれるコールバック（一覧を再読み込みするために使う） */
  onImported: () => void
}

/** CSVから解析した1行分のデータ（プレビュー表示用） */
interface ParsedRow {
  player_name: string
  minutes_played: number
  fg_made: number
  fg_attempted: number
  three_made: number
  three_attempted: number
  ft_made: number
  ft_attempted: number
  rebounds: number
  assists: number
  steals: number
  blocks: number
  turnovers: number
  points: number
}

/** CSVヘッダー名から列インデックスを取得するヘルパー */
function colIdx(headers: string[], name: string): number {
  return headers.findIndex(h => h.trim().toLowerCase() === name.trim().toLowerCase())
}

/** 数値変換（変換失敗時は0） */
function toNum(v: string | undefined): number {
  const n = Number(v?.trim())
  return isNaN(n) ? 0 : n
}

export default function StatsImport({ coachUserId, onImported }: Props) {
  // ---- フォームの状態 ----
  const [gameDate, setGameDate]       = useState('')
  const [opponent, setOpponent]       = useState('')
  const [gameType, setGameType]       = useState<GameStat['game_type']>('練習試合')
  const [gameMinutes, setGameMinutes] = useState<string>('40')

  // ---- ファイル解析の状態 ----
  const [parsedRows, setParsedRows]   = useState<ParsedRow[]>([])
  const [parseError, setParseError]   = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // ---- 送信の状態 ----
  const [importing, setImporting]     = useState(false)
  const [importDone, setImportDone]   = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  /** CSVファイルを選択したときの処理 */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setParseError(null)
    setParsedRows([])
    setImportDone(false)
    setImportError(null)

    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      if (!text) { setParseError('ファイルの読み込みに失敗しました。'); return }

      // 改行コード統一 → 行分割
      const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim() !== '')
      if (lines.length < 2) { setParseError('データ行がありません（ヘッダー行のみ検出）。'); return }

      const headers = lines[0].split(',')

      // 必須カラムの存在チェック
      const required = ['player_name', 'minutes_played', 'fg_made', 'fg_attempted',
        'three_made', 'three_attempted', 'ft_made', 'ft_attempted',
        'rebounds', 'assists', 'steals', 'blocks', 'turnovers', 'points']
      const missing = required.filter(col => colIdx(headers, col) === -1)
      if (missing.length > 0) {
        setParseError(`CSVに必須カラムが見つかりません: ${missing.join(', ')}`)
        return
      }

      const rows: ParsedRow[] = []
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',')
        if (cols.every(c => c.trim() === '')) continue // 空行スキップ

        rows.push({
          player_name:      cols[colIdx(headers, 'player_name')]?.trim() || `選手${i}`,
          minutes_played:   toNum(cols[colIdx(headers, 'minutes_played')]),
          fg_made:          toNum(cols[colIdx(headers, 'fg_made')]),
          fg_attempted:     toNum(cols[colIdx(headers, 'fg_attempted')]),
          three_made:       toNum(cols[colIdx(headers, 'three_made')]),
          three_attempted:  toNum(cols[colIdx(headers, 'three_attempted')]),
          ft_made:          toNum(cols[colIdx(headers, 'ft_made')]),
          ft_attempted:     toNum(cols[colIdx(headers, 'ft_attempted')]),
          rebounds:         toNum(cols[colIdx(headers, 'rebounds')]),
          assists:          toNum(cols[colIdx(headers, 'assists')]),
          steals:           toNum(cols[colIdx(headers, 'steals')]),
          blocks:           toNum(cols[colIdx(headers, 'blocks')]),
          turnovers:        toNum(cols[colIdx(headers, 'turnovers')]),
          points:           toNum(cols[colIdx(headers, 'points')]),
        })
      }

      if (rows.length === 0) { setParseError('有効なデータ行が見つかりません。'); return }
      setParsedRows(rows)
    }
    reader.onerror = () => setParseError('ファイルの読み込みに失敗しました。')
    reader.readAsText(file, 'UTF-8')
  }

  /** インポート確定ボタン */
  const handleImport = async () => {
    if (!gameDate || !opponent || parsedRows.length === 0) return
    const mins = parseInt(gameMinutes, 10)
    if (isNaN(mins) || mins <= 0) { setImportError('試合時間（分）を正しく入力してください。'); return }

    setImporting(true)
    setImportError(null)
    try {
      // 1. 試合メタ情報を登録
      const game = await createGameStat({
        game_date: gameDate,
        opponent,
        game_type: gameType,
        game_minutes: mins,
        created_by: coachUserId,
      })

      // 2. 選手エントリーを一括登録
      const entries: Omit<GameStatEntry, 'id' | 'created_at'>[] = parsedRows.map(row => ({
        game_stat_id:     game.id,
        player_name:      row.player_name,
        user_id:          null,              // 手動紐付けは後で行う
        minutes_played:   row.minutes_played,
        fg_made:          row.fg_made,
        fg_attempted:     row.fg_attempted,
        three_made:       row.three_made,
        three_attempted:  row.three_attempted,
        two_made:         row.fg_made - row.three_made,
        two_attempted:    row.fg_attempted - row.three_attempted,
        ft_made:          row.ft_made,
        ft_attempted:     row.ft_attempted,
        rebounds:         row.rebounds,
        assists:          row.assists,
        steals:           row.steals,
        blocks:           row.blocks,
        turnovers:        row.turnovers,
        points:           row.points,
      }))
      await createGameStatEntries(entries)

      setImportDone(true)
      // フォームをリセット
      setGameDate('')
      setOpponent('')
      setGameType('練習試合')
      setGameMinutes('40')
      setParsedRows([])
      if (fileRef.current) fileRef.current.value = ''
      onImported()
    } catch (err) {
      console.error('[StatsImport] インポートエラー:', err)
      setImportError('インポートに失敗しました。再度お試しください。')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* 試合情報入力 */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
        <h3 className="font-bold text-brand-dark text-sm">試合情報を入力</h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">試合日 <span className="text-red-400">*</span></label>
            <input
              type="date"
              value={gameDate}
              onChange={e => setGameDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-main focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">試合時間（分）<span className="text-red-400">*</span></label>
            <input
              type="number"
              value={gameMinutes}
              min={1}
              onChange={e => setGameMinutes(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-main focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">対戦相手 <span className="text-red-400">*</span></label>
          <input
            type="text"
            value={opponent}
            onChange={e => setOpponent(e.target.value)}
            placeholder="例：浦和南高校"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-main focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">試合種別</label>
          <select
            value={gameType}
            onChange={e => setGameType(e.target.value as GameStat['game_type'])}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-main focus:outline-none bg-white"
          >
            <option value="公式戦">公式戦</option>
            <option value="練習試合">練習試合</option>
            <option value="リーグ戦">リーグ戦</option>
            <option value="その他">その他</option>
          </select>
        </div>
      </div>

      {/* CSVファイル選択 */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
        <h3 className="font-bold text-brand-dark text-sm">CSVファイルを選択</h3>
        <p className="text-xs text-gray-400">
          必須カラム: player_name, minutes_played, fg_made, fg_attempted, three_made, three_attempted,
          ft_made, ft_attempted, rebounds, assists, steals, blocks, turnovers, points
        </p>

        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand-main file:text-white hover:file:opacity-80"
        />

        {parseError && (
          <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{parseError}</p>
        )}
      </div>

      {/* プレビュー */}
      {parsedRows.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
          <h3 className="font-bold text-brand-dark text-sm">プレビュー（{parsedRows.length}名）</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-max">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-1 px-2 text-gray-400 font-medium">選手名</th>
                  <th className="text-right py-1 px-2 text-gray-400 font-medium">出場</th>
                  <th className="text-right py-1 px-2 text-gray-400 font-medium">得点</th>
                  <th className="text-right py-1 px-2 text-gray-400 font-medium">FG</th>
                  <th className="text-right py-1 px-2 text-gray-400 font-medium">3P</th>
                  <th className="text-right py-1 px-2 text-gray-400 font-medium">FT</th>
                  <th className="text-right py-1 px-2 text-gray-400 font-medium">REB</th>
                  <th className="text-right py-1 px-2 text-gray-400 font-medium">AST</th>
                  <th className="text-right py-1 px-2 text-gray-400 font-medium">STL</th>
                  <th className="text-right py-1 px-2 text-gray-400 font-medium">BLK</th>
                  <th className="text-right py-1 px-2 text-gray-400 font-medium">TO</th>
                </tr>
              </thead>
              <tbody>
                {parsedRows.map((row, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-1 px-2 font-medium text-gray-700">{row.player_name}</td>
                    <td className="py-1 px-2 text-right text-gray-600">{row.minutes_played}分</td>
                    <td className="py-1 px-2 text-right font-bold text-brand-main">{row.points}</td>
                    <td className="py-1 px-2 text-right text-gray-600">{row.fg_made}/{row.fg_attempted}</td>
                    <td className="py-1 px-2 text-right text-gray-600">{row.three_made}/{row.three_attempted}</td>
                    <td className="py-1 px-2 text-right text-gray-600">{row.ft_made}/{row.ft_attempted}</td>
                    <td className="py-1 px-2 text-right text-gray-600">{row.rebounds}</td>
                    <td className="py-1 px-2 text-right text-gray-600">{row.assists}</td>
                    <td className="py-1 px-2 text-right text-gray-600">{row.steals}</td>
                    <td className="py-1 px-2 text-right text-gray-600">{row.blocks}</td>
                    <td className="py-1 px-2 text-right text-gray-600">{row.turnovers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {importError && (
            <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{importError}</p>
          )}

          {importDone && (
            <p className="text-xs text-green-600 bg-green-50 px-3 py-2 rounded-lg font-medium">
              ✅ インポートが完了しました！
            </p>
          )}

          <button
            onClick={handleImport}
            disabled={importing || !gameDate || !opponent}
            className="w-full py-3 rounded-xl bg-brand-main text-black font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80 transition-opacity"
          >
            {importing ? 'インポート中...' : `${parsedRows.length}名のスタッツをインポート確定`}
          </button>
        </div>
      )}
    </div>
  )
}
