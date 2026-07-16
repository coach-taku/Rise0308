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
  try {
    const body = await request.json()
    const { recordId, reflection } = body

    if (!recordId || !reflection || reflection.trim().length < 20) {
      return NextResponse.json({ message: 'スキップしました' }, { status: 200 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return NextResponse.json({ message: 'APIキー未設定' }, { status: 200 })

    const prompt = `${RUBRIC}\n\n【振り返りテキスト】\n${reflection.trim()}`
    const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`

    const geminiResponse = await fetch(geminiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 256 },
      }),
    })

    if (!geminiResponse.ok) return NextResponse.json({ error: 'Gemini Error' }, { status: 500 })

    const geminiData = await geminiResponse.json()
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || ''

    // JSON抽出処理（修正版）
    const cleanedText = rawText.replace(/```json/g, '').replace(/```/g, '').trim()
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/)
    
    if (!jsonMatch) return NextResponse.json({ error: '解析失敗' }, { status: 500 })

    const scoringResult = JSON.parse(jsonMatch[0])
    const score = Math.round(scoringResult.score)

    if (isSupabaseConfigured()) {
      await getSupabase()
        .from('mandala_reflections')
        .update({
          mindset_score: score,
          mindset_feedback: scoringResult.feedback?.trim() || '',
        })
        .eq('id', recordId)
    }

    return NextResponse.json({ score, feedback: scoringResult.feedback }, { status: 200 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: '内部エラー' }, { status: 500 })
  }
}
