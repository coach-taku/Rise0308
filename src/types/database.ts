// ============================================================
// Types matching the new Supabase table schema (no RLS)
// ============================================================

export interface User {
  id: string
  name: string
  role: 'player' | 'staff'
  password: string
  position?: string | null  // ポジション（選手の場合）
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

// ============================================================
// カルテ機能（身体測定・MAX測定）
// ============================================================

// 身体測定データ
export interface PhysicalRecord {
  id: string
  user_id: string
  measured_date: string       // 測定日 (YYYY-MM-DD)
  height_cm: number | null    // 身長 (cm)
  weight_kg: number | null    // 体重 (kg)
  body_fat_pct: number | null // 体脂肪率 (%)
  muscle_mass_kg: number | null // 筋肉量 (kg)
  created_at: string
}

// MAX測定データ（ウェイトトレーニング）
export interface MaxTrainingRecord {
  id: string
  user_id: string
  measured_date: string       // 測定日 (YYYY-MM-DD)
  bench_press_kg: number | null  // ベンチプレス (kg)
  squat_kg: number | null        // スクワット (kg)
  deadlift_kg: number | null     // デッドリフト (kg)
  created_at: string
}
