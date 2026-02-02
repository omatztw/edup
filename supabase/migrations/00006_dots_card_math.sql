-- ================================================
-- 00006: ドッツ計算 (dots-card-math) アプリ追加
-- ================================================

-- アプリ登録
insert into apps (id, name, description, min_age, max_age, sort_order) values
  ('dots-card-math', 'ドッツカード計算', 'ドッツカードで足し算・引き算を学ぶ', 2, 8, 7)
on conflict (id) do nothing;
