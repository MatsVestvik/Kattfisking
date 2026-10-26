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

# In-memory party rooms storage
_rooms: Dict[str, "PartyRoom"] = {}
_rooms_lock = threading.Lock()

# Clean room code words for easy typing on phones
CLEAN_WORDS = [
    "FEST", "BOMB", "VORS", "KATT", "QUIZ", "SMIL", "GLOS", "NTNU",
    "GULL", "HELG", "LYS", "SOL", "BUSS", "CAMP", "SPILL", "KAFFE",
    "TAKK", "HYTTE", "VIND", "FJORD", "NORD", "BROR", "VENN", "TEAM"
]


class PartyRoom:
    def __init__(self, code: str, host_token: str, host_name: str, host_avatar: str):
        self.code = code
        self.host_token = host_token
        self.created_at = time.time()
        self.last_active = time.time()
        self.current_game: Optional[str] = None  # None (lobby), "ordbombe", "hvem_i_rommet", etc.
        self.game_state: Dict[str, Any] = {}
        self.players: Dict[str, Dict[str, Any]] = {}
        self.version = 1
        self.lock = threading.RLock()

        # Add initial host player
        host_id = f"p_{uuid.uuid4().hex[:8]}"
        self.host_id = host_id
        self.players[host_id] = {
            "id": host_id,
            "name": host_name[:18].strip() or "Vert",
            "avatar": host_avatar or "👑",
            "color": "#fb8500",
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

            return {
                "ok": True,
                "roomCode": self.code,
                "currentGame": self.current_game,
                "version": self.version,
                "players": players_list,
                "playerCount": len(players_list),
                "isHost": bool(client_player and client_player.get("is_host")),
                "me": client_player,
                "gameState": self.game_state,
                "serverTime": time.time(),
            }

    # --- ORDBOMBE ENGINE ---

    def start_ordbombe(self, settings: Dict[str, Any]) -> None:
        with self.lock:
            self.current_game = "ordbombe"
            diff = (settings.get("difficulty") or "medium").lower()
            turn_sec = float(settings.get("turnDuration") or 9.0)

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
            duration = self.game_state.get("turn_duration", 9.0)
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
                self.game_state["turn_start_time"] = now
                self.game_state["time_remaining"] = self.game_state["turn_duration"]
                self.game_state["last_event"] = {
                    "type": "turn_changed",
                    "text": f"Ny runde! Bomben er hos {self.game_state['active_player_name']}",
                    "next_player_name": self.game_state["active_player_name"],
                    "timestamp": now,
                }
                self.bump()


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
            if client_v >= 0 and client_v == room.version and room.current_game != "ordbombe":
                time.sleep(0.4)

            state = room.get_public_state(player_id)
            return 200, state

        if rel_path == "/api/list-games":
            # List of party games available or coming soon
            return 200, {
                "ok": True,
                "games": [
                    {
                        "id": "ordbombe",
                        "title": "Ordbombe",
                        "subtitle": "Norsk Word Bomb med tikkende lunte",
                        "desc": "Tast inn et ord med stavelsen før bomben eksploderer på mobilen din!",
                        "status": "ready",
                        "badge": "Klar til å spilles!",
                        "players": "2–16 spillere",
                        "icon": "/assets/icons/ordbombe.png",
                        "route": "/ordbombe/",
                    },
                    {
                        "id": "hvem_i_rommet",
                        "title": "Hvem i Rommet?",
                        "subtitle": "Avstemningsspill for vennegjengen",
                        "desc": "Hvem passer best til påstanden? Alle stemmer anonymt på telefonen, før resultatene avsløres!",
                        "status": "placeholder",
                        "badge": "Kommer snart",
                        "players": "3–16 spillere",
                        "icon": "/assets/icons/hvem_i_rommet.png",
                        "route": "/hvem-i-rommet/",
                    },
                    {
                        "id": "tegn_og_gjett",
                        "title": "Tegn & Gjett",
                        "subtitle": "Lynrask tegning og gjetting på mobil",
                        "desc": "En tegner hemmelig ord på mobilen, resten gjetter i lynrask sanntidschat!",
                        "status": "placeholder",
                        "badge": "Kommer snart",
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
            host_avatar = str(body.get("avatar") or "👑").strip()[:4] or "👑"

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
            avatar = str(body.get("avatar") or "👤").strip()[:4] or "👤"

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
                colors = ["#00b4d8", "#06d6a0", "#ffd166", "#ef476f", "#118ab2", "#8338ec", "#ff006e", "#fb8500"]
                assigned_color = colors[len(room.players) % len(colors)]

                room.players[player_id] = {
                    "id": player_id,
                    "name": final_name,
                    "avatar": avatar,
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
                "avatar": avatar,
                "isHost": False,
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
