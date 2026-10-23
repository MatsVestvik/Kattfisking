# 🐈🐟 Kattfisking

**Kattfisking** er et daglig norsk nettleserspill inspirert av [catfishing.net](https://catfishing.net), laget for å være superenkelt å kjøre på en **Raspberry Pi**.

Hver dag trekkes **10 artikler fra norsk Wikipedia** (`no.wikipedia.org`). Du får kun se hvilke Wikipedia-kategorier artikkelen tilhører (med røpe-kategorier og vedlikeholdskategorier automatisk filtrert bort), og skal gjette hvilken artikkel det er!

---

## ✨ Funksjoner

- **📅 Dagens utfordring (10 artikler):** Alle som spiller på samme dato får de samme 10 norske Wikipedia-artiklene. Du har **kun 1 gjett per artikkel**!
- **🤏 «Mente du…?» (skrivefeil- og etternavnstoleranse):** Små tastefeil fanges opp med Damerau-Levenshtein-sjekk, og alle norske Wikipedia-omdirigeringer (f.eks. *Nidaros domkirke* → *Nidarosdomen*, *Ap* → *Arbeiderpartiet*) godkjennes automatisk.
- **🐟 «Nære nok? Gi meg 0,5p»:** Hvis du bommer på ditt ene gjett, kan du tildele deg selv et halvt poeng etter at fasiten vises dersom du var inne på riktig emne (akkurat som på catfishing.net).
- **🔤 Frivillige hint:** Vis ordmønster/forbokstaver eller første setning fra artikkelen med oppslagsordet sladdet (`[███]`).
- **🗂️ Arkivmodus:** Spill tidligere dagers utfordringer.
- **♾️ Frispill (Evig modus):** Spill tilfeldige artikler fra databasen med rekke-teller (`🔥 Rekke`).
- **➕ Foreslå / kurater egne artikler:** Søk direkte mot `no.wikipedia.org`, forhåndsvis kategorifilteret, og legg til artikler i SQLite-databasen på Raspberry Pi-en din.
- **📋 Delbart resultatnett:** Kopier dagens score med `🐈` (1p), `🐟` (0,5p) og `⬛` (0p).

---

## 🚀 Kjøre lokalt eller på Raspberry Pi

Prosjektet har **null eksterne pakkeavhengigheter** (ingen tung kompilering på Raspberry Pi) og inkluderer både en Node.js-server (`server.js`) og en Python 3-server (`server.py`) som deler samme SQLite-database (`data/kattfisking.db`).

### Alternativ 1: Start direkte (Node.js eller Python 3)

```bash
chmod +x start.sh
./start.sh
```
*(Eller kjør `node server.js` / `python3 server.py` direkte.)*

Åpne deretter **`http://localhost:3000`** (eller `http://<raspberry-pi-ip>:3000`) i nettleseren.

### Alternativ 2: Kjøre som bakgrunnstjeneste på Raspberry Pi (`systemd`)

1. Kopier prosjektet til f.eks. `/home/pi/Kattfisking` (eller juster stien i `kattfisking.service`).
2. Installer og aktiver tjenesten:
   ```bash
   sudo cp kattfisking.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now kattfisking.service
   ```
3. Sjekk status:
   ```bash
   sudo systemctl status kattfisking.service
   ```

### Alternativ 3: Docker Compose

```bash
docker compose up -d --build
```

---

## 🗄️ Oppdatere eller fylle på artikkeldatabasen

Ved første oppstart henter `wiki_harvester.py` automatisk over **240 norske Wikipedia-artikler** (både kuraterte norske klassikere og mest leste artikler via Wikimedia Pageviews API) og lagrer dem i `data/kattfisking.db`.

Du kan når som helst legge til nye artikler via **«➕ Legg til»**-fanen i nettleseren, eller kjøre:

```bash
python3 wiki_harvester.py
```
