-- ============================================================
-- KUKI GYMRATS RISE NOTE - 完全セットアップSQL
-- ============================================================
-- このファイルを Supabase の SQL Editor に貼り付けて Run してください。
-- テーブル作成 → 初期データ投入 → アクセス権限設定 を一括で行います。
-- 既にテーブルが存在する場合でも安全に実行できます（IF NOT EXISTS）。
-- ============================================================


-- ============================================================
-- STEP 1: テーブルの作成
-- ============================================================

-- 1. ユーザーテーブル（認証情報も含む）
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('player', 'staff')),
  password TEXT NOT NULL
);

-- 2. 大会テーブル
CREATE TABLE IF NOT EXISTS tournaments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  target_date DATE NOT NULL
);

-- 3. マンダラチャートテーブル
CREATE TABLE IF NOT EXISTS mandala_charts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  core_goal TEXT NOT NULL DEFAULT '',
  elements JSONB NOT NULL DEFAULT '[]'::jsonb,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. デイリー記録テーブル
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

-- 5. コメントテーブル
CREATE TABLE IF NOT EXISTS comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  daily_record_id UUID NOT NULL REFERENCES daily_records(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_daily_records_user_date ON daily_records(user_id, record_date);
CREATE INDEX IF NOT EXISTS idx_daily_records_date ON daily_records(record_date);
CREATE INDEX IF NOT EXISTS idx_comments_record ON comments(daily_record_id);
CREATE INDEX IF NOT EXISTS idx_mandala_user ON mandala_charts(user_id);


-- ============================================================
-- STEP 2: 初期データの投入（既に存在する場合はスキップ）
-- ============================================================

-- 選手データ（同名が存在しない場合のみ挿入）
INSERT INTO users (name, role, password)
SELECT '山田 花子', 'player', 'rise'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE name = '山田 花子');

INSERT INTO users (name, role, password)
SELECT '鈴木 美咲', 'player', 'rise'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE name = '鈴木 美咲');

-- スタッフデータ（同名が存在しない場合のみ挿入）
INSERT INTO users (name, role, password)
SELECT '高橋 コーチ', 'staff', 'rise'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE name = '高橋 コーチ');

INSERT INTO users (name, role, password)
SELECT '伊藤 監督', 'staff', 'rise'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE name = '伊藤 監督');

-- 大会データ（同名が存在しない場合のみ挿入）
INSERT INTO tournaments (name, target_date)
SELECT 'インターハイ予選', '2026-06-15'
WHERE NOT EXISTS (SELECT 1 FROM tournaments WHERE name = 'インターハイ予選');


-- ============================================================
-- STEP 3: RLS（行レベルセキュリティ）の無効化とアクセス権限の付与
-- ============================================================
-- このアプリは RLS を使用しない設計のため、全テーブルで無効化します。
-- アクセス制御はアプリ側（localStorage のセッション情報）で行います。

ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments DISABLE ROW LEVEL SECURITY;
ALTER TABLE mandala_charts DISABLE ROW LEVEL SECURITY;
ALTER TABLE daily_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE comments DISABLE ROW LEVEL SECURITY;

-- anon（匿名）ロールへの操作権限を付与
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON tournaments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON mandala_charts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON daily_records TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON comments TO anon;

-- シーケンス（UUID生成など）へのアクセス権限
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;


-- ============================================================
-- 確認クエリ（実行後にユーザー一覧が表示されれば成功）
-- ============================================================
SELECT name, role FROM users ORDER BY role, name;
