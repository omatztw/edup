#!/usr/bin/env python3
"""Gemini TTS を使って全アプリの音声ファイル(MP3)を生成するスクリプト。

バッチ生成方式: 複数単語をまとめて1回のAPI呼び出しで生成し、
無音区間で分割して個別MP3に保存する。API呼び出し数を約1/10に削減。

無料枠(Free tier)での目安:
  - 10 RPM, 250 RPD
  - 全414件 → バッチサイズ10 → 約42回のAPI呼び出し → 1日で完了

使い方:
  pip install google-genai pydub audioop-lts

  # ffmpeg も必要（pydubのMP3変換に使用）
  # Windows: winget install ffmpeg / choco install ffmpeg
  # Mac: brew install ffmpeg

  # 全アプリの音声を生成
  python scripts/generate-audio-gemini.py

  # 特定のアプリのみ
  python scripts/generate-audio-gemini.py --app hiragana-flash

  # 既存ファイルを上書き
  python scripts/generate-audio-gemini.py --force

  # バッチサイズを変更（デフォルト10）
  python scripts/generate-audio-gemini.py --batch-size 5

利用可能なボイス:
  Zephyr, Puck, Charon, Kore, Fenrir, Leda, Orus, Aoede,
  Callirrhoe, Autonoe, Enceladus, Iapetus, Umbriel, Algieba,
  Despina, Erinome, Algenib, Rasalgethi, Laomedeia, Achernar,
  Alnilam, Schedar, Gacrux, Pulcherrima, Achird, Zubenelgenubi,
  Vindemiatrix, Sadachbia, Sadaltager, Sulafat
"""

import argparse
import io
import os
import sys
import time
import wave

from google import genai
from google.genai import types
from pydub import AudioSegment
from pydub.silence import split_on_silence

# --- 定数 ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
AUDIO_BASE_DIR = os.path.join(SCRIPT_DIR, "..", "edup-app", "public", "audio")

DEFAULT_VOICE_JA = "Kore"
DEFAULT_VOICE_EN = "Aoede"
MODEL = "gemini-2.5-flash-preview-tts"

DEFAULT_DELAY = 8
DEFAULT_BATCH_SIZE = 50
DEFAULT_MAX_REQUESTS = 200
MAX_RETRIES = 3
RATE_LIMIT_WAIT = 60

# 無音分割パラメータ
SILENCE_MIN_LEN = 800    # 無音と判定する最小長さ (ms)
SILENCE_THRESH = -36      # 無音と判定する音量閾値 (dBFS)
SILENCE_KEEP = 150        # 分割後に前後に残す無音 (ms)


# --- 各アプリの音声データ定義 ---
# 各アイテムは以下の形式:
#   filename: 出力ファイル名
#   speech:   実際に読み上げるテキスト
#   context:  同音異義語の区別等、TTS への補足情報（省略可）
#   lang:     言語 ("ja" or "en")

def get_dots_items():
    """ドッツカード: 「これは N です」(1-100)"""
    items = []
    for n in range(1, 101):
        items.append({
            "filename": f"{n}.mp3",
            "speech": f"これは{n}です",
            "context": "",
            "lang": "ja",
        })
    return items


def get_dots_math_items():
    """ドッツ計算: 演算子 + 数字(1-100)"""
    items = []
    operators = [
        ("plus.mp3", "たす", "足し算の「たす」"),
        ("minus.mp3", "ひく", "引き算の「ひく」"),
        ("wa.mp3", "わ", "「〜は」の助詞"),
    ]
    for filename, speech, context in operators:
        items.append({
            "filename": filename,
            "speech": speech,
            "context": context,
            "lang": "ja",
        })
    for n in range(1, 101):
        items.append({
            "filename": f"{n}.mp3",
            "speech": str(n),
            "context": f"数字の{n}",
            "lang": "ja",
        })
    return items


def get_hiragana_flash_items():
    """ひらがなフラッシュ: 日本語単語（漢字・絵文字で意味を補足）"""
    # (word, kanji, emoji) - コンポーネントのHIRAGANA_DATAと同期
    data = [
        # あ行
        ("あり", "蟻", "🐜"), ("あめ", "飴", "🍬"), ("あひる", "家鴨", "🦆"),
        ("いぬ", "犬", "🐕"), ("いちご", "苺", "🍓"), ("いるか", "海豚", "🐬"),
        ("うし", "牛", "🐄"), ("うさぎ", "兎", "🐰"), ("うみ", "海", "🌊"),
        ("えび", "海老", "🦐"), ("えんぴつ", "鉛筆", "✏️"),
        ("おに", "鬼", "👹"), ("おばけ", "お化け", "👻"),
        # か行
        ("かに", "蟹", "🦀"), ("かさ", "傘", "☂️"), ("かめ", "亀", "🐢"),
        ("きつね", "狐", "🦊"), ("きのこ", "茸", "🍄"),
        ("くま", "熊", "🐻"), ("くじら", "鯨", "🐋"), ("くるま", "車", "🚗"),
        ("けむし", "毛虫", "🐛"), ("けーき", "ケーキ", "🎂"),
        ("こあら", "コアラ", "🐨"), ("こいのぼり", "鯉のぼり", "🎏"),
        # さ行
        ("さる", "猿", "🐵"), ("さかな", "魚", "🐟"),
        ("しか", "鹿", "🦌"), ("しんかんせん", "新幹線", "🚄"),
        ("すいか", "西瓜", "🍉"), ("すし", "寿司", "🍣"),
        ("せんす", "扇子", "🪭"), ("せんべい", "煎餅", "🍘"),
        ("そら", "空", "🌤️"), ("そり", "橇", "🛷"),
        # た行
        ("たこ", "蛸", "🐙"), ("たいよう", "太陽", "☀️"),
        ("ちょう", "蝶", "🦋"), ("ちーず", "チーズ", "🧀"),
        ("つき", "月", "🌙"), ("つばめ", "燕", "🐦"),
        ("てんとうむし", "天道虫", "🐞"), ("てがみ", "手紙", "💌"),
        ("とら", "虎", "🐯"), ("とけい", "時計", "⏰"),
        # な行
        ("なす", "茄子", "🍆"), ("なると", "鳴門", "🍥"),
        ("にわとり", "鶏", "🐔"), ("にじ", "虹", "🌈"),
        ("ぬいぐるみ", "縫いぐるみ", "🧸"),
        ("ねこ", "猫", "🐱"), ("ねずみ", "鼠", "🐭"),
        ("のり", "海苔", "🍙"),
        # は行
        ("はな", "花", "🌸"), ("はち", "蜂", "🐝"),
        ("ひよこ", "雛", "🐤"), ("ひこうき", "飛行機", "✈️"),
        ("ふくろう", "梟", "🦉"), ("ふね", "船", "🚢"),
        ("へび", "蛇", "🐍"),
        ("ほし", "星", "⭐"), ("ほうき", "箒", "🧹"),
        # ま行
        ("まめ", "豆", "🫘"), ("まと", "的", "🎯"),
        ("みかん", "蜜柑", "🍊"), ("みず", "水", "💧"),
        ("むし", "虫", "🐛"),
        ("め", "目", "👁️"), ("めだまやき", "目玉焼き", "🍳"),
        ("もも", "桃", "🍑"), ("もり", "森", "🌲"),
        # や行
        ("やま", "山", "⛰️"), ("やきいも", "焼き芋", "🍠"),
        ("ゆき", "雪", "❄️"), ("ゆびわ", "指輪", "💍"),
        ("よっと", "ヨット", "⛵"),
        # ら行
        ("らいおん", "ライオン", "🦁"), ("らっこ", "ラッコ", "🦦"),
        ("りんご", "林檎", "🍎"), ("りす", "栗鼠", "🐿️"),
        ("るびー", "ルビー", "💎"), ("れもん", "レモン", "🍋"),
        ("ろうそく", "蝋燭", "🕯️"), ("ろけっと", "ロケット", "🚀"),
        # わ行
        ("わに", "鰐", "🐊"),
        # 濁音 が行
        ("がっこう", "学校", "🏫"), ("がいこつ", "骸骨", "💀"),
        ("ぎたー", "ギター", "🎸"), ("ぎゅうにゅう", "牛乳", "🥛"),
        ("ぐー", "グー", "✊"),
        ("げーむ", "ゲーム", "🎮"),
        ("ごりら", "ゴリラ", "🦍"), ("ごはん", "御飯", "🍚"),
        # 濁音 ざ行
        ("ざりがに", "ザリガニ", "🦞"),
        ("じしゃく", "磁石", "🧲"), ("じてんしゃ", "自転車", "🚲"),
        ("ずぼん", "ズボン", "👖"), ("ぜりー", "ゼリー", "🍮"),
        ("ぞう", "象", "🐘"),
        # 濁音 だ行
        ("だんご", "団子", "🍡"),
        ("でんしゃ", "電車", "🚃"), ("でんわ", "電話", "📞"),
        ("どんぐり", "団栗", "🌰"), ("どーなつ", "ドーナツ", "🍩"),
        # 濁音 ば行
        ("ばなな", "バナナ", "🍌"), ("ばった", "飛蝗", "🦗"),
        ("びーだま", "ビー玉", "🔮"),
        ("ぶどう", "葡萄", "🍇"), ("ぶた", "豚", "🐷"),
        ("べる", "ベル", "🔔"),
        ("ぼうし", "帽子", "🎩"), ("ぼーる", "ボール", "⚽"),
        # 半濁音 ぱ行
        ("ぱんだ", "パンダ", "🐼"), ("ぱいなっぷる", "パイナップル", "🍍"),
        ("ぴあの", "ピアノ", "🎹"), ("ぷーる", "プール", "🏊"),
        ("ぺんぎん", "ペンギン", "🐧"),
        ("ぽすと", "ポスト", "📮"), ("ぽっぷこーん", "ポップコーン", "🍿"),
    ]
    items = []
    for word, kanji, emoji in data:
        items.append({
            "filename": f"{word}.mp3",
            "speech": word,
            "context": f"{kanji}{emoji}",
            "lang": "ja",
        })
    return items


def get_english_flash_items():
    """英語フラッシュ: 英単語"""
    words = [
        "dog", "cat", "bird", "fish", "rabbit", "bear", "elephant", "lion",
        "monkey", "pig", "cow", "horse", "sheep", "chicken", "duck", "frog",
        "turtle", "penguin", "whale", "butterfly", "giraffe", "zebra", "snake",
        "owl", "dolphin",
        "apple", "banana", "orange", "grape", "strawberry", "watermelon",
        "peach", "cherry", "bread", "rice", "egg", "milk", "cake", "cookie",
        "ice cream", "pizza", "tomato", "corn", "carrot", "lemon",
        "chocolate", "cheese", "donut", "pineapple", "mushroom",
        "car", "bus", "train", "airplane", "bicycle", "boat", "rocket",
        "star", "sun", "moon", "rainbow", "flower", "tree", "house", "book",
        "pencil", "clock", "umbrella", "hat", "shoe", "key", "bell", "ball",
        "guitar", "camera",
        "eye", "ear", "hand", "foot", "heart", "nose", "mouth", "tooth",
        "leg", "bone", "brain", "muscle", "finger", "face", "tongue",
        "fire", "water", "snow", "cloud", "mountain", "rain", "wind",
        "thunder", "ocean", "river", "leaf", "rock", "sand", "earth", "volcano",
        "red", "blue", "green", "yellow", "orange", "purple", "pink",
        "white", "black", "brown",
    ]
    items = []
    for w in words:
        items.append({
            "filename": w.replace(" ", "-") + ".mp3",
            "speech": w,
            "context": "",
            "lang": "en",
        })
    return items


# アプリ定義
APPS = {
    "dots": {
        "label": "ドッツカード",
        "output_dir": "dots",
        "get_items": get_dots_items,
    },
    "dots-math": {
        "label": "ドッツ計算",
        "output_dir": "dots-math",
        "get_items": get_dots_math_items,
    },
    "hiragana-flash": {
        "label": "ひらがなフラッシュ",
        "output_dir": "hiragana-flash",
        "get_items": get_hiragana_flash_items,
    },
    "english-flash": {
        "label": "英語フラッシュ",
        "output_dir": "english-flash",
        "get_items": get_english_flash_items,
    },
}


# --- ユーティリティ ---

def pcm_to_audio_segment(pcm_data: bytes, sample_rate: int = 24000) -> AudioSegment:
    """PCM (16-bit mono) を AudioSegment に変換。"""
    wav_buffer = io.BytesIO()
    with wave.open(wav_buffer, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_data)
    wav_buffer.seek(0)
    return AudioSegment.from_wav(wav_buffer)


def export_mp3(segment: AudioSegment) -> bytes:
    """AudioSegment を MP3 バイト列に変換。"""
    buf = io.BytesIO()
    segment.export(buf, format="mp3", bitrate="128k")
    return buf.getvalue()


def generate_speech(client: genai.Client, text: str, voice_name: str, model: str) -> bytes:
    """Gemini TTS で音声を生成し、PCM バイト列を返す。"""
    response = client.models.generate_content(
        model=model,
        contents=text,
        config=types.GenerateContentConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name=voice_name,
                    )
                )
            ),
        ),
    )
    if not response.candidates:
        raise RuntimeError(f"Empty candidates. prompt_feedback={response.prompt_feedback}")
    candidate = response.candidates[0]
    if candidate.finish_reason and candidate.finish_reason.name not in ("STOP", "MAX_TOKENS"):
        raise RuntimeError(f"Blocked: finish_reason={candidate.finish_reason}")
    if not candidate.content or not candidate.content.parts:
        raise RuntimeError(
            f"No content returned. finish_reason={candidate.finish_reason}, "
            f"safety_ratings={candidate.safety_ratings}"
        )
    return candidate.content.parts[0].inline_data.data


def build_batch_prompt_ja(batch_items: list) -> str:
    """日本語バッチ用のプロンプトを構築。"""
    lines = []
    for i, item in enumerate(batch_items, 1):
        ctx = f"（{item['context']}）" if item["context"] else ""
        lines.append(f"{i}. 「{item['speech']}」{ctx}")
    word_list = "\n".join(lines)
    return (
        f"子供に語りかけるように、以下の{len(batch_items)}個のフレーズを"
        f"1つずつ順番に、はっきりと日本語で読んでください。\n"
        f"各フレーズの間には3秒の沈黙を入れてください。\n"
        f"番号や余計な言葉は加えず、指定されたフレーズのみ読んでください。\n\n"
        f"{word_list}"
    )


def build_batch_prompt_en(batch_items: list) -> str:
    """英語バッチ用のプロンプトを構築。"""
    lines = []
    for i, item in enumerate(batch_items, 1):
        lines.append(f'{i}. "{item["speech"]}"')
    word_list = "\n".join(lines)
    return (
        f"Speak clearly and cheerfully for a child learning English.\n"
        f"Say each of the following {len(batch_items)} words one at a time, in order.\n"
        f"Put 3 seconds of silence between each word.\n"
        f"Do not add numbers, explanations, or any extra words.\n\n"
        f"{word_list}"
    )


def split_audio_segments(audio: AudioSegment, expected_count: int) -> list[AudioSegment] | None:
    """音声を無音区間で分割。期待数と一致しなければ None を返す。"""
    segments = split_on_silence(
        audio,
        min_silence_len=SILENCE_MIN_LEN,
        silence_thresh=SILENCE_THRESH,
        keep_silence=SILENCE_KEEP,
    )
    if len(segments) == expected_count:
        return segments

    # 閾値を調整してリトライ
    for thresh_adj in [-4, -8, 4, 8]:
        for len_adj in [0, -200, 200]:
            adjusted_thresh = SILENCE_THRESH + thresh_adj
            adjusted_len = max(300, SILENCE_MIN_LEN + len_adj)
            segments = split_on_silence(
                audio,
                min_silence_len=adjusted_len,
                silence_thresh=adjusted_thresh,
                keep_silence=SILENCE_KEEP,
            )
            if len(segments) == expected_count:
                return segments

    return None


def format_eta(seconds: float) -> str:
    m, s = divmod(int(seconds), 60)
    if m > 0:
        return f"{m}m {s}s"
    return f"{s}s"


# --- メイン処理 ---

def main():
    parser = argparse.ArgumentParser(
        description="Gemini TTS 音声生成（バッチ方式・無料枠対応）"
    )
    parser.add_argument("--app", choices=list(APPS.keys()),
                        help="特定のアプリのみ生成")
    parser.add_argument("--force", action="store_true",
                        help="既存ファイルを上書き")
    parser.add_argument("--voice-ja", default=DEFAULT_VOICE_JA,
                        help=f"日本語ボイス (default: {DEFAULT_VOICE_JA})")
    parser.add_argument("--voice-en", default=DEFAULT_VOICE_EN,
                        help=f"英語ボイス (default: {DEFAULT_VOICE_EN})")
    parser.add_argument("--model", default=MODEL,
                        help=f"使用モデル (default: {MODEL})")
    parser.add_argument("--delay", type=float, default=DEFAULT_DELAY,
                        help=f"リクエスト間隔・秒 (default: {DEFAULT_DELAY})")
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE,
                        help=f"1回のAPIで生成する単語数 (default: {DEFAULT_BATCH_SIZE})")
    parser.add_argument("--max-requests", type=int, default=DEFAULT_MAX_REQUESTS,
                        help=f"最大APIリクエスト数 (default: {DEFAULT_MAX_REQUESTS})")
    args = parser.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY 環境変数を設定してください")
        print("  取得: https://aistudio.google.com/apikey")
        print("  設定: $env:GEMINI_API_KEY='your-key'  (PowerShell)")
        sys.exit(1)

    model = args.model
    client = genai.Client(api_key=api_key)

    # 全アイテム収集
    app_ids = [args.app] if args.app else list(APPS.keys())
    all_items = []
    for app_id in app_ids:
        app = APPS[app_id]
        output_dir = os.path.join(AUDIO_BASE_DIR, app["output_dir"])
        os.makedirs(output_dir, exist_ok=True)
        for item in app["get_items"]():
            all_items.append((app_id, output_dir, item))

    # 未生成のみ抽出
    pending = []
    skipped = 0
    for app_id, output_dir, item in all_items:
        filepath = os.path.join(output_dir, item["filename"])
        if os.path.exists(filepath) and not args.force:
            skipped += 1
        else:
            pending.append((app_id, output_dir, item))

    # バッチに分割（同一言語でグループ化）
    # 言語が混在するバッチは避ける
    batches = []  # [(app_id, output_dir, [items...])]
    i = 0
    while i < len(pending):
        batch_items = []
        app_id, output_dir, first_item = pending[i]
        lang = first_item["lang"]
        batch_items.append(first_item)
        j = i + 1
        while j < len(pending) and len(batch_items) < args.batch_size:
            _, _, next_item = pending[j]
            if next_item["lang"] == lang:
                batch_items.append(next_item)
                j += 1
            else:
                break
        batches.append((app_id, output_dir, lang, batch_items))
        i = j

    # 上限適用
    batches_to_run = batches[:args.max_requests]
    items_in_run = sum(len(b[3]) for b in batches_to_run)
    items_deferred = sum(len(b[3]) for b in batches[args.max_requests:])

    print(f"Gemini TTS 音声生成（バッチモード）")
    print(f"{'='*60}")
    print(f"  モデル       : {model}")
    print(f"  日本語ボイス : {args.voice_ja}")
    print(f"  英語ボイス   : {args.voice_en}")
    print(f"  対象アプリ   : {', '.join(app_ids)}")
    print(f"  バッチサイズ : {args.batch_size}単語/リクエスト")
    print(f"  リクエスト間隔: {args.delay}秒")
    print(f"{'='*60}")
    print(f"  全ファイル   : {len(all_items)}件")
    print(f"  既存スキップ : {skipped}件")
    print(f"  今回生成     : {items_in_run}件 ({len(batches_to_run)}リクエスト)")
    if items_deferred > 0:
        print(f"  次回以降     : {items_deferred}件")
    est = len(batches_to_run) * args.delay
    print(f"  推定所要時間 : 約{format_eta(est)}")
    print(f"{'='*60}")

    if not batches_to_run:
        print("\n生成対象がありません。全て生成済みです。")
        return

    generated = 0
    errors = 0
    start_time = time.time()

    for batch_idx, (app_id, output_dir, lang, batch_items) in enumerate(batches_to_run):
        filenames = [it["filename"] for it in batch_items]
        voice = args.voice_ja if lang == "ja" else args.voice_en

        # プロンプト構築
        if lang == "ja":
            prompt = build_batch_prompt_ja(batch_items)
        else:
            prompt = build_batch_prompt_en(batch_items)

        print(f"\n  バッチ {batch_idx+1}/{len(batches_to_run)} "
              f"[{APPS[app_id]['label']}] {len(batch_items)}件: "
              f"{filenames[0]}...{filenames[-1]}")

        success = False
        for attempt in range(MAX_RETRIES):
            try:
                pcm_data = generate_speech(client, prompt, voice, model)
                audio = pcm_to_audio_segment(pcm_data)
                total_dur = len(audio) / 1000
                print(f"    音声取得: {total_dur:.1f}秒 → 分割中...", end="", flush=True)

                segments = split_audio_segments(audio, len(batch_items))

                if segments is None:
                    # 分割失敗: バッチサイズ=1にフォールバック
                    actual = len(split_on_silence(audio,
                                                  min_silence_len=SILENCE_MIN_LEN,
                                                  silence_thresh=SILENCE_THRESH,
                                                  keep_silence=SILENCE_KEEP))
                    print(f" 分割失敗（期待{len(batch_items)}個, 実際{actual}個）")
                    print(f"    → 個別生成にフォールバック")

                    for item in batch_items:
                        filepath = os.path.join(output_dir, item["filename"])
                        if lang == "ja":
                            ctx = f"（{item['context']}）" if item["context"] else ""
                            single_prompt = (
                                f"子供に語りかけるように、はっきりと日本語で読んでください。"
                                f"余計な言葉は加えないでください{ctx}：「{item['speech']}」"
                            )
                        else:
                            single_prompt = (
                                f'Speak clearly and cheerfully for a child. '
                                f'Say only this word: "{item["speech"]}"'
                            )
                        try:
                            pcm = generate_speech(client, single_prompt, voice, model)
                            seg = pcm_to_audio_segment(pcm)
                            mp3 = export_mp3(seg)
                            with open(filepath, "wb") as f:
                                f.write(mp3)
                            kb = len(mp3) / 1024
                            print(f"      {item['filename']} -> OK ({kb:.1f}KB)")
                            generated += 1
                            time.sleep(args.delay)
                        except Exception as e2:
                            print(f"      {item['filename']} -> ERROR: {e2}")
                            errors += 1
                    success = True
                    break

                # 分割成功
                print(f" OK ({len(segments)}セグメント)")
                for seg, item in zip(segments, batch_items):
                    filepath = os.path.join(output_dir, item["filename"])
                    mp3_data = export_mp3(seg)
                    with open(filepath, "wb") as f:
                        f.write(mp3_data)
                    kb = len(mp3_data) / 1024
                    dur = len(seg) / 1000
                    print(f"      {item['filename']} ({dur:.1f}s, {kb:.1f}KB)")
                    generated += 1
                success = True
                break

            except Exception as e:
                err_str = str(e)
                if "429" in err_str or "rate" in err_str.lower() or "quota" in err_str.lower():
                    wait = RATE_LIMIT_WAIT * (attempt + 1)
                    print(f"\n    レートリミット (attempt {attempt+1}/{MAX_RETRIES})。{wait}秒待機...")
                    time.sleep(wait)
                else:
                    print(f"\n    ERROR: {e}")
                    if attempt < MAX_RETRIES - 1:
                        print(f"    リトライ ({attempt+2}/{MAX_RETRIES})...")
                        time.sleep(5)

        if not success:
            errors += len(batch_items)
            print(f"    FAILED: バッチ全体をスキップ")

        if batch_idx < len(batches_to_run) - 1:
            time.sleep(args.delay)

    elapsed = time.time() - start_time
    total_remaining = items_deferred + errors

    print(f"\n{'='*60}")
    print(f"  完了! (実行時間: {format_eta(elapsed)})")
    print(f"  生成: {generated}  エラー: {errors}  スキップ(既存): {skipped}")
    if total_remaining > 0:
        print(f"  残り: {total_remaining}件 → 再実行で続きから")
    else:
        print(f"  全ファイルの生成が完了しました!")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
