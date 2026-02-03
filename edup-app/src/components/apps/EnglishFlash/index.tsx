"use client";

import { createClient } from "@/lib/supabase/client";
import { checkAndAwardBadges } from "@/lib/badges";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";

// --- 単語データ ---
type WordCard = {
  word: string;
  emoji: string;
  fluentEmoji?: string; // Fluent Emoji画像パス（3D）
  category: string;
};

// Fluent Emoji CDN ベースURL
const FLUENT_EMOJI_BASE =
  "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets";

// Fluent Emoji画像URLを生成するヘルパー
const fluent = (name: string): string => {
  const snakeCase = name.toLowerCase().replace(/ /g, "_");
  return `${FLUENT_EMOJI_BASE}/${encodeURIComponent(name)}/3D/${snakeCase}_3d.png`;
};

const WORD_DATA: WordCard[] = [
  // 動物 (25)
  { word: "dog", emoji: "🐶", fluentEmoji: fluent("Dog face"), category: "animals" },
  { word: "cat", emoji: "🐱", fluentEmoji: fluent("Cat face"), category: "animals" },
  { word: "bird", emoji: "🐦", fluentEmoji: fluent("Bird"), category: "animals" },
  { word: "fish", emoji: "🐟", fluentEmoji: fluent("Fish"), category: "animals" },
  { word: "rabbit", emoji: "🐰", fluentEmoji: fluent("Rabbit face"), category: "animals" },
  { word: "bear", emoji: "🐻", fluentEmoji: fluent("Bear"), category: "animals" },
  { word: "elephant", emoji: "🐘", fluentEmoji: fluent("Elephant"), category: "animals" },
  { word: "lion", emoji: "🦁", fluentEmoji: fluent("Lion"), category: "animals" },
  { word: "monkey", emoji: "🐵", fluentEmoji: fluent("Monkey face"), category: "animals" },
  { word: "pig", emoji: "🐷", fluentEmoji: fluent("Pig face"), category: "animals" },
  { word: "cow", emoji: "🐮", fluentEmoji: fluent("Cow face"), category: "animals" },
  { word: "horse", emoji: "🐴", fluentEmoji: fluent("Horse face"), category: "animals" },
  { word: "sheep", emoji: "🐑", fluentEmoji: fluent("Ewe"), category: "animals" },
  { word: "chicken", emoji: "🐔", fluentEmoji: fluent("Chicken"), category: "animals" },
  { word: "duck", emoji: "🦆", fluentEmoji: fluent("Duck"), category: "animals" },
  { word: "frog", emoji: "🐸", fluentEmoji: fluent("Frog"), category: "animals" },
  { word: "turtle", emoji: "🐢", fluentEmoji: fluent("Turtle"), category: "animals" },
  { word: "penguin", emoji: "🐧", fluentEmoji: fluent("Penguin"), category: "animals" },
  { word: "whale", emoji: "🐳", fluentEmoji: fluent("Spouting whale"), category: "animals" },
  { word: "butterfly", emoji: "🦋", fluentEmoji: fluent("Butterfly"), category: "animals" },
  { word: "giraffe", emoji: "🦒", fluentEmoji: fluent("Giraffe"), category: "animals" },
  { word: "zebra", emoji: "🦓", fluentEmoji: fluent("Zebra"), category: "animals" },
  { word: "snake", emoji: "🐍", fluentEmoji: fluent("Snake"), category: "animals" },
  { word: "owl", emoji: "🦉", fluentEmoji: fluent("Owl"), category: "animals" },
  { word: "dolphin", emoji: "🐬", fluentEmoji: fluent("Dolphin"), category: "animals" },
  // 食べ物 (25)
  { word: "apple", emoji: "🍎", fluentEmoji: fluent("Red apple"), category: "food" },
  { word: "banana", emoji: "🍌", fluentEmoji: fluent("Banana"), category: "food" },
  { word: "orange", emoji: "🍊", fluentEmoji: fluent("Tangerine"), category: "food" },
  { word: "grape", emoji: "🍇", fluentEmoji: fluent("Grapes"), category: "food" },
  { word: "strawberry", emoji: "🍓", fluentEmoji: fluent("Strawberry"), category: "food" },
  { word: "watermelon", emoji: "🍉", fluentEmoji: fluent("Watermelon"), category: "food" },
  { word: "peach", emoji: "🍑", fluentEmoji: fluent("Peach"), category: "food" },
  { word: "cherry", emoji: "🍒", fluentEmoji: fluent("Cherries"), category: "food" },
  { word: "bread", emoji: "🍞", fluentEmoji: fluent("Bread"), category: "food" },
  { word: "rice", emoji: "🍚", fluentEmoji: fluent("Cooked rice"), category: "food" },
  { word: "egg", emoji: "🥚", fluentEmoji: fluent("Egg"), category: "food" },
  { word: "milk", emoji: "🥛", fluentEmoji: fluent("Glass of milk"), category: "food" },
  { word: "cake", emoji: "🎂", fluentEmoji: fluent("Birthday cake"), category: "food" },
  { word: "cookie", emoji: "🍪", fluentEmoji: fluent("Cookie"), category: "food" },
  { word: "ice cream", emoji: "🍦", fluentEmoji: fluent("Soft ice cream"), category: "food" },
  { word: "pizza", emoji: "🍕", fluentEmoji: fluent("Pizza"), category: "food" },
  { word: "tomato", emoji: "🍅", fluentEmoji: fluent("Tomato"), category: "food" },
  { word: "corn", emoji: "🌽", fluentEmoji: fluent("Ear of corn"), category: "food" },
  { word: "carrot", emoji: "🥕", fluentEmoji: fluent("Carrot"), category: "food" },
  { word: "lemon", emoji: "🍋", fluentEmoji: fluent("Lemon"), category: "food" },
  { word: "chocolate", emoji: "🍫", fluentEmoji: fluent("Chocolate bar"), category: "food" },
  { word: "cheese", emoji: "🧀", fluentEmoji: fluent("Cheese wedge"), category: "food" },
  { word: "donut", emoji: "🍩", fluentEmoji: fluent("Doughnut"), category: "food" },
  { word: "pineapple", emoji: "🍍", fluentEmoji: fluent("Pineapple"), category: "food" },
  { word: "mushroom", emoji: "🍄", fluentEmoji: fluent("Mushroom"), category: "food" },
  // 乗り物・もの (25)
  { word: "car", emoji: "🚗", fluentEmoji: fluent("Automobile"), category: "things" },
  { word: "bus", emoji: "🚌", fluentEmoji: fluent("Bus"), category: "things" },
  { word: "train", emoji: "🚆", fluentEmoji: fluent("Train"), category: "things" },
  { word: "airplane", emoji: "✈️", fluentEmoji: fluent("Airplane"), category: "things" },
  { word: "bicycle", emoji: "🚲", fluentEmoji: fluent("Bicycle"), category: "things" },
  { word: "boat", emoji: "⛵", fluentEmoji: fluent("Sailboat"), category: "things" },
  { word: "rocket", emoji: "🚀", fluentEmoji: fluent("Rocket"), category: "things" },
  { word: "star", emoji: "⭐", fluentEmoji: fluent("Star"), category: "things" },
  { word: "sun", emoji: "☀️", fluentEmoji: fluent("Sun"), category: "things" },
  { word: "moon", emoji: "🌙", fluentEmoji: fluent("Crescent moon"), category: "things" },
  { word: "rainbow", emoji: "🌈", fluentEmoji: fluent("Rainbow"), category: "things" },
  { word: "flower", emoji: "🌸", fluentEmoji: fluent("Cherry blossom"), category: "things" },
  { word: "tree", emoji: "🌳", fluentEmoji: fluent("Deciduous tree"), category: "things" },
  { word: "house", emoji: "🏠", fluentEmoji: fluent("House"), category: "things" },
  { word: "book", emoji: "📚", fluentEmoji: fluent("Books"), category: "things" },
  { word: "pencil", emoji: "✏️", fluentEmoji: fluent("Pencil"), category: "things" },
  { word: "clock", emoji: "🕐", fluentEmoji: fluent("One o'clock"), category: "things" },
  { word: "umbrella", emoji: "☂️", fluentEmoji: fluent("Umbrella"), category: "things" },
  { word: "hat", emoji: "🎩", fluentEmoji: fluent("Top hat"), category: "things" },
  { word: "shoe", emoji: "👟", fluentEmoji: fluent("Running shoe"), category: "things" },
  { word: "key", emoji: "🔑", fluentEmoji: fluent("Key"), category: "things" },
  { word: "bell", emoji: "🔔", fluentEmoji: fluent("Bell"), category: "things" },
  { word: "ball", emoji: "⚽", fluentEmoji: fluent("Soccer ball"), category: "things" },
  { word: "guitar", emoji: "🎸", fluentEmoji: fluent("Guitar"), category: "things" },
  { word: "camera", emoji: "📷", fluentEmoji: fluent("Camera"), category: "things" },
  // からだ (15)
  { word: "eye", emoji: "👁️", fluentEmoji: fluent("Eye"), category: "body" },
  { word: "ear", emoji: "👂", fluentEmoji: fluent("Ear"), category: "body" },
  { word: "hand", emoji: "✋", fluentEmoji: fluent("Raised hand"), category: "body" },
  { word: "foot", emoji: "🦶", fluentEmoji: fluent("Foot"), category: "body" },
  { word: "heart", emoji: "❤️", fluentEmoji: fluent("Red heart"), category: "body" },
  { word: "nose", emoji: "👃", fluentEmoji: fluent("Nose"), category: "body" },
  { word: "mouth", emoji: "👄", fluentEmoji: fluent("Mouth"), category: "body" },
  { word: "tooth", emoji: "🦷", fluentEmoji: fluent("Tooth"), category: "body" },
  { word: "leg", emoji: "🦵", fluentEmoji: fluent("Leg"), category: "body" },
  { word: "bone", emoji: "🦴", fluentEmoji: fluent("Bone"), category: "body" },
  { word: "brain", emoji: "🧠", fluentEmoji: fluent("Brain"), category: "body" },
  { word: "muscle", emoji: "💪", fluentEmoji: fluent("Flexed biceps"), category: "body" },
  { word: "finger", emoji: "👆", fluentEmoji: fluent("Backhand index pointing up"), category: "body" },
  { word: "face", emoji: "😊", fluentEmoji: fluent("Smiling face with smiling eyes"), category: "body" },
  { word: "tongue", emoji: "👅", fluentEmoji: fluent("Tongue"), category: "body" },
  // しぜん (15)
  { word: "fire", emoji: "🔥", fluentEmoji: fluent("Fire"), category: "nature" },
  { word: "water", emoji: "💧", fluentEmoji: fluent("Droplet"), category: "nature" },
  { word: "snow", emoji: "❄️", fluentEmoji: fluent("Snowflake"), category: "nature" },
  { word: "cloud", emoji: "☁️", fluentEmoji: fluent("Cloud"), category: "nature" },
  { word: "mountain", emoji: "⛰️", fluentEmoji: fluent("Mountain"), category: "nature" },
  { word: "rain", emoji: "🌧️", fluentEmoji: fluent("Cloud with rain"), category: "nature" },
  { word: "wind", emoji: "🌬️", fluentEmoji: fluent("Wind face"), category: "nature" },
  { word: "thunder", emoji: "⚡", fluentEmoji: fluent("High voltage"), category: "nature" },
  { word: "ocean", emoji: "🌊", fluentEmoji: fluent("Water wave"), category: "nature" },
  { word: "river", emoji: "🏞️", fluentEmoji: fluent("National park"), category: "nature" },
  { word: "leaf", emoji: "🍃", fluentEmoji: fluent("Leaf fluttering in wind"), category: "nature" },
  { word: "rock", emoji: "🪨", fluentEmoji: fluent("Rock"), category: "nature" },
  { word: "sand", emoji: "🏖️", fluentEmoji: fluent("Beach with umbrella"), category: "nature" },
  { word: "earth", emoji: "🌍", fluentEmoji: fluent("Globe showing Europe-Africa"), category: "nature" },
  { word: "volcano", emoji: "🌋", fluentEmoji: fluent("Volcano"), category: "nature" },
  // 色 (10)
  { word: "red", emoji: "🔴", fluentEmoji: fluent("Red circle"), category: "colors" },
  { word: "blue", emoji: "🔵", fluentEmoji: fluent("Blue circle"), category: "colors" },
  { word: "green", emoji: "🟢", fluentEmoji: fluent("Green circle"), category: "colors" },
  { word: "yellow", emoji: "🟡", fluentEmoji: fluent("Yellow circle"), category: "colors" },
  { word: "orange", emoji: "🟠", fluentEmoji: fluent("Orange circle"), category: "colors" },
  { word: "purple", emoji: "🟣", fluentEmoji: fluent("Purple circle"), category: "colors" },
  { word: "pink", emoji: "🩷", fluentEmoji: fluent("Pink heart"), category: "colors" },
  { word: "white", emoji: "⬜", fluentEmoji: fluent("White large square"), category: "colors" },
  { word: "black", emoji: "⬛", fluentEmoji: fluent("Black large square"), category: "colors" },
  { word: "brown", emoji: "🟤", fluentEmoji: fluent("Brown circle"), category: "colors" },
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

/** Fluent Emoji画像（読み込み失敗時は通常絵文字にフォールバック） */
function FluentEmojiImage({
  card,
  size,
  className,
}: {
  card: WordCard;
  size: number;
  className?: string;
}) {
  const [useFallback, setUseFallback] = useState(false);

  if (useFallback || !card.fluentEmoji) {
    return (
      <span className={className} style={{ fontSize: size }}>
        {card.emoji}
      </span>
    );
  }

  return (
    <Image
      src={card.fluentEmoji}
      alt={card.word}
      width={size}
      height={size}
      className={className}
      onError={() => setUseFallback(true)}
      unoptimized
      priority
    />
  );
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
          <div className="w-[min(50vmin,480px)] h-[min(50vmin,480px)] flex items-center justify-center">
            <FluentEmojiImage card={card} size={480} className="w-full h-full object-contain" />
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
