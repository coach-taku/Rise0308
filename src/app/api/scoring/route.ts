/**
 * グロースマインドセット自動スコアリング API Route Handler
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'

const RUBRIC = `
あなたはスポーツ選手のメタ認知能力を評価する専門家です。
以下のルーブリックに基づき、選手の振り返りテキストを1〜4段階で採点してください。
【採点基準】
スコア1: 固定マインドセット（能力帰属のみ）
スコア2: 成長の芽生え（曖昧な改善策）
スコア3: グロースマインドセット（具体的な改善策）
スコア4: 深いメタ認知（戦略的なプランB）
【出力形式】
{ "score": <1-4>, "feedback": "<日本語で50-100文字>" }
`

// 保存先テーブルの対応表（context の値 → テーブル名）
// "daily"              : デイリーノート → daily_records
// "mandala_reflection" : マンダラ振り返り → mandala_reflections
const TARGET_TABLES = {
  daily: 'daily_records',
  mandala_reflection: 'mandala_reflections',
} as const
type ScoringContext = keyof typeof TARGET_TABLES

function isScoringContext(value: unknown): value is ScoringContext {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(TARGET_TABLES, value)
}

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

    // 振り返りが短い場合、または保存先の行IDがない場合はスキップ
    if (!recordId || typeof reflection !== 'string' || reflection.trim().length < 20) {
      console.log('【スキップ】振り返りが20文字未満、または recordId がありません', { context });
      return NextResponse.json({ message: 'スキップしました' }, { status: 200 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.error('【エラー】GEMINI_API_KEYが設定されていません');
      return NextResponse.json({ message: 'APIキー未設定' }, { status: 200 })
    }

    const prompt = `${RUBRIC}\n\n【振り返りテキスト】\n${reflection.trim()}`
    
    const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'
    // APIキーはURLに含めずヘッダーで渡す（ログ等にキーが残らないようにするため）
    const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

    console.log(`Gemini APIにリクエストを送信中... (model: ${model})`);
    const geminiResponse = await fetch(geminiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingLevel: 'minimal' },
        },
      }),
    })

    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.text()
      console.error(`【エラー】Gemini APIの通信に失敗しました: ${geminiResponse.status}`, errorBody.slice(0, 500));
      return NextResponse.json({ error: 'Gemini Error' }, { status: 500 })
    }

    const geminiData = await geminiResponse.json()
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    
    // AIが不要な記号(```json や ```)をつけてきた場合に取り除く処理
    const cleanText = rawText.replace(/```json/gi, '').replace(/```/gi, '').trim();

    let scoringResult;
    try {
      scoringResult = JSON.parse(cleanText)
    } catch (parseError) {
      // AIの回答には振り返りの内容が含まれる可能性があるため、本文はログに出さず文字数だけ記録する
      console.error('【エラー】JSONの変換に失敗しました。AIの回答の文字数:', cleanText.length);
      return NextResponse.json({ error: 'データ解析エラー' }, { status: 500 })
    }
    
    // スコアが確実に1〜4の整数になるようにバリデーション
    const rawScore = Number(scoringResult.score) || 1
    const score = Math.max(1, Math.min(4, Math.round(rawScore)))
    console.log(`【成功】スコア計算完了: ${score}点`);

    if (isSupabaseConfigured()) {
      // 更新された行を返してもらい、実際に保存できたか件数を確認する
      const { data: updatedRows, error: supabaseError } = await getSupabase()
        .from(targetTable)
        .update({
          mindset_score: score,
          mindset_feedback: scoringResult.feedback?.trim() || '',
        })
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

    return NextResponse.json({ score, feedback: scoringResult.feedback }, { status: 200 })
  } catch (err) {
    console.error('【エラー】Scoring API 全体エラー:', err)
    return NextResponse.json({ error: '内部エラー' }, { status: 500 })
  }
}
