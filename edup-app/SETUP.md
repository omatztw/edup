# セットアップガイド

## 1. Supabase プロジェクト作成

1. [supabase.com](https://supabase.com) でプロジェクトを作成
2. **Project Settings > API** から以下を取得:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` キー → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3. **SQL Editor** でリポジトリルートの `supabase/migrations/` 内のSQLを順番に実行:
   - `00001_create_schema.sql`
   - `00002_update_schema.sql`

4. **Authentication > URL Configuration** で:
   - Site URL: `https://your-app.vercel.app`（デプロイ後に設定）
   - Redirect URLs: `https://your-app.vercel.app/auth/callback` を追加

## 2. ローカル開発

```bash
git clone https://github.com/omatztw/edup.git
cd edup/edup-app

# .env.local を作成（.env.local.example を参考）
cp .env.local.example .env.local
# NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を設定

npm install
npm run dev
```

http://localhost:3000 で動作確認。

## 3. Vercel デプロイ

### 方法A: Vercel CLI

```bash
npm i -g vercel
vercel
```

### 方法B: GitHub連携

1. [vercel.com](https://vercel.com) で `omatztw/edup` リポジトリをインポート
2. **Root Directory** を `edup-app` に設定（リポジトリルートではなくサブディレクトリ）
3. 環境変数を設定:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. デプロイ

### 環境変数の設定

Vercelダッシュボード > Settings > Environment Variables に以下を追加:

| 変数名 | 値 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabaseプロジェクトの URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabaseの anon key |

### デプロイ後の設定

1. Vercelで割り当てられたドメイン（`your-app.vercel.app`）を確認
2. Supabaseの **Authentication > URL Configuration** に以下を設定:
   - **Site URL**: `https://your-app.vercel.app`
   - **Redirect URLs**: `https://your-app.vercel.app/auth/callback`

## 4. 動作確認

1. トップページ (`/`) → ログイン・新規登録ボタンが表示
2. 新規登録 (`/signup`) → メール送信後、確認メールのリンクをクリック
3. ログイン (`/login`) → ダッシュボードにリダイレクト
4. ダッシュボード (`/dashboard`) → ユーザー情報が表示
5. ログアウト → ログイン画面に戻る
