/**
 * Mer eller Mindre – Norsk 5-delt kunnskapsduell
 * Inspirert av lessgames More or Less.
 * Skoler, inntakssnitt, studenttall og søkertall.
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
    results: [], // Array of { a, b, guessIsHigher, won }
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
    titleA: document.getElementById("titleA"),
    orgA: document.getElementById("orgA"),
    extraA: document.getElementById("extraA"),
    valA: document.getElementById("valA"),
    unitA: document.getElementById("unitA"),
    metricLabelA: document.getElementById("metricLabelA"),

    // Card B
    titleB: document.getElementById("titleB"),
    orgB: document.getElementById("orgB"),
    extraB: document.getElementById("extraB"),
    valB: document.getElementById("valB"),
    unitB: document.getElementById("unitB"),
    metricLabelB: document.getElementById("metricLabelB"),

    // Controls
    btnHigher: document.getElementById("btnHigher"),
    btnLower: document.getElementById("btnLower"),

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

  // Animate count-up of a revealed number
  function animateValue(elem, start, end, durationMs = 600) {
    const startTime = performance.now();
    const isFloat = !Number.isInteger(end);

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      // Ease-out
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

    // Fetch from API
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
      // Fallback data
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

    // Card A (Known)
    el.titleA.textContent = itemA.title;
    el.orgA.textContent = itemA.org;
    el.extraA.textContent = itemA.extra || "";
    el.valA.textContent = formatNumber(itemA.val);

    // Card B (Challenger)
    el.titleB.textContent = itemB.title;
    el.orgB.textContent = itemB.org;
    el.extraB.textContent = itemB.extra || "";
    el.valB.textContent = "???";
    el.valB.className = "metric-number hidden-val";

    // Enable Buttons
    el.btnHigher.disabled = false;
    el.btnLower.disabled = false;
  }

  function handleGuess(isHigherGuess) {
    if (state.isLocked) return;
    state.isLocked = true;

    el.btnHigher.disabled = true;
    el.btnLower.disabled = true;

    const itemA = state.items[state.currentIndex];
    const itemB = state.items[state.currentIndex + 1];

    const isActuallyHigher = itemB.val >= itemA.val;
    const won = isHigherGuess === isActuallyHigher;

    if (won) state.score++;

    state.results.push({
      itemA,
      itemB,
      isHigherGuess,
      isActuallyHigher,
      won,
    });

    // Reveal challenger value with counting animation
    el.valB.classList.remove("hidden-val");
    animateValue(el.valB, 0, itemB.val, 500);

    // Update progress dot immediately
    updateProgressTrack();

    // Show feedback banner after short count-up
    setTimeout(() => {
      el.feedbackBadge.className = `feedback-badge ${won ? "correct" : "wrong"}`;
      el.feedbackBadge.textContent = won ? "RIKTIG! (+1p)" : "FEIL!";

      const compText = itemB.val > itemA.val ? "høyere enn" : itemB.val < itemA.val ? "lavere enn" : "helt lik";
      el.feedbackMsg.textContent = `${itemB.title} (${formatNumber(itemB.val)} ${state.category.unit}) er ${compText} ${itemA.title} (${formatNumber(itemA.val)} ${state.category.unit}).`;

      if (state.currentIndex + 1 < 5) {
        el.btnNextRound.textContent = `Neste oppgave (${state.currentIndex + 2}/5) →`;
      } else {
        el.btnNextRound.textContent = "Se sluttresultat 🎉";
      }

      el.roundFeedback.classList.remove("hidden");
    }, 550);
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

    // Save Daily completion to localStorage for Hub sync
    if (state.mode === "daily") {
      const dailyData = {
        score: state.score,
        total: 5,
        date: state.todayStr,
        results: state.results.map(r => r.won),
      };
      localStorage.setItem(DAILY_PREFIX + state.todayStr, JSON.stringify(dailyData));
    }

    // High score
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

    // Emoji Grid
    const emojiLine = state.results.map(r => (r.won ? "🟩" : "🟥")).join(" ");
    el.emojiGrid.textContent = emojiLine;

    // Review list
    el.reviewList.innerHTML = "";
    state.results.forEach((r, idx) => {
      const li = document.createElement("li");
      li.className = `review-item ${r.won ? "correct" : "wrong"}`;
      li.innerHTML = `
        <div>
          <div class="review-names">${idx + 1}. ${r.itemB.title} (${r.itemB.org})</div>
          <div class="review-vals">${formatNumber(r.itemB.val)} vs ${formatNumber(r.itemA.val)} ${state.category.unit} • Du gjettet: ${r.isHigherGuess ? "Mer ▲" : "Mindre ▼"}</div>
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

  // Event Listeners
  el.btnHigher.addEventListener("click", () => handleGuess(true));
  el.btnLower.addEventListener("click", () => handleGuess(false));
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

  // Keyboard navigation: ArrowUp = Higher, ArrowDown = Lower, Space/Enter = Next
  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp") {
      if (!el.btnHigher.disabled) handleGuess(true);
    } else if (e.key === "ArrowDown") {
      if (!el.btnLower.disabled) handleGuess(false);
    } else if (e.key === "Enter" || e.key === " ") {
      if (!el.roundFeedback.classList.contains("hidden")) {
        e.preventDefault();
        nextRound();
      }
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
