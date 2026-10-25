/**
 * グロースマインドセット自動スコアリング API Route Handler
 *
 * 振り返りを1〜4で採点して保存する。
 * context が "daily" の場合は、スコア1・2の選手向けにAIコーチングの最初の問いかけも返す。
 * （2回目以降の深掘りは /api/coaching が担当）
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import { callGeminiJson, GeminiNotConfiguredError } from '@/lib/gemini'
import {
  RUBRIC_TEXT,
  COACH_GUIDE,
  TARGET_TABLES,
  isScoringContext,
  normalizeScore,
  asText,
  needsCoaching,
} from '@/lib/scoring'

const RUBRIC = `
あなたはスポーツ選手のメタ認知能力を評価する専門家です。
以下のルーブリックに基づき、選手の振り返りテキストを1〜4段階で採点してください。
${RUBRIC_TEXT}
`

// コーチング対象になり得る場合に追加する指示
const COACHING_ADDON = `
${COACH_GUIDE}
【出力形式】
{ "score": <1-4>, "feedback": "<日本語で50-100文字>", "coaching_question": "<スコアが1か2の場合のみ、コーチとしての問いかけ。3以上なら空文字>" }
`

const PLAIN_OUTPUT = `
【出力形式】
{ "score": <1-4>, "feedback": "<日本語で50-100文字>" }
`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { recordId, reflection, context } = body

    // 保存先の指定が不正な場合はエラーにする（本文・氏名はログに出さない）
    if (!isScoringContext(context)) {
      console.error('【エラー】contextが不正です。daily または mandala_reflection を指定してください', {
        context: typeof context === 'string' ? context.slice(0, 50) : typeof context,
      })
      return NextResponse.json({ error: 'contextが不正です' }, { status: 400 })
    }
    const targetTable = TARGET_TABLES[context]
    // コーチング（深掘り）はデイリーノートのみ対象
    const withCoaching = context === 'daily'

    // 振り返りが短い場合、または保存先の行IDがない場合はスキップ
    if (!recordId || typeof reflection !== 'string' || reflection.trim().length < 20) {
      console.log('【スキップ】振り返りが20文字未満、または recordId がありません', { context })
      return NextResponse.json({ message: 'スキップしました' }, { status: 200 })
    }

    if (!process.env.GEMINI_API_KEY) {
      console.error('【エラー】GEMINI_API_KEYが設定されていません')
      return NextResponse.json({ message: 'APIキー未設定' }, { status: 200 })
    }

    const prompt =
      `${RUBRIC}${withCoaching ? COACHING_ADDON : PLAIN_OUTPUT}\n\n【振り返りテキスト】\n${reflection.trim()}`

    let scoringResult: Record<string, unknown>
    try {
      scoringResult = await callGeminiJson(prompt)
    } catch (e) {
      if (e instanceof GeminiNotConfiguredError) {
        return NextResponse.json({ message: 'APIキー未設定' }, { status: 200 })
      }
      console.error('【エラー】Gemini APIの処理に失敗しました:', e instanceof Error ? e.message : e)
      return NextResponse.json({ error: 'Gemini Error' }, { status: 500 })
    }

    // スコアが確実に1〜4の整数になるようにバリデーション
    const score = normalizeScore(scoringResult.score)
    const feedback = asText(scoringResult.feedback)
    console.log(`【成功】スコア計算完了: ${score}点`)

    if (isSupabaseConfigured()) {
      // 更新された行を返してもらい、実際に保存できたか件数を確認する
      const { data: updatedRows, error: supabaseError } = await getSupabase()
        .from(targetTable)
        .update({ mindset_score: score, mindset_feedback: feedback })
        .eq('id', recordId)
        .select('id')

      if (supabaseError) {
        console.error('【エラー】Supabase Update Error:', { context, recordId, message: supabaseError.message })
        return NextResponse.json({ error: 'DB更新エラー' }, { status: 500 })
      }

      // 0件更新はエラーにならないため、ここで明示的にエラーとして記録する
      if (!updatedRows || updatedRows.length === 0) {
        console.error('【エラー】スコアを保存できませんでした（更新0件）', { context, recordId, table: targetTable })
        return NextResponse.json({ error: '保存先の記録が見つかりません' }, { status: 500 })
      }
      console.log('【成功】スコアを保存しました', { context, recordId, table: targetTable })
    }

    // コーチング対象（スコア1・2）かどうかで、問いかけと完了フラグを決める
    const coaching = withCoaching && needsCoaching(score)
    const coachingQuestion = coaching ? asText(scoringResult.coaching_question) : ''
    // 問いかけが作れなかった場合は、対話を始めず完了扱いにする
    const isCompleted = !(coaching && coachingQuestion)

    return NextResponse.json(
      { score, feedback, coaching_question: coachingQuestion, is_completed: isCompleted },
      { status: 200 }
    )
  } catch (err) {
    console.error('【エラー】Scoring API 全体エラー:', err)
    return NextResponse.json({ error: '内部エラー' }, { status: 500 })
  }
}
