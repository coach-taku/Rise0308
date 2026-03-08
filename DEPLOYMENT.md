# KUKI GYMRATS RISE NOTE - デプロイ手順書

## アプリケーション概要
- **名前**: KUKI GYMRATS RISE NOTE
- **技術スタック**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + Supabase
- **対象ユーザー**: 高校生女子バスケットボール選手 & コーチ

## 1. Supabaseプロジェクトの作成手順

### 1.1 プロジェクト作成
1. [Supabase](https://supabase.com) にログインし、新規プロジェクトを作成する。
2. `Project Settings` > `API` から以下の値を取得する:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Project API Keys - anon (public)** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 1.2 データベースセットアップ
1. Supabase の **SQL Editor** を開く。
2. `supabase/migration.sql` の内容を貼り付けて実行する（テーブル、RLS、インデックス作成）。
3. テーブルが正しく作成されたことを **Table Editor** で確認する。

### 1.3 認証ユーザーの作成
1. Supabase ダッシュボードの **Authentication** > **Users** > **Add User** で以下のユーザーを作成する:

| メールアドレス | パスワード | 備考 |
|---|---|---|
| player1@risenote.local | rise2024 | 選手1 |
| player2@risenote.local | rise2024 | 選手2 |
| coach1@risenote.local | rise2024 | コーチ |
| coach2@risenote.local | rise2024 | 監督 |

※ パスワードはチーム共通の「合言葉」です。全員同じパスワードを設定します。
※ 「Auto Confirm User?」にチェックを入れてください。

2. 各ユーザーの **UUID** をメモする（Authentication > Users 一覧で確認可能）。

### 1.4 シードデータの投入
1. `supabase/seed.sql` を開き、メモしたUUIDでプレースホルダーを置換する。
2. SQL Editor で実行する。

### 1.5 Supabase Auth 設定
1. **Authentication** > **Providers** で Email Auth が有効であることを確認。
2. **Authentication** > **URL Configuration** で:
   - Site URL: デプロイ先のURL（例: `https://your-app.vercel.app`）
   - Redirect URLs: 同上

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

## 4. デプロイ確認手順

1. Vercelの本番URLにアクセスする。
2. ログイン画面でプルダウンからユーザーを選択し、合言葉（`rise2024`）でログイン。
3. 以下の画面が正常に動作することを確認:
   - 選手ダッシュボード（成長サマリ、カウントダウン、グラフ）
   - マンダラチャート（作成・編集・保存）
   - 日々の記録（コンディション入力、振り返り、ポイント付与）
   - グループ共有（タイムライン表示、コメント）
   - コーチダッシュボード（チーム一覧、疲労度ハイライト、タイムライン）
   - 大会設定（追加・編集）

## 5. developブランチの設定

```bash
# developブランチを作成
git checkout -b develop
git push origin develop
```

Vercelが自動検知し、Preview環境としてデプロイされます。

## 6. デモモードについて

環境変数が設定されていない場合（`NEXT_PUBLIC_SUPABASE_URL`が未設定またはプレースホルダー値の場合）、アプリは自動的にデモモードで動作します。

**デモモードの特徴:**
- Supabase接続なしでアプリの全機能を確認可能
- ダミーデータ（選手4名、コーチ2名）が自動生成
- データはブラウザのメモリ上に保持（リロードでリセット）
- 任意のパスワードでログイン可能

## 画面一覧

| 画面ID | パス | 画面名 | 利用者 |
|---|---|---|---|
| SCR-001 | `/login` | ログイン画面 | 共通 |
| SCR-101 | `/player/dashboard` | 選手ダッシュボード | 選手 |
| SCR-102 | `/player/mandala` | マンダラチャート画面 | 選手 |
| SCR-103 | `/player/daily` | 日々の入力画面 | 選手 |
| SCR-104 | `/player/timeline` | グループ共有画面 | 選手/コーチ |
| SCR-201 | `/coach/dashboard` | コーチダッシュボード | コーチ |
| SCR-202 | `/coach/tournament` | 大会設定画面 | コーチ |
