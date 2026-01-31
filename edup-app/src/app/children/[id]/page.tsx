import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ScheduleManager from "./schedule-manager";
import ActivityHistory from "./activity-history";
import BadgeList from "./badge-list";

export default async function ChildDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: childId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: child } = await supabase
    .from("children")
    .select("id, name, birth_date")
    .eq("id", childId)
    .single();

  if (!child) redirect("/dashboard");

  // スケジュール取得
  const { data: schedules } = await supabase
    .from("schedules")
    .select("*")
    .eq("child_id", childId)
    .order("day_of_week");

  // バッジ取得
  const { data: badges } = await supabase
    .from("earned_badges")
    .select("badge_id, earned_at, badge_definitions(name, icon, description)")
    .eq("child_id", childId)
    .order("earned_at", { ascending: false });

  // 直近のアクティビティログ
  const { data: logs } = await supabase
    .from("activity_logs")
    .select("id, app_id, duration_seconds, session_data, created_at")
    .eq("child_id", childId)
    .order("created_at", { ascending: false })
    .limit(30);

  // アプリ一覧
  const { data: apps } = await supabase
    .from("apps")
    .select("id, name")
    .eq("is_active", true)
    .order("sort_order");

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white">
      <header className="border-b bg-white px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <a href="/dashboard" className="text-sm text-sky-600 hover:underline">
            ← ダッシュボード
          </a>
          <h1 className="text-xl font-bold text-sky-600">えでゅ</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <h2 className="text-xl font-bold text-gray-800">{child.name}さん</h2>

        {/* バッジ */}
        <section className="rounded-lg border bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-medium text-gray-700">獲得バッジ</h3>
          <BadgeList badges={badges ?? []} />
        </section>

        {/* スケジュール */}
        <section className="rounded-lg border bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-medium text-gray-700">週間スケジュール</h3>
          <ScheduleManager
            childId={childId}
            initialSchedules={schedules ?? []}
            apps={apps ?? []}
          />
        </section>

        {/* 学習履歴 */}
        <section className="rounded-lg border bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-medium text-gray-700">学習履歴</h3>
          <ActivityHistory logs={logs ?? []} apps={apps ?? []} />
        </section>
      </main>
    </div>
  );
}
