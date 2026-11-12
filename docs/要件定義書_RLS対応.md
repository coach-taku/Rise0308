# 修正要件定義書：RLS（行レベルセキュリティ）の有効化

作成日: 2026-11-12 ／ 対象: RISE NOTE（Supabase プロジェクト Rise0308…）
※ このファイルは `docs/要件定義書_RLS対応.md` として置くことを想定しています。

---

## 1. 目的

Supabase から「重大（Critical）」の警告が届きました。内容は「テーブルのRLSが無効で、プロジェクトURLを知っていれば誰でもデータを読み・編集・削除できる」というものです。
**全テーブルでRLSを有効にし、警告を解消します。** アプリの見た目・動作は今までと同じにします。

## 2. 先に知っておくこと（できること／できないこと）

このアプリは Supabase の認証（Auth）を使わず、ブラウザ側で「誰がログインしているか」を管理しています。そのため、データベースから見ると全員が同じ「匿名ユーザー」です。この前提で、今回の対応は次のとおりです。

| | 今回の対応 |
|---|---|
| 警告（RLS無効）の解消 | できる |
| アプリが使っていない操作（ユーザー・日々の記録・コメント等の**削除**）を外部から禁止 | できる |
| 「Aさんは自分のデータだけ」のような**人ごとの制限** | **できない**（Auth が必要） |
| 他人が読めてしまう状態 | **変わらない**（読み取りは今まで通り許可が必要なため） |

つまり今回は **「応急処置＋削除の防止」** です。データの中身（未成年の体調・身体データ、`users.password` の平文パスワード）が外から読める状態は、第9章の「次の段階」を行うまで残ります。この点は実装者・依頼者の双方が理解したうえで進めてください。

## 3. 変更範囲

**変更する**
- `supabase/rls_enable.sql`（新規）: RLS有効化＋許可ルール
- `supabase/migration.sql`: 「RLSを無効にする」行の削除（第5章）
- `DEPLOYMENT.md`、`docs/要件定義書.md`: 「RLSは使わない」という記述の修正（第5章）

**変更しない**
- アプリのコード（`src/` 配下すべて）
- ログイン方法（名前＋パスワード）、DBの構造（テーブル・カラム）、環境変数
- `AGENTS.md`（編集禁止のため。触らないこと）

## 4. 実装内容

### 4.1 手順
1. 下の SQL（4.3）を `supabase/rls_enable.sql` として保存する。
2. Supabase の **SQL Editor** に貼り付けて実行する（何度実行しても安全）。
3. 4.4 の確認用SQLを実行し、**全テーブルの「RLS有効」が true** になっていることを確認する。
4. 第6章の動作確認を、ホスティング後の環境で行う。

### 4.2 テーブルごとに許可する操作
アプリのコードが実際に使っている操作だけを許可します（コード全体を調査した結果）。

| テーブル | 許可する操作 |
|---|---|
| `users` | 読む / 追加 / 更新 |
| `tournaments` | 読む / 追加 / 更新 |
| `mandala_charts` | 読む / 追加 / 更新 |
| `mandala_reflections` | 読む / 追加 |
| `daily_records` | 読む / 追加 / 更新 |
| `comments` | 読む / 追加 / 更新 |
| `physical_records` | 読む / 追加 / 更新 / 削除 |
| `max_training_records` | 読む / 追加 / 更新 / 削除 |
| `practice_sessions` | 読む / 追加 / 更新 |
| `game_stats` | 読む / 追加 / 削除 |
| `goal_update_phases` | 読む / 追加 / 更新 |
| `evaluation_deliveries` | 読む / 追加 / 更新 / 削除 |
| `evaluation_tasks` | 読む / 追加 / 更新 / 削除 |
| `evaluation_answers` | 読む / 追加 / 更新 / 削除 |
| `evaluation_pairs` | 読む / 追加 / 削除 |
| `evaluation_groups` | 読む / 追加 / 更新 / 削除 |
| `evaluation_group_members` | 読む / 追加 / 削除 |
| `ssc_plans` | 読む / 追加 / 更新 |
| `notices` | 読む / 追加 / 更新 |
| `notice_completions` | 読む / 追加 / 更新 / 削除 |
| `timeline_posts`（存在する場合のみ） | 追加 |

- 対象はアプリが使っている匿名キー（`anon`）のみ。ログイン済み（`authenticated`）扱いのアクセスには何も許可しません。
- 許可したテーブルの絞り込み条件は `true`（全件）です。人ごとの制限は第2章のとおり今回はできません。

### 4.3 実行するSQL

```sql
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
```

### 4.4 確認用SQL（実行後に必ず実行）

```sql
SELECT c.relname AS テーブル名, c.relrowsecurity AS RLS有効
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relrowsecurity, c.relname;
```
`RLS有効` が **false の行が1つでもあれば**、そのテーブルにも `ALTER TABLE public.<テーブル名> ENABLE ROW LEVEL SECURITY;` を実行し、アプリが使う操作の許可ルールを同じ形で追加してください（上の表にないテーブルは、アプリが使っていなければ許可ルールなしで構いません）。

## 5. ドキュメントの修正（再発防止のため必須）

今のドキュメントには「RLSは使わない／無効にする」と書かれており、AGENTSの方針では**ドキュメントが優先**されます。直さないと、今後の開発でAIが「RLSを無効に戻す」恐れがあります。

1. **`supabase/migration.sql`**
   - `ALTER TABLE ... DISABLE ROW LEVEL SECURITY;` の行を**すべて削除**（18か所）。残すと、migration.sql を再実行したときにRLSが再び無効になります。
   - 先頭と「RLS（Row Level Security）の無効化」節のコメントを「RLSは `supabase/rls_enable.sql` で有効化する」に書き換える。
   - 「手順2を忘れると… `DISABLE ROW LEVEL SECURITY` を実行」といった適用手順コメントも、`rls_enable.sql` を実行する内容に直す。
2. **`DEPLOYMENT.md`** 1.2節の「RLSは使用しません」の注意書きを、「RLSを有効にしている。セットアップ時は migration.sql の後に `rls_enable.sql` も実行する」に変更。
3. **`docs/要件定義書.md`**
   - 「`daily_records` の RLS が無効であること」（確認項目）→ 「RLS有効で、`daily_records` の更新が許可されていること」
   - 「RLS: 他テーブルと同様に無効化」→ 「RLS: 有効（許可ルールは `rls_enable.sql`）」
   - 「【重要】RLS が無効で…」の注記 → 今回の対応内容と、残るリスク（第2章）に書き換える。
4. 新しいテーブルを作るときのルールを `DEPLOYMENT.md` に追記する: **必ずRLSを有効にし、使う操作の許可ルールを `rls_enable.sql` に追加する**（`AGENTS.md` は編集禁止のため、こちらに書く）。

## 6. ホスティング後の確認項目

**Supabase 側**
- ダッシュボードの Advisors（Security）で、「RLS Disabled in Public」の重大警告が消えている。
- 代わりに「RLS Policy Always True」の注意（Warning）が出るのは**想定どおり**（第2章の理由）。対応不要。

**アプリ側**（選手アカウント・スタッフアカウントの両方で。エラーが出ないこと）
1. ログイン画面にユーザー一覧が出る／ログインできる
2. 日々の記録を保存でき、保存後にAIのスコア・コメントが出る（`daily_records` の更新）
3. コメントの追加・編集
4. マンダラチャートの保存、新しい目標への更新（アーカイブ）、振り返りの保存
5. 身体測定・MAX測定の追加・修正・削除
6. スタッフ: 練習時間の入力、大会の追加・編集、スタッツのCSV取り込みと削除
7. スタッフ: ユーザーの追加・修正・パスワード変更
8. 10ヶ条評価: 配信、回答、グループ／ペアの追加・削除、配信の削除、SSCプランの保存
9. 連絡事項・TODO: 作成、編集、完了チェックと解除、削除（非表示化）
