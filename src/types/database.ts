// ============================================================
// Types matching the new Supabase table schema (no RLS)
// ============================================================

export interface User {
  id: string
  name: string
  role: 'player' | 'staff'
  password: string
}

export interface Tournament {
  id: string
  name: string
  target_date: string
}

export interface MandalaChart {
  id: string
  user_id: string
  core_goal: string
  elements: string[]       // 8 main elements
  actions: string[][]      // 8x8 = 64 actions
  target_date: string | null
  created_at: string
}

export interface DailyRecord {
  id: string
  user_id: string
  record_date: string
  sleep_hours: number
  fatigue_level: number
  has_pain: boolean
  pain_detail: string
  participation_status: '参加' | 'リハビリ' | '体調不良' | '通院' | 'REST'
  target_items: string[]
  self_evaluation: number
  reflection: string
  points: number
  created_at: string
}

export interface Comment {
  id: string
  daily_record_id: string
  user_id: string
  content: string
  created_at: string
  // joined
  users?: User
}

export interface DailyRecordWithUser extends DailyRecord {
  users?: User
  comments?: Comment[]
}
