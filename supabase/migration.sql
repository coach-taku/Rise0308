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
-- 参考: 管理者がダッシュボードからパスワードを直接書き換えた場合の動作
-- ============================================================
-- password カラムは平文テキストで保存しています。
-- Supabase ダッシュボードの Table Editor から直接 password カラムを
-- 書き換えることで、次回ログイン時からその値で認証されます。
-- （アプリ側は毎回 DB の値をリアルタイムで照合するため即時反映されます）

-- ============================================================
-- 2026-05-25 追加: Session RPE機能（練習時間・トレーニング負荷管理）
-- ============================================================

-- 8. Practice Sessions table（コーチが入力する日々の練習時間）
-- Session RPE = 練習時間（分）× 疲労度（1〜10）で算出する
-- コーチ権限のみが操作する（選手側への表示なし）
CREATE TABLE IF NOT EXISTS practice_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_date DATE NOT NULL UNIQUE,           -- 練習日（1日1レコード）
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes >= 0),  -- 練習時間（分）
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,  -- 登録コーチのuser_id
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_practice_sessions_date ON practice_sessions(session_date);

-- ============================================================
-- RLS（Row Level Security）の無効化
-- ============================================================
-- このプロジェクトはRLSを使用しない設計です。
-- アクセス制御はクライアント側のlocalStorage（user_id / role）で行います。
-- Supabase でテーブルを作成すると自動でRLSが有効になるため、
-- 以下のコマンドで明示的に無効化してください。
-- （既存テーブルも同様に適用済みであることを確認してください）
ALTER TABLE practice_sessions DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 既存 Supabase プロジェクトへの適用手順
-- ============================================================
-- Supabase SQL Editor で以下の順に実行してください:
-- 1. 上記 CREATE TABLE 文でテーブルを作成する
-- 2. ALTER TABLE practice_sessions DISABLE ROW LEVEL SECURITY; を実行する
-- ※ 手順2を忘れると保存時に「row-level security policy」エラーが発生します

-- ============================================================
-- 2026-06-23 追加: スタッツ管理モジュール統合
-- ============================================================
-- コンディション管理アプリ RISE NOTE に試合スタッツ管理機能を統合する。
-- コーチがCSVをインポートし、コーチ・選手双方が閲覧・分析できる。

-- 9. Game Stats table（試合メタ情報）
-- コーチがCSVインポートするときに1レコード作成される
CREATE TABLE IF NOT EXISTS game_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_date DATE NOT NULL,                          -- 試合日
  opponent TEXT NOT NULL,                           -- 対戦相手チーム名
  game_type TEXT NOT NULL DEFAULT '練習試合'
    CHECK (game_type IN ('公式戦', '練習試合', 'リーグ戦', 'その他')),
  game_minutes INTEGER NOT NULL DEFAULT 40
    CHECK (game_minutes > 0),                       -- 試合時間（分）
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,  -- 登録コーチ
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. Game Stat Entries table（選手1人×1試合のスタッツ）
-- game_stats の子レコード。CSVの1行が1エントリーに対応する。
-- player_name はCSVから読み込んだ名前をそのまま保持し、手動での選手紐付けに使用する。
-- システムによる自動マッチングは行わない（要件定義書の制約事項に準拠）。
CREATE TABLE IF NOT EXISTS game_stat_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_stat_id UUID NOT NULL REFERENCES game_stats(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,                        -- CSVから読み込んだ選手名
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,  -- 手動紐付け後にセット（NULL可）
  minutes_played INTEGER NOT NULL DEFAULT 0 CHECK (minutes_played >= 0),  -- 出場時間（分）
  -- シュート系
  fg_made INTEGER NOT NULL DEFAULT 0,               -- FG成功数
  fg_attempted INTEGER NOT NULL DEFAULT 0,          -- FG試投数
  three_made INTEGER NOT NULL DEFAULT 0,            -- 3P成功数
  three_attempted INTEGER NOT NULL DEFAULT 0,       -- 3P試投数
  two_made INTEGER NOT NULL DEFAULT 0,              -- 2P成功数
  two_attempted INTEGER NOT NULL DEFAULT 0,         -- 2P試投数
  ft_made INTEGER NOT NULL DEFAULT 0,               -- FT成功数
  ft_attempted INTEGER NOT NULL DEFAULT 0,          -- FT試投数
  -- その他スタッツ
  rebounds INTEGER NOT NULL DEFAULT 0,              -- リバウンド
  assists INTEGER NOT NULL DEFAULT 0,               -- アシスト
  steals INTEGER NOT NULL DEFAULT 0,                -- スティール
  blocks INTEGER NOT NULL DEFAULT 0,                -- ブロック
  turnovers INTEGER NOT NULL DEFAULT 0,             -- ターンオーバー
  points INTEGER NOT NULL DEFAULT 0,                -- 得点
  created_at TIMESTAMPTZ DEFAULT now()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_game_stats_date ON game_stats(game_date DESC);
CREATE INDEX IF NOT EXISTS idx_game_stats_created_by ON game_stats(created_by);
CREATE INDEX IF NOT EXISTS idx_game_stat_entries_game ON game_stat_entries(game_stat_id);
CREATE INDEX IF NOT EXISTS idx_game_stat_entries_user ON game_stat_entries(user_id);

-- RLS無効化（このプロジェクトはRLSを使用しない設計）
ALTER TABLE game_stats DISABLE ROW LEVEL SECURITY;
ALTER TABLE game_stat_entries DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 適用手順（既存の Supabase プロジェクトへの追加）
-- ============================================================
-- Supabase SQL Editor でこのセクション以降の CREATE TABLE 文を実行し、
-- ALTER TABLE xxx DISABLE ROW LEVEL SECURITY; を必ず実行してください。
-- ※ 忘れると INSERT/SELECT 時に RLS エラーが発生します。
