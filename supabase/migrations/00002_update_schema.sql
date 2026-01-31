-- ================================================
-- 00002: スキーマ更新 - apps テーブルに新カラム追加 + インデックス・トリガー等
-- ================================================

-- apps テーブルに新カラム追加
alter table apps add column if not exists sort_order int default 0;
alter table apps add column if not exists is_active boolean default true;
alter table apps alter column min_age set default 0;
alter table apps alter column max_age set default 12;

-- children.parent_id に NOT NULL 制約追加（まだなければ）
alter table children alter column parent_id set not null;

-- progress カラムに NOT NULL 制約・デフォルト追加
alter table progress alter column child_id set not null;
alter table progress alter column app_id set not null;
alter table progress alter column data set default '{}';

-- activity_logs カラムに NOT NULL 制約・デフォルト追加
alter table activity_logs alter column child_id set not null;
alter table activity_logs alter column app_id set not null;
alter table activity_logs alter column session_data set default '{}';
alter table activity_logs alter column duration_seconds set default 0;

-- 初期アプリデータ
insert into apps (id, name, description, min_age, max_age, sort_order) values
  ('dots-card', 'ドッツカード', '数の直感的理解を育てるフラッシュカード', 0, 3, 1),
  ('flash-calc', 'フラッシュ計算', '足し算・引き算を素早く解く練習', 4, 8, 2),
  ('hiragana-karuta', 'ひらがなカルタ', 'ひらがなの読み取りをゲーム感覚で', 3, 6, 3),
  ('flag-quiz', '国旗クイズ', '世界の国旗を覚えよう', 4, 10, 4),
  ('clock-reader', '時計よめるかな', 'アナログ時計の読み方を練習', 5, 8, 5)
on conflict (id) do nothing;

-- インデックス
create index if not exists idx_children_parent on children(parent_id);
create index if not exists idx_progress_child on progress(child_id);
create index if not exists idx_progress_app on progress(app_id);
create index if not exists idx_activity_logs_child on activity_logs(child_id);
create index if not exists idx_activity_logs_created on activity_logs(created_at desc);

-- ================================================
-- RLS ポリシー更新（旧ポリシー削除 → 新ポリシー作成）
-- ================================================

-- 旧ポリシー削除
drop policy if exists "Users can view own profile" on profiles;
drop policy if exists "Users can manage own children" on children;
drop policy if exists "Users can manage children progress" on progress;
drop policy if exists "Users can manage children logs" on activity_logs;

-- Profiles: 操作ごとに分離
create policy "profiles_select_own" on profiles
  for select using (auth.uid() = id);

create policy "profiles_insert_own" on profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id);

-- Children: 自分の子供のみ
create policy "children_all_own" on children
  for all using (auth.uid() = parent_id);

-- Progress: 自分の子供のデータのみ
create policy "progress_all_own" on progress
  for all using (
    child_id in (select id from children where parent_id = auth.uid())
  );

-- Activity Logs: 自分の子供のログのみ
create policy "activity_logs_all_own" on activity_logs
  for all using (
    child_id in (select id from children where parent_id = auth.uid())
  );

-- ================================================
-- Functions & Triggers
-- ================================================

-- 新規ユーザー登録時にprofilesを自動作成
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- progress更新時にupdated_atを自動更新
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
