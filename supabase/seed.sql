-- ============================================================
-- KUKI GYMRATS RISE NOTE - Seed Data
-- Run this SQL AFTER migration.sql in Supabase SQL Editor
-- ============================================================
-- 共通の合言葉(パスワード): rise
-- ============================================================

-- 選手データ
INSERT INTO users (id, name, role, password) VALUES
  (gen_random_uuid(), '山田 花子', 'player', 'rise'),
  (gen_random_uuid(), '鈴木 美咲', 'player', 'rise');

-- スタッフデータ
INSERT INTO users (id, name, role, password) VALUES
  (gen_random_uuid(), '高橋 コーチ', 'staff', 'rise'),
  (gen_random_uuid(), '伊藤 監督', 'staff', 'rise');

-- 大会データ
INSERT INTO tournaments (name, target_date) VALUES
  ('インターハイ予選', '2026-06-15');
