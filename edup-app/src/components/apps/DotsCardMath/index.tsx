"use client";

import { createClient } from "@/lib/supabase/client";
import { checkAndAwardBadges } from "@/lib/badges";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Operation = "+" | "-";

type Equation = {
  a: number;
  b: number;
  op: Operation;
  answer: number;
};

type ProgressData = {
  startDate: string;
  currentDay: number;
  todaySessions: number;
  lastSessionDate: string;
  speed: number;
  mode: "addition" | "subtraction" | "mixed";
  maxNumber: number; // 等式に使う最大数（答え含む）
  equationsPerSession: number;
};

type Props = {
  childId: string;
  childName: string;
};

function getLocalToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDefaultProgress(): ProgressData {
  const today = getLocalToday();
  return {
    startDate: today,
    currentDay: 1,
    todaySessions: 0,
    lastSessionDate: today,
    speed: 1.5,
    mode: "addition",
    maxNumber: 20,
    equationsPerSession: 3,
  };
}

/** 等式を生成する */
function generateEquations(
  count: number,
  mode: "addition" | "subtraction" | "mixed",
  maxNumber: number
): Equation[] {
  const equations: Equation[] = [];
  const used = new Set<string>();

  for (let i = 0; i < count; i++) {
    let attempts = 0;
    let eq: Equation;
    do {
      const op: Operation =
        mode === "addition"
          ? "+"
          : mode === "subtraction"
            ? "-"
            : Math.random() < 0.5
              ? "+"
              : "-";

      if (op === "+") {
        const answer = Math.floor(Math.random() * (maxNumber - 2)) + 3; // 3〜maxNumber
        const a = Math.floor(Math.random() * (answer - 2)) + 1; // 1〜answer-2
        const b = answer - a;
        eq = { a, b, op, answer };
      } else {
        const a = Math.floor(Math.random() * (maxNumber - 2)) + 3; // 3〜maxNumber
        const b = Math.floor(Math.random() * (a - 1)) + 1; // 1〜a-1
        eq = { a, b, op, answer: a - b };
      }
      attempts++;
    } while (used.has(`${eq!.a}${eq!.op}${eq!.b}`) && attempts < 50);

    used.add(`${eq!.a}${eq!.op}${eq!.b}`);
    equations.push(eq!);
  }
  return equations;
}

// ドットは常に同じサイズ
const DOT_SIZE_PX = 16;
const PAD = 5;
const MIN_DIST = 3;

function generateDotPositions(count: number): { x: number; y: number }[] {
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

/** フォールバック用speechSynthesis */
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

function speakNumber(n: number): Promise<void> {
  if (n >= 1 && n <= 100) {
    return new Promise<void>((resolve) => {
      const audio = new Audio(`/audio/dots-math/${n}.mp3`);
      audio.playbackRate = 1.5;
      audio.onended = () => resolve();
      audio.onerror = () => speakFallback(String(n)).then(resolve);
      audio.play().catch(() => speakFallback(String(n)).then(resolve));
    });
  }
  return speakFallback(String(n));
}

function speakOperator(op: Operation): Promise<void> {
  const file = op === "+" ? "plus.mp3" : "minus.mp3";
  return new Promise<void>((resolve) => {
    const audio = new Audio(`/audio/dots-math/${file}`);
    audio.playbackRate = 1.5;
    audio.onended = () => resolve();
    audio.onerror = () =>
      speakFallback(op === "+" ? "たす" : "ひく").then(resolve);
    audio.play().catch(() =>
      speakFallback(op === "+" ? "たす" : "ひく").then(resolve)
    );
  });
}

function speakWa(): Promise<void> {
  return new Promise<void>((resolve) => {
    const audio = new Audio("/audio/dots-math/wa.mp3");
    audio.playbackRate = 1.5;
    audio.onended = () => resolve();
    audio.onerror = () => speakFallback("は").then(resolve);
    audio.play().catch(() => speakFallback("は").then(resolve));
  });
}

/**
 * 等式の表示ステップ:
 * 0: 第1項のドッツ + 音声
 * 1: 演算子の音声（ドッツ非表示）
 * 2: 第2項のドッツ + 音声
 * 3: 「は」の音声（ドッツ非表示）
 * 4: 答えのドッツ + 音声
 */
type FlashStep = 0 | 1 | 2 | 3 | 4;

export default function DotsCardMath({ childId, childName }: Props) {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<"home" | "playing" | "done">("home");
  const [equations, setEquations] = useState<Equation[]>([]);
  const [currentEqIndex, setCurrentEqIndex] = useState(0);
  const [flashStep, setFlashStep] = useState<FlashStep>(0);
  const [dotsA, setDotsA] = useState<{ x: number; y: number }[]>([]);
  const [dotsB, setDotsB] = useState<{ x: number; y: number }[]>([]);
  const [dotsAnswer, setDotsAnswer] = useState<{ x: number; y: number }[]>([]);
  const [newBadges, setNewBadges] = useState<
    { id: string; name: string; icon: string }[]
  >([]);
  const cancelledRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
        .eq("app_id", "dots-card-math")
        .single();

      const today = getLocalToday();

      if (data?.data) {
        const p = data.data as ProgressData;
        if (p.lastSessionDate !== today) {
          const startD = new Date(p.startDate);
          const now = new Date(today);
          p.currentDay =
            Math.floor(
              (now.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)
            ) + 1;
          p.todaySessions = 0;
          p.lastSessionDate = today;
          await supabase
            .from("progress")
            .upsert(
              { child_id: childId, app_id: "dots-card-math", data: p },
              { onConflict: "child_id,app_id" }
            );
        }
        setProgress(p);
      } else {
        setProgress(getDefaultProgress());
      }
      setLoading(false);
    }
    load();
  }, [childId, supabase]);

  const saveProgress = useCallback(
    async (p: ProgressData) => {
      await supabase
        .from("progress")
        .upsert(
          { child_id: childId, app_id: "dots-card-math", data: p },
          { onConflict: "child_id,app_id" }
        );
    },
    [childId, supabase]
  );

  const sessionsLeft = progress ? 3 - progress.todaySessions : 0;

  // セッション開始
  const startSession = useCallback(() => {
    if (!progress) return;
    const eqs = generateEquations(
      progress.equationsPerSession,
      progress.mode,
      progress.maxNumber
    );
    setEquations(eqs);
    setCurrentEqIndex(0);
    setFlashStep(0);
    setDotsA(generateDotPositions(eqs[0].a));
    setDotsB(generateDotPositions(eqs[0].b));
    setDotsAnswer(generateDotPositions(eqs[0].answer));
    setPhase("playing");
    setNewBadges([]);
    sessionStartRef.current = Date.now();
    cancelledRef.current = false;

    // 最初のカード（第1項）の音声を少し待ってから開始
    setTimeout(() => {
      speechPromiseRef.current = speakNumber(eqs[0].a);
    }, 200);
  }, [progress]);

  // フラッシュ進行: タイマーと音声の両方を待ってから次のステップへ進む
  useEffect(() => {
    if (phase !== "playing" || !progress || equations.length === 0) return;

    cancelledRef.current = false;

    const eq = equations[currentEqIndex];
    if (!eq) return;

    const speed = progress.speed * 1000;

    // ドッツ表示ステップ（0,2,4）はタイマー+音声、演算子ステップ（1,3）は音声のみ
    const isDotStep = flashStep === 0 || flashStep === 2 || flashStep === 4;

    const advanceToNext = () => {
      if (cancelledRef.current) return;

      if (flashStep < 4) {
        // 次のステップへ
        const nextStep = (flashStep + 1) as FlashStep;
        const nextIsDotStep = nextStep === 0 || nextStep === 2 || nextStep === 4;

        if (nextIsDotStep) {
          // 次はドッツ表示ステップ: 音声開始（ドットは既に配置済み）
          const dotCount = nextStep === 2 ? eq.b : eq.answer;
          speechPromiseRef.current = speakNumber(dotCount);
        } else {
          // 次は演算子ステップ: 音声開始
          if (nextStep === 1) {
            speechPromiseRef.current = speakOperator(eq.op);
          } else {
            speechPromiseRef.current = speakWa();
          }
        }

        setFlashStep(nextStep);
      } else {
        // step 4 完了 → 次の等式へ
        const nextIdx = currentEqIndex + 1;
        if (nextIdx >= equations.length) {
          // セッション完了
          const updated = {
            ...progress,
            todaySessions: progress.todaySessions + 1,
            lastSessionDate: getLocalToday(),
          };
          setProgress(updated);
          saveProgress(updated);

          const duration = Math.round(
            (Date.now() - sessionStartRef.current) / 1000
          );
          supabase
            .from("activity_logs")
            .insert({
              child_id: childId,
              app_id: "dots-card-math",
              duration_seconds: duration,
              session_data: {
                day: progress.currentDay,
                equations: equations.map((e) => `${e.a}${e.op}${e.b}=${e.answer}`),
                mode: progress.mode,
                maxNumber: progress.maxNumber,
                speed: progress.speed,
              },
            })
            .then(() => {
              checkAndAwardBadges(supabase, childId, "dots-card-math").then(
                (badges) => {
                  if (badges.length > 0) setNewBadges(badges);
                }
              );
            });

          setPhase("done");
        } else {
          // 次の等式を準備（全ドット位置を事前生成）
          const nextEq = equations[nextIdx];
          setDotsA(generateDotPositions(nextEq.a));
          setDotsB(generateDotPositions(nextEq.b));
          setDotsAnswer(generateDotPositions(nextEq.answer));
          speechPromiseRef.current = speakNumber(nextEq.a);
          setCurrentEqIndex(nextIdx);
          setFlashStep(0);
        }
      }
    };

    if (isDotStep) {
      // ドッツ表示ステップ: タイマーと音声の両方を待つ
      const timerPromise = new Promise<void>((resolve) => {
        timerRef.current = setTimeout(resolve, speed);
      });

      Promise.all([timerPromise, speechPromiseRef.current]).then(() => {
        advanceToNext();
      });
    } else {
      // 演算子ステップ: 音声完了のみを待つ
      speechPromiseRef.current.then(() => {
        advanceToNext();
      });
    }

    return () => {
      cancelledRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [phase, currentEqIndex, flashStep, equations, progress, saveProgress, childId, supabase]);

  // 設定変更ヘルパー
  const updateSetting = <K extends keyof ProgressData>(
    key: K,
    value: ProgressData[K]
  ) => {
    if (!progress) return;
    const updated = { ...progress, [key]: value };
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

  // フラッシュ中 - 式全体を横並びで表示し、ステップごとに要素を追加していく
  if (phase === "playing") {
    const eq = equations[currentEqIndex];

    // 各要素のドット位置を事前計算して保持
    const showA = flashStep >= 0; // 第1項: step 0 以降
    const showOp = flashStep >= 1; // 演算子: step 1 以降
    const showB = flashStep >= 2; // 第2項: step 2 以降
    const showEq = flashStep >= 3; // =記号: step 3 以降
    const showAns = flashStep >= 4; // 答え: step 4 以降

    // 現在アクティブな要素をハイライト
    const activeStep = flashStep;

    const DotBox = ({
      positions,
      active,
    }: {
      positions: { x: number; y: number }[];
      active: boolean;
    }) => (
      <div
        className={`relative aspect-square rounded-xl border-2 transition-all ${
          active
            ? "border-orange-400 bg-white shadow-md"
            : "border-gray-200 bg-gray-50"
        }`}
        style={{ width: "min(28vw, 180px)", height: "min(28vw, 180px)" }}
      >
        {positions.map((pos, i) => (
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
    );

    const OpSymbol = ({
      symbol,
      active,
    }: {
      symbol: string;
      active: boolean;
    }) => (
      <div
        className={`flex items-center justify-center text-3xl sm:text-5xl font-bold transition-all ${
          active ? "text-orange-500 scale-110" : "text-gray-500"
        }`}
        style={{ width: "min(8vw, 48px)" }}
      >
        {symbol}
      </div>
    );

    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white px-2">
        {/* 式を横並びに表示 */}
        <div className="flex items-center justify-center gap-1 sm:gap-2">
          {/* 第1項 */}
          {showA && (
            <DotBox positions={dotsA} active={activeStep === 0} />
          )}

          {/* 演算子 */}
          {showOp && (
            <OpSymbol
              symbol={eq?.op === "+" ? "＋" : "−"}
              active={activeStep === 1}
            />
          )}

          {/* 第2項 */}
          {showB && (
            <DotBox positions={dotsB} active={activeStep === 2} />
          )}

          {/* = 記号 */}
          {showEq && (
            <OpSymbol symbol="＝" active={activeStep === 3} />
          )}

          {/* 答え */}
          {showAns && (
            <DotBox positions={dotsAnswer} active={activeStep === 4} />
          )}
        </div>

        <div className="fixed bottom-8 text-center text-gray-400 text-sm">
          {currentEqIndex + 1} / {equations.length}
        </div>
      </div>
    );
  }

  // セッション完了
  if (phase === "done") {
    const remaining = progress ? Math.max(0, 3 - progress.todaySessions) : 0;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-orange-50 to-white px-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="text-4xl">{remaining <= 0 ? "🎉" : "👏"}</div>
          <h2 className="text-xl font-bold text-gray-800">
            {remaining <= 0
              ? "今日の規定回数クリア！"
              : `あと ${remaining} 回`}
          </h2>
          <p className="text-sm text-gray-500">
            {childName}さん・{progress?.currentDay}日目・今日{" "}
            {progress?.todaySessions} 回完了
          </p>

          {/* 今回の等式一覧 */}
          <div className="rounded-lg border bg-white p-4 text-left">
            <p className="mb-2 text-xs font-medium text-gray-500">
              今回の問題
            </p>
            {equations.map((eq, i) => (
              <p key={i} className="font-mono text-sm text-gray-700">
                {eq.a} {eq.op === "+" ? "＋" : "−"} {eq.b} ＝ {eq.answer}
              </p>
            ))}
          </div>

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
                  ? "bg-orange-500 text-white hover:bg-orange-600"
                  : "border border-orange-500 text-orange-600 hover:bg-orange-50"
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-orange-50 to-white px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800">
            ドッツカード 計算
          </h2>
          <p className="mt-1 text-sm text-gray-500">{childName}さん</p>
        </div>

        <div className="rounded-lg border bg-white p-5 shadow-sm space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{progress!.currentDay}日目</span>
            <span className="text-gray-500">
              今日 {progress!.todaySessions}/3 回
            </span>
          </div>

          {/* モード設定 */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">モード:</span>
            {(
              [
                ["addition", "たし算"],
                ["subtraction", "ひき算"],
                ["mixed", "まぜる"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                onClick={() => updateSetting("mode", m)}
                className={`rounded px-2 py-1 text-xs ${
                  progress!.mode === m
                    ? "bg-orange-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 最大数設定 */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">最大数:</span>
            {[10, 20, 50, 100].map((n) => (
              <button
                key={n}
                onClick={() => updateSetting("maxNumber", n)}
                className={`rounded px-2 py-1 text-xs ${
                  progress!.maxNumber === n
                    ? "bg-orange-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {n}
              </button>
            ))}
          </div>

          {/* 問題数設定 */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">問題数:</span>
            {[3, 5, 10].map((n) => (
              <button
                key={n}
                onClick={() => updateSetting("equationsPerSession", n)}
                className={`rounded px-2 py-1 text-xs ${
                  progress!.equationsPerSession === n
                    ? "bg-orange-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {n}問
              </button>
            ))}
          </div>

          {/* 速度設定 */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">速度:</span>
            {[0.5, 0.75, 1, 1.5, 2].map((s) => (
              <button
                key={s}
                onClick={() => updateSetting("speed", s)}
                className={`rounded px-2 py-1 text-xs ${
                  progress!.speed === s
                    ? "bg-orange-500 text-white"
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
                ? "bg-orange-500 text-white hover:bg-orange-600"
                : "border border-orange-500 text-orange-600 hover:bg-orange-50"
            }`}
          >
            {sessionsLeft > 0 ? "スタート" : "追加でスタート"}
          </button>
        </div>

        <a
          href="/dashboard"
          className="block text-center text-sm text-orange-600 hover:underline"
        >
          ← ダッシュボードに戻る
        </a>
      </div>
    </div>
  );
}
