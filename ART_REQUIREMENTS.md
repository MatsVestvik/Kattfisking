# NTNU Games – Art Bible & Asset Requirements
**Visuell identitet, kunstretningslinjer og komplett asset-spesifikasjon**

---

## 1. Visjon og Kjerneidentitet
NTNU Games skal ikke føles som en samling tilfeldige, AI-genererte webmaler. Plattformen skal ha en tydelig, sjarmerende og gjennomført identitet:

> **«Neo-Retro Nordic Campus»**
> En kjærlig krysning mellom klassisk 16-bits pikslet sjarme (inspirert av Game Boy Advance og SNES) og moderne, skandinavisk glassmorfisme med mørkt natt-tema, myke neon-aksenter og ekte studenthumor fra Trondheim.

### Hvorfor nettstedet tidligere føltes «generert»:
1. **Stilkræsj på ikoner:**
   - Dagsspillene (*Kattfisking, Mer eller Mindre, NTNU guesser*) og logoen bruker autentisk 64×64 pikselkunst med gjennomsiktig bakgrunn og svart kontur.
   - Partyspillene (*Ordbombe, Tegn & Gjett*) ble generert som 256×256 3D-renderte bilder med ugjennomsiktig mørk firkantet bakgrunn og kunstig dithering.
   - Resultatet var at partyspillene så ut som de hørte hjemme på et helt annet nettsted.
2. **Generisk typografi:**
   - Fallback til standard systemsnitt og `Courier New` som skrivemaskin-font, til tross for at prosjektet har retrofonter i ressursmappen.
3. **Plattform-emojis som avatarer:**
   - Å bruke standard mobil-emojis (👑, 🍕, 🍺) i Party Lounge gir et uferdig preg, ettersom de ser vidt forskjellige ut på iOS, Android og Windows.
4. **Tekst og tone-of-voice:**
   - Overforklarende «AI-tekst» som manglet ekte studentnerve og humor.

---

## 2. Fargepalett og Designtokens

| Token Navn | Hexkode | Beskrivelse & Bruk |
|---|---|---|
| `--ntnu-navy` | `#0a0e17` | Hovedbakgrunn for alle spill og hub |
| `--gloshaugen-slate` | `#131b2e` | Kortbakgrunner og glass-paneler |
| `--fjord-blue` | `#00b4d8` | Kategoriaksent, vann, lenker og fokusringer |
| `--student-gold` | `#ffd166` | Dagsspill-tag, gullstjerner, streak-flamme |
| `--vors-orange` | `#fb8500` | Partyspill, Party Lounge, Ordbombe, lunte |
| `--samfundet-red` | `#ef476f` | Feil svar, fare-varsel, nedtelling < 10s |
| `--herb-green` | `#06d6a0` | Riktige svar, fullførte dagsoppgaver, live-dot |
| `--linjeforening-purple`| `#8338ec`| Spesialoppgaver, quiz-kort |

---

## 3. Komplett Oversikt over Kunst & Grafikk som Trengs

### Kategori A: Spillikoner (Hovedkort & Spillvelger)
*Spesifikasjon: 64×64 px PNG (@2x: 128×128 px), transparent bakgrunn, 16-bits pikselstil med tydelig 1px mørk kontur.*

| Filnavn | Spill | Beskrivelse av motiv | Status |
|---|---|---|---|
| `ntnu_games.png` | **Plattformlogo** | Pikslet NTNU-spiral i dyp marinblå og gull med piksel-skygge. | Eksisterer (64×64) |
| `catfish.png` | **Kattfisking** | Pikslet yin-yang sirkel: Gylden katt som sover mot en turkis ørret. | Eksisterer (64×64) |
| `moreorless.png` | **Mer eller Mindre** | To pikslede duell-piler (grønn pil opp, rød pil ned) med svart kant. | Eksisterer (64×64) |
| `ntnu_guesser.png` | **NTNU guesser** | Antikk pikslet campus-kompass i messing med rød/blå kompassnål. | Eksisterer (64×64) |
| `ordbombe.png` | **Ordbombe** | **NYTT BEHOV:** Klassisk rund, kullsvart tegneserie-bombe med tent, gnistrende lunte. **Må ha gjennomsiktig bakgrunn** (ikke firkantet mørk boks). | Trenger oppdatering |
| `tegn_og_gjett.png` | **Tegn & Gjett** | **NYTT BEHOV:** Pikslet staffeli i tre med fargeklatt-palett og malerpensel med fargesprut. **Må ha gjennomsiktig bakgrunn**. | Trenger oppdatering |

---

### Kategori B: Egendefinerte Student-Avatarer (Party Lounge)
*Erstatter rå system-emojis i Party Lounge med et unikt, helhetlig sett med pikslede student-arketyper.*
*Spesifikasjon: 48×48 px PNG, transparent bakgrunn.*

1. **Gløshaugen-ingeniøren** (Vernebriller i panna, kalkulator i brystlomma)
2. **Dragvoll-filosofen** (Mulepose, stripete skjerf, runde briller)
3. **Samfundet-gjengmedlemmet** (Rødrundt bygg-pin på jakkeslaget, sløyfe)
4. **Fadderbarnet** (Gul fadderuke-caps og navnelapp rundt halsen)
5. **Lesesal-zombien** (Kaffekopp i hånda, store mørke ringer under øynene)
6. **Linjeforenings-sjefen** (Staselig ordensbånd over brystet og solbriller)
7. **Hybel-gourmeten** (Forkle og stekepanne med Grandiosa-stykke)
8. **Bymarka-turgåeren** (Vinterlue og treski over skuldra)
9. **Kattfiskeren** (Fiskerhatt med fiskekrok og kattelapper)
10. **Quiz-generalen** (Krone og spørsmålstegn-medaljong)
11. **Vorspiel-trubaduren** (Kassegitar og baklengs caps)
12. **NTNU-Gullbjørnen** (Sjarmerende maskot-bjørn med studenterlue)

---

### Kategori C: Parallakse- og Miljøkunst (Trondheim / Campus)
*Bakgrunnen er delt i 4 sømløse lag som beveger seg i parallakse.*
*Spesifikasjon: 1920×1080 px PNG med transparent bakgrunn (unntatt himmel).*

1. **Lag 1 – Nordisk Kveldshimmel (`1.png`):**
   - Myk kveldsglød over Trondheim med stjerner og svakt, levende grønt nordlys.
2. **Lag 2 – Fjord & Munkholmen (`2.png`):**
   - Trondheimsfjorden med silhuetten av Munkholmen og Fosen-alpene i horisonten med blinkende kystlys.
3. **Lag 3 – Hovedbygningen Gløshaugen (`3.png`):**
   - Det ikoniske granittslottet på Gløshaugen med opplyste vinduer og kobbertårn.
4. **Lag 4 – Forgrunn & Plen (`4.png`):**
   - Gressplenen foran Hovedbygningen, historiske gatelykter og studenter på vei til vorspiel.

---

### Kategori D: In-Game Grafikk og Animasjoner

#### 1. Kattfisking
- **Fiskerbåt og katt:** Pikslet robåt på Nidelva med katten som kaster snøret.
- **Fangstbok-ikoner:** 8 pikslede fiskearter (Laks, Torsk, Makrell, Kveite, osv.) og skrot (Gummistøvel, gammel sykkel fra Nidelva).

#### 2. Mer eller Mindre
- **5 Kategori-emblemer:**
  - 🎓 *Karakterer* (Diplom med rød sløyfe)
  - 👥 *Søkertall* (Kø med studenter)
  - 📉 *Strykprosent* (Rødt fareskilt / F-karakter)
  - 🏛️ *Linjer & Campuser* (Søyler)
  - 🏫 *Videregående snitt* (Klasserom / tavle)

#### 3. Ordbombe
- **Sentral lunte-animasjon:** 4 pikslede rammer som viser den brennende lunten som spiser seg innover.
- **Eksplosjons-sprite:** Pikslet retro-eksplosjon med røyk og stjerner når bomben smeller.
- **Spillersirkel:** Elegante pikslede pilarer/sirkler der bomben flyttes fra spiller til spiller.

#### 4. Tegn & Gjett
- **Staffeli-ramme:** Pikslet trestaffeli rundt lerretet.
- **Seierspall:** 1., 2. og 3. plass med pikslede pokaler, laurbærkranser og gullkonfetti.

---

## 4. Retningslinjer for Implementering
1. **Pikseljustering i CSS:**
   Bruk alltid:
   ```css
   image-rendering: pixelated;
   image-rendering: -moz-crisp-edges;
   image-rendering: crisp-edges;
   ```
   for 64×64 ikoner for å hindre uklarhet på høyoppløselige Retina-skjermer.
2. **Ingen solide bakgrunner på frittstående ikoner:**
   Alle spillikoner skal ha gjennomsiktig bakgrunn, slik at kortenes glassmorfiske bakgrunn og fargetema (`card-orange`, `card-cyan`) skinner gjennom naturlig.
3. **Typografisk konsekvens:**
   - Brødtekst og grensesnitt: `Plus Jakarta Sans` (moderne, leservennlig, skandinavisk).
   - Tagger, poeng, nedtellere og datoer: `EditUndo` (retro piksel-font).
