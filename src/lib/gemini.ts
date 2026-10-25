/**
 * Gemini API 呼び出しの共通処理（サーバーサイド専用）
 * APIキーはサーバーの環境変数（Vercel）からのみ読み取り、ブラウザには出さない。
 */

export class GeminiNotConfiguredError extends Error {
  constructor() {
    super('GEMINI_API_KEY が設定されていません')
  }
}

/**
 * プロンプトを送り、JSONとして解釈した結果を返す。
 * 失敗時は例外を投げる（本文はログに出さない）。
 */
export async function callGeminiJson(prompt: string): Promise<Record<string, unknown>> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new GeminiNotConfiguredError()

  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'
  // APIキーはURLに含めずヘッダーで渡す（ログ等にキーが残らないようにするため）
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

  const res = await fetch(endpoint, {
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

  if (!res.ok) {
    const errorBody = await res.text()
    throw new Error(`Gemini API error: ${res.status} ${errorBody.slice(0, 300)}`)
  }

  const data = await res.json()
  const rawText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
  // AIが ```json などの記号をつけてきた場合に取り除く
  const cleanText = rawText.replace(/```json/gi, '').replace(/```/gi, '').trim()

  try {
    return JSON.parse(cleanText)
  } catch {
    // 回答に振り返りの内容が含まれる可能性があるため、本文はログに出さない
    throw new Error(`Gemini の回答をJSONに変換できませんでした（${cleanText.length}文字）`)
  }
}
