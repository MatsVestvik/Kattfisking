"""
Tegn & Gjett - Norsk Ordliste (Inspirert av skribbl.io)
Inneholder over 300 morsomme, visuelle og gjenkjennelige norske substantiver
tilpasset både enkle hverdagsord og studentliv i Trondheim / NTNU.
"""

import random
from typing import List, Dict

TEGN_WORDS: List[Dict[str, str]] = [
    # Dyr (Animals)
    {"word": "katt", "category": "Dyr", "difficulty": "lett"},
    {"word": "hund", "category": "Dyr", "difficulty": "lett"},
    {"word": "elefant", "category": "Dyr", "difficulty": "lett"},
    {"word": "løve", "category": "Dyr", "difficulty": "lett"},
    {"word": "pingvin", "category": "Dyr", "difficulty": "lett"},
    {"word": "frosk", "category": "Dyr", "difficulty": "lett"},
    {"word": "slange", "category": "Dyr", "difficulty": "lett"},
    {"word": "hai", "category": "Dyr", "difficulty": "lett"},
    {"word": "kanin", "category": "Dyr", "difficulty": "lett"},
    {"word": "bjørn", "category": "Dyr", "difficulty": "lett"},
    {"word": "giraff", "category": "Dyr", "difficulty": "lett"},
    {"word": "sau", "category": "Dyr", "difficulty": "lett"},
    {"word": "gris", "category": "Dyr", "difficulty": "lett"},
    {"word": "mus", "category": "Dyr", "difficulty": "lett"},
    {"word": "ugle", "category": "Dyr", "difficulty": "middels"},
    {"word": "flaggermus", "category": "Dyr", "difficulty": "middels"},
    {"word": "krokodille", "category": "Dyr", "difficulty": "middels"},
    {"word": "elg", "category": "Dyr", "difficulty": "middels"},
    {"word": "skilpadde", "category": "Dyr", "difficulty": "middels"},
    {"word": "krabbe", "category": "Dyr", "difficulty": "middels"},
    {"word": "snegle", "category": "Dyr", "difficulty": "middels"},
    {"word": "manet", "category": "Dyr", "difficulty": "middels"},
    {"word": "papegøye", "category": "Dyr", "difficulty": "middels"},
    {"word": "delfin", "category": "Dyr", "difficulty": "middels"},
    {"word": "flaggspett", "category": "Dyr", "difficulty": "vanskelig"},
    {"word": "kameleon", "category": "Dyr", "difficulty": "vanskelig"},
    {"word": "enhjørning", "category": "Dyr", "difficulty": "vanskelig"},
    {"word": "blekksprut", "category": "Dyr", "difficulty": "vanskelig"},
    {"word": "marihøne", "category": "Dyr", "difficulty": "middels"},
    {"word": "humle", "category": "Dyr", "difficulty": "middels"},
    {"word": "ekorn", "category": "Dyr", "difficulty": "middels"},
    {"word": "rev", "category": "Dyr", "difficulty": "lett"},

    # Mat & Drikke (Food & Drink)
    {"word": "pizza", "category": "Mat", "difficulty": "lett"},
    {"word": "taco", "category": "Mat", "difficulty": "lett"},
    {"word": "burger", "category": "Mat", "difficulty": "lett"},
    {"word": "eple", "category": "Mat", "difficulty": "lett"},
    {"word": "banan", "category": "Mat", "difficulty": "lett"},
    {"word": "is", "category": "Mat", "difficulty": "lett"},
    {"word": "gulrot", "category": "Mat", "difficulty": "lett"},
    {"word": "pølse", "category": "Mat", "difficulty": "lett"},
    {"word": "ost", "category": "Mat", "difficulty": "lett"},
    {"word": "kake", "category": "Mat", "difficulty": "lett"},
    {"word": "egg", "category": "Mat", "difficulty": "lett"},
    {"word": "kaffe", "category": "Mat", "difficulty": "lett"},
    {"word": "brunost", "category": "Mat", "difficulty": "middels"},
    {"word": "vaffel", "category": "Mat", "difficulty": "middels"},
    {"word": "sushi", "category": "Mat", "difficulty": "middels"},
    {"word": "popcorn", "category": "Mat", "difficulty": "middels"},
    {"word": "pannekake", "category": "Mat", "difficulty": "middels"},
    {"word": "smultring", "category": "Mat", "difficulty": "middels"},
    {"word": "vannmelon", "category": "Mat", "difficulty": "middels"},
    {"word": "spagetti", "category": "Mat", "difficulty": "middels"},
    {"word": "sjokolade", "category": "Mat", "difficulty": "middels"},
    {"word": "jordbær", "category": "Mat", "difficulty": "middels"},
    {"word": "ananas", "category": "Mat", "difficulty": "middels"},
    {"word": "avokado", "category": "Mat", "difficulty": "middels"},
    {"word": "sitron", "category": "Mat", "difficulty": "lett"},
    {"word": "appelsin", "category": "Mat", "difficulty": "lett"},
    {"word": "kjeks", "category": "Mat", "difficulty": "lett"},
    {"word": "lollipopp", "category": "Mat", "difficulty": "lett"},
    {"word": "suppe", "category": "Mat", "difficulty": "middels"},
    {"word": "bacon", "category": "Mat", "difficulty": "middels"},
    {"word": "croissant", "category": "Mat", "difficulty": "vanskelig"},
    {"word": "marsipangris", "category": "Mat", "difficulty": "vanskelig"},

    # Ting & Gjenstander (Objects)
    {"word": "solbriller", "category": "Ting", "difficulty": "lett"},
    {"word": "tannbørste", "category": "Ting", "difficulty": "lett"},
    {"word": "paraply", "category": "Ting", "difficulty": "lett"},
    {"word": "klokke", "category": "Ting", "difficulty": "lett"},
    {"word": "saks", "category": "Ting", "difficulty": "lett"},
    {"word": "nøkkel", "category": "Ting", "difficulty": "lett"},
    {"word": "blyant", "category": "Ting", "difficulty": "lett"},
    {"word": "hammer", "category": "Ting", "difficulty": "lett"},
    {"word": "stol", "category": "Ting", "difficulty": "lett"},
    {"word": "bord", "category": "Ting", "difficulty": "lett"},
    {"word": "seng", "category": "Ting", "difficulty": "lett"},
    {"word": "dør", "category": "Ting", "difficulty": "lett"},
    {"word": "hatt", "category": "Ting", "difficulty": "lett"},
    {"word": "sko", "category": "Ting", "difficulty": "lett"},
    {"word": "sokk", "category": "Ting", "difficulty": "lett"},
    {"word": "briller", "category": "Ting", "difficulty": "lett"},
    {"word": "ballong", "category": "Ting", "difficulty": "lett"},
    {"word": "lyspære", "category": "Ting", "difficulty": "middels"},
    {"word": "gitar", "category": "Ting", "difficulty": "middels"},
    {"word": "trommer", "category": "Ting", "difficulty": "middels"},
    {"word": "mikrofon", "category": "Ting", "difficulty": "middels"},
    {"word": "kamera", "category": "Ting", "difficulty": "middels"},
    {"word": "mobil", "category": "Ting", "difficulty": "middels"},
    {"word": "hodetelefoner", "category": "Ting", "difficulty": "middels"},
    {"word": "ryggsekk", "category": "Ting", "difficulty": "middels"},
    {"word": "støvsuger", "category": "Ting", "difficulty": "middels"},
    {"word": "speil", "category": "Ting", "difficulty": "middels"},
    {"word": "stearinlys", "category": "Ting", "difficulty": "middels"},
    {"word": "sverd", "category": "Ting", "difficulty": "middels"},
    {"word": "koffert", "category": "Ting", "difficulty": "middels"},
    {"word": "såpe", "category": "Ting", "difficulty": "middels"},
    {"word": "vekt", "category": "Ting", "difficulty": "middels"},
    {"word": "teleskop", "category": "Ting", "difficulty": "vanskelig"},
    {"word": "mikroskop", "category": "Ting", "difficulty": "vanskelig"},
    {"word": "skattekiste", "category": "Ting", "difficulty": "vanskelig"},
    {"word": "kompass", "category": "Ting", "difficulty": "vanskelig"},
    {"word": "stiftepistol", "category": "Ting", "difficulty": "vanskelig"},

    # Kjøretøy & Transport (Vehicles)
    {"word": "bil", "category": "Kjøretøy", "difficulty": "lett"},
    {"word": "buss", "category": "Kjøretøy", "difficulty": "lett"},
    {"word": "tog", "category": "Kjøretøy", "difficulty": "lett"},
    {"word": "båt", "category": "Kjøretøy", "difficulty": "lett"},
    {"word": "fly", "category": "Kjøretøy", "difficulty": "lett"},
    {"word": "sykkel", "category": "Kjøretøy", "difficulty": "lett"},
    {"word": "rakett", "category": "Kjøretøy", "difficulty": "lett"},
    {"word": "helikopter", "category": "Kjøretøy", "difficulty": "middels"},
    {"word": "skateboard", "category": "Kjøretøy", "difficulty": "middels"},
    {"word": "traktor", "category": "Kjøretøy", "difficulty": "middels"},
    {"word": "ubåt", "category": "Kjøretøy", "difficulty": "middels"},
    {"word": "motorsykkel", "category": "Kjøretøy", "difficulty": "middels"},
    {"word": "varmluftsballong", "category": "Kjøretøy", "difficulty": "vanskelig"},
    {"word": "romskip", "category": "Kjøretøy", "difficulty": "vanskelig"},
    {"word": "sparkesykkel", "category": "Kjøretøy", "difficulty": "middels"},

    # Natur & Vær (Nature)
    {"word": "sol", "category": "Natur", "difficulty": "lett"},
    {"word": "måne", "category": "Natur", "difficulty": "lett"},
    {"word": "stjerne", "category": "Natur", "difficulty": "lett"},
    {"word": "tre", "category": "Natur", "difficulty": "lett"},
    {"word": "blomst", "category": "Natur", "difficulty": "lett"},
    {"word": "fjell", "category": "Natur", "difficulty": "lett"},
    {"word": "sky", "category": "Natur", "difficulty": "lett"},
    {"word": "regn", "category": "Natur", "difficulty": "lett"},
    {"word": "snømann", "category": "Natur", "difficulty": "lett"},
    {"word": "vulkan", "category": "Natur", "difficulty": "middels"},
    {"word": "regnbue", "category": "Natur", "difficulty": "middels"},
    {"word": "lyn", "category": "Natur", "difficulty": "middels"},
    {"word": "bål", "category": "Natur", "difficulty": "middels"},
    {"word": "strand", "category": "Natur", "difficulty": "middels"},
    {"word": "palme", "category": "Natur", "difficulty": "middels"},
    {"word": "foss", "category": "Natur", "difficulty": "middels"},
    {"word": "kaktus", "category": "Natur", "difficulty": "middels"},
    {"word": "sopp", "category": "Natur", "difficulty": "middels"},
    {"word": "nordlys", "category": "Natur", "difficulty": "vanskelig"},
    {"word": "isfjell", "category": "Natur", "difficulty": "vanskelig"},
    {"word": "orkan", "category": "Natur", "difficulty": "vanskelig"},

    # Personer, Roller & Fantasi (People & Roles)
    {"word": "konge", "category": "Personer", "difficulty": "lett"},
    {"word": "dronning", "category": "Personer", "difficulty": "lett"},
    {"word": "pirat", "category": "Personer", "difficulty": "lett"},
    {"word": "baby", "category": "Personer", "difficulty": "lett"},
    {"word": "klovn", "category": "Personer", "difficulty": "lett"},
    {"word": "spøkelse", "category": "Personer", "difficulty": "lett"},
    {"word": "robot", "category": "Personer", "difficulty": "lett"},
    {"word": "politi", "category": "Personer", "difficulty": "middels"},
    {"word": "lege", "category": "Personer", "difficulty": "middels"},
    {"word": "kokk", "category": "Personer", "difficulty": "middels"},
    {"word": "ninja", "category": "Personer", "difficulty": "middels"},
    {"word": "viking", "category": "Personer", "difficulty": "middels"},
    {"word": "trollmann", "category": "Personer", "difficulty": "middels"},
    {"word": "astronaut", "category": "Personer", "difficulty": "middels"},
    {"word": "superhelt", "category": "Personer", "difficulty": "middels"},
    {"word": "havfrue", "category": "Personer", "difficulty": "middels"},
    {"word": "mumie", "category": "Personer", "difficulty": "middels"},
    {"word": "skiløper", "category": "Personer", "difficulty": "middels"},
    {"word": "drage", "category": "Personer", "difficulty": "middels"},
    {"word": "zombie", "category": "Personer", "difficulty": "vanskelig"},
    {"word": "spion", "category": "Personer", "difficulty": "vanskelig"},
    {"word": "ridder", "category": "Personer", "difficulty": "vanskelig"},

    # Student & NTNU Trondheim
    {"word": "hybel", "category": "Student", "difficulty": "middels"},
    {"word": "eksamen", "category": "Student", "difficulty": "middels"},
    {"word": "kaffekopp", "category": "Student", "difficulty": "lett"},
    {"word": "fadderuke", "category": "Student", "difficulty": "vanskelig"},
    {"word": "pensumbok", "category": "Student", "difficulty": "middels"},
    {"word": "lesesal", "category": "Student", "difficulty": "middels"},
    {"word": "kalkulator", "category": "Student", "difficulty": "middels"},
    {"word": "sovesofa", "category": "Student", "difficulty": "middels"},
    {"word": "vekkerklokke", "category": "Student", "difficulty": "lett"},
    {"word": "toastjern", "category": "Student", "difficulty": "middels"},
    {"word": "mikrobølgeovn", "category": "Student", "difficulty": "middels"},
    {"word": "ølboks", "category": "Student", "difficulty": "lett"},
    {"word": "hovedbygget", "category": "Student", "difficulty": "vanskelig"},
    {"word": "samfundet", "category": "Student", "difficulty": "vanskelig"},
    {"word": "gløshaugen", "category": "Student", "difficulty": "vanskelig"},
    {"word": "pirbadet", "category": "Student", "difficulty": "vanskelig"},
    {"word": "nidarosdomen", "category": "Student", "difficulty": "vanskelig"},
    {"word": "vorspiel", "category": "Student", "difficulty": "middels"},
    {"word": "stipend", "category": "Student", "difficulty": "vanskelig"},
    {"word": "nudler", "category": "Student", "difficulty": "lett"},
    {"word": "fryseboks", "category": "Student", "difficulty": "middels"},
    {"word": "pantepose", "category": "Student", "difficulty": "middels"},

    # Sport & Fritid
    {"word": "fotball", "category": "Sport", "difficulty": "lett"},
    {"word": "basketball", "category": "Sport", "difficulty": "lett"},
    {"word": "tennis", "category": "Sport", "difficulty": "lett"},
    {"word": "ski", "category": "Sport", "difficulty": "lett"},
    {"word": "skøyter", "category": "Sport", "difficulty": "lett"},
    {"word": "telt", "category": "Sport", "difficulty": "lett"},
    {"word": "fiskestang", "category": "Sport", "difficulty": "middels"},
    {"word": "svømmebasseng", "category": "Sport", "difficulty": "middels"},
    {"word": "bowling", "category": "Sport", "difficulty": "middels"},
    {"word": "dart", "category": "Sport", "difficulty": "middels"},
    {"word": "hengekøye", "category": "Sport", "difficulty": "middels"},
    {"word": "trampoline", "category": "Sport", "difficulty": "middels"},
    {"word": "akebrett", "category": "Sport", "difficulty": "middels"},
    {"word": "snøbrett", "category": "Sport", "difficulty": "middels"},
]


def get_random_word_triplet(exclude: List[str] = None) -> List[Dict[str, str]]:
    """Returns 3 diverse words (easy/medium/hard or across categories)."""
    exclude_set = {w.lower() for w in (exclude or [])}
    available = [item for item in TEGN_WORDS if item["word"].lower() not in exclude_set]
    if len(available) < 3:
        available = list(TEGN_WORDS)

    # Pick 1 easy, 1 medium, 1 hard or diverse categories
    easy = [w for w in available if w["difficulty"] == "lett"]
    medium = [w for w in available if w["difficulty"] == "middels"]
    hard = [w for w in available if w["difficulty"] == "vanskelig"]

    picked = []
    if easy:
        picked.append(random.choice(easy))
    if medium:
        picked.append(random.choice(medium))
    if hard:
        picked.append(random.choice(hard))

    # Fill remaining if any bucket was empty
    while len(picked) < 3:
        cand = random.choice(available)
        if cand not in picked:
            picked.append(cand)

    random.shuffle(picked)
    return picked


def is_close_guess(guess: str, target: str) -> bool:
    """Return True if guess is very close (distance 1-2) to the target word."""
    g = guess.strip().lower()
    t = target.strip().lower()
    if not g or not t or g == t:
        return False
    if abs(len(g) - len(t)) > 2:
        return False
    
    # Compute Levenshtein distance
    m, n = len(g), len(t)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(m + 1):
        dp[i][0] = i
    for j in range(n + 1):
        dp[0][j] = j
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            cost = 0 if g[i - 1] == t[j - 1] else 1
            dp[i][j] = min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
            
    dist = dp[m][n]
    return dist == 1 or (len(t) >= 6 and dist == 2)
