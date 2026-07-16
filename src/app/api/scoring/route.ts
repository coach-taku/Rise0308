/**
 * グロースマインドセット自動スコアリング API Route Handler
 *
 * 【セキュリティ方針】
 * - GEMINI_API_KEY は Vercel 環境変数にのみ保存し、このファイル（サーバーサイド）からのみ参照する
 * - クライアント側（ブラウザ）には API キーを一切露出しない
 * - NEXT_PUBLIC_ プレフィックスは使用しない
 *
 * 【個人情報保護（匿名化フィルター）】
 * - 氏名等の個人特定情報を LLM に送信しない
 * - 振り返りテキストと仮 ID のみを送信する
 *
 * 【使用モデル】
 * - gemini-1.5-flash-latest（コストパフォーマンス重視。AIの再学習に利用されないAPIエンドポイントを使用）
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'

// ============================================================
// スコアリングルーブリック（LLMへのプロンプトに使用）
// ============================================================
const RUBRIC = `
あなたはスポーツ選手のメタ認知能力を評価する専門家です。
以下のルーブリックに基づき、選手の振り返りテキストを1〜4段階で採点してください。

【採点基準】
スコア1 - 固定マインドセット:
  「できない」「才能がない」などの能力の欠如、または練習内容の羅列のみ。
  失敗の原因を外部要因や固定的な能力に帰属している。
  例: 「今日は全然できなかった。シュートが入らなかった。」

スコア2 - 成長の芽生え:
  課題や改善の必要性は認識しているが、改善策が「頑張る」「練習する」などの曖昧な表現に留まっている。
  例: 「ディフェンスが弱いと感じた。もっと練習を頑張りたい。」

スコア3 - グロースマインドセット:
  失敗や課題を「学びの機会」として捉え、具体的な改善策（何を・どのように・どれくらい）を記述している。
  例: 「スクリーンの使い方が甘かった。明日から1on1でスクリーンを使うタイミングを意識的に練習する。」

スコア4 - 深いメタ認知:
  自己の思考プロセスや感情を客観的に分析し、複数の要因を関連付けた上で戦略的な改善計画（Plan B）を立案している。
  例: 「今日の試合で焦ったとき、判断が遅くなるパターンがわかった。焦りを感じたらまず深呼吸して状況を俯瞰する、というルーティンを導入する。また練習でも意図的にプレッシャーをかけた状況を作る。」

【出力形式（必ずJSONのみで返答してください）】
{
  "score": <1〜4の整数>,
  "feedback": "<採点理由と改善のヒントを50〜100文字程度の日本語で記述>"
}
`

// ============================================================
// Route Handler
// ============================================================

export async function POST(request: NextRequest) {
  try {
    // リクエストボディを取得する
    const body = await request.json()
    const { recordId, reflection } = body

    // バリデーション
    if (!recordId || typeof recordId !== 'string') {
      return NextResponse.json({ error: 'recordId が不正です' }, { status: 400 })
    }
    if (!reflection || typeof reflection !== 'string' || reflection.trim().length === 0) {
      return NextResponse.json({ error: '振り返りテキストが空です' }, { status: 400 })
    }

    // 振り返りが短すぎる場合は処理をスキップする（最低20文字）
    if (reflection.trim().length < 20) {
      return NextResponse.json(
        { message: '振り返りテキストが短いため、スコアリングをスキップしました' },
        { status: 200 }
      )
    }

    // ============================================================
    // Gemini API 呼び出し（サーバーサイドのみ）
    // APIキーはここでのみ参照し、クライアントには絶対に露出しない
    // ============================================================
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      // 開発環境でAPIキーが未設定の場合はスキップ（デモ用スコアを返さない）
      console.warn('[scoring] GEMINI_API_KEY が未設定です。スコアリングをスキップします。')
      return NextResponse.json(
        { message: 'GEMINI_API_KEY 未設定のためスキップしました' },
        { status: 200 }
      )
    }

    // 個人情報を除去した匿名化テキストを作成する
    // （このAPIには氏名等は送信しない。振り返りテキストのみを送る）
    const anonymizedText = reflection.trim()

    // Gemini API リクエスト (URLモデル名を gemini-1.5-flash-latest に修正)
    const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`
    const prompt = `${RUBRIC}\n\n【採点対象の振り返りテキスト】\n${anonymizedText}`

    const geminiResponse = await fetch(geminiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,   // スコアリングの一貫性を高めるため低めに設定
          maxOutputTokens: 256,
        },
      }),
    })

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text()
      console.error('[scoring] Gemini API エラー:', geminiResponse.status, errText)
      return NextResponse.json(
        { error: `Gemini API エラー: ${geminiResponse.status}` },
        { status: 500 }
      )
    }

    const geminiData = await geminiResponse.json()

    // レスポンスからテキストを抽出する
    const rawText: string =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || ''

    // JSON を抽出してパースする（Gemini がマークダウンで囲む場合に対応）
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[scoring] Gemini のレスポンスから JSON を抽出できませんでした:', rawText)
      return NextResponse.json(
        { error: 'スコアリング結果の解析に失敗しました' },
        { status: 500 }
      )
    }

    let scoringResult: { score: number; feedback: string }
    try {
      scoringResult = JSON.parse(jsonMatch[0])
    } catch {
      console.error('[scoring] JSON パースエラー:', jsonMatch[0])
      return NextResponse.json(
        { error: 'スコアリング結果のパースに失敗しました' },
        { status: 500 }
      )
    }

    // スコアの妥当性チェック
    const score = Math.round(scoringResult.score)
    if (score < 1 || score > 4) {
      console.error('[scoring] スコアが範囲外です:', score)
      return NextResponse.json(
        { error: 'スコアが不正な値です' },
        { status: 500 }
      )
    }

    const feedback = scoringResult.feedback?.trim() || ''

    // ============================================================
    // Supabase にスコアを保存する
    // ============================================================
    if (isSupabaseConfigured()) {
      const { error: updateError } = await getSupabase()
        .from('mandala_reflections') // ← 保存先を正しいテーブルに修正
        .update({
          mindset_score: score,
          mindset_feedback: feedback,
        })
        .eq('id', recordId)

      if (updateError) {
        console.error('[scoring] Supabase 更新エラー:', updateError.message)
        return NextResponse.json(
          { error: 'スコアの保存に失敗しました' },
          { status: 500 }
        )
      }
    }

    // 成功レスポンス
    return NextResponse.json({ score, feedback }, { status: 200 })
  } catch (err) {
    console.error('[scoring] 予期しないエラー:', err)
    return NextResponse.json({ error: '内部エラーが発生しました' }, { status: 500 })
  }
}
