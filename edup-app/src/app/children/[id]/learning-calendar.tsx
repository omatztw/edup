"use client";

import { useState } from "react";

type Log = {
  id: string;
  app_id: string;
  duration_seconds: number;
  session_data: Record<string, unknown>;
  created_at: string;
};

type App = { id: string; name: string };

const APP_COLORS: Record<string, { bg: string; dot: string; label: string }> = {
  "dots-card": { bg: "bg-sky-100", dot: "bg-sky-500", label: "ドッツ" },
  "english-flash": { bg: "bg-emerald-100", dot: "bg-emerald-500", label: "英語" },
  "flash-calc": { bg: "bg-amber-100", dot: "bg-amber-500", label: "計算" },
  "dots-card-math": { bg: "bg-rose-100", dot: "bg-rose-500", label: "ドッツ計算" },
  "hiragana-karuta": { bg: "bg-pink-100", dot: "bg-pink-500", label: "ひらがな" },
  "flag-quiz": { bg: "bg-purple-100", dot: "bg-purple-500", label: "国旗" },
  "clock-reader": { bg: "bg-orange-100", dot: "bg-orange-500", label: "時計" },
};

const DEFAULT_COLOR = { bg: "bg-gray-100", dot: "bg-gray-400", label: "?" };

function getAppColor(appId: string) {
  return APP_COLORS[appId] ?? DEFAULT_COLOR;
}

export default function LearningCalendar({
  logs,
  apps,
}: {
  logs: Log[];
  apps: App[];
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed

  // Group logs by date string -> app_id -> count
  const logsByDate = new Map<string, Map<string, number>>();
  for (const log of logs) {
    const date = log.created_at.slice(0, 10);
    if (!logsByDate.has(date)) logsByDate.set(date, new Map());
    const appCounts = logsByDate.get(date)!;
    appCounts.set(log.app_id, (appCounts.get(log.app_id) ?? 0) + 1);
  }

  // Calendar grid
  const firstDay = new Date(year, month, 1);
  const startDow = firstDay.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const goPrev = () => {
    if (month === 0) {
      setYear(year - 1);
      setMonth(11);
    } else {
      setMonth(month - 1);
    }
  };
  const goNext = () => {
    if (month === 11) {
      setYear(year + 1);
      setMonth(0);
    } else {
      setMonth(month + 1);
    }
  };

  const isToday = (day: number) =>
    year === today.getFullYear() &&
    month === today.getMonth() &&
    day === today.getDate();

  const dateStr = (day: number) => {
    const m = String(month + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return `${year}-${m}-${d}`;
  };

  // Active app IDs that appear in this month's logs
  const activeAppIds = new Set<string>();
  for (const [date, appCounts] of logsByDate) {
    if (date.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`)) {
      for (const appId of appCounts.keys()) activeAppIds.add(appId);
    }
  }

  return (
    <div>
      {/* Month navigation */}
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={goPrev}
          className="rounded-lg px-3 py-1 text-sm text-gray-500 hover:bg-gray-100"
        >
          ← 前月
        </button>
        <span className="font-medium text-gray-700">
          {year}年{month + 1}月
        </span>
        <button
          onClick={goNext}
          className="rounded-lg px-3 py-1 text-sm text-gray-500 hover:bg-gray-100"
        >
          次月 →
        </button>
      </div>

      {/* Day of week header */}
      <div className="mb-1 grid grid-cols-7 text-center text-xs text-gray-400">
        {["日", "月", "火", "水", "木", "金", "土"].map((d) => (
          <div key={d} className={d === "日" ? "text-red-400" : d === "土" ? "text-blue-400" : ""}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`e-${i}`} className="aspect-square" />;
          }

          const ds = dateStr(day);
          const appCounts = logsByDate.get(ds);
          const hasActivity = appCounts && appCounts.size > 0;
          const totalSessions = appCounts
            ? [...appCounts.values()].reduce((a, b) => a + b, 0)
            : 0;

          return (
            <div
              key={ds}
              className={`relative flex aspect-square flex-col items-center justify-start rounded-md p-0.5 text-xs transition-colors ${
                isToday(day)
                  ? "ring-2 ring-sky-400"
                  : ""
              } ${hasActivity ? "bg-gray-50" : ""}`}
            >
              {/* Day number */}
              <span
                className={`text-[10px] leading-tight ${
                  isToday(day)
                    ? "font-bold text-sky-600"
                    : i % 7 === 0
                      ? "text-red-400"
                      : i % 7 === 6
                        ? "text-blue-400"
                        : "text-gray-500"
                }`}
              >
                {day}
              </span>

              {/* App badges */}
              {hasActivity && (
                <div className="mt-0.5 flex flex-wrap justify-center gap-0.5">
                  {[...appCounts!.entries()].map(([appId, count]) => {
                    const color = getAppColor(appId);
                    return (
                      <span
                        key={appId}
                        className={`relative inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-full px-0.5 text-[8px] font-bold leading-none text-white ${color.dot}`}
                        title={`${color.label}: ${count}回`}
                      >
                        {count}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      {activeAppIds.size > 0 && (
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
          {[...activeAppIds].map((appId) => {
            const color = getAppColor(appId);
            const appName =
              apps.find((a) => a.id === appId)?.name ?? color.label;
            return (
              <div key={appId} className="flex items-center gap-1">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${color.dot}`}
                />
                <span>{appName}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
