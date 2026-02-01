#!/usr/bin/env python3
"""Generate MP3 files for DotsCard using gTTS. Format: 'これは N です' for 1-100."""

from gtts import gTTS
import os

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "edup-app", "public", "audio", "dots")
os.makedirs(OUTPUT_DIR, exist_ok=True)

import time

for n in range(1, 101):
    filename = f"{n}.mp3"
    filepath = os.path.join(OUTPUT_DIR, filename)
    # Skip if file is already > 5KB (already generated with sentence)
    if os.path.exists(filepath) and os.path.getsize(filepath) > 5000:
        print(f"SKIP {filename}")
        continue
    text = f"これは {n} です"
    print(f"Generating {filename} ({text})...")
    tts = gTTS(text=text, lang="ja", slow=False)
    tts.save(filepath)
    time.sleep(0.5)

print(f"\nDone! Generated 100 audio files in {OUTPUT_DIR}")
