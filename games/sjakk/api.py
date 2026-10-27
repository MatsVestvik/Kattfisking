"""
Sjakk API - Backend for 2-player party chess & multiplayer rooms.
Supports real-time move synchronization, clock tracking, and party integration.
"""

import random
import string
import threading
import time
import uuid
from typing import Any, Dict, List, Optional, Tuple

_rooms: Dict[str, "SjakkRoom"] = {}
_rooms_lock = threading.Lock()

CLEAN_ROOM_CODES = [
    "SJAKK", "TARN", "BONDE", "HEST", "DRONN", "KONGE",
    "MATT", "REMIS", "ROKADE", "TREKK", "GAMBIT", "LOPER"
]


class SjakkRoom:
    def __init__(
        self,
        code: str,
        host_name: str,
        host_avatar: str,
        time_control: int = 300,  # in seconds (0 = unlimited)
        increment: int = 0
    ):
        self.code = code
        self.created_at = time.time()
        self.last_active = time.time()
        self.version = 1
        self.lock = threading.RLock()

        self.time_control = time_control
        self.increment = increment

        # Players: white, black, spectators
        self.white_player: Optional[Dict[str, Any]] = None
        self.black_player: Optional[Dict[str, Any]] = None
        self.spectators: Dict[str, Dict[str, Any]] = {}

        # Initial host player
        host_id = f"p_{uuid.uuid4().hex[:8]}"
        host_data = {
            "id": host_id,
            "name": host_name[:18].strip() or "Hvit spiller",
            "avatar": host_avatar or "👑",
            "color": "w",
            "isHost": True,
            "lastSeen": time.time(),
        }
        self.host_id = host_id
        self.white_player = host_data

        # Game state
        self.status = "waiting"  # waiting, active, finished
        self.result: Optional[str] = None  # 1-0, 0-1, 1/2-1/2
        self.result_reason: Optional[str] = None  # checkmate, resign, timeout, draw_agreement, stalemate
        self.turn = "w"  # 'w' or 'b'
        self.moves: List[Dict[str, Any]] = []

        # Clocks
        self.white_time = float(time_control) if time_control > 0 else 0.0
        self.black_time = float(time_control) if time_control > 0 else 0.0
        self.turn_start_time: Optional[float] = None

        # Draw offers & Rematch
        self.draw_offered_by: Optional[str] = None
        self.rematch_requested_by: Optional[str] = None

    def touch(self) -> None:
        self.last_active = time.time()

    def bump(self) -> None:
        self.version += 1
        self.touch()

    def _tick_clock(self) -> None:
        """Update clocks if game is active."""
        if self.status != "active" or self.time_control <= 0 or not self.turn_start_time:
            return

        now = time.time()
        elapsed = now - self.turn_start_time

        if self.turn == "w":
            rem = self.white_time - elapsed
            if rem <= 0:
                self.white_time = 0.0
                self.status = "finished"
                self.result = "0-1"
                self.result_reason = "Tiden er ute! Svart vinner på tid."
                self.bump()
        else:
            rem = self.black_time - elapsed
            if rem <= 0:
                self.black_time = 0.0
                self.status = "finished"
                self.result = "1-0"
                self.result_reason = "Tiden er ute! Hvit vinner på tid."
                self.bump()

    def get_public_state(self, player_id: Optional[str] = None) -> Dict[str, Any]:
        with self.lock:
            self._tick_clock()

            now = time.time()
            current_white_time = self.white_time
            current_black_time = self.black_time

            if self.status == "active" and self.time_control > 0 and self.turn_start_time:
                elapsed = now - self.turn_start_time
                if self.turn == "w":
                    current_white_time = max(0.0, self.white_time - elapsed)
                else:
                    current_black_time = max(0.0, self.black_time - elapsed)

            my_role = "spectator"
            if self.white_player and self.white_player.get("id") == player_id:
                my_role = "w"
            elif self.black_player and self.black_player.get("id") == player_id:
                my_role = "b"
            elif self.black_player is None and player_id and player_id != self.host_id:
                self.black_player = {
                    "id": player_id,
                    "name": "Svart spiller",
                    "avatar": "♟️",
                    "color": "b",
                    "isHost": False,
                    "lastSeen": time.time(),
                }
                my_role = "b"
                self.start_game_if_ready()

            return {
                "ok": True,
                "roomCode": self.code,
                "status": self.status,
                "version": self.version,
                "turn": self.turn,
                "result": self.result,
                "resultReason": self.result_reason,
                "timeControl": self.time_control,
                "whitePlayer": self.white_player,
                "blackPlayer": self.black_player,
                "spectatorCount": len(self.spectators),
                "whiteTime": round(current_white_time, 1),
                "blackTime": round(current_black_time, 1),
                "moves": self.moves,
                "myRole": my_role,
                "drawOfferedBy": self.draw_offered_by,
                "rematchRequestedBy": self.rematch_requested_by,
            }

    def start_game_if_ready(self) -> None:
        if self.white_player and self.black_player and self.status == "waiting":
            self.status = "active"
            self.turn = "w"
            if self.time_control > 0:
                self.turn_start_time = time.time()
            self.bump()

    def make_move(self, player_id: str, move_data: Dict[str, Any]) -> Tuple[bool, str]:
        with self.lock:
            self._tick_clock()
            if self.status != "active":
                return False, "Partiet er ikke aktivt."

            # Verify player's turn
            is_white = self.white_player and self.white_player.get("id") == player_id
            is_black = self.black_player and self.black_player.get("id") == player_id

            if not is_white and not is_black:
                return False, "Du er tilskuer og kan ikke gjøre trekk."

            if self.turn == "w" and not is_white:
                return False, "Det er Hvits tur."
            if self.turn == "b" and not is_black:
                return False, "Det er Svarts tur."

            # Update clock for current player
            now = time.time()
            if self.time_control > 0 and self.turn_start_time:
                elapsed = now - self.turn_start_time
                if self.turn == "w":
                    self.white_time = max(0.0, self.white_time - elapsed + self.increment)
                else:
                    self.black_time = max(0.0, self.black_time - elapsed + self.increment)

            # Record move
            self.moves.append({
                "from": move_data.get("from"),
                "to": move_data.get("to"),
                "piece": move_data.get("piece"),
                "captured": move_data.get("captured"),
                "san": move_data.get("san", ""),
                "promotion": move_data.get("promotion"),
                "color": self.turn,
                "fen": move_data.get("fen", ""),
                "timeRemaining": self.white_time if self.turn == "w" else self.black_time,
            })

            # Check game termination conditions reported by client
            game_over = move_data.get("gameOver")
            if game_over:
                self.status = "finished"
                self.result = move_data.get("result", "*")
                self.result_reason = move_data.get("resultReason", "Parti over.")
            else:
                # Switch turn
                self.turn = "b" if self.turn == "w" else "w"
                if self.time_control > 0:
                    self.turn_start_time = now

            # Reset draw offer on move
            self.draw_offered_by = None
            self.bump()
            return True, "Trekk registrert."

    def offer_draw(self, player_id: str) -> Tuple[bool, str]:
        with self.lock:
            if self.status != "active":
                return False, "Partiet er ikke aktivt."

            is_white = self.white_player and self.white_player.get("id") == player_id
            is_black = self.black_player and self.black_player.get("id") == player_id

            if not is_white and not is_black:
                return False, "Ugyldig spiller."

            sender_color = "w" if is_white else "b"

            # If opponent already offered draw, this accepts it!
            if self.draw_offered_by and self.draw_offered_by != sender_color:
                self.status = "finished"
                self.result = "1/2-1/2"
                self.result_reason = "Enighet om remis (uavgjort)."
                self.draw_offered_by = None
                self.bump()
                return True, "Remis godtatt!"

            self.draw_offered_by = sender_color
            self.bump()
            return True, "Remistilbud sendt."

    def resign(self, player_id: str) -> Tuple[bool, str]:
        with self.lock:
            if self.status != "active":
                return False, "Partiet er ikke aktivt."

            is_white = self.white_player and self.white_player.get("id") == player_id
            is_black = self.black_player and self.black_player.get("id") == player_id

            if is_white:
                self.status = "finished"
                self.result = "0-1"
                self.result_reason = "Hvit ga opp. Svart vinner!"
                self.bump()
                return True, "Du ga opp."
            elif is_black:
                self.status = "finished"
                self.result = "1-0"
                self.result_reason = "Svart ga opp. Hvit vinner!"
                self.bump()
                return True, "Du ga opp."

            return False, "Ugyldig spiller."

    def request_rematch(self, player_id: str) -> Tuple[bool, str]:
        with self.lock:
            if self.status != "finished":
                return False, "Partiet må være ferdig først."

            is_white = self.white_player and self.white_player.get("id") == player_id
            is_black = self.black_player and self.black_player.get("id") == player_id

            if not is_white and not is_black:
                return False, "Kun spillere kan be om omkamp."

            requester_color = "w" if is_white else "b"

            if self.rematch_requested_by and self.rematch_requested_by != requester_color:
                # Both agreed! Reset board and swap colors!
                self.white_player, self.black_player = self.black_player, self.white_player
                if self.white_player:
                    self.white_player["color"] = "w"
                if self.black_player:
                    self.black_player["color"] = "b"

                self.moves = []
                self.status = "active"
                self.result = None
                self.result_reason = None
                self.turn = "w"
                self.white_time = float(self.time_control) if self.time_control > 0 else 0.0
                self.black_time = float(self.time_control) if self.time_control > 0 else 0.0
                self.turn_start_time = time.time() if self.time_control > 0 else None
                self.draw_offered_by = None
                self.rematch_requested_by = None
                self.bump()
                return True, "Omkamp startet! Fargene er byttet."

            self.rematch_requested_by = requester_color
            self.bump()
            return True, "Forespørsel om omkamp sendt."


class SjakkAPI:
    @staticmethod
    def _clean_expired_rooms() -> None:
        now = time.time()
        with _rooms_lock:
            to_remove = [
                code for code, room in _rooms.items()
                if (now - room.last_active) > 7200  # 2 hours inactivity
            ]
            for code in to_remove:
                del _rooms[code]

    @staticmethod
    def handle_get(path: str, query: Dict[str, List[str]]) -> Optional[Tuple[int, Dict[str, Any]]]:
        SjakkAPI._clean_expired_rooms()

        if path == "/api/sjakk/state":
            room_code = (query.get("room") or [""])[0].strip().upper()
            player_id = (query.get("player") or [""])[0].strip()

            with _rooms_lock:
                room = _rooms.get(room_code)

            if not room:
                return 404, {"ok": False, "error": "Rommet finnes ikke eller har utløpt."}

            return 200, room.get_public_state(player_id)

        return None

    @staticmethod
    def handle_post(path: str, body: Dict[str, Any]) -> Optional[Tuple[int, Dict[str, Any]]]:
        SjakkAPI._clean_expired_rooms()

        if path == "/api/sjakk/create":
            host_name = str(body.get("hostName", "Hvit spiller")).strip()[:18]
            host_avatar = str(body.get("avatar", "👑")).strip()[:4]
            time_control = int(body.get("timeControl", 300))  # seconds (default 5 min)
            increment = int(body.get("increment", 0))

            with _rooms_lock:
                # Find available code
                available = [c for c in CLEAN_ROOM_CODES if c not in _rooms]
                if available:
                    code = random.choice(available)
                else:
                    code = "".join(random.choices(string.ascii_uppercase, k=4))

                room = SjakkRoom(
                    code=code,
                    host_name=host_name,
                    host_avatar=host_avatar,
                    time_control=time_control,
                    increment=increment
                )
                _rooms[code] = room

            return 200, {
                "ok": True,
                "roomCode": room.code,
                "playerId": room.host_id,
                "playerColor": "w",
                "isHost": True,
            }

        elif path == "/api/sjakk/join":
            code = str(body.get("roomCode", "")).strip().upper()
            player_name = str(body.get("playerName", "Svart spiller")).strip()[:18]
            player_avatar = str(body.get("avatar", "♟️")).strip()[:4]

            with _rooms_lock:
                room = _rooms.get(code)

            if not room:
                return 404, {"ok": False, "error": "Fant ikke sjakkrommet."}

            with room.lock:
                player_id = f"p_{uuid.uuid4().hex[:8]}"

                if room.black_player is None:
                    # Join as Black (opponent)
                    room.black_player = {
                        "id": player_id,
                        "name": player_name or "Svart spiller",
                        "avatar": player_avatar or "♟️",
                        "color": "b",
                        "isHost": False,
                        "lastSeen": time.time(),
                    }
                    role = "b"
                    room.start_game_if_ready()
                else:
                    # Join as Spectator
                    room.spectators[player_id] = {
                        "id": player_id,
                        "name": player_name or "Tilskuer",
                        "avatar": player_avatar or "👀",
                        "lastSeen": time.time(),
                    }
                    role = "spectator"

                room.bump()

            return 200, {
                "ok": True,
                "roomCode": room.code,
                "playerId": player_id,
                "playerColor": role,
            }

        elif path == "/api/sjakk/move":
            code = str(body.get("roomCode", "")).strip().upper()
            player_id = str(body.get("playerId", "")).strip()
            move_data = body.get("move", {})

            with _rooms_lock:
                room = _rooms.get(code)

            if not room:
                return 404, {"ok": False, "error": "Rommet finnes ikke."}

            ok, msg = room.make_move(player_id, move_data)
            if not ok:
                return 400, {"ok": False, "error": msg}

            return 200, {"ok": True, "message": msg, "state": room.get_public_state(player_id)}

        elif path == "/api/sjakk/action":
            code = str(body.get("roomCode", "")).strip().upper()
            player_id = str(body.get("playerId", "")).strip()
            action = str(body.get("action", "")).strip()

            with _rooms_lock:
                room = _rooms.get(code)

            if not room:
                return 404, {"ok": False, "error": "Rommet finnes ikke."}

            if action == "draw":
                ok, msg = room.offer_draw(player_id)
            elif action == "resign":
                ok, msg = room.resign(player_id)
            elif action == "rematch":
                ok, msg = room.request_rematch(player_id)
            else:
                return 400, {"ok": False, "error": "Ukjent handling."}

            if not ok:
                return 400, {"ok": False, "error": msg}

            return 200, {"ok": True, "message": msg, "state": room.get_public_state(player_id)}

        return None
