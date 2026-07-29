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
-- 2026-06-23 追加: スタッツ管理機能（試合パフォーマンスデータ）
-- ============================================================

-- 9. Game Stats table（試合ごとのスタッツデータ）
-- コーチがCSVインポートで登録し、コーチ・選手双方が閲覧する
-- 選手とのデータ紐付けは player_name による手動管理（自動マッチングなし）
CREATE TABLE IF NOT EXISTS game_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_date DATE NOT NULL,                          -- 試合日
  opponent TEXT NOT NULL DEFAULT '',                -- 対戦相手チーム名
  game_type TEXT NOT NULL DEFAULT '練習試合',       -- 試合種別（練習試合 / 公式戦 等）
  game_minutes INTEGER NOT NULL DEFAULT 40,         -- 試合時間（分）。PER40換算の基準値
  player_name TEXT NOT NULL,                        -- 選手名（手動入力。usersとの自動マッチングなし）
  -- 基本スタッツ
  minutes_played INTEGER NOT NULL DEFAULT 0,        -- 出場時間（分）
  points INTEGER NOT NULL DEFAULT 0,                -- 得点
  rebounds INTEGER NOT NULL DEFAULT 0,              -- リバウンド
  assists INTEGER NOT NULL DEFAULT 0,               -- アシスト
  steals INTEGER NOT NULL DEFAULT 0,                -- スティール
  blocks INTEGER NOT NULL DEFAULT 0,                -- ブロック
  turnovers INTEGER NOT NULL DEFAULT 0,             -- ターンオーバー
  fouls INTEGER NOT NULL DEFAULT 0,                 -- ファウル
  -- シュートスタッツ（KPI: 3P 33% / 2P 50% / FT 75%）
  fg3_made INTEGER NOT NULL DEFAULT 0,              -- 3P成功数
  fg3_attempted INTEGER NOT NULL DEFAULT 0,         -- 3P試投数
  fg2_made INTEGER NOT NULL DEFAULT 0,              -- 2P成功数
  fg2_attempted INTEGER NOT NULL DEFAULT 0,         -- 2P試投数
  ft_made INTEGER NOT NULL DEFAULT 0,               -- FT（フリースロー）成功数
  ft_attempted INTEGER NOT NULL DEFAULT 0,          -- FT試投数
  -- メタデータ
  imported_by UUID REFERENCES users(id) ON DELETE SET NULL,  -- インポートしたコーチのuser_id
  created_at TIMESTAMPTZ DEFAULT now()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_game_stats_date ON game_stats(game_date);
CREATE INDEX IF NOT EXISTS idx_game_stats_player ON game_stats(player_name);
CREATE INDEX IF NOT EXISTS idx_game_stats_type ON game_stats(game_type);

-- RLS 無効化（他テーブルと同様の設計方針）
ALTER TABLE game_stats DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2026-07-14 追加: グロースマインドセット自動スコアリング機能
-- ============================================================
-- daily_records テーブルへのカラム追加（既存データへの破壊的変更なし）
-- LLM（Gemini API）が振り返りテキストを判定し、スコアとフィードバックを保存する
-- スコアリングはサーバーサイド（Route Handler）のみで実行し、APIキーは絶対にクライアント側へ露出しない

-- mindset_score: 1〜4 の整数（1:固定マインドセット → 4:深いメタ認知）。未スコアリングは NULL
ALTER TABLE daily_records ADD COLUMN IF NOT EXISTS mindset_score SMALLINT CHECK (mindset_score BETWEEN 1 AND 4);

-- mindset_feedback: LLMが生成した判定理由テキスト。未スコアリングは NULL
ALTER TABLE daily_records ADD COLUMN IF NOT EXISTS mindset_feedback TEXT;

-- インデックス（ダッシュボードでスコアによる絞り込みを行う想定）
CREATE INDEX IF NOT EXISTS idx_daily_records_mindset ON daily_records(mindset_score);

-- ============================================================
-- 2026-07-14 追加: マンダラチャート大会周期アーカイブ・目標更新機能
-- ============================================================

-- mandala_charts テーブルにアーカイブ管理カラムを追加
-- term_label: 対象大会ターム（例: "2026年 インターハイ予選"）
-- status: アクティブ（active）またはアーカイブ済み（archived）
-- archived_at: アーカイブした日時（アーカイブ後に設定）
ALTER TABLE mandala_charts ADD COLUMN IF NOT EXISTS term_label TEXT;
ALTER TABLE mandala_charts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived'));
ALTER TABLE mandala_charts ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- インデックス（アクティブなチャートを高速に取得するため）
CREATE INDEX IF NOT EXISTS idx_mandala_charts_status ON mandala_charts(user_id, status);

-- ============================================================
-- 10. Mandala Reflections table（大会後リフレクション）
-- 新しいマンダラチャートを作成する前に記録する振り返りデータ
-- ============================================================
CREATE TABLE IF NOT EXISTS mandala_reflections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mandala_chart_id UUID NOT NULL REFERENCES mandala_charts(id) ON DELETE CASCADE,  -- 振り返り対象のチャート
  term_label TEXT NOT NULL,           -- 対象大会ターム（例: "2026年 インターハイ予選"）
  achievement_note TEXT NOT NULL DEFAULT '',   -- 達成度・成果のメモ
  challenges TEXT NOT NULL DEFAULT '',         -- 次期への課題
  plan_b TEXT NOT NULL DEFAULT '',             -- 具体的なPlan B（改善行動戦略）
  mindset_score SMALLINT CHECK (mindset_score BETWEEN 1 AND 4),  -- LLMメタ認知スコア（1〜4）
  mindset_feedback TEXT,                       -- LLMフィードバックテキスト
  created_at TIMESTAMPTZ DEFAULT now()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_mandala_reflections_user ON mandala_reflections(user_id);
CREATE INDEX IF NOT EXISTS idx_mandala_reflections_chart ON mandala_reflections(mandala_chart_id);

-- RLS 無効化（他テーブルと同様の設計方針）
ALTER TABLE mandala_reflections DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 11. Goal Update Phases table（目標更新フェーズ管理）
-- コーチが「次期目標設定フェーズ」を開始するためのフラグテーブル
-- ============================================================
CREATE TABLE IF NOT EXISTS goal_update_phases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  term_label TEXT NOT NULL,          -- 大会ターム名（例: "2026年 インターハイ予選"）
  is_active BOOLEAN NOT NULL DEFAULT true,  -- フェーズが有効かどうか
  started_by UUID REFERENCES users(id) ON DELETE SET NULL,  -- 開始したコーチのuser_id
  started_at TIMESTAMPTZ DEFAULT now(),     -- 開始日時
  ended_at TIMESTAMPTZ,                     -- 終了日時（フェーズ終了後に設定）
  created_at TIMESTAMPTZ DEFAULT now()
);

-- インデックス（アクティブなフェーズを高速取得するため）
CREATE INDEX IF NOT EXISTS idx_goal_update_phases_active ON goal_update_phases(is_active);

-- RLS 無効化（他テーブルと同様の設計方針）
ALTER TABLE goal_update_phases DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 既存 Supabase プロジェクトへの適用手順
-- ============================================================
-- Supabase SQL Editor で以下の順に実行してください:
-- 1. 上記 CREATE TABLE 文でテーブルを作成する
-- 2. ALTER TABLE game_stats DISABLE ROW LEVEL SECURITY; を実行する
-- ※ 手順2を忘れると保存時に「row-level security policy」エラーが発生します
--
-- 既存プロジェクトへの追加のみ行う場合（game_stats テーブルのみ追加）:
-- CREATE TABLE IF NOT EXISTS game_stats (...) を実行した後、
-- ALTER TABLE game_stats DISABLE ROW LEVEL SECURITY; を実行してください
--
-- 【2026-07-14 追加分の適用】
-- 既存の Supabase プロジェクトに mindset スコア機能を追加する場合:
-- ALTER TABLE daily_records ADD COLUMN IF NOT EXISTS mindset_score SMALLINT CHECK (mindset_score BETWEEN 1 AND 4);
-- ALTER TABLE daily_records ADD COLUMN IF NOT EXISTS mindset_feedback TEXT;
-- CREATE INDEX IF NOT EXISTS idx_daily_records_mindset ON daily_records(mindset_score);
--
-- 【2026-07-14 追加分（アーカイブ・更新フェーズ）の適用】
-- 既存の Supabase プロジェクトにマンダラチャートアーカイブ機能を追加する場合:
-- ALTER TABLE mandala_charts ADD COLUMN IF NOT EXISTS term_label TEXT;
-- ALTER TABLE mandala_charts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived'));
-- ALTER TABLE mandala_charts ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
-- CREATE INDEX IF NOT EXISTS idx_mandala_charts_status ON mandala_charts(user_id, status);
-- 続けて mandala_reflections / goal_update_phases の CREATE TABLE を実行し、RLS を無効化してください。

-- ============================================================
-- 12. 10ヶ条評価・SSC連動機能（2026-07-26 追加）
--     既存 Supabase プロジェクトへの適用: 以下の全ブロックを
--     Supabase SQL Editor に貼り付けて一括実行してください。
--     すべて IF NOT EXISTS のため、再実行しても安全です。
-- ============================================================

-- 12-1. evaluation_deliveries（配信管理）
CREATE TABLE IF NOT EXISTS evaluation_deliveries (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  label         text        NOT NULL,
  created_by    uuid        REFERENCES users(id) ON DELETE SET NULL,
  delivered_at  timestamptz DEFAULT now(),
  created_at    timestamptz DEFAULT now()
);
ALTER TABLE evaluation_deliveries DISABLE ROW LEVEL SECURITY;

-- 12-2. evaluation_tasks（評価タスク）
CREATE TABLE IF NOT EXISTS evaluation_tasks (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_id   uuid        NOT NULL REFERENCES evaluation_deliveries(id) ON DELETE CASCADE,
  evaluator_id  uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status        text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  delivered_at  timestamptz DEFAULT now(),
  completed_at  timestamptz,
  created_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_evaluation_tasks_evaluator ON evaluation_tasks(evaluator_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_tasks_delivery  ON evaluation_tasks(delivery_id);
ALTER TABLE evaluation_tasks DISABLE ROW LEVEL SECURITY;

-- 12-3. evaluation_answers（回答）
CREATE TABLE IF NOT EXISTS evaluation_answers (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id       uuid        NOT NULL REFERENCES evaluation_tasks(id) ON DELETE CASCADE,
  evaluator_id  uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id   integer     NOT NULL CHECK (question_id BETWEEN 1 AND 30),
  score         integer     NOT NULL CHECK (score BETWEEN 1 AND 5),
  created_at    timestamptz DEFAULT now(),
  UNIQUE (task_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_evaluation_answers_target ON evaluation_answers(target_id);
ALTER TABLE evaluation_answers DISABLE ROW LEVEL SECURITY;

-- 12-4. evaluation_pairs（ペア設定）
CREATE TABLE IF NOT EXISTS evaluation_pairs (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  pair_type     text        NOT NULL DEFAULT 'default',
  player_a_id   uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  player_b_id   uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    timestamptz DEFAULT now(),
  UNIQUE (player_a_id, player_b_id)
);
ALTER TABLE evaluation_pairs DISABLE ROW LEVEL SECURITY;

-- 12-5. ssc_plans（Start/Stop/Continue アクションプラン）
CREATE TABLE IF NOT EXISTS ssc_plans (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid        REFERENCES users(id) ON DELETE CASCADE,
  delivery_id     text        NOT NULL,
  start_action    text        DEFAULT '',
  stop_action     text        DEFAULT '',
  continue_action text        DEFAULT '',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (user_id, delivery_id)
);
ALTER TABLE ssc_plans DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 13. 他者評価グループ機能（2026-07-26 追加）
--     evaluation_pairs（2名ペア）をグループ（N名）に拡張。
--     既存の evaluation_pairs テーブルは後方互換のため残存。
--     すべて IF NOT EXISTS のため、再実行しても安全です。
-- ============================================================

-- 13-1. evaluation_groups（グループ管理）
CREATE TABLE IF NOT EXISTS evaluation_groups (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text        NOT NULL,
  group_type  text        NOT NULL DEFAULT 'custom',
  created_by  uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE evaluation_groups DISABLE ROW LEVEL SECURITY;

-- 13-2. evaluation_group_members（グループメンバー中間テーブル）
CREATE TABLE IF NOT EXISTS evaluation_group_members (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id   uuid        NOT NULL REFERENCES evaluation_groups(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_eval_group_members_group  ON evaluation_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_eval_group_members_user   ON evaluation_group_members(user_id);
ALTER TABLE evaluation_group_members DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 14. 連絡事項・TODOリスト機能（2026-07-29 追加）
--     指導者・選手の双方向から発信できる連絡・タスク管理。
--     チェック（完了）したユーザーは notice_completions テーブルで管理。
--     すべて IF NOT EXISTS のため、再実行しても安全です。
-- ============================================================

-- 14-1. notices（連絡事項・TODOアイテム）
CREATE TABLE IF NOT EXISTS notices (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by   uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        text        NOT NULL,
  body         text,
  notice_type  text        NOT NULL DEFAULT 'notice' CHECK (notice_type IN ('notice', 'todo')),
  is_active    boolean     NOT NULL DEFAULT true,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notices_created_by ON notices(created_by);
CREATE INDEX IF NOT EXISTS idx_notices_is_active  ON notices(is_active);
ALTER TABLE notices DISABLE ROW LEVEL SECURITY;

-- 14-2. notice_completions（チェック（完了）記録）
-- ユーザーがチェックを入れると1レコード追加される（論理削除方式）。
CREATE TABLE IF NOT EXISTS notice_completions (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  notice_id    uuid        NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  completed_at timestamptz DEFAULT now(),
  UNIQUE (notice_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_notice_completions_notice ON notice_completions(notice_id);
CREATE INDEX IF NOT EXISTS idx_notice_completions_user   ON notice_completions(user_id);
ALTER TABLE notice_completions DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 【2026-07-29 追加分（連絡事項・TODOリスト）の適用手順】
--
-- 既存の Supabase プロジェクトにこの機能を追加する場合は、
-- Supabase SQL Editor に以下のSQLを貼り付けて実行してください。
-- すべて IF NOT EXISTS のため、再実行しても安全です。
--
-- ▼ 実行するSQL（2テーブル分）
--
-- CREATE TABLE IF NOT EXISTS notices (
--   id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
--   created_by   uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--   title        text        NOT NULL,
--   body         text,
--   notice_type  text        NOT NULL DEFAULT 'notice' CHECK (notice_type IN ('notice', 'todo')),
--   is_active    boolean     NOT NULL DEFAULT true,
--   created_at   timestamptz DEFAULT now(),
--   updated_at   timestamptz DEFAULT now()
-- );
-- CREATE INDEX IF NOT EXISTS idx_notices_created_by ON notices(created_by);
-- CREATE INDEX IF NOT EXISTS idx_notices_is_active  ON notices(is_active);
-- ALTER TABLE notices DISABLE ROW LEVEL SECURITY;
--
-- CREATE TABLE IF NOT EXISTS notice_completions (
--   id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
--   notice_id    uuid        NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
--   user_id      uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--   completed_at timestamptz DEFAULT now(),
--   UNIQUE (notice_id, user_id)
-- );
-- CREATE INDEX IF NOT EXISTS idx_notice_completions_notice ON notice_completions(notice_id);
-- CREATE INDEX IF NOT EXISTS idx_notice_completions_user   ON notice_completions(user_id);
-- ALTER TABLE notice_completions DISABLE ROW LEVEL SECURITY;
--
-- ※ ALTER TABLE notices DISABLE ROW LEVEL SECURITY; を実行しないと
--    保存時に「row-level security policy」エラーが発生します。
-- ============================================================
