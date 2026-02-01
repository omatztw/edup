-- ================================================
-- 00005: 英語フラッシュカード (english-flash) アプリ追加
-- ================================================

-- アプリ登録
insert into apps (id, name, description, min_age, max_age, sort_order) values
  ('english-flash', '英語フラッシュ', '絵文字と音声で英単語を覚えるフラッシュカード', 2, 8, 6)
on conflict (id) do nothing;
