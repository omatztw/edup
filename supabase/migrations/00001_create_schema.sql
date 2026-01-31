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
