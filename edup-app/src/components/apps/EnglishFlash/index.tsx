"use client";

import { createClient } from "@/lib/supabase/client";
import { checkAndAwardBadges } from "@/lib/badges";
import { useCallback, useEffect, useRef, useState } from "react";

// --- 単語データ ---
type WordCard = {
  word: string;
  emoji: string;
  category: string;
};

const WORD_DATA: WordCard[] = [
  // 動物 (25)
  { word: "dog", emoji: "🐶", category: "animals" },
  { word: "cat", emoji: "🐱", category: "animals" },
  { word: "bird", emoji: "🐦", category: "animals" },
  { word: "fish", emoji: "🐟", category: "animals" },
  { word: "rabbit", emoji: "🐰", category: "animals" },
  { word: "bear", emoji: "🐻", category: "animals" },
  { word: "elephant", emoji: "🐘", category: "animals" },
  { word: "lion", emoji: "🦁", category: "animals" },
  { word: "monkey", emoji: "🐵", category: "animals" },
  { word: "pig", emoji: "🐷", category: "animals" },
  { word: "cow", emoji: "🐮", category: "animals" },
  { word: "horse", emoji: "🐴", category: "animals" },
  { word: "sheep", emoji: "🐑", category: "animals" },
  { word: "chicken", emoji: "🐔", category: "animals" },
  { word: "duck", emoji: "🦆", category: "animals" },
  { word: "frog", emoji: "🐸", category: "animals" },
  { word: "turtle", emoji: "🐢", category: "animals" },
  { word: "penguin", emoji: "🐧", category: "animals" },
  { word: "whale", emoji: "🐳", category: "animals" },
  { word: "butterfly", emoji: "🦋", category: "animals" },
  { word: "giraffe", emoji: "🦒", category: "animals" },
  { word: "zebra", emoji: "🦓", category: "animals" },
  { word: "snake", emoji: "🐍", category: "animals" },
  { word: "owl", emoji: "🦉", category: "animals" },
  { word: "dolphin", emoji: "🐬", category: "animals" },
  // 食べ物 (25)
  { word: "apple", emoji: "🍎", category: "food" },
  { word: "banana", emoji: "🍌", category: "food" },
  { word: "orange", emoji: "🍊", category: "food" },
  { word: "grape", emoji: "🍇", category: "food" },
  { word: "strawberry", emoji: "🍓", category: "food" },
  { word: "watermelon", emoji: "🍉", category: "food" },
  { word: "peach", emoji: "🍑", category: "food" },
  { word: "cherry", emoji: "🍒", category: "food" },
  { word: "bread", emoji: "🍞", category: "food" },
  { word: "rice", emoji: "🍚", category: "food" },
  { word: "egg", emoji: "🥚", category: "food" },
  { word: "milk", emoji: "🥛", category: "food" },
  { word: "cake", emoji: "🎂", category: "food" },
  { word: "cookie", emoji: "🍪", category: "food" },
  { word: "ice cream", emoji: "🍦", category: "food" },
  { word: "pizza", emoji: "🍕", category: "food" },
  { word: "tomato", emoji: "🍅", category: "food" },
  { word: "corn", emoji: "🌽", category: "food" },
  { word: "carrot", emoji: "🥕", category: "food" },
  { word: "lemon", emoji: "🍋", category: "food" },
  { word: "chocolate", emoji: "🍫", category: "food" },
  { word: "cheese", emoji: "🧀", category: "food" },
  { word: "donut", emoji: "🍩", category: "food" },
  { word: "pineapple", emoji: "🍍", category: "food" },
  { word: "mushroom", emoji: "🍄", category: "food" },
  // 乗り物・もの (25)
  { word: "car", emoji: "🚗", category: "things" },
  { word: "bus", emoji: "🚌", category: "things" },
  { word: "train", emoji: "🚆", category: "things" },
  { word: "airplane", emoji: "✈️", category: "things" },
  { word: "bicycle", emoji: "🚲", category: "things" },
  { word: "boat", emoji: "⛵", category: "things" },
  { word: "rocket", emoji: "🚀", category: "things" },
  { word: "star", emoji: "⭐", category: "things" },
  { word: "sun", emoji: "☀️", category: "things" },
  { word: "moon", emoji: "🌙", category: "things" },
  { word: "rainbow", emoji: "🌈", category: "things" },
  { word: "flower", emoji: "🌸", category: "things" },
  { word: "tree", emoji: "🌳", category: "things" },
  { word: "house", emoji: "🏠", category: "things" },
  { word: "book", emoji: "📚", category: "things" },
  { word: "pencil", emoji: "✏️", category: "things" },
  { word: "clock", emoji: "🕐", category: "things" },
  { word: "umbrella", emoji: "☂️", category: "things" },
  { word: "hat", emoji: "🎩", category: "things" },
  { word: "shoe", emoji: "👟", category: "things" },
  { word: "key", emoji: "🔑", category: "things" },
  { word: "bell", emoji: "🔔", category: "things" },
  { word: "ball", emoji: "⚽", category: "things" },
  { word: "guitar", emoji: "🎸", category: "things" },
  { word: "camera", emoji: "📷", category: "things" },
  // からだ (15)
  { word: "eye", emoji: "👁️", category: "body" },
  { word: "ear", emoji: "👂", category: "body" },
  { word: "hand", emoji: "✋", category: "body" },
  { word: "foot", emoji: "🦶", category: "body" },
  { word: "heart", emoji: "❤️", category: "body" },
  { word: "nose", emoji: "👃", category: "body" },
  { word: "mouth", emoji: "👄", category: "body" },
  { word: "tooth", emoji: "🦷", category: "body" },
  { word: "leg", emoji: "🦵", category: "body" },
  { word: "bone", emoji: "🦴", category: "body" },
  { word: "brain", emoji: "🧠", category: "body" },
  { word: "muscle", emoji: "💪", category: "body" },
  { word: "finger", emoji: "👆", category: "body" },
  { word: "face", emoji: "😊", category: "body" },
  { word: "tongue", emoji: "👅", category: "body" },
  // しぜん (15)
  { word: "fire", emoji: "🔥", category: "nature" },
  { word: "water", emoji: "💧", category: "nature" },
  { word: "snow", emoji: "❄️", category: "nature" },
  { word: "cloud", emoji: "☁️", category: "nature" },
  { word: "mountain", emoji: "⛰️", category: "nature" },
  { word: "rain", emoji: "🌧️", category: "nature" },
  { word: "wind", emoji: "🌬️", category: "nature" },
  { word: "thunder", emoji: "⚡", category: "nature" },
  { word: "ocean", emoji: "🌊", category: "nature" },
  { word: "river", emoji: "🏞️", category: "nature" },
  { word: "leaf", emoji: "🍃", category: "nature" },
  { word: "rock", emoji: "🪨", category: "nature" },
  { word: "sand", emoji: "🏖️", category: "nature" },
  { word: "earth", emoji: "🌍", category: "nature" },
  { word: "volcano", emoji: "🌋", category: "nature" },
  // 色 (10)
  { word: "red", emoji: "🔴", category: "colors" },
  { word: "blue", emoji: "🔵", category: "colors" },
  { word: "green", emoji: "🟢", category: "colors" },
  { word: "yellow", emoji: "🟡", category: "colors" },
  { word: "orange", emoji: "🟠", category: "colors" },
  { word: "purple", emoji: "🟣", category: "colors" },
  { word: "pink", emoji: "🩷", category: "colors" },
  { word: "white", emoji: "⬜", category: "colors" },
  { word: "black", emoji: "⬛", category: "colors" },
  { word: "brown", emoji: "🟤", category: "colors" },
];

const CATEGORIES = [
  { id: "all", label: "すべて" },
  { id: "animals", label: "どうぶつ" },
  { id: "food", label: "たべもの" },
  { id: "things", label: "もの" },
  { id: "body", label: "からだ" },
  { id: "nature", label: "しぜん" },
  { id: "colors", label: "いろ" },
];

const CARDS_PER_SESSION = 10;

type ProgressData = {
  level: number;
  totalSessions: number;
  todaySessions: number;
  lastSessionDate: string;
  speed: number;
  category: string;
  learnedWords: string[];
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
  return {
    level: 1,
    totalSessions: 0,
    todaySessions: 0,
    lastSessionDate: getLocalToday(),
    speed: 2,
    category: "all",
    learnedWords: [],
  };
}

/** MP3ファイルで英語読み上げ（ブラウザ非依存）
 *  Promiseを返し、発話完了（またはエラー）時にresolveする */
let currentAudio: HTMLAudioElement | null = null;
function speakEnglish(text: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  const filename = text.replace(/ /g, "-") + ".mp3";
  return new Promise<void>((resolve) => {
    const audio = new Audio(`/audio/english-flash/${filename}`);
    currentAudio = audio;
    audio.onended = () => resolve();
    audio.onerror = () => {
      speakEnglishFallback(text).then(resolve);
    };
    audio.play().catch(() => speakEnglishFallback(text).then(resolve));
  });
}

/** speechSynthesisフォールバック */
function speakEnglishFallback(text: string): Promise<void> {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    return new Promise<void>((resolve) => {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "en-US";
      utter.rate = 0.85;
      utter.pitch = 1.1;
      utter.onend = () => resolve();
      utter.onerror = () => resolve();
      window.speechSynthesis.speak(utter);
    });
  }
  return Promise.resolve();
}

export default function EnglishFlash({ childId, childName }: Props) {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<"home" | "playing" | "done">("home");
  const [cards, setCards] = useState<WordCard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [newBadges, setNewBadges] = useState<
    { id: string; name: string; icon: string }[]
  >([]);
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
        .eq("app_id", "english-flash")
        .single();

      const today = getLocalToday();

      if (data?.data) {
        const p = data.data as ProgressData;
        if (p.lastSessionDate !== today) {
          p.todaySessions = 0;
          p.lastSessionDate = today;
          await supabase
            .from("progress")
            .upsert(
              { child_id: childId, app_id: "english-flash", data: p },
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
          { child_id: childId, app_id: "english-flash", data: p },
          { onConflict: "child_id,app_id" }
        );
    },
    [childId, supabase]
  );

  // セッション用カード選択
  const pickCards = useCallback((): WordCard[] => {
    if (!progress) return [];
    const pool =
      progress.category === "all"
        ? WORD_DATA
        : WORD_DATA.filter((w) => w.category === progress.category);

    // まだ覚えてない単語を優先
    const unlearned = pool.filter(
      (w) => !progress.learnedWords.includes(w.word)
    );
    const source = unlearned.length >= CARDS_PER_SESSION ? unlearned : pool;

    // シャッフルして選択
    const shuffled = [...source].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, CARDS_PER_SESSION);
  }, [progress]);

  // フラッシュ開始
  const startSession = useCallback(() => {
    if (!progress) return;
    const sessionCards = pickCards();
    if (sessionCards.length === 0) return;
    setCards(sessionCards);
    setCurrentCardIndex(0);
    setPhase("playing");
    setNewBadges([]);
    sessionStartRef.current = Date.now();
    cancelledRef.current = false;

    // 最初のカードを読み上げ（少し待ってから）
    setTimeout(() => {
      speechPromiseRef.current = speakEnglish(sessionCards[0].word);
    }, 300);
  }, [progress, pickCards]);

  // 次のカードへ自動進行（表示時間経過 → 音声完了の両方を待つ）
  useEffect(() => {
    if (phase !== "playing" || !progress) return;

    cancelledRef.current = false;

    const advanceToNext = () => {
      if (cancelledRef.current) return;

      const nextIndex = currentCardIndex + 1;
      if (nextIndex >= cards.length) {
        // セッション完了
        const newLearned = [
          ...new Set([
            ...progress.learnedWords,
            ...cards.map((c) => c.word),
          ]),
        ];
        const updated: ProgressData = {
          ...progress,
          totalSessions: progress.totalSessions + 1,
          todaySessions: progress.todaySessions + 1,
          lastSessionDate: getLocalToday(),
          learnedWords: newLearned,
          level: Math.floor(newLearned.length / 10) + 1,
        };
        setProgress(updated);
        saveProgress(updated);

        // アクティビティログ
        const duration = Math.round(
          (Date.now() - sessionStartRef.current) / 1000
        );
        supabase
          .from("activity_logs")
          .insert({
            child_id: childId,
            app_id: "english-flash",
            duration_seconds: duration,
            session_data: {
              words: cards.map((c) => c.word),
              speed: progress.speed,
              category: progress.category,
            },
          })
          .then(() => {
            checkAndAwardBadges(supabase, childId, "english-flash").then(
              (badges) => {
                if (badges.length > 0) setNewBadges(badges);
              }
            );
          });

        setPhase("done");
        return;
      }
      setCurrentCardIndex(nextIndex);
      speechPromiseRef.current = speakEnglish(cards[nextIndex].word);
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
  }, [phase, currentCardIndex, cards, progress, saveProgress, childId, supabase]);

  const changeSpeed = (newSpeed: number) => {
    if (!progress) return;
    const updated = { ...progress, speed: newSpeed };
    setProgress(updated);
    saveProgress(updated);
  };

  const changeCategory = (cat: string) => {
    if (!progress) return;
    const updated = { ...progress, category: cat };
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

  // フラッシュ中
  if (phase === "playing" && cards.length > 0) {
    const card = cards[currentCardIndex];
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="text-[min(40vmin,200px)] leading-none">
            {card.emoji}
          </div>
          <div className="text-[min(12vmin,72px)] font-bold text-gray-800 tracking-wide">
            {card.word}
          </div>
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
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-emerald-50 to-white px-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="text-4xl">{remaining <= 0 ? "🎉" : "👏"}</div>
          <h2 className="text-xl font-bold text-gray-800">
            {remaining <= 0 ? "今日の規定回数クリア！" : `あと ${remaining} 回`}
          </h2>
          <p className="text-sm text-gray-500">
            {childName}さん・レベル {progress?.level}・覚えた単語{" "}
            {progress?.learnedWords.length ?? 0} 個
          </p>
          <div className="text-sm text-gray-500">
            今日のセッション: {cards.map((c) => c.emoji).join(" ")}
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
                  ? "bg-emerald-500 text-white hover:bg-emerald-600"
                  : "border border-emerald-500 text-emerald-600 hover:bg-emerald-50"
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
  const sessionsLeft = progress ? 3 - progress.todaySessions : 0;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-emerald-50 to-white px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800">
            英語フラッシュカード
          </h2>
          <p className="mt-1 text-sm text-gray-500">{childName}さん</p>
        </div>

        <div className="rounded-lg border bg-white p-5 shadow-sm space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">
              レベル {progress!.level}
            </span>
            <span className="text-gray-500">
              今日 {progress!.todaySessions}/3 回
            </span>
          </div>

          <div className="text-sm text-gray-600">
            覚えた単語:{" "}
            <span className="font-medium">
              {progress!.learnedWords.length} / {WORD_DATA.length}
            </span>
          </div>

          {/* 進捗バー */}
          <div className="h-2 rounded-full bg-gray-100">
            <div
              className="h-2 rounded-full bg-emerald-400 transition-all"
              style={{
                width: `${(progress!.learnedWords.length / WORD_DATA.length) * 100}%`,
              }}
            />
          </div>

          {/* カテゴリ選択 */}
          <div className="space-y-1">
            <span className="text-xs text-gray-500">カテゴリ:</span>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => changeCategory(cat.id)}
                  className={`rounded-full px-3 py-1 text-xs transition ${
                    progress!.category === cat.id
                      ? "bg-emerald-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* 速度設定 */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">速度:</span>
            {[1, 1.5, 2, 3, 4].map((s) => (
              <button
                key={s}
                onClick={() => changeSpeed(s)}
                className={`rounded px-2 py-1 text-xs ${
                  progress!.speed === s
                    ? "bg-emerald-500 text-white"
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
                ? "bg-emerald-500 text-white hover:bg-emerald-600"
                : "border border-emerald-500 text-emerald-600 hover:bg-emerald-50"
            }`}
          >
            {sessionsLeft > 0 ? "スタート" : "追加でスタート"}
          </button>
        </div>

        <a
          href="/dashboard"
          className="block text-center text-sm text-emerald-600 hover:underline"
        >
          ← ダッシュボードに戻る
        </a>
      </div>
    </div>
  );
}
