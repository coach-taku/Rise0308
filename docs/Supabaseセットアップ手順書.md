# Supabase セットアップ手順書

## この手順書について

RISE NOTE アプリの「カルテ保存機能」を正しく動かすために、  
Supabase（データベース）側で設定が必要です。

この手順書では、**パソコンのブラウザで行う操作を1ステップずつ**説明します。  
コードを書く必要はありません。**コピー＆貼り付けだけ**で完了します。

> 所要時間：約10〜15分

---

## 目次

1. [Supabase にログインする](#1-supabase-にログインする)
2. [SQL Editor を開く](#2-sql-editor-を開く)
3. [テーブルが作成済みか確認する](#3-テーブルが作成済みか確認する)
4. [テーブルが未作成の場合 → テーブルを作成する](#4-テーブルが未作成の場合--テーブルを作成する)
5. [RLS ポリシーを設定する（★ 最重要 ★）](#5-rls-ポリシーを設定する-最重要-)
6. [設定が正しくできたか確認する](#6-設定が正しくできたか確認する)
7. [アプリで動作確認する](#7-アプリで動作確認する)
8. [うまくいかない場合](#8-うまくいかない場合)

---

## 1. Supabase にログインする

1. パソコンのブラウザ（Chrome や Safari）を開きます
2. アドレスバーに以下を入力して、Enter キーを押します

   ```
   https://supabase.com/dashboard
   ```

3. ログイン画面が表示されたら、登録済みのアカウントでログインします
   - GitHub アカウントでログインしている場合は「Continue with GitHub」を押します

4. ログインすると、プロジェクト一覧が表示されます
5. **RISE NOTE 用のプロジェクト**を選んで押します
   - プロジェクト名がわからない場合は、URL に `lealscgfatfopoccvtvt` が含まれているものです

---

## 2. SQL Editor を開く

1. プロジェクトの画面が開いたら、**左側のメニュー**を見てください
2. メニューの中から **「SQL Editor」** を探して押します
   - アイコンは `>_` のような形をしています
   - 上から数えて、だいたい5〜6番目あたりにあります
3. 「SQL Editor」の画面が開きます。大きな白い入力エリアが表示されます
4. もし入力エリアに何か文字が入っていたら、**全部消してください**
   - キーボードの `Ctrl + A`（Mac は `Cmd + A`）で全選択 → `Delete` キーで消せます

---

## 3. テーブルが作成済みか確認する

まず、カルテ機能に必要なテーブルがすでに作られているか確認します。

1. SQL Editor の入力エリアに、以下の文をコピーして貼り付けてください

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

2. 画面右下、もしくは入力エリアの下にある **緑色の「Run」ボタン**を押します
   - または、キーボードで `Ctrl + Enter`（Mac は `Cmd + Enter`）でも実行できます

3. 下の結果エリアにテーブル名の一覧が表示されます

4. **以下の2つがあるか確認してください：**
   - `physical_records`
   - `max_training_records`

### → 2つとも表示された場合

テーブルは作成済みです。  
**[手順5（RLS ポリシーの設定）](#5-rls-ポリシーを設定する-最重要-) に進んでください。**

### → どちらか、または両方が表示されない場合

テーブルがまだ作られていません。  
**次の[手順4（テーブル作成）](#4-テーブルが未作成の場合--テーブルを作成する) に進んでください。**

---

## 4. テーブルが未作成の場合 → テーブルを作成する

> この手順は、手順3で `physical_records` や `max_training_records` が  
> 表示されなかった場合のみ実行してください。

1. SQL Editor の入力エリアを**すべて消します**
   - `Ctrl + A` → `Delete`

2. 以下をすべてコピーして、入力エリアに貼り付けてください

```sql
-- ============================================================
-- カルテ機能用テーブル作成
-- ============================================================

-- 身体測定データ（身長・体重・体脂肪率・筋肉量）
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

-- MAX測定データ（ベンチプレス・スクワット・デッドリフト）
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

-- 検索用インデックス
CREATE INDEX IF NOT EXISTS idx_physical_records_user ON physical_records(user_id, measured_date);
CREATE INDEX IF NOT EXISTS idx_max_training_records_user ON max_training_records(user_id, measured_date);
```

3. **「Run」ボタン**を押します

4. 画面下の結果エリアに **「Success. No rows returned」** と表示されれば成功です

5. もしエラーが表示されたら：
   - 「already exists」と出た場合 → すでに作成済みなので問題ありません。次に進んでください
   - 「users」に関するエラーが出た場合 → `users` テーブルがまだ作られていません。  
     `migration.sql` の全体を先に実行する必要があります（[手順8](#8-うまくいかない場合)を参照）

---

## 5. RLS ポリシーを設定する（★ 最重要 ★）

> **ここが最も重要な手順です！**  
> この設定をしないと、カルテのデータ保存が必ず失敗します。

### なぜ必要？（簡単な説明）

Supabase には「RLS（行レベルセキュリティ）」という仕組みがあります。  
これは「誰がデータを読み書きできるか」を制御するものです。

テーブルを作ると、RLS が自動で有効になりますが、  
「誰にも読み書きを許可しない」状態になっています。  
つまり、**ポリシー（許可ルール）を設定しないと、アプリからデータを保存できません。**

### 設定手順

1. SQL Editor の入力エリアを**すべて消します**
   - `Ctrl + A` → `Delete`

2. 以下をすべてコピーして、入力エリアに貼り付けてください

```sql
-- ============================================================
-- RLS（行レベルセキュリティ）ポリシー設定
-- すべてのテーブルに対して、アプリからの読み書きを許可します
-- ============================================================

-- ■ users テーブル
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_anon_select" ON users;
CREATE POLICY "users_anon_select" ON users FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "users_anon_insert" ON users;
CREATE POLICY "users_anon_insert" ON users FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "users_anon_update" ON users;
CREATE POLICY "users_anon_update" ON users FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ■ tournaments テーブル
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tournaments_anon_all" ON tournaments;
CREATE POLICY "tournaments_anon_all" ON tournaments FOR ALL TO anon USING (true) WITH CHECK (true);

-- ■ mandala_charts テーブル
ALTER TABLE mandala_charts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mandala_charts_anon_all" ON mandala_charts;
CREATE POLICY "mandala_charts_anon_all" ON mandala_charts FOR ALL TO anon USING (true) WITH CHECK (true);

-- ■ daily_records テーブル
ALTER TABLE daily_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "daily_records_anon_all" ON daily_records;
CREATE POLICY "daily_records_anon_all" ON daily_records FOR ALL TO anon USING (true) WITH CHECK (true);

-- ■ comments テーブル
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comments_anon_all" ON comments;
CREATE POLICY "comments_anon_all" ON comments FOR ALL TO anon USING (true) WITH CHECK (true);

-- ■ physical_records テーブル（★ カルテ：身体測定 ★）
ALTER TABLE physical_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "physical_records_anon_all" ON physical_records;
CREATE POLICY "physical_records_anon_all" ON physical_records FOR ALL TO anon USING (true) WITH CHECK (true);

-- ■ max_training_records テーブル（★ カルテ：MAX測定 ★）
ALTER TABLE max_training_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "max_training_records_anon_all" ON max_training_records;
CREATE POLICY "max_training_records_anon_all" ON max_training_records FOR ALL TO anon USING (true) WITH CHECK (true);
```

3. **「Run」ボタン**を押します

4. 画面下の結果エリアに **「Success. No rows returned」** と表示されれば成功です

5. 万が一エラーが出た場合：
   - 「relation "○○" does not exist」→ そのテーブルがまだ作られていません。[手順4](#4-テーブルが未作成の場合--テーブルを作成する) を先に実行してください
   - 「policy "○○" already exists」→ `DROP POLICY` が含まれているので通常出ませんが、出た場合でも気にしなくて大丈夫です

---

## 6. 設定が正しくできたか確認する

すべての設定が正しくできたか、最終チェックを行います。

1. SQL Editor の入力エリアを**すべて消します**

2. 以下をコピーして貼り付け、「Run」を押してください

```sql
-- テーブル一覧と RLS の状態を確認
SELECT 
  tablename AS "テーブル名",
  CASE WHEN rowsecurity THEN '有効' ELSE '無効' END AS "RLS状態"
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
```

3. 結果に以下の7つのテーブルが表示され、**すべて「有効」** になっていれば OK です

| テーブル名 | RLS状態 |
|---|---|
| comments | 有効 |
| daily_records | 有効 |
| mandala_charts | 有効 |
| max_training_records | 有効 |
| physical_records | 有効 |
| tournaments | 有効 |
| users | 有効 |

4. 次に、入力エリアを消して、以下を貼り付けて「Run」を押してください

```sql
-- ポリシーの一覧を確認
SELECT 
  tablename AS "テーブル名",
  policyname AS "ポリシー名"
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;
```

5. 結果に以下のようなポリシーが表示されれば、設定完了です

| テーブル名 | ポリシー名 |
|---|---|
| comments | comments_anon_all |
| daily_records | daily_records_anon_all |
| mandala_charts | mandala_charts_anon_all |
| max_training_records | max_training_records_anon_all |
| physical_records | physical_records_anon_all |
| tournaments | tournaments_anon_all |
| users | users_anon_insert |
| users | users_anon_select |
| users | users_anon_update |

> ポリシーがひとつも表示されない場合は、[手順5](#5-rls-ポリシーを設定する-最重要-) をもう一度実行してください。

---

## 7. アプリで動作確認する

Supabase の設定が完了したら、アプリで確認しましょう。

1. スマホまたはパソコンのブラウザで RISE NOTE を開きます

   ```
   https://rise0308.vercel.app
   ```

2. 選手アカウントでログインします
   - 名前とあいことばを入力してログイン

3. 画面下のメニューから **「カルテ」** を押します

4. **「+ 新規記録」** ボタンを押します

5. 測定日と、いずれかの項目（身長、体重、体脂肪率、筋肉量）を入力します

6. **「保存する」** ボタンを押します

7. **以下のように動作すれば成功です：**
   - 画面右上に **緑色の通知**（「身体測定データを保存しました」）が表示される
   - 入力フォームが閉じる
   - 画面下の「記録一覧」に、今入力したデータが表示される

8. **もしエラーが出た場合：**
   - 画面右上に **赤い通知** が表示され、エラーの内容が書かれています
   - エラーの内容を見て、以下を確認してください：
     - 「テーブルが存在しません」→ [手順4](#4-テーブルが未作成の場合--テーブルを作成する) を実行
     - 「RLSポリシーが未設定」→ [手順5](#5-rls-ポリシーを設定する-最重要-) を実行
     - 「ユーザーIDが存在しません」→ ログインし直してください

---

## 8. うまくいかない場合

### 「users テーブルがない」と言われた

`users` テーブルを含む全テーブルをまとめて作成する必要があります。  
SQL Editor を開き、入力エリアを消して、以下を貼り付けて「Run」してください。

```sql
-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('player', 'staff')),
  password TEXT NOT NULL
);

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

-- 6. Physical Records table（カルテ：身体測定）
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

-- 7. Max Training Records table（カルテ：MAX測定）
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

-- インデックス
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_daily_records_user_date ON daily_records(user_id, record_date);
CREATE INDEX IF NOT EXISTS idx_daily_records_date ON daily_records(record_date);
CREATE INDEX IF NOT EXISTS idx_comments_record ON comments(daily_record_id);
CREATE INDEX IF NOT EXISTS idx_mandala_user ON mandala_charts(user_id);
CREATE INDEX IF NOT EXISTS idx_physical_records_user ON physical_records(user_id, measured_date);
CREATE INDEX IF NOT EXISTS idx_max_training_records_user ON max_training_records(user_id, measured_date);
```

その後、**必ず [手順5（RLS ポリシーの設定）](#5-rls-ポリシーを設定する-最重要-) も実行してください。**

---

### ユーザー（選手・スタッフ）がまだ登録されていない

テーブル作成後、初期ユーザーを登録します。  
SQL Editor を開き、入力エリアを消して、以下を貼り付けて「Run」してください。

```sql
-- 選手データ（あいことば: rise）
INSERT INTO users (id, name, role, password) VALUES
  (gen_random_uuid(), '山田 花子', 'player', 'rise'),
  (gen_random_uuid(), '鈴木 美咲', 'player', 'rise');

-- スタッフデータ（あいことば: rise）
INSERT INTO users (id, name, role, password) VALUES
  (gen_random_uuid(), '高橋 コーチ', 'staff', 'rise'),
  (gen_random_uuid(), '伊藤 監督', 'staff', 'rise');

-- 大会データ
INSERT INTO tournaments (name, target_date) VALUES
  ('インターハイ予選', '2026-06-15');
```

> 名前やあいことばは、自由に変更して構いません。

---

### それでもうまくいかない場合

以下の情報を確認してください：

1. **Supabase のプロジェクト URL** が正しいか
   - Vercel の環境変数 `NEXT_PUBLIC_SUPABASE_URL` と一致しているか
2. **Supabase の anon key** が正しいか
   - Vercel の環境変数 `NEXT_PUBLIC_SUPABASE_ANON_KEY` と一致しているか
3. Vercel の環境変数を確認する方法：
   - https://vercel.com にログイン
   - プロジェクトを選択
   - 「Settings」→「Environment Variables」を開く
   - `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` が設定されているか確認

---

## やったことのまとめ

この手順書で行ったことは以下の3つです：

1. **テーブルの作成**（手順4）  
   → カルテデータを保存するための「箱」を作った

2. **RLS ポリシーの設定**（手順5）  
   → アプリからその「箱」にデータを出し入れする「許可」を与えた

3. **確認**（手順6・7）  
   → 設定が正しいこと、アプリが動くことを確認した

---

最終更新：2026-05-04（カルテ保存機能の不具合対応）
