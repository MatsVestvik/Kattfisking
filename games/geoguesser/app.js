(() => {
  "use strict";

  const QUESTIONS = [
    {
      badge: "NATURPERLE",
      icon: "⛰️",
      clue: "Et ikonisk fjellplatå som rager 604 meter loddrett over Lysefjorden.",
      correct: "Rogaland (Strand)",
      options: ["Rogaland (Strand)", "Vestland (Voss)", "Møre og Romsdal (Stranda)", "Nordland (Moskenes)"],
      info: "Preikestolen ligger i Strand kommune ved Lysefjorden i Rogaland fylke."
    },
    {
      badge: "HISTORIE & BY",
      icon: "⛪",
      clue: "Norges nasjonalhelligdom og Olav den helliges gravkirke.",
      correct: "Trøndelag (Trondheim)",
      options: ["Trøndelag (Trondheim)", "Vestland (Bergen)", "Oslo", "Innlandet (Hamar)"],
      info: "Nidarosdomen i Trondheim er verdens nordligste middelalderske katedral."
    },
    {
      badge: "ARKITEKTUR",
      icon: "🎭",
      clue: "Hvit marmorbygning i Bjørvika hvor publikum kan gå rett opp på det skrå taket.",
      correct: "Oslo",
      options: ["Oslo", "Rogaland (Stavanger)", "Troms (Tromsø)", "Vestfold (Tønsberg)"],
      info: "Operahuset i Oslo stod ferdig i 2008 og er tegnet av Snøhetta."
    },
    {
      badge: "VERDENSARV",
      icon: "🪵",
      clue: "Historisk trehusbebyggelse fra hansatiden ved Vågen.",
      correct: "Vestland (Bergen)",
      options: ["Vestland (Bergen)", "Møre og Romsdal (Ålesund)", "Agder (Arendal)", "Nordland (Svolvær)"],
      info: "Bryggen i Bergen er på UNESCOs verdensarvliste og var sete for Det hanseatiske kontor."
    },
    {
      badge: "ARKTISK NATUR",
      icon: "🧭",
      clue: "Klippeplatå på Magerøya kjent som Europas nordligste punkt tilknyttet fastlandsvei.",
      correct: "Finnmark (Nordkapp)",
      options: ["Finnmark (Nordkapp)", "Troms (Senja)", "Nordland (Andøy)", "Svalbard (Longyearbyen)"],
      info: "Nordkapplatået rager 307 meter over Barentshavet i Finnmark."
    }
  ];

  let currentRound = 0;
  let score = 0;
  const TOTAL_ROUNDS = QUESTIONS.length;

  const roundEl = document.getElementById("roundDisplay");
  const scoreEl = document.getElementById("scoreDisplay");
  const categoryBadge = document.getElementById("categoryBadge");
  const geoIcon = document.getElementById("geoIcon");
  const geoClue = document.getElementById("geoClue");
  const optionsGrid = document.getElementById("optionsGrid");

  const feedbackOverlay = document.getElementById("feedbackOverlay");
  const feedbackIcon = document.getElementById("feedbackIcon");
  const feedbackTitle = document.getElementById("feedbackTitle");
  const feedbackText = document.getElementById("feedbackText");
  const btnNext = document.getElementById("btnNext");

  function loadRound(idx) {
    feedbackOverlay.classList.add("hidden");
    const q = QUESTIONS[idx];

    roundEl.textContent = `${idx + 1}/${TOTAL_ROUNDS}`;
    scoreEl.textContent = score;

    categoryBadge.textContent = q.badge;
    geoIcon.textContent = q.icon;
    geoClue.textContent = q.clue;

    optionsGrid.innerHTML = "";
    q.options.forEach(opt => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "option-btn";
      btn.textContent = opt;
      btn.addEventListener("click", () => handleSelect(opt, q));
      optionsGrid.appendChild(btn);
    });
  }

  function handleSelect(chosen, q) {
    const isCorrect = chosen === q.correct;
    const btns = optionsGrid.querySelectorAll(".option-btn");
    btns.forEach(b => {
      b.disabled = true;
      if (b.textContent === q.correct) b.classList.add("correct");
      else if (b.textContent === chosen) b.classList.add("wrong");
    });

    if (isCorrect) score += 1000;

    setTimeout(() => {
      feedbackIcon.textContent = isCorrect ? "🎯" : "📍";
      feedbackTitle.textContent = isCorrect ? "Blink! (+1 000p)" : "Bom!";
      feedbackText.textContent = `${q.info}`;

      if (currentRound + 1 < TOTAL_ROUNDS) {
        btnNext.textContent = "Neste runde →";
      } else {
        btnNext.textContent = "Se sluttresultat 🎉";
      }
      feedbackOverlay.classList.remove("hidden");
    }, 500);
  }

  btnNext.addEventListener("click", () => {
    currentRound++;
    if (currentRound < TOTAL_ROUNDS) {
      loadRound(currentRound);
    } else {
      // Game ended
      feedbackIcon.textContent = "🏆";
      feedbackTitle.textContent = `Fullført! ${score} / ${TOTAL_ROUNDS * 1000} poeng`;
      feedbackText.textContent = `Fantastisk spilt! Du har fullført dagens runde i NTNU guesser.`;
      btnNext.textContent = "Spill på nytt ↺";
      btnNext.onclick = () => {
        currentRound = 0;
        score = 0;
        btnNext.onclick = null;
        loadRound(0);
      };
    }
  });

  // Locked to dark theme
  document.documentElement.setAttribute("data-theme", "dark");

  loadRound(0);
})();
