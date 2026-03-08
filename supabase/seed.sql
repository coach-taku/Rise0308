-- ============================================================
-- KUKI GYMRATS RISE NOTE - Seed Data
-- Run this SQL AFTER migration.sql in Supabase SQL Editor
-- ============================================================
-- 
-- IMPORTANT: Before running this script, create the following
-- users in Supabase Auth Dashboard (Authentication > Users > Add User):
--
-- 1. Email: player1@risenote.local, Password: rise2024 (共通合言葉)
-- 2. Email: player2@risenote.local, Password: rise2024
-- 3. Email: coach1@risenote.local,  Password: rise2024
-- 4. Email: coach2@risenote.local,  Password: rise2024
--
-- After creating users, note their UUIDs and replace the placeholders below.
-- ============================================================

-- Replace these UUIDs with the actual user UUIDs from Supabase Auth
-- You can find them in: Authentication > Users in the Supabase dashboard

-- Step 1: Insert Groups
INSERT INTO groups (id, name) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'グループA'),
  ('a1000000-0000-0000-0000-000000000002', 'グループB')
ON CONFLICT DO NOTHING;

-- Step 2: Insert Profiles (replace UUIDs with actual auth.users UUIDs)
-- IMPORTANT: Replace 'PLAYER1_UUID', 'PLAYER2_UUID', 'COACH1_UUID', 'COACH2_UUID'
-- with the actual UUIDs from Supabase Auth after creating users.

-- Example (uncomment and replace UUIDs after creating auth users):
/*
INSERT INTO profiles (id, name, role, group_id, total_points) VALUES
  ('PLAYER1_UUID', '山田 花子', 'player', 'a1000000-0000-0000-0000-000000000001', 0),
  ('PLAYER2_UUID', '鈴木 美咲', 'player', 'a1000000-0000-0000-0000-000000000001', 0),
  ('COACH1_UUID',  '高橋 コーチ', 'coach', NULL, 0),
  ('COACH2_UUID',  '伊藤 監督', 'coach', NULL, 0)
ON CONFLICT (id) DO NOTHING;
*/

-- Step 3: Insert a tournament
INSERT INTO tournaments (name, target_date, is_active) VALUES
  ('インターハイ予選', '2026-06-15', true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Alternative: Auto-create auth users via Supabase Admin API
-- ============================================================
-- If you prefer to automate user creation, you can use the
-- Supabase Management API or supabase-js admin client:
--
-- const { data, error } = await supabase.auth.admin.createUser({
--   email: 'player1@risenote.local',
--   password: 'rise2024',
--   email_confirm: true,
-- })
--
-- Then insert into profiles with the returned user.id
-- ============================================================
