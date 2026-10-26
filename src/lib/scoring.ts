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

// レベルごとの表示用ラベル・解説（選手に見せる文言。要件定義書 3.2）
export const LEVEL_INFO: Record<1 | 2 | 3 | 4, { label: string; description: string }> = {
  1: {
    label: 'レベル1（できごとの振り返り）',
    description: '今日のできごとや気持ちを言葉にできています。次は「なぜそうなったか」を考えてみよう。',
  },
  2: {
    label: 'レベル2（課題への気づき）',
    description: '課題に気づけています。次は「具体的に何をするか」まで考えてみよう。',
  },
  3: {
    label: 'レベル3（原因分析と具体的改善策）',
    description: '原因を分析して、具体的な改善策まで書けています。次は他の場面でも使える形にしてみよう。',
  },
  4: {
    label: 'レベル4（深い自己理解と戦略的プラン）',
    description: '自分の考え方まで客観的に見つめ、うまくいかない時のプランBまで考えられています。',
  },
}

// スコアからレベル表示用の情報を作る
export function getLevelInfo(score: number) {
  const level = normalizeScore(score)
  return { level, level_label: LEVEL_INFO[level].label, level_description: LEVEL_INFO[level].description }
}

// コーチング問いかけの方針（要件定義書 3.1・3.3 ①）
// レベル1〜4のすべてで、問いかけと自己肯定感を高めるフィードバックを行う
export const COACH_GUIDE = `
【あなたの役割】
あなたはスポーツ選手の成長を促すメンタルコーチです。毎日振り返りを書く選手に、レベルに合わせて伴走します。
【問いかけの姿勢】
- 共感して受け止めたうえで、オープンクエスチョン（「はい／いいえ」で答えられない問い）を1つだけ投げかける。
- 説教・否定・指示・答えの提示は絶対にしない。選手が自分で考えて答えを出せるように導く。
- 問いかけは日本語で、高校生にも分かる言葉で、80文字以内にする。
【レベル別の問いかけ】
- レベル1〜2: 受け止めたうえで、原因・具体性・改善策を引き出す問いかけをする。
  例（1）: 「今日うまくいかなかった原因に対して、自分にできる工夫や行動は何がありそうですか？」
  例（2）: 「素晴らしい気づきですね！それを次回の練習で実践するために、具体的にどんな行動から始めてみますか？」
- レベル3〜4: 良い振り返りをしっかり認めたうえで、さらに深める問いかけをする。終わらせてはいけない。
  例: 「その成功パターンを、他の場面で再現するにはどうしたらいいと思いますか？」
  例: 「次の試合で試してみたい工夫は何ですか？」
  例: 「もしそれがうまくいかなかった場合、他にどんな試みができそうですか？」
`

// 自己肯定感を高めるフィードバックの書き方（要件定義書 3.3）
export const FEEDBACK_GUIDE = `
【feedback（選手へのフィードバック）の書き方】
次の3つを自然な文章でつなげて、日本語で80〜150文字にまとめる。レベルが低くても必ず前向きに書く。
1. 承認・称賛: 毎日振り返りを続けていること、自分の言葉で表現できたことをほめる。
2. 気づきの肯定: 選手が見つけた変化や感情、気づきを具体的に肯定する（レベルの高低で態度を変えない）。
3. 自己肯定感アップのひとこと: 「自分の強みに気づけていますね！」「この経験は必ず次に活きますよ！」のような前向きな言葉を必ず入れる。
否定的な言葉や、できていない点の指摘はfeedbackに書かない（課題は問いかけで引き出す）。
`

// AIが feedback を返さなかった場合の代わりの文章（自己肯定感を下げないため必ず何か表示する）
export const FALLBACK_FEEDBACK =
  '毎日振り返りを続けていて素晴らしいです！自分の言葉で気づきを書けているのは大きな強みですね。この経験は必ず次に活きますよ！'

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

// 深掘り対話の最大往復数（要件定義書 3.1）
export const MAX_COACHING_TURNS = 3
