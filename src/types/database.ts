export interface Profile {
  id: string
  name: string
  email?: string
  role: 'player' | 'coach'
  group_id: string | null
  total_points: number
  created_at: string
}

export interface Tournament {
  id: string
  name: string
  target_date: string
  is_active: boolean
  created_at?: string
}

export interface MandalaChart {
  id: string
  user_id: string
  core_goal: string
  main_elements: string[]
  sub_goals: string[][]
  updated_at: string
  created_at?: string
}

export interface DailyRecord {
  id: string
  user_id: string
  target_date: string
  sleep_hours: number
  fatigue_level: number
  has_pain: boolean
  pain_details: string
  participation_status: '参加' | 'リハビリ' | '体調不良で欠席' | '通院のため欠席' | 'REST'
  selected_goals: string[]
  self_evaluation: number
  reflection_text: string
  earned_points: number
  created_at: string
}

export interface Group {
  id: string
  name: string
}

export interface Comment {
  id: string
  record_id: string
  user_id: string
  content: string
  created_at: string
  // joined
  profiles?: Profile
}

export interface DailyRecordWithProfile extends DailyRecord {
  profiles?: Profile
  comments?: Comment[]
}
