#!/usr/bin/env python3
"""
Kattfisking HTTP Server (Zero-dependency Python 3 + SQLite)
Designed for lightweight hosting on a Raspberry Pi.
"""

import datetime
import json
import mimetypes
import os
import traceback
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict, Optional

import wiki_harvester as harvester

PORT = int(os.environ.get("PORT", "3000"))
HOST = os.environ.get("HOST", "0.0.0.0")
PUBLIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public")
mimetypes.add_type("font/ttf", ".ttf")


class KattfiskingHandler(BaseHTTPRequestHandler):
    server_version = "KattfiskingPi/1.0"

    def log_message(self, fmt: str, *args: Any) -> None:
        # Quiet static asset logs unless error
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

    def do_GET(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        try:
            if path == "/api/daily":
                self.handle_get_daily(query)
            elif path == "/api/archive":
                self.handle_get_archive()
            elif path == "/api/practice":
                self.handle_get_practice(query)
            elif path == "/api/wiki-search":
                self.handle_wiki_search(query)
            elif path == "/api/stats":
                self.handle_get_stats()
            else:
                self.serve_static(path)
        except Exception as exc:
            traceback.print_exc()
            self._send_json({"error": str(exc)}, status=500)

    def do_POST(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        try:
            if path == "/api/submit":
                self.handle_post_submit()
            elif path == "/api/curate":
                self.handle_post_curate()
            elif path == "/api/harvest":
                self.handle_post_harvest()
            else:
                self._send_json({"error": "Not found"}, status=404)
        except Exception as exc:
            traceback.print_exc()
            self._send_json({"error": str(exc)}, status=500)

    def handle_get_daily(self, query: Dict[str, Any]) -> None:
        today_str = datetime.date.today().isoformat()
        req_date = (query.get("date", [today_str])[0] or today_str).strip()
        # Validate YYYY-MM-DD format and prevent future dates
        try:
            parsed_date = datetime.date.fromisoformat(req_date)
            if parsed_date > datetime.date.today():
                req_date = today_str
        except ValueError:
            req_date = today_str

        puzzle = harvester.ensure_daily_puzzle(req_date)
        if not puzzle:
            self._send_json(
                {"error": "Kunne ikke generere dagens utfordring (for få artikler i databasen)."},
                status=503,
            )
            return

        puzzle["today"] = today_str
        self._send_json(puzzle)

    def handle_get_archive(self) -> None:
        today_str = datetime.date.today().isoformat()
        # Ensure today's puzzle is ready
        harvester.ensure_daily_puzzle(today_str)

        conn = harvester.get_db_connection()
        rows = conn.execute(
            """
            SELECT
                dp.date,
                dp.puzzle_number,
                COUNT(ps.id) AS total_plays,
                ROUND(AVG(ps.total_score), 2) AS avg_score
            FROM daily_puzzles dp
            LEFT JOIN puzzle_submissions ps ON ps.date = dp.date
            WHERE dp.date <= ?
            GROUP BY dp.date, dp.puzzle_number
            ORDER BY dp.date DESC
            """,
            (today_str,),
        ).fetchall()
        conn.close()

        archive_list = [
            {
                "date": r["date"],
                "puzzleNumber": r["puzzle_number"],
                "totalPlays": r["total_plays"],
                "averageScore": r["avg_score"],
            }
            for r in rows
        ]
        self._send_json({"today": today_str, "puzzles": archive_list})

    def handle_get_practice(self, query: Dict[str, Any]) -> None:
        exclude_raw = query.get("exclude", [""])[0]
        exclude_ids = [
            int(x) for x in exclude_raw.split(",") if x.strip().isdigit()
        ][:200]

        conn = harvester.get_db_connection()
        if exclude_ids:
            placeholders = ",".join("?" for _ in exclude_ids)
            row = conn.execute(
                f"SELECT * FROM articles WHERE id NOT IN ({placeholders}) ORDER BY RANDOM() LIMIT 1",
                exclude_ids,
            ).fetchone()
        else:
            row = None

        if not row:
            row = conn.execute(
                "SELECT * FROM articles ORDER BY RANDOM() LIMIT 1"
            ).fetchone()
        conn.close()

        if not row:
            self._send_json({"error": "Ingen artikler tilgjengelig."}, status=404)
            return

        self._send_json({"article": harvester.format_article_row(dict(row))})

    def handle_post_submit(self) -> None:
        body = self._read_json_body()
        date_str = str(body.get("date") or datetime.date.today().isoformat())
        results = body.get("results")
        if not isinstance(results, list) or len(results) == 0:
            self._send_json({"error": "Ugyldig resultatliste."}, status=400)
            return

        clean_results = [max(0.0, min(1.0, float(x))) for x in results[:10]]
        total_score = round(sum(clean_results), 2)

        conn = harvester.get_db_connection()
        with conn:
            conn.execute(
                "INSERT INTO puzzle_submissions (date, total_score, results_json) VALUES (?, ?, ?)",
                (date_str, total_score, json.dumps(clean_results)),
            )
        conn.close()

        puzzle = harvester.ensure_daily_puzzle(date_str)
        self._send_json(
            {
                "ok": True,
                "totalPlays": puzzle["totalPlays"] if puzzle else 1,
                "averageScore": puzzle["averageScore"] if puzzle else total_score,
                "articles": puzzle["articles"] if puzzle else [],
            }
        )

    def handle_wiki_search(self, query: Dict[str, Any]) -> None:
        q = (query.get("q", [""])[0] or "").strip()
        if len(q) < 2:
            self._send_json({"suggestions": []})
            return

        params = urllib.parse.urlencode(
            {
                "action": "opensearch",
                "format": "json",
                "search": q,
                "limit": "8",
                "namespace": "0",
            }
        )
        url = f"https://no.wikipedia.org/w/api.php?{params}"
        req = urllib.request.Request(url, headers={"User-Agent": harvester.USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=6) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                suggestions = data[1] if isinstance(data, list) and len(data) > 1 else []
                self._send_json({"suggestions": suggestions})
        except Exception:
            self._send_json({"suggestions": []})

    def handle_post_curate(self) -> None:
        body = self._read_json_body()
        title = (body.get("title") or "").strip()
        preview_only = bool(body.get("previewOnly", False))
        if not title:
            self._send_json({"error": "Mangler artikkeltittel."}, status=400)
            return

        fetched = harvester.fetch_mediawiki_articles([title])
        if not fetched:
            self._send_json(
                {
                    "error": (
                        f"Fant ikke «{title}» på norsk Wikipedia, eller artikkelen har "
                        "for få gyldige kategorier (minimum 4 kategorier etter filtrering)."
                    )
                },
                status=400,
            )
            return

        art = fetched[0]
        if not preview_only:
            harvester.save_articles_to_db([art], is_curated=True)

        self._send_json(
            {
                "ok": True,
                "saved": not preview_only,
                "article": {
                    "pageId": art["page_id"],
                    "title": art["title"],
                    "cleanTitle": art["clean_title"],
                    "categories": art["categories"],
                    "hiddenCategories": art["hidden_categories"],
                    "aliases": art["aliases"],
                    "extract": art["extract"],
                    "thumbnailUrl": art["thumbnail_url"],
                    "wikiUrl": art["wiki_url"],
                },
            }
        )

    def handle_post_harvest(self) -> None:
        pop_map = harvester.fetch_popular_norwegian_titles(days_back=2, limit_per_day=50)
        conn = harvester.get_db_connection()
        existing = {
            r["title"] for r in conn.execute("SELECT title FROM articles").fetchall()
        }
        conn.close()
        candidates = [t for t in pop_map.keys() if t not in existing][:40]
        added = 0
        if candidates:
            fetched = harvester.fetch_mediawiki_articles(candidates)
            added = harvester.save_articles_to_db(fetched, views_map=pop_map)
        self._send_json({"ok": True, "added": added})

    def handle_get_stats(self) -> None:
        conn = harvester.get_db_connection()
        total_articles = conn.execute("SELECT COUNT(*) AS c FROM articles").fetchone()["c"]
        unused_articles = conn.execute(
            "SELECT COUNT(*) AS c FROM articles WHERE used_date IS NULL"
        ).fetchone()["c"]
        total_puzzles = conn.execute("SELECT COUNT(*) AS c FROM daily_puzzles").fetchone()["c"]
        total_plays = conn.execute(
            "SELECT COUNT(*) AS c FROM puzzle_submissions"
        ).fetchone()["c"]
        conn.close()
        self._send_json(
            {
                "totalArticles": total_articles,
                "unusedArticles": unused_articles,
                "totalPuzzles": total_puzzles,
                "totalPlays": total_plays,
            }
        )

    def serve_static(self, req_path: str) -> None:
        if req_path in ("", "/"):
            req_path = "/index.html"
        safe_rel = os.path.normpath(req_path.lstrip("/"))
        if safe_rel.startswith(".."):
            self._send_json({"error": "Forbidden"}, status=403)
            return

        full_path = os.path.join(PUBLIC_DIR, safe_rel)
        if not os.path.isfile(full_path):
            # SPA fallback to index.html
            full_path = os.path.join(PUBLIC_DIR, "index.html")
            if not os.path.isfile(full_path):
                self._send_json({"error": "Not found"}, status=404)
                return

        ctype, _ = mimetypes.guess_type(full_path)
        if not ctype:
            ctype = "application/octet-stream"
        if ctype.startswith("text/") or ctype in ("application/javascript", "application/json"):
            ctype += "; charset=utf-8"

        with open(full_path, "rb") as f:
            content = f.read()

        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(content)))
        if safe_rel.endswith((".js", ".css", ".html")) or not safe_rel:
            self.send_header("Cache-Control", "no-cache, must-revalidate")
        self.end_headers()
        self.wfile.write(content)


def main() -> None:
    harvester.seed_database_if_needed()
    try:
        server = ThreadingHTTPServer((HOST, PORT), KattfiskingHandler)
    except OSError as exc:
        if exc.errno == 98 or getattr(exc, "winerror", None) == 10048:
            print(f"\n❌ Port {PORT} er allerede i bruk!")
            print(f"👉 Kattfisking kjører antakeligvis allerede på http://localhost:{PORT}")
            print(f"   For å restarte:     ./start.sh restart (eller fuser -k {PORT}/tcp)")
            print(f"   For en annen port:  PORT={PORT + 1} ./start.sh\n")
            return
        raise

    print(f"🐈🐟 Kattfisking-server kjører på http://{HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nAvslutter Kattfisking-server...")
        server.server_close()


if __name__ == "__main__":
    main()
