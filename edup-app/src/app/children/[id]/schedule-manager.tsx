"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

type Schedule = {
  id: string;
  child_id: string;
  app_id: string;
  day_of_week: number;
  target_sessions: number;
  is_active: boolean;
};

type App = { id: string; name: string };

export default function ScheduleManager({
  childId,
  initialSchedules,
  apps,
}: {
  childId: string;
  initialSchedules: Schedule[];
  apps: App[];
}) {
  const [schedules, setSchedules] = useState<Schedule[]>(initialSchedules);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const getSchedule = (appId: string, day: number) =>
    schedules.find((s) => s.app_id === appId && s.day_of_week === day);

  const toggleDay = async (appId: string, day: number) => {
    setSaving(true);
    const existing = getSchedule(appId, day);

    if (existing) {
      // 既存のスケジュールをトグル
      if (existing.is_active) {
        await supabase.from("schedules").delete().eq("id", existing.id);
        setSchedules(schedules.filter((s) => s.id !== existing.id));
      } else {
        await supabase
          .from("schedules")
          .update({ is_active: true })
          .eq("id", existing.id);
        setSchedules(
          schedules.map((s) =>
            s.id === existing.id ? { ...s, is_active: true } : s
          )
        );
      }
    } else {
      // 新規作成
      const { data } = await supabase
        .from("schedules")
        .insert({
          child_id: childId,
          app_id: appId,
          day_of_week: day,
          target_sessions: 3,
        })
        .select()
        .single();
      if (data) {
        setSchedules([...schedules, data]);
      }
    }
    setSaving(false);
  };

  const updateTarget = async (scheduleId: string, target: number) => {
    if (target < 1 || target > 10) return;
    await supabase
      .from("schedules")
      .update({ target_sessions: target })
      .eq("id", scheduleId);
    setSchedules(
      schedules.map((s) =>
        s.id === scheduleId ? { ...s, target_sessions: target } : s
      )
    );
  };

  if (apps.length === 0) {
    return <p className="text-sm text-gray-400">利用可能なアプリがありません</p>;
  }

  return (
    <div className="space-y-4">
      {apps.map((app) => (
        <div key={app.id} className="space-y-2">
          <p className="text-sm font-medium text-gray-600">{app.name}</p>
          <div className="flex gap-1">
            {DAY_LABELS.map((label, day) => {
              const schedule = getSchedule(app.id, day);
              const active = schedule?.is_active;
              return (
                <button
                  key={day}
                  onClick={() => toggleDay(app.id, day)}
                  disabled={saving}
                  className={`flex h-10 w-10 items-center justify-center rounded-lg text-xs font-medium transition ${
                    active
                      ? "bg-sky-500 text-white"
                      : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {/* 有効なスケジュールがある場合、目標回数設定 */}
          {schedules.some(
            (s) => s.app_id === app.id && s.is_active
          ) && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">1日の目標:</span>
              <select
                value={
                  schedules.find(
                    (s) => s.app_id === app.id && s.is_active
                  )?.target_sessions ?? 3
                }
                onChange={(e) => {
                  const target = parseInt(e.target.value);
                  schedules
                    .filter((s) => s.app_id === app.id && s.is_active)
                    .forEach((s) => updateTarget(s.id, target));
                }}
                className="rounded border border-gray-300 px-2 py-1 text-sm"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}回
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      ))}
      <p className="text-xs text-gray-400">
        曜日をタップしてスケジュールを設定できます
      </p>
    </div>
  );
}
