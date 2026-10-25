#!/usr/bin/env python3
"""
Spillhjørnet - Multi-game HTTP Gateway Server
Mounts the main hub and modular games from the `games/` directory.
Zero external dependencies, designed for Raspberry Pi & lightweight hosting.
"""

import json
import mimetypes
import os
import traceback
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict, Optional, Tuple

from games.kattfisking import KattfiskingAPI
from games.mer_eller_mindre import MerEllerMindreAPI
from games.geoguesser import GeoguesserAPI

PORT = int(os.environ.get("PORT", "3000"))
HOST = os.environ.get("HOST", "0.0.0.0")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
HUB_DIR = os.path.join(BASE_DIR, "hub")
GAMES_DIR = os.path.join(BASE_DIR, "games")

mimetypes.add_type("font/ttf", ".ttf")
mimetypes.add_type("image/svg+xml", ".svg")


class GameGatewayHandler(BaseHTTPRequestHandler):
    server_version = "SpillhjornetPi/1.0"

    def log_message(self, fmt: str, *args: Any) -> None:
        # Quiet normal static requests, log warnings & errors
        if len(args) >= 2 and str(args[1]).startswith(("4", "5")):
            super().log_message(fmt, *args)

    def _send_json(self, data: Any, status: int = 200) -> None:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _read_json_body(self) -> Dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            return {}
        raw = self.rfile.read(length).decode("utf-8")
        return json.loads(raw)

    def do_HEAD(self) -> None:
        self.do_GET(head_only=True)

    def do_GET(self, head_only: bool = False) -> None:
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        try:
            # 1. Check Kattfisking API (legacy and namespaced paths)
            if path.startswith("/api/kattfisking/") or path in (
                "/api/daily",
                "/api/archive",
                "/api/practice",
                "/api/wiki-search",
                "/api/stats",
            ):
                res = KattfiskingAPI.handle_get(path, query)
                if res:
                    return self._send_json(res[1], status=res[0])

            # 2. Check Mer eller Mindre API
            if path.startswith("/api/mer-eller-mindre/"):
                res = MerEllerMindreAPI.handle_get(path, query)
                if res:
                    return self._send_json(res[1], status=res[0])

            # 3. Check Geoguesser API
            if path.startswith("/api/geoguesser/"):
                res = GeoguesserAPI.handle_get(path, query)
                if res:
                    return self._send_json(res[1], status=res[0])

            # 4. Static files
            self.serve_static(path, head_only=head_only)

        except Exception as exc:
            traceback.print_exc()
            self._send_json({"error": str(exc)}, status=500)

    def do_POST(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        try:
            body = self._read_json_body()

            # 1. Check Kattfisking API
            if path.startswith("/api/kattfisking/") or path in (
                "/api/submit",
                "/api/curate",
                "/api/harvest",
            ):
                res = KattfiskingAPI.handle_post(path, body)
                if res:
                    return self._send_json(res[1], status=res[0])

            # 2. Check Mer eller Mindre API
            if path.startswith("/api/mer-eller-mindre/"):
                res = MerEllerMindreAPI.handle_post(path, body)
                if res:
                    return self._send_json(res[1], status=res[0])

            # 3. Check Geoguesser API
            if path.startswith("/api/geoguesser/"):
                res = GeoguesserAPI.handle_post(path, body)
                if res:
                    return self._send_json(res[1], status=res[0])

            self._send_json({"error": "Endepunkt finnes ikke."}, status=404)

        except Exception as exc:
            traceback.print_exc()
            self._send_json({"error": str(exc)}, status=500)

    def serve_static(self, req_path: str, head_only: bool = False) -> None:
        safe_rel = os.path.normpath(req_path.lstrip("/"))
        if safe_rel.startswith(".."):
            self._send_json({"error": "Forbidden"}, status=403)
            return

        # Check if the request is for a specific game under games/<game_name>/
        game_names = [
            d for d in os.listdir(GAMES_DIR) if os.path.isdir(os.path.join(GAMES_DIR, d))
        ]

        full_path: Optional[str] = None

        for game in game_names:
            game_slug = game.replace("_", "-")
            clean_rel = safe_rel.rstrip("/\\")
            matches_route = (clean_rel == game or clean_rel == game_slug)
            starts_route = (
                safe_rel.startswith(game + "/")
                or safe_rel.startswith(game_slug + "/")
                or safe_rel.startswith(game + "\\")
                or safe_rel.startswith(game_slug + "\\")
            )

            if matches_route:
                if not req_path.endswith("/"):
                    self.send_response(301)
                    self.send_header("Location", f"/{game_slug}/")
                    self.end_headers()
                    return
                full_path = os.path.join(GAMES_DIR, game, "index.html")
                break

            if starts_route:
                prefix_len = len(game if safe_rel.startswith(game) else game_slug) + 1
                sub_rel = safe_rel[prefix_len:]
                target = os.path.join(GAMES_DIR, game, sub_rel)
                if os.path.isdir(target):
                    target = os.path.join(target, "index.html")
                if os.path.isfile(target):
                    full_path = target
                    break

        # If not a game file, resolve from hub directory
        if not full_path:
            if safe_rel in ("", "."):
                candidate = os.path.join(HUB_DIR, "index.html")
            else:
                candidate = os.path.join(HUB_DIR, safe_rel)

            if os.path.isdir(candidate):
                candidate = os.path.join(candidate, "index.html")

            if os.path.isfile(candidate):
                full_path = candidate
            elif safe_rel.startswith("background/") and os.path.isfile(os.path.join(BASE_DIR, safe_rel)):
                full_path = os.path.join(BASE_DIR, safe_rel)
            else:
                # Fallback to hub index.html for root SPA navigation
                hub_index = os.path.join(HUB_DIR, "index.html")
                if os.path.isfile(hub_index) and not safe_rel.startswith("api/"):
                    full_path = hub_index
                else:
                    self._send_json({"error": "Fil ikke funnet"}, status=404)
                    return

        ctype, _ = mimetypes.guess_type(full_path)
        if not ctype:
            ctype = "application/octet-stream"
        if ctype.startswith("text/") or ctype in (
            "application/javascript",
            "application/json",
        ):
            ctype += "; charset=utf-8"

        try:
            with open(full_path, "rb") as f:
                content = f.read()
        except OSError:
            self._send_json({"error": "Kunne ikke lese fil"}, status=500)
            return

        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(content)))
        if full_path.endswith((".js", ".css", ".html")):
            self.send_header("Cache-Control", "no-cache, must-revalidate")
        self.end_headers()

        if not head_only:
            self.wfile.write(content)


def main() -> None:
    # Ensure Kattfisking database seed if needed
    KattfiskingAPI.seed_if_needed()

    try:
        server = ThreadingHTTPServer((HOST, PORT), GameGatewayHandler)
    except OSError as exc:
        if exc.errno == 98 or getattr(exc, "winerror", None) == 10048:
            print(f"\n❌ Port {PORT} er allerede i bruk!")
            print(f"👉 Serveren kjører antakeligvis allerede på http://localhost:{PORT}")
            print(f"   For å restarte:     ./start.sh restart")
            print(f"   For en annen port:  PORT={PORT + 1} ./start.sh\n")
            return
        raise

    print(f"🎮 NTNU Games kjører på http://{HOST}:{PORT}")
    print(f"   • Hub:          http://{HOST}:{PORT}/")
    print(f"   • Kattfisking:  http://{HOST}:{PORT}/kattfisking/")
    print(f"   • Mer/Mindre:   http://{HOST}:{PORT}/mer-eller-mindre/")
    print(f"   • NTNU guesser: http://{HOST}:{PORT}/geoguesser/ (under utvikling)\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nAvslutter NTNU Games...")
        server.server_close()


if __name__ == "__main__":
    main()
