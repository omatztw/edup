import { SupabaseClient } from "@supabase/supabase-js";

/**
 * セッション完了後にバッジ判定を行い、新しく獲得したバッジを返す
 */
export async function checkAndAwardBadges(
  supabase: SupabaseClient,
  childId: string,
  appId: string
): Promise<{ id: string; name: string; icon: string }[]> {
  const newBadges: { id: string; name: string; icon: string }[] = [];

  // 既に獲得済みのバッジ
  const { data: earned } = await supabase
    .from("earned_badges")
    .select("badge_id")
    .eq("child_id", childId);
  const earnedIds = new Set((earned ?? []).map((e) => e.badge_id));

  // activity_logsからセッション数と連続日数を取得
  const { data: logs } = await supabase
    .from("activity_logs")
    .select("created_at")
    .eq("child_id", childId)
    .order("created_at", { ascending: false });

  const totalSessions = logs?.length ?? 0;

  // 連続日数を計算
  const streak = calculateStreak(logs?.map((l) => l.created_at) ?? []);

  // 現在時刻
  const now = new Date();
  const hour = now.getHours();

  // バッジ判定
  const checks: { id: string; condition: boolean; metadata?: Record<string, unknown> }[] = [
    { id: "first-session", condition: totalSessions >= 1 },
    { id: "sessions-10", condition: totalSessions >= 10 },
    { id: "sessions-50", condition: totalSessions >= 50 },
    { id: "sessions-100", condition: totalSessions >= 100 },
    { id: "streak-3", condition: streak >= 3 },
    { id: "streak-7", condition: streak >= 7 },
    { id: "streak-30", condition: streak >= 30 },
    { id: "early-bird", condition: hour < 8 },
  ];

  // ドッツカード完了チェック
  if (appId === "dots-card") {
    const { data: progress } = await supabase
      .from("progress")
      .select("data")
      .eq("child_id", childId)
      .eq("app_id", "dots-card")
      .single();
    if (progress?.data) {
      const p = progress.data as { currentDay: number };
      // day 51以降で100まで到達
      if (p.currentDay >= 51) {
        checks.push({ id: "dots-card-master", condition: true });
      }
    }
  }

  // スケジュール達成チェック
  const today = now.getDay(); // 0=日
  const todayStr = now.toISOString().slice(0, 10);
  const { data: schedules } = await supabase
    .from("schedules")
    .select("app_id, target_sessions")
    .eq("child_id", childId)
    .eq("day_of_week", today)
    .eq("is_active", true);

  if (schedules && schedules.length > 0) {
    let allComplete = true;
    for (const s of schedules) {
      const { count } = await supabase
        .from("activity_logs")
        .select("id", { count: "exact", head: true })
        .eq("child_id", childId)
        .eq("app_id", s.app_id)
        .gte("created_at", todayStr + "T00:00:00")
        .lte("created_at", todayStr + "T23:59:59");
      if ((count ?? 0) < s.target_sessions) {
        allComplete = false;
        break;
      }
    }
    if (allComplete) {
      checks.push({ id: "schedule-complete", condition: true });
    }
  }

  // バッジ定義を取得
  const { data: definitions } = await supabase
    .from("badge_definitions")
    .select("id, name, icon");
  const defMap = new Map((definitions ?? []).map((d) => [d.id, d]));

  // 新しいバッジを付与
  for (const check of checks) {
    if (check.condition && !earnedIds.has(check.id)) {
      const { error } = await supabase
        .from("earned_badges")
        .insert({ child_id: childId, badge_id: check.id, metadata: check.metadata ?? {} });
      if (!error) {
        const def = defMap.get(check.id);
        if (def) {
          newBadges.push({ id: def.id, name: def.name, icon: def.icon });
        }
      }
    }
  }

  return newBadges;
}

/** 日付リスト（降順）から連続日数を計算 */
function calculateStreak(timestamps: string[]): number {
  if (timestamps.length === 0) return 0;

  const dates = [...new Set(timestamps.map((t) => t.slice(0, 10)))].sort().reverse();
  const today = new Date().toISOString().slice(0, 10);

  // 今日か昨日からスタートしないと連続にならない
  if (dates[0] !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (dates[0] !== yesterday.toISOString().slice(0, 10)) return 0;
  }

  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    const diff = (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24);
    if (Math.round(diff) === 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}
