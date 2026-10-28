"""
Korridorer API - Multiplayer backend for Quoridor (2-4 players).
Handles board validation, pawn jumps, wall placements, BFS pathfinding,
lobby management, and game state synchronization.
"""

from collections import deque
import random
import string
import threading
import time
import uuid
from typing import Any, Dict, List, Optional, Set, Tuple

_rooms: Dict[str, "KorridorerRoom"] = {}
_rooms_lock = threading.Lock()

CLEAN_ROOM_CODES = [
    "VEGG", "GANG", "LABY", "SPUR", "BLOKK", "STIEN",
    "RUTE", "TARN", "SKAN", "PORTER", "HURT", "TRIPP",
    "KROSS", "FELLE", "SMAL", "PORT", "HEKK", "BOM"
]

PLAYER_CONFIGS = [
    {
        "slot": 0,
        "color": "#ef4444",
        "colorName": "Rød",
        "start": (8, 4),
        "goalDesc": "Nå øverste rad (rad 0)",
        "goalFn": lambda r, c: r == 0,
        "defaultAvatar": "charbear",
    },
    {
        "slot": 1,
        "color": "#06b6d4",
        "colorName": "Cyan",
        "start": (0, 4),
        "goalDesc": "Nå nederste rad (rad 8)",
        "goalFn": lambda r, c: r == 8,
        "defaultAvatar": "jormundgandr",
    },
    {
        "slot": 2,
        "color": "#10b981",
        "colorName": "Grønn",
        "start": (4, 0),
        "goalDesc": "Nå høyre kant (kolonne 8)",
        "goalFn": lambda r, c: c == 8,
        "defaultAvatar": "tanuki",
    },
    {
        "slot": 3,
        "color": "#a855f7",
        "colorName": "Lilla",
        "start": (4, 8),
        "goalDesc": "Nå venstre kant (kolonne 0)",
        "goalFn": lambda r, c: c == 0,
        "defaultAvatar": "squitonkey",
    },
]


def in_bounds(r: int, c: int) -> bool:
    return 0 <= r <= 8 and 0 <= c <= 8


def is_passage_blocked(r1: int, c1: int, r2: int, c2: int, walls_set: Set[Tuple[int, int, str]]) -> bool:
    """Check if movement between adjacent cells (r1, c1) and (r2, c2) is blocked by any wall."""
    if not in_bounds(r2, c2):
        return True
    if r2 == r1 - 1 and c2 == c1:  # North
        return (r1 - 1, c1 - 1, "H") in walls_set or (r1 - 1, c1, "H") in walls_set
    elif r2 == r1 + 1 and c2 == c1:  # South
        return (r1, c1 - 1, "H") in walls_set or (r1, c1, "H") in walls_set
    elif r2 == r1 and c2 == c1 - 1:  # West
        return (r1 - 1, c1 - 1, "V") in walls_set or (r1, c1 - 1, "V") in walls_set
    elif r2 == r1 and c2 == c1 + 1:  # East
        return (r1 - 1, c1, "V") in walls_set or (r1, c1, "V") in walls_set
    return True


def get_valid_pawn_moves(curr_pos: Tuple[int, int], all_players_pos: List[Tuple[int, int]], walls_set: Set[Tuple[int, int, str]]) -> List[Tuple[int, int]]:
    """Calculate all legal destination squares for a pawn under Quoridor tournament jump rules."""
    r, c = curr_pos
    moves: List[Tuple[int, int]] = []
    directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]
    occupied = set(all_players_pos) - {curr_pos}

    for dr, dc in directions:
        nr, nc = r + dr, c + dc
        if not in_bounds(nr, nc) or is_passage_blocked(r, c, nr, nc, walls_set):
            continue

        if (nr, nc) not in occupied:
            moves.append((nr, nc))
        else:
            # Adjacent square is occupied by an opponent -> check jumps
            br, bc = nr + dr, nc + dc
            can_straight_jump = in_bounds(br, bc) and not is_passage_blocked(nr, nc, br, bc, walls_set) and (br, bc) not in occupied
            if can_straight_jump:
                moves.append((br, bc))
            else:
                # Square behind is blocked by a wall, off the board, or occupied -> diagonal jumps allowed!
                perp_dirs = [(-dc, dr), (dc, -dr)]
                for pdr, pdc in perp_dirs:
                    dr_diag, dc_diag = nr + pdr, nc + pdc
                    if (
                        in_bounds(dr_diag, dc_diag)
                        and not is_passage_blocked(nr, nc, dr_diag, dc_diag, walls_set)
                        and (dr_diag, dc_diag) not in occupied
                    ):
                        moves.append((dr_diag, dc_diag))

    return sorted(list(set(moves)))


def has_path_to_goal(start_pos: Tuple[int, int], goal_fn, walls_set: Set[Tuple[int, int, str]]) -> bool:
    """BFS check to ensure there is at least one open path from start_pos to any goal cell."""
    queue = deque([start_pos])
    visited = {start_pos}

    while queue:
        cr, cc = queue.popleft()
        if goal_fn(cr, cc):
            return True

        for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nr, nc = cr + dr, cc + dc
            if in_bounds(nr, nc) and (nr, nc) not in visited:
                if not is_passage_blocked(cr, cc, nr, nc, walls_set):
                    visited.add((nr, nc))
                    queue.append((nr, nc))

    return False


def validate_wall_placement(r: int, c: int, orientation: str, walls: List[Dict[str, Any]], active_players: List[Dict[str, Any]]) -> Tuple[bool, str]:
    """Check whether placing a 2-unit wall at (r, c) with given orientation is legal."""
    if not (0 <= r <= 7 and 0 <= c <= 7):
        return False, "Vegg må plasseres innenfor brettet (rad 0-7, kolonne 0-7)."

    if orientation not in ("H", "V"):
        return False, "Ugyldig orientering (må være 'H' eller 'V')."

    # Check collisions with existing walls
    for w in walls:
        wr, wc, wo = w["r"], w["c"], w["orientation"]
        if wo == orientation:
            if orientation == "H" and wr == r and abs(wc - c) <= 1:
                return False, "Vegg overlapper med en eksisterende horisontal vegg."
            elif orientation == "V" and wc == c and abs(wr - r) <= 1:
                return False, "Vegg overlapper med en eksisterende vertikal vegg."
        else:
            # Perpendicular intersection at center
            if wr == r and wc == c:
                return False, "Vegger kan ikke krysse hverandre i samme kryss."

    # Build prospective walls set including the new wall
    prospective_walls_set = {(w["r"], w["c"], w["orientation"]) for w in walls}
    prospective_walls_set.add((r, c, orientation))

    # Pathfinding check: EVERY active player must retain a reachable path to their goal
    for idx, p in enumerate(active_players):
        pos = tuple(p["pos"])
        goal_fn = PLAYER_CONFIGS[idx]["goalFn"]
        if not has_path_to_goal(pos, goal_fn, prospective_walls_set):
            return False, f"Ugyldig vegg: Stenger alle veier til målet for {p['name']}!"

    return True, "Gyldig vegg."


class KorridorerRoom:
    def __init__(self, code: str, host_name: str, host_avatar: str, max_players: int = 4):
        self.code = code
        self.created_at = time.time()
        self.last_active = time.time()
        self.version = 1
        self.lock = threading.RLock()

        self.max_players = max(2, min(4, max_players))
        self.status = "waiting"  # waiting, active, finished
        self.current_turn = 0
        self.winner: Optional[Dict[str, Any]] = None

        self.host_id = f"p_{uuid.uuid4().hex[:8]}"
        self.players: List[Dict[str, Any]] = [
            {
                "id": self.host_id,
                "name": host_name[:18].strip() or "Spiller 1",
                "avatar": host_avatar or "charbear",
                "color": PLAYER_CONFIGS[0]["color"],
                "colorName": PLAYER_CONFIGS[0]["colorName"],
                "pos": list(PLAYER_CONFIGS[0]["start"]),
                "walls": 10,
                "goalDesc": PLAYER_CONFIGS[0]["goalDesc"],
                "isHost": True,
                "lastSeen": time.time(),
            }
        ]
        self.spectators: Dict[str, Dict[str, Any]] = {}
        self.walls: List[Dict[str, Any]] = []
        self.chat_messages: List[Dict[str, Any]] = []
        self.rematch_votes: Set[str] = set()

    def touch(self) -> None:
        self.last_active = time.time()

    def bump(self) -> None:
        self.version += 1
        self.touch()

    def get_walls_set(self) -> Set[Tuple[int, int, str]]:
        return {(w["r"], w["c"], w["orientation"]) for w in self.walls}

    def add_bot(self) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
        with self.lock:
            if self.status != "waiting":
                return False, "Kan bare legge til bot i venterommet.", None
            if len(self.players) >= self.max_players:
                return False, "Rommet er fullt.", None

            bot_idx = len(self.players)
            cfg = PLAYER_CONFIGS[bot_idx]
            bot_names = ["Bot Sigurd", "Bot Freja", "Bot Thor", "Bot Odin"]
            bot_avatars = [
                "char:h1:c_06d6a0:r2:e2:m2",
                "char:h1:c_ffd166:r3:e3:m3",
                "char:h1:c_ef476f:r1:e1:m1",
                "char:h1:c_8338ec:r3:e2:m3",
            ]

            bot_id = f"bot_{uuid.uuid4().hex[:6]}"
            name = bot_names[(bot_idx - 1) % len(bot_names)]
            avatar = bot_avatars[(bot_idx - 1) % len(bot_avatars)]

            bot_player = {
                "id": bot_id,
                "name": name,
                "avatar": avatar,
                "color": cfg["color"],
                "colorName": cfg["colorName"],
                "pos": list(cfg["start"]),
                "walls": 10 if self.max_players == 2 else 5,
                "goalDesc": cfg["goalDesc"],
                "isHost": False,
                "isBot": True,
                "lastSeen": time.time(),
            }
            self.players.append(bot_player)
            self.bump()
            return True, f"{name} ble lagt til!", bot_player

    def step_bot_if_needed(self) -> None:
        if self.status != "active":
            return
        if self.current_turn >= len(self.players):
            return
        current_player = self.players[self.current_turn]
        if not current_player.get("isBot"):
            return

        all_pos = [tuple(p["pos"]) for p in self.players]
        curr_pos = tuple(current_player["pos"])
        walls_set = self.get_walls_set()
        valid_moves = get_valid_pawn_moves(curr_pos, all_pos, walls_set)
        if not valid_moves:
            return

        bot_goal = PLAYER_CONFIGS[self.current_turn]["goalFn"]
        best_move = valid_moves[0]
        best_dist = 999
        for mr, mc in valid_moves:
            d = get_shortest_path_distance((mr, mc), bot_goal, walls_set)
            if d < best_dist:
                best_dist = d
                best_move = (mr, mc)

        self.make_pawn_move(current_player["id"], best_move[0], best_move[1])

    def start_game(self) -> Tuple[bool, str]:
        with self.lock:
            # If only host is in room, automatically add a bot so game can start immediately!
            if len(self.players) < 2:
                self.add_bot()

            # Calculate wall count per player
            num_players = len(self.players)
            walls_per_player = 10 if num_players == 2 else 6 if num_players == 3 else 5

            # Position each player at their starting slot
            for idx, p in enumerate(self.players):
                cfg = PLAYER_CONFIGS[idx]
                p["color"] = cfg["color"]
                p["colorName"] = cfg["colorName"]
                p["pos"] = list(cfg["start"])
                p["walls"] = walls_per_player
                p["goalDesc"] = cfg["goalDesc"]

            self.walls.clear()
            self.current_turn = 0
            self.status = "active"
            self.winner = None
            self.rematch_votes.clear()
            self.bump()
            # If first player is bot (rare), step it
            self.step_bot_if_needed()
            return True, "Spillet er i gang!"

    def make_pawn_move(self, player_id: str, target_r: int, target_c: int) -> Tuple[bool, str]:
        with self.lock:
            if self.status != "active":
                return False, "Partiet er ikke aktivt."

            current_player = self.players[self.current_turn]
            if current_player["id"] != player_id:
                return False, "Det er ikke din tur."

            all_pos = [tuple(p["pos"]) for p in self.players]
            curr_pos = tuple(current_player["pos"])
            walls_set = self.get_walls_set()

            valid_moves = get_valid_pawn_moves(curr_pos, all_pos, walls_set)
            if (target_r, target_c) not in valid_moves:
                return False, f"Ugyldig trekk til ({target_r}, {target_c})."

            # Apply move
            current_player["pos"] = [target_r, target_c]
            current_player["lastSeen"] = time.time()

            # Check win condition
            goal_fn = PLAYER_CONFIGS[self.current_turn]["goalFn"]
            if goal_fn(target_r, target_c):
                self.status = "finished"
                self.winner = {
                    "id": current_player["id"],
                    "name": current_player["name"],
                    "avatar": current_player["avatar"],
                    "color": current_player["color"],
                    "slot": self.current_turn,
                }
                self.bump()
                return True, f"{current_player['name']} vant partiet!"

            # Advance turn
            self.current_turn = (self.current_turn + 1) % len(self.players)
            self.bump()
            self.step_bot_if_needed()
            return True, "Trekk utført."

    def place_wall(self, player_id: str, r: int, c: int, orientation: str) -> Tuple[bool, str]:
        with self.lock:
            if self.status != "active":
                return False, "Partiet er ikke aktivt."

            current_player = self.players[self.current_turn]
            if current_player["id"] != player_id:
                return False, "Det er ikke din tur."

            if current_player["walls"] <= 0:
                return False, "Du har ingen vegger igjen å plassere."

            ok, msg = validate_wall_placement(r, c, orientation, self.walls, self.players)
            if not ok:
                return False, msg

            # Deduct wall and record
            current_player["walls"] -= 1
            current_player["lastSeen"] = time.time()
            self.walls.append({
                "r": r,
                "c": c,
                "orientation": orientation,
                "owner": current_player["id"],
                "color": current_player["color"],
            })

            # Advance turn
            self.current_turn = (self.current_turn + 1) % len(self.players)
            self.bump()
            self.step_bot_if_needed()
            return True, "Vegg plassert."

    def add_chat(self, player_id: str, text: str) -> None:
        with self.lock:
            sender_name = "Ukjent"
            sender_avatar = "charbear"
            for p in self.players:
                if p["id"] == player_id:
                    sender_name = p["name"]
                    sender_avatar = p["avatar"]
                    break
            else:
                if player_id in self.spectators:
                    sender_name = self.spectators[player_id]["name"]
                    sender_avatar = self.spectators[player_id]["avatar"]

            self.chat_messages.append({
                "id": uuid.uuid4().hex[:6],
                "sender": sender_name,
                "avatar": sender_avatar,
                "text": text[:120].strip(),
                "time": time.time(),
            })
            if len(self.chat_messages) > 30:
                self.chat_messages = self.chat_messages[-30:]
            self.bump()

    def vote_rematch(self, player_id: str) -> Tuple[bool, str]:
        with self.lock:
            self.rematch_votes.add(player_id)
            # If host or majority votes rematch, restart
            if player_id == self.host_id or len(self.rematch_votes) >= max(2, len(self.players) // 2):
                self.start_game()
                return True, "Omkamp startet!"
            self.bump()
            return True, "Stemme på omkamp registrert."

    def get_public_state(self, player_id: Optional[str] = None) -> Dict[str, Any]:
        with self.lock:
            my_role = "spectator"
            my_index: Optional[int] = None
            is_my_turn = False
            my_valid_moves: List[List[int]] = []

            for idx, p in enumerate(self.players):
                if p["id"] == player_id:
                    my_role = f"p{idx + 1}"
                    my_index = idx
                    p["lastSeen"] = time.time()
                    if self.status == "active" and self.current_turn == idx:
                        is_my_turn = True
                    break
            else:
                if player_id and player_id in self.spectators:
                    self.spectators[player_id]["lastSeen"] = time.time()

            if is_my_turn and my_index is not None:
                all_pos = [tuple(p["pos"]) for p in self.players]
                curr_pos = tuple(self.players[my_index]["pos"])
                walls_set = self.get_walls_set()
                my_valid_moves = [list(m) for m in get_valid_pawn_moves(curr_pos, all_pos, walls_set)]

            return {
                "ok": True,
                "roomCode": self.code,
                "status": self.status,
                "version": self.version,
                "maxPlayers": self.max_players,
                "currentTurn": self.current_turn,
                "players": [
                    {
                        "id": p["id"],
                        "name": p["name"],
                        "avatar": p["avatar"],
                        "color": p["color"],
                        "colorName": p["colorName"],
                        "pos": p["pos"],
                        "walls": p["walls"],
                        "goalDesc": p["goalDesc"],
                        "isHost": p["isHost"],
                    }
                    for p in self.players
                ],
                "spectatorCount": len(self.spectators),
                "walls": self.walls,
                "winner": self.winner,
                "myRole": my_role,
                "myIndex": my_index,
                "isMyTurn": is_my_turn,
                "validMoves": my_valid_moves,
                "chatMessages": self.chat_messages,
                "rematchVotes": list(self.rematch_votes),
            }


class KorridorerAPI:
    @staticmethod
    def _clean_expired_rooms() -> None:
        now = time.time()
        with _rooms_lock:
            to_remove = [
                code
                for code, room in _rooms.items()
                if (now - room.last_active > 7200) or (now - room.created_at > 21600)
            ]
            for code in to_remove:
                del _rooms[code]

    @staticmethod
    def handle_get(path: str, query: Dict[str, List[str]]) -> Optional[Tuple[int, Dict[str, Any]]]:
        KorridorerAPI._clean_expired_rooms()

        if path == "/api/korridorer/state":
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
        KorridorerAPI._clean_expired_rooms()

        if path == "/api/korridorer/create":
            host_name = str(body.get("hostName", "Spiller 1")).strip()[:18] or "Spiller 1"
            host_avatar = str(body.get("avatar", "charbear")).strip()[:200000] or "charbear"
            max_players = int(body.get("maxPlayers", 4))

            with _rooms_lock:
                available = [c for c in CLEAN_ROOM_CODES if c not in _rooms]
                code = random.choice(available) if available else "".join(random.choices(string.ascii_uppercase, k=4))

                room = KorridorerRoom(
                    code=code,
                    host_name=host_name,
                    host_avatar=host_avatar,
                    max_players=max_players,
                )
                _rooms[code] = room

            return 200, {
                "ok": True,
                "roomCode": room.code,
                "playerId": room.host_id,
                "playerIndex": 0,
                "isHost": True,
            }

        elif path == "/api/korridorer/join":
            code = str(body.get("roomCode", "")).strip().upper()
            player_name = str(body.get("playerName", "Spiller")).strip()[:18] or "Spiller"
            avatar = str(body.get("avatar", "jormundgandr")).strip()[:200000] or "jormundgandr"

            with _rooms_lock:
                room = _rooms.get(code)

            if not room:
                return 404, {"ok": False, "error": "Fant ikke Korridorer-rommet."}

            with room.lock:
                player_id = f"p_{uuid.uuid4().hex[:8]}"

                if room.status == "waiting" and len(room.players) < room.max_players:
                    idx = len(room.players)
                    cfg = PLAYER_CONFIGS[idx]
                    new_player = {
                        "id": player_id,
                        "name": player_name,
                        "avatar": avatar,
                        "color": cfg["color"],
                        "colorName": cfg["colorName"],
                        "pos": list(cfg["start"]),
                        "walls": 10 if room.max_players == 2 else 5,
                        "goalDesc": cfg["goalDesc"],
                        "isHost": False,
                        "lastSeen": time.time(),
                    }
                    room.players.append(new_player)
                    role = f"p{idx + 1}"
                    room.bump()
                    return 200, {
                        "ok": True,
                        "roomCode": room.code,
                        "playerId": player_id,
                        "playerIndex": idx,
                        "role": role,
                        "isHost": False,
                    }
                else:
                    # Join as Spectator
                    room.spectators[player_id] = {
                        "id": player_id,
                        "name": player_name,
                        "avatar": avatar,
                        "lastSeen": time.time(),
                    }
                    room.bump()
                    return 200, {
                        "ok": True,
                        "roomCode": room.code,
                        "playerId": player_id,
                        "role": "spectator",
                        "isHost": False,
                    }

        elif path == "/api/korridorer/start":
            code = str(body.get("roomCode", "")).strip().upper()
            player_id = str(body.get("playerId", "")).strip()

            with _rooms_lock:
                room = _rooms.get(code)

            if not room:
                return 404, {"ok": False, "error": "Rommet finnes ikke."}

            if room.host_id != player_id:
                return 403, {"ok": False, "error": "Kun romverten kan starte spillet."}

            ok, msg = room.start_game()
            if not ok:
                return 400, {"ok": False, "error": msg}

            return 200, {"ok": True, "message": msg, "state": room.get_public_state(player_id)}

        elif path == "/api/korridorer/bot":
            code = str(body.get("roomCode", "")).strip().upper()
            player_id = str(body.get("playerId", "")).strip()

            with _rooms_lock:
                room = _rooms.get(code)

            if not room:
                return 404, {"ok": False, "error": "Rommet finnes ikke."}

            if room.host_id != player_id:
                return 403, {"ok": False, "error": "Kun romverten kan legge til boter."}

            ok, msg, bot = room.add_bot()
            if not ok:
                return 400, {"ok": False, "error": msg}

            return 200, {"ok": True, "message": msg, "state": room.get_public_state(player_id)}

        elif path == "/api/korridorer/move":
            code = str(body.get("roomCode", "")).strip().upper()
            player_id = str(body.get("playerId", "")).strip()
            target_r = int(body.get("r", -1))
            target_c = int(body.get("c", -1))

            with _rooms_lock:
                room = _rooms.get(code)

            if not room:
                return 404, {"ok": False, "error": "Rommet finnes ikke."}

            ok, msg = room.make_pawn_move(player_id, target_r, target_c)
            if not ok:
                return 400, {"ok": False, "error": msg}

            return 200, {"ok": True, "message": msg, "state": room.get_public_state(player_id)}

        elif path == "/api/korridorer/wall":
            code = str(body.get("roomCode", "")).strip().upper()
            player_id = str(body.get("playerId", "")).strip()
            r = int(body.get("r", -1))
            c = int(body.get("c", -1))
            orientation = str(body.get("orientation", "")).strip().upper()

            with _rooms_lock:
                room = _rooms.get(code)

            if not room:
                return 404, {"ok": False, "error": "Rommet finnes ikke."}

            ok, msg = room.place_wall(player_id, r, c, orientation)
            if not ok:
                return 400, {"ok": False, "error": msg}

            return 200, {"ok": True, "message": msg, "state": room.get_public_state(player_id)}

        elif path == "/api/korridorer/chat":
            code = str(body.get("roomCode", "")).strip().upper()
            player_id = str(body.get("playerId", "")).strip()
            message = str(body.get("message", "")).strip()

            with _rooms_lock:
                room = _rooms.get(code)

            if not room:
                return 404, {"ok": False, "error": "Rommet finnes ikke."}

            if message:
                room.add_chat(player_id, message)

            return 200, {"ok": True}

        elif path == "/api/korridorer/rematch":
            code = str(body.get("roomCode", "")).strip().upper()
            player_id = str(body.get("playerId", "")).strip()

            with _rooms_lock:
                room = _rooms.get(code)

            if not room:
                return 404, {"ok": False, "error": "Rommet finnes ikke."}

            ok, msg = room.vote_rematch(player_id)
            return 200, {"ok": True, "message": msg, "state": room.get_public_state(player_id)}

        return None
