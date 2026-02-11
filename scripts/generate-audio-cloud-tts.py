#!/usr/bin/env python3
"""Google Cloud Text-to-Speech API で全アプリの音声ファイル(MP3)を生成。

Gemini TTSと違い、専用TTSエンジンなので:
  - 同じ入力 → 常に同じ出力（安定）
  - 余計な発話なし
  - バッチ＋分割不要（1単語1リクエスト）
  - 無料枠: 月100万文字（Neural2）→ 全414件余裕

依存ライブラリ不要（Python標準ライブラリのみ）。

使い方:
  # APIキーを取得: https://console.cloud.google.com/apis/credentials
  # Cloud Text-to-Speech API を有効化: https://console.cloud.google.com/apis/library/texttospeech.googleapis.com

  # 全アプリの音声を生成
  GOOGLE_API_KEY=your-key python scripts/generate-audio-cloud-tts.py

  # 特定のアプリのみ
  python scripts/generate-audio-cloud-tts.py --app hiragana-flash

  # 既存ファイルを上書き
  python scripts/generate-audio-cloud-tts.py --force

  # ボイスを変更
  python scripts/generate-audio-cloud-tts.py --voice-ja ja-JP-Neural2-B --voice-en en-US-Neural2-F

日本語ボイス（Neural2）:
  ja-JP-Neural2-B (男性), ja-JP-Neural2-C (女性), ja-JP-Neural2-D (男性)

英語ボイス（Neural2）:
  en-US-Neural2-A (男性), en-US-Neural2-C (女性), en-US-Neural2-F (女性),
  en-US-Neural2-G (女性), en-US-Neural2-H (女性), en-US-Neural2-I (男性)
"""

import argparse
import base64
import json
import os
import sys
import time
import urllib.request
import urllib.error

# --- 定数 ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
AUDIO_BASE_DIR = os.path.join(SCRIPT_DIR, "..", "edup-app", "public", "audio")

# DEFAULT_VOICE_JA = "ja-JP-Neural2-C"   # 女性、明瞭
DEFAULT_VOICE_JA = "ja-JP-Chirp3-HD-Callirrhoe"   # 女性、明瞭
DEFAULT_VOICE_EN = "en-US-Neural2-F"    # 女性、明瞭
DEFAULT_SPEAKING_RATE_JA = 0.9          # やや遅め（子供向け）
DEFAULT_SPEAKING_RATE_EN = 0.9
DEFAULT_DELAY = 0.1                     # リクエスト間隔（秒）
TTS_API_URL = "https://texttospeech.googleapis.com/v1/text:synthesize"


# --- 各アプリの音声データ定義 ---

def get_dots_items():
    """ドッツカード: 「これは N です」(1-100)"""
    items = []
    for n in range(1, 101):
        items.append({
            "filename": f"{n}.mp3",
            "text": f"これは{n}です",
            "lang": "ja",
        })
    return items


def get_dots_math_items():
    """ドッツ計算: 演算子 + 数字(1-100)"""
    items = []
    operators = [("plus.mp3", "たす"), ("minus.mp3", "ひく"), ("wa.mp3", "わ")]
    for filename, text in operators:
        items.append({"filename": filename, "text": text, "lang": "ja"})
    for n in range(1, 101):
        items.append({"filename": f"{n}.mp3", "text": str(n), "lang": "ja"})
    return items


def get_hiragana_flash_items():
    """ひらがなフラッシュ: 日本語単語
    3つ組: (ファイル名用ひらがな, 表示用漢字, TTS用テキスト)
    TTS用テキストは漢字で正しく読めるものは漢字、
    難読漢字・誤読されやすいものはカタカナ/ひらがなを使用。
    """
    data = [
        # あ行
        ("あり", "蟻", "蟻"), ("あめ", "飴", "飴"), ("あひる", "家鴨", "アヒル"),
        ("いぬ", "犬", "犬"), ("いちご", "苺", "苺"), ("いるか", "海豚", "イルカ"),
        ("うし", "牛", "うし"), ("うさぎ", "兎", "ウサギ"), ("うみ", "海", "海"),
        ("えび", "海老", "海老"), ("えんぴつ", "鉛筆", "鉛筆"),
        ("おに", "鬼", "おに"), ("おばけ", "お化け", "お化け"),
        # か行
        ("かに", "蟹", "カニ"), ("かさ", "傘", "傘"), ("かめ", "亀", "亀"),
        ("きつね", "狐", "狐"), ("きのこ", "茸", "キノコ"),
        ("くま", "熊", "熊"), ("くじら", "鯨", "鯨"), ("くるま", "車", "車"),
        ("けむし", "毛虫", "毛虫"), ("けーき", "ケーキ", "ケーキ"),
        ("こあら", "コアラ", "コアラ"), ("こいのぼり", "鯉のぼり", "鯉のぼり"),
        # さ行
        ("さる", "猿", "猿"), ("さかな", "魚", "魚"),
        ("しか", "鹿", "鹿"), ("しんかんせん", "新幹線", "新幹線"),
        ("すいか", "西瓜", "スイカ"), ("すし", "寿司", "寿司"),
        ("せんす", "扇子", "扇子"), ("せんべい", "煎餅", "煎餅"),
        ("そら", "空", "空"), ("そり", "橇", "ソリ"),
        # た行
        ("たこ", "蛸", "蛸"), ("たいよう", "太陽", "太陽"),
        ("ちょう", "蝶", "蝶"), ("ちーず", "チーズ", "チーズ"),
        ("つき", "月", "月"), ("つばめ", "燕", "ツバメ"),
        ("てんとうむし", "天道虫", "テントウムシ"), ("てがみ", "手紙", "手紙"),
        ("とら", "虎", "虎"), ("とけい", "時計", "時計"),
        # な行
        ("なす", "茄子", "茄子"), ("なると", "鳴門", "なると"),
        ("にわとり", "鶏", "ニワトリ"), ("にじ", "虹", "虹"),
        ("ぬいぐるみ", "縫いぐるみ", "ぬいぐるみ"),
        ("ねこ", "猫", "猫"), ("ねずみ", "鼠", "ネズミ"),
        ("のり", "海苔", "ノリ"),
        # は行
        ("はな", "花", "花"), ("はち", "蜂", "蜂"),
        ("ひよこ", "雛", "ヒヨコ"), ("ひこうき", "飛行機", "飛行機"),
        ("ふくろう", "梟", "フクロウ"), ("ふね", "船", "船"),
        ("へび", "蛇", "蛇"),
        ("ほし", "星", "星"), ("ほうき", "箒", "ホウキ"),
        # ま行
        ("まめ", "豆", "豆"), ("まと", "的", "まと"),
        ("みかん", "蜜柑", "ミカン"), ("みず", "水", "みず"),
        ("むし", "虫", "虫"),
        ("め", "目", "目"), ("めだまやき", "目玉焼き", "目玉焼き"),
        ("もも", "桃", "桃"), ("もり", "森", "森"),
        # や行
        ("やま", "山", "山"), ("やきいも", "焼き芋", "焼き芋"),
        ("ゆき", "雪", "雪"), ("ゆびわ", "指輪", "指輪"),
        ("よっと", "ヨット", "ヨット"),
        # ら行
        ("らいおん", "ライオン", "ライオン"), ("らっこ", "ラッコ", "ラッコ"),
        ("りんご", "林檎", "リンゴ"), ("りす", "栗鼠", "リス"),
        ("るびー", "ルビー", "ルビー"), ("れもん", "レモン", "レモン"),
        ("ろうそく", "蝋燭", "ロウソク"), ("ろけっと", "ロケット", "ロケット"),
        # わ行
        ("わに", "鰐", "ワニ"),
        # 濁音 が行
        ("がっこう", "学校", "学校"), ("がいこつ", "骸骨", "ガイコツ"),
        ("ぎたー", "ギター", "ギター"), ("ぎゅうにゅう", "牛乳", "牛乳"),
        ("ぐー", "グー", "グー"), ("げーむ", "ゲーム", "ゲーム"),
        ("ごりら", "ゴリラ", "ゴリラ"), ("ごはん", "御飯", "ごはん"),
        # 濁音 ざ行
        ("ざりがに", "ザリガニ", "ザリガニ"),
        ("じしゃく", "磁石", "磁石"), ("じてんしゃ", "自転車", "自転車"),
        ("ずぼん", "ズボン", "ズボン"), ("ぜりー", "ゼリー", "ゼリー"),
        ("ぞう", "象", "象"),
        # 濁音 だ行
        ("だんご", "団子", "団子"),
        ("でんしゃ", "電車", "電車"), ("でんわ", "電話", "電話"),
        ("どんぐり", "団栗", "ドングリ"), ("どーなつ", "ドーナツ", "ドーナツ"),
        # 濁音 ば行
        ("ばなな", "バナナ", "バナナ"), ("ばった", "飛蝗", "バッタ"),
        ("びーだま", "ビー玉", "ビー玉"),
        ("ぶどう", "葡萄", "葡萄"), ("ぶた", "豚", "豚"),
        ("べる", "ベル", "ベル"),
        ("ぼうし", "帽子", "帽子"), ("ぼーる", "ボール", "ボール"),
        # 半濁音 ぱ行
        ("ぱんだ", "パンダ", "パンダ"), ("ぱいなっぷる", "パイナップル", "パイナップル"),
        ("ぴあの", "ピアノ", "ピアノ"), ("ぷーる", "プール", "プール"),
        ("ぺんぎん", "ペンギン", "ペンギン"),
        ("ぽすと", "ポスト", "ポスト"), ("ぽっぷこーん", "ポップコーン", "ポップコーン"),
    ]
    items = []
    for word, _kanji, tts_text in data:
        items.append({"filename": f"{word}.mp3", "text": tts_text, "lang": "ja"})
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
            "text": w,
            "lang": "en",
        })
    return items


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


def synthesize(text: str, voice_name: str, lang_code: str,
               speaking_rate: float, api_key: str) -> bytes:
    """Google Cloud TTS REST API で音声合成し、MP3バイト列を返す。"""
    url = f"{TTS_API_URL}?key={api_key}"
    body = json.dumps({
        "input": {"text": text},
        "voice": {
            "languageCode": lang_code,
            "name": voice_name,
        },
        "audioConfig": {
            "audioEncoding": "MP3",
            "speakingRate": speaking_rate,
        },
    }).encode("utf-8")

    req = urllib.request.Request(url, data=body,
                                headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())

    return base64.b64decode(data["audioContent"])


def format_eta(seconds: float) -> str:
    m, s = divmod(int(seconds), 60)
    return f"{m}m {s}s" if m > 0 else f"{s}s"


def main():
    parser = argparse.ArgumentParser(
        description="Google Cloud TTS で知育アプリの音声ファイルを生成"
    )
    parser.add_argument("--app", choices=list(APPS.keys()),
                        help="特定のアプリのみ生成")
    parser.add_argument("--force", action="store_true",
                        help="既存ファイルを上書き")
    parser.add_argument("--voice-ja", default=DEFAULT_VOICE_JA,
                        help=f"日本語ボイス (default: {DEFAULT_VOICE_JA})")
    parser.add_argument("--voice-en", default=DEFAULT_VOICE_EN,
                        help=f"英語ボイス (default: {DEFAULT_VOICE_EN})")
    parser.add_argument("--rate-ja", type=float, default=DEFAULT_SPEAKING_RATE_JA,
                        help=f"日本語の話速 (default: {DEFAULT_SPEAKING_RATE_JA})")
    parser.add_argument("--rate-en", type=float, default=DEFAULT_SPEAKING_RATE_EN,
                        help=f"英語の話速 (default: {DEFAULT_SPEAKING_RATE_EN})")
    parser.add_argument("--delay", type=float, default=DEFAULT_DELAY,
                        help=f"リクエスト間隔・秒 (default: {DEFAULT_DELAY})")
    args = parser.parse_args()

    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("Error: GOOGLE_API_KEY 環境変数を設定してください")
        print("  取得: https://console.cloud.google.com/apis/credentials")
        print("  API有効化: https://console.cloud.google.com/apis/library/texttospeech.googleapis.com")
        print("  設定: $env:GOOGLE_API_KEY='your-key'  (PowerShell)")
        sys.exit(1)

    app_ids = [args.app] if args.app else list(APPS.keys())

    # 全アイテム収集
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

    print(f"Google Cloud TTS 音声生成")
    print(f"{'='*60}")
    print(f"  日本語ボイス : {args.voice_ja} (rate={args.rate_ja})")
    print(f"  英語ボイス   : {args.voice_en} (rate={args.rate_en})")
    print(f"  対象アプリ   : {', '.join(app_ids)}")
    print(f"{'='*60}")
    print(f"  全ファイル   : {len(all_items)}件")
    print(f"  既存スキップ : {skipped}件")
    print(f"  今回生成     : {len(pending)}件")
    est = len(pending) * (args.delay + 0.3)  # API応答 ~0.3s + delay
    print(f"  推定所要時間 : 約{format_eta(est)}")
    print(f"{'='*60}")

    if not pending:
        print("\n全て生成済みです。")
        return

    generated = 0
    errors = 0
    start_time = time.time()
    current_app = None

    for idx, (app_id, output_dir, item) in enumerate(pending):
        if app_id != current_app:
            current_app = app_id
            print(f"\n--- {APPS[app_id]['label']} ({app_id}) ---")

        filepath = os.path.join(output_dir, item["filename"])
        is_ja = item["lang"] == "ja"
        voice = args.voice_ja if is_ja else args.voice_en
        lang_code = "ja-JP" if is_ja else "en-US"
        rate = args.rate_ja if is_ja else args.rate_en

        print(f"  [{idx+1}/{len(pending)}] {item['filename']} "
              f"(\"{item['text']}\")", end="", flush=True)

        try:
            mp3_data = synthesize(item["text"], voice, lang_code, rate, api_key)
            with open(filepath, "wb") as f:
                f.write(mp3_data)
            kb = len(mp3_data) / 1024
            print(f" -> OK ({kb:.1f}KB)")
            generated += 1
        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8", errors="replace")
            print(f" -> ERROR ({e.code}): {error_body}")
            errors += 1
            if e.code == 429:
                print("    レートリミット。10秒待機...")
                time.sleep(10)
        except Exception as e:
            print(f" -> ERROR: {e}")
            errors += 1

        if idx < len(pending) - 1:
            time.sleep(args.delay)

    elapsed = time.time() - start_time

    print(f"\n{'='*60}")
    print(f"  完了! (実行時間: {format_eta(elapsed)})")
    print(f"  生成: {generated}  エラー: {errors}  スキップ(既存): {skipped}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
