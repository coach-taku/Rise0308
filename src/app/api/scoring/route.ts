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

export async function POST(request: NextRequest) {
  console.log('[/api/scoring] 1. 処理開始')

  try {
    const body = await request.json()
    const { recordId, reflection } = body

    // 振り返りが短い場合はスキップ
    if (!recordId || !reflection || reflection.trim().length < 20) {
      console.log('[/api/scoring] スキップ条件に該当 (recordId未指定 or 振り返り文字数不足)')
      return NextResponse.json({ message: 'スキップしました' }, { status: 200 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.warn('[/api/scoring] GEMINI_API_KEY が未設定のためスキップ')
      return NextResponse.json({ message: 'APIキー未設定' }, { status: 200 })
    }

    const prompt = `${RUBRIC}\n\n【振り返りテキスト】\n${reflection.trim()}`

    // 正しいエンドポイントURL（APIキーはクエリに含まれるためログ出力しない）
    const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`

    console.log('[/api/scoring] 2. Gemini API 呼び出し開始')

    let geminiStatus: number
    let geminiText: string

    try {
      const geminiResponse = await fetch(geminiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 256,
            responseMimeType: 'application/json',
          },
        }),
      })

      geminiStatus = geminiResponse.status
      // JSONパース前に生テキストとして取得することで、パース失敗を区別できるようにする
      geminiText = await geminiResponse.text()

      console.log(`[/api/scoring] 3. Gemini API Status: ${geminiStatus}`)

      if (!geminiResponse.ok) {
        // APIキーや個人情報を含まないレスポンス本文のみログ出力
        console.error(`[/api/scoring] 4. Gemini API Error Response: ${geminiText}`)
        throw new Error(`Gemini API error. Status: ${geminiStatus}, Body: ${geminiText}`)
      }
    } catch (fetchError) {
      // fetch自体が例外になった場合（ネットワークエラー等）
      console.error('[/api/scoring] 5. Gemini API fetch 例外:', fetchError)
      throw fetchError
    }

    // ---- Gemini API 成功後の後続処理 ----
    let geminiData: unknown
    try {
      geminiData = JSON.parse(geminiText)
      console.log('[/api/scoring] 6. Gemini API レスポンスの JSON パース成功')
    } catch (parseError) {
      console.error('[/api/scoring] 6-ERR. Gemini API レスポンスの JSON パース失敗:', parseError)
      console.error('[/api/scoring] 6-ERR. パース対象の生テキスト (先頭200文字):', geminiText.slice(0, 200))
      throw new Error(`Gemini レスポンスの JSON パースに失敗しました: ${parseError}`)
    }

    const rawText =
      (geminiData as { candidates?: { content?: { parts?: { text?: string }[] } }[] })
        ?.candidates?.[0]?.content?.parts?.[0]?.text || '{}'

    let scoringResult: { score?: unknown; feedback?: string }
    try {
      scoringResult = JSON.parse(rawText)
      console.log('[/api/scoring] 7. スコアリング結果の JSON パース成功')
    } catch (innerParseError) {
      console.error('[/api/scoring] 7-ERR. スコアリング結果の JSON パース失敗:', innerParseError)
      console.error('[/api/scoring] 7-ERR. パース対象テキスト:', rawText)
      throw new Error(`スコアリング結果の JSON パースに失敗しました: ${innerParseError}`)
    }

    // スコアが確実に1〜4の整数になるようにバリデーション
    const rawScore = Number(scoringResult.score) || 1
    const score = Math.max(1, Math.min(4, Math.round(rawScore)))

    if (isSupabaseConfigured()) {
      // Supabaseの更新処理とエラーチェック
      const { error: supabaseError } = await getSupabase()
        .from('mandala_reflections')
        .update({
          mindset_score: score,
          mindset_feedback: scoringResult.feedback?.trim() || '',
        })
        .eq('id', recordId)

      if (supabaseError) {
        console.error('[/api/scoring] 8-ERR. Supabase Update Error:', supabaseError)
        return NextResponse.json({ error: 'DB更新エラー' }, { status: 500 })
      }
    }

    console.log(`[/api/scoring] 9. 処理完了 score=${score}`)
    return NextResponse.json({ score, feedback: scoringResult.feedback }, { status: 200 })

  } catch (error) {
    // 最終的にキャッチされた例外をスタックトレースごと記録
    console.error('[/api/scoring] 10. キャッチされた例外 (根本原因):', error)
    return NextResponse.json({ error: '内部エラー' }, { status: 500 })
  }
}
