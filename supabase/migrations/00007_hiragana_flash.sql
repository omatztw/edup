-- ================================================
-- 00007: ひらがなフラッシュカード (hiragana-flash) アプリ追加
-- ================================================

-- アプリ登録
insert into apps (id, name, description, min_age, max_age, sort_order) values
  ('hiragana-flash', 'ひらがなフラッシュ', '絵文字・ひらがな・漢字で文字を覚えるフラッシュカード', 2, 6, 7)
on conflict (id) do nothing;
