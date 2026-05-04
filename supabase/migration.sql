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
  password TEXT NOT NULL
);

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
-- RLS (Row Level Security) ポリシー
-- 
-- ★★★ 重要 ★★★
-- Supabase はテーブル作成時にデフォルトで RLS が有効になります。
-- RLS が有効でポリシーが未設定の場合、anon key からの全操作
-- (SELECT/INSERT/UPDATE/DELETE) がブロックされます。
-- 
-- カルテ保存が失敗する場合は、以下のRLSセクションを
-- Supabase SQL Editor で必ず実行してください。
--
-- このアプリはanon keyを使用してクライアント側でアクセス制御を行う。
-- RLSを有効にした上で、anon ロールに全操作を許可するポリシーを設定する。
-- これにより Supabase のデフォルト RLS ブロックを回避しつつ、
-- 将来的にユーザーIDベースの細かいポリシーへ移行しやすくなる。
-- ============================================================

-- users テーブル
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_anon_select" ON users;
CREATE POLICY "users_anon_select" ON users FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "users_anon_insert" ON users;
CREATE POLICY "users_anon_insert" ON users FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "users_anon_update" ON users;
CREATE POLICY "users_anon_update" ON users FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- tournaments テーブル
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tournaments_anon_all" ON tournaments;
CREATE POLICY "tournaments_anon_all" ON tournaments FOR ALL TO anon USING (true) WITH CHECK (true);

-- mandala_charts テーブル
ALTER TABLE mandala_charts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mandala_charts_anon_all" ON mandala_charts;
CREATE POLICY "mandala_charts_anon_all" ON mandala_charts FOR ALL TO anon USING (true) WITH CHECK (true);

-- daily_records テーブル
ALTER TABLE daily_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "daily_records_anon_all" ON daily_records;
CREATE POLICY "daily_records_anon_all" ON daily_records FOR ALL TO anon USING (true) WITH CHECK (true);

-- comments テーブル
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comments_anon_all" ON comments;
CREATE POLICY "comments_anon_all" ON comments FOR ALL TO anon USING (true) WITH CHECK (true);

-- physical_records テーブル
ALTER TABLE physical_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "physical_records_anon_all" ON physical_records;
CREATE POLICY "physical_records_anon_all" ON physical_records FOR ALL TO anon USING (true) WITH CHECK (true);

-- max_training_records テーブル
ALTER TABLE max_training_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "max_training_records_anon_all" ON max_training_records;
CREATE POLICY "max_training_records_anon_all" ON max_training_records FOR ALL TO anon USING (true) WITH CHECK (true);
