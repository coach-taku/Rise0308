-- ============================================================
-- KUKI GYMRATS RISE NOTE - Database Migration
-- Run this SQL in Supabase SQL Editor
-- ============================================================
-- NOTE: RLSは使用しない。アクセス制御はクライアント側のlocalStorageに
-- 保存されたuser_idとroleを用いてWHERE句で行う。

-- 1. Users table (認証もここで管理)
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('player', 'staff')),
  password TEXT NOT NULL,
  position TEXT  -- ポジション（選手の場合に使用。例: PG / SG / SF / PF / C）
);

-- 既存テーブルへの position カラム追加（既存環境向け ALTER TABLE）
-- ※ CREATE TABLE IF NOT EXISTS で新規作成する場合は上記の定義が適用される
-- ※ 既存の Supabase プロジェクトにこのマイグレーションを適用する場合は以下を実行
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS position TEXT;

-- 2. Tournaments table
CREATE TABLE IF NOT EXISTS tournaments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  target_date DATE NOT NULL
);

-- 3. Mandala Charts table
CREATE TABLE IF NOT EXISTS mandala_charts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  core_goal TEXT NOT NULL DEFAULT '',
  elements JSONB NOT NULL DEFAULT '[]'::jsonb,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Daily Records table
CREATE TABLE IF NOT EXISTS daily_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  record_date DATE NOT NULL,
  sleep_hours NUMERIC(3,1) DEFAULT 7.0,
  fatigue_level INTEGER DEFAULT 5 CHECK (fatigue_level BETWEEN 1 AND 10),
  has_pain BOOLEAN DEFAULT false,
  pain_detail TEXT DEFAULT '',
  participation_status TEXT DEFAULT '参加' CHECK (participation_status IN ('参加', 'リハビリ', '体調不良', '通院', 'REST')),
  target_items JSONB DEFAULT '[]'::jsonb,
  self_evaluation INTEGER DEFAULT 5 CHECK (self_evaluation BETWEEN 1 AND 10),
  reflection TEXT DEFAULT '',
  points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, record_date)
);

-- 5. Comments table
CREATE TABLE IF NOT EXISTS comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  daily_record_id UUID NOT NULL REFERENCES daily_records(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Physical Records table（身体測定データ）
CREATE TABLE IF NOT EXISTS physical_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  measured_date DATE NOT NULL,
  height_cm NUMERIC(5,1),
  weight_kg NUMERIC(5,1),
  body_fat_pct NUMERIC(4,1),
  muscle_mass_kg NUMERIC(5,1),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, measured_date)
);

-- 7. Max Training Records table（MAX測定データ）
CREATE TABLE IF NOT EXISTS max_training_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  measured_date DATE NOT NULL,
  bench_press_kg NUMERIC(5,1),
  squat_kg NUMERIC(5,1),
  deadlift_kg NUMERIC(5,1),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, measured_date)
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_daily_records_user_date ON daily_records(user_id, record_date);
CREATE INDEX IF NOT EXISTS idx_daily_records_date ON daily_records(record_date);
CREATE INDEX IF NOT EXISTS idx_comments_record ON comments(daily_record_id);
CREATE INDEX IF NOT EXISTS idx_mandala_user ON mandala_charts(user_id);
CREATE INDEX IF NOT EXISTS idx_physical_records_user ON physical_records(user_id, measured_date);
CREATE INDEX IF NOT EXISTS idx_max_training_records_user ON max_training_records(user_id, measured_date);

-- ============================================================
-- 2026-05-10 追加: セキュリティ機能強化（個別パスワード管理）
-- ============================================================
-- 既存の Supabase プロジェクトに position カラムを追加する場合は以下を実行
-- （新規プロジェクトなら CREATE TABLE の定義に含まれているため不要）
ALTER TABLE users ADD COLUMN IF NOT EXISTS position TEXT;

-- ============================================================
-- 2026-05-20 追加: Goodボタン（コーチからのリアクション）機能
-- ============================================================
-- 振り返りに対するコーチのGoodリアクションを管理するテーブル
CREATE TABLE IF NOT EXISTS record_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  daily_record_id UUID NOT NULL REFERENCES daily_records(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(daily_record_id, coach_id)  -- コーチ1人につき1記録に1回まで
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_record_likes_record ON record_likes(daily_record_id);
CREATE INDEX IF NOT EXISTS idx_record_likes_coach ON record_likes(coach_id);

-- ============================================================
-- 参考: 管理者がダッシュボードからパスワードを直接書き換えた場合の動作
-- ============================================================
-- password カラムは平文テキストで保存しています。
-- Supabase ダッシュボードの Table Editor から直接 password カラムを
-- 書き換えることで、次回ログイン時からその値で認証されます。
-- （アプリ側は毎回 DB の値をリアルタイムで照合するため即時反映されます）
