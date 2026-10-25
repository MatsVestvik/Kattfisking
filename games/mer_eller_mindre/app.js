/**
 * Mer eller Mindre – Norsk 5-delt kunnskapsduell
 * "Hvem har mest?" - Spilleren trykker direkte på kortet som er høyest!
 */

(() => {
  "use strict";

  const THEME_KEY = "kattfisking_theme";
  const DAILY_PREFIX = "mer_eller_mindre_daily_";
  const HIGHSCORE_KEY = "mer_eller_mindre_highscore";

  // App State
  const state = {
    mode: "daily", // "daily" | "practice"
    todayStr: new Date().toISOString().split("T")[0],
    category: null,
    items: [],
    currentIndex: 0, // 0 to 4 (5 comparisons total)
    score: 0,
    results: [], // Array of { a, b, chosen, winner, won }
    isLocked: false,
  };

  // DOM Elements
  const el = {
    btnModeDaily: document.getElementById("btnModeDaily"),
    btnModePractice: document.getElementById("btnModePractice"),
    themeToggleBtn: document.getElementById("themeToggleBtn"),
    btnHelp: document.getElementById("btnHelp"),
    helpModal: document.getElementById("helpModal"),
    btnCloseHelp: document.getElementById("btnCloseHelp"),

    progressTrack: document.getElementById("progressTrack"),
    scoreDisplay: document.getElementById("scoreDisplay"),
    catBadge: document.getElementById("catBadge"),
    catDesc: document.getElementById("catDesc"),

    // Card A
    cardA: document.getElementById("cardA"),
    titleA: document.getElementById("titleA"),
    orgA: document.getElementById("orgA"),
    extraA: document.getElementById("extraA"),
    valA: document.getElementById("valA"),
    unitA: document.getElementById("unitA"),
    metricLabelA: document.getElementById("metricLabelA"),
    statusBadgeA: document.getElementById("statusBadgeA"),
    promptTextA: document.getElementById("promptTextA"),

    // Card B
    cardB: document.getElementById("cardB"),
    titleB: document.getElementById("titleB"),
    orgB: document.getElementById("orgB"),
    extraB: document.getElementById("extraB"),
    valB: document.getElementById("valB"),
    unitB: document.getElementById("unitB"),
    metricLabelB: document.getElementById("metricLabelB"),
    statusBadgeB: document.getElementById("statusBadgeB"),
    promptTextB: document.getElementById("promptTextB"),

    // Round Feedback
    roundFeedback: document.getElementById("roundFeedback"),
    feedbackBadge: document.getElementById("feedbackBadge"),
    feedbackMsg: document.getElementById("feedbackMsg"),
    btnNextRound: document.getElementById("btnNextRound"),

    // Summary Modal
    summaryModal: document.getElementById("summaryModal"),
    summaryModeBadge: document.getElementById("summaryModeBadge"),
    bigScore: document.getElementById("bigScore"),
    scorePraise: document.getElementById("scorePraise"),
    emojiGrid: document.getElementById("emojiGrid"),
    btnCopyResult: document.getElementById("btnCopyResult"),
    toastMsg: document.getElementById("toastMsg"),
    reviewList: document.getElementById("reviewList"),
    btnPlayAgain: document.getElementById("btnPlayAgain"),
  };

  function formatNumber(num) {
    if (Number.isInteger(num)) {
      return Number(num).toLocaleString("no-NO");
    }
    return Number(num).toLocaleString("no-NO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }

  // Count-up animation for revealing challenger value
  function animateValue(elem, start, end, durationMs = 500) {
    const startTime = performance.now();
    const isFloat = !Number.isInteger(end);

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * ease;
      elem.textContent = formatNumber(isFloat ? current : Math.round(current));
      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        elem.textContent = formatNumber(end);
      }
    }
    requestAnimationFrame(update);
  }

  async function loadGame(mode = "daily") {
    state.mode = mode;
    state.currentIndex = 0;
    state.score = 0;
    state.results = [];
    state.isLocked = false;

    el.btnModeDaily.classList.toggle("active", mode === "daily");
    el.btnModePractice.classList.toggle("active", mode === "practice");

    el.summaryModal.classList.add("hidden");
    el.roundFeedback.classList.add("hidden");

    try {
      const endpoint = mode === "daily"
        ? `/api/mer-eller-mindre/daily?date=${state.todayStr}`
        : "/api/mer-eller-mindre/practice";

      const res = await fetch(endpoint);
      if (!res.ok) throw new Error("Kunne ikke hente spilldata");
      const data = await res.json();
      state.category = data.category;
      state.items = data.items;
    } catch (err) {
      console.warn("Bruker reserveliste for Mer eller Mindre:", err);
      state.category = {
        title: "Karaktergrenser på studier",
        subtitle: "Ordinær kvote ved Samordna opptak",
        unit: "poeng",
        description: "Hvilket studium krever høyest poenggrense for å komme inn?"
      };
      state.items = [
        { title: "Medisin", org: "Universitetet i Oslo (UiO)", val: 68.5, extra: "Tradisjonelt Norges vanskeligste studium å komme inn på." },
        { title: "Industriell økonomi (Indøk)", org: "NTNU Trondheim", val: 67.8, extra: "Norges mest krevende sivilingeniørstudium." },
        { title: "Psykologi profesjon", org: "Universitetet i Oslo (UiO)", val: 66.8, extra: "Seksårig profesjonsutdanning med høyt snitt." },
        { title: "Rettsvitenskap (juss)", org: "Universitetet i Oslo (UiO)", val: 63.6, extra: "Det juridiske fakultet ved Karl Johans gate." },
        { title: "Siviløkonom", org: "Norges handelshøyskole (NHH)", val: 63.5, extra: "NHHs prestisjetunge femårige masterprogram." },
        { title: "Datateknologi (siv.ing)", org: "NTNU Trondheim", val: 64.1, extra: "Svært populært IT-studium på Gløshaugen." }
      ];
    }

    renderCategory();
    renderStep();
  }

  function renderCategory() {
    el.catBadge.textContent = state.category.title.toUpperCase();
    el.catDesc.textContent = `${state.category.description} (${state.category.subtitle})`;
    el.unitA.textContent = state.category.unit;
    el.unitB.textContent = state.category.unit;
    el.metricLabelA.textContent = state.category.unit.toUpperCase();
    el.metricLabelB.textContent = state.category.unit.toUpperCase();
  }

  function updateProgressTrack() {
    const dots = el.progressTrack.querySelectorAll(".step-dot");
    dots.forEach((dot, idx) => {
      dot.className = "step-dot";
      if (idx < state.results.length) {
        dot.classList.add(state.results[idx].won ? "correct" : "wrong");
        dot.innerHTML = state.results[idx].won ? "✓" : "✗";
      } else if (idx === state.currentIndex) {
        dot.classList.add("active");
        dot.innerHTML = `<span class="step-num">${idx + 1}</span>`;
      } else {
        dot.innerHTML = `<span class="step-num">${idx + 1}</span>`;
      }
    });

    el.scoreDisplay.textContent = `${state.score} / 5`;
  }

  function renderStep() {
    state.isLocked = false;
    el.roundFeedback.classList.add("hidden");

    updateProgressTrack();

    const itemA = state.items[state.currentIndex];
    const itemB = state.items[state.currentIndex + 1];

    // Reset card classes & badges
    [el.cardA, el.cardB].forEach(card => {
      card.className = "entity-card selectable-card";
    });
    el.statusBadgeA.className = "card-status-badge hidden";
    el.statusBadgeB.className = "card-status-badge hidden";

    // Card A (Known baseline)
    el.cardA.classList.add("base-card");
    el.titleA.textContent = itemA.title;
    el.orgA.textContent = itemA.org;
    el.extraA.textContent = itemA.extra || "";
    el.valA.textContent = formatNumber(itemA.val);
    el.promptTextA.textContent = `Trykk her hvis ${itemA.title} har mest`;

    // Card B (Challenger with hidden value)
    el.cardB.classList.add("challenger-card");
    el.titleB.textContent = itemB.title;
    el.orgB.textContent = itemB.org;
    el.extraB.textContent = itemB.extra || "";
    el.valB.textContent = "???";
    el.valB.className = "metric-number hidden-val";
    el.promptTextB.textContent = `Trykk her hvis ${itemB.title} har mest`;
  }

  function selectCard(chosen) {
    if (state.isLocked) return;
    state.isLocked = true;

    const itemA = state.items[state.currentIndex];
    const itemB = state.items[state.currentIndex + 1];

    // Determine actual winner
    const actualWinner = itemA.val >= itemB.val ? "A" : "B";
    const won = chosen === actualWinner;

    if (won) state.score++;

    state.results.push({
      itemA,
      itemB,
      chosen,
      actualWinner,
      won,
    });

    // Lock cards
    el.cardA.classList.add("locked");
    el.cardB.classList.add("locked");

    // Reveal Card B's value
    el.valB.classList.remove("hidden-val");
    animateValue(el.valB, 0, itemB.val, 450);

    // Apply visual winner / loser states
    if (actualWinner === "A") {
      el.cardA.classList.add("winner-card");
      el.statusBadgeA.className = "card-status-badge winner";
      el.statusBadgeA.textContent = "🏆 HØYEST";

      el.cardB.classList.add("loser-card");
      el.statusBadgeB.className = "card-status-badge loser";
      el.statusBadgeB.textContent = "LAVERE";
    } else {
      el.cardB.classList.add("winner-card");
      el.statusBadgeB.className = "card-status-badge winner";
      el.statusBadgeB.textContent = "🏆 HØYEST";

      el.cardA.classList.add("loser-card");
      el.statusBadgeA.className = "card-status-badge loser";
      el.statusBadgeA.textContent = "LAVERE";
    }

    // Highlight user's choice
    const chosenCardElem = chosen === "A" ? el.cardA : el.cardB;
    chosenCardElem.classList.add("chosen-card");

    // Update progress track
    updateProgressTrack();

    // Show feedback banner after short count-up
    setTimeout(() => {
      el.feedbackBadge.className = `feedback-badge ${won ? "correct" : "wrong"}`;
      el.feedbackBadge.textContent = won ? "RIKTIG! (+1p)" : "FEIL!";

      const winItem = actualWinner === "A" ? itemA : itemB;
      const loseItem = actualWinner === "A" ? itemB : itemA;

      el.feedbackMsg.textContent = `${winItem.title} (${formatNumber(winItem.val)} ${state.category.unit}) har mer enn ${loseItem.title} (${formatNumber(loseItem.val)} ${state.category.unit}).`;

      if (state.currentIndex + 1 < 5) {
        el.btnNextRound.textContent = `Neste duell (${state.currentIndex + 2}/5) →`;
      } else {
        el.btnNextRound.textContent = "Se sluttresultat 🎉";
      }

      el.roundFeedback.classList.remove("hidden");
    }, 500);
  }

  function nextRound() {
    state.currentIndex++;
    if (state.currentIndex < 5) {
      renderStep();
    } else {
      finishGame();
    }
  }

  function finishGame() {
    el.roundFeedback.classList.add("hidden");

    if (state.mode === "daily") {
      const dailyData = {
        score: state.score,
        total: 5,
        date: state.todayStr,
        results: state.results.map(r => r.won),
      };
      localStorage.setItem(DAILY_PREFIX + state.todayStr, JSON.stringify(dailyData));
    }

    const curHs = parseInt(localStorage.getItem(HIGHSCORE_KEY) || "0", 10);
    if (state.score > curHs) {
      localStorage.setItem(HIGHSCORE_KEY, String(state.score));
    }

    el.summaryModeBadge.textContent = state.mode === "daily" ? `DAGENS UTGAVE (${state.todayStr})` : "FRISPILL";
    el.bigScore.textContent = `${state.score} / 5`;

    let praise = "God innsats!";
    if (state.score === 5) praise = "Perfekt! Du har full kontroll på utdannings-Norge! 🎓⭐";
    else if (state.score >= 4) praise = "Kjempebra spilt! Meget solid kunnskap! 👏";
    else if (state.score >= 3) praise = "Over halvparten riktig, godt levert! 👍";
    else praise = "Tøffe dueller i dag! Prøv igjen i frispill! 💪";
    el.scorePraise.textContent = praise;

    const emojiLine = state.results.map(r => (r.won ? "🟩" : "🟥")).join(" ");
    el.emojiGrid.textContent = emojiLine;

    el.reviewList.innerHTML = "";
    state.results.forEach((r, idx) => {
      const chosenItem = r.chosen === "A" ? r.itemA : r.itemB;
      const winItem = r.actualWinner === "A" ? r.itemA : r.itemB;
      const li = document.createElement("li");
      li.className = `review-item ${r.won ? "correct" : "wrong"}`;
      li.innerHTML = `
        <div>
          <div class="review-names">${idx + 1}. ${r.itemA.title} vs ${r.itemB.title}</div>
          <div class="review-vals">Du valgte: <strong>${chosenItem.title}</strong> • Fasit: <strong>${winItem.title}</strong> (${formatNumber(winItem.val)} ${state.category.unit})</div>
        </div>
        <div class="review-mark">${r.won ? "✅" : "❌"}</div>
      `;
      el.reviewList.appendChild(li);
    });

    el.summaryModal.classList.remove("hidden");
  }

  function copyResult() {
    const emojiLine = state.results.map(r => (r.won ? "🟩" : "🟥")).join(" ");
    const text = `Mer eller Mindre (${state.mode === "daily" ? "Dagens" : "Frispill"})\n` +
      `Resultat: ${state.score}/5 riktige 🎓\n` +
      `${emojiLine}\n` +
      `${window.location.origin}/mer-eller-mindre/`;

    navigator.clipboard.writeText(text).then(() => {
      el.toastMsg.classList.remove("hidden");
      setTimeout(() => el.toastMsg.classList.add("hidden"), 2500);
    }).catch(() => {
      alert(text);
    });
  }

  // Click card event listeners
  el.cardA.addEventListener("click", () => selectCard("A"));
  el.cardB.addEventListener("click", () => selectCard("B"));

  // Keyboard accessibility on cards
  el.cardA.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      selectCard("A");
    }
  });
  el.cardB.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      selectCard("B");
    }
  });

  el.btnNextRound.addEventListener("click", nextRound);
  el.btnCopyResult.addEventListener("click", copyResult);

  el.btnModeDaily.addEventListener("click", () => loadGame("daily"));
  el.btnModePractice.addEventListener("click", () => loadGame("practice"));
  el.btnPlayAgain.addEventListener("click", () => loadGame("practice"));

  // Help Modal
  el.btnHelp.addEventListener("click", () => el.helpModal.classList.remove("hidden"));
  el.btnCloseHelp.addEventListener("click", () => el.helpModal.classList.add("hidden"));
  el.helpModal.addEventListener("click", (e) => {
    if (e.target === el.helpModal) el.helpModal.classList.add("hidden");
  });

  // Global Keyboard shortcuts:
  // "1" or ArrowLeft = Select Card A
  // "2" or ArrowRight = Select Card B
  // Space or Enter when feedback open = Next round
  window.addEventListener("keydown", (e) => {
    if (!el.roundFeedback.classList.contains("hidden")) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        nextRound();
      }
      return;
    }

    if (e.key === "1" || e.key === "ArrowLeft") {
      selectCard("A");
    } else if (e.key === "2" || e.key === "ArrowRight") {
      selectCard("B");
    }
  });

  // Theme Sync
  const savedTheme = localStorage.getItem(THEME_KEY) || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);

  el.themeToggleBtn.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") || "dark";
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
  });

  // Start game on load
  loadGame("daily");
})();
