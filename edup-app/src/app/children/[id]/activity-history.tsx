"use client";

type Log = {
  id: string;
  app_id: string;
  duration_seconds: number;
  session_data: Record<string, unknown>;
  created_at: string;
};

type App = { id: string; name: string };

export default function ActivityHistory({
  logs,
  apps,
}: {
  logs: Log[];
  apps: App[];
}) {
  const appMap = new Map(apps.map((a) => [a.id, a.name]));

  if (logs.length === 0) {
    return (
      <p className="text-sm text-gray-400">まだ学習履歴がありません</p>
    );
  }

  // 日付ごとにグループ化
  const grouped = new Map<string, Log[]>();
  for (const log of logs) {
    const date = log.created_at.slice(0, 10);
    if (!grouped.has(date)) grouped.set(date, []);
    grouped.get(date)!.push(log);
  }

  return (
    <div className="space-y-4">
      {[...grouped.entries()].map(([date, dayLogs]) => (
        <div key={date}>
          <p className="mb-1 text-xs font-medium text-gray-500">
            {formatDate(date)}
          </p>
          <div className="space-y-1">
            {dayLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"
              >
                <span className="text-gray-700">
                  {appMap.get(log.app_id) ?? log.app_id}
                </span>
                <span className="text-gray-400">
                  {formatTime(log.created_at)}
                  {log.duration_seconds > 0 &&
                    ` (${Math.round(log.duration_seconds / 60)}分)`}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const dayOfWeek = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  return `${month}/${day}（${dayOfWeek}）`;
}

function formatTime(timestamp: string): string {
  const d = new Date(timestamp);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}
