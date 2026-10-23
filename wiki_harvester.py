#!/usr/bin/env python3
"""
Kattfisking - Norwegian Wikipedia Harvester & Database Manager
Fetches articles from no.wikipedia.org, filters giveaway and maintenance categories,
and manages the SQLite database (data/kattfisking.db).
"""

import datetime
import json
import os
import random
import re
import sqlite3
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

DB_PATH = os.environ.get(
    "KATTFISKING_DB",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "kattfisking.db"),
)
USER_AGENT = "Kattfisking/1.0 (https://github.com/kattfisking; RaspberryPi trivia game)"

# Prefixes and patterns for maintenance / administrative categories on no.wikipedia.org
BANNED_CATEGORY_PATTERNS = [
    r"^Artikler\b",
    r"^Sider\b",
    r"^Alle\s+spirer",
    r"\bspirer$",
    r"^Spirer\b",
    r"^Wikipedia\b",
    r"^CS1\b",
    r"^Webarchive\b",
    r"^Kilder\b",
    r"^Referanser\b",
    r"^Pekere\b",
    r"^Listesider\b",
    r"^Lister\s+over\b",
    r"^Navigasjonsmaler\b",
    r"^Maler\b",
    r"^Bruker",
    r"^Fil:",
    r"^Kategori",
    r"^Commons\b",
    r"^Wikidata\b",
    r"^Autoritetsdata\b",
    r"^ Offisielle nettsteder",
    r"uten\s+bilde",
    r"trenger\s+referanser",
    r"trenger\s+kilder",
    r"^Ufullstendige\b",
    r"^Opphavsrett",
    r"^Levende\s+personer$",
    r"^Personer\s+som\s+er\s+i\s+live$",
]

BANNED_TITLE_PATTERNS = [
    r"^Forside$",
    r"^Spesial:",
    r"^Wikipedia:",
    r"^Kategori:",
    r"^Mal:",
    r"^Fil:",
    r"^Hjelp:",
    r"^Portal:",
    r"^Liste\s+over\b",
    r"^Oversikt\s+over\b",
    r"^\d+$",  # Pure year/number articles
    r"^\d+\.\s+(januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember)$",
    r"\(pekerside\)",
    r"^pekerside$",
]

STOPWORDS_NO = {
    "og", "i", "på", "av", "for", "med", "til", "fra", "om", "som",
    "en", "et", "ei", "den", "det", "de", "the", "of", "and", "in",
    "on", "at", "to", "a", "an", "eller", "ved", "under", "over",
    "mot", "mellom", "etter", "før", "hos", "ut", "inn", "opp", "ned",
}


def get_db_connection(db_path: str = DB_PATH) -> sqlite3.Connection:
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = sqlite3.connect(db_path, timeout=15.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db(db_path: str = DB_PATH) -> None:
    conn = get_db_connection(db_path)
    with conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS articles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                page_id INTEGER UNIQUE NOT NULL,
                title TEXT UNIQUE NOT NULL,
                clean_title TEXT NOT NULL,
                categories_json TEXT NOT NULL,
                hidden_categories_json TEXT NOT NULL DEFAULT '[]',
                aliases_json TEXT NOT NULL DEFAULT '[]',
                extract TEXT NOT NULL DEFAULT '',
                redacted_extract TEXT NOT NULL DEFAULT '',
                thumbnail_url TEXT DEFAULT NULL,
                wiki_url TEXT NOT NULL,
                views INTEGER NOT NULL DEFAULT 0,
                is_curated INTEGER NOT NULL DEFAULT 0,
                used_date TEXT DEFAULT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS daily_puzzles (
                date TEXT PRIMARY KEY,
                puzzle_number INTEGER UNIQUE NOT NULL,
                article_ids_json TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS puzzle_submissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                total_score REAL NOT NULL,
                results_json TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_articles_used_date ON articles(used_date);
            CREATE INDEX IF NOT EXISTS idx_submissions_date ON puzzle_submissions(date);
            """
        )
    conn.close()


def clean_article_title(title: str) -> str:
    """Remove parenthetical disambiguation, e.g. 'Gro Holm (journalist)' -> 'Gro Holm'."""
    cleaned = re.sub(r"\s*\([^)]*\)\s*$", "", title).strip()
    return cleaned if cleaned else title.strip()


def normalize_for_check(text: str) -> str:
    return re.sub(r"[^\wæøåÆØÅ0-9\s]", " ", text.lower()).strip()


def is_banned_title(title: str) -> bool:
    for pat in BANNED_TITLE_PATTERNS:
        if re.search(pat, title, flags=re.IGNORECASE):
            return True
    return False


def is_maintenance_category(cat: str) -> bool:
    for pat in BANNED_CATEGORY_PATTERNS:
        if re.search(pat, cat, flags=re.IGNORECASE):
            return True
    return False


def filter_categories_for_article(
    title: str, raw_categories: List[str], aliases: Optional[List[str]] = None
) -> Tuple[List[str], List[str]]:
    """
    Filters raw Wikipedia categories into:
      - kept_categories: safe clues to display to the player
      - giveaway_categories: categories that contained the article title or significant title words
    """
    clean_title = clean_article_title(title)
    norm_title = normalize_for_check(clean_title)
    norm_full = normalize_for_check(title)

    # Significant words from the title (length >= 4 and not stopwords)
    title_words = [
        w
        for w in norm_title.split()
        if len(w) >= 4 and w not in STOPWORDS_NO and not w.isdigit()
    ]
    # Also create 5+ char stems for Norwegian inflections (e.g. "Nidarosdomen" -> "nidaros", "Stortinget" -> "storting")
    title_stems = set()
    for w in title_words:
        title_stems.add(w)
        if len(w) >= 7:
            title_stems.add(w[:-2])
        if len(w) >= 6:
            title_stems.add(w[:-1])

    kept: List[str] = []
    giveaways: List[str] = []

    for raw_cat in raw_categories:
        cat = re.sub(r"^Kategori:", "", raw_cat, flags=re.IGNORECASE).strip()
        if not cat:
            continue
        if is_maintenance_category(cat):
            continue

        norm_cat = normalize_for_check(cat)

        # Check if the category is an exact match or contains the full title
        is_giveaway = False
        if norm_title and (norm_title in norm_cat or norm_cat in norm_title):
            is_giveaway = True
        elif norm_full and norm_full in norm_cat:
            is_giveaway = True
        else:
            # Check if any significant word/stem from the title appears in the category
            cat_words = norm_cat.split()
            for cw in cat_words:
                for tw in title_words:
                    if cw == tw:
                        is_giveaway = True
                        break
                    # Check compound / inflection overlap if word is at least 5 chars
                    if len(tw) >= 5 and (cw.startswith(tw) or tw.startswith(cw)) and len(cw) >= 5:
                        is_giveaway = True
                        break
                if is_giveaway:
                    break

        if is_giveaway:
            giveaways.append(cat)
        else:
            kept.append(cat)

    return kept, giveaways


def redact_extract(extract: str, title: str, aliases: List[str]) -> str:
    """Replaces occurrences of the title and its words in the first sentence with [███] for a hint."""
    if not extract:
        return ""
    # Take first 1-2 sentences
    sentences = re.split(r"(?<=[.!?])\s+", extract.strip())
    first_sent = sentences[0] if sentences else extract.strip()
    if len(first_sent) < 45 and len(sentences) > 1:
        first_sent = first_sent + " " + sentences[1]

    clean_t = clean_article_title(title)
    candidates = sorted(
        set([title, clean_t] + [clean_article_title(a) for a in aliases if len(a) >= 3]),
        key=len,
        reverse=True,
    )
    redacted = first_sent
    for cand in candidates:
        if not cand:
            continue
        redacted = re.sub(re.escape(cand), "[███]", redacted, flags=re.IGNORECASE)

    # Also redact significant words >= 4 chars from clean_title
    for word in re.split(r"\s+", clean_t):
        w_clean = re.sub(r"[^\wæøåÆØÅ0-9]", "", word)
        if len(w_clean) >= 4 and w_clean.lower() not in STOPWORDS_NO:
            redacted = re.sub(
                r"\b" + re.escape(w_clean) + r"\w*",
                "[███]",
                redacted,
                flags=re.IGNORECASE,
            )

    # Collapse repeated [███]
    redacted = re.sub(r"(\[███\]\s*)+", "[███] ", redacted).strip()
    return redacted


def fetch_mediawiki_articles(titles: List[str]) -> List[Dict[str, Any]]:
    """
    Fetches full details (categories, extract, thumbnail, redirects) for up to 20 titles at a time
    from no.wikipedia.org.
    """
    results: List[Dict[str, Any]] = []
    batch_size = 20

    for i in range(0, len(titles), batch_size):
        batch = titles[i : i + batch_size]
        params = urllib.parse.urlencode(
            {
                "action": "query",
                "format": "json",
                "redirects": "1",
                "titles": "|".join(batch),
                "prop": "categories|extracts|pageimages|info|pageprops",
                "cllimit": "max",
                "clshow": "!hidden",
                "exintro": "1",
                "explaintext": "1",
                "exsentences": "3",
                "pithumbsize": "480",
                "inprop": "url",
            }
        )
        url = f"https://no.wikipedia.org/w/api.php?{params}"
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except Exception as exc:
            print(f"[Harvester] Error fetching batch: {exc}")
            continue

        pages = data.get("query", {}).get("pages", {})
        valid_page_titles: List[str] = []
        raw_pages: List[Dict[str, Any]] = []

        for pid, page in pages.items():
            if int(pid) < 0 or "missing" in page:
                continue
            if page.get("ns", 0) != 0:
                continue
            if "disambiguation" in page.get("pageprops", {}):
                continue
            title = page.get("title", "")
            if not title or is_banned_title(title):
                continue
            extract = (page.get("extract") or "").strip()
            if len(extract) < 50 or "kan vise til" in extract.lower()[:80]:
                continue
            raw_cats = [c["title"] for c in page.get("categories", [])]
            kept_cats, hidden_cats = filter_categories_for_article(title, raw_cats)
            if len(kept_cats) < 4:
                continue

            raw_pages.append(
                {
                    "page_id": int(pid),
                    "title": title,
                    "clean_title": clean_article_title(title),
                    "categories": kept_cats,
                    "hidden_categories": hidden_cats,
                    "extract": extract,
                    "thumbnail_url": (page.get("thumbnail") or {}).get("source"),
                    "wiki_url": page.get(
                        "fullurl",
                        f"https://no.wikipedia.org/wiki/{urllib.parse.quote(title.replace(' ', '_'))}",
                    ),
                }
            )
            valid_page_titles.append(title)

        # Fetch redirects (aliases) for the valid pages in this batch
        redirects_map: Dict[str, List[str]] = {t: [] for t in valid_page_titles}
        if valid_page_titles:
            rd_params = urllib.parse.urlencode(
                {
                    "action": "query",
                    "format": "json",
                    "titles": "|".join(valid_page_titles),
                    "prop": "redirects",
                    "rdlimit": "max",
                    "rdnamespace": "0",
                }
            )
            rd_url = f"https://no.wikipedia.org/w/api.php?{rd_params}"
            rd_req = urllib.request.Request(rd_url, headers={"User-Agent": USER_AGENT})
            try:
                with urllib.request.urlopen(rd_req, timeout=12) as rd_resp:
                    rd_data = json.loads(rd_resp.read().decode("utf-8"))
                    for _, p in rd_data.get("query", {}).get("pages", {}).items():
                        t = p.get("title")
                        if t in redirects_map:
                            rds = [
                                r["title"]
                                for r in p.get("redirects", [])
                                if r.get("title") and len(r["title"]) <= 60
                            ]
                            redirects_map[t] = rds[:25]
            except Exception:
                pass

        for item in raw_pages:
            aliases = redirects_map.get(item["title"], [])
            item["aliases"] = aliases
            item["redacted_extract"] = redact_extract(
                item["extract"], item["title"], aliases
            )
            results.append(item)

    return results


def fetch_popular_norwegian_titles(days_back: int = 5, limit_per_day: int = 120) -> Dict[str, int]:
    """
    Fetches popular article titles and view counts from Wikimedia REST Pageviews API for no.wikipedia.
    """
    title_views: Dict[str, int] = {}
    today = datetime.date.today()

    for offset in range(2, 2 + days_back):
        d = today - datetime.timedelta(days=offset)
        url = (
            f"https://wikimedia.org/api/rest_v1/metrics/pageviews/top/"
            f"no.wikipedia/all-access/{d.strftime('%Y/%m/%d')}"
        )
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                articles = data.get("items", [{}])[0].get("articles", [])
                for entry in articles[:limit_per_day]:
                    raw_t = entry.get("article", "").replace("_", " ")
                    views = int(entry.get("views", 0))
                    if not raw_t or is_banned_title(raw_t):
                        continue
                    title_views[raw_t] = max(title_views.get(raw_t, 0), views)
        except Exception as exc:
            print(f"[Harvester] Pageviews fetch warning for {d}: {exc}")

    return title_views


# Curated list of iconic Norwegian & world general-knowledge topics on no.wikipedia.org
# to ensure a rich, diverse, high-quality initial pool alongside live Pageviews
CURATED_SEED_TITLES = [
    # Norske personer (historie, kultur, vitenskap, idrett)
    "Edvard Munch", "Roald Amundsen", "Henrik Ibsen", "Edvard Grieg",
    "Fridtjof Nansen", "Knut Hamsun", "Sigrid Undset", "Thor Heyerdahl",
    "Magnus Carlsen", "Erling Braut Haaland", "Ole Gunnar Solskjær",
    "Marit Bjørgen", "Petter Northug", "Therese Johaug", "Karsten Warholm",
    "Ada Hegerberg", "Viktor Hovland", "Casper Ruud", "Sonja Henie",
    "Grete Waitz", "Ole Einar Bjørndalen", "Kjetil André Aamodt",
    "Gro Harlem Brundtland", "Einar Gerhardsen", "Jens Stoltenberg",
    "Erna Solberg", "Jonas Gahr Støre", "Haakon VII", "Olav V", "Harald V",
    "Harald Hårfagre", "Olav den hellige", "Snorre Sturlason", "Vidkun Quisling",
    "Max Manus", "Gunnar Sønsteby", "Niels Henrik Abel", "Kristian Birkeland",
    "Ivar Aasen", "Bjørnstjerne Bjørnson", "Camilla Collett", "Anne-Cath. Vestly",
    "Thorbjørn Egner", "Alf Prøysen", "Kjell Aukrust", "Jo Nesbø",
    "Karl Ove Knausgård", "Jon Fosse", "Ludvig Holberg", "Gustav Vigeland",
    "Christian Krohg", "Theodor Kittelsen", "Adolph Tidemand", "Nikolai Astrup",
    "Liv Ullmann", "Joachim Trier", "Ivo Caprino", "Kygo", "Alan Walker",
    "Aurora Aksnes", "Sigrid Raabe", "Mari Boine", "Øystein Sunde",
    "Jahn Teigen", "Wenche Myhre", "Sondre Justad", "Karpe", "A-ha",
    "Röyksopp", "Mayhem", "Dimmu Borgir", "Kaizers Orchestra", "DumDum Boys",
    "Ylvis", "helt vanlig",
    # Norsk kultur, film, TV, mat og tradisjon
    "Flåklypa Grand Prix", "Skam (TV-serie)", "Kongen befaler", "Nytt på nytt",
    "Melodi Grand Prix", "Dagsrevyen", "Fleksnes fataliteter", "Mot i brøstet",
    "Trolljegeren", "Kon-Tiki (film)", "Verdens verste menneske", "Max Manus (film)",
    "Bølgen (film)", "Elling (film)", "Kardemomme by", "Hakkebakkeskogen",
    "Klatremus og de andre dyrene i Hakkebakkeskogen", "Folk og røvere i Kardemomme by",
    "Peer Gynt", "Et dukkehjem", "Skrik", "Brudeferd i Hardanger", "Sinnataggen",
    "Monolitten", "Fårikål", "Brunost", "Lutefisk", "Pinnekjøtt", "Ribbe",
    "Smalahove", "Kransekake", "Kvikk Lunsj", "Grandiosa", "Solo (brus)",
    "Akevitt", "Bunad", "Russ", "Janteloven", "Kos", "Dugnad", "Friluftsliv",
    "Hurtigruten", "Dovrebanen", "Bergensbanen", "Flåmsbana", "Atlanterhavsveien",
    # Norske steder, byer, natur og byggverk
    "Oslo", "Bergen", "Trondheim", "Stavanger", "Tromsø", "Kristiansand",
    "Ålesund", "Bodø", "Hammerfest", "Røros", "Lillehammer", "Longyearbyen",
    "Svalbard", "Jan Mayen", "Bouvetøya", "Lofoten", "Geirangerfjorden",
    "Sognefjorden", "Hardangerfjorden", "Preikestolen", "Trolltunga", "Kjerag",
    "Galdhøpiggen", "Glittertind", "Dovrefjell", "Jotunheimen", "Hardangervidda",
    "Nordkapp", "Lindesnes fyr", "Nidarosdomen", "Akershus festning",
    "Det kongelige slott", "Operahuset i Oslo", "Holmenkollbakken", "Bryggen i Bergen",
    "Urnes stavkirke", "Heddal stavkirke", "Borgund stavkirke", "Vigelandsparken",
    "Frammuseet", "Munchmuseet", "Stortinget", "Sametinget",
    # Norsk historie, samfunn og bedrifter
    "Grunnloven", "Unionsoppløsningen i 1905", "Norge under andre verdenskrig",
    "Senkningen av «Blücher»", "Tungtvannsaksjonen", "Kalmarunionen", "Svartedauden",
    "Slaget på Stiklestad", "Slaget i Hafrsfjord", "Vikingtiden", "Osebergfunnet",
    "Gokstadskipet", "Nobels fredspris", "Oljefondet", "Equinor", "Norsk Hydro",
    "Kongsberg Gruppen", "Telenor", "NRK", "Vinmonopolet", "Vy", "SAS",
    "Freia", "Nidar", "Tine", "Orkla", "Den Norske Turistforening",
    "Arbeiderpartiet", "Høyre", "Senterpartiet", "Fremskrittspartiet",
    "Sosialistisk Venstreparti", "Venstre", "Kristelig Folkeparti", "Rødt",
    "Miljøpartiet De Grønne", "Bokmål", "Nynorsk", "Samiske språk",
    # Dyr, natur og vitenskap
    "Elg", "Rein", "Moskusfe", "Isbjørn", "Spekkhogger", "Lunde (fugl)",
    "Lemen", "Gaupe", "Jerv", "Ulv", "Brunbjørn", "Havørn", "Torsk",
    "Atlanterhavslaks", "Kongekrabbe", "Nordlys", "Midnattssol", "Golfstrømmen",
    # Internasjonale klassikere på norsk Wikipedia
    "Albert Einstein", "Isaac Newton", "Marie Curie", "Charles Darwin",
    "Leonardo da Vinci", "William Shakespeare", "Wolfgang Amadeus Mozart",
    "Ludwig van Beethoven", "The Beatles", "Queen", "ABBA", "Michael Jackson",
    "Elvis Presley", "David Bowie", "Taylor Swift", "Astrid Lindgren",
    "Tove Jansson", "H.C. Andersen", "J.R.R. Tolkien", "Harry Potter",
    "Ringenes herre", "Star Wars", "Titanic", "Eiffeltårnet", "Colosseum",
    "Den kinesiske mur", "Mount Everest", "Månen", "Mars (planet)", "Solen",
]


def save_articles_to_db(
    articles: List[Dict[str, Any]],
    views_map: Optional[Dict[str, int]] = None,
    is_curated: bool = False,
    db_path: str = DB_PATH,
) -> int:
    conn = get_db_connection(db_path)
    inserted = 0
    views_map = views_map or {}
    with conn:
        for art in articles:
            views = views_map.get(art["title"], art.get("views", 500))
            cur = conn.execute(
                """
                INSERT INTO articles (
                    page_id, title, clean_title, categories_json,
                    hidden_categories_json, aliases_json, extract,
                    redacted_extract, thumbnail_url, wiki_url, views, is_curated
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(page_id) DO UPDATE SET
                    categories_json = excluded.categories_json,
                    hidden_categories_json = excluded.hidden_categories_json,
                    aliases_json = excluded.aliases_json,
                    extract = excluded.extract,
                    redacted_extract = excluded.redacted_extract,
                    thumbnail_url = COALESCE(excluded.thumbnail_url, articles.thumbnail_url),
                    views = MAX(articles.views, excluded.views),
                    is_curated = MAX(articles.is_curated, excluded.is_curated)
                """,
                (
                    art["page_id"],
                    art["title"],
                    art["clean_title"],
                    json.dumps(art["categories"], ensure_ascii=False),
                    json.dumps(art["hidden_categories"], ensure_ascii=False),
                    json.dumps(art["aliases"], ensure_ascii=False),
                    art["extract"],
                    art["redacted_extract"],
                    art["thumbnail_url"],
                    art["wiki_url"],
                    views,
                    1 if is_curated else 0,
                ),
            )
            if cur.rowcount > 0:
                inserted += 1
    conn.close()
    return inserted


def ensure_daily_puzzle(date_str: str, db_path: str = DB_PATH) -> Optional[Dict[str, Any]]:
    """
    Returns the daily puzzle for `date_str` (YYYY-MM-DD), generating one if it doesn't exist yet.
    Uses a deterministic RNG seeded by date_str so selection is reproducible.
    """
    conn = get_db_connection(db_path)
    row = conn.execute(
        "SELECT date, puzzle_number, article_ids_json FROM daily_puzzles WHERE date = ?",
        (date_str,),
    ).fetchone()

    if row:
        article_ids = json.loads(row["article_ids_json"])
        puzzle_number = row["puzzle_number"]
    else:
        # Check how many unused articles we have
        unused_rows = conn.execute(
            """
            SELECT id, title, categories_json, is_curated, views
            FROM articles
            WHERE used_date IS NULL
            ORDER BY is_curated DESC, views DESC
            """
        ).fetchall()

        if len(unused_rows) < 10:
            # Fallback to any articles if pool is exhausted
            unused_rows = conn.execute(
                "SELECT id, title, categories_json, is_curated, views FROM articles ORDER BY RANDOM() LIMIT 30"
            ).fetchall()

        if len(unused_rows) < 10:
            conn.close()
            return None

        rng = random.Random(f"kattfisking-{date_str}")
        curated_pool = [r for r in unused_rows if r["is_curated"] == 1]
        other_pool = [r for r in unused_rows if r["is_curated"] == 0]
        rng.shuffle(curated_pool)
        rng.shuffle(other_pool)

        # Prioritize curated iconic Norwegian/general-knowledge articles (at least 8 of 10 when available)
        if len(curated_pool) >= 9:
            chosen = curated_pool[:9] + (other_pool[:1] if other_pool else curated_pool[9:10])
            rng.shuffle(chosen)
        else:
            pool = curated_pool + other_pool
            chosen = pool[:10]
        article_ids = [r["id"] for r in chosen]

        # Compute next puzzle number
        max_num_row = conn.execute(
            "SELECT COALESCE(MAX(puzzle_number), 0) AS max_num FROM daily_puzzles"
        ).fetchone()
        puzzle_number = int(max_num_row["max_num"]) + 1

        with conn:
            conn.execute(
                "INSERT INTO daily_puzzles (date, puzzle_number, article_ids_json) VALUES (?, ?, ?)",
                (date_str, puzzle_number, json.dumps(article_ids)),
            )
            for aid in article_ids:
                conn.execute(
                    "UPDATE articles SET used_date = ? WHERE id = ?",
                    (date_str, aid),
                )

    # Fetch the 10 articles in order
    placeholders = ",".join("?" for _ in article_ids)
    art_rows = conn.execute(
        f"SELECT * FROM articles WHERE id IN ({placeholders})",
        article_ids,
    ).fetchall()
    art_map = {r["id"]: dict(r) for r in art_rows}
    ordered_articles = [art_map[aid] for aid in article_ids if aid in art_map]

    # Fetch submission stats for this date
    subs = conn.execute(
        "SELECT total_score, results_json FROM puzzle_submissions WHERE date = ?",
        (date_str,),
    ).fetchall()
    conn.close()

    total_plays = len(subs)
    avg_score = (
        round(sum(s["total_score"] for s in subs) / total_plays, 2)
        if total_plays > 0
        else None
    )
    per_question_solve = [0] * len(ordered_articles)
    if total_plays > 0:
        for s in subs:
            try:
                res = json.loads(s["results_json"])
                for idx, val in enumerate(res):
                    if idx < len(per_question_solve) and float(val) >= 0.5:
                        per_question_solve[idx] += 1
            except Exception:
                pass

    formatted_articles = []
    for idx, a in enumerate(ordered_articles):
        solve_pct = (
            round(100 * per_question_solve[idx] / total_plays)
            if total_plays > 0
            else None
        )
        formatted_articles.append(format_article_row(a, solve_pct=solve_pct))

    return {
        "date": date_str,
        "puzzleNumber": puzzle_number,
        "totalPlays": total_plays,
        "averageScore": avg_score,
        "articles": formatted_articles,
    }


def format_article_row(row: Dict[str, Any], solve_pct: Optional[int] = None) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "pageId": row["page_id"],
        "title": row["title"],
        "cleanTitle": row["clean_title"],
        "categories": json.loads(row["categories_json"]),
        "hiddenCategories": json.loads(row["hidden_categories_json"]),
        "aliases": json.loads(row["aliases_json"]),
        "extract": row["extract"],
        "redactedExtract": row["redacted_extract"],
        "thumbnailUrl": row["thumbnail_url"],
        "wikiUrl": row["wiki_url"],
        "solvePct": solve_pct,
    }


def seed_database_if_needed(db_path: str = DB_PATH, min_articles: int = 120) -> None:
    init_db(db_path)
    conn = get_db_connection(db_path)
    count = conn.execute("SELECT COUNT(*) AS c FROM articles").fetchone()["c"]
    conn.close()

    if count >= min_articles:
        print(f"[Harvester] Database already has {count} articles.")
        return

    print(f"[Harvester] Seeding database (currently {count} articles)...")
    # 1. Fetch curated seed list
    curated_articles = fetch_mediawiki_articles(CURATED_SEED_TITLES)
    save_articles_to_db(curated_articles, is_curated=True, db_path=db_path)
    print(f"[Harvester] Saved {len(curated_articles)} curated Norwegian articles.")

    # 2. Fetch popular articles from Wikimedia Pageviews
    popular_map = fetch_popular_norwegian_titles(days_back=3, limit_per_day=80)
    extra_titles = [t for t in popular_map.keys() if t not in CURATED_SEED_TITLES][:100]
    if extra_titles:
        pop_articles = fetch_mediawiki_articles(extra_titles)
        save_articles_to_db(pop_articles, views_map=popular_map, is_curated=False, db_path=db_path)
        print(f"[Harvester] Saved {len(pop_articles)} popular Norwegian pageview articles.")

    # 3. Generate daily puzzles for the past 4 days + today so Archive Mode is populated immediately
    today = datetime.date.today()
    for days_ago in range(4, -1, -1):
        d_str = (today - datetime.timedelta(days=days_ago)).isoformat()
        puzzle = ensure_daily_puzzle(d_str, db_path=db_path)
        if puzzle:
            # Add a few realistic baseline community submissions so solve rates & averages look alive
            add_baseline_submissions_if_empty(d_str, puzzle, db_path=db_path)
            print(f"[Harvester] Prepared daily puzzle #{puzzle['puzzleNumber']} for {d_str}.")


def add_baseline_submissions_if_empty(
    date_str: str, puzzle: Dict[str, Any], db_path: str = DB_PATH
) -> None:
    conn = get_db_connection(db_path)
    cnt = conn.execute(
        "SELECT COUNT(*) AS c FROM puzzle_submissions WHERE date = ?", (date_str,)
    ).fetchone()["c"]
    if cnt > 0:
        conn.close()
        return

    rng = random.Random(f"baseline-{date_str}")
    # Create 12 synthetic baseline scorecards based on category count & familiarity
    with conn:
        for _ in range(12):
            scores = []
            for art in puzzle["articles"]:
                cat_count = len(art["categories"])
                prob = min(0.82, 0.35 + cat_count * 0.04)
                r = rng.random()
                if r < prob:
                    scores.append(1.0)
                elif r < prob + 0.12:
                    scores.append(0.5)
                else:
                    scores.append(0.0)
            total = sum(scores)
            conn.execute(
                "INSERT INTO puzzle_submissions (date, total_score, results_json) VALUES (?, ?, ?)",
                (date_str, total, json.dumps(scores)),
            )
    conn.close()


if __name__ == "__main__":
    seed_database_if_needed()
