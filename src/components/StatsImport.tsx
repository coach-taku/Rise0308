'use client'

import { useState, useRef } from 'react'
import { parseCsvToGameStats, importGameStats } from '@/lib/data'
import { CsvStatRow } from '@/types/database'

// ============================================================
// CSVインポートコンポーネント（コーチ専用）
// ============================================================

interface StatsImportProps {
  /** インポートするコーチのuser_id */
  coachId: string
  /** インポート完了後のコールバック */
  onImported: () => void
}

/**
 * CSVファイルを読み込んでスタッツデータをインポートするコンポーネント。
 * コーチアカウントのみが使用できる。
 *
 * 期待するCSV形式（1行目はヘッダー行）:
 * game_date,opponent,game_type,game_minutes,player_name,
 * minutes_played,points,rebounds,assists,steals,blocks,
 * turnovers,fouls,fg3_made,fg3_attempted,fg2_made,fg2_attempted,
 * ft_made,ft_attempted
 */
export default function StatsImport({ coachId, onImported }: StatsImportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [previewRows, setPreviewRows] = useState<CsvStatRow[]>([])
  const [fileName, setFileName] = useState<string>('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ success: number; errors: string[] } | null>(null)
  const [showTemplate, setShowTemplate] = useState(false)

  /** CSVテキストを行・列に分割する（ダブルクォート対応） */
  const parseCsvText = (text: string): CsvStatRow[] => {
    const lines = text.split(/\r?\n/).filter(l => l.trim())
    if (lines.length < 2) return []

    // ヘッダー行を取得する
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))

    return lines.slice(1).map(line => {
      // カンマで分割（ダブルクォート内のカンマは無視する簡易実装）
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
      const row: CsvStatRow = {}
      headers.forEach((h, i) => {
        row[h] = values[i] || ''
      })
      return row
    })
  }

  /** ファイル選択時の処理 */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setImportResult(null)
    setParseErrors([])
    setPreviewRows([])

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const rows = parseCsvText(text)
      if (rows.length === 0) {
        setParseErrors(['CSVファイルにデータが見つかりませんでした。ファイルの形式を確認してください。'])
        return
      }
      // バリデーションを実行してプレビュー表示する
      const { valid, errors } = parseCsvToGameStats(rows, coachId)
      setPreviewRows(rows)
      setParseErrors(errors)
      if (valid.length === 0 && errors.length > 0) {
        setParseErrors(['有効なデータが見つかりませんでした。以下のエラーを確認してください。', ...errors])
      }
    }
    reader.onerror = () => {
      setParseErrors(['ファイルの読み込みに失敗しました。'])
    }
    reader.readAsText(file, 'UTF-8')
  }

  /** インポートを実行する */
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
        // 成功したらファイルをリセットして親コンポーネントに通知する
        setPreviewRows([])
        setFileName('')
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

  /** リセット */
  const handleReset = () => {
    setPreviewRows([])
    setFileName('')
    setParseErrors([])
    setImportResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // プレビュー用にバリデーション済みの有効行数を計算する
  const { valid: validRows } = previewRows.length > 0
    ? parseCsvToGameStats(previewRows, coachId)
    : { valid: [] }

  return (
    <div className="space-y-4">

      {/* ---- テンプレートの表示 ---- */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-bold text-blue-800">📄 CSVテンプレート</h4>
          <button
            onClick={() => setShowTemplate(!showTemplate)}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            {showTemplate ? '閉じる' : '表示する'}
          </button>
        </div>
        <p className="text-xs text-blue-700">
          以下のヘッダー行を含むCSVファイルを用意してください（文字コード: UTF-8）
        </p>

        {showTemplate && (
          <div className="mt-3">
            <div className="bg-white border border-blue-100 rounded-lg p-3 text-xs font-mono text-gray-700 overflow-x-auto whitespace-nowrap">
              game_date,opponent,game_type,game_minutes,player_name,minutes_played,points,rebounds,assists,steals,blocks,turnovers,fouls,fg3_made,fg3_attempted,fg2_made,fg2_attempted,ft_made,ft_attempted
            </div>
            <div className="mt-2 text-xs text-blue-700 space-y-1">
              <p>• <strong>game_date</strong>: 試合日（例: 2026-05-10）</p>
              <p>• <strong>opponent</strong>: 対戦相手名</p>
              <p>• <strong>game_type</strong>: 試合種別（例: 練習試合 / 公式戦）</p>
              <p>• <strong>game_minutes</strong>: 試合時間（分）。PER40換算の基準値</p>
              <p>• <strong>player_name</strong>: 選手名（必須。完全一致）</p>
              <p>• <strong>minutes_played</strong>: 出場時間（分）</p>
              <p>• <strong>fg3_made / fg3_attempted</strong>: 3P成功数 / 試投数</p>
              <p>• <strong>fg2_made / fg2_attempted</strong>: 2P成功数 / 試投数</p>
              <p>• <strong>ft_made / ft_attempted</strong>: FT成功数 / 試投数</p>
            </div>
            <div className="mt-2 text-xs text-blue-600 bg-blue-50 rounded p-2">
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
        <div className="flex items-center gap-3">
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
            </span>
          )}
          {fileName && (
            <button
              onClick={handleReset}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              ✕ クリア
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          className="hidden"
        />
        <p className="text-xs text-gray-400 mt-1.5">
          ※ UTF-8形式のCSVファイルのみ対応
        </p>
      </div>

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
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-gray-700">
              📋 プレビュー（{previewRows.length}行中 {validRows.length}行が有効）
            </h4>
          </div>

          {/* プレビューテーブル（最大5行表示） */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="py-1.5 px-2 text-left text-gray-500">試合日</th>
                  <th className="py-1.5 px-2 text-left text-gray-500">相手</th>
                  <th className="py-1.5 px-2 text-left text-gray-500">種別</th>
                  <th className="py-1.5 px-2 text-left text-gray-500">選手名</th>
                  <th className="py-1.5 px-2 text-right text-gray-500">出場(分)</th>
                  <th className="py-1.5 px-2 text-right text-gray-500">得点</th>
                  <th className="py-1.5 px-2 text-right text-gray-500">3P</th>
                  <th className="py-1.5 px-2 text-right text-gray-500">2P</th>
                  <th className="py-1.5 px-2 text-right text-gray-500">FT</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-1.5 px-2 text-gray-700">{row.game_date}</td>
                    <td className="py-1.5 px-2 text-gray-700">{row.opponent}</td>
                    <td className="py-1.5 px-2 text-gray-700">{row.game_type}</td>
                    <td className="py-1.5 px-2 font-medium text-gray-800">{row.player_name}</td>
                    <td className="py-1.5 px-2 text-right text-gray-700">{row.minutes_played}</td>
                    <td className="py-1.5 px-2 text-right font-medium text-brand-dark">{row.points}</td>
                    <td className="py-1.5 px-2 text-right text-gray-700">{row.fg3_made}/{row.fg3_attempted}</td>
                    <td className="py-1.5 px-2 text-right text-gray-700">{row.fg2_made}/{row.fg2_attempted}</td>
                    <td className="py-1.5 px-2 text-right text-gray-700">{row.ft_made}/{row.ft_attempted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {previewRows.length > 5 && (
            <p className="text-xs text-gray-400 mt-2 text-center">... 他 {previewRows.length - 5} 行</p>
          )}
        </div>
      )}

      {/* ---- インポートボタン ---- */}
      {validRows.length > 0 && (
        <div className="flex items-center gap-3">
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
