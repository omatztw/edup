#!/usr/bin/env python3
"""Generate audio files for dots-card-math app using gTTS.

Generates:
  - public/audio/dots-math/plus.mp3   ("たす")
  - public/audio/dots-math/minus.mp3  ("ひく")
  - public/audio/dots-math/wa.mp3     ("は")
  - public/audio/dots-math/{1-100}.mp3 (numbers without "これは〜です" wrapper)
"""

import os
import time
from gtts import gTTS

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "audio", "dots-math")
os.makedirs(OUT_DIR, exist_ok=True)

# Operator words
operators = {
    "plus": "たす",
    "minus": "ひく",
    "wa": "は",
}

for filename, text in operators.items():
    path = os.path.join(OUT_DIR, f"{filename}.mp3")
    if os.path.exists(path):
        print(f"Skip (exists): {path}")
        continue
    print(f"Generating: {filename}.mp3 -> '{text}'")
    tts = gTTS(text=text, lang="ja")
    tts.save(path)
    time.sleep(0.5)

# Numbers 1-100 (just the number, no wrapper sentence)
for n in range(1, 101):
    path = os.path.join(OUT_DIR, f"{n}.mp3")
    if os.path.exists(path):
        print(f"Skip (exists): {path}")
        continue
    text = str(n)
    print(f"Generating: {n}.mp3 -> '{text}'")
    tts = gTTS(text=text, lang="ja")
    tts.save(path)
    time.sleep(0.5)

print("Done!")
