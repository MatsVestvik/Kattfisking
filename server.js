#!/usr/bin/env node
/**
 * Spillhjørnet - Node.js Multi-Game HTTP Gateway Server
 * Zero npm dependencies, built for Raspberry Pi & modern web hosting.
 */

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";

const BASE_DIR = __dirname;
const HUB_DIR = path.join(BASE_DIR, "hub");
const GAMES_DIR = path.join(BASE_DIR, "games");

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

function runKattfiskingDbAction(action, payload = {}) {
  const script = `
import sys, json, datetime
sys.path.insert(0, ${JSON.stringify(path.join(GAMES_DIR, "kattfisking"))})
import wiki_harvester as h

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
        print(json.dumps({"error": f"Fant ikke «{title}» på norsk Wikipedia."}, ensure_ascii=False))
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
    { cwd: BASE_DIR, encoding: "utf-8" }
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

// Seed Kattfisking database on startup if python3 exists
try {
  execFileSync(
    "python3",
    [path.join(GAMES_DIR, "kattfisking", "wiki_harvester.py")],
    { stdio: "inherit" }
  );
} catch (e) {
  console.warn("Could not seed Kattfisking database automatically", e.message);
}

const server = http.createServer(async (req, res) => {
  try {
    const parsedUrl = new URL(
      req.url,
      `http://${req.headers.host || "localhost"}`
    );
    const pathname = parsedUrl.pathname;

    // Kattfisking API endpoints
    if (
      req.method === "GET" &&
      (pathname === "/api/daily" || pathname === "/api/kattfisking/daily")
    ) {
      const date = parsedUrl.searchParams.get("date") || "";
      const data = runKattfiskingDbAction("daily", { date });
      return sendJson(res, data, data ? 200 : 503);
    }

    if (
      req.method === "GET" &&
      (pathname === "/api/archive" || pathname === "/api/kattfisking/archive")
    ) {
      return sendJson(res, runKattfiskingDbAction("archive"));
    }

    if (
      req.method === "GET" &&
      (pathname === "/api/practice" || pathname === "/api/kattfisking/practice")
    ) {
      const exclude = parsedUrl.searchParams.get("exclude") || "";
      return sendJson(res, runKattfiskingDbAction("practice", { exclude }));
    }

    if (
      req.method === "GET" &&
      (pathname === "/api/stats" || pathname === "/api/kattfisking/stats")
    ) {
      return sendJson(res, runKattfiskingDbAction("stats"));
    }

    if (
      req.method === "POST" &&
      (pathname === "/api/submit" || pathname === "/api/kattfisking/submit")
    ) {
      const body = await readJsonBody(req);
      return sendJson(res, runKattfiskingDbAction("submit", body));
    }

    if (
      req.method === "POST" &&
      (pathname === "/api/curate" || pathname === "/api/kattfisking/curate")
    ) {
      const body = await readJsonBody(req);
      const result = runKattfiskingDbAction("curate", body);
      return sendJson(res, result, result.error ? 400 : 200);
    }

    if (
      req.method === "POST" &&
      (pathname === "/api/harvest" || pathname === "/api/kattfisking/harvest")
    ) {
      return sendJson(res, runKattfiskingDbAction("harvest"));
    }

    if (req.method === "GET" && (pathname === "/api/wiki-search" || pathname === "/api/kattfisking/wiki-search")) {
      const q = (parsedUrl.searchParams.get("q") || "").trim();
      if (q.length < 2) return sendJson(res, { suggestions: [] });
      const wikiUrl = `https://no.wikipedia.org/w/api.php?action=opensearch&format=json&search=${encodeURIComponent(
        q
      )}&limit=8&namespace=0`;
      const wikiRes = await fetch(wikiUrl, {
        headers: {
          "User-Agent":
            "Kattfisking/1.0 (https://github.com/kattfisking; trivia game)",
        },
      });
      const wikiData = await wikiRes.json();
      return sendJson(res, {
        suggestions: Array.isArray(wikiData[1]) ? wikiData[1] : [],
      });
    }

    // Mer eller Mindre API endpoints
    if (
      req.method === "GET" &&
      (pathname === "/api/mer-eller-mindre/daily" ||
        pathname === "/api/mer-eller-mindre/practice" ||
        pathname === "/api/mer-eller-mindre/status" ||
        pathname === "/api/mer-eller-mindre/stats")
    ) {
      const date = parsedUrl.searchParams.get("date") || "";
      const isDaily = pathname.includes("daily");
      const isStats = pathname.includes("stats");
      const script = `
import sys, json, os
sys.path.insert(0, ${JSON.stringify(path.join(GAMES_DIR, "mer_eller_mindre"))})
import api

action = sys.argv[1]
if action == "daily":
    pack = api.generate_game_pack(seed_str=f"mer_eller_mindre_{sys.argv[2]}")
    pack["date"] = sys.argv[2]
    pack["isDaily"] = True
    pack["stats"] = api.calculate_mer_eller_mindre_stats(sys.argv[2])
    print(json.dumps(pack, ensure_ascii=False))
elif action == "practice":
    pack = api.generate_game_pack()
    pack["isDaily"] = False
    print(json.dumps(pack, ensure_ascii=False))
elif action == "stats":
    stats = api.calculate_mer_eller_mindre_stats(sys.argv[2])
    print(json.dumps(stats, ensure_ascii=False))
else:
    print(json.dumps({"ok": True, "game": "mer-eller-mindre"}))
`;
      const out = execFileSync(
        "python3",
        [
          "-c",
          script,
          isDaily ? "daily" : isStats ? "stats" : pathname.includes("status") ? "status" : "practice",
          date || new Date().toISOString().split("T")[0],
        ],
        { encoding: "utf-8" }
      );
      return sendJson(res, JSON.parse(out.trim()));
    }

    if (
      req.method === "POST" &&
      pathname === "/api/mer-eller-mindre/submit"
    ) {
      const body = await readJsonBody(req);
      const script = `
import sys, json, os
sys.path.insert(0, ${JSON.stringify(path.join(GAMES_DIR, "mer_eller_mindre"))})
import api

payload = json.loads(sys.argv[1])
code, res = api.MerEllerMindreAPI.handle_post("/api/submit", payload)
print(json.dumps(res, ensure_ascii=False))
`;
      const out = execFileSync(
        "python3",
        ["-c", script, JSON.stringify(body)],
        { encoding: "utf-8" }
      );
      return sendJson(res, JSON.parse(out.trim()));
    }

    // Static file serving: Check games/ directory first
    const safeRel = path
      .normalize(pathname.replace(/^\/+/, ""))
      .replace(/^(\.\.(\/|\\|$))+/, "");

    const availableGames = fs
      .readdirSync(GAMES_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    let fullPath = null;

    for (const game of availableGames) {
      const gameSlug = game.replace(/_/g, "-");
      const cleanRel = safeRel.replace(/\/+$/, "");
      const matchesRoute = cleanRel === game || cleanRel === gameSlug;

      if (matchesRoute) {
        if (!pathname.endsWith("/")) {
          res.writeHead(301, { Location: `/${gameSlug}/` });
          return res.end();
        }
        fullPath = path.join(GAMES_DIR, game, "index.html");
        break;
      }

      if (
        safeRel.startsWith(game + "/") ||
        safeRel.startsWith(gameSlug + "/") ||
        safeRel.startsWith(game + "\\") ||
        safeRel.startsWith(gameSlug + "\\")
      ) {
        const prefixLen = (safeRel.startsWith(game) ? game : gameSlug).length + 1;
        const subRel = safeRel.slice(prefixLen);
        let candidate = path.join(GAMES_DIR, game, subRel);
        if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
          candidate = path.join(candidate, "index.html");
        }
        if (fs.existsSync(candidate)) {
          fullPath = candidate;
          break;
        }
      }
    }

    // If not a game file, resolve from hub/
    if (!fullPath) {
      let candidate =
        !safeRel || safeRel === "."
          ? path.join(HUB_DIR, "index.html")
          : path.join(HUB_DIR, safeRel);

      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        candidate = path.join(candidate, "index.html");
      }

      if (fs.existsSync(candidate)) {
        fullPath = candidate;
      } else if (safeRel.startsWith("background/") || safeRel.startsWith("seabed/")) {
        const assetCand = path.join(HUB_DIR, "assets", safeRel);
        if (fs.existsSync(assetCand)) {
          fullPath = assetCand;
        } else if (fs.existsSync(path.join(BASE_DIR, safeRel))) {
          fullPath = path.join(BASE_DIR, safeRel);
        }
      } else {
        const hubIndex = path.join(HUB_DIR, "index.html");
        if (fs.existsSync(hubIndex) && !safeRel.startsWith("api/")) {
          fullPath = hubIndex;
        } else {
          return sendJson(res, { error: "Fil ikke funnet" }, 404);
        }
      }
    }

    const content = fs.readFileSync(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const headers = {
      "Content-Type": contentType,
      "Content-Length": content.length,
    };
    if ([".js", ".css", ".html"].includes(ext)) {
      headers["Cache-Control"] = "no-cache, must-revalidate";
    }
    res.writeHead(200, headers);
    if (req.method !== "HEAD") {
      res.end(content);
    } else {
      res.end();
    }
  } catch (err) {
    console.error(err);
    sendJson(res, { error: String(err.message || err) }, 500);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`🎮 NTNU Games (Node.js) kjører på http://${HOST}:${PORT}`);
  console.log(`   • Hub:          http://${HOST}:${PORT}/`);
  console.log(`   • Kattfisking:  http://${HOST}:${PORT}/kattfisking/`);
  console.log(`   • Mer/Mindre:   http://${HOST}:${PORT}/mer-eller-mindre/`);
  console.log(`   • Ordbombe:     http://${HOST}:${PORT}/ordbombe/ (Partyspill)`);
  console.log(`   • NTNU guesser: http://${HOST}:${PORT}/geoguesser/ (under utvikling)\n`);
});
