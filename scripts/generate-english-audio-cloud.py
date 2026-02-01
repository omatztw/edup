#!/usr/bin/env python3
"""Generate MP3 files for English flashcard words using Google Cloud Text-to-Speech API.

Usage:
  pip install google-cloud-texttospeech
  GOOGLE_API_KEY=your-key python3 scripts/generate-english-audio-cloud.py

  # 既存ファイルを上書きしたい場合
  GOOGLE_API_KEY=your-key python3 scripts/generate-english-audio-cloud.py --force
"""

import os
import sys
import json
import urllib.request
import urllib.error

WORDS = [
    "dog", "cat", "bird", "fish", "rabbit", "bear", "elephant", "lion",
    "monkey", "pig", "cow", "horse", "sheep", "chicken", "duck", "frog",
    "turtle", "penguin", "whale", "butterfly",
    "apple", "banana", "orange", "grape", "strawberry", "watermelon",
    "peach", "cherry", "bread", "rice", "egg", "milk", "cake", "cookie",
    "ice cream", "pizza", "tomato", "corn", "carrot", "lemon",
    "car", "bus", "train", "airplane", "bicycle", "boat", "rocket",
    "star", "sun", "moon", "rainbow", "flower", "tree", "house", "book",
    "pencil", "clock", "umbrella", "hat", "shoe",
    "eye", "ear", "hand", "foot", "heart",
    "fire", "water", "snow", "cloud", "mountain",
]

# Neural2 の女性音声（明瞭で子供向け学習に適している）
VOICE_NAME = "en-US-Neural2-F"
LANGUAGE_CODE = "en-US"

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "edup-app", "public", "audio", "english-flash")


def synthesize(word: str, api_key: str) -> bytes:
    """Google Cloud TTS REST API で音声合成し、MP3バイト列を返す。"""
    url = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={api_key}"
    body = json.dumps({
        "input": {"text": word},
        "voice": {
            "languageCode": LANGUAGE_CODE,
            "name": VOICE_NAME,
        },
        "audioConfig": {
            "audioEncoding": "MP3",
            "speakingRate": 0.9,   # やや遅め
            "pitch": 1.0,
        },
    }).encode("utf-8")

    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())

    import base64
    return base64.b64decode(data["audioContent"])


def main():
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("Error: GOOGLE_API_KEY 環境変数を設定してください")
        print("  export GOOGLE_API_KEY=your-key")
        sys.exit(1)

    force = "--force" in sys.argv
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    generated = 0
    skipped = 0
    for word in WORDS:
        filename = word.replace(" ", "-") + ".mp3"
        filepath = os.path.join(OUTPUT_DIR, filename)

        if os.path.exists(filepath) and not force:
            print(f"SKIP {filename}")
            skipped += 1
            continue

        print(f"Generating {filename}...")
        try:
            audio_bytes = synthesize(word, api_key)
            with open(filepath, "wb") as f:
                f.write(audio_bytes)
            generated += 1
        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8", errors="replace")
            print(f"  ERROR ({e.code}): {error_body}")
            sys.exit(1)

    print(f"\nDone! generated={generated}, skipped={skipped}")


if __name__ == "__main__":
    main()
