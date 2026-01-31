"use client";

type Badge = {
  badge_id: string;
  earned_at: string;
  badge_definitions:
    | { name: string; icon: string; description: string }
    | { name: string; icon: string; description: string }[]
    | null;
};

export default function BadgeList({ badges }: { badges: Badge[] }) {
  if (badges.length === 0) {
    return (
      <p className="text-sm text-gray-400">
        まだバッジを獲得していません。学習を続けてバッジを集めよう！
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
      {badges.map((badge) => {
        const def = Array.isArray(badge.badge_definitions)
          ? badge.badge_definitions[0]
          : badge.badge_definitions;
        return (
          <div
            key={badge.badge_id}
            className="flex flex-col items-center rounded-lg border bg-gradient-to-b from-yellow-50 to-white p-3 text-center"
            title={def?.description ?? ""}
          >
            <span className="text-3xl">{def?.icon ?? "🏅"}</span>
            <span className="mt-1 text-xs font-medium text-gray-700">
              {def?.name ?? badge.badge_id}
            </span>
            <span className="text-[10px] text-gray-400">
              {new Date(badge.earned_at).toLocaleDateString("ja-JP", {
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
        );
      })}
    </div>
  );
}
