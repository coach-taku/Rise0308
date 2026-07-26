import { User, Tournament, MandalaChart, MandalaReflection, GoalUpdatePhase, DailyRecord, DailyRecordWithUser, Comment, PhysicalRecord, MaxTrainingRecord, PracticeSession, GameStat, CsvStatRow, EvaluationQuestion, EvaluationTask, EvaluationAnswer, EvaluationDelivery, EvaluationPair, EvaluationGroup, EvaluationGroupMember, SscPlan } from '@/types/database'
import { getSupabase, isSupabaseConfigured } from './supabase'

// ============================================================
// Demo data (used when Supabase is not configured)
// ============================================================

const DEMO_USERS: User[] = [
  { id: 'player-1', name: '山田 花子', role: 'player', password: 'rise' },
  { id: 'player-2', name: '鈴木 美咲', role: 'player', password: 'rise' },
  { id: 'player-3', name: '佐藤 遥', role: 'player', password: 'rise' },
  { id: 'player-4', name: '田中 結衣', role: 'player', password: 'rise' },
  { id: 'staff-1', name: '高橋 コーチ', role: 'staff', password: 'rise' },
  { id: 'staff-2', name: '伊藤 監督', role: 'staff', password: 'rise' },
]

const DEMO_TOURNAMENTS: Tournament[] = [
  { id: 'tournament-1', name: 'インターハイ予選', target_date: '2026-06-15' },
]

function generateDemoRecords(): DailyRecord[] {
  const records: DailyRecord[] = []
  const players = ['player-1', 'player-2', 'player-3', 'player-4']
  const goals = [
    ['ディフェンスの姿勢を低くする', 'レイアップの精度を上げる', 'パスを素早く出す'],
    ['スクリーンアウトを徹底する', 'フリースローの練習を毎日する', 'チームメイトに声を出す'],
    ['速攻時の判断を早くする', '3ポイントの練習量を増やす', 'ドリブルのスキルアップ'],
    ['体力をつける', 'ルーズボールに飛び込む', 'コミュニケーションを増やす'],
  ]
  const reflections = [
    '今日はディフェンスの姿勢を意識して練習できた。最初は疲れてフォームが崩れたけど、後半は維持できるようになった。成長を感じて嬉しかった!',
    'パスの練習で、チームメイトとの連携がうまくいった。声を出して全力で取り組めた。明日はもっとスピードを上げたい。',
    'シュート練習で集中できた。10本中7本入って手応えがあった。この調子で頑張りたい!',
    '体調があまり良くなかったけど、できる範囲で努力した。仲間の応援が力になった。感謝の気持ちを忘れずに明日も挑戦する。',
    'フリースロー20本中15本成功! 達成感があった。コーチのアドバイスのおかげで改善できた。',
    '今日はあまりうまくいかない日だったけど、こういう日もある。次こそはもっと良い練習にしたい。',
  ]
  const statuses: DailyRecord['participation_status'][] = ['参加', '参加', '参加', '参加', '参加', 'リハビリ', '参加', 'REST']

  const now = new Date()
  // デモデータは過去60日分を生成する（14日で止まる問題を解消するため拡張）
  for (let dayOffset = 60; dayOffset >= 0; dayOffset--) {
    const date = new Date(now)
    date.setDate(date.getDate() - dayOffset)
    const dateStr = date.toISOString().split('T')[0]

    for (let pi = 0; pi < players.length; pi++) {
      if (Math.random() < 0.15) continue

      const sleepHours = 5.5 + Math.random() * 3
      const fatigue = Math.floor(Math.random() * 7) + 2
      const hasPain = Math.random() < 0.15
      const evaluation = Math.floor(Math.random() * 5) + 5
      const reflectionIdx = Math.floor(Math.random() * reflections.length)
      const statusIdx = Math.floor(Math.random() * statuses.length)
      const earnedPoints = Math.floor(Math.random() * 15) + 3

      records.push({
        id: `record-${dateStr}-${pi}`,
        user_id: players[pi],
        record_date: dateStr,
        sleep_hours: Math.round(sleepHours * 10) / 10,
        fatigue_level: fatigue,
        has_pain: hasPain,
        pain_detail: hasPain ? '右膝に軽い違和感' : '',
        participation_status: statuses[statusIdx],
        target_items: goals[pi].slice(0, Math.floor(Math.random() * 2) + 1),
        self_evaluation: evaluation,
        reflection: reflections[reflectionIdx],
        points: earnedPoints,
        created_at: date.toISOString(),
      })
    }
  }
  return records
}

function generateDemoComments(records: DailyRecord[]): Comment[] {
  const comments: Comment[] = []
  const commentTexts = [
    'ナイス!一緒に頑張ろう!',
    'すごい!成長してるね!',
    'その調子で明日も頑張ろう!',
    '今日の練習、良かったよ!',
    'ディフェンス、上手くなってきたね!',
  ]
  const recentRecords = records.slice(-8)
  recentRecords.forEach((record, idx) => {
    if (Math.random() < 0.4) {
      const commenterId = record.user_id === 'player-1' ? 'player-2' : 'player-1'
      comments.push({
        id: `comment-${idx}`,
        daily_record_id: record.id,
        user_id: commenterId,
        content: commentTexts[Math.floor(Math.random() * commentTexts.length)],
        created_at: record.created_at,
      })
    }
    if (Math.random() < 0.3) {
      comments.push({
        id: `comment-staff-${idx}`,
        daily_record_id: record.id,
        user_id: 'staff-1',
        content: '良い振り返りだね。その意識を続けていこう!',
        created_at: record.created_at,
      })
    }
  })
  return comments
}

const DEMO_MANDALA: MandalaChart = {
  id: 'mandala-1',
  user_id: 'player-1',
  core_goal: 'インターハイ出場',
  elements: [
    'シュート力', 'ディフェンス', '体力', 'パス・連携',
    'メンタル', '知識・戦術', 'チームワーク', '生活習慣'
  ],
  actions: [
    ['レイアップ精度UP', 'ミドルシュート練習', '3Pシュート挑戦', 'フリースロー成功率UP', 'シュートフォーム確認', 'ゲームでのシュート判断', '毎日シュート100本', 'シュートの自信をつける'],
    ['1on1で負けない', 'スライドステップ強化', 'ボールマンプレッシャー', 'ヘルプディフェンス', 'スクリーンアウト', 'ローテーション理解', 'コミュニケーション', 'ディフェンスの姿勢維持'],
    ['持久走タイム向上', '体幹トレーニング毎日', '下半身強化', 'アジリティ向上', 'ストレッチ習慣化', '食事管理', 'ランニング週3回', '疲労回復意識'],
    ['ノールックパス練習', 'バウンドパス精度', 'ロングパス', '速攻時の判断', 'ピック&ロール連携', 'アシスト意識', '2on1の判断', 'パスフェイク'],
    ['試合で緊張しない', 'ミスを引きずらない', '声を出す', '自信を持つ', 'チームを鼓舞する', 'ポジティブ思考', 'イメージトレーニング', 'ルーティン確立'],
    ['相手チーム分析', 'NBA動画研究', 'セットプレー理解', 'ゾーンディフェンス対策', 'プレスブレイク', 'タイムアウト後の動き', 'ルール完全理解', '戦術ノート作成'],
    ['仲間を褒める', '弱点を補い合う', '練習中の声かけ', 'ベンチからの応援', '後輩の面倒を見る', '先輩に学ぶ', '全員で目標共有', '信頼関係構築'],
    ['早寝早起き', '栄養バランス', '水分補給', '睡眠7時間以上', '学業との両立', '時間管理', 'ケガ予防', '体重管理'],
  ],
  target_date: '2026-06-15',
  created_at: '2026-01-15T00:00:00Z',
}

// In-memory demo store
let demoRecords = generateDemoRecords()
let demoComments = generateDemoComments(demoRecords)
const demoUsers = [...DEMO_USERS]
const demoTournaments = [...DEMO_TOURNAMENTS]
let demoMandala: Record<string, MandalaChart> = { 'player-1': DEMO_MANDALA }

// ============================================================
// デモ用アーカイブ・振り返りデータ
// ============================================================
/** デモ用アーカイブ済みマンダラチャート */
let demoMandalaArchives: MandalaChart[] = [
  {
    id: 'mandala-archive-1',
    user_id: 'player-1',
    core_goal: '新人大会ベスト8進出',
    elements: ['シュート力', 'ディフェンス', '体力', 'パス・連携', 'メンタル', '知識・戦術', 'チームワーク', '生活習慣'],
    actions: [
      ['フリースロー成功率80%', 'ミドルシュート改善', '3P練習', '毎日100本シュート', 'フォーム確認', 'ゲームでの判断', '自信をつける', 'シュート統計記録'],
      ['1on1強化', 'スライドステップ', 'ヘルプDF', 'コミュニケーション', 'スクリーンアウト', 'ローテーション', 'DF意識向上', 'ポジショニング'],
      ['持久走5km', '体幹毎日', '下半身強化', 'アジリティ', 'ストレッチ', '食事管理', 'ランニング', '疲労回復'],
      ['パス精度UP', 'バウンドパス', 'ロングパス', '速攻判断', 'ピック連携', 'アシスト意識', '2on1判断', 'パスフェイク'],
      ['試合集中', 'ミス引きずらない', '声出し', '自信', 'チーム鼓舞', 'ポジティブ', 'イメトレ', 'ルーティン'],
      ['相手分析', 'NBA動画', 'セットプレー', 'ゾーンDF対策', 'プレスブレイク', 'タイムアウト後', 'ルール理解', '戦術ノート'],
      ['仲間を褒める', '弱点補い合う', '練習中声かけ', 'ベンチ応援', '後輩面倒', '先輩から学ぶ', '目標共有', '信頼構築'],
      ['早寝早起き', '栄養バランス', '水分補給', '睡眠7時間', '学業両立', '時間管理', 'ケガ予防', '体重管理'],
    ],
    target_date: '2026-01-20',
    created_at: '2025-10-01T00:00:00Z',
    term_label: '2026年 新人大会埼玉県予選',
    status: 'archived',
    archived_at: '2026-01-21T00:00:00Z',
  },
]

/** デモ用振り返りデータ */
let demoReflections: MandalaReflection[] = [
  {
    id: 'reflection-1',
    user_id: 'player-1',
    mandala_chart_id: 'mandala-archive-1',
    term_label: '2026年 新人大会埼玉県予選',
    achievement_note: 'フリースロー成功率が目標の80%に届かなかったが、ゲーム中の判断力は向上した。チームとしてベスト16まで進めた。',
    challenges: 'プレッシャー場面でのシュートが弱い。ディフェンスの連携がまだ不十分。',
    plan_b: 'プレッシャーシュート練習を週3回取り入れる。コミュニケーション練習を毎回の練習後に実施する。',
    mindset_score: 3,
    mindset_feedback: '失敗を学びに変える視点が持てています。Plan Bも具体的で実行可能です。',
    created_at: '2026-01-21T00:00:00Z',
  },
]

/** デモ用目標更新フェーズデータ */
let demoGoalUpdatePhases: GoalUpdatePhase[] = []

// ============================================================
// Data access functions
// ============================================================

export async function getUsers(): Promise<User[]> {
  // Supabase が未設定の場合はデモデータを返す
  if (!isSupabaseConfigured()) {
    console.info('[data] Supabase 未設定のためデモユーザーを返します。')
    return demoUsers
  }

  try {
    const { data, error } = await getSupabase().from('users').select('*').order('name')
    if (error) {
      // エラー内容をコンソールに詳しく出力する
      console.error('[data] getUsers() でエラーが発生しました:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      })
      throw error
    }
    if (!data || data.length === 0) {
      console.warn('[data] getUsers() の結果が空です。Supabase の users テーブルにデータが登録されているか確認してください。')
    }
    return data || []
  } catch (err) {
    console.error('[data] getUsers() で予期しないエラーが発生しました:', err)
    throw err
  }
}

export async function getUser(userId: string): Promise<User | null> {
  if (!isSupabaseConfigured()) return demoUsers.find(u => u.id === userId) || null
  const { data, error } = await getSupabase().from('users').select('*').eq('id', userId).maybeSingle()
  if (error) {
    console.error('[data] getUser() でエラーが発生しました:', error.message)
    return null
  }
  return data
}

export async function loginUser(name: string, password: string): Promise<User | null> {
  // Supabase が未設定の場合はデモデータで照合する
  if (!isSupabaseConfigured()) {
    return demoUsers.find(u => u.name === name && u.password === password) || null
  }

  try {
    const { data, error } = await getSupabase()
      .from('users')
      .select('*')
      .eq('name', name)
      .eq('password', password)
      .maybeSingle()
    if (error) {
      console.error('[data] loginUser() でエラーが発生しました:', {
        message: error.message,
        code: error.code,
      })
      return null
    }
    // data が null の場合は名前または合言葉が違う
    if (!data) return null
    return data
  } catch (err) {
    console.error('[data] loginUser() で予期しないエラーが発生しました:', err)
    return null
  }
}

export async function logoutUser(): Promise<void> {
  // clearSession は session.ts に一元化されているが、
  // data.ts 単体でも動作するようフォールバックを残す
  if (typeof window !== 'undefined') {
    localStorage.removeItem('rise_note_session')
  }
}

// ============================================================
// ユーザー管理（管理者向けCRUD）
// ============================================================

/**
 * 新規ユーザー（選手・スタッフ）を登録する
 * 管理者画面からのみ呼び出す
 */
export async function createUser(
  data: { name: string; role: 'player' | 'staff'; password: string; position?: string }
): Promise<User> {
  if (!isSupabaseConfigured()) {
    const newUser: User = {
      id: `user-${Date.now()}`,
      name: data.name,
      role: data.role,
      password: data.password,
      position: data.position || null,
    }
    demoUsers.push(newUser)
    return newUser
  }

  const { data: created, error } = await getSupabase()
    .from('users')
    .insert({
      name: data.name,
      role: data.role,
      password: data.password,
      position: data.position || null,
    })
    .select()
    .single()
  if (error) {
    console.error('[data] createUser() でエラーが発生しました:', error.message)
    throw error
  }
  return created
}

/**
 * 既存ユーザーの基本情報（名前・ポジション）を更新する
 * 管理者画面からのみ呼び出す
 */
export async function updateUser(
  userId: string,
  updates: { name?: string; role?: 'player' | 'staff'; position?: string }
): Promise<User> {
  if (!isSupabaseConfigured()) {
    const idx = demoUsers.findIndex(u => u.id === userId)
    if (idx < 0) throw new Error('ユーザーが見つかりません')
    demoUsers[idx] = { ...demoUsers[idx], ...updates }
    return demoUsers[idx]
  }

  const { data: updated, error } = await getSupabase()
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()
  if (error) {
    console.error('[data] updateUser() でエラーが発生しました:', error.message)
    throw error
  }
  return updated
}

/**
 * 指定ユーザーのパスワードを変更する
 * 管理者画面からのみ呼び出す
 * Supabase ダッシュボードから直接カラムを書き換えた場合も次回ログイン時に反映される。
 */
export async function updateUserPassword(
  userId: string,
  newPassword: string
): Promise<void> {
  if (!isSupabaseConfigured()) {
    const idx = demoUsers.findIndex(u => u.id === userId)
    if (idx < 0) throw new Error('ユーザーが見つかりません')
    demoUsers[idx] = { ...demoUsers[idx], password: newPassword }
    return
  }

  const { error } = await getSupabase()
    .from('users')
    .update({ password: newPassword })
    .eq('id', userId)
  if (error) {
    console.error('[data] updateUserPassword() でエラーが発生しました:', error.message)
    throw error
  }
}

// ---------- Tournaments ----------

export async function getTournaments(): Promise<Tournament[]> {
  if (!isSupabaseConfigured()) return demoTournaments
  const { data, error } = await getSupabase().from('tournaments').select('*').order('target_date')
  if (error) throw error
  return data || []
}

export async function getActiveTournament(): Promise<Tournament | null> {
  if (!isSupabaseConfigured()) return demoTournaments[0] || null
  const { data, error } = await getSupabase()
    .from('tournaments')
    .select('*')
    .order('target_date', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('[data] getActiveTournament() でエラーが発生しました:', error.message)
    return null
  }
  return data
}

export async function upsertTournament(tournament: Partial<Tournament> & { name: string; target_date: string }): Promise<Tournament> {
  if (!isSupabaseConfigured()) {
    if (tournament.id) {
      const idx = demoTournaments.findIndex(t => t.id === tournament.id)
      if (idx >= 0) {
        demoTournaments[idx] = { ...demoTournaments[idx], ...tournament } as Tournament
        return demoTournaments[idx]
      }
    }
    const newT: Tournament = {
      id: `tournament-${Date.now()}`,
      name: tournament.name,
      target_date: tournament.target_date,
    }
    demoTournaments.push(newT)
    return newT
  }
  const { data, error } = await getSupabase().from('tournaments').upsert(tournament).select().single()
  if (error) throw error
  return data
}

// ---------- Mandala Chart ----------

export async function getMandalaChart(userId: string): Promise<MandalaChart | null> {
  if (!isSupabaseConfigured()) return demoMandala[userId] || null
  const { data, error } = await getSupabase()
    .from('mandala_charts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('[data] getMandalaChart() でエラーが発生しました:', error.message)
    return null
  }
  return data
}

export async function saveMandalaChart(chart: Partial<MandalaChart> & { user_id: string }): Promise<MandalaChart> {
  if (!isSupabaseConfigured()) {
    const existing = demoMandala[chart.user_id]
    if (existing) {
      const updated = { ...existing, ...chart }
      demoMandala[chart.user_id] = updated as MandalaChart
      return updated as MandalaChart
    }
    const newChart: MandalaChart = {
      id: `mandala-${Date.now()}`,
      user_id: chart.user_id,
      core_goal: chart.core_goal || '',
      elements: chart.elements || Array(8).fill(''),
      actions: chart.actions || Array(8).fill(null).map(() => Array(8).fill('')),
      target_date: chart.target_date || null,
      created_at: new Date().toISOString(),
      term_label: chart.term_label || null,
      status: chart.status || 'active',
      archived_at: chart.archived_at || null,
    }
    demoMandala[chart.user_id] = newChart
    return newChart
  }
  const { data, error } = await getSupabase().from('mandala_charts').upsert(chart).select().single()
  if (error) throw error
  return data
}

// ============================================================
// マンダラチャート履歴（アーカイブ）機能（今回追加）
// ============================================================

/**
 * 指定ユーザーのアーカイブ済みマンダラチャート一覧を取得する。
 * 生徒が過去の目標（成長の軌跡）をいつでも閲覧できるようにする。
 */
export async function getArchivedMandalaCharts(userId: string): Promise<MandalaChart[]> {
  if (!isSupabaseConfigured()) {
    return demoMandalaArchives
      .filter(c => c.user_id === userId)
      .sort((a, b) => (b.archived_at || b.created_at).localeCompare(a.archived_at || a.created_at))
  }
  const { data, error } = await getSupabase()
    .from('mandala_charts')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'archived')
    .order('archived_at', { ascending: false })
  if (error) {
    console.error('[data] getArchivedMandalaCharts() でエラーが発生しました:', error.message)
    return []
  }
  return data || []
}

/**
 * アクティブなマンダラチャートをアーカイブし、新しいアクティブチャートを作成する。
 * タイムラインへの自動投稿も合わせて実行する。
 * @param userId      対象選手のuser_id
 * @param newChart    新しいマンダラチャートのデータ
 * @param termLabel   アーカイブするターム名
 */
export async function archiveAndCreateMandalaChart(
  userId: string,
  newChart: Omit<MandalaChart, 'id' | 'created_at' | 'status' | 'archived_at'>,
  termLabel: string,
): Promise<MandalaChart> {
  if (!isSupabaseConfigured()) {
    // 既存のアクティブチャートをアーカイブする
    const existing = demoMandala[userId]
    if (existing) {
      const archived: MandalaChart = {
        ...existing,
        status: 'archived',
        term_label: termLabel,
        archived_at: new Date().toISOString(),
      }
      demoMandalaArchives.push(archived)
    }
    // 新しいチャートを作成する
    const created: MandalaChart = {
      id: `mandala-${Date.now()}`,
      user_id: userId,
      core_goal: newChart.core_goal,
      elements: newChart.elements,
      actions: newChart.actions,
      target_date: newChart.target_date || null,
      created_at: new Date().toISOString(),
      term_label: newChart.term_label || null,
      status: 'active',
      archived_at: null,
    }
    demoMandala[userId] = created
    return created
  }

  // Supabase: 既存のアクティブチャートをアーカイブし、新チャートをinsertする
  const supabase = getSupabase()
  const now = new Date().toISOString()

  // 1. 既存のアクティブチャートをアーカイブする
  await supabase
    .from('mandala_charts')
    .update({ status: 'archived', term_label: termLabel, archived_at: now })
    .eq('user_id', userId)
    .eq('status', 'active')

  // 2. 新しいチャートをinsertする（upsertではなくinsert）
  const { data, error } = await supabase
    .from('mandala_charts')
    .insert({
      ...newChart,
      user_id: userId,
      status: 'active',
      created_at: now,
    })
    .select()
    .single()

  if (error) {
    console.error('[data] archiveAndCreateMandalaChart() でエラーが発生しました:', error.message)
    throw error
  }

  // 3. タイムラインに自動投稿する（新目標設定の共有）
  try {
    const termText = newChart.term_label ? `【${newChart.term_label}】` : ''
    const postContent = `${termText}新しいマンダラチャートを設定しました！\nコア目標: 「${newChart.core_goal}」\n目標に向かって全力で頑張ります！💪`
    await supabase
      .from('timeline_posts')
      .insert({ user_id: userId, content: postContent })
  } catch (e) {
    // タイムライン投稿の失敗はエラーにしない（チャート保存は成功とする）
    console.warn('[data] タイムライン自動投稿に失敗しました:', e)
  }

  return data
}

// ============================================================
// マンダラチャート振り返り（大会後リフレクション）機能（今回追加）
// ============================================================

/**
 * 指定ユーザーの振り返りデータを取得する。
 * @param userId 対象ユーザーのID
 */
export async function getMandalaReflections(userId: string): Promise<MandalaReflection[]> {
  if (!isSupabaseConfigured()) {
    return demoReflections
      .filter(r => r.user_id === userId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
  }
  const { data, error } = await getSupabase()
    .from('mandala_reflections')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[data] getMandalaReflections() でエラーが発生しました:', error.message)
    return []
  }
  return data || []
}

/**
 * 大会後の振り返りを保存する。
 * 保存後、LLM（/api/scoring）へのメタ認知スコアリングを非同期で実行する。
 * @param reflection 振り返りデータ（id・created_at 不要）
 */
export async function saveMandalaReflection(
  reflection: Omit<MandalaReflection, 'id' | 'created_at' | 'mindset_score' | 'mindset_feedback'>
): Promise<MandalaReflection> {
  if (!isSupabaseConfigured()) {
    const newReflection: MandalaReflection = {
      ...reflection,
      id: `reflection-${Date.now()}`,
      mindset_score: null,
      mindset_feedback: null,
      created_at: new Date().toISOString(),
    }
    demoReflections.push(newReflection)
    return newReflection
  }

  const { data, error } = await getSupabase()
    .from('mandala_reflections')
    .insert(reflection)
    .select()
    .single()

  if (error) {
    console.error('[data] saveMandalaReflection() でエラーが発生しました:', error.message)
    throw error
  }
  return data
}

// ============================================================
// 目標更新フェーズ管理（コーチ主導トリガー）機能（今回追加）
// ============================================================

/**
 * 現在アクティブな目標更新フェーズを取得する。
 * 生徒側アプリでフェーズの有無を確認し、振り返りフローを起動するために使う。
 */
export async function getActiveGoalUpdatePhase(): Promise<GoalUpdatePhase | null> {
  if (!isSupabaseConfigured()) {
    return demoGoalUpdatePhases.find(p => p.is_active) || null
  }
  const { data, error } = await getSupabase()
    .from('goal_update_phases')
    .select('*')
    .eq('is_active', true)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('[data] getActiveGoalUpdatePhase() でエラーが発生しました:', error.message)
    return null
  }
  return data
}

/**
 * 目標更新フェーズを開始する（コーチ専用）。
 * @param termLabel  大会ターム名（例: "2026年 インターハイ予選"）
 * @param coachId    開始したコーチのuser_id
 */
export async function startGoalUpdatePhase(
  termLabel: string,
  coachId: string,
): Promise<GoalUpdatePhase> {
  if (!isSupabaseConfigured()) {
    // 既存のアクティブフェーズを終了する
    demoGoalUpdatePhases.forEach(p => {
      if (p.is_active) {
        p.is_active = false
        p.ended_at = new Date().toISOString()
      }
    })
    const newPhase: GoalUpdatePhase = {
      id: `phase-${Date.now()}`,
      term_label: termLabel,
      is_active: true,
      started_by: coachId,
      started_at: new Date().toISOString(),
      ended_at: null,
      created_at: new Date().toISOString(),
    }
    demoGoalUpdatePhases.push(newPhase)
    return newPhase
  }

  const supabase = getSupabase()
  const now = new Date().toISOString()

  // 既存のアクティブフェーズをすべて終了する
  await supabase
    .from('goal_update_phases')
    .update({ is_active: false, ended_at: now })
    .eq('is_active', true)

  // 新しいフェーズを開始する
  const { data, error } = await supabase
    .from('goal_update_phases')
    .insert({
      term_label: termLabel,
      is_active: true,
      started_by: coachId,
      started_at: now,
    })
    .select()
    .single()

  if (error) {
    console.error('[data] startGoalUpdatePhase() でエラーが発生しました:', error.message)
    throw error
  }
  return data
}

/**
 * 目標更新フェーズを終了する（コーチ専用）。
 * @param phaseId 終了するフェーズのID
 */
export async function endGoalUpdatePhase(phaseId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const idx = demoGoalUpdatePhases.findIndex(p => p.id === phaseId)
    if (idx >= 0) {
      demoGoalUpdatePhases[idx].is_active = false
      demoGoalUpdatePhases[idx].ended_at = new Date().toISOString()
    }
    return
  }
  const { error } = await getSupabase()
    .from('goal_update_phases')
    .update({ is_active: false, ended_at: new Date().toISOString() })
    .eq('id', phaseId)
  if (error) {
    console.error('[data] endGoalUpdatePhase() でエラーが発生しました:', error.message)
    throw error
  }
}

// ---------- Daily Records ----------

export async function getDailyRecords(userId: string, startDate?: string, endDate?: string): Promise<DailyRecord[]> {
  if (!isSupabaseConfigured()) {
    let records = demoRecords.filter(r => r.user_id === userId)
    if (startDate) records = records.filter(r => r.record_date >= startDate)
    if (endDate) records = records.filter(r => r.record_date <= endDate)
    return records.sort((a, b) => a.record_date.localeCompare(b.record_date))
  }
  // limit() を付けず全件取得する（以前は暗黙的な上限により14件前後で止まっていた）
  let query = getSupabase()
    .from('daily_records')
    .select('*')
    .eq('user_id', userId)
    .order('record_date', { ascending: true })
  if (startDate) query = query.gte('record_date', startDate)
  if (endDate) query = query.lte('record_date', endDate)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

/**
 * 過去の入力履歴から「連続記録日数（ストリーク）」を算出する。
 * 判定条件: その日に daily_records が1件以上存在すること（朝夜両方入力済み）
 * ※ 本アプリでは「デイリーノート」として朝のコンディション〜夜の振り返りを
 *    1レコードに統合して保存する設計のため、1日1レコード完成 = 両方完了と扱う。
 * 今日から過去に向かって走査し、1日でも欠けた場合はそこでカウントを止める。
 * @param records 対象ユーザーの全記録（日付昇順 or 降順 どちらでもOK）
 * @returns 現在の連続記録日数
 */
export function calculateStreak(records: DailyRecord[]): number {
  if (records.length === 0) return 0

  // 入力済み日付をセットに格納する
  const recordedDates = new Set(records.map(r => r.record_date))

  // 今日から昨日・一昨日と遡ってチェックする
  let streak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let i = 0; i < 3650; i++) { // 最大10年遡る
    const checkDate = new Date(today)
    checkDate.setDate(today.getDate() - i)
    const dateStr = checkDate.toISOString().split('T')[0]

    if (recordedDates.has(dateStr)) {
      streak++
    } else {
      // 今日がまだ未入力でも昨日以前の連続を維持する
      // （今日が未入力の場合は0日目として扱い、昨日から遡る）
      if (i === 0) continue
      break
    }
  }
  return streak
}

export async function getAllDailyRecords(startDate?: string, endDate?: string): Promise<DailyRecordWithUser[]> {
  if (!isSupabaseConfigured()) {
    let records = [...demoRecords]
    if (startDate) records = records.filter(r => r.record_date >= startDate)
    if (endDate) records = records.filter(r => r.record_date <= endDate)
    return records
      .sort((a, b) => b.record_date.localeCompare(a.record_date))
      .map(r => ({
        ...r,
        users: demoUsers.find(u => u.id === r.user_id),
        comments: demoComments.filter(c => c.daily_record_id === r.id),
      }))
  }
  let query = getSupabase().from('daily_records').select('*, users(*), comments(*, users(*))').order('record_date', { ascending: false })
  if (startDate) query = query.gte('record_date', startDate)
  if (endDate) query = query.lte('record_date', endDate)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function getDailyRecord(userId: string, recordDate: string): Promise<DailyRecord | null> {
  if (!isSupabaseConfigured()) {
    return demoRecords.find(r => r.user_id === userId && r.record_date === recordDate) || null
  }
  const { data, error } = await getSupabase()
    .from('daily_records')
    .select('*')
    .eq('user_id', userId)
    .eq('record_date', recordDate)
    .maybeSingle()
  if (error) {
    console.error('[data] getDailyRecord() でエラーが発生しました:', error.message)
    return null
  }
  return data
}

export async function saveDailyRecord(record: Partial<DailyRecord> & { user_id: string; record_date: string }): Promise<DailyRecord> {
  if (!isSupabaseConfigured()) {
    const existingIdx = demoRecords.findIndex(
      r => r.user_id === record.user_id && r.record_date === record.record_date
    )
    if (existingIdx >= 0) {
      demoRecords[existingIdx] = { ...demoRecords[existingIdx], ...record } as DailyRecord
      return demoRecords[existingIdx]
    }
    const newRecord: DailyRecord = {
      id: `record-${Date.now()}`,
      user_id: record.user_id,
      record_date: record.record_date,
      sleep_hours: record.sleep_hours || 7,
      fatigue_level: record.fatigue_level || 5,
      has_pain: record.has_pain || false,
      pain_detail: record.pain_detail || '',
      participation_status: record.participation_status || '参加',
      target_items: record.target_items || [],
      self_evaluation: record.self_evaluation || 5,
      reflection: record.reflection || '',
      points: record.points || 0,
      created_at: new Date().toISOString(),
    }
    demoRecords.push(newRecord)
    return newRecord
  }
  const { data, error } = await getSupabase()
    .from('daily_records')
    .upsert(record, { onConflict: 'user_id,record_date' })
    .select()
    .single()
  if (error) throw error
  return data
}

// ---------- Comments ----------

export async function getComments(recordId: string): Promise<Comment[]> {
  if (!isSupabaseConfigured()) {
    return demoComments
      .filter(c => c.daily_record_id === recordId)
      .map(c => ({ ...c, users: demoUsers.find(u => u.id === c.user_id) }))
  }
  const { data, error } = await getSupabase()
    .from('comments')
    .select('*, users(*)')
    .eq('daily_record_id', recordId)
    .order('created_at')
  if (error) throw error
  return data || []
}

export async function addComment(dailyRecordId: string, userId: string, content: string): Promise<Comment> {
  if (!isSupabaseConfigured()) {
    const newComment: Comment = {
      id: `comment-${Date.now()}`,
      daily_record_id: dailyRecordId,
      user_id: userId,
      content,
      created_at: new Date().toISOString(),
      users: demoUsers.find(u => u.id === userId),
    }
    demoComments.push(newComment)
    return newComment
  }
  const { data, error } = await getSupabase()
    .from('comments')
    .insert({ daily_record_id: dailyRecordId, user_id: userId, content })
    .select('*, users(*)')
    .single()
  if (error) throw error
  return data
}

/**
 * 送信済みのコメントを修正（上書き）する。
 * 自分が送信したコメントのみ修正可能（呼び出し側で userId チェックを行うこと）。
 */
export async function updateComment(commentId: string, newContent: string): Promise<Comment> {
  // デモモードの場合はインメモリデータを更新する
  if (!isSupabaseConfigured()) {
    const idx = demoComments.findIndex(c => c.id === commentId)
    if (idx < 0) throw new Error('コメントが見つかりません')
    demoComments[idx] = { ...demoComments[idx], content: newContent }
    return {
      ...demoComments[idx],
      users: demoUsers.find(u => u.id === demoComments[idx].user_id),
    }
  }

  const { data, error } = await getSupabase()
    .from('comments')
    .update({ content: newContent })
    .eq('id', commentId)
    .select('*, users(*)')
    .single()
  if (error) {
    console.error('[data] updateComment() でエラーが発生しました:', error.message)
    throw error
  }
  return data
}

// ============================================================
// カルテ機能（身体測定・MAX測定）
// ============================================================

// --- デモデータ ---

let demoPhysicalRecords: PhysicalRecord[] = [
  { id: 'phys-1', user_id: 'player-1', measured_date: '2025-10-01', height_cm: 165.0, weight_kg: 58.0, body_fat_pct: 22.0, muscle_mass_kg: 42.5, created_at: '2025-10-01T00:00:00Z' },
  { id: 'phys-2', user_id: 'player-1', measured_date: '2026-01-05', height_cm: 165.5, weight_kg: 57.0, body_fat_pct: 20.5, muscle_mass_kg: 43.0, created_at: '2026-01-05T00:00:00Z' },
  { id: 'phys-3', user_id: 'player-1', measured_date: '2026-04-01', height_cm: 166.0, weight_kg: 56.5, body_fat_pct: 19.0, muscle_mass_kg: 44.0, created_at: '2026-04-01T00:00:00Z' },
]

let demoMaxRecords: MaxTrainingRecord[] = [
  { id: 'max-1', user_id: 'player-1', measured_date: '2025-10-01', bench_press_kg: 30.0, squat_kg: 50.0, deadlift_kg: 60.0, created_at: '2025-10-01T00:00:00Z' },
  { id: 'max-2', user_id: 'player-1', measured_date: '2026-01-05', bench_press_kg: 35.0, squat_kg: 55.0, deadlift_kg: 65.0, created_at: '2026-01-05T00:00:00Z' },
  { id: 'max-3', user_id: 'player-1', measured_date: '2026-04-01', bench_press_kg: 40.0, squat_kg: 60.0, deadlift_kg: 70.0, created_at: '2026-04-01T00:00:00Z' },
]

// --- 身体測定データ ---

export async function getPhysicalRecords(userId: string): Promise<PhysicalRecord[]> {
  if (!isSupabaseConfigured()) {
    return demoPhysicalRecords
      .filter(r => r.user_id === userId)
      .sort((a, b) => a.measured_date.localeCompare(b.measured_date))
  }
  const { data, error } = await getSupabase()
    .from('physical_records')
    .select('*')
    .eq('user_id', userId)
    .order('measured_date')
  if (error) {
    console.error('[data] getPhysicalRecords() でエラーが発生しました:', error.message)
    return []
  }
  return data || []
}

export async function savePhysicalRecord(
  record: Partial<PhysicalRecord> & { user_id: string; measured_date: string }
): Promise<PhysicalRecord> {
  if (!isSupabaseConfigured()) {
    const idx = demoPhysicalRecords.findIndex(
      r => r.user_id === record.user_id && r.measured_date === record.measured_date
    )
    if (idx >= 0) {
      demoPhysicalRecords[idx] = { ...demoPhysicalRecords[idx], ...record } as PhysicalRecord
      return demoPhysicalRecords[idx]
    }
    const newRecord: PhysicalRecord = {
      id: `phys-${Date.now()}`,
      user_id: record.user_id,
      measured_date: record.measured_date,
      height_cm: record.height_cm ?? null,
      weight_kg: record.weight_kg ?? null,
      body_fat_pct: record.body_fat_pct ?? null,
      muscle_mass_kg: record.muscle_mass_kg ?? null,
      created_at: new Date().toISOString(),
    }
    demoPhysicalRecords.push(newRecord)
    return newRecord
  }
  const { data, error } = await getSupabase()
    .from('physical_records')
    .upsert(record, { onConflict: 'user_id,measured_date' })
    .select()
    .maybeSingle()
  if (error) {
    console.error('[data] savePhysicalRecord() でエラーが発生しました:', error.message)
    throw error
  }
  if (!data) {
    throw new Error('身体測定データの保存結果を取得できませんでした')
  }
  return data
}

export async function deletePhysicalRecord(recordId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    demoPhysicalRecords = demoPhysicalRecords.filter(r => r.id !== recordId)
    return
  }
  const { error } = await getSupabase().from('physical_records').delete().eq('id', recordId)
  if (error) throw error
}

// --- MAX測定データ ---

export async function getMaxTrainingRecords(userId: string): Promise<MaxTrainingRecord[]> {
  if (!isSupabaseConfigured()) {
    return demoMaxRecords
      .filter(r => r.user_id === userId)
      .sort((a, b) => a.measured_date.localeCompare(b.measured_date))
  }
  const { data, error } = await getSupabase()
    .from('max_training_records')
    .select('*')
    .eq('user_id', userId)
    .order('measured_date')
  if (error) {
    console.error('[data] getMaxTrainingRecords() でエラーが発生しました:', error.message)
    return []
  }
  return data || []
}

export async function saveMaxTrainingRecord(
  record: Partial<MaxTrainingRecord> & { user_id: string; measured_date: string }
): Promise<MaxTrainingRecord> {
  if (!isSupabaseConfigured()) {
    const idx = demoMaxRecords.findIndex(
      r => r.user_id === record.user_id && r.measured_date === record.measured_date
    )
    if (idx >= 0) {
      demoMaxRecords[idx] = { ...demoMaxRecords[idx], ...record } as MaxTrainingRecord
      return demoMaxRecords[idx]
    }
    const newRecord: MaxTrainingRecord = {
      id: `max-${Date.now()}`,
      user_id: record.user_id,
      measured_date: record.measured_date,
      bench_press_kg: record.bench_press_kg ?? null,
      squat_kg: record.squat_kg ?? null,
      deadlift_kg: record.deadlift_kg ?? null,
      created_at: new Date().toISOString(),
    }
    demoMaxRecords.push(newRecord)
    return newRecord
  }
  const { data, error } = await getSupabase()
    .from('max_training_records')
    .upsert(record, { onConflict: 'user_id,measured_date' })
    .select()
    .maybeSingle()
  if (error) {
    console.error('[data] saveMaxTrainingRecord() でエラーが発生しました:', error.message)
    throw error
  }
  if (!data) {
    throw new Error('MAX測定データの保存結果を取得できませんでした')
  }
  return data
}

export async function deleteMaxTrainingRecord(recordId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    demoMaxRecords = demoMaxRecords.filter(r => r.id !== recordId)
    return
  }
  const { error } = await getSupabase().from('max_training_records').delete().eq('id', recordId)
  if (error) throw error
}

// ============================================================
// カルテ機能（管理者向け：全選手データ取得）
// ============================================================

/**
 * 全選手の身体測定データを取得する（管理者向け）
 * user_id ごとにグループ化せず全件返す
 */
export async function getAllPhysicalRecords(): Promise<PhysicalRecord[]> {
  // デモモードでは全デモデータを返す
  if (!isSupabaseConfigured()) {
    // デモ用：複数選手分のデータを生成して返す
    const extraRecords: PhysicalRecord[] = [
      { id: 'phys-p2-1', user_id: 'player-2', measured_date: '2025-10-01', height_cm: 162.0, weight_kg: 55.0, body_fat_pct: 24.0, muscle_mass_kg: 39.0, created_at: '2025-10-01T00:00:00Z' },
      { id: 'phys-p2-2', user_id: 'player-2', measured_date: '2026-01-05', height_cm: 162.5, weight_kg: 54.0, body_fat_pct: 22.5, muscle_mass_kg: 39.5, created_at: '2026-01-05T00:00:00Z' },
      { id: 'phys-p2-3', user_id: 'player-2', measured_date: '2026-04-01', height_cm: 163.0, weight_kg: 53.5, body_fat_pct: 21.0, muscle_mass_kg: 40.0, created_at: '2026-04-01T00:00:00Z' },
      { id: 'phys-p3-1', user_id: 'player-3', measured_date: '2025-10-01', height_cm: 170.0, weight_kg: 63.0, body_fat_pct: 18.0, muscle_mass_kg: 48.0, created_at: '2025-10-01T00:00:00Z' },
      { id: 'phys-p3-2', user_id: 'player-3', measured_date: '2026-01-05', height_cm: 170.0, weight_kg: 62.0, body_fat_pct: 17.0, muscle_mass_kg: 49.0, created_at: '2026-01-05T00:00:00Z' },
      { id: 'phys-p3-3', user_id: 'player-3', measured_date: '2026-04-01', height_cm: 170.5, weight_kg: 61.5, body_fat_pct: 16.0, muscle_mass_kg: 50.0, created_at: '2026-04-01T00:00:00Z' },
      { id: 'phys-p4-1', user_id: 'player-4', measured_date: '2025-10-01', height_cm: 158.0, weight_kg: 52.0, body_fat_pct: 26.0, muscle_mass_kg: 36.0, created_at: '2025-10-01T00:00:00Z' },
      { id: 'phys-p4-2', user_id: 'player-4', measured_date: '2026-01-05', height_cm: 158.0, weight_kg: 51.5, body_fat_pct: 24.5, muscle_mass_kg: 36.5, created_at: '2026-01-05T00:00:00Z' },
      { id: 'phys-p4-3', user_id: 'player-4', measured_date: '2026-04-01', height_cm: 158.5, weight_kg: 50.5, body_fat_pct: 23.0, muscle_mass_kg: 37.5, created_at: '2026-04-01T00:00:00Z' },
    ]
    return [...demoPhysicalRecords, ...extraRecords].sort(
      (a, b) => a.measured_date.localeCompare(b.measured_date)
    )
  }

  const { data, error } = await getSupabase()
    .from('physical_records')
    .select('*')
    .order('measured_date', { ascending: true })
  if (error) {
    console.error('[data] getAllPhysicalRecords() でエラーが発生しました:', error.message)
    return []
  }
  return data || []
}

/**
 * 全選手のMAX測定データを取得する（管理者向け）
 */
export async function getAllMaxTrainingRecords(): Promise<MaxTrainingRecord[]> {
  if (!isSupabaseConfigured()) {
    const extraRecords: MaxTrainingRecord[] = [
      { id: 'max-p2-1', user_id: 'player-2', measured_date: '2025-10-01', bench_press_kg: 25.0, squat_kg: 45.0, deadlift_kg: 55.0, created_at: '2025-10-01T00:00:00Z' },
      { id: 'max-p2-2', user_id: 'player-2', measured_date: '2026-01-05', bench_press_kg: 27.5, squat_kg: 47.5, deadlift_kg: 57.5, created_at: '2026-01-05T00:00:00Z' },
      { id: 'max-p2-3', user_id: 'player-2', measured_date: '2026-04-01', bench_press_kg: 30.0, squat_kg: 50.0, deadlift_kg: 60.0, created_at: '2026-04-01T00:00:00Z' },
      { id: 'max-p3-1', user_id: 'player-3', measured_date: '2025-10-01', bench_press_kg: 50.0, squat_kg: 75.0, deadlift_kg: 90.0, created_at: '2025-10-01T00:00:00Z' },
      { id: 'max-p3-2', user_id: 'player-3', measured_date: '2026-01-05', bench_press_kg: 55.0, squat_kg: 80.0, deadlift_kg: 95.0, created_at: '2026-01-05T00:00:00Z' },
      { id: 'max-p3-3', user_id: 'player-3', measured_date: '2026-04-01', bench_press_kg: 60.0, squat_kg: 85.0, deadlift_kg: 100.0, created_at: '2026-04-01T00:00:00Z' },
      { id: 'max-p4-1', user_id: 'player-4', measured_date: '2025-10-01', bench_press_kg: 20.0, squat_kg: 35.0, deadlift_kg: 45.0, created_at: '2025-10-01T00:00:00Z' },
      { id: 'max-p4-2', user_id: 'player-4', measured_date: '2026-01-05', bench_press_kg: 22.5, squat_kg: 37.5, deadlift_kg: 47.5, created_at: '2026-01-05T00:00:00Z' },
      { id: 'max-p4-3', user_id: 'player-4', measured_date: '2026-04-01', bench_press_kg: 25.0, squat_kg: 40.0, deadlift_kg: 50.0, created_at: '2026-04-01T00:00:00Z' },
    ]
    return [...demoMaxRecords, ...extraRecords].sort(
      (a, b) => a.measured_date.localeCompare(b.measured_date)
    )
  }

  const { data, error } = await getSupabase()
    .from('max_training_records')
    .select('*')
    .order('measured_date', { ascending: true })
  if (error) {
    console.error('[data] getAllMaxTrainingRecords() でエラーが発生しました:', error.message)
    return []
  }
  return data || []
}

// ============================================================
// チームダッシュボード用（疲労度・睡眠時間の平均値集計）
// ============================================================

/**
 * 指定した複数選手の過去21日間（直近3週間）のデイリーレコードを取得する。
 * コーチ向けチームダッシュボードのグラフ描画に使用する。
 * @param userIds  対象選手のIDリスト
 * @param startDate 取得開始日（YYYY-MM-DD）
 * @param endDate   取得終了日（YYYY-MM-DD）
 */
export async function getTeamConditionRecords(
  userIds: string[],
  startDate: string,
  endDate: string
): Promise<DailyRecord[]> {
  if (userIds.length === 0) return []

  // デモモードの場合はインメモリデータから絞り込む
  if (!isSupabaseConfigured()) {
    return demoRecords.filter(
      r =>
        userIds.includes(r.user_id) &&
        r.record_date >= startDate &&
        r.record_date <= endDate
    ).sort((a, b) => a.record_date.localeCompare(b.record_date))
  }

  // Supabase から対象選手・期間のデータを取得する
  const { data, error } = await getSupabase()
    .from('daily_records')
    .select('*')
    .in('user_id', userIds)
    .gte('record_date', startDate)
    .lte('record_date', endDate)
    .order('record_date', { ascending: true })

  if (error) {
    console.error('[data] getTeamConditionRecords() でエラーが発生しました:', error.message)
    return []
  }
  return data || []
}

// ============================================================
// Session RPE機能（練習時間・トレーニング負荷管理）
// コーチ専用：選手側には一切表示しない
// ============================================================

/** デモ用練習時間データ（インメモリ） */
const demoPracticeSessions: PracticeSession[] = (() => {
  const sessions: PracticeSession[] = []
  const now = new Date()
  // 過去7日分のデモデータを生成する
  const durations = [60, 90, 45, 90, 75, 0, 90]
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const mins = durations[6 - i]
    if (mins === 0) continue // 練習なしの日はスキップ
    sessions.push({
      id: `practice-${dateStr}`,
      session_date: dateStr,
      duration_minutes: mins,
      created_by: 'staff-1',
      created_at: d.toISOString(),
      updated_at: d.toISOString(),
    })
  }
  return sessions
})()

/**
 * 指定日の練習時間を取得する（コーチ専用）。
 * @param sessionDate 練習日（YYYY-MM-DD）
 */
export async function getPracticeSession(sessionDate: string): Promise<PracticeSession | null> {
  if (!isSupabaseConfigured()) {
    return demoPracticeSessions.find(s => s.session_date === sessionDate) || null
  }
  const { data, error } = await getSupabase()
    .from('practice_sessions')
    .select('*')
    .eq('session_date', sessionDate)
    .maybeSingle()
  if (error) {
    console.error('[data] getPracticeSession() でエラーが発生しました:', error.message)
    return null
  }
  return data
}

/**
 * 指定期間の練習時間を一括取得する（コーチ専用）。
 * @param startDate 取得開始日（YYYY-MM-DD）
 * @param endDate   取得終了日（YYYY-MM-DD）
 */
export async function getPracticeSessions(startDate: string, endDate: string): Promise<PracticeSession[]> {
  if (!isSupabaseConfigured()) {
    return demoPracticeSessions
      .filter(s => s.session_date >= startDate && s.session_date <= endDate)
      .sort((a, b) => a.session_date.localeCompare(b.session_date))
  }
  const { data, error } = await getSupabase()
    .from('practice_sessions')
    .select('*')
    .gte('session_date', startDate)
    .lte('session_date', endDate)
    .order('session_date', { ascending: true })
  if (error) {
    console.error('[data] getPracticeSessions() でエラーが発生しました:', error.message)
    return []
  }
  return data || []
}

/**
 * 練習時間を保存（upsert）する（コーチ専用）。
 * 同一 session_date が既に存在する場合は上書きする。
 * @param sessionDate       練習日（YYYY-MM-DD）
 * @param durationMinutes   練習時間（分）
 * @param createdBy         登録コーチの user_id
 */
export async function upsertPracticeSession(
  sessionDate: string,
  durationMinutes: number,
  createdBy: string,
): Promise<PracticeSession> {
  if (!isSupabaseConfigured()) {
    const idx = demoPracticeSessions.findIndex(s => s.session_date === sessionDate)
    const now = new Date().toISOString()
    if (idx >= 0) {
      demoPracticeSessions[idx] = {
        ...demoPracticeSessions[idx],
        duration_minutes: durationMinutes,
        updated_at: now,
      }
      return demoPracticeSessions[idx]
    }
    const newSession: PracticeSession = {
      id: `practice-${sessionDate}`,
      session_date: sessionDate,
      duration_minutes: durationMinutes,
      created_by: createdBy,
      created_at: now,
      updated_at: now,
    }
    demoPracticeSessions.push(newSession)
    return newSession
  }

  const now = new Date().toISOString()
  const { data, error } = await getSupabase()
    .from('practice_sessions')
    .upsert(
      {
        session_date: sessionDate,
        duration_minutes: durationMinutes,
        created_by: createdBy,
        updated_at: now,
      },
      { onConflict: 'session_date' },
    )
    .select()
    .single()
  if (error) {
    console.error('[data] upsertPracticeSession() でエラーが発生しました:', error.message)
    throw error
  }
  return data
}

// ============================================================
// スタッツ管理機能（試合パフォーマンスデータ）
// コーチがCSVインポートで登録し、コーチ・選手双方が閲覧する
// ============================================================

/** デモ用スタッツデータ（インメモリ） */
let demoGameStats: GameStat[] = [
  {
    id: 'stat-1',
    game_date: '2026-05-10',
    opponent: '〇〇高校',
    game_type: '練習試合',
    game_minutes: 40,
    player_name: '山田 花子',
    minutes_played: 28,
    points: 14,
    rebounds: 5,
    assists: 3,
    steals: 2,
    blocks: 0,
    turnovers: 2,
    fouls: 3,
    fg3_made: 2,
    fg3_attempted: 6,
    fg2_made: 4,
    fg2_attempted: 8,
    ft_made: 0,
    ft_attempted: 0,
    imported_by: 'staff-1',
    created_at: '2026-05-10T00:00:00Z',
  },
  {
    id: 'stat-2',
    game_date: '2026-05-10',
    opponent: '〇〇高校',
    game_type: '練習試合',
    game_minutes: 40,
    player_name: '鈴木 美咲',
    minutes_played: 32,
    points: 10,
    rebounds: 8,
    assists: 1,
    steals: 1,
    blocks: 2,
    turnovers: 3,
    fouls: 2,
    fg3_made: 1,
    fg3_attempted: 4,
    fg2_made: 4,
    fg2_attempted: 9,
    ft_made: 0,
    ft_attempted: 2,
    imported_by: 'staff-1',
    created_at: '2026-05-10T00:00:00Z',
  },
  {
    id: 'stat-3',
    game_date: '2026-06-01',
    opponent: '△△高校',
    game_type: '公式戦',
    game_minutes: 40,
    player_name: '山田 花子',
    minutes_played: 35,
    points: 20,
    rebounds: 4,
    assists: 5,
    steals: 3,
    blocks: 1,
    turnovers: 1,
    fouls: 2,
    fg3_made: 3,
    fg3_attempted: 8,
    fg2_made: 5,
    fg2_attempted: 10,
    ft_made: 3,
    ft_attempted: 4,
    imported_by: 'staff-1',
    created_at: '2026-06-01T00:00:00Z',
  },
  {
    id: 'stat-4',
    game_date: '2026-06-01',
    opponent: '△△高校',
    game_type: '公式戦',
    game_minutes: 40,
    player_name: '佐藤 遥',
    minutes_played: 30,
    points: 8,
    rebounds: 6,
    assists: 2,
    steals: 0,
    blocks: 3,
    turnovers: 2,
    fouls: 4,
    fg3_made: 0,
    fg3_attempted: 2,
    fg2_made: 4,
    fg2_attempted: 8,
    ft_made: 0,
    ft_attempted: 0,
    imported_by: 'staff-1',
    created_at: '2026-06-01T00:00:00Z',
  },
]

/**
 * スタッツデータを全件取得する。
 * @param playerName  選手名で絞り込む場合に指定（省略で全員）
 * @param gameType    試合種別で絞り込む場合に指定（省略で全種別）
 */
export async function getGameStats(
  playerName?: string,
  gameType?: string,
): Promise<GameStat[]> {
  if (!isSupabaseConfigured()) {
    let stats = [...demoGameStats]
    if (playerName) stats = stats.filter(s => s.player_name === playerName)
    if (gameType) stats = stats.filter(s => s.game_type === gameType)
    return stats.sort((a, b) => b.game_date.localeCompare(a.game_date))
  }

  let query = getSupabase()
    .from('game_stats')
    .select('*')
    .order('game_date', { ascending: false })
  if (playerName) query = query.eq('player_name', playerName)
  if (gameType) query = query.eq('game_type', gameType)

  const { data, error } = await query
  if (error) {
    console.error('[data] getGameStats() でエラーが発生しました:', error.message)
    return []
  }
  return data || []
}

/**
 * 指定選手の試合別スタッツ推移を取得する（折れ線グラフ用）。
 */
export async function getPlayerGameStats(playerName: string): Promise<GameStat[]> {
  return getGameStats(playerName)
}

/**
 * 複数の GameStat をまとめて挿入する（CSVインポート用）。
 * コーチ権限のみ呼び出し可能。呼び出し元で role チェックを行うこと。
 * @param rows     バリデーション済みの挿入データ配列
 * @param coachId  インポートしたコーチの user_id
 */
export async function importGameStats(
  rows: Omit<GameStat, 'id' | 'created_at'>[],
  coachId: string,
): Promise<{ success: number; errors: string[] }> {
  const errors: string[] = []
  let success = 0

  if (!isSupabaseConfigured()) {
    // デモモード: インメモリデータに追加する
    for (const row of rows) {
      demoGameStats.push({
        ...row,
        id: `stat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        imported_by: coachId,
        created_at: new Date().toISOString(),
      })
      success++
    }
    return { success, errors }
  }

  // Supabase: バッチ挿入する
  const insertData = rows.map(row => ({
    ...row,
    imported_by: coachId,
  }))
  const { error } = await getSupabase().from('game_stats').insert(insertData)
  if (error) {
    console.error('[data] importGameStats() でエラーが発生しました:', error.message)
    errors.push(`インポートエラー: ${error.message}`)
    return { success: 0, errors }
  }
  return { success: rows.length, errors }
}

/**
 * 指定IDのスタッツレコードを削除する（コーチ専用）。
 */
export async function deleteGameStat(statId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    demoGameStats = demoGameStats.filter(s => s.id !== statId)
    return
  }
  const { error } = await getSupabase().from('game_stats').delete().eq('id', statId)
  if (error) {
    console.error('[data] deleteGameStat() でエラーが発生しました:', error.message)
    throw error
  }
}

/**
 * CSVの文字列データを GameStat インポート用オブジェクトに変換する。
 * バリデーションを行い、問題のある行はエラーメッセージと共に除外する。
 * @param rows     CSVパース後の配列（各行がオブジェクト）
 * @param coachId  インポートするコーチの user_id
 * @returns        バリデーション済みデータと検出エラーのリスト
 */
export function parseCsvToGameStats(
  rows: CsvStatRow[],
  coachId: string,
): { valid: Omit<GameStat, 'id' | 'created_at'>[]; errors: string[] } {
  const valid: Omit<GameStat, 'id' | 'created_at'>[] = []
  const errors: string[] = []

  rows.forEach((row, idx) => {
    const lineNum = idx + 2 // ヘッダー行を1行目として行番号を表示

    // 必須フィールドのチェック
    if (!row.game_date || !row.player_name) {
      errors.push(`${lineNum}行目: game_date または player_name が未入力です`)
      return
    }

    // 日付形式チェック（YYYY-MM-DD）
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.game_date)) {
      errors.push(`${lineNum}行目: game_date の形式が不正です（例: 2026-05-10）`)
      return
    }

    const toNum = (val?: string, defaultVal = 0): number => {
      const n = parseInt(val || '0', 10)
      return isNaN(n) ? defaultVal : n
    }

    valid.push({
      game_date: row.game_date,
      opponent: row.opponent || '不明',
      game_type: row.game_type || '練習試合',
      game_minutes: toNum(row.game_minutes, 40),
      player_name: row.player_name.trim(),
      minutes_played: toNum(row.minutes_played),
      points: toNum(row.points),
      rebounds: toNum(row.rebounds),
      assists: toNum(row.assists),
      steals: toNum(row.steals),
      blocks: toNum(row.blocks),
      turnovers: toNum(row.turnovers),
      fouls: toNum(row.fouls),
      fg3_made: toNum(row.fg3_made),
      fg3_attempted: toNum(row.fg3_attempted),
      fg2_made: toNum(row.fg2_made),
      fg2_attempted: toNum(row.fg2_attempted),
      ft_made: toNum(row.ft_made),
      ft_attempted: toNum(row.ft_attempted),
      imported_by: coachId,
    })
  })

  return { valid, errors }
}

// ============================================================
// グロースマインドセット スコアリング機能（2026-07-14 追加）
// コーチ向けダッシュボードでの集計・表示に使用する
// ============================================================

/**
 * 指定選手・期間のメタ認知スコアを daily_records から取得する。
 * コーチ向けダッシュボードのスコア一覧・グラフ描画に使用する。
 * @param userIds 対象選手のIDリスト
 * @param days    取得期間（日数）
 */
export async function getMindsetScores(
  userIds: string[],
  days: number
): Promise<DailyRecord[]> {
  if (userIds.length === 0) return []

  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - (days - 1))
  const startStr = startDate.toISOString().split('T')[0]
  const endStr = endDate.toISOString().split('T')[0]

  // デモモードの場合はデモデータにダミースコアを付与して返す
  if (!isSupabaseConfigured()) {
    const records = demoRecords.filter(
      r =>
        userIds.includes(r.user_id) &&
        r.record_date >= startStr &&
        r.record_date <= endStr &&
        r.reflection.trim().length > 0
    )
    // デモ用スコアを擬似的に割り当てる（ランダム1〜4）
    return records.map(r => ({
      ...r,
      mindset_score: (Math.floor(Math.random() * 4) + 1) as 1 | 2 | 3 | 4,
      mindset_feedback: generateDemoFeedback(Math.floor(Math.random() * 4) + 1),
    }))
  }

  const { data, error } = await getSupabase()
    .from('daily_records')
    .select('*')
    .in('user_id', userIds)
    .gte('record_date', startStr)
    .lte('record_date', endStr)
    .not('mindset_score', 'is', null)
    .order('record_date', { ascending: false })

  if (error) {
    console.error('[data] getMindsetScores() でエラーが発生しました:', error.message)
    return []
  }
  return data || []
}

/** デモ用フィードバックテキストを生成する */
function generateDemoFeedback(score: number): string {
  const feedbacks: Record<number, string> = {
    1: '練習内容の羅列になっています。「なぜそうなったか」という原因分析を加えてみましょう。',
    2: '課題の認識はできています。「どのように改善するか」という具体策を書いてみましょう。',
    3: '失敗を学びに変える視点が持てています。さらに「なぜその対策が有効か」を考えると深まります。',
    4: '自己の思考プロセスを客観視し、戦略的な改善計画を立てられています。素晴らしいメタ認知です！',
  }
  return feedbacks[score] || ''
}

/**
 * PER40（40分換算）のスタッツを計算する。
 * 出場時間が0の場合は null を返す。
 * @param stat     元のスタッツデータ
 * @returns        PER40換算値
 */
export function calcPer40(stat: GameStat) {
  const mp = stat.minutes_played
  if (!mp || mp <= 0) {
    return {
      points_per40: null,
      rebounds_per40: null,
      assists_per40: null,
      steals_per40: null,
      blocks_per40: null,
      turnovers_per40: null,
    }
  }
  const per40 = (val: number) => Math.round((val / mp) * 40 * 10) / 10
  return {
    points_per40: per40(stat.points),
    rebounds_per40: per40(stat.rebounds),
    assists_per40: per40(stat.assists),
    steals_per40: per40(stat.steals),
    blocks_per40: per40(stat.blocks),
    turnovers_per40: per40(stat.turnovers),
  }
}

/**
 * シュート成功率（%）を計算する。試投数が0の場合は null を返す。
 */
export function calcPct(made: number, attempted: number): number | null {
  if (!attempted) return null
  return Math.round((made / attempted) * 1000) / 10
}

// ============================================================
// 10ヶ条評価機能（2026-07-26 追加）
// 自己評価・他者評価アンケートシステム
// ============================================================

/**
 * 10ヶ条の質問定義（全30問・カテゴリ3問ずつ）。
 * コードレベルで管理する（DBには保存しない）。
 */
export const EVALUATION_QUESTIONS: EvaluationQuestion[] = [
  // ① 礼儀・挨拶
  { id: 1, category: '礼儀・挨拶', text: '練習前後に大きな声で挨拶ができている' },
  { id: 2, category: '礼儀・挨拶', text: '指導者や先輩への言葉遣いが丁寧である' },
  { id: 3, category: '礼儀・挨拶', text: '感謝の気持ちを言葉や行動で表せている' },
  // ② 時間管理
  { id: 4, category: '時間管理', text: '練習や集合の時間を守っている' },
  { id: 5, category: '時間管理', text: '準備・片付けを素早く行っている' },
  { id: 6, category: '時間管理', text: '学業と部活のバランスを管理できている' },
  // ③ 集中力・主体性
  { id: 7, category: '集中力・主体性', text: '練習中に自分から考えて動いている' },
  { id: 8, category: '集中力・主体性', text: '指示がなくても次の行動ができている' },
  { id: 9, category: '集中力・主体性', text: 'ダラダラせず常に集中して取り組んでいる' },
  // ④ コミュニケーション
  { id: 10, category: 'コミュニケーション', text: '練習中に声を出してチームを盛り上げている' },
  { id: 11, category: 'コミュニケーション', text: '仲間のミスを責めずフォローできている' },
  { id: 12, category: 'コミュニケーション', text: '困っている仲間に積極的に声をかけられる' },
  // ⑤ 向上心・努力
  { id: 13, category: '向上心・努力', text: '苦手な部分に積極的に取り組んでいる' },
  { id: 14, category: '向上心・努力', text: '練習後も自主練や勉強など努力を続けている' },
  { id: 15, category: '向上心・努力', text: '目標に向かって毎日行動できている' },
  // ⑥ 責任感
  { id: 16, category: '責任感', text: '自分の役割を最後まで責任を持って果たしている' },
  { id: 17, category: '責任感', text: 'ミスや失敗を言い訳せず受け入れられる' },
  { id: 18, category: '責任感', text: 'チームのルールを守り模範を示している' },
  // ⑦ チームワーク
  { id: 19, category: 'チームワーク', text: 'チームの目標を自分のこととして考えている' },
  { id: 20, category: 'チームワーク', text: '自分の出場機会が少なくてもチームを支えられる' },
  { id: 21, category: 'チームワーク', text: '仲間の成長を素直に喜べている' },
  // ⑧ 体調管理
  { id: 22, category: '体調管理', text: '十分な睡眠と食事でコンディションを整えている' },
  { id: 23, category: '体調管理', text: 'ケガ予防のためのケアや準備運動を徹底している' },
  { id: 24, category: '体調管理', text: '体調不良のときに適切に報告・休息できている' },
  // ⑨ メンタル・切り替え
  { id: 25, category: 'メンタル・切り替え', text: '失敗してもすぐに気持ちを切り替えられる' },
  { id: 26, category: 'メンタル・切り替え', text: 'プレッシャーのある場面でも前向きに取り組める' },
  { id: 27, category: 'メンタル・切り替え', text: '不調な時期でも諦めずに取り組み続けられる' },
  // ⑩ 成長マインドセット
  { id: 28, category: '成長マインドセット', text: 'アドバイスや指摘を素直に受け入れ実行している' },
  { id: 29, category: '成長マインドセット', text: '「できない」ではなく「どうすればできるか」を考えている' },
  { id: 30, category: '成長マインドセット', text: '毎日の振り返りを通じて自分の成長を実感できている' },
]

/** カテゴリ一覧（レーダーチャートの軸として使用） */
export const EVALUATION_CATEGORIES = [
  '礼儀・挨拶', '時間管理', '集中力・主体性', 'コミュニケーション', '向上心・努力',
  '責任感', 'チームワーク', '体調管理', 'メンタル・切り替え', '成長マインドセット',
]

// ---- デモ用インメモリデータ ----

let demoEvaluationDeliveries: EvaluationDelivery[] = []
let demoEvaluationTasks: EvaluationTask[] = []
let demoEvaluationAnswers: EvaluationAnswer[] = []
let demoEvaluationPairs: EvaluationPair[] = [
  // デモ用ペア（後方互換のため残存）
  { id: 'pair-1', pair_type: 'sister', player_a_id: 'player-1', player_b_id: 'player-2', created_at: '2026-01-01T00:00:00Z' },
  { id: 'pair-2', pair_type: 'sister', player_a_id: 'player-3', player_b_id: 'player-4', created_at: '2026-01-01T00:00:00Z' },
]

// ---- デモ用グループデータ ----
let demoEvaluationGroups: EvaluationGroup[] = [
  { id: 'group-1', name: 'Aグループ', group_type: 'custom', created_by: 'staff-1', created_at: '2026-01-01T00:00:00Z' },
]
let demoEvaluationGroupMembers: EvaluationGroupMember[] = [
  { id: 'gm-1', group_id: 'group-1', user_id: 'player-1', created_at: '2026-01-01T00:00:00Z' },
  { id: 'gm-2', group_id: 'group-1', user_id: 'player-2', created_at: '2026-01-01T00:00:00Z' },
  { id: 'gm-3', group_id: 'group-1', user_id: 'player-3', created_at: '2026-01-01T00:00:00Z' },
]

let demoSscPlans: SscPlan[] = []

// ---- アンケート配信管理（コーチ専用） ----

/**
 * 過去の配信一覧を取得する（コーチ専用）。
 */
export async function getEvaluationDeliveries(): Promise<EvaluationDelivery[]> {
  if (!isSupabaseConfigured()) {
    return [...demoEvaluationDeliveries].sort(
      (a, b) => b.delivered_at.localeCompare(a.delivered_at)
    )
  }
  const { data, error } = await getSupabase()
    .from('evaluation_deliveries')
    .select('*')
    .order('delivered_at', { ascending: false })
  if (error) {
    console.error('[data] getEvaluationDeliveries() でエラーが発生しました:', error.message)
    return []
  }
  return data || []
}

/**
 * アンケートを配信する（コーチ専用）。
 * ペア設定テーブルを参照し、各選手の評価タスクを一括生成する。
 * @param label      配信名・期間ラベル（例: "2026年7月 前期"）
 * @param coachId    配信したコーチのuser_id
 * @param players    評価対象の全選手
 */
export async function deliverEvaluationTasks(
  label: string,
  coachId: string,
  players: User[],
): Promise<EvaluationDelivery> {
  const now = new Date().toISOString()
  const deliveryId = `delivery-${Date.now()}`

  if (!isSupabaseConfigured()) {
    // 新しい配信レコードを作成する
    const delivery: EvaluationDelivery = {
      id: deliveryId,
      label,
      created_by: coachId,
      delivered_at: now,
      created_at: now,
    }
    demoEvaluationDeliveries.push(delivery)

    const playerIds = players.map(p => p.id)

    // グループ設定からタスク生成対象ペアを収集する（N×(N-1)）
    const peerPairs = new Set<string>() // "evaluatorId::targetId" の重複排除用
    for (const group of demoEvaluationGroups) {
      const members = demoEvaluationGroupMembers
        .filter(m => m.group_id === group.id && playerIds.includes(m.user_id))
        .map(m => m.user_id)
      for (const evaluatorId of members) {
        for (const targetId of members) {
          if (evaluatorId !== targetId) {
            peerPairs.add(`${evaluatorId}::${targetId}`)
          }
        }
      }
    }

    for (const player of players) {
      // 自己評価タスク
      demoEvaluationTasks.push({
        id: `task-self-${deliveryId}-${player.id}`,
        delivery_id: deliveryId,
        evaluator_id: player.id,
        target_id: player.id,
        status: 'pending',
        delivered_at: now,
        completed_at: null,
        created_at: now,
      })
    }
    // グループ由来の他者評価タスク
    for (const key of Array.from(peerPairs)) {
      const [evaluatorId, targetId] = key.split('::')
      demoEvaluationTasks.push({
        id: `task-peer-${deliveryId}-${evaluatorId}-${targetId}`,
        delivery_id: deliveryId,
        evaluator_id: evaluatorId,
        target_id: targetId,
        status: 'pending',
        delivered_at: now,
        completed_at: null,
        created_at: now,
      })
    }
    return delivery
  }

  // Supabase: トランザクション的に処理する（エラー時はrollbackなし・シンプル実装）
  const supabase = getSupabase()

  // 1. 配信レコードを作成する
  //    id フィールドは渡さず、DB側の DEFAULT gen_random_uuid() に自動採番させる
  const { data: delivery, error: dErr } = await supabase
    .from('evaluation_deliveries')
    .insert({ label, created_by: coachId, delivered_at: now })
    .select()
    .single()
  if (dErr) {
    console.error('[data] deliverEvaluationTasks() 配信作成エラー:', dErr.message)
    throw dErr
  }

  // DB が自動生成した UUID を使用する
  const actualDeliveryId: string = delivery.id

  // 2. グループ設定を取得する（evaluation_groups + evaluation_group_members）
  const { data: groupRows } = await supabase.from('evaluation_groups').select('id')
  const groupIds: string[] = (groupRows || []).map((g: { id: string }) => g.id)

  const { data: memberRows } = await supabase
    .from('evaluation_group_members')
    .select('group_id, user_id')
    .in('group_id', groupIds.length > 0 ? groupIds : ['__none__'])
  const memberList: { group_id: string; user_id: string }[] = memberRows || []

  // 3. タスクを生成する（id は DB 自動採番）
  const tasks: Omit<EvaluationTask, 'id'>[] = []
  const playerIds = players.map(p => p.id)

  // 自己評価タスク
  for (const player of players) {
    tasks.push({
      delivery_id: actualDeliveryId,
      evaluator_id: player.id,
      target_id: player.id,
      status: 'pending',
      delivered_at: now,
      completed_at: null,
      created_at: now,
    })
  }

  // グループ由来の他者評価タスク（N×(N-1)、重複排除）
  const peerPairs = new Set<string>()
  for (const groupId of groupIds) {
    const members = memberList
      .filter(m => m.group_id === groupId && playerIds.includes(m.user_id))
      .map(m => m.user_id)
    for (const evaluatorId of members) {
      for (const targetId of members) {
        if (evaluatorId !== targetId) {
          peerPairs.add(`${evaluatorId}::${targetId}`)
        }
      }
    }
  }
  for (const key of Array.from(peerPairs)) {
    const [evaluatorId, targetId] = key.split('::')
    tasks.push({
      delivery_id: actualDeliveryId,
      evaluator_id: evaluatorId,
      target_id: targetId,
      status: 'pending',
      delivered_at: now,
      completed_at: null,
      created_at: now,
    })
  }

  if (tasks.length > 0) {
    const { error: tErr } = await supabase.from('evaluation_tasks').insert(tasks)
    if (tErr) {
      console.error('[data] deliverEvaluationTasks() タスク作成エラー:', tErr.message)
      throw tErr
    }
  }
  return delivery
}

// ---- タスク取得（選手側） ----

/**
 * 指定選手の未完了評価タスクを取得する。
 * ダッシュボードの通知バナー表示やアンケート画面で使用する。
 * @param evaluatorId  評価を行う選手のuser_id
 */
export async function getPendingEvaluationTasks(
  evaluatorId: string
): Promise<EvaluationTask[]> {
  if (!isSupabaseConfigured()) {
    return demoEvaluationTasks
      .filter(t => t.evaluator_id === evaluatorId && t.status === 'pending')
  }
  const { data, error } = await getSupabase()
    .from('evaluation_tasks')
    .select('*')
    .eq('evaluator_id', evaluatorId)
    .eq('status', 'pending')
    .order('delivered_at', { ascending: false })
  if (error) {
    console.error('[data] getPendingEvaluationTasks() でエラーが発生しました:', error.message)
    return []
  }
  return data || []
}

/**
 * 指定配信IDの全タスクを取得する（コーチ向け）。
 */
export async function getEvaluationTasksByDelivery(
  deliveryId: string
): Promise<EvaluationTask[]> {
  if (!isSupabaseConfigured()) {
    return demoEvaluationTasks.filter(t => t.delivery_id === deliveryId)
  }
  const { data, error } = await getSupabase()
    .from('evaluation_tasks')
    .select('*')
    .eq('delivery_id', deliveryId)
  if (error) {
    console.error('[data] getEvaluationTasksByDelivery() でエラーが発生しました:', error.message)
    return []
  }
  return data || []
}

// ---- 回答の保存・取得 ----

/**
 * 1つの評価タスクの回答を一括保存する。
 * 保存後、タスクのステータスを completed に更新する。
 * @param taskId      評価タスクID
 * @param evaluatorId 評価者ID
 * @param targetId    被評価者ID
 * @param answers     質問番号→スコアのマップ
 */
export async function submitEvaluationAnswers(
  taskId: string,
  evaluatorId: string,
  targetId: string,
  answers: Record<number, number>
): Promise<void> {
  const now = new Date().toISOString()

  if (!isSupabaseConfigured()) {
    // 回答をインメモリに保存する
    for (const [qIdStr, score] of Object.entries(answers)) {
      const qId = parseInt(qIdStr)
      // 既存回答を更新 or 新規追加
      const existIdx = demoEvaluationAnswers.findIndex(
        a => a.task_id === taskId && a.question_id === qId
      )
      const ans: EvaluationAnswer = {
        id: `ans-${taskId}-${qId}`,
        task_id: taskId,
        evaluator_id: evaluatorId,
        target_id: targetId,
        question_id: qId,
        score,
        created_at: now,
      }
      if (existIdx >= 0) {
        demoEvaluationAnswers[existIdx] = ans
      } else {
        demoEvaluationAnswers.push(ans)
      }
    }
    // タスクのステータスを completed に更新する
    const taskIdx = demoEvaluationTasks.findIndex(t => t.id === taskId)
    if (taskIdx >= 0) {
      demoEvaluationTasks[taskIdx].status = 'completed'
      demoEvaluationTasks[taskIdx].completed_at = now
    }
    return
  }

  const supabase = getSupabase()
  // 回答を一括insert（既存レコードがあればupsert）
  const rows = Object.entries(answers).map(([qIdStr, score]) => ({
    task_id: taskId,
    evaluator_id: evaluatorId,
    target_id: targetId,
    question_id: parseInt(qIdStr),
    score,
    created_at: now,
  }))
  const { error: ansErr } = await supabase
    .from('evaluation_answers')
    .upsert(rows, { onConflict: 'task_id,question_id' })
  if (ansErr) {
    console.error('[data] submitEvaluationAnswers() 回答保存エラー:', ansErr.message)
    throw ansErr
  }
  // タスクのステータスを更新する
  const { error: taskErr } = await supabase
    .from('evaluation_tasks')
    .update({ status: 'completed', completed_at: now })
    .eq('id', taskId)
  if (taskErr) {
    console.error('[data] submitEvaluationAnswers() タスク更新エラー:', taskErr.message)
    throw taskErr
  }
}

/**
 * 選手の成長推移データを配信単位で取得する。
 * 各配信の自己評価合計点・他者評価平均合計点を時系列で返す。
 * @param playerId 対象選手のuser_id
 */
export async function getEvaluationHistoryForPlayer(
  playerId: string
): Promise<{
  deliveryId: string
  label: string
  deliveredAt: string
  selfTotal: number | null       // 自己評価の全問合計（最大150点）
  othersTotal: number | null     // 他者評価の平均合計（最大150点）
}[]> {
  if (!isSupabaseConfigured()) {
    // デモ: demoEvaluationDeliveries × demoEvaluationAnswers で算出
    return demoEvaluationDeliveries
      .slice()
      .sort((a, b) => a.delivered_at.localeCompare(b.delivered_at))
      .map(delivery => {
        const taskIds = demoEvaluationTasks
          .filter(t => t.delivery_id === delivery.id)
          .map(t => t.id)
        const allAns = demoEvaluationAnswers.filter(
          a => a.target_id === playerId && taskIds.includes(a.task_id)
        )
        const selfAns = allAns.filter(a => a.evaluator_id === playerId)
        const othersAns = allAns.filter(a => a.evaluator_id !== playerId)

        const selfTotal = selfAns.length === 30
          ? selfAns.reduce((s, a) => s + a.score, 0)
          : null

        let othersTotal: number | null = null
        if (othersAns.length > 0) {
          // 評価者別に合計を出して平均を取る
          const evaluatorIds = Array.from(new Set(othersAns.map(a => a.evaluator_id)))
          const totals = evaluatorIds.map(eid => {
            const byEval = othersAns.filter(a => a.evaluator_id === eid)
            return byEval.length === 30 ? byEval.reduce((s, a) => s + a.score, 0) : null
          }).filter((v): v is number => v !== null)
          if (totals.length > 0) {
            othersTotal = Math.round(totals.reduce((s, v) => s + v, 0) / totals.length * 10) / 10
          }
        }

        return {
          deliveryId: delivery.id,
          label: delivery.label,
          deliveredAt: delivery.delivered_at,
          selfTotal,
          othersTotal,
        }
      })
      .filter(d => d.selfTotal !== null || d.othersTotal !== null)
  }

  // Supabase: delivery 一覧取得 → 各deliveryのtask/answerを集約
  const supabase = getSupabase()
  const { data: deliveries, error: dErr } = await supabase
    .from('evaluation_deliveries')
    .select('id, label, delivered_at')
    .order('delivered_at', { ascending: true })
  if (dErr || !deliveries || deliveries.length === 0) return []

  // 該当選手のタスク+回答を一括取得
  const { data: tasks } = await supabase
    .from('evaluation_tasks')
    .select('id, delivery_id, evaluator_id')
    .eq('target_id', playerId)
    .eq('status', 'completed')
  const taskList: { id: string; delivery_id: string; evaluator_id: string }[] = tasks || []
  if (taskList.length === 0) return []

  const { data: answers } = await supabase
    .from('evaluation_answers')
    .select('task_id, evaluator_id, score')
    .eq('target_id', playerId)
    .in('task_id', taskList.map(t => t.id))
  const answerList: { task_id: string; evaluator_id: string; score: number }[] = answers || []

  return deliveries.map((delivery: { id: string; label: string; delivered_at: string }) => {
    const deliveryTaskIds = taskList
      .filter(t => t.delivery_id === delivery.id)
      .map(t => t.id)
    const deliveryAnswers = answerList.filter(a => deliveryTaskIds.includes(a.task_id))

    const selfAns = deliveryAnswers.filter(a => a.evaluator_id === playerId)
    const othersAns = deliveryAnswers.filter(a => a.evaluator_id !== playerId)

    const selfTotal = selfAns.length === 30
      ? selfAns.reduce((s, a) => s + a.score, 0)
      : null

    let othersTotal: number | null = null
    if (othersAns.length > 0) {
      const evaluatorIds = Array.from(new Set(othersAns.map(a => a.evaluator_id)))
      const totals = evaluatorIds.map(eid => {
        const byEval = othersAns.filter(a => a.evaluator_id === eid)
        return byEval.length === 30 ? byEval.reduce((s, a) => s + a.score, 0) : null
      }).filter((v): v is number => v !== null)
      if (totals.length > 0) {
        othersTotal = Math.round(totals.reduce((s, v) => s + v, 0) / totals.length * 10) / 10
      }
    }

    return {
      deliveryId: delivery.id,
      label: delivery.label,
      deliveredAt: delivery.delivered_at,
      selfTotal,
      othersTotal,
    }
  }).filter(d => d.selfTotal !== null || d.othersTotal !== null)
}

/**
 * 指定選手に対する全評価回答を取得する（自己評価 + 他者評価）。
 * レーダーチャート表示に使用する。
 * @param targetId   被評価者（評価される側）のuser_id
 * @param deliveryId 絞り込む配信ID（省略で全件）
 */
export async function getEvaluationAnswersForTarget(
  targetId: string,
  deliveryId?: string
): Promise<EvaluationAnswer[]> {
  if (!isSupabaseConfigured()) {
    let answers = demoEvaluationAnswers.filter(a => a.target_id === targetId)
    if (deliveryId) {
      const taskIds = demoEvaluationTasks
        .filter(t => t.delivery_id === deliveryId)
        .map(t => t.id)
      answers = answers.filter(a => taskIds.includes(a.task_id))
    }
    return answers
  }
  let query = getSupabase()
    .from('evaluation_answers')
    .select('*')
    .eq('target_id', targetId)
  if (deliveryId) {
    // delivery_id は evaluation_tasks 経由で絞り込む
    const { data: tasks } = await getSupabase()
      .from('evaluation_tasks')
      .select('id')
      .eq('delivery_id', deliveryId)
    const taskIds = (tasks || []).map((t: { id: string }) => t.id)
    if (taskIds.length === 0) return []
    query = query.in('task_id', taskIds)
  }
  const { data, error } = await query
  if (error) {
    console.error('[data] getEvaluationAnswersForTarget() でエラーが発生しました:', error.message)
    return []
  }
  return data || []
}

/**
 * 全選手の評価回答を一括取得する（コーチ向け一覧表示用）。
 * @param deliveryId 絞り込む配信ID
 */
export async function getAllEvaluationAnswers(
  deliveryId: string
): Promise<EvaluationAnswer[]> {
  if (!isSupabaseConfigured()) {
    const taskIds = demoEvaluationTasks
      .filter(t => t.delivery_id === deliveryId)
      .map(t => t.id)
    return demoEvaluationAnswers.filter(a => taskIds.includes(a.task_id))
  }
  const { data: tasks } = await getSupabase()
    .from('evaluation_tasks')
    .select('id')
    .eq('delivery_id', deliveryId)
  const taskIds = (tasks || []).map((t: { id: string }) => t.id)
  if (taskIds.length === 0) return []
  const { data, error } = await getSupabase()
    .from('evaluation_answers')
    .select('*')
    .in('task_id', taskIds)
  if (error) {
    console.error('[data] getAllEvaluationAnswers() でエラーが発生しました:', error.message)
    return []
  }
  return data || []
}

// ---- ペア管理（コーチ専用） ----

/**
 * ペア設定一覧を取得する。
 */
export async function getEvaluationPairs(): Promise<EvaluationPair[]> {
  if (!isSupabaseConfigured()) return [...demoEvaluationPairs]
  const { data, error } = await getSupabase()
    .from('evaluation_pairs')
    .select('*')
    .order('created_at')
  if (error) {
    console.error('[data] getEvaluationPairs() でエラーが発生しました:', error.message)
    return []
  }
  return data || []
}

/**
 * ペアを追加する（コーチ専用）。
 */
export async function addEvaluationPair(
  playerAId: string,
  playerBId: string,
  pairType: string
): Promise<EvaluationPair> {
  const now = new Date().toISOString()
  if (!isSupabaseConfigured()) {
    const pair: EvaluationPair = {
      id: `pair-${Date.now()}`,
      pair_type: pairType,
      player_a_id: playerAId,
      player_b_id: playerBId,
      created_at: now,
    }
    demoEvaluationPairs.push(pair)
    return pair
  }
  const { data, error } = await getSupabase()
    .from('evaluation_pairs')
    .insert({ pair_type: pairType, player_a_id: playerAId, player_b_id: playerBId })
    .select()
    .single()
  if (error) {
    console.error('[data] addEvaluationPair() でエラーが発生しました:', error.message)
    throw error
  }
  return data
}

/**
 * ペアを削除する（コーチ専用）。
 */
export async function deleteEvaluationPair(pairId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    demoEvaluationPairs = demoEvaluationPairs.filter(p => p.id !== pairId)
    return
  }
  const { error } = await getSupabase()
    .from('evaluation_pairs')
    .delete()
    .eq('id', pairId)
  if (error) {
    console.error('[data] deleteEvaluationPair() でエラーが発生しました:', error.message)
    throw error
  }
}

// ---- 他者評価グループ管理（コーチ専用） ----

/**
 * 全グループをメンバー情報付きで取得する。
 */
export async function getEvaluationGroups(): Promise<(EvaluationGroup & { members: EvaluationGroupMember[] })[]> {
  if (!isSupabaseConfigured()) {
    return demoEvaluationGroups.map(g => ({
      ...g,
      members: demoEvaluationGroupMembers
        .filter(m => m.group_id === g.id)
        .map(m => ({
          ...m,
          users: DEMO_USERS.find(u => u.id === m.user_id)
            ? { id: m.user_id, name: DEMO_USERS.find(u => u.id === m.user_id)!.name, position: DEMO_USERS.find(u => u.id === m.user_id)!.position ?? null }
            : undefined,
        })),
    }))
  }
  const supabase = getSupabase()
  const { data: groups, error: gErr } = await supabase
    .from('evaluation_groups')
    .select('*')
    .order('created_at')
  if (gErr) {
    console.error('[data] getEvaluationGroups() でエラーが発生しました:', gErr.message)
    return []
  }
  const groupList: EvaluationGroup[] = groups || []
  if (groupList.length === 0) return []

  const { data: members, error: mErr } = await supabase
    .from('evaluation_group_members')
    .select('*, users(id, name, position)')
    .in('group_id', groupList.map(g => g.id))
  if (mErr) {
    console.error('[data] getEvaluationGroups() メンバー取得エラー:', mErr.message)
  }
  const memberList: EvaluationGroupMember[] = members || []

  return groupList.map(g => ({
    ...g,
    members: memberList.filter(m => m.group_id === g.id),
  }))
}

/**
 * グループを新規作成する。
 */
export async function addEvaluationGroup(
  name: string,
  groupType: string,
  createdBy: string,
): Promise<EvaluationGroup> {
  const now = new Date().toISOString()
  if (!isSupabaseConfigured()) {
    const group: EvaluationGroup = {
      id: `group-${Date.now()}`,
      name,
      group_type: groupType,
      created_by: createdBy,
      created_at: now,
    }
    demoEvaluationGroups.push(group)
    return group
  }
  const { data, error } = await getSupabase()
    .from('evaluation_groups')
    .insert({ name, group_type: groupType, created_by: createdBy })
    .select()
    .single()
  if (error) {
    console.error('[data] addEvaluationGroup() でエラーが発生しました:', error.message)
    throw error
  }
  return data
}

/**
 * グループ名を更新する。
 */
export async function updateEvaluationGroup(
  groupId: string,
  name: string,
): Promise<void> {
  if (!isSupabaseConfigured()) {
    const g = demoEvaluationGroups.find(x => x.id === groupId)
    if (g) g.name = name
    return
  }
  const { error } = await getSupabase()
    .from('evaluation_groups')
    .update({ name })
    .eq('id', groupId)
  if (error) {
    console.error('[data] updateEvaluationGroup() でエラーが発生しました:', error.message)
    throw error
  }
}

/**
 * グループをメンバーごと削除する。
 */
export async function deleteEvaluationGroup(groupId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    demoEvaluationGroups = demoEvaluationGroups.filter(g => g.id !== groupId)
    demoEvaluationGroupMembers = demoEvaluationGroupMembers.filter(m => m.group_id !== groupId)
    return
  }
  // メンバーは ON DELETE CASCADE で自動削除される
  const { error } = await getSupabase()
    .from('evaluation_groups')
    .delete()
    .eq('id', groupId)
  if (error) {
    console.error('[data] deleteEvaluationGroup() でエラーが発生しました:', error.message)
    throw error
  }
}

/**
 * グループにメンバーを追加する。
 */
export async function addEvaluationGroupMember(
  groupId: string,
  userId: string,
): Promise<EvaluationGroupMember> {
  const now = new Date().toISOString()
  if (!isSupabaseConfigured()) {
    const member: EvaluationGroupMember = {
      id: `gm-${Date.now()}`,
      group_id: groupId,
      user_id: userId,
      created_at: now,
      users: (() => {
        const u = DEMO_USERS.find(x => x.id === userId)
        return u ? { id: u.id, name: u.name, position: u.position ?? null } : undefined
      })(),
    }
    demoEvaluationGroupMembers.push(member)
    return member
  }
  const { data, error } = await getSupabase()
    .from('evaluation_group_members')
    .insert({ group_id: groupId, user_id: userId })
    .select('*, users(id, name, position)')
    .single()
  if (error) {
    console.error('[data] addEvaluationGroupMember() でエラーが発生しました:', error.message)
    throw error
  }
  return data
}

/**
 * グループからメンバーを削除する。
 */
export async function removeEvaluationGroupMember(memberId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    demoEvaluationGroupMembers = demoEvaluationGroupMembers.filter(m => m.id !== memberId)
    return
  }
  const { error } = await getSupabase()
    .from('evaluation_group_members')
    .delete()
    .eq('id', memberId)
  if (error) {
    console.error('[data] removeEvaluationGroupMember() でエラーが発生しました:', error.message)
    throw error
  }
}

// ---- SSC（Start/Stop/Continue）アクションプラン ----

/**
 * 指定選手の最新SSCアクションプランを取得する。
 * 日々の入力画面の目標候補・マンダラチャートのサジェストに連動する。
 * @param userId 対象ユーザーのID
 */
export async function getLatestSscPlan(userId: string): Promise<SscPlan | null> {
  if (!isSupabaseConfigured()) {
    const plans = demoSscPlans.filter(p => p.user_id === userId)
    if (plans.length === 0) return null
    return plans.sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]
  }
  const { data, error } = await getSupabase()
    .from('ssc_plans')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('[data] getLatestSscPlan() でエラーが発生しました:', error.message)
    return null
  }
  return data
}

/**
 * SSCアクションプランを保存（upsert）する。
 * 同一配信IDに対して既に保存済みの場合は上書きする。
 * @param plan 保存するSSCプラン（id・created_at不要）
 */
export async function saveSscPlan(
  plan: Omit<SscPlan, 'id' | 'created_at'>
): Promise<SscPlan> {
  const now = new Date().toISOString()
  if (!isSupabaseConfigured()) {
    const existIdx = demoSscPlans.findIndex(
      p => p.user_id === plan.user_id && p.delivery_id === plan.delivery_id
    )
    if (existIdx >= 0) {
      demoSscPlans[existIdx] = { ...demoSscPlans[existIdx], ...plan, updated_at: now }
      return demoSscPlans[existIdx]
    }
    const newPlan: SscPlan = {
      id: `ssc-${Date.now()}`,
      ...plan,
      created_at: now,
    }
    demoSscPlans.push(newPlan)
    return newPlan
  }
  const { data, error } = await getSupabase()
    .from('ssc_plans')
    .upsert({ ...plan, updated_at: now }, { onConflict: 'user_id,delivery_id' })
    .select()
    .single()
  if (error) {
    console.error('[data] saveSscPlan() でエラーが発生しました:', error.message)
    throw error
  }
  return data
}

// ---- 評価スコア集計ユーティリティ ----

/**
 * 回答リストからカテゴリ別平均スコアを算出する。
 * レーダーチャート描画に使用する。
 * @param answers      対象の回答リスト
 * @param evaluatorId  自己評価の場合は自分のID、他者評価の場合は null（全他者評価の平均）
 */
export function calcCategoryScores(
  answers: EvaluationAnswer[],
  evaluatorId?: string
): Record<string, number> {
  const filtered = evaluatorId
    ? answers.filter(a => a.evaluator_id === evaluatorId)
    : answers

  const result: Record<string, { sum: number; count: number }> = {}
  for (const q of EVALUATION_QUESTIONS) {
    if (!result[q.category]) result[q.category] = { sum: 0, count: 0 }
    const ans = filtered.find(a => a.question_id === q.id)
    if (ans) {
      result[q.category].sum += ans.score
      result[q.category].count++
    }
  }
  const out: Record<string, number> = {}
  for (const cat of EVALUATION_CATEGORIES) {
    const d = result[cat]
    out[cat] = d && d.count > 0 ? Math.round((d.sum / d.count) * 10) / 10 : 0
  }
  return out
}

