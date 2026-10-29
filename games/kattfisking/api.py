"""
Kattfisking - Backend API router
Handles all /api/daily, /api/archive, /api/practice, /api/submit,
/api/curate, /api/harvest, /api/stats, and /api/wiki-search requests.
"""

import datetime
import json
import os
import urllib.parse
import urllib.request
from typing import Any, Dict, Optional, Tuple

from . import wiki_harvester as harvester


class KattfiskingAPI:
    @staticmethod
    def seed_if_needed() -> None:
        harvester.seed_database_if_needed()

    @staticmethod
    def handle_get(path: str, query: Dict[str, Any]) -> Optional[Tuple[int, Any]]:
        # Normalize route (both /api/daily and /api/kattfisking/daily supported)
        rel_path = path
        if rel_path.startswith("/api/kattfisking/"):
            rel_path = "/api/" + rel_path[len("/api/kattfisking/"):]

        today_str = datetime.date.today().isoformat()

        if rel_path == "/api/daily":
            req_date = (query.get("date", [today_str])[0] or today_str).strip()
            try:
                parsed_date = datetime.date.fromisoformat(req_date)
                if parsed_date > datetime.date.today():
                    req_date = today_str
            except ValueError:
                req_date = today_str

            puzzle = harvester.ensure_daily_puzzle(req_date)
            if not puzzle:
                return 503, {"error": "Kunne ikke generere dagens utfordring (for få artikler)."}

            puzzle["today"] = today_str
            return 200, puzzle

        if rel_path == "/api/archive":
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
            return 200, {"today": today_str, "puzzles": archive_list}

        if rel_path == "/api/practice":
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
                return 404, {"error": "Ingen artikler tilgjengelig."}

            return 200, {"article": harvester.format_article_row(dict(row))}

        if rel_path == "/api/wiki-search":
            q = (query.get("q", [""])[0] or "").strip()
            if len(q) < 2:
                return 200, {"suggestions": []}

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
                    return 200, {"suggestions": suggestions}
            except Exception:
                return 200, {"suggestions": []}

        if rel_path == "/api/stats":
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
            return 200, {
                "totalArticles": total_articles,
                "unusedArticles": unused_articles,
                "totalPuzzles": total_puzzles,
                "totalPlays": total_plays,
            }

        return None

    @staticmethod
    def handle_post(path: str, body: Dict[str, Any]) -> Optional[Tuple[int, Any]]:
        rel_path = path
        if rel_path.startswith("/api/kattfisking/"):
            rel_path = "/api/" + rel_path[len("/api/kattfisking/"):]

        today_str = datetime.date.today().isoformat()

        if rel_path == "/api/submit":
            date_str = str(body.get("date") or today_str)
            results = body.get("results")
            if not isinstance(results, list) or len(results) == 0:
                return 400, {"error": "Ugyldig resultatliste."}

            clean_results = [max(0.0, min(1.0, float(x))) for x in results[:10]]
            total_score = round(sum(clean_results), 2)
            results_json = json.dumps(clean_results)

            conn = harvester.get_db_connection()
            existing = conn.execute(
                "SELECT id FROM puzzle_submissions WHERE date = ? AND total_score = ? AND results_json = ? LIMIT 1",
                (date_str, total_score, results_json),
            ).fetchone()
            if not existing:
                with conn:
                    conn.execute(
                        "INSERT INTO puzzle_submissions (date, total_score, results_json) VALUES (?, ?, ?)",
                        (date_str, total_score, results_json),
                    )

            subs = conn.execute(
                "SELECT total_score FROM puzzle_submissions WHERE date = ?",
                (date_str,),
            ).fetchall()
            conn.close()
            actual_scores = [float(s["total_score"]) for s in subs]
            stats = harvester.calculate_score_distribution(
                actual_scores, user_score=total_score, date_str=date_str, max_score=10
            )

            puzzle = harvester.ensure_daily_puzzle(date_str)
            return 200, {
                "ok": True,
                "totalPlays": stats["totalPlays"],
                "averageScore": stats["averageScore"],
                "percentile": stats["percentile"],
                "betterThanPct": stats["betterThanPct"],
                "distribution": stats["distribution"],
                "userScore": total_score,
                "stats": stats,
                "articles": puzzle["articles"] if puzzle else [],
            }

        if rel_path == "/api/curate":
            title = (body.get("title") or "").strip()
            preview_only = bool(body.get("previewOnly", False))
            if not title:
                return 400, {"error": "Mangler artikkeltittel."}

            fetched = harvester.fetch_mediawiki_articles([title])
            if not fetched:
                return 400, {
                    "error": (
                        f"Fant ikke «{title}» på norsk Wikipedia, eller artikkelen har "
                        "for få gyldige kategorier (minimum 4 kategorier etter filtrering)."
                    )
                }

            art = fetched[0]
            if not preview_only:
                harvester.save_articles_to_db([art], is_curated=True)

            return 200, {
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

        if rel_path == "/api/harvest":
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
            return 200, {"ok": True, "added": added}

        return None
