"""
Mer eller Mindre - Backend API router
Inspired by lessgames.com More or Less, tailored for Norwegian schools,
universities, admission cutoffs, and student counts with matching photos.
"""

import datetime
import hashlib
import json
from typing import Any, Dict, List, Optional, Tuple

DATASETS: Dict[str, Dict[str, Any]] = {
    "snitt_studier": {
        "id": "snitt_studier",
        "title": "Karaktergrenser på studier",
        "subtitle": "Ordinær kvote ved Samordna opptak (poeng)",
        "unit": "poeng",
        "description": "Hvilket studium krever høyest poenggrense for å komme inn?",
        "items": [
            {
                "title": "Medisin",
                "org": "Universitetet i Oslo (UiO)",
                "val": 68.5,
                "extra": "Tradisjonelt Norges vanskeligste studium å komme inn på.",
                "image": "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Industriell økonomi (Indøk)",
                "org": "NTNU Trondheim",
                "val": 67.8,
                "extra": "Norges mest krevende sivilingeniørstudium.",
                "image": "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Psykologi (profesjon)",
                "org": "Universitetet i Oslo (UiO)",
                "val": 66.8,
                "extra": "Seksårig profesjonsutdanning med svært høyt snitt.",
                "image": "https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Odontologi (tannlege)",
                "org": "Universitetet i Bergen (UiB)",
                "val": 66.2,
                "extra": "Femårig integrert master i tannhelse.",
                "image": "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Veterinærmedisin",
                "org": "NMBU Ås",
                "val": 65.4,
                "extra": "Landets eneste veterinærutdanning.",
                "image": "https://images.unsplash.com/photo-1532592950000-5d6ba01646fa?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Nanoteknologi (siv.ing)",
                "org": "NTNU Trondheim",
                "val": 64.5,
                "extra": "Spisset teknologistudium for fremtidens materialer.",
                "image": "https://images.unsplash.com/photo-1507668077129-56e32842fceb?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Datateknologi (siv.ing)",
                "org": "NTNU Trondheim",
                "val": 64.1,
                "extra": "Svært populært IT-studium på Gløshaugen.",
                "image": "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Rettsvitenskap (juss)",
                "org": "Universitetet i Oslo (UiO)",
                "val": 63.6,
                "extra": "Det juridiske fakultet ved Karl Johans gate.",
                "image": "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Siviløkonom",
                "org": "Norges handelshøyskole (NHH)",
                "val": 63.5,
                "extra": "NHHs prestisjetunge femårige siviløkonomprogram.",
                "image": "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Kybernetikk og robotikk (siv.ing)",
                "org": "NTNU Trondheim",
                "val": 63.2,
                "extra": "Autonome systemer og avansert reguleringsteknikk.",
                "image": "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Arkitektur",
                "org": "Arkitektur- og designhøgskolen i Oslo (AHO)",
                "val": 62.8,
                "extra": "Krever opptaksprøve i tillegg til høye karakterer.",
                "image": "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Fysikk og matematikk (siv.ing)",
                "org": "NTNU Trondheim",
                "val": 61.2,
                "extra": "Teoretisk tungt teknologistudium på Gløshaugen.",
                "image": "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Marin teknikk (siv.ing)",
                "org": "NTNU Trondheim",
                "val": 59.8,
                "extra": "Skips- og havteknologi på Tyholt.",
                "image": "https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Rettsvitenskap (juss)",
                "org": "Universitetet i Bergen (UiB)",
                "val": 59.2,
                "extra": "Det juridiske fakultet på Dragefjellet i Bergen.",
                "image": "https://images.unsplash.com/photo-1453733190028-57a68841e402?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Journalistikk",
                "org": "OsloMet – storbyuniversitetet",
                "val": 57.2,
                "extra": "Et av Norges mest tradisjonsrike journaliststudier.",
                "image": "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Statsvitenskap (bachelor)",
                "org": "Universitetet i Oslo (UiO)",
                "val": 55.4,
                "extra": "Det samfunnsvitenskapelige fakultet på Blindern.",
                "image": "https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Økonomi og administrasjon",
                "org": "Handelshøyskolen BI Oslo",
                "val": 51.0,
                "extra": "BIs største og mest kjente bachelorprogram.",
                "image": "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Informatikk: programmering og nettverk",
                "org": "Universitetet i Bergen (UiB)",
                "val": 50.8,
                "extra": "Matematisk-naturvitenskapelig fakultet i Bergen.",
                "image": "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Grunnskolelærerutdanning 1–7",
                "org": "OsloMet – storbyuniversitetet",
                "val": 43.5,
                "extra": "Lærerutdanning for barnetrinnet i Pilestredet.",
                "image": "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Sykepleie",
                "org": "UiT Norges arktiske universitet (Tromsø)",
                "val": 39.5,
                "extra": "Treårig helsefaglig bachelor i Nord-Norge.",
                "image": "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=800&auto=format&fit=crop&q=80",
            },
        ],
    },
    "studenttall": {
        "id": "studenttall",
        "title": "Antall studenter",
        "subtitle": "Registrerte studenter ved lærestedet",
        "unit": "studenter",
        "description": "Hvilket universitet eller høyskole har flest registrerte studenter?",
        "items": [
            {
                "title": "NTNU",
                "org": "Trondheim, Gjøvik og Ålesund",
                "val": 42500,
                "extra": "Norges desidert største universitet etter fusjonen i 2016.",
                "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/NTNU_Trondheim_Mainbuilding.jpg/800px-NTNU_Trondheim_Mainbuilding.jpg",
            },
            {
                "title": "Universitetet i Oslo (UiO)",
                "org": "Oslo (Blindern, sentrum)",
                "val": 26500,
                "extra": "Norges eldste universitet, grunnlagt i 1811.",
                "image": "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "OsloMet – storbyuniversitetet",
                "org": "Oslo og Kjeller",
                "val": 22000,
                "extra": "Norges tredje største lærested med profesjonsutdanninger.",
                "image": "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Handelshøyskolen BI",
                "org": "Oslo, Bergen, Trondheim, Stavanger",
                "val": 20000,
                "extra": "Norges største private handelshøyskole i Nydalen.",
                "image": "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Universitetet i Bergen (UiB)",
                "org": "Bergen (Nygårdshøyden)",
                "val": 19500,
                "extra": "Byuniversitet med sterke maritime og medisinske fag.",
                "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/University_of_Bergen%2C_Rector_s_Office%2C_Museplass_1.jpg/800px-University_of_Bergen%2C_Rector_s_Office%2C_Museplass_1.jpg",
            },
            {
                "title": "UiT Norges arktiske universitet",
                "org": "Tromsø, Alta, Narvik, Harstad",
                "val": 17000,
                "extra": "Verdens nordligste universitet med campus over hele landsdelen.",
                "image": "https://images.unsplash.com/photo-1517411032315-54ef2cb783bb?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Universitetet i Sørøst-Norge (USN)",
                "org": "Kongsberg, Vestfold, Telemark, Drammen",
                "val": 16500,
                "extra": "Distriktsuniversitet spredt over åtte campuser.",
                "image": "https://images.unsplash.com/photo-1562774053-701939374585?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Høgskulen på Vestlandet (HVL)",
                "org": "Bergen, Sogndal, Førde, Haugesund, Stord",
                "val": 16000,
                "extra": "Stor profesjonshøgskole på Vestlandet.",
                "image": "https://images.unsplash.com/photo-1519452635265-7b1fbfd1e4e0?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Universitetet i Agder (UiA)",
                "org": "Kristiansand og Grimstad",
                "val": 13000,
                "extra": "Universitet på Sørlandet med bred fagkrets.",
                "image": "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Universitetet i Stavanger (UiS)",
                "org": "Stavanger (Ullandhaug)",
                "val": 12500,
                "extra": "Kjent for petroleums-, helse- og teknologifag.",
                "image": "https://images.unsplash.com/photo-1592280771190-3e2e4d571952?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Høgskolen i Innlandet (HINN)",
                "org": "Lillehammer, Hamar, Elverum, Rena",
                "val": 11500,
                "extra": "Kjent for filmskolen på Lillehammer og lærerutdanning.",
                "image": "https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Høgskolen i Østfold (HiØ)",
                "org": "Halden og Fredrikstad",
                "val": 7800,
                "extra": "Campus ved grensen med IT- og helsefag.",
                "image": "https://images.unsplash.com/photo-1525921429624-479b6a26d84d?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "NMBU (Norges miljø- og biovitenskapelige universitet)",
                "org": "Ås (Akershus)",
                "val": 6400,
                "extra": "Landbruk, biovitenskap, veterinærmedisin og bærekraft.",
                "image": "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Høyskolen Kristiania",
                "org": "Oslo og Bergen",
                "val": 5500,
                "extra": "Privat høyskole innen markedsføring, ledelse og kreative fag.",
                "image": "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Norges handelshøyskole (NHH)",
                "org": "Bergen (Sandviken)",
                "val": 3600,
                "extra": "Spisset økonomisk eliteutdanning grunnlagt i 1936.",
                "image": "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Norges idrettshøgskole (NIH)",
                "org": "Oslo (Sognsvann)",
                "val": 1600,
                "extra": "Nasjonalt senter for forskning og utdanning innen idrettsvitenskap.",
                "image": "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Norges musikkhøgskole (NMH)",
                "org": "Oslo (Majorstuen)",
                "val": 650,
                "extra": "Landets fremste høyere utdanning innen musikkutøving.",
                "image": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Kunsthøgskolen i Oslo (KHiO)",
                "org": "Oslo (Grünerløkka)",
                "val": 550,
                "extra": "Utdanning innen teater, dans, opera og billedkunst.",
                "image": "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=800&auto=format&fit=crop&q=80",
            },
        ],
    },
    "snitt_vgs": {
        "id": "snitt_vgs",
        "title": "Inntakssnitt på videregående",
        "subtitle": "Inntakspoeng for studiespesialisering (V1)",
        "unit": "poeng",
        "description": "Hvilken videregående skole krevde høyest poengsum for å komme inn?",
        "items": [
            {
                "title": "Elvebakken videregående skole",
                "org": "Oslo (Grünerløkka)",
                "val": 53.8,
                "extra": "Oslos mest søkte skole med et snitt på nesten 5,4.",
                "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Elvebakken_vgs_Oslo.jpg/800px-Elvebakken_vgs_Oslo.jpg",
            },
            {
                "title": "Oslo Katedralskole («Katta»)",
                "org": "Oslo (St. Hanshaugen)",
                "val": 53.2,
                "extra": "Norges eldste skole med tradisjoner helt tilbake til 1153.",
                "image": "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Amalie Skram videregående skole",
                "org": "Bergen (sentrum)",
                "val": 51.5,
                "extra": "Bergens mest populære og moderne videregående skole.",
                "image": "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Bergen Katedralskole («Katten»)",
                "org": "Bergen (sentrum)",
                "val": 50.2,
                "extra": "Historisk katedralskole ved Domkirken i Bergen.",
                "image": "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Ullern videregående skole",
                "org": "Oslo (Ullern)",
                "val": 50.1,
                "extra": "Tett samarbeid med Oslo Cancer Cluster og forskningsmiljøer.",
                "image": "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Trondheim Katedralskole («Katta»)",
                "org": "Trondheim (Midtbyen)",
                "val": 49.8,
                "extra": "Norges eldste skole i drift, grunnlagt i 1152.",
                "image": "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Sandvika videregående skole",
                "org": "Bærum (Akershus)",
                "val": 49.5,
                "extra": "Svært populær videregående skole i Vestre Viken.",
                "image": "https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Foss videregående skole",
                "org": "Oslo (Grünerløkka)",
                "val": 49.2,
                "extra": "Tradisjonsrik skole kjent for musikklinje og høyt fagsnitt.",
                "image": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Edvard Munch videregående skole",
                "org": "Oslo (Ullevålsveien)",
                "val": 49.0,
                "extra": "Kjent for kunst, design og studiespesialisering.",
                "image": "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Nydalen videregående skole",
                "org": "Oslo (Nydalen)",
                "val": 48.6,
                "extra": "Moderne skole ved Akerselva med populære faglinjer.",
                "image": "https://images.unsplash.com/photo-1562774053-701939374585?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Stavanger Katedralskole («Kongsgård»)",
                "org": "Stavanger (sentrum)",
                "val": 48.5,
                "extra": "Ikonisk skolebygg ved Breiavatnet i hjertet av Stavanger.",
                "image": "https://images.unsplash.com/photo-1519452635265-7b1fbfd1e4e0?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Valler videregående skole",
                "org": "Bærum (Sandvika)",
                "val": 48.2,
                "extra": "Kjent for et sterkt realfagsmiljø i Bærum.",
                "image": "https://images.unsplash.com/photo-1525921429624-479b6a26d84d?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Thora Storm videregående skole",
                "org": "Trondheim (sentrum)",
                "val": 47.5,
                "extra": "Sentrumsskole i Trondheim med mange studiesøkere.",
                "image": "https://images.unsplash.com/photo-1577896851231-70ef18881754?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Lambertseter videregående skole",
                "org": "Oslo (Nordstrand)",
                "val": 46.5,
                "extra": "Idrettsfag og studiespesialisering i Oslo syd.",
                "image": "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Kristiansand Katedralskole Gimle",
                "org": "Kristiansand (Agder)",
                "val": 45.5,
                "extra": "Tradisjonsrik skole med IB-linje på Sørlandet.",
                "image": "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Kongsbakken videregående skole",
                "org": "Tromsø (sentrum)",
                "val": 45.0,
                "extra": "Tromsøs kjente sentrumsskole oppført i rød murstein.",
                "image": "https://images.unsplash.com/photo-1517411032315-54ef2cb783bb?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Drammen videregående skole",
                "org": "Drammen (Buskerud)",
                "val": 44.0,
                "extra": "Største videregående skole i Drammensregionen.",
                "image": "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&auto=format&fit=crop&q=80",
            },
        ],
    },
    "sokertall": {
        "id": "sokertall",
        "title": "Førsteprioritetssøkere",
        "subtitle": "Antall søkere med studiet som 1. valg (Samordna opptak)",
        "unit": "søkere",
        "description": "Hvilket studium hadde flest søkere som satte det som sitt 1. valg?",
        "items": [
            {
                "title": "Siviløkonom",
                "org": "Norges handelshøyskole (NHH)",
                "val": 2150,
                "extra": "Det enkeltstudiet i Norge med aller flest førsteprioritetssøkere.",
                "image": "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Rettsvitenskap (juss)",
                "org": "Universitetet i Oslo (UiO)",
                "val": 1950,
                "extra": "Fast i toppen over landets mest søkte utdanninger.",
                "image": "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Medisin",
                "org": "Universitetet i Oslo (UiO)",
                "val": 1350,
                "extra": "Kamp om studieplassene blant landets skarpeste elever.",
                "image": "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Industriell økonomi og teknologiledelse",
                "org": "NTNU Trondheim",
                "val": 1210,
                "extra": "Sivilingeniørlinjen med flest søkere på Gløshaugen.",
                "image": "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Psykologi (profesjon)",
                "org": "Universitetet i Oslo (UiO)",
                "val": 1050,
                "extra": "Svært attraktivt profesjonsstudium i hovedstaden.",
                "image": "https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Sykepleie (bachelor)",
                "org": "OsloMet – storbyuniversitetet",
                "val": 950,
                "extra": "Landets største enkeltutdanning innen sykepleie.",
                "image": "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Datateknologi (siv.ing)",
                "org": "NTNU Trondheim",
                "val": 860,
                "extra": "Høy etterspørsel etter IT-spesialister i næringslivet.",
                "image": "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Politiutdanningen",
                "org": "Politihøgskolen (Oslo)",
                "val": 780,
                "extra": "Bachelorutdanningen som fører til fast politiembete.",
                "image": "https://images.unsplash.com/photo-1589578527966-fdac0f44566c?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Veterinærmedisin",
                "org": "NMBU Ås",
                "val": 680,
                "extra": "Mange drømmer om å bli dyrlege hvert eneste år.",
                "image": "https://images.unsplash.com/photo-1532592950000-5d6ba01646fa?w=800&auto=format&fit=crop&q=80",
            },
            {
                "title": "Arkitektur (master)",
                "org": "Arkitektur- og designhøgskolen (AHO)",
                "val": 610,
                "extra": "Hard kamp om de kreative studieplassene i Oslo.",
                "image": "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=800&auto=format&fit=crop&q=80",
            },
        ],
    },
}


def _deterministic_seed(seed_str: str) -> int:
    h = hashlib.sha256(seed_str.encode("utf-8")).hexdigest()
    return int(h[:8], 16)


def _pseudo_random_choice(items: List[Any], rng_state: int) -> Tuple[Any, int]:
    rng_state = (rng_state * 1103515245 + 12345) & 0x7FFFFFFF
    idx = rng_state % len(items)
    return items[idx], rng_state


def generate_game_pack(category_id: Optional[str] = None, seed_str: Optional[str] = None) -> Dict[str, Any]:
    category_keys = list(DATASETS.keys())

    if seed_str:
        rng = _deterministic_seed(seed_str)
        if not category_id or category_id not in DATASETS:
            cat_key, rng = _pseudo_random_choice(category_keys, rng)
        else:
            cat_key = category_id
    else:
        import random
        cat_key = category_id if category_id in DATASETS else random.choice(category_keys)
        rng = random.randint(1, 1000000)

    category = DATASETS[cat_key]
    items_pool = list(category["items"])

    selected: List[Dict[str, Any]] = []
    available = list(items_pool)

    for _ in range(6):
        if not available:
            break
        last_val = selected[-1]["val"] if selected else None
        valid_candidates = [it for it in available if it["val"] != last_val] or available
        chosen, rng = _pseudo_random_choice(valid_candidates, rng)
        selected.append(chosen)
        available.remove(chosen)

    return {
        "category": {
            "id": category["id"],
            "title": category["title"],
            "subtitle": category["subtitle"],
            "unit": category["unit"],
            "description": category["description"],
        },
        "totalRounds": 5,
        "items": selected,
    }


class MerEllerMindreAPI:
    @staticmethod
    def handle_get(path: str, query: Dict[str, Any]) -> Optional[Tuple[int, Any]]:
        rel_path = path
        if rel_path.startswith("/api/mer-eller-mindre/"):
            rel_path = "/api/" + rel_path[len("/api/mer-eller-mindre/"):]

        today_str = datetime.date.today().isoformat()

        if rel_path == "/api/status":
            return 200, {
                "ok": True,
                "game": "mer-eller-mindre",
                "categories": list(DATASETS.keys()),
                "totalCategories": len(DATASETS),
            }

        if rel_path in ("/api/daily", "/api/today"):
            req_date = (query.get("date", [today_str])[0] or today_str).strip()
            try:
                datetime.date.fromisoformat(req_date)
            except ValueError:
                req_date = today_str

            pack = generate_game_pack(seed_str=f"mer_eller_mindre_{req_date}")
            pack["date"] = req_date
            pack["isDaily"] = True
            return 200, pack

        if rel_path in ("/api/practice", "/api/random"):
            cat = query.get("category", [""])[0]
            pack = generate_game_pack(category_id=cat if cat in DATASETS else None)
            pack["isDaily"] = False
            return 200, pack

        return None

    @staticmethod
    def handle_post(path: str, body: Dict[str, Any]) -> Optional[Tuple[int, Any]]:
        return None
