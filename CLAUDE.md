# 知育アプリプラットフォーム 「えでゅ」（仮称）

## プロジェクト概要

幼児〜小学生向けの知育アプリをまとめたWebプラットフォーム。
親子でアカウントを作成し、複数の知育ゲームで学習できる。

## 技術スタック

- **フロントエンド**: Next.js 16 (App Router) + TypeScript + Tailwind CSS
- **バックエンド/DB**: Supabase (PostgreSQL + Auth + Storage)
- **ホスティング**: Vercel
- **状態管理**: Zustand（軽量でシンプル）

## セットアップ手順

```bash
# プロジェクト作成
npx create-next-app@latest edup-app --typescript --tailwind --app --src-dir

# 依存関係
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs zustand

# 開発サーバー
npm run dev
```

## Supabase設定

### 環境変数 (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### DBスキーマ

```sql
-- 親アカウント（Supabase Authと連携）
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  display_name text,
  created_at timestamptz default now()
);

-- 子供プロフィール（1親に複数の子供）
create table children (
  id uuid default gen_random_uuid() primary key,
  parent_id uuid references profiles(id) on delete cascade,
  name text not null,
  birth_date date,
  avatar_url text,
  created_at timestamptz default now()
);

-- アプリ一覧
create table apps (
  id text primary key, -- 'dots-card', 'flash-calc' など
  name text not null,
  description text,
  icon_url text,
  min_age int,
  max_age int
);

-- 学習進捗（汎用）
create table progress (
  id uuid default gen_random_uuid() primary key,
  child_id uuid references children(id) on delete cascade,
  app_id text references apps(id),
  data jsonb not null, -- アプリごとの進捗データ
  updated_at timestamptz default now(),
  unique(child_id, app_id)
);

-- 学習ログ（詳細記録）
create table activity_logs (
  id uuid default gen_random_uuid() primary key,
  child_id uuid references children(id) on delete cascade,
  app_id text references apps(id),
  session_data jsonb, -- セッションの詳細
  duration_seconds int,
  created_at timestamptz default now()
);

-- RLS (Row Level Security)
alter table profiles enable row level security;
alter table children enable row level security;
alter table progress enable row level security;
alter table activity_logs enable row level security;

-- 自分のデータのみアクセス可能
create policy "Users can view own profile" on profiles
  for all using (auth.uid() = id);

create policy "Users can manage own children" on children
  for all using (auth.uid() = parent_id);

create policy "Users can manage children progress" on progress
  for all using (
    child_id in (select id from children where parent_id = auth.uid())
  );

create policy "Users can manage children logs" on activity_logs
  for all using (
    child_id in (select id from children where parent_id = auth.uid())
  );
```

## ディレクトリ構成

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx              # ランディング or ダッシュボード
│   ├── login/
│   │   └── page.tsx          # ログイン画面
│   ├── signup/
│   │   └── page.tsx          # 新規登録
│   ├── dashboard/
│   │   └── page.tsx          # 親向けダッシュボード
│   ├── children/
│   │   ├── page.tsx          # 子供一覧
│   │   └── [id]/
│   │       └── page.tsx      # 子供詳細・進捗
│   ├── play/
│   │   └── [appId]/
│   │       └── page.tsx      # 各アプリのプレイ画面
│   └── api/
│       └── ...
├── components/
│   ├── ui/                   # 共通UIコンポーネント
│   ├── auth/                 # 認証関連
│   ├── apps/                 # 各知育アプリ
│   │   ├── DotsCard/
│   │   ├── FlashCalc/
│   │   └── ...
│   └── layout/
├── lib/
│   ├── supabase/
│   │   ├── client.ts         # ブラウザ用クライアント
│   │   ├── server.ts         # サーバー用クライアント
│   │   └── types.ts          # DB型定義
│   └── utils.ts
├── hooks/
│   ├── useAuth.ts
│   ├── useChildren.ts
│   └── useProgress.ts
└── stores/
    └── appStore.ts           # Zustand store
```

## 知育アプリ一覧（予定）

### 1. ドッツカード (dots-card)

- **対象**: 0〜3歳
- **内容**: 数の直感的理解
- **進捗データ**: `{ startDate, currentDay, todaySessions, speed, shuffle }`

### 2. フラッシュ計算 (flash-calc)

- **対象**: 4〜8歳
- **内容**: 足し算・引き算のフラッシュカード
- **進捗データ**: `{ level, correctCount, totalCount, lastOperations }`

### 3. ひらがなカルタ (hiragana-karuta)

- **対象**: 3〜6歳
- **内容**: ひらがなの読み取り
- **進捗データ**: `{ masteredChars[], currentSet, accuracy }`

### 4. 国旗クイズ (flag-quiz)

- **対象**: 4〜10歳
- **内容**: 世界の国旗を覚える
- **進捗データ**: `{ knownCountries[], region, difficulty }`

### 5. 時計の読み方 (clock-reader)

- **対象**: 5〜8歳
- **内容**: アナログ時計の読み取り練習
- **進捗データ**: `{ level, accuracy, fastestTime }`

## 共通コンポーネント仕様

### AppWrapper

各知育アプリを包む共通ラッパー。進捗の自動保存、セッションログ記録を担当。

```tsx
<AppWrapper appId="dots-card" childId={childId}>
  <DotsCardApp />
</AppWrapper>
```

### ProgressContext

各アプリ内で進捗データの読み書きを行うContext。

```tsx
const { progress, updateProgress, saveProgress } = useAppProgress();
```

## 認証フロー

1. メールアドレス + パスワードでサインアップ
1. メール確認（Supabase標準）
1. ログイン後、子供プロフィールを作成
1. 子供を選択してアプリをプレイ

## 優先実装順序

1. [ ] Supabase初期設定 + 環境変数
1. [ ] 認証（サインアップ/ログイン/ログアウト）
1. [ ] 子供プロフィールCRUD
1. [ ] ダッシュボード（子供選択）
1. [ ] ドッツカードの移植（進捗保存対応）
1. [ ] 学習ログの記録・表示
1. [ ] 追加アプリの実装

## デザイン方針

- モバイルファースト
- 大きなボタン、タップしやすいUI
- 子供が操作する画面はシンプルに
- 親向け画面は情報を整理して表示
- カラフルだが目に優しい配色

## コマンド

```bash
# 開発
npm run dev

# ビルド
npm run build

# 型チェック
npm run type-check

# Lint
npm run lint
```

## 注意事項

- Supabaseの無料枠: 500MB DB、1GB Storage、50,000 MAU
- 画像はできるだけ圧縮してStorage節約
- 進捗データはJSONBで柔軟に、ただし肥大化注意
