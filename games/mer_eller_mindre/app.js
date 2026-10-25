/**
 * Mer eller Mindre – Norsk 5-delt kunnskapsduell
 * "Hvem har mest?" - Spilleren trykker direkte på kortet som er høyest!
 * Inkluderer ekte bilder av skoler, studiesteder og universiteter.
 * Silkemyk overgang der Card B glir over til Card A, uten rykking eller stressende bunntekst.
 */

(() => {
  "use strict";

  const THEME_KEY = "kattfisking_theme";
  const DAILY_PREFIX = "mer_eller_mindre_daily_";
  const HIGHSCORE_KEY = "mer_eller_mindre_highscore";

  const FALLBACK_IMG = "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=800&auto=format&fit=crop&q=80";

  // App State
  const state = {
    mode: "daily", // "daily" | "practice"
    todayStr: new Date().toISOString().split("T")[0],
    category: null,
    items: [],
    currentIndex: 0, // 0 to 4 (5 comparisons total)
    score: 0,
    results: [], // Array of { itemA, itemB, chosen, actualWinner, won }
    isLocked: false,
  };

  let autoAdvanceTimer = null;

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
    imgA: document.getElementById("imgA"),
    titleA: document.getElementById("titleA"),
    orgA: document.getElementById("orgA"),
    valA: document.getElementById("valA"),
    unitA: document.getElementById("unitA"),
    metricLabelA: document.getElementById("metricLabelA"),
    statusBadgeA: document.getElementById("statusBadgeA"),

    // Card B
    cardB: document.getElementById("cardB"),
    imgB: document.getElementById("imgB"),
    titleB: document.getElementById("titleB"),
    orgB: document.getElementById("orgB"),
    valB: document.getElementById("valB"),
    unitB: document.getElementById("unitB"),
    metricLabelB: document.getElementById("metricLabelB"),
    statusBadgeB: document.getElementById("statusBadgeB"),

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
  function animateValue(elem, start, end, durationMs = 400) {
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
    if (autoAdvanceTimer) {
      clearTimeout(autoAdvanceTimer);
      autoAdvanceTimer = null;
    }

    state.mode = mode;
    state.currentIndex = 0;
    state.score = 0;
    state.results = [];
    state.isLocked = false;

    el.btnModeDaily.classList.toggle("active", mode === "daily");
    el.btnModePractice.classList.toggle("active", mode === "practice");

    el.summaryModal.classList.add("hidden");

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
        {
          title: "Medisin",
          org: "Universitetet i Oslo (UiO)",
          val: 68.5,
          image: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&auto=format&fit=crop&q=80"
        },
        {
          title: "Industriell økonomi (Indøk)",
          org: "NTNU Trondheim",
          val: 67.8,
          image: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&auto=format&fit=crop&q=80"
        },
        {
          title: "Psykologi profesjon",
          org: "Universitetet i Oslo (UiO)",
          val: 66.8,
          image: "https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=800&auto=format&fit=crop&q=80"
        },
        {
          title: "Rettsvitenskap (juss)",
          org: "Universitetet i Oslo (UiO)",
          val: 63.6,
          image: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80"
        },
        {
          title: "Siviløkonom",
          org: "Norges handelshøyskole (NHH)",
          val: 63.5,
          image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=80"
        },
        {
          title: "Datateknologi (siv.ing)",
          org: "NTNU Trondheim",
          val: 64.1,
          image: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop&q=80"
        }
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
    if (autoAdvanceTimer) {
      clearTimeout(autoAdvanceTimer);
      autoAdvanceTimer = null;
    }

    state.isLocked = false;
    updateProgressTrack();

    const itemA = state.items[state.currentIndex];
    const itemB = state.items[state.currentIndex + 1];

    // Reset card classes & inline styles
    el.cardA.className = "entity-card base-card selectable-card";
    el.cardB.className = "entity-card challenger-card selectable-card";
    el.statusBadgeA.className = "card-status-badge hidden";
    el.statusBadgeB.className = "card-status-badge hidden";

    el.cardA.style.transform = "";
    el.cardA.style.opacity = "";
    el.cardA.style.transition = "";

    el.cardB.style.transform = "";
    el.cardB.style.opacity = "";
    el.cardB.style.transition = "";
    el.cardB.style.zIndex = "";
    el.cardB.style.boxShadow = "";

    // Card A (Known baseline)
    el.titleA.textContent = itemA.title;
    el.orgA.textContent = itemA.org;
    el.valA.textContent = formatNumber(itemA.val);
    el.imgA.src = itemA.image || FALLBACK_IMG;
    el.imgA.alt = `${itemA.title} (${itemA.org})`;
    el.imgA.onerror = () => { el.imgA.src = FALLBACK_IMG; };

    // Card B (Challenger with hidden value)
    el.titleB.textContent = itemB.title;
    el.orgB.textContent = itemB.org;
    el.valB.textContent = "???";
    el.valB.className = "metric-number hidden-val";
    el.imgB.src = itemB.image || FALLBACK_IMG;
    el.imgB.alt = `${itemB.title} (${itemB.org})`;
    el.imgB.onerror = () => { el.imgB.src = FALLBACK_IMG; };
  }

  function selectCard(chosen) {
    // If locked and waiting to advance, allow skipping delay immediately!
    if (state.isLocked) {
      if (autoAdvanceTimer) {
        clearTimeout(autoAdvanceTimer);
        autoAdvanceTimer = null;
        transitionToNextRound();
      }
      return;
    }

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

    // Lock cards visually
    el.cardA.classList.add("locked");
    el.cardB.classList.add("locked");

    // Reveal Card B's value
    el.valB.classList.remove("hidden-val");
    animateValue(el.valB, 0, itemB.val, 400);

    // Apply visual winner / loser states directly on cards
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

    // Update progress track at the top
    updateProgressTrack();

    // Calm pause (1.2s) without stressful popups before seamless transition
    autoAdvanceTimer = setTimeout(() => {
      autoAdvanceTimer = null;
      transitionToNextRound();
    }, 1200);
  }

  function transitionToNextRound() {
    if (autoAdvanceTimer) {
      clearTimeout(autoAdvanceTimer);
      autoAdvanceTimer = null;
    }

    // If game is complete (5 duels done), open summary modal
    if (state.currentIndex + 1 >= 5) {
      state.currentIndex++;
      finishGame();
      return;
    }

    // Calculate exact displacement vector between Card B and Card A
    const rectA = el.cardA.getBoundingClientRect();
    const rectB = el.cardB.getBoundingClientRect();
    const deltaX = rectA.left - rectB.left;
    const deltaY = rectA.top - rectB.top;

    // Reset status badges before sliding
    el.cardB.classList.remove("winner-card", "loser-card", "chosen-card");
    el.statusBadgeA.className = "card-status-badge hidden";
    el.statusBadgeB.className = "card-status-badge hidden";

    // 1. Smooth slide-out for Card A
    el.cardA.style.transition = "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease";
    el.cardA.style.transform = "translateX(-110%) scale(0.94)";
    el.cardA.style.opacity = "0";

    // 2. Smooth physical glide for Card B directly into Card A's exact position
    el.cardB.style.zIndex = "25";
    el.cardB.style.boxShadow = "0 20px 50px rgba(0, 0, 0, 0.5), 0 0 30px var(--card-glow-active)";
    el.cardB.style.transition = "transform 0.55s cubic-bezier(0.25, 1, 0.35, 1), box-shadow 0.55s ease";
    el.cardB.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

    const vsDivider = document.querySelector(".vs-divider");
    if (vsDivider) vsDivider.style.opacity = "0.2";

    // 3. At the exact moment Card B arrives in Card A's spot (550ms):
    setTimeout(() => {
      state.currentIndex++;
      const nextItemA = state.items[state.currentIndex]; // previous Card B
      const nextItemB = state.items[state.currentIndex + 1]; // brand new challenger

      // Instantly freeze transitions on both cards to eliminate any jitter or overshoot
      el.cardA.style.transition = "none";
      el.cardB.style.transition = "none";

      // Card A immediately assumes the arrived item's content right at (0, 0)
      el.titleA.textContent = nextItemA.title;
      el.orgA.textContent = nextItemA.org;
      el.valA.textContent = formatNumber(nextItemA.val);
      el.imgA.src = nextItemA.image || FALLBACK_IMG;
      el.imgA.alt = `${nextItemA.title} (${nextItemA.org})`;
      el.cardA.className = "entity-card base-card selectable-card";
      el.statusBadgeA.className = "card-status-badge hidden";
      el.cardA.style.transform = "none";
      el.cardA.style.opacity = "1";

      // Card B resets its styles and receives the new challenger
      el.cardB.style.zIndex = "";
      el.cardB.style.boxShadow = "";
      el.cardB.className = "entity-card challenger-card selectable-card";
      el.statusBadgeB.className = "card-status-badge hidden";

      el.titleB.textContent = nextItemB.title;
      el.orgB.textContent = nextItemB.org;
      el.valB.textContent = "???";
      el.valB.className = "metric-number hidden-val";
      el.imgB.src = nextItemB.image || FALLBACK_IMG;
      el.imgB.alt = `${nextItemB.title} (${nextItemB.org})`;

      // Position new Card B off-screen to the right
      el.cardB.style.transform = "translateX(75px)";
      el.cardB.style.opacity = "0";

      if (vsDivider) vsDivider.style.opacity = "1";
      updateProgressTrack();

      // Trigger reflow so browser commits the start position
      void el.cardB.offsetHeight;

      // Animate new Card B sliding in from the right
      el.cardB.style.transition = "transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.3s ease";
      el.cardB.style.transform = "none";
      el.cardB.style.opacity = "1";

      // Finish transition and unlock
      setTimeout(() => {
        el.cardA.style.transition = "";
        el.cardB.style.transition = "";
        el.cardA.style.transform = "";
        el.cardB.style.transform = "";
        el.cardA.style.opacity = "";
        el.cardB.style.opacity = "";
        state.isLocked = false;
      }, 420);
    }, 550);
  }

  function finishGame() {
    if (autoAdvanceTimer) {
      clearTimeout(autoAdvanceTimer);
      autoAdvanceTimer = null;
    }

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
      const thumbSrc = winItem.image || r.itemB.image || FALLBACK_IMG;

      const li = document.createElement("li");
      li.className = `review-item ${r.won ? "correct" : "wrong"}`;
      li.innerHTML = `
        <img src="${thumbSrc}" alt="${winItem.title}" class="review-thumb" onerror="this.src='${FALLBACK_IMG}'" />
        <div class="review-details">
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
  // Space or Enter = Skip delay / advance immediately
  window.addEventListener("keydown", (e) => {
    if (autoAdvanceTimer) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        clearTimeout(autoAdvanceTimer);
        autoAdvanceTimer = null;
        transitionToNextRound();
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
