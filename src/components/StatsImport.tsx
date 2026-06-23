'use client'

import { useState, useRef } from 'react'
import { parseCsvToGameStats, importGameStats } from '@/lib/data'
import { CsvStatRow } from '@/types/database'

// ============================================================
// CSVインポートコンポーネント（コーチ専用）
// ============================================================

interface StatsImportProps {
  coachId: string
  onImported: () => void
}

// ---- バスケ専用CSV（LiveStats形式）の列インデックス定義 ----
// #,Player,GS,MIN,PTS,FGM,FGA,FG%,2PM,2PA,2P%,LUM,LUA,LU%,3PM,3PA,3P%,FTM,FTA,FT%,OR,DR,TR,AST,TO,STL,BLK,DIF,PF,FD,EFF,+/-
const BASKETBALL_CSV_COLS = {
  number: 0,
  player: 1,
  gs: 2,
  min: 3,
  pts: 4,
  fg2m: 8,
  fg2a: 9,
  lum: 11,
  lua: 12,
  fg3m: 14,
  fg3a: 15,
  ftm: 17,
  fta: 18,
  tr: 22,
  ast: 23,
  to: 24,
  stl: 25,
  blk: 26,
  pf: 28,
} as const

/** MM:SS 形式の出場時間を分（整数）に変換する */
function parseMinutes(minStr: string): number {
  if (!minStr || minStr === '-') return 0
  const parts = minStr.split(':')
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10)
    return isNaN(m) ? 0 : m
  }
  const n = parseInt(minStr, 10)
  return isNaN(n) ? 0 : n
}

/** 数値文字列を整数に変換する。"-" や空文字は 0 */
function toInt(val: string): number {
  if (!val || val === '-') return 0
  const cleaned = val.replace('%', '').trim()
  const n = parseInt(cleaned, 10)
  return isNaN(n) ? 0 : n
}

/**
 * バスケット専用フォーマット（LiveStats系）のCSVテキストを CsvStatRow[] に変換する。
 *
 * 【選手名の保存ルール】
 *   - myTeam（自チーム）の選手 → player_name = "選手名"（そのまま）
 *   - 対戦相手チームの選手   → player_name = "チーム名 / 選手名"
 *
 * @param text        CSVファイルのテキスト
 * @param gameDate    試合日（YYYY-MM-DD）← UIで入力
 * @param myTeam      自チーム名（このチームの選手はそのまま保存）
 * @param opponent    対戦相手名（表示用）
 * @param gameType    試合種別
 * @param gameMinutes 試合時間（分）
 */
function convertBasketballCsv(
  text: string,
  gameDate: string,
  myTeam: string,
  opponent: string,
  gameType: string,
  gameMinutes: number,
): { rows: CsvStatRow[]; teams: string[]; matchTitle: string; errors: string[] } {
  const lines = text.split(/\r?\n/)
  const rows: CsvStatRow[] = []
  const errors: string[] = []
  const teams: string[] = []

  let currentTeam = ''
  let inPlayerSection = false
  let matchTitle = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) {
      inPlayerSection = false
      continue
    }

    const cols = line.split(',')

    // 1行目: タイトル行
    if (i === 0 && !line.startsWith('#')) {
      matchTitle = cols[0].trim()
      continue
    }

    // # Match 行
    if (cols[0].trim() === '# Match') {
      if (!matchTitle) matchTitle = cols[1]?.trim() || ''
      continue
    }

    // # Quarter 行 → スキップ
    if (cols[0].trim() === '# Quarter') {
      continue
    }

    // # Team 行 → チーム名取得
    if (cols[0].trim() === '# Team') {
      currentTeam = cols[1]?.trim() || ''
      if (!teams.includes(currentTeam)) teams.push(currentTeam)
      inPlayerSection = false
      continue
    }

    // ヘッダー行（"#,Player,GS,MIN,..." の行）
    if (cols[0].trim() === '#' && cols[1]?.trim() === 'Player') {
      inPlayerSection = true
      continue
    }

    // TEAM 集計行はスキップ
    if (cols[0].trim() === 'TEAM') {
      continue
    }

    // 選手データ行
    if (inPlayerSection && cols.length >= 27) {
      const rawPlayerName = cols[BASKETBALL_CSV_COLS.player]?.trim()
      const numberStr = cols[BASKETBALL_CSV_COLS.number]?.trim()

      if (!rawPlayerName) continue
      if (!/^\d+$/.test(numberStr)) continue

      const minutesPlayed = parseMinutes(cols[BASKETBALL_CSV_COLS.min]?.trim())

      // 2PM + LUM（ミドルレンジ）を合算して fg2 とする
      const fg2m = toInt(cols[BASKETBALL_CSV_COLS.fg2m]) + toInt(cols[BASKETBALL_CSV_COLS.lum])
      const fg2a = toInt(cols[BASKETBALL_CSV_COLS.fg2a]) + toInt(cols[BASKETBALL_CSV_COLS.lua])

      // 【自チーム判定】
      // myTeam と currentTeam が一致 → 自チーム選手（player_name はそのまま）
      // 一致しない           → 対戦相手選手（"チーム名 / 選手名" 形式）
      const isMyTeam = myTeam !== '' && currentTeam === myTeam
      const playerName = isMyTeam
        ? rawPlayerName
        : `${currentTeam} / ${rawPlayerName}`

      const row: CsvStatRow = {
        game_date: gameDate,
        opponent: opponent || matchTitle,
        game_type: gameType,
        game_minutes: String(gameMinutes),
        player_name: playerName,
        minutes_played: String(minutesPlayed),
        points: cols[BASKETBALL_CSV_COLS.pts]?.trim() || '0',
        rebounds: cols[BASKETBALL_CSV_COLS.tr]?.trim() || '0',
        assists: cols[BASKETBALL_CSV_COLS.ast]?.trim() || '0',
        steals: cols[BASKETBALL_CSV_COLS.stl]?.trim() || '0',
        blocks: cols[BASKETBALL_CSV_COLS.blk]?.trim() || '0',
        turnovers: cols[BASKETBALL_CSV_COLS.to]?.trim() || '0',
        fouls: cols[BASKETBALL_CSV_COLS.pf]?.trim() || '0',
        fg3_made: cols[BASKETBALL_CSV_COLS.fg3m]?.trim() || '0',
        fg3_attempted: cols[BASKETBALL_CSV_COLS.fg3a]?.trim() || '0',
        fg2_made: String(fg2m),
        fg2_attempted: String(fg2a),
        ft_made: cols[BASKETBALL_CSV_COLS.ftm]?.trim() || '0',
        ft_attempted: cols[BASKETBALL_CSV_COLS.fta]?.trim() || '0',
        // 内部管理用（UIのプレビュー表示に使用、DBには保存しない）
        _team: currentTeam,
        _is_my_team: isMyTeam ? '1' : '0',
      }

      rows.push(row)
    }
  }

  if (rows.length === 0 && teams.length === 0) {
    errors.push('バスケット専用CSV形式として認識できませんでした。「# Team」「# Match」行が存在するファイルを使用してください。')
  }

  return { rows, teams, matchTitle, errors }
}

/** 標準形式CSVテキスト（game_date,opponent,...のヘッダー行付き）を CsvStatRow[] に変換する */
function convertStandardCsv(text: string): CsvStatRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    const row: CsvStatRow = {}
    headers.forEach((h, i) => { row[h] = values[i] || '' })
    return row
  })
}

/** CSVがバスケット専用フォーマット（LiveStats系）かどうかを判定する */
function isBasketballCsvFormat(text: string): boolean {
  return /^# Team[,\r\n]/m.test(text) || /^# Match[,\r\n]/m.test(text)
}

export default function StatsImport({ coachId, onImported }: StatsImportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ---- ファイル・変換状態 ----
  const [rawText, setRawText] = useState<string>('')
  const [fileName, setFileName] = useState<string>('')
  const [isBasketballFormat, setIsBasketballFormat] = useState(false)
  const [detectedTeams, setDetectedTeams] = useState<string[]>([])
  const [detectedMatchTitle, setDetectedMatchTitle] = useState<string>('')

  // ---- バスケット専用フォーマット用の入力値 ----
  const [gameDate, setGameDate] = useState<string>('')
  const [opponentInput, setOpponentInput] = useState<string>('')
  const [gameType, setGameType] = useState<string>('公式戦')
  const [gameMinutes, setGameMinutes] = useState<number>(40)
  const [selectedTeam, setSelectedTeam] = useState<string>('')   // 自チーム名

  // ---- UI状態 ----
  const [previewRows, setPreviewRows] = useState<CsvStatRow[]>([])
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ success: number; errors: string[] } | null>(null)
  const [showTemplate, setShowTemplate] = useState(false)

  // ---- ファイル読み込み処理 ----
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setImportResult(null)
    setParseErrors([])
    setPreviewRows([])
    setRawText('')
    setDetectedTeams([])
    setDetectedMatchTitle('')
    setSelectedTeam('')

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      setRawText(text)

      if (isBasketballCsvFormat(text)) {
        setIsBasketballFormat(true)
        // チーム名・試合タイトルを先に抽出（日付未入力なのでプレビューは後で）
        const { teams, matchTitle } = convertBasketballCsv(text, '', '', '', '公式戦', 40)
        setDetectedTeams(teams)
        setDetectedMatchTitle(matchTitle)
        if (matchTitle) setOpponentInput(matchTitle)
        // 検出チームが1つなら自動選択
        if (teams.length === 1) setSelectedTeam(teams[0])
      } else {
        setIsBasketballFormat(false)
        const rows = convertStandardCsv(text)
        if (rows.length === 0) {
          setParseErrors(['CSVファイルにデータが見つかりませんでした。ファイルの形式を確認してください。'])
          return
        }
        const { valid, errors } = parseCsvToGameStats(rows, coachId)
        setPreviewRows(rows)
        if (valid.length === 0 && errors.length > 0) {
          setParseErrors(['有効なデータが見つかりませんでした。以下のエラーを確認してください。', ...errors])
        } else {
          setParseErrors(errors)
        }
      }
    }
    reader.onerror = () => setParseErrors(['ファイルの読み込みに失敗しました。'])
    reader.readAsText(file, 'UTF-8')
  }

  // ---- バスケット専用フォーマットのプレビュー生成 ----
  const handleBasketballPreview = () => {
    if (!rawText) return
    if (!gameDate) {
      setParseErrors(['試合日を入力してください（例: 2026-06-15）'])
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(gameDate)) {
      setParseErrors(['試合日の形式が正しくありません（例: 2026-06-15）'])
      return
    }
    if (!selectedTeam) {
      setParseErrors(['自チームを選択してください。対戦相手の選手には「チーム名 / 選手名」が自動的に付与されます。'])
      return
    }

    setParseErrors([])
    const { rows, errors } = convertBasketballCsv(
      rawText,
      gameDate,
      selectedTeam,
      opponentInput || detectedMatchTitle,
      gameType,
      gameMinutes,
    )

    if (errors.length > 0) {
      setParseErrors(errors)
      return
    }

    const { valid, errors: validationErrors } = parseCsvToGameStats(rows, coachId)
    setPreviewRows(rows)
    if (valid.length === 0) {
      setParseErrors(['有効なデータが見つかりませんでした。', ...validationErrors])
    } else {
      setParseErrors(validationErrors)
    }
  }

  // ---- インポート実行 ----
  const handleImport = async () => {
    if (previewRows.length === 0) return
    setImporting(true)
    try {
      const { valid, errors } = parseCsvToGameStats(previewRows, coachId)
      if (valid.length === 0) {
        setParseErrors(['インポート可能なデータがありません。'])
        setImporting(false)
        return
      }
      const result = await importGameStats(valid, coachId)
      setImportResult(result)
      if (result.success > 0) {
        setPreviewRows([])
        setFileName('')
        setRawText('')
        if (fileInputRef.current) fileInputRef.current.value = ''
        onImported()
      }
    } catch (e) {
      console.error('[StatsImport] インポートエラー:', e)
      setImportResult({ success: 0, errors: ['インポートに失敗しました。再度お試しください。'] })
    } finally {
      setImporting(false)
    }
  }

  // ---- リセット ----
  const handleReset = () => {
    setPreviewRows([])
    setFileName('')
    setRawText('')
    setParseErrors([])
    setImportResult(null)
    setIsBasketballFormat(false)
    setDetectedTeams([])
    setDetectedMatchTitle('')
    setSelectedTeam('')
    setGameDate('')
    setOpponentInput('')
    setGameType('公式戦')
    setGameMinutes(40)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const { valid: validRows } = previewRows.length > 0
    ? parseCsvToGameStats(previewRows, coachId)
    : { valid: [] }

  // プレビュー行のうち自チーム数・相手チーム数を集計
  const myTeamCount = previewRows.filter(r => r._is_my_team === '1').length
  const opponentCount = previewRows.filter(r => r._is_my_team === '0').length

  return (
    <div className="space-y-4">

      {/* ---- テンプレート説明 ---- */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-bold text-blue-800">📄 対応CSVフォーマット</h4>
          <button
            onClick={() => setShowTemplate(!showTemplate)}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            {showTemplate ? '閉じる' : '詳細を見る'}
          </button>
        </div>
        <p className="text-xs text-blue-700">
          ✅ バスケット専用CSV（LiveStats形式）と標準CSV（ヘッダー行付き）の両方に対応しています。
        </p>

        {showTemplate && (
          <div className="mt-3 space-y-3">
            <div>
              <p className="text-xs font-bold text-blue-800 mb-1">① バスケット専用CSV（LiveStats形式）</p>
              <p className="text-xs text-blue-700">
                「# Match」「# Team」「# Quarter」行を含む形式です。試合スタッツソフトからそのまま読み込めます。<br/>
                読み込み後に試合日・自チーム・対戦相手・種別を入力してください。
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-blue-800 mb-1">② 標準CSV形式</p>
              <div className="bg-white border border-blue-100 rounded-lg p-2 text-xs font-mono text-gray-700 overflow-x-auto whitespace-nowrap">
                game_date,opponent,game_type,game_minutes,player_name,minutes_played,points,rebounds,assists,steals,blocks,turnovers,fouls,fg3_made,fg3_attempted,fg2_made,fg2_attempted,ft_made,ft_attempted
              </div>
            </div>
            <div className="text-xs text-blue-600 bg-blue-50 rounded p-2">
              📌 KPI基準: 3P 33%以上 / 2P 50%以上 / FT 75%以上
            </div>
          </div>
        )}
      </div>

      {/* ---- ファイル選択 ---- */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          CSVファイルを選択
        </label>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2.5 bg-brand-main text-brand-dark font-medium rounded-xl text-sm hover:bg-yellow-400 transition-colors shadow-sm"
          >
            📂 ファイルを選択
          </button>
          {fileName && (
            <span className="text-sm text-gray-600 flex items-center gap-2">
              <span className="text-green-600">✓</span>
              {fileName}
              {isBasketballFormat && (
                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                  バスケ専用形式
                </span>
              )}
            </span>
          )}
          {fileName && (
            <button onClick={handleReset} className="text-xs text-gray-400 hover:text-gray-600">
              ✕ クリア
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          onChange={handleFileChange}
          className="hidden"
        />
        <p className="text-xs text-gray-400 mt-1.5">※ UTF-8形式のCSVファイルのみ対応</p>
      </div>

      {/* ---- バスケット専用フォーマット用の設定入力 ---- */}
      {isBasketballFormat && rawText && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-4">
          <h4 className="text-sm font-bold text-orange-800">🏀 試合情報を入力してください</h4>

          {detectedMatchTitle && (
            <p className="text-xs text-orange-700">
              検出した試合: <strong>{detectedMatchTitle}</strong>（チーム数: {detectedTeams.length}チーム）
            </p>
          )}

          {/* 自チーム選択 */}
          <div>
            <label className="block text-xs font-medium text-orange-700 mb-1">
              自チームを選択 <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2 flex-wrap">
              {detectedTeams.map(team => (
                <button
                  key={team}
                  onClick={() => setSelectedTeam(team)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    selectedTeam === team
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white text-orange-700 border-orange-300 hover:bg-orange-100'
                  }`}
                >
                  {team}
                </button>
              ))}
            </div>
            <p className="text-xs text-orange-600 mt-1.5">
              ✅ 自チームの選手 → 選手名のみ保存 ／ 対戦相手の選手 → 「チーム名 / 選手名」形式で保存
            </p>
          </div>

          {/* 試合日 */}
          <div>
            <label className="block text-xs font-medium text-orange-700 mb-1">
              試合日 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={gameDate}
              onChange={e => setGameDate(e.target.value)}
              className="w-full sm:w-48 px-3 py-2 border border-orange-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          {/* 対戦相手 */}
          <div>
            <label className="block text-xs font-medium text-orange-700 mb-1">
              対戦相手名（表示用）
            </label>
            <input
              type="text"
              value={opponentInput}
              onChange={e => setOpponentInput(e.target.value)}
              placeholder="例: 秋草学園"
              className="w-full sm:w-64 px-3 py-2 border border-orange-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          {/* 試合種別 */}
          <div>
            <label className="block text-xs font-medium text-orange-700 mb-1">試合種別</label>
            <select
              value={gameType}
              onChange={e => setGameType(e.target.value)}
              className="px-3 py-2 border border-orange-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              <option value="公式戦">公式戦</option>
              <option value="練習試合">練習試合</option>
              <option value="インターハイ">インターハイ</option>
              <option value="新人戦">新人戦</option>
              <option value="県大会">県大会</option>
              <option value="その他">その他</option>
            </select>
          </div>

          {/* 試合時間 */}
          <div>
            <label className="block text-xs font-medium text-orange-700 mb-1">
              試合時間（分）<span className="text-gray-500 text-xs ml-1">PER40換算の基準値</span>
            </label>
            <select
              value={gameMinutes}
              onChange={e => setGameMinutes(Number(e.target.value))}
              className="px-3 py-2 border border-orange-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              <option value={40}>40分（高校・大学）</option>
              <option value={32}>32分（中学）</option>
              <option value={48}>48分（NBA）</option>
            </select>
          </div>

          {/* プレビューボタン */}
          <button
            onClick={handleBasketballPreview}
            className="px-5 py-2 bg-orange-500 text-white rounded-xl text-sm font-bold hover:bg-orange-600 transition-colors"
          >
            👀 プレビューを表示する
          </button>
        </div>
      )}

      {/* ---- エラー表示 ---- */}
      {parseErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <h4 className="text-sm font-bold text-red-700 mb-2">⚠️ エラー・警告</h4>
          <ul className="space-y-1">
            {parseErrors.map((err, i) => (
              <li key={i} className="text-xs text-red-600">{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ---- プレビュー ---- */}
      {previewRows.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <h4 className="text-sm font-bold text-gray-700">
              📋 プレビュー（{previewRows.length}行中 {validRows.length}行が有効）
            </h4>
            {isBasketballFormat && (
              <div className="flex gap-3 text-xs">
                <span className="text-blue-600 font-medium">🏠 自チーム: {myTeamCount}人</span>
                <span className="text-gray-500">⚔️ 対戦相手: {opponentCount}人</span>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  {isBasketballFormat && (
                    <th className="py-1.5 px-2 text-left text-gray-500">区分</th>
                  )}
                  <th className="py-1.5 px-2 text-left text-gray-500">選手名</th>
                  <th className="py-1.5 px-2 text-left text-gray-500">試合日</th>
                  <th className="py-1.5 px-2 text-left text-gray-500">相手</th>
                  <th className="py-1.5 px-2 text-right text-gray-500">出場(分)</th>
                  <th className="py-1.5 px-2 text-right text-gray-500">得点</th>
                  <th className="py-1.5 px-2 text-right text-gray-500">REB</th>
                  <th className="py-1.5 px-2 text-right text-gray-500">3P</th>
                  <th className="py-1.5 px-2 text-right text-gray-500">2P</th>
                  <th className="py-1.5 px-2 text-right text-gray-500">FT</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.slice(0, 12).map((row, i) => {
                  const isMyTeamRow = row._is_my_team === '1'
                  return (
                    <tr
                      key={i}
                      className={`border-b border-gray-50 ${isMyTeamRow ? 'bg-blue-50/40' : 'hover:bg-gray-50'}`}
                    >
                      {isBasketballFormat && (
                        <td className="py-1.5 px-2 text-xs">
                          {isMyTeamRow
                            ? <span className="text-blue-600 font-medium">🏠 自チーム</span>
                            : <span className="text-gray-400">⚔️ 相手</span>
                          }
                        </td>
                      )}
                      <td className="py-1.5 px-2 font-medium text-gray-800">{row.player_name}</td>
                      <td className="py-1.5 px-2 text-gray-700">{row.game_date}</td>
                      <td className="py-1.5 px-2 text-gray-700">{row.opponent}</td>
                      <td className="py-1.5 px-2 text-right text-gray-700">{row.minutes_played}</td>
                      <td className="py-1.5 px-2 text-right font-medium text-brand-dark">{row.points}</td>
                      <td className="py-1.5 px-2 text-right text-gray-700">{row.rebounds}</td>
                      <td className="py-1.5 px-2 text-right text-gray-700">{row.fg3_made}/{row.fg3_attempted}</td>
                      <td className="py-1.5 px-2 text-right text-gray-700">{row.fg2_made}/{row.fg2_attempted}</td>
                      <td className="py-1.5 px-2 text-right text-gray-700">{row.ft_made}/{row.ft_attempted}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {previewRows.length > 12 && (
            <p className="text-xs text-gray-400 mt-2 text-center">... 他 {previewRows.length - 12} 行</p>
          )}
        </div>
      )}

      {/* ---- インポートボタン ---- */}
      {validRows.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleImport}
            disabled={importing}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm ${
              importing
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-brand-dark text-white hover:bg-gray-800'
            }`}
          >
            {importing ? '処理中...' : `⬆️ ${validRows.length}件をインポートする`}
          </button>
          <p className="text-xs text-gray-400">※ 取り込んだデータは削除画面から個別削除できます</p>
        </div>
      )}

      {/* ---- インポート結果 ---- */}
      {importResult && (
        <div className={`rounded-xl p-4 ${
          importResult.success > 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          {importResult.success > 0 && (
            <p className="text-sm font-bold text-green-700">
              ✅ {importResult.success}件のスタッツデータをインポートしました
            </p>
          )}
          {importResult.errors.length > 0 && (
            <ul className="mt-2 space-y-1">
              {importResult.errors.map((err, i) => (
                <li key={i} className="text-xs text-red-600">{err}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
