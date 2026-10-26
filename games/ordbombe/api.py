"""
Ordbombe - Backend API router
Fast-paced Norwegian Word Bomb party game.
Validates Norwegian words against 495,000+ official Bokmål words
and serves balanced syllable prompts.
"""

import json
import os
import random
import re
import sqlite3
from typing import Any, Dict, List, Optional, Set, Tuple

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
WORDS_FILE = os.path.join(DATA_DIR, "norwegian_words.txt")
PROMPTS_FILE = os.path.join(DATA_DIR, "prompts.json")
DB_PATH = os.path.join(os.path.dirname(BASE_DIR), "..", "data", "ordbombe.db")

_WORDS_SET: Optional[Set[str]] = None
_PROMPTS_CACHE: Optional[Dict[str, List[str]]] = None


def get_words_set() -> Set[str]:
    global _WORDS_SET
    if _WORDS_SET is None:
        if os.path.isfile(WORDS_FILE):
            with open(WORDS_FILE, "r", encoding="utf-8") as f:
                _WORDS_SET = {line.strip().lower() for line in f if line.strip()}
        else:
            _WORDS_SET = set()
    return _WORDS_SET


def get_prompts_cache() -> Dict[str, List[str]]:
    global _PROMPTS_CACHE
    if _PROMPTS_CACHE is None:
        if os.path.isfile(PROMPTS_FILE):
            with open(PROMPTS_FILE, "r", encoding="utf-8") as f:
                _PROMPTS_CACHE = json.load(f)
        else:
            _PROMPTS_CACHE = {
                "easy": ["ST", "SK", "ER", "TE", "RE", "IN", "NE", "BIL", "TAK", "LYS"],
                "medium": ["FIS", "BOK", "TID", "SOL", "BAR", "HUS", "KOR", "VIN", "MAN"],
                "hard": ["KNU", "BAM", "HJEL", "GNIS", "KVI", "PYN", "SKV", "FRØ"],
            }
    return _PROMPTS_CACHE


def init_db() -> None:
    os.makedirs(os.path.dirname(os.path.abspath(DB_PATH)), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    with conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS solo_highscores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                player_name TEXT NOT NULL,
                score INTEGER NOT NULL,
                streak INTEGER NOT NULL,
                words_count INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
    conn.close()


def check_word(word_raw: str, prompt_raw: str) -> Dict[str, Any]:
    word = (word_raw or "").strip().lower()
    prompt = (prompt_raw or "").strip().lower()

    if not prompt:
        return {"valid": False, "reason": "Mangler bokstavkombinasjon", "word": word, "prompt": prompt}

    if not word:
        return {"valid": False, "reason": "Skriv inn et ord", "word": word, "prompt": prompt}

    if len(word) < 2:
        return {"valid": False, "reason": "Ordet må ha minst 2 bokstaver", "word": word, "prompt": prompt}

    if prompt not in word:
        return {
            "valid": False,
            "reason": f"Ordet må inneholde «{prompt.upper()}»",
            "word": word,
            "prompt": prompt,
        }

    words_set = get_words_set()
    if word not in words_set:
        return {
            "valid": False,
            "reason": f"«{word}» finnes ikke i den norske ordboka",
            "word": word,
            "prompt": prompt,
        }

    # Calculate match position for nice frontend letter-highlighting
    start_idx = word.find(prompt)
    end_idx = start_idx + len(prompt)

    return {
        "valid": True,
        "reason": "Godkjent!",
        "word": word,
        "prompt": prompt,
        "highlight": {"start": start_idx, "end": end_idx},
        "length": len(word),
    }


class OrdbombeAPI:
    @staticmethod
    def handle_get(path: str, query: Dict[str, Any]) -> Optional[Tuple[int, Any]]:
        rel_path = path
        if rel_path.startswith("/api/ordbombe/"):
            rel_path = "/api/" + rel_path[len("/api/ordbombe/"):]

        if rel_path in ("/api/prompt", "/api/new-prompt"):
            diff = (query.get("difficulty", ["medium"])[0] or "medium").lower()
            prompts = get_prompts_cache()
            pool = prompts.get(diff) or prompts.get("medium") or prompts.get("easy") or ["BIL"]
            chosen = random.choice(pool)
            return 200, {
                "ok": True,
                "prompt": chosen,
                "difficulty": diff,
            }

        if rel_path == "/api/check":
            word = (query.get("word", [""])[0] or "").strip()
            prompt = (query.get("prompt", [""])[0] or "").strip()
            res = check_word(word, prompt)
            return 200, res

        if rel_path in ("/api/stats", "/api/info"):
            words_set = get_words_set()
            prompts = get_prompts_cache()
            return 200, {
                "ok": True,
                "dictionaryWordCount": len(words_set),
                "promptsCount": {
                    "easy": len(prompts.get("easy", [])),
                    "medium": len(prompts.get("medium", [])),
                    "hard": len(prompts.get("hard", [])),
                },
            }

        if rel_path in ("/api/highscore", "/api/highscores"):
            init_db()
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                "SELECT player_name, score, streak, words_count, created_at FROM solo_highscores ORDER BY score DESC LIMIT 10"
            ).fetchall()
            conn.close()
            highscores = [dict(r) for r in rows]
            return 200, {"ok": True, "highscores": highscores}

        return None

    @staticmethod
    def handle_post(path: str, body: Dict[str, Any]) -> Optional[Tuple[int, Any]]:
        rel_path = path
        if rel_path.startswith("/api/ordbombe/"):
            rel_path = "/api/" + rel_path[len("/api/ordbombe/"):]

        if rel_path == "/api/check":
            word = str(body.get("word", ""))
            prompt = str(body.get("prompt", ""))
            res = check_word(word, prompt)
            return 200, res

        if rel_path == "/api/highscore":
            name = str(body.get("playerName", "Spiller")).strip()[:24] or "Spiller"
            score = max(0, int(body.get("score", 0)))
            streak = max(0, int(body.get("streak", 0)))
            words_count = max(0, int(body.get("wordsCount", 0)))

            init_db()
            conn = sqlite3.connect(DB_PATH)
            with conn:
                conn.execute(
                    "INSERT INTO solo_highscores (player_name, score, streak, words_count) VALUES (?, ?, ?, ?)",
                    (name, score, streak, words_count),
                )
            conn.close()
            return 200, {"ok": True, "message": "Highscore lagret!"}

        return None
