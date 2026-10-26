'use client'

/**
 * AIコーチング対話UI
 * 振り返りレベル（1〜4）に関わらず、AIコーチが問いかけて深掘りを手伝う（最大3往復）。
 *  - レベル1〜2: 具体性・原因・改善策を引き出す問いかけ
 *  - レベル3〜4: 称賛したうえで、再現性・次の挑戦につながる発展的な問いかけ
 * 画面上部に「あなたの今日の振り返りレベル」と自己肯定感を高めるフィードバックを表示する。
 */
import { useState } from 'react'

const MAX_TURNS = 3

type Turn = { question: string; answer: string }

export type CoachingInitial = {
  score: number
  level?: number
  level_label?: string
  level_description?: string
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

// レベルごとのバッジ色（低い順に、落ち着いた色から明るい色へ）
const LEVEL_COLORS: Record<number, string> = {
  1: 'bg-gray-100 text-gray-700 border-gray-300',
  2: 'bg-blue-50 text-blue-700 border-blue-200',
  3: 'bg-green-50 text-green-700 border-green-300',
  4: 'bg-yellow-50 text-yellow-800 border-yellow-400',
}

// 「レベル X / 4」を4つの丸で見せる表示
function LevelBadge({ data }: { data: CoachingInitial }) {
  const level = Math.max(1, Math.min(4, data.level ?? data.score))
  return (
    <div className={`border rounded-xl p-3 ${LEVEL_COLORS[level]}`}>
      <p className="text-xs font-bold">あなたの今日の振り返りレベル</p>
      <div className="flex items-center gap-3 mt-1">
        <p className="text-2xl font-bold leading-none">
          レベル {level} <span className="text-base font-medium">/ 4</span>
        </p>
        <div className="flex gap-1" aria-label={`レベル${level}／4`}>
          {[1, 2, 3, 4].map(n => (
            <span
              key={n}
              className={`w-3 h-3 rounded-full border ${n <= level ? 'bg-brand-main border-brand-dark' : 'bg-white border-gray-300'}`}
            />
          ))}
        </div>
      </div>
      {data.level_label && <p className="text-xs font-bold mt-2">{data.level_label}</p>}
      {data.level_description && <p className="text-xs mt-1 leading-relaxed">{data.level_description}</p>}
    </div>
  )
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

  // 問いかけが作れなかった場合: レベルとフィードバックのみ表示
  if (history.length === 0 && initial.is_completed) {
    return (
      <div className="bg-white border border-green-200 rounded-2xl p-4 mb-4 text-left space-y-3">
        <LevelBadge data={initial} />
        {initial.feedback && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3">
            <p className="text-xs text-green-700 font-bold mb-1">🤖 AIコーチより</p>
            <p className="text-sm text-gray-700 leading-relaxed">{initial.feedback}</p>
          </div>
        )}
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
        level: data.level,
        level_label: data.level_label,
        level_description: data.level_description,
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

      {/* 今日の振り返りレベル（対話が進むと最新のレベルに更新される） */}
      <LevelBadge data={current} />

      {/* 自己肯定感を高めるフィードバック（最新のもの） */}
      {current.feedback && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3">
          <p className="text-xs text-green-700 font-bold mb-1">🤖 AIコーチより</p>
          <p className="text-sm text-gray-700 leading-relaxed">{current.feedback}</p>
        </div>
      )}

      {/* これまでのやり取り */}
      {history.map((t, i) => (
        <div key={i} className="space-y-2">
          <div className="bg-yellow-50 rounded-xl px-3 py-2 text-sm text-gray-700">🤖 {t.question}</div>
          <div className="bg-gray-100 rounded-xl px-3 py-2 text-sm text-gray-800 ml-6">{t.answer}</div>
        </div>
      ))}

      {finished ? (
        <div className="bg-brand-main/20 rounded-xl p-3">
          <p className="text-sm text-gray-700">
            {skipped && !current.is_completed
              ? 'おつかれさま！また次の振り返りで一緒に考えよう。'
              : '今日もここまで考えられたのは、あなたの強みです。続けることが成長の証ですよ！'}
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
