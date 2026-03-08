-- ============================================================
-- KUKI GYMRATS RISE NOTE - Database Migration
-- Run this SQL in Supabase SQL Editor
-- ============================================================

-- 1. Groups table
CREATE TABLE IF NOT EXISTS groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Profiles table (linked to auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('player', 'coach')),
  group_id UUID REFERENCES groups(id),
  total_points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Tournaments table
CREATE TABLE IF NOT EXISTS tournaments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  target_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Mandala Charts table
CREATE TABLE IF NOT EXISTS mandala_charts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  core_goal TEXT NOT NULL DEFAULT '',
  main_elements JSONB NOT NULL DEFAULT '[]'::jsonb,
  sub_goals JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Daily Records table
CREATE TABLE IF NOT EXISTS daily_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_date DATE NOT NULL,
  sleep_hours NUMERIC(3,1) DEFAULT 7.0,
  fatigue_level INTEGER DEFAULT 5 CHECK (fatigue_level BETWEEN 1 AND 10),
  has_pain BOOLEAN DEFAULT false,
  pain_details TEXT DEFAULT '',
  participation_status TEXT DEFAULT '参加' CHECK (participation_status IN ('参加', 'リハビリ', '体調不良で欠席', '通院のため欠席', 'REST')),
  selected_goals JSONB DEFAULT '[]'::jsonb,
  self_evaluation INTEGER DEFAULT 5 CHECK (self_evaluation BETWEEN 1 AND 10),
  reflection_text TEXT DEFAULT '',
  earned_points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, target_date)
);

-- 6. Comments table
CREATE TABLE IF NOT EXISTS comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  record_id UUID NOT NULL REFERENCES daily_records(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_group ON profiles(group_id);
CREATE INDEX IF NOT EXISTS idx_daily_records_user_date ON daily_records(user_id, target_date);
CREATE INDEX IF NOT EXISTS idx_daily_records_date ON daily_records(target_date);
CREATE INDEX IF NOT EXISTS idx_comments_record ON comments(record_id);
CREATE INDEX IF NOT EXISTS idx_mandala_user ON mandala_charts(user_id);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mandala_charts ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- Helper function: check if current user is a coach
CREATE OR REPLACE FUNCTION is_coach()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'coach'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Profiles policies
CREATE POLICY "Anyone can view profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Tournaments policies
CREATE POLICY "Anyone can view tournaments" ON tournaments FOR SELECT USING (true);
CREATE POLICY "Coaches can manage tournaments" ON tournaments FOR ALL USING (is_coach());

-- Mandala Charts policies
CREATE POLICY "Users can view own mandala" ON mandala_charts FOR SELECT USING (auth.uid() = user_id OR is_coach());
CREATE POLICY "Users can insert own mandala" ON mandala_charts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own mandala" ON mandala_charts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own mandala" ON mandala_charts FOR DELETE USING (auth.uid() = user_id);

-- Daily Records policies
CREATE POLICY "Users can view own records or coaches see all" ON daily_records FOR SELECT
  USING (auth.uid() = user_id OR is_coach() OR
    EXISTS (
      SELECT 1 FROM profiles p1, profiles p2
      WHERE p1.id = auth.uid() AND p2.id = daily_records.user_id
      AND p1.group_id = p2.group_id AND p1.group_id IS NOT NULL
    )
  );
CREATE POLICY "Users can insert own records" ON daily_records FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own records" ON daily_records FOR UPDATE USING (auth.uid() = user_id);

-- Comments policies
CREATE POLICY "Anyone in group or coach can view comments" ON comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert comments" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Groups policies
CREATE POLICY "Anyone can view groups" ON groups FOR SELECT USING (true);
CREATE POLICY "Coaches can manage groups" ON groups FOR ALL USING (is_coach());

-- ============================================================
-- Function to increment points
-- ============================================================
CREATE OR REPLACE FUNCTION increment_points(user_id UUID, points_to_add INTEGER)
RETURNS VOID AS $$
  UPDATE profiles SET total_points = total_points + points_to_add WHERE id = user_id;
$$ LANGUAGE sql SECURITY DEFINER;
