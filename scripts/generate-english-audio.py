#!/usr/bin/env python3
"""Generate MP3 files for English flashcard words using Google TTS (gTTS)."""

from gtts import gTTS
import os

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

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "edup-app", "public", "audio", "english-flash")
os.makedirs(OUTPUT_DIR, exist_ok=True)

for word in WORDS:
    filename = word.replace(" ", "-") + ".mp3"
    filepath = os.path.join(OUTPUT_DIR, filename)
    if os.path.exists(filepath):
        print(f"SKIP {filename}")
        continue
    print(f"Generating {filename}...")
    tts = gTTS(text=word, lang="en", slow=False)
    tts.save(filepath)

print(f"\nDone! Generated {len(WORDS)} audio files in {OUTPUT_DIR}")
