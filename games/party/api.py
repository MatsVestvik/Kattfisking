"""
Party Lobby & Multi-Device Room Gateway API
Manages synchronized party rooms, live players on their own devices,
and dynamic game transitions across Ordbombe and upcoming party games.
"""

import os
import time
import random
import string
import threading
import uuid
from typing import Any, Dict, List, Optional, Tuple

from games.ordbombe.api import check_word, get_prompts_cache
from games.tegn_og_gjett.words import get_random_word_triplet, is_close_guess

# In-memory party rooms storage
_rooms: Dict[str, "PartyRoom"] = {}
_rooms_lock = threading.Lock()

# Clean room code words for easy typing on phones
CLEAN_WORDS = [
    "FEST", "BOMB", "VORS", "KATT", "QUIZ", "SMIL", "GLOS", "NTNU",
    "GULL", "HELG", "LYS", "SOL", "BUSS", "CAMP", "SPILL", "KAFFE",
    "TAKK", "HYTTE", "VIND", "FJORD", "NORD", "BROR", "VENN", "TEAM"
]

# Curated party colors (matching CharacterCreator palette, 16 distinct colors)
HEAD_COLORS = [
    "#ffd166", "#00b4d8", "#ef476f", "#06d6a0",
    "#fb8500", "#8338ec", "#ff70a6", "#a0c4ff",
    "#fadcba", "#f3c299", "#dfa27a", "#8d5b36",
    "#4a2810", "#f1f5f9", "#94a3b8", "#1e293b"
]


def extract_color_from_avatar(avatar: str) -> str:
    """Extract head color hex string from avatar string or config."""
    if not avatar:
        return "#ffd166"
    av_str = str(avatar).strip()
    if av_str.startswith("char:"):
        for part in av_str[5:].split(":"):
            if part.startswith("c_"):
                hex_val = part[2:].strip()
                if hex_val:
                    return "#" + hex_val.lower()
            elif part.startswith("c") and not part.startswith("char"):
                hex_val = part[1:].strip()
                if hex_val:
                    return "#" + hex_val.lower()
    elif av_str.startswith("{"):
        try:
            import json
            data = json.loads(av_str)
            if "headColor" in data:
                return str(data["headColor"]).lower()
        except Exception:
            pass
    elif av_str.startswith("#") and len(av_str) in (4, 7):
        return av_str.lower()
    return "#ffd166"


def replace_color_in_avatar(avatar: str, new_hex: str) -> str:
    """Return avatar string with updated head color."""
    clean_hex = new_hex.lstrip("#").lower()
    if not avatar or not str(avatar).startswith("char:"):
        return f"char:h1:c_{clean_hex}:r1:e1:m1"
    parts = str(avatar)[5:].split(":")
    new_parts = []
    has_color = False
    for p in parts:
        if p.startswith("c_") or (p.startswith("c") and not p.startswith("char")):
            new_parts.append(f"c_{clean_hex}")
            has_color = True
        else:
            new_parts.append(p)
    if not has_color:
        new_parts.insert(1, f"c_{clean_hex}")
    return "char:" + ":".join(new_parts)


def get_available_party_color(taken_colors: set, preferred_color: Optional[str] = None) -> str:
    """Find a unique color in the party room not already taken by any player."""
    taken_lower = {str(c).lower() for c in taken_colors if c}
    if preferred_color:
        pref = str(preferred_color).lower()
        if pref in [c.lower() for c in HEAD_COLORS] and pref not in taken_lower:
            return pref
    for c in HEAD_COLORS:
        if c.lower() not in taken_lower:
            return c.lower()
    # If room exceeds 16 players, pick cycled fallback
    return HEAD_COLORS[len(taken_lower) % len(HEAD_COLORS)].lower()


class PartyRoom:
    def __init__(self, code: str, host_token: str, host_name: str, host_avatar: str):
        self.code = code
        self.host_token = host_token
        self.created_at = time.time()
        self.last_active = time.time()
        self.current_game: Optional[str] = None  # None (lobby), "ordbombe", "tegn_og_gjett", etc.
        self.game_state: Dict[str, Any] = {}
        self.players: Dict[str, Dict[str, Any]] = {}
        self.version = 1
        self.lock = threading.RLock()

        # Add initial host player with unique color
        host_id = f"p_{uuid.uuid4().hex[:8]}"
        self.host_id = host_id
        pref_color = extract_color_from_avatar(host_avatar)
        host_color = get_available_party_color(set(), pref_color)
        final_host_avatar = replace_color_in_avatar(host_avatar, host_color)

        self.players[host_id] = {
            "id": host_id,
            "name": host_name[:18].strip() or "Vert",
            "avatar": final_host_avatar,
            "color": host_color,
            "is_host": True,
            "is_ready": True,
            "score": 0,
            "lives": 3,
            "eliminated": False,
            "words_count": 0,
            "last_seen": time.time(),
        }

    def touch(self) -> None:
        self.last_active = time.time()

    def bump(self) -> None:
        self.version += 1
        self.touch()

    def get_public_state(self, client_player_id: Optional[str] = None) -> Dict[str, Any]:
        with self.lock:
            # Tick active game if running
            if self.current_game == "ordbombe":
                self._tick_ordbombe()
            elif self.current_game == "tegn_og_gjett":
                self._tick_tegn_og_gjett()

            players_list = []
            for p in self.players.values():
                players_list.append({
                    "id": p["id"],
                    "name": p["name"],
                    "avatar": p["avatar"],
                    "color": p["color"],
                    "isHost": p["is_host"],
                    "isReady": p["is_ready"],
                    "score": p["score"],
                    "lives": p["lives"],
                    "eliminated": p["eliminated"],
                    "wordsCount": p["words_count"],
                })

            client_player = self.players.get(client_player_id or "")

            if self.current_game == "tegn_og_gjett":
                effective_game_state = self._get_tegn_og_gjett_public_state(client_player_id)
            else:
                effective_game_state = self.game_state

            return {
                "ok": True,
                "roomCode": self.code,
                "currentGame": self.current_game,
                "version": self.version,
                "players": players_list,
                "playerCount": len(players_list),
                "isHost": bool(client_player and client_player.get("is_host")),
                "me": client_player,
                "gameState": effective_game_state,
                "serverTime": time.time(),
            }

    # --- ORDBOMBE ENGINE ---

    def start_ordbombe(self, settings: Dict[str, Any]) -> None:
        with self.lock:
            self.current_game = "ordbombe"
            diff = (settings.get("difficulty") or "medium").lower()
            turn_sec = float(settings.get("turnDuration") or 6.0)

            prompts_cache = get_prompts_cache()
            pool = prompts_cache.get(diff) or prompts_cache.get("medium") or ["BIL"]
            initial_prompt = random.choice(pool).upper()

            # Reset players lives and statuses
            active_ids = []
            for p in self.players.values():
                p["lives"] = 3
                p["eliminated"] = False
                p["words_count"] = 0
                p["score"] = 0
                active_ids.append(p["id"])

            if not active_ids:
                return

            random.shuffle(active_ids)

            self.game_state = {
                "status": "playing",  # "playing", "exploded", "game_over"
                "difficulty": diff,
                "turn_duration": turn_sec,
                "active_player_ids": active_ids,
                "current_player_idx": 0,
                "active_player_id": active_ids[0],
                "active_player_name": self.players[active_ids[0]]["name"],
                "prompt": initial_prompt,
                "current_typing": "",
                "used_words": [],
                "turn_start_time": time.time(),
                "time_remaining": turn_sec,
                "round_number": 1,
                "last_event": {
                    "type": "game_started",
                    "text": f"Ordbombe har startet! Første stavelse: {initial_prompt}",
                    "timestamp": time.time(),
                },
                "winner": None,
            }
            self.bump()

    def submit_ordbombe_word(self, player_id: str, word_raw: str) -> Dict[str, Any]:
        with self.lock:
            if self.current_game != "ordbombe":
                return {"ok": False, "error": "Ordbombe er ikke aktivt"}

            if self.game_state.get("status") != "playing":
                return {"ok": False, "error": "Runden er ikke aktiv nå"}

            # Verify it's this player's turn
            if self.game_state.get("active_player_id") != player_id:
                curr_name = self.game_state.get("active_player_name", "en annen spiller")
                return {"ok": False, "error": f"Det er {curr_name} sin tur!"}

            prompt = self.game_state.get("prompt", "")
            word = (word_raw or "").strip().lower()

            # Check if word has been used in this game
            used = self.game_state.setdefault("used_words", [])
            if word in used:
                return {"ok": False, "valid": False, "reason": f"«{word}» er allerede brukt i denne runden!"}

            # Validate against Norwegian Bokmål dictionary
            val_res = check_word(word, prompt)
            if not val_res.get("valid"):
                return {"ok": True, "valid": False, "reason": val_res.get("reason", "Ugyldig ord")}

            # Word is VALID!
            used.append(word)
            player = self.players.get(player_id)
            if player:
                player["words_count"] += 1
                player["score"] += len(word) * 10

            # Advance to next living player
            active_ids = self.game_state["active_player_ids"]
            living_ids = [pid for pid in active_ids if not self.players.get(pid, {}).get("eliminated")]

            if len(living_ids) <= 1 and len(active_ids) > 1:
                # Winner!
                winner_id = living_ids[0] if living_ids else player_id
                winner = self.players.get(winner_id)
                self.game_state["status"] = "game_over"
                self.game_state["winner"] = winner
                self.game_state["last_event"] = {
                    "type": "game_over",
                    "text": f"👑 {winner['name']} vant Ordbombe!",
                    "winner": winner,
                    "timestamp": time.time(),
                }
                self.bump()
                return {"ok": True, "valid": True, "reason": "Godkjent!", "word": word}

            # Pick next player
            curr_idx = self.game_state.get("current_player_idx", 0)
            next_idx = (curr_idx + 1) % len(active_ids)
            attempts = 0
            while self.players.get(active_ids[next_idx], {}).get("eliminated") and attempts < len(active_ids):
                next_idx = (next_idx + 1) % len(active_ids)
                attempts += 1

            next_player_id = active_ids[next_idx]
            next_player = self.players.get(next_player_id)

            # Pick new prompt
            diff = self.game_state.get("difficulty", "medium")
            prompts_cache = get_prompts_cache()
            pool = prompts_cache.get(diff) or prompts_cache.get("medium") or ["BIL"]
            new_prompt = random.choice(pool).upper()

            self.game_state["current_player_idx"] = next_idx
            self.game_state["active_player_id"] = next_player_id
            self.game_state["active_player_name"] = next_player["name"] if next_player else "Ukjent"
            self.game_state["prompt"] = new_prompt
            self.game_state["current_typing"] = ""
            self.game_state["turn_start_time"] = time.time()
            self.game_state["time_remaining"] = self.game_state["turn_duration"]
            self.game_state["last_event"] = {
                "type": "word_accepted",
                "text": f"✓ {player['name']} klarte «{word}»! Bomben sendt til {self.game_state['active_player_name']}",
                "player_name": player["name"],
                "word": word,
                "next_player_name": self.game_state["active_player_name"],
                "timestamp": time.time(),
            }

            self.bump()
            return {"ok": True, "valid": True, "reason": "Godkjent!", "word": word}

    def _tick_ordbombe(self) -> None:
        # Check turn expiration
        status = self.game_state.get("status")
        now = time.time()

        if status == "playing":
            elapsed = now - self.game_state.get("turn_start_time", now)
            duration = self.game_state.get("turn_duration", 6.0)
            remaining = max(0.0, duration - elapsed)
            self.game_state["time_remaining"] = round(remaining, 1)

            if elapsed >= duration:
                # BOOM! Active player lost a life
                active_id = self.game_state.get("active_player_id")
                player = self.players.get(active_id or "")

                if player:
                    player["lives"] = max(0, player["lives"] - 1)
                    if player["lives"] <= 0:
                        player["eliminated"] = True

                active_ids = self.game_state.get("active_player_ids", [])
                living_ids = [pid for pid in active_ids if not self.players.get(pid, {}).get("eliminated")]

                if len(living_ids) <= 1 and len(active_ids) > 1:
                    # Winner exists!
                    winner_id = living_ids[0] if living_ids else active_id
                    winner = self.players.get(winner_id or "")
                    self.game_state["status"] = "game_over"
                    self.game_state["winner"] = winner
                    self.game_state["last_event"] = {
                        "type": "game_over",
                        "text": f"💥 Bomben smalt! 👑 {winner['name'] if winner else 'Vinner'} overlevde og vant!",
                        "loser": player["name"] if player else "Spiller",
                        "winner": winner,
                        "timestamp": now,
                    }
                    self.bump()
                    return

                # Temporary explosion pause for animation
                self.game_state["status"] = "exploded"
                self.game_state["current_typing"] = ""
                self.game_state["explosion_until"] = now + 2.4
                self.game_state["last_event"] = {
                    "type": "explosion",
                    "text": f"💥 BOOM! Bomben eksploderte hos {player['name'] if player else 'spiller'}!",
                    "player_name": player["name"] if player else "Spiller",
                    "lives_left": player["lives"] if player else 0,
                    "timestamp": now,
                }
                self.bump()

        elif status == "exploded":
            if now >= self.game_state.get("explosion_until", 0):
                # Explosion pause finished -> pass to next living player
                active_ids = self.game_state.get("active_player_ids", [])
                curr_idx = self.game_state.get("current_player_idx", 0)
                next_idx = (curr_idx + 1) % len(active_ids)
                attempts = 0
                while self.players.get(active_ids[next_idx], {}).get("eliminated") and attempts < len(active_ids):
                    next_idx = (next_idx + 1) % len(active_ids)
                    attempts += 1

                next_player_id = active_ids[next_idx]
                next_player = self.players.get(next_player_id)

                diff = self.game_state.get("difficulty", "medium")
                prompts_cache = get_prompts_cache()
                pool = prompts_cache.get(diff) or prompts_cache.get("medium") or ["BIL"]
                new_prompt = random.choice(pool).upper()

                self.game_state["status"] = "playing"
                self.game_state["current_player_idx"] = next_idx
                self.game_state["active_player_id"] = next_player_id
                self.game_state["active_player_name"] = next_player["name"] if next_player else "Ukjent"
                self.game_state["prompt"] = new_prompt
                self.game_state["current_typing"] = ""
                self.game_state["turn_start_time"] = now
                self.game_state["time_remaining"] = self.game_state["turn_duration"]
                self.game_state["last_event"] = {
                    "type": "turn_changed",
                    "text": f"Ny runde! Bomben er hos {self.game_state['active_player_name']}",
                    "next_player_name": self.game_state["active_player_name"],
                    "timestamp": now,
                }
                self.bump()

    def set_ordbombe_typing(self, player_id: str, text: str) -> bool:
        with self.lock:
            if self.current_game != "ordbombe":
                return False
            if self.game_state.get("active_player_id") != player_id:
                return False
            clean_text = (text or "")[:40]
            if self.game_state.get("current_typing") != clean_text:
                self.game_state["current_typing"] = clean_text
                self.bump()
            return True

    # --- TEGN & GJETT ENGINE (skribbl.io style) ---

    def start_tegn_og_gjett(self, settings: Dict[str, Any]) -> None:
        with self.lock:
            self.current_game = "tegn_og_gjett"
            draw_time = int(settings.get("drawTime") or 80)
            rounds = int(settings.get("rounds") or 3)

            active_ids = list(self.players.keys())
            if not active_ids:
                return

            random.shuffle(active_ids)
            for p in self.players.values():
                p["score"] = 0
                p["lives"] = 3
                p["eliminated"] = False

            triplet = get_random_word_triplet()
            now = time.time()
            first_drawer_id = active_ids[0]
            first_drawer_name = self.players[first_drawer_id]["name"]

            self.game_state = {
                "status": "playing",
                "total_rounds": rounds,
                "current_round": 1,
                "turn_order": active_ids,
                "turn_idx": 0,
                "active_drawer_id": first_drawer_id,
                "active_drawer_name": first_drawer_name,
                "turn_state": "choosing",  # "choosing", "drawing", "round_recap", "game_over"
                "draw_time": draw_time,
                "time_remaining": 15.0,
                "choice_deadline": now + 15.0,
                "word_choices": triplet,
                "secret_word": "",
                "category": "",
                "revealed_indices": [],
                "draw_actions": [],
                "next_action_id": 1,
                "guessed_player_ids": [],
                "turn_start_time": now,
                "chat_messages": [
                    {
                        "id": 1,
                        "type": "system",
                        "sender": "System",
                        "text": f"🎨 Velkommen til Tegn & Gjett! Runde 1 av {rounds}. {first_drawer_name} velger et ord…",
                        "timestamp": now,
                    }
                ],
                "next_msg_id": 2,
                "winner": None,
                "podium": [],
            }
            self.bump()

    def _get_tegn_og_gjett_public_state(self, client_player_id: Optional[str]) -> Dict[str, Any]:
        gs = dict(self.game_state)
        active_drawer_id = gs.get("active_drawer_id")
        turn_state = gs.get("turn_state", "choosing")
        secret_word = gs.get("secret_word") or ""
        revealed = set(gs.get("revealed_indices") or [])
        guessed_ids = set(gs.get("guessed_player_ids") or [])

        is_drawer = bool(client_player_id and client_player_id == active_drawer_id)
        has_guessed = bool(client_player_id and client_player_id in guessed_ids)
        is_revealed_phase = turn_state in ("round_recap", "game_over")

        # Word masking security
        if is_drawer or has_guessed or is_revealed_phase:
            word_for_client = secret_word
            masked_word = None
        else:
            word_for_client = None
            masked_chars = []
            for idx, ch in enumerate(secret_word):
                if ch == " ":
                    masked_chars.append("  ")
                elif ch == "-":
                    masked_chars.append("-")
                elif idx in revealed:
                    masked_chars.append(ch.upper())
                else:
                    masked_chars.append("_")
            masked_word = " ".join(masked_chars)

        if is_drawer and turn_state == "choosing":
            choices = gs.get("word_choices", [])
        else:
            choices = []

        gs["word"] = word_for_client
        gs["masked_word"] = masked_word
        gs["word_choices"] = choices
        gs["is_drawer"] = is_drawer
        gs["has_guessed"] = has_guessed
        if "secret_word" in gs and not (is_drawer or has_guessed or is_revealed_phase):
            del gs["secret_word"]

        # Only send last 50 chat messages to keep payload light
        if "chat_messages" in gs:
            gs["chat_messages"] = gs["chat_messages"][-50:]

        return gs

    def _start_drawing_turn(self, word: str, category: str) -> None:
        now = time.time()
        gs = self.game_state
        gs["turn_state"] = "drawing"
        gs["secret_word"] = word
        gs["category"] = category
        gs["turn_start_time"] = now
        gs["time_remaining"] = float(gs.get("draw_time", 80))
        gs["revealed_indices"] = []
        gs["guessed_player_ids"] = []
        gs["draw_actions"] = []
        gs["next_action_id"] = 1

        drawer_name = gs.get("active_drawer_name", "Tegneren")
        msg_id = gs.get("next_msg_id", 1)
        letter_count = len(word.replace(" ", "").replace("-", ""))
        gs["chat_messages"].append({
            "id": msg_id,
            "type": "system",
            "sender": "System",
            "text": f"🎨 {drawer_name} har valgt et ord ({letter_count} bokstaver, {category})! Begynn å gjette!",
            "timestamp": now,
        })
        gs["next_msg_id"] = msg_id + 1
        self.bump()

    def _end_drawing_turn(self, reason: str = "time_up") -> None:
        now = time.time()
        gs = self.game_state
        gs["turn_state"] = "round_recap"
        gs["recap_until"] = now + 4.5

        word = gs.get("secret_word", "").upper()
        guessed_count = len(gs.get("guessed_player_ids", []))
        msg_id = gs.get("next_msg_id", 1)

        if reason == "all_guessed":
            text = f"🌟 Fantastisk! Alle gjettet ordet: «{word}»!"
        else:
            text = f"⏰ Tiden er ute! Ordet var «{word}». {guessed_count} spiller(e) gjettet riktig."

        gs["chat_messages"].append({
            "id": msg_id,
            "type": "system_highlight",
            "sender": "System",
            "text": text,
            "timestamp": now,
        })
        gs["next_msg_id"] = msg_id + 1
        self.bump()

    def _advance_turn(self) -> None:
        now = time.time()
        gs = self.game_state
        turn_order = [pid for pid in gs.get("turn_order", []) if pid in self.players]
        if not turn_order:
            turn_order = list(self.players.keys())
        gs["turn_order"] = turn_order

        if not turn_order:
            self._end_tegn_og_gjett_game()
            return

        curr_turn_idx = gs.get("turn_idx", 0)
        next_turn_idx = curr_turn_idx + 1
        total_rounds = gs.get("total_rounds", 3)
        curr_round = gs.get("current_round", 1)

        if next_turn_idx >= len(turn_order):
            curr_round += 1
            next_turn_idx = 0
            if curr_round > total_rounds:
                self._end_tegn_og_gjett_game()
                return
            gs["current_round"] = curr_round

        next_drawer_id = turn_order[next_turn_idx]
        if next_drawer_id not in self.players and self.players:
            next_drawer_id = next(iter(self.players))

        drawer_name = self.players.get(next_drawer_id, {}).get("name", "Ukjent")
        triplet = get_random_word_triplet()

        gs["turn_idx"] = next_turn_idx
        gs["active_drawer_id"] = next_drawer_id
        gs["active_drawer_name"] = drawer_name
        gs["turn_state"] = "choosing"
        gs["time_remaining"] = 15.0
        gs["choice_deadline"] = now + 15.0
        gs["word_choices"] = triplet
        gs["secret_word"] = ""
        gs["category"] = ""
        gs["revealed_indices"] = []
        gs["guessed_player_ids"] = []
        gs["draw_actions"] = []
        gs["next_action_id"] = 1

        msg_id = gs.get("next_msg_id", 1)
        gs["chat_messages"].append({
            "id": msg_id,
            "type": "system",
            "sender": "System",
            "text": f"🔔 Runde {curr_round} av {total_rounds}: {drawer_name} velger et ord…",
            "timestamp": now,
        })
        gs["next_msg_id"] = msg_id + 1
        self.bump()

    def _end_tegn_og_gjett_game(self) -> None:
        now = time.time()
        gs = self.game_state
        gs["status"] = "game_over"
        gs["turn_state"] = "game_over"

        sorted_players = sorted(
            self.players.values(),
            key=lambda p: p.get("score", 0),
            reverse=True
        )

        podium = []
        for rank, p in enumerate(sorted_players[:3], start=1):
            podium.append({
                "rank": rank,
                "id": p["id"],
                "name": p["name"],
                "avatar": p["avatar"],
                "score": p["score"],
                "color": p["color"],
            })

        gs["podium"] = podium
        winner = sorted_players[0] if sorted_players else None
        gs["winner"] = winner

        msg_id = gs.get("next_msg_id", 1)
        winner_name = winner["name"] if winner else "Vinner"
        winner_score = winner["score"] if winner else 0
        gs["chat_messages"].append({
            "id": msg_id,
            "type": "winner",
            "sender": "System",
            "text": f"🏆 Spillet er over! Gratulerer til {winner_name} som vant med {winner_score} poeng!",
            "timestamp": now,
        })
        gs["next_msg_id"] = msg_id + 1
        self.bump()

    def _tick_tegn_og_gjett(self) -> None:
        gs = self.game_state
        if gs.get("status") != "playing":
            return

        now = time.time()
        turn_state = gs.get("turn_state")

        if turn_state == "choosing":
            deadline = gs.get("choice_deadline", now)
            remaining = max(0.0, deadline - now)
            gs["time_remaining"] = round(remaining, 1)
            if remaining <= 0:
                choices = gs.get("word_choices") or [{"word": "sol", "category": "Natur"}]
                chosen = choices[0]
                self._start_drawing_turn(chosen["word"], chosen.get("category", "Ting"))

        elif turn_state == "drawing":
            turn_start = gs.get("turn_start_time", now)
            duration = gs.get("draw_time", 80)
            elapsed = now - turn_start
            remaining = max(0.0, duration - elapsed)
            gs["time_remaining"] = round(remaining, 1)

            word = gs.get("secret_word", "")
            # Hint 1 at 50% elapsed
            if elapsed >= duration * 0.50 and len(word) >= 4:
                revealed = gs.setdefault("revealed_indices", [])
                if not revealed:
                    valid_idx = [i for i, c in enumerate(word) if c not in (" ", "-")]
                    if valid_idx:
                        revealed.append(random.choice(valid_idx))
                        self.bump()

            # Hint 2 at 75% elapsed
            if elapsed >= duration * 0.75 and len(word) >= 6:
                revealed = gs.setdefault("revealed_indices", [])
                valid_idx = [i for i, c in enumerate(word) if c not in (" ", "-") and i not in revealed]
                if len(revealed) == 1 and valid_idx:
                    revealed.append(random.choice(valid_idx))
                    self.bump()

            # Time is up
            if remaining <= 0:
                self._end_drawing_turn(reason="time_up")

        elif turn_state == "round_recap":
            recap_until = gs.get("recap_until", 0)
            if now >= recap_until:
                self._advance_turn()

    def handle_tegn_og_gjett_action(self, player_id: str, body: Dict[str, Any]) -> Tuple[int, Dict[str, Any]]:
        with self.lock:
            if self.current_game != "tegn_og_gjett":
                return 400, {"ok": False, "error": "Tegn & Gjett er ikke aktivt"}

            action = str(body.get("action") or "").strip()
            gs = self.game_state
            player = self.players.get(player_id)
            if not player:
                return 403, {"ok": False, "error": "Spiller ikke funnet i rommet"}

            if action == "choose_word":
                if gs.get("turn_state") != "choosing":
                    return 400, {"ok": False, "error": "Ikke i ordvalg-fase"}
                if gs.get("active_drawer_id") != player_id:
                    return 403, {"ok": False, "error": "Bare den aktive tegneren kan velge ord"}

                chosen_word = str(body.get("word") or "").strip().lower()
                valid_words = [w["word"].lower() for w in gs.get("word_choices", [])]
                category = "Ting"
                for w in gs.get("word_choices", []):
                    if w["word"].lower() == chosen_word:
                        category = w.get("category", "Ting")
                        break

                if chosen_word not in valid_words and valid_words:
                    chosen_word = valid_words[0]

                self._start_drawing_turn(chosen_word, category)
                return 200, {"ok": True, "word": chosen_word}

            elif action == "draw":
                if gs.get("turn_state") != "drawing":
                    return 400, {"ok": False, "error": "Tegning er ikke aktiv"}
                if gs.get("active_drawer_id") != player_id:
                    return 403, {"ok": False, "error": "Bare den aktive tegneren kan tegne"}

                new_actions = body.get("actions") or []
                if not isinstance(new_actions, list):
                    return 400, {"ok": False, "error": "actions må være en liste"}

                draw_actions = gs.setdefault("draw_actions", [])
                next_id = gs.get("next_action_id", 1)

                for act in new_actions[:150]:
                    if isinstance(act, dict):
                        act_copy = dict(act)
                        act_copy["id"] = next_id
                        next_id += 1
                        draw_actions.append(act_copy)

                gs["next_action_id"] = next_id
                self.touch()
                return 200, {"ok": True, "lastActionId": next_id - 1}

            elif action == "clear_canvas":
                if gs.get("turn_state") != "drawing":
                    return 400, {"ok": False, "error": "Tegning er ikke aktiv"}
                if gs.get("active_drawer_id") != player_id:
                    return 403, {"ok": False, "error": "Bare den aktive tegneren kan tømme lerretet"}

                draw_actions = gs.setdefault("draw_actions", [])
                next_id = gs.get("next_action_id", 1)
                draw_actions.append({"id": next_id, "type": "clear", "color": "#ffffff"})
                gs["next_action_id"] = next_id + 1
                self.touch()
                return 200, {"ok": True, "lastActionId": next_id}

            elif action == "guess":
                if gs.get("turn_state") != "drawing":
                    return 400, {"ok": False, "error": "Runden er ikke aktiv nå"}
                if gs.get("active_drawer_id") == player_id:
                    return 400, {"ok": False, "error": "Tegneren kan ikke gjette"}

                guessed_ids = gs.setdefault("guessed_player_ids", [])
                if player_id in guessed_ids:
                    return 400, {"ok": False, "error": "Du har allerede gjettet ordet!"}

                text = str(body.get("text") or "").strip()
                if not text:
                    return 400, {"ok": False, "error": "Tom gjetning"}

                secret_word = gs.get("secret_word", "").lower()
                clean_guess = text.lower()
                now = time.time()
                msg_id = gs.get("next_msg_id", 1)

                if clean_guess == secret_word:
                    turn_start = gs.get("turn_start_time", now)
                    duration = gs.get("draw_time", 80)
                    elapsed = now - turn_start
                    frac = max(0.0, min(1.0, 1.0 - (elapsed / duration)))
                    points = int(100 + frac * 300)
                    if len(guessed_ids) == 0:
                        points += 50

                    player["score"] = player.get("score", 0) + points

                    drawer_id = gs.get("active_drawer_id")
                    drawer = self.players.get(drawer_id or "")
                    if drawer:
                        drawer["score"] = drawer.get("score", 0) + 75

                    guessed_ids.append(player_id)

                    gs["chat_messages"].append({
                        "id": msg_id,
                        "type": "correct",
                        "sender": player["name"],
                        "text": f"gjettet ordet! (+{points}p)",
                        "points": points,
                        "timestamp": now,
                    })
                    gs["next_msg_id"] = msg_id + 1

                    active_guessers = [pid for pid in self.players if pid != drawer_id]
                    other_count = max(1, len(active_guessers))
                    if len(guessed_ids) >= other_count:
                        self._end_drawing_turn(reason="all_guessed")
                    else:
                        self.bump()

                    return 200, {
                        "ok": True,
                        "correct": True,
                        "points": points,
                        "word": secret_word,
                    }
                else:
                    is_close = is_close_guess(clean_guess, secret_word)
                    if is_close:
                        return 200, {
                            "ok": True,
                            "correct": False,
                            "close": True,
                            "guess": text,
                        }
                    else:
                        gs["chat_messages"].append({
                            "id": msg_id,
                            "type": "guess",
                            "sender": player["name"],
                            "text": text,
                            "timestamp": now,
                        })
                        gs["next_msg_id"] = msg_id + 1
                        self.bump()
                        return 200, {
                            "ok": True,
                            "correct": False,
                            "close": False,
                        }

            elif action == "restart":
                host_token = str(body.get("hostToken") or "").strip()
                if self.host_token != host_token:
                    return 403, {"ok": False, "error": "Kun verten kan starte spillet på nytt"}
                self.start_tegn_og_gjett(body.get("settings") or {})
                return 200, {"ok": True}

            elif action == "to_lobby":
                host_token = str(body.get("hostToken") or "").strip()
                is_host_req = bool(self.host_token and self.host_token == host_token)
                is_game_over = gs.get("status") == "game_over" or gs.get("turn_state") == "game_over"
                if not (is_host_req or is_game_over):
                    return 403, {"ok": False, "error": "Kun verten kan gå tilbake til lobby mens spillet pågår"}
                self.current_game = None
                self.game_state = {}
                self.bump()
                return 200, {"ok": True}

            return 400, {"ok": False, "error": f"Ukjent handling «{action}»"}

    def get_draw_actions_since(self, since_id: int) -> List[Dict[str, Any]]:
        with self.lock:
            if self.current_game != "tegn_og_gjett":
                return []
            actions = self.game_state.get("draw_actions", [])
            if since_id <= 0:
                return actions
            return [a for a in actions if a.get("id", 0) > since_id]


class PartyAPI:
    @staticmethod
    def handle_get(path: str, query: Dict[str, Any]) -> Optional[Tuple[int, Any]]:
        # Remove /api/party/ prefix if present
        rel_path = path
        if rel_path.startswith("/api/party/"):
            rel_path = "/api/" + rel_path[len("/api/party/"):]

        if rel_path in ("/api/room", "/api/state", "/api/poll"):
            code = (query.get("code", [""])[0] or "").strip().upper()
            player_id = (query.get("playerId", [""])[0] or "").strip()
            client_v = int(query.get("v", [-1])[0])

            with _rooms_lock:
                room = _rooms.get(code)

            if not room:
                return 404, {"ok": False, "error": f"Fant ikke party-rom med kode «{code}»"}

            # Update heartbeat
            with room.lock:
                if player_id in room.players:
                    room.players[player_id]["last_seen"] = time.time()
                room.touch()

            # If polling and client already has current version, short wait (up to 1.5s)
            if client_v >= 0 and client_v == room.version and room.current_game not in ("ordbombe", "tegn_og_gjett"):
                time.sleep(0.4)

            state = room.get_public_state(player_id)
            return 200, state

        if rel_path == "/api/tegn-og-gjett/draw-sync":
            code = (query.get("code", [""])[0] or "").strip().upper()
            try:
                since_id = int(query.get("since", [0])[0] or 0)
            except (ValueError, TypeError):
                since_id = 0

            with _rooms_lock:
                room = _rooms.get(code)

            if not room:
                return 404, {"ok": False, "error": "Rommet finnes ikke"}

            actions = room.get_draw_actions_since(since_id)
            return 200, {
                "ok": True,
                "actions": actions,
                "lastActionId": room.game_state.get("next_action_id", 1) - 1,
            }

        if rel_path in ("/api/tegn-og-gjett/random-word", "/api/tegn-og-gjett/words"):
            return 200, {
                "ok": True,
                "words": get_random_word_triplet(),
            }

        if rel_path == "/api/list-games":
            # List of active party games
            return 200, {
                "ok": True,
                "games": [
                    {
                        "id": "ordbombe",
                        "title": "Ordbombe",
                        "subtitle": "Norsk Word Bomb med tikkende lunte",
                        "desc": "Tast inn et ord med stavelsen før bomben eksploderer på mobilen din!",
                        "status": "ready",
                        "badge": "Klar til å spilles! 💣",
                        "players": "2–16 spillere",
                        "icon": "/assets/icons/ordbombe.png",
                        "route": "/ordbombe/",
                    },
                    {
                        "id": "tegn_og_gjett",
                        "title": "Tegn & Gjett",
                        "subtitle": "Klassisk tegne- og gjettespill (skribbl-stil)",
                        "desc": "Én tegner et hemmelig ord på mobilen, resten gjetter i lynrask sanntidschat!",
                        "status": "ready",
                        "badge": "Klar til å spilles! 🎨",
                        "players": "2–16 spillere",
                        "icon": "/assets/icons/tegn_og_gjett.png",
                        "route": "/tegn-og-gjett/",
                    },
                ]
            }

        return None

    @staticmethod
    def handle_post(path: str, body: Dict[str, Any]) -> Optional[Tuple[int, Any]]:
        rel_path = path
        if rel_path.startswith("/api/party/"):
            rel_path = "/api/" + rel_path[len("/api/party/"):]

        if rel_path == "/api/create":
            host_name = str(body.get("hostName") or "Vert").strip()[:18] or "Vert"
            host_avatar = str(body.get("avatar") or "charbear").strip()[:200000] or "charbear"

            with _rooms_lock:
                # Pick unique memorable 4-letter word or random letters
                code = None
                available_words = [w for w in CLEAN_WORDS if w not in _rooms]
                if available_words:
                    code = random.choice(available_words)
                else:
                    for _ in range(50):
                        cand = "".join(random.choices(string.ascii_uppercase, k=4))
                        if cand not in _rooms:
                            code = cand
                            break
                    if not code:
                        code = f"P{random.randint(100, 999)}"

                host_token = uuid.uuid4().hex
                room = PartyRoom(code, host_token, host_name, host_avatar)
                _rooms[code] = room

            return 200, {
                "ok": True,
                "roomCode": room.code,
                "hostToken": host_token,
                "playerId": room.host_id,
                "message": f"Party-rom {room.code} opprettet!",
            }

        if rel_path == "/api/join":
            code = str(body.get("roomCode") or "").strip().upper()
            player_name = str(body.get("playerName") or "Spiller").strip()[:18] or "Spiller"
            avatar = str(body.get("avatar") or "charbear").strip()[:200000] or "charbear"

            with _rooms_lock:
                room = _rooms.get(code)

            if not room:
                return 404, {"ok": False, "error": f"Fant ikke party-rom med kode «{code}». Sjekk koden og prøv igjen!"}

            with room.lock:
                # Check if player name already exists; if so append a number
                existing_names = {p["name"].lower() for p in room.players.values()}
                final_name = player_name
                counter = 2
                while final_name.lower() in existing_names:
                    final_name = f"{player_name} {counter}"
                    counter += 1

                player_id = f"p_{uuid.uuid4().hex[:8]}"
                taken_colors = {p.get("color", "").lower() for p in room.players.values()}
                pref_color = extract_color_from_avatar(avatar)
                assigned_color = get_available_party_color(taken_colors, pref_color)
                final_avatar = replace_color_in_avatar(avatar, assigned_color)

                room.players[player_id] = {
                    "id": player_id,
                    "name": final_name,
                    "avatar": final_avatar,
                    "color": assigned_color,
                    "is_host": False,
                    "is_ready": True,
                    "score": 0,
                    "lives": 3,
                    "eliminated": False,
                    "words_count": 0,
                    "last_seen": time.time(),
                }
                room.bump()

            return 200, {
                "ok": True,
                "roomCode": room.code,
                "playerId": player_id,
                "playerName": final_name,
                "avatar": final_avatar,
                "color": assigned_color,
                "isHost": False,
            }

        if rel_path in ("/api/update-avatar", "/api/avatar", "/api/update-character"):
            code = str(body.get("roomCode") or "").strip().upper()
            player_id = str(body.get("playerId") or "").strip()
            avatar = str(body.get("avatar") or "").strip()[:200000]

            with _rooms_lock:
                room = _rooms.get(code)

            if not room:
                return 404, {"ok": False, "error": "Party-rommet finnes ikke."}

            with room.lock:
                player = room.players.get(player_id)
                if not player:
                    return 404, {"ok": False, "error": "Spiller ikke funnet i rommet."}

                new_color = extract_color_from_avatar(avatar).lower()

                # Check color conflict: only one person can have each color
                for other_id, other_p in room.players.items():
                    if other_id != player_id and other_p.get("color", "").lower() == new_color:
                        other_name = other_p.get("name") or "en annen spiller"
                        return 409, {
                            "ok": False,
                            "error": f"Fargen er allerede tatt av {other_name}!"
                        }

                player["avatar"] = avatar
                player["color"] = new_color
                player["last_seen"] = time.time()
                room.bump()

            return 200, {
                "ok": True,
                "avatar": avatar,
                "color": new_color
            }

        if rel_path == "/api/select-game":
            code = str(body.get("roomCode") or "").strip().upper()
            host_token = str(body.get("hostToken") or "").strip()
            game_id = body.get("gameId")  # e.g. "ordbombe" or None for lobby
            settings = body.get("settings") or {}

            with _rooms_lock:
                room = _rooms.get(code)

            if not room:
                return 404, {"ok": False, "error": "Rommet finnes ikke"}

            with room.lock:
                if room.host_token != host_token:
                    return 403, {"ok": False, "error": "Bare romverten kan starte eller bytte spill"}

                if game_id == "ordbombe":
                    room.start_ordbombe(settings)
                elif game_id == "tegn_og_gjett":
                    room.start_tegn_og_gjett(settings)
                elif game_id == "sjakk":
                    room.current_game = "sjakk"
                    room.game_state = {"settings": settings}
                    try:
                        from games.sjakk.api import _rooms as sjakk_rooms, SjakkRoom
                        with _rooms_lock:
                            if code not in sjakk_rooms:
                                host_player = room.players.get(room.host_id, {})
                                time_ctrl = int(settings.get("timeControl", 300))
                                s_room = SjakkRoom(
                                    code=code,
                                    host_name=host_player.get("name", "Hvit"),
                                    host_avatar=host_player.get("avatar", "charbear"),
                                    time_control=time_ctrl
                                )
                                s_room.host_id = room.host_id
                                s_room.white_player["id"] = room.host_id
                                sjakk_rooms[code] = s_room
                    except Exception as err:
                        print("Error creating sjakk party room bridge:", err)
                    room.bump()
                elif game_id == "korridorer":
                    room.current_game = "korridorer"
                    room.game_state = {"settings": settings}
                    try:
                        from games.korridorer.api import _rooms as korridorer_rooms, KorridorerRoom, PLAYER_CONFIGS
                        with _rooms_lock:
                            if code not in korridorer_rooms:
                                host_player = room.players.get(room.host_id, {})
                                k_room = KorridorerRoom(
                                    code=code,
                                    host_name=host_player.get("name", "Spiller 1"),
                                    host_avatar=host_player.get("avatar", "charbear"),
                                    max_players=4
                                )
                                k_room.host_id = room.host_id
                                k_room.players[0]["id"] = room.host_id
                                for pid, pdata in room.players.items():
                                    if pid != room.host_id and len(k_room.players) < 4:
                                        idx = len(k_room.players)
                                        cfg = PLAYER_CONFIGS[idx]
                                        k_room.players.append({
                                            "id": pid,
                                            "name": pdata.get("name", f"Spiller {idx + 1}"),
                                            "avatar": pdata.get("avatar", cfg["defaultAvatar"]),
                                            "color": cfg["color"],
                                            "colorName": cfg["colorName"],
                                            "pos": list(cfg["start"]),
                                            "walls": 10 if len(room.players) == 2 else 5,
                                            "goalDesc": cfg["goalDesc"],
                                            "isHost": False,
                                            "lastSeen": time.time(),
                                        })
                                if len(k_room.players) >= 2:
                                    k_room.start_game()
                                korridorer_rooms[code] = k_room
                    except Exception as err:
                        print("Error creating korridorer party room bridge:", err)
                    room.bump()
                elif game_id is None:
                    # Return to lobby
                    room.current_game = None
                    room.game_state = {}
                    room.bump()
                else:
                    return 400, {"ok": False, "error": f"Spillet '{game_id}' er under utvikling og ikke tilgjengelig enda."}

            return 200, {"ok": True, "currentGame": room.current_game}

        if rel_path == "/api/ordbombe/action":
            code = str(body.get("roomCode") or "").strip().upper()
            player_id = str(body.get("playerId") or "").strip()
            action = str(body.get("action") or "").strip()

            with _rooms_lock:
                room = _rooms.get(code)

            if not room:
                return 404, {"ok": False, "error": "Rommet finnes ikke"}

            if action == "typing":
                text = str(body.get("text") or "")
                room.set_ordbombe_typing(player_id, text)
                return 200, {"ok": True}

            if action == "submit_word":
                word = str(body.get("word") or "")
                res = room.submit_ordbombe_word(player_id, word)
                return 200, res

            if action == "restart":
                host_token = str(body.get("hostToken") or "").strip()
                if room.host_token != host_token:
                    return 403, {"ok": False, "error": "Kun verten kan restarte"}
                room.start_ordbombe(body.get("settings") or {})
                return 200, {"ok": True}

            if action == "to_lobby":
                host_token = str(body.get("hostToken") or "").strip()
                if room.host_token != host_token:
                    return 403, {"ok": False, "error": "Kun verten kan gå tilbake til lobby"}
                with room.lock:
                    room.current_game = None
                    room.game_state = {}
                    room.bump()
                return 200, {"ok": True}

            return 400, {"ok": False, "error": f"Ukjent handling «{action}»"}

        if rel_path == "/api/tegn-og-gjett/action":
            code = str(body.get("roomCode") or "").strip().upper()
            player_id = str(body.get("playerId") or "").strip()

            with _rooms_lock:
                room = _rooms.get(code)

            if not room:
                return 404, {"ok": False, "error": "Rommet finnes ikke"}

            return room.handle_tegn_og_gjett_action(player_id, body)

        if rel_path == "/api/leave":
            code = str(body.get("roomCode") or "").strip().upper()
            player_id = str(body.get("playerId") or "").strip()

            with _rooms_lock:
                room = _rooms.get(code)

            if room:
                with room.lock:
                    if player_id in room.players:
                        del room.players[player_id]
                        # If host left, assign new host if any players remain
                        if room.host_id == player_id and room.players:
                            new_host_id = next(iter(room.players))
                            room.host_id = new_host_id
                            room.players[new_host_id]["is_host"] = True
                        room.bump()

            return 200, {"ok": True}

        return None
