"use client";

import { createClient } from "@/lib/supabase/client";
import { checkAndAwardBadges } from "@/lib/badges";
import { useCallback, useEffect, useRef, useState } from "react";

// --- ひらがなデータ ---
type HiraganaCard = {
  kana: string;    // ひらがな1文字
  word: string;    // 単語（ひらがな）
  kanji: string;   // 漢字表記
  emoji: string;   // 絵文字
};

const HIRAGANA_DATA: HiraganaCard[] = [
  // あ行
  { kana: "あ", word: "あり", kanji: "蟻", emoji: "🐜" },
  { kana: "い", word: "いぬ", kanji: "犬", emoji: "🐕" },
  { kana: "う", word: "うし", kanji: "牛", emoji: "🐄" },
  { kana: "え", word: "えび", kanji: "海老", emoji: "🦐" },
  { kana: "お", word: "おに", kanji: "鬼", emoji: "👹" },
  // か行
  { kana: "か", word: "かに", kanji: "蟹", emoji: "🦀" },
  { kana: "き", word: "きつね", kanji: "狐", emoji: "🦊" },
  { kana: "く", word: "くま", kanji: "熊", emoji: "🐻" },
  { kana: "け", word: "けむし", kanji: "毛虫", emoji: "🐛" },
  { kana: "こ", word: "こあら", kanji: "コアラ", emoji: "🐨" },
  // さ行
  { kana: "さ", word: "さる", kanji: "猿", emoji: "🐵" },
  { kana: "し", word: "しか", kanji: "鹿", emoji: "🦌" },
  { kana: "す", word: "すいか", kanji: "西瓜", emoji: "🍉" },
  { kana: "せ", word: "せんす", kanji: "扇子", emoji: "🪭" },
  { kana: "そ", word: "そら", kanji: "空", emoji: "🌤️" },
  // た行
  { kana: "た", word: "たこ", kanji: "蛸", emoji: "🐙" },
  { kana: "ち", word: "ちょう", kanji: "蝶", emoji: "🦋" },
  { kana: "つ", word: "つき", kanji: "月", emoji: "🌙" },
  { kana: "て", word: "てんとうむし", kanji: "天道虫", emoji: "🐞" },
  { kana: "と", word: "とら", kanji: "虎", emoji: "🐯" },
  // な行
  { kana: "な", word: "なす", kanji: "茄子", emoji: "🍆" },
  { kana: "に", word: "にわとり", kanji: "鶏", emoji: "🐔" },
  { kana: "ぬ", word: "ぬいぐるみ", kanji: "縫いぐるみ", emoji: "🧸" },
  { kana: "ね", word: "ねこ", kanji: "猫", emoji: "🐱" },
  { kana: "の", word: "のり", kanji: "海苔", emoji: "🍙" },
  // は行
  { kana: "は", word: "はな", kanji: "花", emoji: "🌸" },
  { kana: "ひ", word: "ひよこ", kanji: "雛", emoji: "🐤" },
  { kana: "ふ", word: "ふくろう", kanji: "梟", emoji: "🦉" },
  { kana: "へ", word: "へび", kanji: "蛇", emoji: "🐍" },
  { kana: "ほ", word: "ほし", kanji: "星", emoji: "⭐" },
  // ま行
  { kana: "ま", word: "まめ", kanji: "豆", emoji: "🫘" },
  { kana: "み", word: "みかん", kanji: "蜜柑", emoji: "🍊" },
  { kana: "む", word: "むし", kanji: "虫", emoji: "🐛" },
  { kana: "め", word: "め", kanji: "目", emoji: "👁️" },
  { kana: "も", word: "もも", kanji: "桃", emoji: "🍑" },
  // や行
  { kana: "や", word: "やま", kanji: "山", emoji: "⛰️" },
  { kana: "ゆ", word: "ゆき", kanji: "雪", emoji: "❄️" },
  { kana: "よ", word: "よっと", kanji: "ヨット", emoji: "⛵" },
  // ら行
  { kana: "ら", word: "らいおん", kanji: "ライオン", emoji: "🦁" },
  { kana: "り", word: "りんご", kanji: "林檎", emoji: "🍎" },
  { kana: "る", word: "るびー", kanji: "ルビー", emoji: "💎" },
  { kana: "れ", word: "れもん", kanji: "レモン", emoji: "🍋" },
  { kana: "ろ", word: "ろうそく", kanji: "蝋燭", emoji: "🕯️" },
  // わ行
  { kana: "わ", word: "わに", kanji: "鰐", emoji: "🐊" },
  { kana: "を", word: "を", kanji: "を", emoji: "📝" },
  { kana: "ん", word: "ん", kanji: "ん", emoji: "💤" },
];

// 行ごとのカテゴリ
const CATEGORIES = [
  { id: "all", label: "すべて" },
  { id: "a", label: "あ行", kanas: ["あ", "い", "う", "え", "お"] },
  { id: "ka", label: "か行", kanas: ["か", "き", "く", "け", "こ"] },
  { id: "sa", label: "さ行", kanas: ["さ", "し", "す", "せ", "そ"] },
  { id: "ta", label: "た行", kanas: ["た", "ち", "つ", "て", "と"] },
  { id: "na", label: "な行", kanas: ["な", "に", "ぬ", "ね", "の"] },
  { id: "ha", label: "は行", kanas: ["は", "ひ", "ふ", "へ", "ほ"] },
  { id: "ma", label: "ま行", kanas: ["ま", "み", "む", "め", "も"] },
  { id: "ya", label: "や行", kanas: ["や", "ゆ", "よ"] },
  { id: "ra", label: "ら行", kanas: ["ら", "り", "る", "れ", "ろ"] },
  { id: "wa", label: "わ行", kanas: ["わ", "を", "ん"] },
];

// 表示モード
type DisplayMode = "full" | "hiragana" | "kanji";
const DISPLAY_MODES = [
  { id: "full" as DisplayMode, label: "フル表示" },
  { id: "hiragana" as DisplayMode, label: "ひらがなのみ" },
  { id: "kanji" as DisplayMode, label: "漢字メイン" },
];

const CARDS_PER_SESSION = 10;

type ProgressData = {
  level: number;
  totalSessions: number;
  todaySessions: number;
  lastSessionDate: string;
  speed: number;
  category: string;
  displayMode: DisplayMode;
  learnedKanas: string[];
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
    displayMode: "full",
    learnedKanas: [],
  };
}

/** MP3ファイルで日本語読み上げ
 *  Promiseを返し、発話完了（またはエラー）時にresolveする */
let currentAudio: HTMLAudioElement | null = null;
function speakJapanese(word: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  const filename = `${word}.mp3`;
  return new Promise<void>((resolve) => {
    const audio = new Audio(`/audio/hiragana-flash/${filename}`);
    currentAudio = audio;
    audio.onended = () => resolve();
    audio.onerror = () => {
      speakJapaneseFallback(word).then(resolve);
    };
    audio.play().catch(() => speakJapaneseFallback(word).then(resolve));
  });
}

/** speechSynthesisフォールバック */
function speakJapaneseFallback(text: string): Promise<void> {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    return new Promise<void>((resolve) => {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "ja-JP";
      utter.rate = 0.8;
      utter.pitch = 1.1;
      utter.onend = () => resolve();
      utter.onerror = () => resolve();
      window.speechSynthesis.speak(utter);
    });
  }
  return Promise.resolve();
}

export default function HiraganaFlash({ childId, childName }: Props) {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<"home" | "playing" | "done">("home");
  const [cards, setCards] = useState<HiraganaCard[]>([]);
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
        .eq("app_id", "hiragana-flash")
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
              { child_id: childId, app_id: "hiragana-flash", data: p },
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
          { child_id: childId, app_id: "hiragana-flash", data: p },
          { onConflict: "child_id,app_id" }
        );
    },
    [childId, supabase]
  );

  // カテゴリでフィルター
  const getFilteredCards = useCallback((): HiraganaCard[] => {
    if (!progress) return [];
    if (progress.category === "all") return HIRAGANA_DATA;
    const cat = CATEGORIES.find((c) => c.id === progress.category);
    if (!cat || !("kanas" in cat) || !cat.kanas) return HIRAGANA_DATA;
    const kanas = cat.kanas;
    return HIRAGANA_DATA.filter((h) => kanas.includes(h.kana));
  }, [progress]);

  // セッション用カード選択
  const pickCards = useCallback((): HiraganaCard[] => {
    if (!progress) return [];
    const pool = getFilteredCards();

    // まだ覚えてないひらがなを優先
    const unlearned = pool.filter(
      (h) => !progress.learnedKanas.includes(h.kana)
    );
    const source = unlearned.length >= CARDS_PER_SESSION ? unlearned : pool;

    // シャッフルして選択
    const shuffled = [...source].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(CARDS_PER_SESSION, shuffled.length));
  }, [progress, getFilteredCards]);

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
    // 最初のカードの音声promiseを即座に設定（useEffectより先に）
    speechPromiseRef.current = speakJapanese(sessionCards[0].word);
  }, [progress, pickCards]);

  // 次のカードへ自動進行（表示時間経過 → 音声完了の両方を待つ）
  useEffect(() => {
    if (phase !== "playing" || !progress || cards.length === 0) return;

    cancelledRef.current = false;

    // 現在のカードの音声promiseを取得（キャプチャ）
    const currentSpeechPromise = speechPromiseRef.current;

    const advanceToNext = () => {
      if (cancelledRef.current) return;

      const nextIndex = currentCardIndex + 1;
      if (nextIndex >= cards.length) {
        // セッション完了
        const newLearned = [
          ...new Set([
            ...progress.learnedKanas,
            ...cards.map((c) => c.kana),
          ]),
        ];
        const updated: ProgressData = {
          ...progress,
          totalSessions: progress.totalSessions + 1,
          todaySessions: progress.todaySessions + 1,
          lastSessionDate: getLocalToday(),
          learnedKanas: newLearned,
          level: Math.floor(newLearned.length / 5) + 1,
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
            app_id: "hiragana-flash",
            duration_seconds: duration,
            session_data: {
              kanas: cards.map((c) => c.kana),
              speed: progress.speed,
              category: progress.category,
              displayMode: progress.displayMode,
            },
          })
          .then(() => {
            checkAndAwardBadges(supabase, childId, "hiragana-flash").then(
              (badges) => {
                if (badges.length > 0) setNewBadges(badges);
              }
            );
          });

        setPhase("done");
        return;
      }
      // 次のカードの音声を開始してからstateを更新
      speechPromiseRef.current = speakJapanese(cards[nextIndex].word);
      setCurrentCardIndex(nextIndex);
    };

    // 表示時間と音声完了の両方を待ってから次へ進む
    const timerPromise = new Promise<void>((resolve) => {
      timerRef.current = setTimeout(resolve, progress.speed * 1000);
    });

    Promise.all([timerPromise, currentSpeechPromise]).then(() => {
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

  const changeDisplayMode = (mode: DisplayMode) => {
    if (!progress) return;
    const updated = { ...progress, displayMode: mode };
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
    const displayMode = progress?.displayMode ?? "full";

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="text-[min(35vmin,180px)] leading-none">
            {card.emoji}
          </div>
          {displayMode === "full" && (
            <>
              <div className="text-[min(15vmin,90px)] font-bold text-gray-800">
                {card.word}
              </div>
              <div className="text-[min(8vmin,48px)] text-gray-500">
                {card.kanji}
              </div>
            </>
          )}
          {displayMode === "hiragana" && (
            <div className="text-[min(15vmin,90px)] font-bold text-gray-800">
              {card.word}
            </div>
          )}
          {displayMode === "kanji" && (
            <>
              <div className="text-[min(15vmin,90px)] font-bold text-gray-800">
                {card.kanji}
              </div>
              <div className="text-[min(6vmin,36px)] text-gray-400">
                {card.word}
              </div>
            </>
          )}
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
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-pink-50 to-white px-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="text-4xl">{remaining <= 0 ? "🎉" : "👏"}</div>
          <h2 className="text-xl font-bold text-gray-800">
            {remaining <= 0 ? "今日の規定回数クリア！" : `あと ${remaining} 回`}
          </h2>
          <p className="text-sm text-gray-500">
            {childName}さん・レベル {progress?.level}・覚えたひらがな{" "}
            {progress?.learnedKanas.length ?? 0} 文字
          </p>
          <div className="text-sm text-gray-500">
            今日のセッション: {cards.map((c) => c.kana).join(" ")}
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
                  ? "bg-pink-500 text-white hover:bg-pink-600"
                  : "border border-pink-500 text-pink-600 hover:bg-pink-50"
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
  const filteredCount = getFilteredCards().length;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-pink-50 to-white px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800">
            ひらがなフラッシュ
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
            覚えたひらがな:{" "}
            <span className="font-medium">
              {progress!.learnedKanas.length} / {HIRAGANA_DATA.length}
            </span>
          </div>

          {/* 進捗バー */}
          <div className="h-2 rounded-full bg-gray-100">
            <div
              className="h-2 rounded-full bg-pink-400 transition-all"
              style={{
                width: `${(progress!.learnedKanas.length / HIRAGANA_DATA.length) * 100}%`,
              }}
            />
          </div>

          {/* 表示モード選択 */}
          <div className="space-y-1">
            <span className="text-xs text-gray-500">表示モード:</span>
            <div className="flex flex-wrap gap-1.5">
              {DISPLAY_MODES.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => changeDisplayMode(mode.id)}
                  className={`rounded-full px-3 py-1 text-xs transition ${
                    progress!.displayMode === mode.id
                      ? "bg-pink-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          {/* カテゴリ選択 */}
          <div className="space-y-1">
            <span className="text-xs text-gray-500">行:</span>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => changeCategory(cat.id)}
                  className={`rounded-full px-3 py-1 text-xs transition ${
                    progress!.category === cat.id
                      ? "bg-pink-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            {progress!.category !== "all" && (
              <p className="text-xs text-gray-400 mt-1">
                選択中: {filteredCount}文字
              </p>
            )}
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
                    ? "bg-pink-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {s}秒
              </button>
            ))}
          </div>

          {sessionsLeft <= 0 && (
            <div className="rounded-lg bg-pink-50 p-3 text-center text-sm text-pink-700">
              今日の規定回数（3回）クリア！
            </div>
          )}

          <button
            onClick={startSession}
            className={`w-full rounded-lg py-4 text-lg font-bold transition ${
              sessionsLeft > 0
                ? "bg-pink-500 text-white hover:bg-pink-600"
                : "border border-pink-500 text-pink-600 hover:bg-pink-50"
            }`}
          >
            {sessionsLeft > 0 ? "スタート" : "追加でスタート"}
          </button>
        </div>

        <a
          href="/dashboard"
          className="block text-center text-sm text-pink-600 hover:underline"
        >
          ← ダッシュボードに戻る
        </a>
      </div>
    </div>
  );
}
