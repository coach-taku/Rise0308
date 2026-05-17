import { User, Tournament, MandalaChart, DailyRecord, DailyRecordWithUser, Comment, PhysicalRecord, MaxTrainingRecord } from '@/types/database'
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
  for (let dayOffset = 14; dayOffset >= 0; dayOffset--) {
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
    }
    demoMandala[chart.user_id] = newChart
    return newChart
  }
  const { data, error } = await getSupabase().from('mandala_charts').upsert(chart).select().single()
  if (error) throw error
  return data
}

// ---------- Daily Records ----------

export async function getDailyRecords(userId: string, startDate?: string, endDate?: string): Promise<DailyRecord[]> {
  if (!isSupabaseConfigured()) {
    let records = demoRecords.filter(r => r.user_id === userId)
    if (startDate) records = records.filter(r => r.record_date >= startDate)
    if (endDate) records = records.filter(r => r.record_date <= endDate)
    return records.sort((a, b) => a.record_date.localeCompare(b.record_date))
  }
  let query = getSupabase().from('daily_records').select('*').eq('user_id', userId).order('record_date')
  if (startDate) query = query.gte('record_date', startDate)
  if (endDate) query = query.lte('record_date', endDate)
  const { data, error } = await query
  if (error) throw error
  return data || []
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


