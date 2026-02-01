-- TVログイン用セッションテーブル
create table tv_login_sessions (
  id uuid default gen_random_uuid() primary key,
  token text unique not null,
  user_id uuid references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'expired')),
  created_at timestamptz default now(),
  approved_at timestamptz
);

-- 古いセッションを自動的に期限切れにするため、インデックスを作成
create index idx_tv_login_sessions_token on tv_login_sessions(token);
create index idx_tv_login_sessions_created_at on tv_login_sessions(created_at);

-- RLSを有効化
alter table tv_login_sessions enable row level security;

-- 認証不要でセッション作成可能（TV側は未認証）
create policy "Anyone can create tv login session" on tv_login_sessions
  for insert with check (true);

-- トークンでセッションのステータスを確認可能（TV側ポーリング用）
create policy "Anyone can view tv login session by token" on tv_login_sessions
  for select using (true);

-- 認証済みユーザーのみ承認可能
create policy "Authenticated users can approve tv login session" on tv_login_sessions
  for update using (auth.uid() is not null);
