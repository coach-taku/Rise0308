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
  // ============================================================
  // グロースマインドセット自動スコアリング（2026-07-14 追加）
  // LLMによる判定結果。振り返り保存時にサーバーサイドAPIが非同期で設定する。
  // 未スコアリングの場合は null。
  // ============================================================
  mindset_score?: number | null    // 1〜4 の整数スコア（1:固定 → 4:深いメタ認知）
  mindset_feedback?: string | null // LLMが生成した判定理由テキスト
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
// スタッツ管理機能（試合パフォーマンスデータ）
// ============================================================

/**
 * 試合ごとのスタッツデータ（ゲーム情報）。
 * コーチがCSVインポートで登録し、コーチ・選手双方が閲覧できる。
 */
export interface GameStat {
  id: string
  game_date: string           // 試合日 (YYYY-MM-DD)
  opponent: string            // 対戦相手チーム名
  game_type: string           // 試合種別（例: 練習試合 / 公式戦 / etc.）
  game_minutes: number        // 試合時間（分）。PER40換算に使用
  player_name: string         // 選手名（手動選択。usersとの自動マッチングなし）
  // 基本スタッツ
  minutes_played: number      // 出場時間（分）
  points: number              // 得点
  rebounds: number            // リバウンド
  assists: number             // アシスト
  steals: number              // スティール
  blocks: number              // ブロック
  turnovers: number           // ターンオーバー
  fouls: number               // ファウル
  // シュートスタッツ（3P: 33%, 2P: 50%, FT: 75% がKPI基準）
  fg3_made: number            // 3P成功数
  fg3_attempted: number       // 3P試投数
  fg2_made: number            // 2P成功数
  fg2_attempted: number       // 2P試投数
  ft_made: number             // FT成功数
  ft_attempted: number        // FT試投数
  // メタデータ
  imported_by: string         // インポートしたコーチの user_id
  created_at: string
}

/**
 * PER40（40分換算）スタッツ計算用ユーティリティ型。
 * 実際の出場時間に関係なく40分あたりの数値に正規化する。
 */
export interface GameStatPer40 {
  points_per40: number | null
  rebounds_per40: number | null
  assists_per40: number | null
  steals_per40: number | null
  blocks_per40: number | null
  turnovers_per40: number | null
}

/**
 * CSVインポート時の1行データ（バリデーション前の生データ）。
 * CSVの列名と対応する。
 */
export interface CsvStatRow {
  game_date?: string
  opponent?: string
  game_type?: string
  game_minutes?: string
  player_name?: string
  minutes_played?: string
  points?: string
  rebounds?: string
  assists?: string
  steals?: string
  blocks?: string
  turnovers?: string
  fouls?: string
  fg3_made?: string
  fg3_attempted?: string
  fg2_made?: string
  fg2_attempted?: string
  ft_made?: string
  ft_attempted?: string
  [key: string]: string | undefined
}
