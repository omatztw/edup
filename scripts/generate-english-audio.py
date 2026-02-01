#!/usr/bin/env python3
"""Generate MP3 files for English flashcard words using Google TTS (gTTS)."""

from gtts import gTTS
import os

WORDS = [
    # 動物
    "dog", "cat", "bird", "fish", "rabbit", "bear", "elephant", "lion",
    "monkey", "pig", "cow", "horse", "sheep", "chicken", "duck", "frog",
    "turtle", "penguin", "whale", "butterfly", "giraffe", "zebra", "snake",
    "owl", "dolphin",
    # 食べ物
    "apple", "banana", "orange", "grape", "strawberry", "watermelon",
    "peach", "cherry", "bread", "rice", "egg", "milk", "cake", "cookie",
    "ice cream", "pizza", "tomato", "corn", "carrot", "lemon",
    "chocolate", "cheese", "donut", "pineapple", "mushroom",
    # もの
    "car", "bus", "train", "airplane", "bicycle", "boat", "rocket",
    "star", "sun", "moon", "rainbow", "flower", "tree", "house", "book",
    "pencil", "clock", "umbrella", "hat", "shoe", "key", "bell", "ball",
    "guitar", "camera",
    # からだ
    "eye", "ear", "hand", "foot", "heart", "nose", "mouth", "tooth",
    "leg", "bone", "brain", "muscle", "finger", "face", "tongue",
    # しぜん
    "fire", "water", "snow", "cloud", "mountain", "rain", "wind",
    "thunder", "ocean", "river", "leaf", "rock", "sand", "earth", "volcano",
    # いろ
    "red", "blue", "green", "yellow", "orange", "purple", "pink",
    "white", "black", "brown",
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
