"use client";

import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ProgressData = {
  startDate: string;
  currentDay: number;
  todaySessions: number;
  lastSessionDate: string;
  speed: number;
};

type Props = {
  childId: string;
  childName: string;
};

function getDefaultProgress(): ProgressData {
  const today = new Date().toISOString().slice(0, 10);
  return {
    startDate: today,
    currentDay: 1,
    todaySessions: 0,
    lastSessionDate: today,
    speed: 1,
  };
}

/** 日数からカード範囲を計算 */
function getCardsForDay(day: number): number[] {
  if (day <= 5) {
    // 最初5日間: 1〜10固定
    return Array.from({ length: 10 }, (_, i) => i + 1);
  }
  // 6日目以降: 毎日2枚入れ替え（低い方を外して高い方を追加）
  const removed = (day - 5) * 2; // 取り除いた枚数
  const start = 1 + removed;
  const end = start + 9;
  // 100を超えたら完了
  if (start > 100) return [];
  return Array.from({ length: 10 }, (_, i) => Math.min(start + i, 100)).filter(
    (n) => n <= 100
  );
}

// ドットは常に同じサイズ（100個収まる大きさ）
const DOT_SIZE_PX = 12;
// カード内のパディング（%）。ドットが端にかからないよう確保
const PAD = 6;
// 衝突判定の最小距離（%）。DOT_SIZE_PX / カードサイズ(~500px) * 100 ≒ 2.4 に余裕を持たせる
const MIN_DIST = 3.5;

/** ドッツをランダム配置 */
function generateDotPositions(
  count: number
): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  const range = 100 - PAD * 2;
  for (let i = 0; i < count; i++) {
    let x: number, y: number;
    let attempts = 0;
    do {
      x = PAD + Math.random() * range;
      y = PAD + Math.random() * range;
      attempts++;
    } while (
      attempts < 100 &&
      positions.some((p) => Math.hypot(p.x - x, p.y - y) < MIN_DIST)
    );
    positions.push({ x, y });
  }
  return positions;
}

/** 読み上げ */
function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "ja-JP";
  utter.rate = 1.2;
  window.speechSynthesis.speak(utter);
}

export default function DotsCard({ childId, childName }: Props) {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<"home" | "playing" | "done">("home");
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [cards, setCards] = useState<number[]>([]);
  const [dotPositions, setDotPositions] = useState<{ x: number; y: number }[]>(
    []
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supabase = createClient();

  // 進捗読み込み
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("progress")
        .select("data")
        .eq("child_id", childId)
        .eq("app_id", "dots-card")
        .single();

      const today = new Date().toISOString().slice(0, 10);

      if (data?.data) {
        const p = data.data as ProgressData;
        // 日付が変わっていたらセッション数リセット & 日数進める
        if (p.lastSessionDate !== today) {
          const start = new Date(p.startDate);
          const now = new Date(today);
          const diffDays =
            Math.floor(
              (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
            ) + 1;
          p.currentDay = diffDays;
          p.todaySessions = 0;
          p.lastSessionDate = today;
        }
        setProgress(p);
      } else {
        setProgress(getDefaultProgress());
      }
      setLoading(false);
    }
    load();
  }, [childId, supabase]);

  // 進捗保存
  const saveProgress = useCallback(
    async (p: ProgressData) => {
      await supabase
        .from("progress")
        .upsert(
          { child_id: childId, app_id: "dots-card", data: p },
          { onConflict: "child_id,app_id" }
        );
    },
    [childId, supabase]
  );

  // カード計算
  const todayCards = useMemo(() => {
    if (!progress) return [];
    return getCardsForDay(progress.currentDay);
  }, [progress]);

  const isCompleted = todayCards.length === 0;
  const sessionsLeft = progress ? 3 - progress.todaySessions : 0;

  // フラッシュ開始
  const startSession = useCallback(() => {
    if (!progress) return;
    const shuffled = [...todayCards].sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setCurrentCardIndex(0);
    setDotPositions(generateDotPositions(shuffled[0]));
    setPhase("playing");

    // 最初のカードを読み上げ
    setTimeout(() => speak(`これは ${shuffled[0]} です`), 200);
  }, [progress, todayCards]);

  // 次のカードへ自動進行
  useEffect(() => {
    if (phase !== "playing" || !progress) return;

    timerRef.current = setTimeout(() => {
      const nextIndex = currentCardIndex + 1;
      if (nextIndex >= cards.length) {
        // セッション完了
        const updated = {
          ...progress,
          todaySessions: progress.todaySessions + 1,
          lastSessionDate: new Date().toISOString().slice(0, 10),
        };
        setProgress(updated);
        saveProgress(updated);
        setPhase("done");
        return;
      }
      setCurrentCardIndex(nextIndex);
      setDotPositions(generateDotPositions(cards[nextIndex]));
      speak(`これは ${cards[nextIndex]} です`);
    }, progress.speed * 1000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [phase, currentCardIndex, cards, progress, saveProgress]);

  // 速度変更
  const changeSpeed = (newSpeed: number) => {
    if (!progress) return;
    const updated = { ...progress, speed: newSpeed };
    setProgress(updated);
    saveProgress(updated);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-400">読み込み中...</p>
      </div>
    );
  }

  // フラッシュ中: 全画面表示
  if (phase === "playing") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
        <div className="relative h-[80vmin] w-[80vmin] max-h-[500px] max-w-[500px] rounded-2xl bg-white shadow-lg border-2 border-gray-100">
          {dotPositions.map((pos, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-red-500"
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                width: `${DOT_SIZE_PX}px`,
                height: `${DOT_SIZE_PX}px`,
                transform: "translate(-50%, -50%)",
              }}
            />
          ))}
        </div>
        <div className="fixed bottom-8 text-center text-gray-400 text-sm">
          {currentCardIndex + 1} / {cards.length}
        </div>
      </div>
    );
  }

  // セッション完了
  if (phase === "done") {
    const remaining = progress ? 3 - progress.todaySessions : 0;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-sky-50 to-white px-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="text-4xl">
            {remaining <= 0 ? "🎉" : "👏"}
          </div>
          <h2 className="text-xl font-bold text-gray-800">
            {remaining <= 0
              ? "今日は完了です！"
              : `あと ${remaining} 回`}
          </h2>
          <p className="text-sm text-gray-500">
            {childName}さん・{progress?.currentDay}日目
          </p>
          <div className="flex flex-col gap-3">
            {remaining > 0 && (
              <button
                onClick={startSession}
                className="rounded-lg bg-sky-500 py-3 text-base font-medium text-white transition hover:bg-sky-600"
              >
                もう1回やる
              </button>
            )}
            <a
              href="/dashboard"
              className="rounded-lg border border-gray-300 py-3 text-base font-medium text-gray-600 transition hover:bg-gray-50"
            >
              ダッシュボードに戻る
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ホーム画面
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-sky-50 to-white px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800">ドッツカード</h2>
          <p className="mt-1 text-sm text-gray-500">{childName}さん</p>
        </div>

        <div className="rounded-lg border bg-white p-5 shadow-sm space-y-3">
          {isCompleted ? (
            <div className="text-center py-4">
              <div className="text-3xl">🏆</div>
              <p className="mt-2 font-bold text-gray-800">
                100まで完了しました！
              </p>
            </div>
          ) : (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{progress!.currentDay}日目</span>
                <span className="text-gray-500">
                  今日 {progress!.todaySessions}/3 回
                </span>
              </div>
              <div className="text-sm text-gray-600">
                今日のカード:{" "}
                <span className="font-mono font-medium">
                  {todayCards[0]}〜{todayCards[todayCards.length - 1]}
                </span>
              </div>

              {/* 速度設定 */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">速度:</span>
                {[0.5, 0.75, 1, 1.5, 2].map((s) => (
                  <button
                    key={s}
                    onClick={() => changeSpeed(s)}
                    className={`rounded px-2 py-1 text-xs ${
                      progress!.speed === s
                        ? "bg-sky-500 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {s}秒
                  </button>
                ))}
              </div>

              {sessionsLeft > 0 ? (
                <button
                  onClick={startSession}
                  className="w-full rounded-lg bg-sky-500 py-4 text-lg font-bold text-white transition hover:bg-sky-600"
                >
                  スタート
                </button>
              ) : (
                <div className="rounded-lg bg-green-50 p-3 text-center text-sm text-green-700">
                  今日のセッションは完了です！
                </div>
              )}
            </>
          )}
        </div>

        <a
          href="/dashboard"
          className="block text-center text-sm text-sky-600 hover:underline"
        >
          ← ダッシュボードに戻る
        </a>
      </div>
    </div>
  );
}
