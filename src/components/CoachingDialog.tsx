'use client'

/**
 * AIコーチング対話UI
 * 振り返りスコアが1・2の選手に、AIコーチが問いかけて深掘りを手伝う（最大3往復）。
 * スコア3・4の場合は称賛メッセージだけを表示する。
 */
import { useState } from 'react'

const MAX_TURNS = 3

type Turn = { question: string; answer: string }

export type CoachingInitial = {
  score: number
  feedback: string
  coaching_question: string
  is_completed: boolean
}

type Props = {
  recordId: string
  reflection: string
  // スコアリング結果が届くまで null
  initial: CoachingInitial | null
  // スコアリングが失敗・スキップされた場合 true（何も表示しない）
  unavailable: boolean
}

export default function CoachingDialog({ recordId, reflection, initial, unavailable }: Props) {
  const [history, setHistory] = useState<Turn[]>([])
  const [answer, setAnswer] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  // 対話中に更新される最新の状態（最初は initial）
  const [latest, setLatest] = useState<CoachingInitial | null>(null)
  const [skipped, setSkipped] = useState(false)

  if (unavailable) return null

  // スコアリング結果待ち
  if (!initial) {
    return (
      <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm text-sm text-gray-500 animate-pulse">
        🤖 AIコーチが振り返りを読んでいます...
      </div>
    )
  }

  const current = latest ?? initial

  // スコア3・4（または問いかけなし）: 称賛のみ
  if (history.length === 0 && initial.is_completed) {
    if (!initial.feedback) return null
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4 text-left">
        <p className="text-xs text-green-700 font-bold mb-1">🤖 AIコーチより</p>
        <p className="text-sm text-gray-700">{initial.feedback}</p>
      </div>
    )
  }

  const finished = current.is_completed || skipped
  // 画面に出す「いま答えるべき問いかけ」
  const currentQuestion = history.length === 0 ? initial.coaching_question : latest?.coaching_question || ''

  const handleSend = async () => {
    const text = answer.trim()
    if (!text || sending) return
    setSending(true)
    setError('')
    const nextHistory = [...history, { question: currentQuestion, answer: text }]
    try {
      const res = await fetch('/api/coaching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId, reflection, history: nextHistory }),
      })
      const data = await res.json()
      if (!res.ok || typeof data.score !== 'number') throw new Error('coaching failed')
      setHistory(nextHistory)
      setAnswer('')
      setLatest({
        score: data.score,
        feedback: data.feedback || '',
        coaching_question: data.coaching_question || '',
        // 画面側でも3回で必ず終了させる
        is_completed: !!data.is_completed || nextHistory.length >= MAX_TURNS,
      })
    } catch (e) {
      console.warn('[coaching] 呼び出しに失敗しました:', e)
      setError('うまく送れませんでした。もう一度ためしてください。')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-white border-2 border-brand-main rounded-2xl p-4 mb-4 text-left space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-brand-dark">🤖 AIコーチと振り返りを深めよう</p>
        <span className="text-xs text-gray-400">{Math.min(history.length + (finished ? 0 : 1), MAX_TURNS)}/{MAX_TURNS}</span>
      </div>

      {/* これまでのやり取り */}
      {history.map((t, i) => (
        <div key={i} className="space-y-2">
          <div className="bg-yellow-50 rounded-xl px-3 py-2 text-sm text-gray-700">🤖 {t.question}</div>
          <div className="bg-gray-100 rounded-xl px-3 py-2 text-sm text-gray-800 ml-6">{t.answer}</div>
        </div>
      ))}

      {finished ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3">
          <p className="text-sm text-gray-700">
            {skipped && !current.is_completed
              ? 'おつかれさま！また次の振り返りで一緒に考えよう。'
              : current.feedback || '具体的な振り返りになりましたね！'}
          </p>
        </div>
      ) : (
        <>
          {/* 現在の問いかけ */}
          <div className="bg-yellow-50 rounded-xl px-3 py-2 text-sm text-gray-700">🤖 {currentQuestion}</div>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value.slice(0, 500))}
            placeholder="思いついたことを自由に書いてみよう"
            rows={3}
            disabled={sending}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-brand-main focus:outline-none text-sm bg-gray-50 resize-none"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSend}
              disabled={sending || !answer.trim()}
              className="flex-1 bg-brand-main text-brand-dark font-bold py-2.5 rounded-xl hover:bg-yellow-400 transition-colors disabled:opacity-50 text-sm"
            >
              {sending ? 'AIコーチが考え中...' : '答える'}
            </button>
            <button
              onClick={() => setSkipped(true)}
              disabled={sending}
              className="px-4 bg-gray-100 text-gray-600 font-medium py-2.5 rounded-xl hover:bg-gray-200 transition-colors text-sm disabled:opacity-50"
            >
              スキップ
            </button>
          </div>
        </>
      )}
    </div>
  )
}
