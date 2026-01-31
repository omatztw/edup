-- ================================================
-- 00003: スケジュール管理 & バッジ機能
-- ================================================

-- スケジュール: 子供ごと・アプリごとの曜日別スケジュール
create table schedules (
  id uuid default gen_random_uuid() primary key,
  child_id uuid references children(id) on delete cascade not null,
  app_id text references apps(id) not null,
  day_of_week int not null check (day_of_week between 0 and 6), -- 0=日, 1=月, ..., 6=土
  target_sessions int not null default 3, -- 1日の目標回数
  is_active boolean default true,
  created_at timestamptz default now(),
  unique(child_id, app_id, day_of_week)
);

-- バッジ定義マスタ
create table badge_definitions (
  id text primary key, -- 'first-session', 'streak-3', etc.
  name text not null,
  description text not null,
  icon text not null, -- emoji
  category text not null default 'general', -- 'streak', 'count', 'milestone'
  sort_order int default 0
);

-- 獲得バッジ
create table earned_badges (
  id uuid default gen_random_uuid() primary key,
  child_id uuid references children(id) on delete cascade not null,
  badge_id text references badge_definitions(id) not null,
  earned_at timestamptz default now(),
  metadata jsonb default '{}', -- 追加情報（例: アプリID、達成数など）
  unique(child_id, badge_id)
);

-- インデックス
create index if not exists idx_schedules_child on schedules(child_id);
create index if not exists idx_earned_badges_child on earned_badges(child_id);
create index if not exists idx_activity_logs_child_date on activity_logs(child_id, created_at desc);

-- RLS
alter table schedules enable row level security;
alter table badge_definitions enable row level security;
alter table earned_badges enable row level security;

create policy "schedules_all_own" on schedules
  for all using (
    child_id in (select id from children where parent_id = auth.uid())
  );

create policy "badge_definitions_select_all" on badge_definitions
  for select using (true);

create policy "earned_badges_all_own" on earned_badges
  for all using (
    child_id in (select id from children where parent_id = auth.uid())
  );

-- バッジ初期データ
insert into badge_definitions (id, name, description, icon, category, sort_order) values
  ('first-session',     'はじめの一歩',     'はじめてセッションを完了した',           '👶', 'milestone', 1),
  ('sessions-10',       '10回達成',         '合計10回セッションを完了した',           '⭐', 'count',     2),
  ('sessions-50',       '50回達成',         '合計50回セッションを完了した',           '🌟', 'count',     3),
  ('sessions-100',      '100回達成',        '合計100回セッションを完了した',          '💫', 'count',     4),
  ('streak-3',          '3日連続',          '3日連続で学習した',                     '🔥', 'streak',    5),
  ('streak-7',          '1週間連続',        '7日連続で学習した',                     '🔥', 'streak',    6),
  ('streak-30',         '1ヶ月連続',        '30日連続で学習した',                    '🏆', 'streak',    7),
  ('schedule-complete', 'スケジュール達成', '1日のスケジュールを全て完了した',         '📅', 'general',   8),
  ('dots-card-master',  'ドッツマスター',   'ドッツカードを100まで完了した',          '🎓', 'milestone', 9),
  ('early-bird',        '早起きさん',       '朝8時前に学習した',                     '🌅', 'general',   10)
on conflict (id) do nothing;
