"use client";

import { createClient } from "@/lib/supabase/client";
import { checkAndAwardBadges } from "@/lib/badges";
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

// ドットは常に同じサイズ。カードが90vmin(iPad約700px)想定で100個収まる大きさ
const DOT_SIZE_PX = 24;
// カード内のパディング（%）
const PAD = 5;
// 衝突判定の最小距離（%）。DOT_SIZE_PX / カードサイズ(~700px) * 100 ≒ 3.4 に余裕を持たせる
const MIN_DIST = 4;

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

/** 読み上げ（speechSynthesis優先、非対応時はGoogle TTS mp3にフォールバック） */
function speak(text: string) {
  if (typeof window === "undefined") return;

  // テキストから数字を抽出
  const match = text.match(/(\d+)/);
  const num = match ? parseInt(match[1]) : null;

  // speechSynthesisが使えればそちらを優先（レイテンシが低い）
  if (window.speechSynthesis) {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "ja-JP";
    utter.rate = 1.2;
    utter.onerror = () => playMp3Fallback(num);
    window.speechSynthesis.speak(utter);
    return;
  }

  // speechSynthesis非対応: Google TTS mp3を再生
  playMp3Fallback(num);
}

/** mp3フォールバック（Google TTS生成済み） */
function playMp3Fallback(num: number | null) {
  if (num && num >= 1 && num <= 100) {
    const audio = new Audio(`/audio/dots/${num}.mp3`);
    audio.play().catch(() => {});
  }
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
  const [showDebug, setShowDebug] = useState(false);
  const [newBadges, setNewBadges] = useState<{ id: string; name: string; icon: string }[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionStartRef = useRef<number>(0);
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
    setNewBadges([]);
    sessionStartRef.current = Date.now();

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

        // アクティビティログ記録
        const duration = Math.round((Date.now() - sessionStartRef.current) / 1000);
        supabase.from("activity_logs").insert({
          child_id: childId,
          app_id: "dots-card",
          duration_seconds: duration,
          session_data: { day: progress.currentDay, cards: cards, speed: progress.speed },
        }).then(() => {
          // バッジチェック
          checkAndAwardBadges(supabase, childId, "dots-card").then((badges) => {
            if (badges.length > 0) setNewBadges(badges);
          });
        });

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

  // 日数変更（デバッグ用）
  const changeDay = (newDay: number) => {
    if (!progress || newDay < 1) return;
    const updated = { ...progress, currentDay: newDay };
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
        <div className="relative h-[90vmin] w-[90vmin] max-h-[700px] max-w-[700px] rounded-2xl bg-white shadow-lg border-2 border-gray-100">
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
    const remaining = progress ? Math.max(0, 3 - progress.todaySessions) : 0;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-sky-50 to-white px-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="text-4xl">
            {remaining <= 0 ? "🎉" : "👏"}
          </div>
          <h2 className="text-xl font-bold text-gray-800">
            {remaining <= 0
              ? "今日の規定回数クリア！"
              : `あと ${remaining} 回`}
          </h2>
          <p className="text-sm text-gray-500">
            {childName}さん・{progress?.currentDay}日目・今日 {progress?.todaySessions} 回完了
          </p>
          {newBadges.length > 0 && (
            <div className="rounded-lg border-2 border-yellow-300 bg-yellow-50 p-4">
              <p className="mb-2 text-sm font-bold text-yellow-700">
                バッジ獲得！
              </p>
              <div className="flex justify-center gap-3">
                {newBadges.map((badge) => (
                  <div key={badge.id} className="flex flex-col items-center">
                    <span className="text-3xl">{badge.icon}</span>
                    <span className="mt-1 text-xs font-medium text-gray-700">
                      {badge.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-col gap-3">
            <button
              onClick={startSession}
              className={`rounded-lg py-3 text-base font-medium transition ${
                remaining > 0
                  ? "bg-sky-500 text-white hover:bg-sky-600"
                  : "border border-sky-500 text-sky-600 hover:bg-sky-50"
              }`}
            >
              {remaining > 0 ? "もう1回やる" : "もう1回やる（追加）"}
            </button>
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

              {sessionsLeft <= 0 && (
                <div className="rounded-lg bg-green-50 p-3 text-center text-sm text-green-700">
                  今日の規定回数（3回）クリア！
                </div>
              )}

              <button
                onClick={startSession}
                className={`w-full rounded-lg py-4 text-lg font-bold transition ${
                  sessionsLeft > 0
                    ? "bg-sky-500 text-white hover:bg-sky-600"
                    : "border border-sky-500 text-sky-600 hover:bg-sky-50"
                }`}
              >
                {sessionsLeft > 0 ? "スタート" : "追加でスタート"}
              </button>
            </>
          )}
        </div>

        {/* デバッグ設定 */}
        <div className="text-center">
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="text-xs text-gray-300 hover:text-gray-400"
          >
            設定
          </button>
        </div>
        {showDebug && (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 space-y-3">
            <p className="text-xs font-medium text-gray-400">デバッグ設定</p>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">日数:</span>
              <button
                onClick={() => changeDay(progress!.currentDay - 1)}
                disabled={progress!.currentDay <= 1}
                className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-300 disabled:opacity-30"
              >
                -
              </button>
              <input
                type="number"
                value={progress!.currentDay}
                onChange={(e) => changeDay(parseInt(e.target.value) || 1)}
                min={1}
                className="w-16 rounded border border-gray-300 px-2 py-1 text-center text-sm"
              />
              <button
                onClick={() => changeDay(progress!.currentDay + 1)}
                className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-300"
              >
                +
              </button>
              <span className="text-xs text-gray-400">
                → {todayCards.length > 0 ? `${todayCards[0]}〜${todayCards[todayCards.length - 1]}` : "完了"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">セッション数リセット:</span>
              <button
                onClick={() => {
                  const updated = { ...progress!, todaySessions: 0 };
                  setProgress(updated);
                  saveProgress(updated);
                }}
                className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-300"
              >
                0に戻す
              </button>
            </div>
          </div>
        )}

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
