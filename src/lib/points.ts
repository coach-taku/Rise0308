// Positive word dictionary for point calculation
const POSITIVE_WORDS = [
  '頑張', 'がんば', 'ガンバ', 'できた', '出来た', 'できる', '出来る',
  '成長', '上達', '改善', '向上', '達成', '克服', 'チャレンジ',
  '挑戦', '意識', '集中', '楽しい', '楽しかった', '嬉しい', '嬉しかった',
  '良かった', 'よかった', 'いい感じ', '手応え', 'ナイス', 'いいね',
  '全力', '努力', '積極的', '前向き', 'ポジティブ', '自信',
  '感謝', 'ありがとう', '仲間', 'チーム', '協力', '連携',
  '次こそ', '明日は', '次は', 'もっと', '伸び', '成果',
  'ベスト', '最高', 'すごい', 'やった', 'OK', 'GOOD',
  '発見', '気づ', '学び', '学んだ', '理解', 'わかった',
  '体力', 'スタミナ', 'スピード', 'パス', 'シュート', 'ディフェンス',
  '絶対', '必ず', 'きっと', '信じ', '諦めない', 'あきらめない',
]

export function calculatePoints(text: string): number {
  if (!text || text.trim().length === 0) return 0

  let points = 1 // Base point for writing something

  const matchedWords = new Set<string>()
  for (const word of POSITIVE_WORDS) {
    if (text.includes(word) && !matchedWords.has(word)) {
      matchedWords.add(word)
      points += 2
    }
  }

  // Bonus for longer reflections (showing effort)
  if (text.length > 100) points += 1
  if (text.length > 300) points += 2
  if (text.length > 500) points += 3

  return Math.min(points, 30) // Cap at 30 points per entry
}

export function getPointMessage(points: number): string {
  if (points >= 20) return '素晴らしい振り返り! ポジティブなエネルギーに溢れています!'
  if (points >= 15) return 'とても良い振り返り! 前向きな姿勢が伝わります!'
  if (points >= 10) return '良い振り返り! 自分の成長をしっかり見つめていますね!'
  if (points >= 5) return 'ナイス! 振り返りを続けることが成長の鍵です!'
  return '記録おつかれさま! 明日も一緒に頑張ろう!'
}
