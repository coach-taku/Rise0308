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

// ============================================================
// Session RPE機能（練習時間・トレーニング負荷管理）
// ============================================================

/**
 * コーチが入力する日々の練習時間を記録するテーブル。
 * Session RPE = 練習時間（分） × 疲労度（1〜10） で算出する。
 * コーチ権限のみが入力・閲覧する（選手側には表示しない）。
 */
export interface PracticeSession {
  id: string
  session_date: string        // 練習日 (YYYY-MM-DD)
  duration_minutes: number    // 練習時間（分）
  created_by: string          // 登録したコーチの user_id
  created_at: string
  updated_at: string
}

// ============================================================
// スタッツ機能（試合パフォーマンス記録・分析）
// ============================================================

/**
 * 試合（ゲーム）単位のメタ情報を保持するテーブル。
 * コーチがCSVインポートするときに1行作成される。
 * 試合種別（公式戦 / 練習試合 / リーグ戦 / その他）や
 * 試合時間（分）をタグとして付与できる。
 */
export interface GameStat {
  id: string
  game_date: string           // 試合日 (YYYY-MM-DD)
  opponent: string            // 対戦相手チーム名
  game_type: '公式戦' | '練習試合' | 'リーグ戦' | 'その他'  // 試合種別
  game_minutes: number        // 試合時間（分）
  created_by: string          // 登録コーチの user_id
  created_at: string
}

/**
 * 選手1人×1試合のスタッツデータ。
 * GameStat の子レコード。
 * player_name はCSVから読み込んだ名前をそのまま保持する（手動選択との紐付けに使用）。
 */
export interface GameStatEntry {
  id: string
  game_stat_id: string        // game_stats.id への外部キー
  player_name: string         // CSVから読み込んだ選手名（手動紐付け用）
  user_id: string | null      // 紐付けた users.id（手動選択後にセット・null可）
  minutes_played: number      // 出場時間（分）
  // シュート系
  fg_made: number             // FG成功数（フィールドゴール）
  fg_attempted: number        // FG試投数
  three_made: number          // 3P成功数
  three_attempted: number     // 3P試投数
  two_made: number            // 2P成功数（fg_made - three_made で算出可）
  two_attempted: number       // 2P試投数（fg_attempted - three_attempted で算出可）
  ft_made: number             // FT成功数（フリースロー）
  ft_attempted: number        // FT試投数
  // その他スタッツ
  rebounds: number            // リバウンド
  assists: number             // アシスト
  steals: number              // スティール
  blocks: number              // ブロック
  turnovers: number           // ターンオーバー
  points: number              // 得点（ft_made + two_made*2 + three_made*3 で算出可）
  created_at: string
}

/** 表示用の型（GameStat + entries を結合したもの） */
export interface GameStatWithEntries extends GameStat {
  entries: GameStatEntry[]
}

/**
 * PER40換算値（40分あたりの生産性指標）。
 * 実際の出場時間を40分に正規化したスタッツ。
 * フロントエンド側で計算して表示する（DBには保存しない）。
 */
export interface Per40Stats {
  points: number
  rebounds: number
  assists: number
  steals: number
  blocks: number
  turnovers: number
  fg_pct: number              // FG成功率 (%)
  three_pct: number           // 3P成功率 (%)
  ft_pct: number              // FT成功率 (%)
}

/**
 * KPI目標値（修正要件定義書に記載の基準）
 * 3P: 33%, 2P: 50%, FT: 75%
 */
export const STATS_KPI = {
  three_pct: 33,   // 3P成功率目標 (%)
  two_pct: 50,     // 2P成功率目標 (%)
  ft_pct: 75,      // FT成功率目標 (%)
} as const
