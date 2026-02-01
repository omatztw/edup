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
  cardStart?: number; // カードセットの開始番号（未設定時はcurrentDayから自動計算）
};

type Props = {
  childId: string;
  childName: string;
};

function getDefaultProgress(): ProgressData {
  const today = getLocalToday();
  return {
    startDate: today,
    currentDay: 1,
    todaySessions: 0,
    lastSessionDate: today,
    speed: 1,
  };
}

/** ローカルタイムゾーンの今日の日付をYYYY-MM-DD形式で返す */
function getLocalToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 日数からカードの開始番号を計算 */
function getCardStartForDay(day: number): number {
  if (day <= 5) return 1;
  return 1 + (day - 5) * 2;
}

/** 開始番号からカード配列を生成 */
function getCardsFromStart(cardStart: number): number[] {
  if (cardStart > 100) return [];
  return Array.from({ length: 10 }, (_, i) => cardStart + i).filter(
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

/** 読み上げ（gTTS MP3優先、非対応時はspeechSynthesisにフォールバック）
 *  Promiseを返し、発話完了（またはエラー）時にresolveする */
function speak(text: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();

  const match = text.match(/(\d+)/);
  const num = match ? parseInt(match[1]) : null;

  // MP3優先（gTTSで「これはNです」を生成済み）
  if (num && num >= 1 && num <= 100) {
    return new Promise<void>((resolve) => {
      const audio = new Audio(`/audio/dots/${num}.mp3`);
      audio.onended = () => resolve();
      audio.onerror = () => {
        // MP3再生失敗時はspeechSynthesisにフォールバック
        speakFallback(text).then(resolve);
      };
      audio.play().catch(() => speakFallback(text).then(resolve));
    });
  }

  return speakFallback(text);
}

/** speechSynthesisフォールバック */
function speakFallback(text: string): Promise<void> {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    return new Promise<void>((resolve) => {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "ja-JP";
      utter.rate = 1.2;
      utter.onend = () => resolve();
      utter.onerror = () => resolve();
      window.speechSynthesis.speak(utter);
    });
  }
  return Promise.resolve();
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
  const cancelledRef = useRef(false);
  const speechPromiseRef = useRef<Promise<void>>(Promise.resolve());
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

      const today = getLocalToday();

      if (data?.data) {
        const p = data.data as ProgressData;
        let changed = false;
        // 日付が変わっていたらセッション数リセット & 日数進める
        if (p.lastSessionDate !== today) {
          const startD = new Date(p.startDate);
          const now = new Date(today);
          const prevDay = p.currentDay;
          const diffDays =
            Math.floor(
              (now.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)
            ) + 1;
          p.currentDay = diffDays;
          p.todaySessions = 0;
          p.lastSessionDate = today;
          // cardStartも日数差分に応じて進める
          if (p.cardStart != null) {
            const prevAutoStart = getCardStartForDay(prevDay);
            const newAutoStart = getCardStartForDay(diffDays);
            const autoAdvance = newAutoStart - prevAutoStart;
            if (autoAdvance > 0) {
              p.cardStart = p.cardStart + autoAdvance;
            }
          }
          changed = true;
        }
        // cardStartが未設定なら現在のdayから初期化
        if (p.cardStart == null) {
          p.cardStart = getCardStartForDay(p.currentDay);
          changed = true;
        }
        setProgress(p);
        // 変更があればDBにも即保存
        if (changed) {
          await supabase
            .from("progress")
            .upsert(
              { child_id: childId, app_id: "dots-card", data: p },
              { onConflict: "child_id,app_id" }
            );
        }
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
    const start = progress.cardStart ?? getCardStartForDay(progress.currentDay);
    return getCardsFromStart(start);
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

    // 最初のカードを読み上げ（少し待ってから）
    setTimeout(() => {
      speechPromiseRef.current = speak(`これは ${shuffled[0]} です`);
    }, 200);
  }, [progress, todayCards]);

  // 次のカードへ自動進行（表示時間経過 → 音声完了の両方を待つ）
  useEffect(() => {
    if (phase !== "playing" || !progress) return;

    cancelledRef.current = false;

    const advanceToNext = () => {
      if (cancelledRef.current) return;

      const nextIndex = currentCardIndex + 1;
      if (nextIndex >= cards.length) {
        // セッション完了
        const updated = {
          ...progress,
          todaySessions: progress.todaySessions + 1,
          lastSessionDate: getLocalToday(),
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
      speechPromiseRef.current = speak(`これは ${cards[nextIndex]} です`);
    };

    // 表示時間と音声完了の両方を待ってから次へ進む
    const timerPromise = new Promise<void>((resolve) => {
      timerRef.current = setTimeout(resolve, progress.speed * 1000);
    });

    Promise.all([timerPromise, speechPromiseRef.current]).then(() => {
      advanceToNext();
    });

    return () => {
      cancelledRef.current = true;
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

        {/* カードセット調整 */}
        <div className="text-center">
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="text-xs text-gray-400 hover:text-gray-500"
          >
            {showDebug ? "閉じる" : "カードセットを変更"}
          </button>
        </div>
        {showDebug && (
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm space-y-3">
            <p className="text-xs text-gray-500">
              紙のドッツカードなどで途中まで進めていた場合、表示するカードセットを変更できます。
              翌日以降は自動的に2枚ずつ進みます。
            </p>
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <span className="text-gray-500">カード:</span>
              <select
                value={progress!.cardStart ?? 1}
                onChange={(e) => {
                  const newStart = parseInt(e.target.value);
                  const updated = { ...progress!, cardStart: newStart };
                  setProgress(updated);
                  saveProgress(updated);
                }}
                className="rounded border border-gray-300 px-2 py-1 text-sm"
              >
                {Array.from({ length: 91 }, (_, i) => {
                  const start = i + 1;
                  const end = Math.min(start + 9, 100);
                  if (start > 91) return null;
                  return (
                    <option key={start} value={start}>
                      {start}〜{end}
                    </option>
                  );
                })}
              </select>
            </div>
            {(progress!.cardStart ?? 1) === 1 && (
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <span className="text-gray-500">1〜10の日目:</span>
                <select
                  value={Math.min(progress!.currentDay, 5)}
                  onChange={(e) => {
                    const newDay = parseInt(e.target.value);
                    const today = getLocalToday();
                    const newStartDate = new Date(today);
                    newStartDate.setDate(newStartDate.getDate() - (newDay - 1));
                    const startDateStr = `${newStartDate.getFullYear()}-${String(newStartDate.getMonth() + 1).padStart(2, "0")}-${String(newStartDate.getDate()).padStart(2, "0")}`;
                    const updated = {
                      ...progress!,
                      currentDay: newDay,
                      startDate: startDateStr,
                    };
                    setProgress(updated);
                    saveProgress(updated);
                  }}
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
                >
                  {[1, 2, 3, 4, 5].map((d) => (
                    <option key={d} value={d}>
                      {d}日目
                    </option>
                  ))}
                </select>
                <span className="text-xs text-gray-400">
                  （5日間同じカードを繰り返します）
                </span>
              </div>
            )}
            {progress!.todaySessions > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">今日の回数:</span>
                <span className="text-gray-600">{progress!.todaySessions}回</span>
                <button
                  onClick={() => {
                    const updated = { ...progress!, todaySessions: 0 };
                    setProgress(updated);
                    saveProgress(updated);
                  }}
                  className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600 hover:bg-gray-200"
                >
                  リセット
                </button>
              </div>
            )}
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
