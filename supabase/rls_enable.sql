-- ============================================================
-- RLS（行レベルセキュリティ）の有効化  ※何度実行しても安全
-- 方針: 全テーブルでRLSをオンにし、アプリが実際に使っている操作だけを許可する
--       （アプリが使っていない操作＝例: ユーザーや日々の記録の削除は許可しない）
-- ============================================================

-- users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select" ON public.users;
CREATE POLICY "anon_select" ON public.users FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_insert" ON public.users;
CREATE POLICY "anon_insert" ON public.users FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update" ON public.users;
CREATE POLICY "anon_update" ON public.users FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- tournaments
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select" ON public.tournaments;
CREATE POLICY "anon_select" ON public.tournaments FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_insert" ON public.tournaments;
CREATE POLICY "anon_insert" ON public.tournaments FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update" ON public.tournaments;
CREATE POLICY "anon_update" ON public.tournaments FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- mandala_charts
ALTER TABLE public.mandala_charts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select" ON public.mandala_charts;
CREATE POLICY "anon_select" ON public.mandala_charts FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_insert" ON public.mandala_charts;
CREATE POLICY "anon_insert" ON public.mandala_charts FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update" ON public.mandala_charts;
CREATE POLICY "anon_update" ON public.mandala_charts FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- mandala_reflections
ALTER TABLE public.mandala_reflections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select" ON public.mandala_reflections;
CREATE POLICY "anon_select" ON public.mandala_reflections FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_insert" ON public.mandala_reflections;
CREATE POLICY "anon_insert" ON public.mandala_reflections FOR INSERT TO anon WITH CHECK (true);

-- daily_records
ALTER TABLE public.daily_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select" ON public.daily_records;
CREATE POLICY "anon_select" ON public.daily_records FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_insert" ON public.daily_records;
CREATE POLICY "anon_insert" ON public.daily_records FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update" ON public.daily_records;
CREATE POLICY "anon_update" ON public.daily_records FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- comments
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select" ON public.comments;
CREATE POLICY "anon_select" ON public.comments FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_insert" ON public.comments;
CREATE POLICY "anon_insert" ON public.comments FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update" ON public.comments;
CREATE POLICY "anon_update" ON public.comments FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- physical_records
ALTER TABLE public.physical_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select" ON public.physical_records;
CREATE POLICY "anon_select" ON public.physical_records FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_insert" ON public.physical_records;
CREATE POLICY "anon_insert" ON public.physical_records FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update" ON public.physical_records;
CREATE POLICY "anon_update" ON public.physical_records FOR UPDATE TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete" ON public.physical_records;
CREATE POLICY "anon_delete" ON public.physical_records FOR DELETE TO anon USING (true);

-- max_training_records
ALTER TABLE public.max_training_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select" ON public.max_training_records;
CREATE POLICY "anon_select" ON public.max_training_records FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_insert" ON public.max_training_records;
CREATE POLICY "anon_insert" ON public.max_training_records FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update" ON public.max_training_records;
CREATE POLICY "anon_update" ON public.max_training_records FOR UPDATE TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete" ON public.max_training_records;
CREATE POLICY "anon_delete" ON public.max_training_records FOR DELETE TO anon USING (true);

-- practice_sessions
ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select" ON public.practice_sessions;
CREATE POLICY "anon_select" ON public.practice_sessions FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_insert" ON public.practice_sessions;
CREATE POLICY "anon_insert" ON public.practice_sessions FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update" ON public.practice_sessions;
CREATE POLICY "anon_update" ON public.practice_sessions FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- game_stats
ALTER TABLE public.game_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select" ON public.game_stats;
CREATE POLICY "anon_select" ON public.game_stats FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_insert" ON public.game_stats;
CREATE POLICY "anon_insert" ON public.game_stats FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete" ON public.game_stats;
CREATE POLICY "anon_delete" ON public.game_stats FOR DELETE TO anon USING (true);

-- goal_update_phases
ALTER TABLE public.goal_update_phases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select" ON public.goal_update_phases;
CREATE POLICY "anon_select" ON public.goal_update_phases FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_insert" ON public.goal_update_phases;
CREATE POLICY "anon_insert" ON public.goal_update_phases FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update" ON public.goal_update_phases;
CREATE POLICY "anon_update" ON public.goal_update_phases FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- evaluation_deliveries
ALTER TABLE public.evaluation_deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select" ON public.evaluation_deliveries;
CREATE POLICY "anon_select" ON public.evaluation_deliveries FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_insert" ON public.evaluation_deliveries;
CREATE POLICY "anon_insert" ON public.evaluation_deliveries FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update" ON public.evaluation_deliveries;
CREATE POLICY "anon_update" ON public.evaluation_deliveries FOR UPDATE TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete" ON public.evaluation_deliveries;
CREATE POLICY "anon_delete" ON public.evaluation_deliveries FOR DELETE TO anon USING (true);

-- evaluation_tasks
ALTER TABLE public.evaluation_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select" ON public.evaluation_tasks;
CREATE POLICY "anon_select" ON public.evaluation_tasks FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_insert" ON public.evaluation_tasks;
CREATE POLICY "anon_insert" ON public.evaluation_tasks FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update" ON public.evaluation_tasks;
CREATE POLICY "anon_update" ON public.evaluation_tasks FOR UPDATE TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete" ON public.evaluation_tasks;
CREATE POLICY "anon_delete" ON public.evaluation_tasks FOR DELETE TO anon USING (true);

-- evaluation_answers
ALTER TABLE public.evaluation_answers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select" ON public.evaluation_answers;
CREATE POLICY "anon_select" ON public.evaluation_answers FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_insert" ON public.evaluation_answers;
CREATE POLICY "anon_insert" ON public.evaluation_answers FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update" ON public.evaluation_answers;
CREATE POLICY "anon_update" ON public.evaluation_answers FOR UPDATE TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete" ON public.evaluation_answers;
CREATE POLICY "anon_delete" ON public.evaluation_answers FOR DELETE TO anon USING (true);

-- evaluation_pairs
ALTER TABLE public.evaluation_pairs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select" ON public.evaluation_pairs;
CREATE POLICY "anon_select" ON public.evaluation_pairs FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_insert" ON public.evaluation_pairs;
CREATE POLICY "anon_insert" ON public.evaluation_pairs FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete" ON public.evaluation_pairs;
CREATE POLICY "anon_delete" ON public.evaluation_pairs FOR DELETE TO anon USING (true);

-- evaluation_groups
ALTER TABLE public.evaluation_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select" ON public.evaluation_groups;
CREATE POLICY "anon_select" ON public.evaluation_groups FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_insert" ON public.evaluation_groups;
CREATE POLICY "anon_insert" ON public.evaluation_groups FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update" ON public.evaluation_groups;
CREATE POLICY "anon_update" ON public.evaluation_groups FOR UPDATE TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete" ON public.evaluation_groups;
CREATE POLICY "anon_delete" ON public.evaluation_groups FOR DELETE TO anon USING (true);

-- evaluation_group_members
ALTER TABLE public.evaluation_group_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select" ON public.evaluation_group_members;
CREATE POLICY "anon_select" ON public.evaluation_group_members FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_insert" ON public.evaluation_group_members;
CREATE POLICY "anon_insert" ON public.evaluation_group_members FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete" ON public.evaluation_group_members;
CREATE POLICY "anon_delete" ON public.evaluation_group_members FOR DELETE TO anon USING (true);

-- ssc_plans
ALTER TABLE public.ssc_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select" ON public.ssc_plans;
CREATE POLICY "anon_select" ON public.ssc_plans FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_insert" ON public.ssc_plans;
CREATE POLICY "anon_insert" ON public.ssc_plans FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update" ON public.ssc_plans;
CREATE POLICY "anon_update" ON public.ssc_plans FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- notices
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select" ON public.notices;
CREATE POLICY "anon_select" ON public.notices FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_insert" ON public.notices;
CREATE POLICY "anon_insert" ON public.notices FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update" ON public.notices;
CREATE POLICY "anon_update" ON public.notices FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- notice_completions
ALTER TABLE public.notice_completions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select" ON public.notice_completions;
CREATE POLICY "anon_select" ON public.notice_completions FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_insert" ON public.notice_completions;
CREATE POLICY "anon_insert" ON public.notice_completions FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update" ON public.notice_completions;
CREATE POLICY "anon_update" ON public.notice_completions FOR UPDATE TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete" ON public.notice_completions;
CREATE POLICY "anon_delete" ON public.notice_completions FOR DELETE TO anon USING (true);

-- timeline_posts（migration.sql にはないが、コードが書き込みを試みるテーブル。存在する場合のみ設定）
DO $$
BEGIN
  IF to_regclass('public.timeline_posts') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.timeline_posts ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "anon_insert" ON public.timeline_posts';
    EXECUTE 'CREATE POLICY "anon_insert" ON public.timeline_posts FOR INSERT TO anon WITH CHECK (true)';
  END IF;
END $$;
