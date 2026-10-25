/**
 * AIコーチング（深掘り対話）API Route Handler
 *
 * 選手が問いかけに答えるたびに呼ばれ、以下を行う。
 *  1. 元の振り返り＋これまでの回答をまとめて再スコアリングする
 *  2. スコア3以上、または3回目の回答でまとめフィードバックを返して終了する
 *  3. それ以外は次の問いかけを返す
 * 対話は最大3往復（要件定義書 3.2）。上限はサーバー側でも強制する。
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import { callGeminiJson, GeminiNotConfiguredError } from '@/lib/gemini'
import { RUBRIC_TEXT, COACH_GUIDE, normalizeScore, asText, MAX_COACHING_TURNS } from '@/lib/scoring'

type Turn = { question: string; answer: string }

const MAX_TEXT = 1000

// 画面から受け取った対話履歴を安全な形にそろえる
function sanitizeHistory(value: unknown): Turn[] {
  if (!Array.isArray(value)) return []
  return value
    .slice(0, MAX_COACHING_TURNS)
    .map((t) => ({
      question: typeof t?.question === 'string' ? t.question.slice(0, MAX_TEXT) : '',
      answer: typeof t?.answer === 'string' ? t.answer.slice(0, MAX_TEXT) : '',
    }))
    .filter((t) => t.answer.trim().length > 0)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { recordId } = body
    const reflection = typeof body.reflection === 'string' ? body.reflection.trim().slice(0, MAX_TEXT) : ''
    const history = sanitizeHistory(body.history)

    // 振り返りと、少なくとも1回分の回答が必要
    if (!reflection || history.length === 0) {
      return NextResponse.json({ error: 'リクエストが不正です' }, { status: 400 })
    }

    // 回答が上限に達しているか（3回目の回答を受け取った段階で終了）
    const turnCount = history.length
    const isLastTurn = turnCount >= MAX_COACHING_TURNS

    if (!process.env.GEMINI_API_KEY) {
      console.error('【エラー】GEMINI_API_KEYが設定されていません')
      return NextResponse.json({ message: 'APIキー未設定' }, { status: 200 })
    }

    const dialogue = history
      .map((t, i) => `[${i + 1}回目] コーチの問いかけ: ${t.question}\n選手の回答: ${t.answer}`)
      .join('\n')

    const prompt = `
あなたはスポーツ選手のメタ認知能力を評価し、成長を促すメンタルコーチです。
以下の「最初の振り返り」と「コーチとの対話」を全体として読み、ルーブリックで1〜4段階に再採点してください。
${RUBRIC_TEXT}
${COACH_GUIDE}
【進め方】
- これは${turnCount}回目の回答を受けた段階です（最大${MAX_COACHING_TURNS}回）。
- ${isLastTurn
        ? '今回で対話は終了です。coaching_question は空文字にし、feedback には「具体的な振り返りになりましたね！」のように、選手の気づきや行動計画をたたえるまとめを書く。'
        : 'スコアが2以下なら、回答を受け止めたうえで次の問いかけを coaching_question に1つ書く。3以上なら coaching_question は空文字にし、feedback でたたえる。'}
【出力形式】
{ "score": <1-4>, "feedback": "<日本語で50-100文字>", "coaching_question": "<次の問いかけ。終了時は空文字>" }

【最初の振り返り】
${reflection}

【コーチとの対話】
${dialogue}
`

    let result: Record<string, unknown>
    try {
      result = await callGeminiJson(prompt)
    } catch (e) {
      if (e instanceof GeminiNotConfiguredError) {
        return NextResponse.json({ message: 'APIキー未設定' }, { status: 200 })
      }
      console.error('【エラー】コーチングAPIの処理に失敗しました:', e instanceof Error ? e.message : e)
      return NextResponse.json({ error: 'Gemini Error' }, { status: 500 })
    }

    const score = normalizeScore(result.score)
    const feedback = asText(result.feedback)
    let question = asText(result.coaching_question)

    // 終了条件: スコア3以上 / 3回目の回答 / 問いかけが作れなかった場合
    const isCompleted = score >= 3 || isLastTurn || !question
    if (isCompleted) question = ''

    // 再スコアリングで上がった場合のみ、記録のスコアを更新する（下げることはしない）
    if (recordId && isSupabaseConfigured()) {
      try {
        const supabase = getSupabase()
        const { data: current } = await supabase
          .from('daily_records')
          .select('mindset_score')
          .eq('id', recordId)
          .maybeSingle()
        const currentScore = typeof current?.mindset_score === 'number' ? current.mindset_score : 0
        if (score > currentScore) {
          const { error } = await supabase
            .from('daily_records')
            .update({ mindset_score: score, mindset_feedback: feedback })
            .eq('id', recordId)
          if (error) console.error('【エラー】コーチング後のスコア保存に失敗しました:', error.message)
        }
      } catch (e) {
        // 保存に失敗しても対話は続けられるようにする
        console.error('【エラー】コーチング後のスコア保存で例外が発生しました:', e instanceof Error ? e.message : e)
      }
    }

    return NextResponse.json(
      { score, feedback, coaching_question: question, is_completed: isCompleted },
      { status: 200 }
    )
  } catch (err) {
    console.error('【エラー】Coaching API 全体エラー:', err)
    return NextResponse.json({ error: '内部エラー' }, { status: 500 })
  }
}
