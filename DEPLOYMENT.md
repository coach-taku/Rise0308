# KUKI GYMRATS RISE NOTE - デプロイ手順書

## アプリケーション概要
- **名前**: KUKI GYMRATS RISE NOTE
- **技術スタック**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + Supabase
- **対象ユーザー**: 高校生女子バスケットボール選手 & コーチ

---

## 1. Supabaseプロジェクトの作成手順

### 1.1 プロジェクト作成
1. [Supabase](https://supabase.com) にログインし、新規プロジェクトを作成する。
2. `Project Settings` > `API` から以下の値を取得する:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Project API Keys - anon (public)** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 1.2 データベースセットアップ
1. Supabase の **SQL Editor** を開く。
2. `supabase/migration.sql` の内容を貼り付けて実行する（テーブル・インデックス作成）。
3. テーブルが正しく作成されたことを **Table Editor** で確認する。

**注意**: 本アプリではRLS（Row Level Security）は使用しません。アクセス制御はクライアント側の `localStorage` に保存された `user_id` と `role` を用いて、クエリの `WHERE` 句で行います。

### 1.3 シードデータの投入
1. `supabase/seed.sql` の内容をSQL Editorに貼り付けて実行する。
2. 選手2名、スタッフ2名、大会1件のデモデータが作成される。
3. 共通の合言葉（パスワード）: `rise`

---

## 2. ローカル開発環境のセットアップ

```bash
# リポジトリをクローン
git clone <repository-url>
cd kuki-gymrats-rise-note

# 依存関係のインストール
npm install

# 環境変数ファイルを作成
cp .env.example .env.local
# .env.local にSupabaseの値を設定

# 開発サーバーの起動
npm run dev
```

### 環境変数ファイル (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**※ 環境変数が未設定の場合、アプリはデモモードで動作します**（ダミーデータを使用し、Supabase接続なしで全機能を確認可能）。

---

## 3. Vercelへのデプロイ

### 3.1 プロジェクト作成
1. [Vercel](https://vercel.com) にログイン。
2. 「Add New...」>「Project」を選択。
3. GitHubリポジトリをインポート。
4. Framework Preset: **Next.js** を選択。

### 3.2 環境変数の設定
Vercel の **Settings** > **Environment Variables** で以下を設定:

| Key | Value | Environment |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL | Production, Preview |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon Key | Production, Preview |

### 3.3 デプロイの実行
- **mainブランチ** → 本番環境 (Production)
- **developブランチ** → プレビュー環境 (Preview)

「Deploy」ボタンを押下して初回デプロイを実行。

---

## 4. デプロイ確認手順

1. Vercelの本番URLにアクセスする。
2. ログイン画面でプルダウンからユーザーを選択し、合言葉（`rise`）でログイン。
3. 以下の画面が正常に動作することを確認:
   - **選手ダッシュボード**: 成長サマリ、カウントダウン、グラフ
   - **マンダラチャート**: 作成・編集・保存
   - **日々の記録**: コンディション入力、振り返り、ポイント付与
   - **グループ共有**: タイムライン表示、コメント
   - **コーチダッシュボード**: チーム一覧、疲労度ハイライト、タイムライン
   - **大会設定**: 追加・編集

---

## 5. developブランチの設定

```bash
git checkout -b develop
git push origin develop
```
Vercelが自動検知し、Preview環境としてデプロイされます。

---

## 6. デモモードについて

環境変数が設定されていない場合、アプリは自動的にデモモードで動作します。

- Supabase接続なしでアプリの全機能を確認可能
- ダミーデータ（選手4名、スタッフ2名）が自動生成
- データはブラウザのメモリ上に保持（リロードでリセット）
- 任意のパスワードでログイン可能

---

## 画面一覧

| 画面ID | パス | 画面名 | 利用者 |
|---|---|---|---|
| SCR-001 | `/login` | ログイン画面 | 共通 |
| SCR-101 | `/player/dashboard` | 選手ダッシュボード | 選手 |
| SCR-102 | `/player/mandala` | マンダラチャート画面 | 選手 |
| SCR-103 | `/player/daily` | 日々の入力画面 | 選手 |
| SCR-104 | `/player/timeline` | グループ共有画面 | 選手/スタッフ |
| SCR-201 | `/coach/dashboard` | コーチダッシュボード | スタッフ |
| SCR-202 | `/coach/tournament` | 大会設定画面 | スタッフ |

---

## データ構造

### `users` テーブル
| カラム | 型 | 説明 |
|---|---|---|
| id | UUID | Primary Key |
| name | Text | 名前 |
| role | Text | 'player' or 'staff' |
| password | Text | 共通の合言葉 |

### `tournaments` テーブル
| カラム | 型 | 説明 |
|---|---|---|
| id | UUID | Primary Key |
| name | Text | 大会名 |
| target_date | Date | 目標日 |

### `mandala_charts` テーブル
| カラム | 型 | 説明 |
|---|---|---|
| id | UUID | Primary Key |
| user_id | UUID | FK → users.id |
| core_goal | Text | コア目標 |
| elements | JSONB | 8つの主要要素 |
| actions | JSONB | 64の具体行動 |
| target_date | Date | 目標日 |
| created_at | Timestamp | 作成日時 |

### `daily_records` テーブル
| カラム | 型 | 説明 |
|---|---|---|
| id | UUID | Primary Key |
| user_id | UUID | FK → users.id |
| record_date | Date | 対象日 |
| sleep_hours | Numeric | 睡眠時間 |
| fatigue_level | Integer (1-10) | 疲労度 |
| has_pain | Boolean | 痛みの有無 |
| pain_detail | Text | 痛みの詳細 |
| participation_status | Text | 参加状況 |
| target_items | JSONB | 選択した目標 |
| self_evaluation | Integer (1-10) | 自己評価 |
| reflection | Text | 振り返り |
| points | Integer | 獲得ポイント |
| created_at | Timestamp | 作成日時 |

### `comments` テーブル
| カラム | 型 | 説明 |
|---|---|---|
| id | UUID | Primary Key |
| daily_record_id | UUID | FK → daily_records.id |
| user_id | UUID | FK → users.id |
| content | Text | コメント内容 |
| created_at | Timestamp | 作成日時 |
