-- ============================================================
-- RLS（行レベルセキュリティ）修正SQL
-- Supabase の SQL Editor でこのファイルを実行してください
-- ============================================================
-- このアプリは RLS を使用しない設計です。
-- Supabase はデフォルトで RLS が有効（アクセス拒否）になっているため、
-- 匿名ユーザー（anon）が各テーブルにアクセスできるよう設定します。
-- ============================================================

-- users テーブル: RLS を無効化
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- tournaments テーブル: RLS を無効化
ALTER TABLE tournaments DISABLE ROW LEVEL SECURITY;

-- mandala_charts テーブル: RLS を無効化
ALTER TABLE mandala_charts DISABLE ROW LEVEL SECURITY;

-- daily_records テーブル: RLS を無効化
ALTER TABLE daily_records DISABLE ROW LEVEL SECURITY;

-- comments テーブル: RLS を無効化
ALTER TABLE comments DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- anon ロールへのアクセス権限を付与
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON tournaments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON mandala_charts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON daily_records TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON comments TO anon;

-- シーケンス（自動採番）へのアクセス権限も付与
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
