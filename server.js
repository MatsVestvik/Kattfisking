#!/usr/bin/env node
/**
 * Kattfisking - Node.js HTTP Server (Zero npm dependencies)
 * Uses built-in Node.js modules + SQLite (via sqlite3 / wiki_harvester.py)
 * so it runs out of the box on any Raspberry Pi without native C++ compilation.
 */

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC_DIR = path.join(__dirname, "public");
const DB_PATH =
  process.env.KATTFISKING_DB || path.join(__dirname, "data", "kattfisking.db");
const USER_AGENT =
  "Kattfisking/1.0 (https://github.com/kattfisking; RaspberryPi trivia game)";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
};

/**
 * Helper that runs a Python one-liner against wiki_harvester.py & SQLite
 * so Node.js and Python share the exact same database and Wikipedia filtering logic.
 */
function runDbAction(action, payload = {}) {
  const script = `
import sys, json, datetime, wiki_harvester as h

action = sys.argv[1]
payload = json.loads(sys.argv[2])
today_str = datetime.date.today().isoformat()

if action == "daily":
    req_date = (payload.get("date") or today_str).strip()
    try:
        if datetime.date.fromisoformat(req_date) > datetime.date.today():
            req_date = today_str
    except Exception:
        req_date = today_str
    puzzle = h.ensure_daily_puzzle(req_date)
    if puzzle:
        puzzle["today"] = today_str
    print(json.dumps(puzzle, ensure_ascii=False))

elif action == "archive":
    h.ensure_daily_puzzle(today_str)
    conn = h.get_db_connection()
    rows = conn.execute("""
        SELECT dp.date, dp.puzzle_number, COUNT(ps.id) AS total_plays, ROUND(AVG(ps.total_score), 2) AS avg_score
        FROM daily_puzzles dp
        LEFT JOIN puzzle_submissions ps ON ps.date = dp.date
        WHERE dp.date <= ?
        GROUP BY dp.date, dp.puzzle_number
        ORDER BY dp.date DESC
    """, (today_str,)).fetchall()
    conn.close()
    print(json.dumps({
        "today": today_str,
        "puzzles": [{
            "date": r["date"],
            "puzzleNumber": r["puzzle_number"],
            "totalPlays": r["total_plays"],
            "averageScore": r["avg_score"]
        } for r in rows]
    }, ensure_ascii=False))

elif action == "practice":
    ex = [int(x) for x in str(payload.get("exclude", "")).split(",") if x.strip().isdigit()][:200]
    conn = h.get_db_connection()
    row = None
    if ex:
        ph = ",".join("?" for _ in ex)
        row = conn.execute(f"SELECT * FROM articles WHERE id NOT IN ({ph}) ORDER BY RANDOM() LIMIT 1", ex).fetchone()
    if not row:
        row = conn.execute("SELECT * FROM articles ORDER BY RANDOM() LIMIT 1").fetchone()
    conn.close()
    print(json.dumps({"article": h.format_article_row(dict(row)) if row else None}, ensure_ascii=False))

elif action == "submit":
    date_str = str(payload.get("date") or today_str)
    results = [max(0.0, min(1.0, float(x))) for x in (payload.get("results") or [])[:10]]
    total_score = round(sum(results), 2)
    conn = h.get_db_connection()
    with conn:
        conn.execute(
            "INSERT INTO puzzle_submissions (date, total_score, results_json) VALUES (?, ?, ?)",
            (date_str, total_score, json.dumps(results))
        )
    conn.close()
    puzzle = h.ensure_daily_puzzle(date_str)
    print(json.dumps({
        "ok": True,
        "totalPlays": puzzle["totalPlays"] if puzzle else 1,
        "averageScore": puzzle["averageScore"] if puzzle else total_score,
        "articles": puzzle["articles"] if puzzle else []
    }, ensure_ascii=False))

elif action == "curate":
    title = (payload.get("title") or "").strip()
    preview_only = bool(payload.get("previewOnly", False))
    fetched = h.fetch_mediawiki_articles([title])
    if not fetched:
        print(json.dumps({"error": f"Fant ikke «{title}» på norsk Wikipedia, eller artikkelen har for få gyldige kategorier (minimum 4)."}, ensure_ascii=False))
    else:
        art = fetched[0]
        if not preview_only:
            h.save_articles_to_db([art], is_curated=True)
        print(json.dumps({
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
                "wikiUrl": art["wiki_url"]
            }
        }, ensure_ascii=False))

elif action == "harvest":
    pop_map = h.fetch_popular_norwegian_titles(days_back=2, limit_per_day=50)
    conn = h.get_db_connection()
    existing = {r["title"] for r in conn.execute("SELECT title FROM articles").fetchall()}
    conn.close()
    candidates = [t for t in pop_map.keys() if t not in existing][:40]
    added = 0
    if candidates:
        fetched = h.fetch_mediawiki_articles(candidates)
        added = h.save_articles_to_db(fetched, views_map=pop_map)
    print(json.dumps({"ok": True, "added": added}))

elif action == "stats":
    conn = h.get_db_connection()
    ta = conn.execute("SELECT COUNT(*) AS c FROM articles").fetchone()["c"]
    ua = conn.execute("SELECT COUNT(*) AS c FROM articles WHERE used_date IS NULL").fetchone()["c"]
    tp = conn.execute("SELECT COUNT(*) AS c FROM daily_puzzles").fetchone()["c"]
    ts = conn.execute("SELECT COUNT(*) AS c FROM puzzle_submissions").fetchone()["c"]
    conn.close()
    print(json.dumps({"totalArticles": ta, "unusedArticles": ua, "totalPuzzles": tp, "totalPlays": ts}))
`;
  const out = execFileSync(
    "python3",
    ["-c", script, action, JSON.stringify(payload)],
    {
      cwd: __dirname,
      encoding: "utf-8",
      env: { ...process.env, KATTFISKING_DB: DB_PATH },
    }
  );
  return JSON.parse(out.trim());
}

function sendJson(res, data, status = 200) {
  const body = Buffer.from(JSON.stringify(data), "utf-8");
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) req.destroy();
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

// Seed database on startup if needed
execFileSync("python3", [path.join(__dirname, "wiki_harvester.py")], {
  stdio: "inherit",
});

const server = http.createServer(async (req, res) => {
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const pathname = parsedUrl.pathname;

    if (req.method === "GET" && pathname === "/api/daily") {
      const date = parsedUrl.searchParams.get("date") || "";
      const data = runDbAction("daily", { date });
      return sendJson(res, data, data ? 200 : 503);
    }

    if (req.method === "GET" && pathname === "/api/archive") {
      return sendJson(res, runDbAction("archive"));
    }

    if (req.method === "GET" && pathname === "/api/practice") {
      const exclude = parsedUrl.searchParams.get("exclude") || "";
      return sendJson(res, runDbAction("practice", { exclude }));
    }

    if (req.method === "GET" && pathname === "/api/wiki-search") {
      const q = (parsedUrl.searchParams.get("q") || "").trim();
      if (q.length < 2) return sendJson(res, { suggestions: [] });
      const wikiUrl = `https://no.wikipedia.org/w/api.php?action=opensearch&format=json&search=${encodeURIComponent(
        q
      )}&limit=8&namespace=0`;
      const wikiRes = await fetch(wikiUrl, {
        headers: { "User-Agent": USER_AGENT },
      });
      const wikiData = await wikiRes.json();
      return sendJson(res, {
        suggestions: Array.isArray(wikiData[1]) ? wikiData[1] : [],
      });
    }

    if (req.method === "GET" && pathname === "/api/stats") {
      return sendJson(res, runDbAction("stats"));
    }

    if (req.method === "POST" && pathname === "/api/submit") {
      const body = await readJsonBody(req);
      return sendJson(res, runDbAction("submit", body));
    }

    if (req.method === "POST" && pathname === "/api/curate") {
      const body = await readJsonBody(req);
      const result = runDbAction("curate", body);
      return sendJson(res, result, result.error ? 400 : 200);
    }

    if (req.method === "POST" && pathname === "/api/harvest") {
      return sendJson(res, runDbAction("harvest"));
    }

    // Serve static files from public/
    let relPath = pathname === "/" ? "/index.html" : pathname;
    const safePath = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, "");
    let fullPath = path.join(PUBLIC_DIR, safePath);

    if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
      fullPath = path.join(PUBLIC_DIR, "index.html");
    }

    const ext = path.extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const headers = {
      "Content-Type": contentType,
      "Content-Length": content.length,
    };
    if ([".js", ".css", ".html"].includes(ext) || !safePath) {
      headers["Cache-Control"] = "no-cache, must-revalidate";
    }
    res.writeHead(200, headers);
    res.end(content);
  } catch (err) {
    console.error(err);
    sendJson(res, { error: String(err.message || err) }, 500);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`🐈🐟 Kattfisking (Node.js) kjører på http://${HOST}:${PORT}`);
});
