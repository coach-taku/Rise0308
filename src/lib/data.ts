import { Profile, Tournament, MandalaChart, DailyRecord, Group, Comment } from '@/types/database'
import { supabase, isSupabaseConfigured, ensureAuthSession } from './supabase'

// ============================================================
// Demo mode data store (when Supabase is not configured)
// ============================================================

const DEMO_PROFILES: Profile[] = [
  { id: 'player-1', name: '山田 花子', email: 'player1@risenote.local', role: 'player', group_id: 'group-1', total_points: 156, created_at: '2025-12-01T00:00:00Z' },
  { id: 'player-2', name: '鈴木 美咲', email: 'player2@risenote.local', role: 'player', group_id: 'group-1', total_points: 203, created_at: '2025-12-01T00:00:00Z' },
  { id: 'player-3', name: '佐藤 遥', email: 'player3@risenote.local', role: 'player', group_id: 'group-2', total_points: 178, created_at: '2025-12-01T00:00:00Z' },
  { id: 'player-4', name: '田中 結衣', email: 'player4@risenote.local', role: 'player', group_id: 'group-2', total_points: 145, created_at: '2025-12-01T00:00:00Z' },
  { id: 'coach-1', name: '高橋 コーチ', email: 'coach1@risenote.local', role: 'coach', group_id: null, total_points: 0, created_at: '2025-12-01T00:00:00Z' },
  { id: 'coach-2', name: '伊藤 監督', email: 'coach2@risenote.local', role: 'coach', group_id: null, total_points: 0, created_at: '2025-12-01T00:00:00Z' },
]

const DEMO_GROUPS: Group[] = [
  { id: 'group-1', name: 'グループA' },
  { id: 'group-2', name: 'グループB' },
]

const DEMO_TOURNAMENTS: Tournament[] = [
  { id: 'tournament-1', name: 'インターハイ予選', target_date: '2026-06-15', is_active: true },
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
      if (Math.random() < 0.15) continue // 15% chance of no entry

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
        target_date: dateStr,
        sleep_hours: Math.round(sleepHours * 10) / 10,
        fatigue_level: fatigue,
        has_pain: hasPain,
        pain_details: hasPain ? '右膝に軽い違和感' : '',
        participation_status: statuses[statusIdx],
        selected_goals: goals[pi].slice(0, Math.floor(Math.random() * 2) + 1),
        self_evaluation: evaluation,
        reflection_text: reflections[reflectionIdx],
        earned_points: earnedPoints,
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
        record_id: record.id,
        user_id: commenterId,
        content: commentTexts[Math.floor(Math.random() * commentTexts.length)],
        created_at: record.created_at,
      })
    }
    if (Math.random() < 0.3) {
      comments.push({
        id: `comment-coach-${idx}`,
        record_id: record.id,
        user_id: 'coach-1',
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
  main_elements: [
    'シュート力', 'ディフェンス', '体力', 'パス・連携',
    'メンタル', '知識・戦術', 'チームワーク', '生活習慣'
  ],
  sub_goals: [
    ['レイアップ精度UP', 'ミドルシュート練習', '3Pシュート挑戦', 'フリースロー成功率UP', 'シュートフォーム確認', 'ゲームでのシュート判断', '毎日シュート100本', 'シュートの自信をつける'],
    ['1on1で負けない', 'スライドステップ強化', 'ボールマンプレッシャー', 'ヘルプディフェンス', 'スクリーンアウト', 'ローテーション理解', 'コミュニケーション', 'ディフェンスの姿勢維持'],
    ['持久走タイム向上', '体幹トレーニング毎日', '下半身強化', 'アジリティ向上', 'ストレッチ習慣化', '食事管理', 'ランニング週3回', '疲労回復意識'],
    ['ノールックパス練習', 'バウンドパス精度', 'ロングパス', '速攻時の判断', 'ピック&ロール連携', 'アシスト意識', '2on1の判断', 'パスフェイク'],
    ['試合で緊張しない', 'ミスを引きずらない', '声を出す', '自信を持つ', 'チームを鼓舞する', 'ポジティブ思考', 'イメージトレーニング', 'ルーティン確立'],
    ['相手チーム分析', 'NBA動画研究', 'セットプレー理解', 'ゾーンディフェンス対策', 'プレスブレイク', 'タイムアウト後の動き', 'ルール完全理解', '戦術ノート作成'],
    ['仲間を褒める', '弱点を補い合う', '練習中の声かけ', 'ベンチからの応援', '後輩の面倒を見る', '先輩に学ぶ', '全員で目標共有', '信頼関係構築'],
    ['早寝早起き', '栄養バランス', '水分補給', '睡眠7時間以上', '学業との両立', '時間管理', 'ケガ予防', '体重管理'],
  ],
  updated_at: '2026-01-15T00:00:00Z',
  created_at: '2026-01-15T00:00:00Z',
}

// In-memory store for demo mode
let demoRecords = generateDemoRecords()
let demoComments = generateDemoComments(demoRecords)
let demoProfiles = [...DEMO_PROFILES]
let demoTournaments = [...DEMO_TOURNAMENTS]
let demoMandala: Record<string, MandalaChart> = { 'player-1': DEMO_MANDALA }

// ============================================================
// Data access functions - works with Supabase or demo mode
// ============================================================

export async function getProfiles(): Promise<Profile[]> {
  if (!isSupabaseConfigured()) return demoProfiles

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('name')
  if (error) throw error
  return data || []
}

export async function getProfile(userId: string): Promise<Profile | null> {
  if (!isSupabaseConfigured()) {
    return demoProfiles.find(p => p.id === userId) || null
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .limit(1)
  if (error) return null
  return data && data.length > 0 ? data[0] : null
}

export async function updateProfilePoints(userId: string, points: number): Promise<void> {
  if (!isSupabaseConfigured()) {
    const profile = demoProfiles.find(p => p.id === userId)
    if (profile) profile.total_points += points
    return
  }

  const { error } = await supabase.rpc('increment_points', {
    user_id: userId,
    points_to_add: points,
  })
  if (error) {
    // Fallback: fetch and update
    const profile = await getProfile(userId)
    if (profile) {
      await supabase
        .from('profiles')
        .update({ total_points: profile.total_points + points })
        .eq('id', userId)
    }
  }
}

export async function loginUser(name: string, password: string): Promise<Profile | null> {
  if (!isSupabaseConfigured()) {
    // Demo mode: accept any password
    const profile = demoProfiles.find(p => p.name === name)
    return profile || null
  }

  // Find profile by name to get email
  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .eq('name', name)
    .limit(1)

  if (!profiles || profiles.length === 0) return null

  const profile = profiles[0]

  // Use email from profile if available
  let email = profile.email
  if (!email) {
    email = `${profile.id}@risenote.local`
  }

  // Sign in with Supabase Auth
  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) {
    console.error('Supabase Auth login error:', error)
    return null
  }

  // IMPORTANT: Use the auth user ID to ensure consistency with RLS auth.uid()
  // The auth user ID may differ from the profile ID if setup was inconsistent
  const authUserId = authData.user?.id
  if (authUserId && authUserId !== profile.id) {
    console.warn('Auth user ID differs from profile ID. Using auth user ID:', authUserId)
    // Try to get the profile matching the auth user ID
    const { data: authProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUserId)
      .limit(1)
    if (authProfile && authProfile.length > 0) {
      return authProfile[0]
    }
    // If no profile exists for this auth user, return profile with corrected id
    return { ...profile, id: authUserId }
  }

  return profile
}

export async function logoutUser(): Promise<void> {
  if (isSupabaseConfigured()) {
    await supabase.auth.signOut()
  }
  localStorage.removeItem('rise_note_session')
}

// Tournament functions
export async function getTournaments(): Promise<Tournament[]> {
  if (!isSupabaseConfigured()) return demoTournaments

  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .order('target_date', { ascending: true })
  if (error) throw error
  return data || []
}

export async function getActiveTournament(): Promise<Tournament | null> {
  if (!isSupabaseConfigured()) {
    return demoTournaments.find(t => t.is_active) || null
  }

  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('is_active', true)
    .limit(1)
  if (error) return null
  return data && data.length > 0 ? data[0] : null
}

export async function upsertTournament(tournament: Partial<Tournament> & { name: string; target_date: string }): Promise<Tournament> {
  if (!isSupabaseConfigured()) {
    if (tournament.id) {
      const idx = demoTournaments.findIndex(t => t.id === tournament.id)
      if (idx >= 0) {
        demoTournaments[idx] = { ...demoTournaments[idx], ...tournament }
        return demoTournaments[idx]
      }
    }
    const newT: Tournament = {
      id: `tournament-${Date.now()}`,
      name: tournament.name,
      target_date: tournament.target_date,
      is_active: tournament.is_active ?? true,
    }
    // Deactivate others if this is active
    if (newT.is_active) {
      demoTournaments.forEach(t => t.is_active = false)
    }
    demoTournaments.push(newT)
    return newT
  }

  // Deactivate others if setting active
  if (tournament.is_active) {
    await supabase.from('tournaments').update({ is_active: false }).neq('id', tournament.id || '')
  }

  const { data, error } = await supabase
    .from('tournaments')
    .upsert(tournament)
    .select()
  if (error) throw error
  return data![0]
}

// Mandala Chart functions
export async function getMandalaChart(userId: string): Promise<MandalaChart | null> {
  if (!isSupabaseConfigured()) {
    return demoMandala[userId] || null
  }

  const { data, error } = await supabase
    .from('mandala_charts')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
  if (error) {
    console.error('getMandalaChart error:', error)
    return null
  }
  return data && data.length > 0 ? data[0] : null
}

export async function saveMandalaChart(chart: Partial<MandalaChart> & { user_id: string }): Promise<MandalaChart> {
  if (!isSupabaseConfigured()) {
    const existing = demoMandala[chart.user_id]
    if (existing) {
      const updated = { ...existing, ...chart, updated_at: new Date().toISOString() }
      demoMandala[chart.user_id] = updated
      return updated
    }
    const newChart: MandalaChart = {
      id: `mandala-${Date.now()}`,
      user_id: chart.user_id,
      core_goal: chart.core_goal || '',
      main_elements: chart.main_elements || Array(8).fill(''),
      sub_goals: chart.sub_goals || Array(8).fill(Array(8).fill('')),
      updated_at: new Date().toISOString(),
    }
    demoMandala[chart.user_id] = newChart
    return newChart
  }

  // Ensure user is authenticated for RLS - use auth.uid() as the canonical user_id
  const authUserId = await ensureAuthSession()
  if (!authUserId) {
    throw new Error('認証セッションが見つかりません。再ログインしてください。')
  }

  // Use auth user ID to match RLS policy (auth.uid() = user_id)
  const effectiveUserId = authUserId

  // First check if a chart already exists for this user
  const existing = await getMandalaChart(effectiveUserId)
  const now = new Date().toISOString()

  if (existing) {
    // Update existing chart
    const { data, error } = await supabase
      .from('mandala_charts')
      .update({
        core_goal: chart.core_goal,
        main_elements: chart.main_elements,
        sub_goals: chart.sub_goals,
        updated_at: now,
      })
      .eq('id', existing.id)
      .select()
    if (error) {
      console.error('saveMandalaChart update error:', error)
      throw error
    }
    return data && data.length > 0 ? data[0] : existing
  } else {
    // Insert new chart - use auth user ID as user_id
    const { data, error } = await supabase
      .from('mandala_charts')
      .insert({
        user_id: effectiveUserId,
        core_goal: chart.core_goal || '',
        main_elements: chart.main_elements || [],
        sub_goals: chart.sub_goals || [],
        updated_at: now,
      })
      .select()
    if (error) {
      console.error('saveMandalaChart insert error:', error)
      throw error
    }
    return data![0]
  }
}

// Daily Record functions
export async function getDailyRecords(userId: string, startDate?: string, endDate?: string): Promise<DailyRecord[]> {
  if (!isSupabaseConfigured()) {
    let records = demoRecords.filter(r => r.user_id === userId)
    if (startDate) records = records.filter(r => r.target_date >= startDate)
    if (endDate) records = records.filter(r => r.target_date <= endDate)
    return records.sort((a, b) => a.target_date.localeCompare(b.target_date))
  }

  let query = supabase
    .from('daily_records')
    .select('*')
    .eq('user_id', userId)
    .order('target_date', { ascending: true })

  if (startDate) query = query.gte('target_date', startDate)
  if (endDate) query = query.lte('target_date', endDate)

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function getAllDailyRecords(startDate?: string, endDate?: string): Promise<DailyRecordWithProfile[]> {
  if (!isSupabaseConfigured()) {
    let records = [...demoRecords]
    if (startDate) records = records.filter(r => r.target_date >= startDate)
    if (endDate) records = records.filter(r => r.target_date <= endDate)
    return records
      .sort((a, b) => b.target_date.localeCompare(a.target_date))
      .map(r => ({
        ...r,
        profiles: demoProfiles.find(p => p.id === r.user_id),
        comments: demoComments.filter(c => c.record_id === r.id),
      }))
  }

  let query = supabase
    .from('daily_records')
    .select('*, profiles(*), comments(*)')
    .order('target_date', { ascending: false })

  if (startDate) query = query.gte('target_date', startDate)
  if (endDate) query = query.lte('target_date', endDate)

  const { data, error } = await query
  if (error) throw error
  return data || []
}

import { DailyRecordWithProfile } from '@/types/database'

export async function getDailyRecord(userId: string, targetDate: string): Promise<DailyRecord | null> {
  if (!isSupabaseConfigured()) {
    return demoRecords.find(r => r.user_id === userId && r.target_date === targetDate) || null
  }

  const { data, error } = await supabase
    .from('daily_records')
    .select('*')
    .eq('user_id', userId)
    .eq('target_date', targetDate)
    .limit(1)
  if (error) {
    console.error('getDailyRecord error:', error)
    return null
  }
  return data && data.length > 0 ? data[0] : null
}

export async function saveDailyRecord(record: Partial<DailyRecord> & { user_id: string; target_date: string }): Promise<DailyRecord> {
  if (!isSupabaseConfigured()) {
    const existingIdx = demoRecords.findIndex(
      r => r.user_id === record.user_id && r.target_date === record.target_date
    )
    if (existingIdx >= 0) {
      demoRecords[existingIdx] = { ...demoRecords[existingIdx], ...record }
      return demoRecords[existingIdx]
    }
    const newRecord: DailyRecord = {
      id: `record-${Date.now()}`,
      user_id: record.user_id,
      target_date: record.target_date,
      sleep_hours: record.sleep_hours || 7,
      fatigue_level: record.fatigue_level || 5,
      has_pain: record.has_pain || false,
      pain_details: record.pain_details || '',
      participation_status: record.participation_status || '参加',
      selected_goals: record.selected_goals || [],
      self_evaluation: record.self_evaluation || 5,
      reflection_text: record.reflection_text || '',
      earned_points: record.earned_points || 0,
      created_at: new Date().toISOString(),
    }
    demoRecords.push(newRecord)
    return newRecord
  }

  // Ensure user is authenticated for RLS - use auth.uid() as the canonical user_id
  const authUserId = await ensureAuthSession()
  if (!authUserId) {
    throw new Error('認証セッションが見つかりません。再ログインしてください。')
  }

  // Use auth user ID to match RLS policy (auth.uid() = user_id)
  const effectiveUserId = authUserId

  // Check if record already exists
  const existing = await getDailyRecord(effectiveUserId, record.target_date)

  if (existing) {
    // Update existing record
    const { data, error } = await supabase
      .from('daily_records')
      .update({
        sleep_hours: record.sleep_hours,
        fatigue_level: record.fatigue_level,
        has_pain: record.has_pain,
        pain_details: record.pain_details,
        participation_status: record.participation_status,
        selected_goals: record.selected_goals,
        self_evaluation: record.self_evaluation,
        reflection_text: record.reflection_text,
        earned_points: record.earned_points,
      })
      .eq('id', existing.id)
      .select()
    if (error) {
      console.error('saveDailyRecord update error:', error)
      throw error
    }
    return data && data.length > 0 ? data[0] : existing
  } else {
    // Insert new record - use auth user ID as user_id
    const { data, error } = await supabase
      .from('daily_records')
      .insert({
        user_id: effectiveUserId,
        target_date: record.target_date,
        sleep_hours: record.sleep_hours ?? 7,
        fatigue_level: record.fatigue_level ?? 5,
        has_pain: record.has_pain ?? false,
        pain_details: record.pain_details ?? '',
        participation_status: record.participation_status ?? '参加',
        selected_goals: record.selected_goals ?? [],
        self_evaluation: record.self_evaluation ?? 5,
        reflection_text: record.reflection_text ?? '',
        earned_points: record.earned_points ?? 0,
      })
      .select()
    if (error) {
      console.error('saveDailyRecord insert error:', error)
      throw error
    }
    return data![0]
  }
}

// Comment functions
export async function getComments(recordId: string): Promise<Comment[]> {
  if (!isSupabaseConfigured()) {
    return demoComments
      .filter(c => c.record_id === recordId)
      .map(c => ({
        ...c,
        profiles: demoProfiles.find(p => p.id === c.user_id),
      }))
  }

  const { data, error } = await supabase
    .from('comments')
    .select('*, profiles(*)')
    .eq('record_id', recordId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function addComment(recordId: string, userId: string, content: string): Promise<Comment> {
  if (!isSupabaseConfigured()) {
    const newComment: Comment = {
      id: `comment-${Date.now()}`,
      record_id: recordId,
      user_id: userId,
      content,
      created_at: new Date().toISOString(),
      profiles: demoProfiles.find(p => p.id === userId),
    }
    demoComments.push(newComment)
    return newComment
  }

  const { data, error } = await supabase
    .from('comments')
    .insert({ record_id: recordId, user_id: userId, content })
    .select('*, profiles(*)')
  if (error) throw error
  return data![0]
}

// Group functions
export async function getGroups(): Promise<Group[]> {
  if (!isSupabaseConfigured()) return DEMO_GROUPS

  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .order('name')
  if (error) throw error
  return data || []
}

export async function getGroupMembers(groupId: string): Promise<Profile[]> {
  if (!isSupabaseConfigured()) {
    return demoProfiles.filter(p => p.group_id === groupId)
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('group_id', groupId)
  if (error) throw error
  return data || []
}

export async function getTeamRecordsWithProfiles(date?: string): Promise<DailyRecordWithProfile[]> {
  if (!isSupabaseConfigured()) {
    const targetDate = date || new Date().toISOString().split('T')[0]
    const records = demoRecords
      .filter(r => r.target_date === targetDate)
      .map(r => ({
        ...r,
        profiles: demoProfiles.find(p => p.id === r.user_id),
      }))
    return records
  }

  const targetDate = date || new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('daily_records')
    .select('*, profiles(*)')
    .eq('target_date', targetDate)
  if (error) throw error
  return data || []
}
