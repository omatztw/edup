– ================================================
– 知育アプリプラットフォーム
– Supabase DBスキーマ
– ================================================

- 親アカウント（Supabase Authと連携）
create table if not exists profiles (
id uuid references auth.users on delete cascade primary key,
email text,
display_name text,
created_at timestamptz default now()
);

– 子供プロフィール（1親に複数の子供）
create table if not exists children (
id uuid default gen_random_uuid() primary key,
parent_id uuid references profiles(id) on delete cascade not null,
name text not null,
birth_date date,
avatar_url text,
created_at timestamptz default now()
);

– アプリ一覧（マスターデータ）
create table if not exists apps (
id text primary key,
name text not null,
description text,
icon_url text,
min_age int default 0,
max_age int default 12,
sort_order int default 0,
is_active boolean default true
);

– 初期アプリデータ
insert into apps (id, name, description, min_age, max_age, sort_order) values
(‘dots-card’, ‘ドッツカード’, ‘数の直感的理解を育てるフラッシュカード’, 0, 3, 1),
(‘flash-calc’, ‘フラッシュ計算’, ‘足し算・引き算を素早く解く練習’, 4, 8, 2),
(‘hiragana-karuta’, ‘ひらがなカルタ’, ‘ひらがなの読み取りをゲーム感覚で’, 3, 6, 3),
(‘flag-quiz’, ‘国旗クイズ’, ‘世界の国旗を覚えよう’, 4, 10, 4),
(‘clock-reader’, ‘時計よめるかな’, ‘アナログ時計の読み方を練習’, 5, 8, 5)
on conflict (id) do nothing;

– 学習進捗（汎用、アプリごとに1レコード）
create table if not exists progress (
id uuid default gen_random_uuid() primary key,
child_id uuid references children(id) on delete cascade not null,
app_id text references apps(id) not null,
data jsonb not null default ‘{}’,
updated_at timestamptz default now(),
unique(child_id, app_id)
);

– 学習ログ（セッションごとの詳細記録）
create table if not exists activity_logs (
id uuid default gen_random_uuid() primary key,
child_id uuid references children(id) on delete cascade not null,
app_id text references apps(id) not null,
session_data jsonb default ‘{}’,
duration_seconds int default 0,
created_at timestamptz default now()
);

– インデックス
create index if not exists idx_children_parent on children(parent_id);
create index if not exists idx_progress_child on progress(child_id);
create index if not exists idx_progress_app on progress(app_id);
create index if not exists idx_activity_logs_child on activity_logs(child_id);
create index if not exists idx_activity_logs_created on activity_logs(created_at desc);

– ================================================
– Row Level Security (RLS)
– ================================================

alter table profiles enable row level security;
alter table children enable row level security;
alter table progress enable row level security;
alter table activity_logs enable row level security;

– Profiles: 自分のみ
create policy “profiles_select_own” on profiles
for select using (auth.uid() = id);

create policy “profiles_insert_own” on profiles
for insert with check (auth.uid() = id);

create policy “profiles_update_own” on profiles
for update using (auth.uid() = id);

– Children: 自分の子供のみ
create policy “children_all_own” on children
for all using (auth.uid() = parent_id);

– Progress: 自分の子供のデータのみ
create policy “progress_all_own” on progress
for all using (
child_id in (select id from children where parent_id = auth.uid())
);

– Activity Logs: 自分の子供のログのみ
create policy “activity_logs_all_own” on activity_logs
for all using (
child_id in (select id from children where parent_id = auth.uid())
);

– ================================================
– Functions & Triggers
– ================================================

– 新規ユーザー登録時にprofilesを自動作成
create or replace function public.handle_new_user()
returns trigger as $$
begin
insert into public.profiles (id, email, display_name)
values (new.id, new.email, coalesce(new.raw_user_meta_data->>‘display_name’, split_part(new.email, ‘@’, 1)));
return new;
end;
$$ language plpgsql security definer;

– トリガー
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

– progress更新時にupdated_atを自動更新
create or replace function update_updated_at()
returns trigger as $$
begin
new.updated_at = now();
return new;
end;
$$ language plpgsql;

drop trigger if exists progress_updated_at on progress;
create trigger progress_updated_at
before update on progress
for each row execute procedure update_updated_at();
