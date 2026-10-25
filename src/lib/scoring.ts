/**
 * スコアリング・AIコーチング共通の定義（サーバーサイド専用）
 */

// 採点ルーブリック（スコアリングAPI・コーチングAPIで共通利用）
export const RUBRIC_TEXT = `
【採点基準】
スコア1: 固定マインドセット（能力帰属のみ）
スコア2: 成長の芽生え（曖昧な改善策）
スコア3: グロースマインドセット（具体的な改善策）
スコア4: 深いメタ認知（戦略的なプランB）
`

// コーチング問いかけの方針（要件定義書 3.3 ①）
export const COACH_GUIDE = `
【あなたの役割】
あなたはスポーツ選手の成長を促すメンタルコーチです。
【姿勢】
- 共感して受け止めたうえで、オープンクエスチョン（「はい／いいえ」で答えられない問い）を1つだけ投げかける。
- 説教・否定・指示・答えの提示は絶対にしない。選手が自分で考えて答えを出せるように導く。
- 問いかけは日本語で、高校生にも分かる言葉で、80文字以内にする。
【問いかけの例】
- スコア1の場合: 「今日うまくいかなかった原因に対して、自分にできる工夫や行動は何がありそうですか？」
- スコア2の場合: 「素晴らしい気づきですね！それを次回の練習で実践するために、具体的にどんな行動から始めてみますか？」
- すでに具体策がある場合（プランB誘発）: 「もしそれがうまくいかなかった場合、他にどんな試みができそうですか？」
`

// 保存先テーブルの対応表（context の値 → テーブル名）
// "daily"              : デイリーノート → daily_records
// "mandala_reflection" : マンダラ振り返り → mandala_reflections
export const TARGET_TABLES = {
  daily: 'daily_records',
  mandala_reflection: 'mandala_reflections',
} as const
export type ScoringContext = keyof typeof TARGET_TABLES

export function isScoringContext(value: unknown): value is ScoringContext {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(TARGET_TABLES, value)
}

// スコアを 1〜4 の整数にそろえる
export function normalizeScore(raw: unknown): 1 | 2 | 3 | 4 {
  const n = Number(raw) || 1
  return Math.max(1, Math.min(4, Math.round(n))) as 1 | 2 | 3 | 4
}

// AIが返した文字列を安全に取り出す（文字列以外は空文字）
export function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

// コーチングを開始する対象かどうか（スコア1・2）
export function needsCoaching(score: number): boolean {
  return score <= 2
}

// 深掘り対話の最大往復数（要件定義書 3.2）
export const MAX_COACHING_TURNS = 3
