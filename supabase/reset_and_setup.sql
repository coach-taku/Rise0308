-- ============================================================
-- KUKI GYMRATS RISE NOTE - リセット＆完全セットアップSQL
-- ============================================================
-- 既存のテーブルが古いスキーマで残っている場合に使用します。
-- 全テーブルを一度削除してから作り直します。
-- ※ 既存のデータは全て消えます。
-- ============================================================


-- ============================================================
-- STEP 1: 既存テーブルを全て削除（依存関係の順番で削除）
-- ============================================================
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS daily_records CASCADE;
DROP TABLE IF EXISTS mandala_charts CASCADE;
DROP TABLE IF EXISTS tournaments CASCADE;
DROP TABLE IF EXISTS users CASCADE;


-- ============================================================
-- STEP 2: テーブルを正しいスキーマで作成
-- ============================================================

-- 1. ユーザーテーブル
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('player', 'staff')),
  password TEXT NOT NULL
);

-- 2. 大会テーブル
CREATE TABLE tournaments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  target_date DATE NOT NULL
);

-- 3. マンダラチャートテーブル
CREATE TABLE mandala_charts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  core_goal TEXT NOT NULL DEFAULT '',
  elements JSONB NOT NULL DEFAULT '[]'::jsonb,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. デイリー記録テーブル
CREATE TABLE daily_records (
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

-- 5. コメントテーブル
CREATE TABLE comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  daily_record_id UUID NOT NULL REFERENCES daily_records(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- インデックス
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_daily_records_user_date ON daily_records(user_id, record_date);
CREATE INDEX idx_daily_records_date ON daily_records(record_date);
CREATE INDEX idx_comments_record ON comments(daily_record_id);
CREATE INDEX idx_mandala_user ON mandala_charts(user_id);


-- ============================================================
-- STEP 3: 初期データの投入
-- ============================================================

-- 選手データ（合言葉: rise）
INSERT INTO users (name, role, password) VALUES
  ('山田 花子', 'player', 'rise'),
  ('鈴木 美咲', 'player', 'rise');

-- スタッフデータ（合言葉: rise）
INSERT INTO users (name, role, password) VALUES
  ('高橋 コーチ', 'staff', 'rise'),
  ('伊藤 監督', 'staff', 'rise');

-- 大会データ
INSERT INTO tournaments (name, target_date) VALUES
  ('インターハイ予選', '2026-06-15');


-- ============================================================
-- STEP 4: RLS無効化とアクセス権限付与
-- ============================================================
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments DISABLE ROW LEVEL SECURITY;
ALTER TABLE mandala_charts DISABLE ROW LEVEL SECURITY;
ALTER TABLE daily_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE comments DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON users TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON tournaments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON mandala_charts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON daily_records TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON comments TO anon;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;


-- ============================================================
-- 確認クエリ（名前一覧が表示されれば成功）
-- ============================================================
SELECT name, role FROM users ORDER BY role, name;
