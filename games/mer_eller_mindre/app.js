/**
 * Mer eller Mindre – Norsk 25-delt kunnskapsduell (5 kategorier x 5 spørsmål)
 * "Hvem har mest?" - Spilleren trykker direkte på kortet som er høyest!
 * 5 Kategorier:
 * 1. Karaktergrenser på studier (poeng)
 * 2. Førsteprioritetssøkere (søkere)
 * 3. Strykprosent på universitetet (%)
 * 4. Antall studenter (studenter)
 * 5. Inntakssnitt på videregående (poeng)
 */

(() => {
  "use strict";

  const THEME_KEY = "kattfisking_theme";
  const DAILY_PREFIX = "mer_eller_mindre_25_daily_";
  const HIGHSCORE_KEY = "mer_eller_mindre_25_highscore";

  const FALLBACK_IMG = "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=800&auto=format&fit=crop&q=80";

  function getLocalDateString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // App State: 25 duels total (5 categories x 5 duels)
  const state = {
    mode: "daily", // "daily" | "practice"
    todayStr: getLocalDateString(),
    categories: [], // Array of 5 categories
    currentCatIndex: 0, // 0 to 4
    currentDuelInCat: 0, // 0 to 4
    totalDuels: 25,
    score: 0, // 0 to 25
    categoryScores: [0, 0, 0, 0, 0],
    categoryResults: [[], [], [], [], []],
    results: [], // Array of all 25 duels
    isLocked: false,
    inIntermission: false,
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

    categoryTabsNav: document.getElementById("categoryTabsNav"),
    duelCounterVal: document.getElementById("duelCounterVal"),
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

    // Category Intermission Modal
    categoryIntermissionModal: document.getElementById("categoryIntermissionModal"),
    intermissionIcon: document.getElementById("intermissionIcon"),
    intermissionTitle: document.getElementById("intermissionTitle"),
    intermissionScore: document.getElementById("intermissionScore"),
    nextCatIcon: document.getElementById("nextCatIcon"),
    nextCatTitle: document.getElementById("nextCatTitle"),
    nextCatDesc: document.getElementById("nextCatDesc"),
    btnContinueCategory: document.getElementById("btnContinueCategory"),

    // Summary Modal
    summaryModal: document.getElementById("summaryModal"),
    summaryModeBadge: document.getElementById("summaryModeBadge"),
    bigScore: document.getElementById("bigScore"),
    scorePraise: document.getElementById("scorePraise"),
    categoryBreakdownList: document.getElementById("categoryBreakdownList"),
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

  // Load 25-pack game from backend API
  async function loadGame(mode = "daily") {
    if (autoAdvanceTimer) {
      clearTimeout(autoAdvanceTimer);
      autoAdvanceTimer = null;
    }

    state.mode = mode;
    state.todayStr = getLocalDateString();
    state.currentCatIndex = 0;
    state.currentDuelInCat = 0;
    state.score = 0;
    state.categoryScores = [0, 0, 0, 0, 0];
    state.categoryResults = [[], [], [], [], []];
    state.results = [];
    state.isLocked = false;
    state.inIntermission = false;

    el.btnModeDaily.classList.toggle("active", mode === "daily");
    el.btnModePractice.classList.toggle("active", mode === "practice");

    el.categoryIntermissionModal.classList.add("hidden");
    el.summaryModal.classList.add("hidden");

    try {
      const endpoint = mode === "daily"
        ? `/api/mer-eller-mindre/daily?date=${state.todayStr}`
        : "/api/mer-eller-mindre/practice";

      const res = await fetch(endpoint);
      if (!res.ok) throw new Error("Kunne ikke hente 25-pakk");
      const data = await res.json();

      if (data.categories && data.categories.length === 5) {
        state.categories = data.categories;
      } else {
        throw new Error("Ufullstendige kategorier i respons");
      }
    } catch (err) {
      console.warn("Bruker innebygde kategorier for 25 dueller:", err);
      state.categories = getFallback25Pack();
    }

    renderCategoryTabs();
    renderCategoryHeader();
    renderStep(false);
  }

  function renderCategoryTabs() {
    if (!el.categoryTabsNav) return;
    el.categoryTabsNav.innerHTML = "";

    state.categories.forEach((cat, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "category-tab-btn";

      if (idx === state.currentCatIndex) {
        btn.classList.add("active");
      } else if (idx < state.currentCatIndex) {
        btn.classList.add("completed");
      }

      let badgeText = "0/5";
      if (idx < state.currentCatIndex) {
        badgeText = `✓ ${state.categoryScores[idx]}/5`;
      } else if (idx === state.currentCatIndex) {
        badgeText = `${state.currentDuelInCat + 1}/5`;
      }

      const shortTitle = getShortCategoryTitle(cat.title);
      btn.innerHTML = `
        <span class="category-tab-icon">${cat.icon || "📌"}</span>
        <span class="category-tab-name">${shortTitle}</span>
        <span class="category-tab-badge">${badgeText}</span>
      `;

      el.categoryTabsNav.appendChild(btn);
    });
  }

  function getShortCategoryTitle(title) {
    if (title.includes("Karaktergrenser")) return "Studier";
    if (title.includes("Førsteprioritet")) return "Søkere";
    if (title.includes("Strykprosent")) return "Strykprosent";
    if (title.includes("studenter")) return "Studenttall";
    if (title.includes("videregående")) return "Snitt VGS";
    return title.split(" ")[0];
  }

  function renderCategoryHeader() {
    const curCat = state.categories[state.currentCatIndex];
    if (!curCat) return;

    el.catBadge.textContent = `${curCat.icon || "🎓"} ${curCat.title.toUpperCase()} • KATEGORI ${state.currentCatIndex + 1}/5`;
    el.catDesc.textContent = `${curCat.description} (${curCat.subtitle})`;
    el.unitA.textContent = curCat.unit;
    el.unitB.textContent = curCat.unit;
    el.metricLabelA.textContent = curCat.unit.toUpperCase();
    el.metricLabelB.textContent = curCat.unit.toUpperCase();
  }

  function updateProgressTrack() {
    const dots = el.progressTrack.querySelectorAll(".step-dot");
    const catResults = state.categoryResults[state.currentCatIndex] || [];

    dots.forEach((dot, idx) => {
      dot.className = "step-dot";
      if (idx < catResults.length) {
        dot.classList.add(catResults[idx].won ? "correct" : "wrong");
        dot.innerHTML = catResults[idx].won ? "✓" : "✗";
      } else if (idx === state.currentDuelInCat) {
        dot.classList.add("active");
        dot.innerHTML = `<span class="step-num">${idx + 1}</span>`;
      } else {
        dot.innerHTML = `<span class="step-num">${idx + 1}</span>`;
      }
    });

    const globalDuelNum = Math.min(state.currentCatIndex * 5 + state.currentDuelInCat + 1, 25);
    el.duelCounterVal.textContent = `${globalDuelNum} / 25`;
    el.scoreDisplay.textContent = `${state.score} / 25`;
  }

  function renderStep(isTransition = false) {
    if (autoAdvanceTimer) {
      clearTimeout(autoAdvanceTimer);
      autoAdvanceTimer = null;
    }

    state.isLocked = false;
    updateProgressTrack();
    renderCategoryTabs();

    const curCat = state.categories[state.currentCatIndex];
    const itemA = curCat.items[state.currentDuelInCat];
    const itemB = curCat.items[state.currentDuelInCat + 1];

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
    if (state.inIntermission) return;

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

    const curCat = state.categories[state.currentCatIndex];
    const itemA = curCat.items[state.currentDuelInCat];
    const itemB = curCat.items[state.currentDuelInCat + 1];

    // Determine actual winner
    const actualWinner = itemA.val >= itemB.val ? "A" : "B";
    const won = chosen === actualWinner;

    if (won) {
      state.score++;
      state.categoryScores[state.currentCatIndex]++;
    }

    const duelResult = {
      categoryIndex: state.currentCatIndex,
      categoryTitle: curCat.title,
      unit: curCat.unit,
      duelInCat: state.currentDuelInCat,
      globalDuelIndex: state.currentCatIndex * 5 + state.currentDuelInCat + 1,
      itemA,
      itemB,
      chosen,
      actualWinner,
      won,
    };

    state.results.push(duelResult);
    state.categoryResults[state.currentCatIndex].push(duelResult);

    // Lock cards visually
    el.cardA.classList.add("locked");
    el.cardB.classList.add("locked");

    // Reveal Card B's value with count-up animation
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

    // Update progress track and category tab badges
    updateProgressTrack();
    renderCategoryTabs();

    // Calm 1.2s pause without stressful popup before advancing
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

    // If all 5 duels in the current category are done
    if (state.currentDuelInCat + 1 >= 5) {
      // Check if this was the 5th (final) category -> Finish 25 duels!
      if (state.currentCatIndex + 1 >= 5) {
        finishGame();
        return;
      }

      // Otherwise show Category Intermission Modal!
      showCategoryIntermission();
      return;
    }

    // Within same category: Card B glides over to Card A position!
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
      state.currentDuelInCat++;
      const curCat = state.categories[state.currentCatIndex];
      const nextItemA = curCat.items[state.currentDuelInCat]; // previous Card B
      const nextItemB = curCat.items[state.currentDuelInCat + 1]; // brand new challenger

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
      renderCategoryTabs();

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

  function showCategoryIntermission() {
    state.inIntermission = true;
    const completedCat = state.categories[state.currentCatIndex];
    const catScore = state.categoryScores[state.currentCatIndex];
    const nextCat = state.categories[state.currentCatIndex + 1];

    el.intermissionIcon.textContent = completedCat.icon || "🎓";
    el.intermissionTitle.textContent = `${completedCat.title} fullført!`;
    el.intermissionScore.textContent = `Du fikk ${catScore} av 5 riktige! Totalt så langt: ${state.score} / ${state.currentCatIndex * 5 + 5} poeng.`;

    el.nextCatIcon.textContent = nextCat.icon || "✨";
    el.nextCatTitle.textContent = nextCat.title;
    el.nextCatDesc.textContent = `${nextCat.description} (${nextCat.subtitle})`;

    el.categoryIntermissionModal.classList.remove("hidden");
  }

  function continueToNextCategory() {
    el.categoryIntermissionModal.classList.add("hidden");
    state.inIntermission = false;

    state.currentCatIndex++;
    state.currentDuelInCat = 0;

    renderCategoryTabs();
    renderCategoryHeader();
    renderStep(false);
  }

  el.btnContinueCategory.addEventListener("click", continueToNextCategory);

  function finishGame() {
    if (autoAdvanceTimer) {
      clearTimeout(autoAdvanceTimer);
      autoAdvanceTimer = null;
    }

    if (state.mode === "daily") {
      const dailyData = {
        score: state.score,
        total: 25,
        date: state.todayStr,
        categoryScores: state.categoryScores,
        results: state.results.map(r => r.won),
      };
      localStorage.setItem(DAILY_PREFIX + state.todayStr, JSON.stringify(dailyData));
    }

    const curHs = parseInt(localStorage.getItem(HIGHSCORE_KEY) || "0", 10);
    if (state.score > curHs) {
      localStorage.setItem(HIGHSCORE_KEY, String(state.score));
    }

    el.summaryModeBadge.textContent = state.mode === "daily" ? `DAGENS 25-DUELLER (${state.todayStr})` : "FRISPILL (25 DUELLER)";
    el.bigScore.textContent = `${state.score} / 25`;

    let praise = "God innsats!";
    if (state.score === 25) praise = "Helt uvirkelig! 25 av 25 riktige! Du er uovervinnelig! 👑⭐";
    else if (state.score >= 21) praise = "Fantastisk spilt! Du kjenner hele utdannings-Norge inn og ut! 🎓🔥";
    else if (state.score >= 17) praise = "Meget imponerende resultat! Solid kunnskap i alle kategorier! 👏";
    else if (state.score >= 13) praise = "Over halvparten riktig, godt levert gjennom 25 tøffe runder! 👍";
    else praise = "25 tøffe dueller i dag! Prøv en ny runde i frispill! 💪";
    el.scorePraise.textContent = praise;

    // Build Category Scorecard Breakdown
    if (el.categoryBreakdownList) {
      el.categoryBreakdownList.innerHTML = "";
      state.categories.forEach((cat, idx) => {
        const catScore = state.categoryScores[idx] || 0;
        const row = document.createElement("div");
        row.className = "breakdown-row";
        row.innerHTML = `
          <div class="breakdown-cat-name">
            <span>${cat.icon || "📌"}</span>
            <strong>${cat.title}</strong>
          </div>
          <div class="breakdown-cat-score">${catScore} / 5</div>
        `;
        el.categoryBreakdownList.appendChild(row);
      });
    }

    // Build 5x5 emoji grid (one row per category)
    const emojiRows = state.categoryResults.map(catRes => {
      return catRes.map(r => (r.won ? "🟩" : "🟥")).join(" ");
    });
    el.emojiGrid.textContent = emojiRows.join("\n");

    // Build detailed review list of all 25 duels with photos
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
          <div class="review-names">#${idx + 1} (${r.categoryTitle}): ${r.itemA.title} vs ${r.itemB.title}</div>
          <div class="review-vals">Du valgte: <strong>${chosenItem.title}</strong> • Fasit: <strong>${winItem.title}</strong> (${formatNumber(winItem.val)} ${r.unit})</div>
        </div>
        <div class="review-mark">${r.won ? "✅" : "❌"}</div>
      `;
      el.reviewList.appendChild(li);
    });

    el.summaryModal.classList.remove("hidden");
  }

  function copyResult() {
    const emojiRows = state.categoryResults.map(catRes => {
      return catRes.map(r => (r.won ? "🟩" : "🟥")).join(" ");
    }).join("\n");

    const text = `Mer eller Mindre (25 dueller)\n` +
      `Resultat: ${state.score}/25 riktige 🎓\n` +
      `${emojiRows}\n` +
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
  // Space or Enter = Skip delay or continue intermission
  window.addEventListener("keydown", (e) => {
    if (state.inIntermission) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        continueToNextCategory();
      }
      return;
    }

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

  // Always locked to dark theme
  document.documentElement.setAttribute("data-theme", "dark");

  // Fallback 25-pack in case offline or API unavailable
  function getFallback25Pack() {
    return [
      {
        id: "snitt_studier",
        title: "Karaktergrenser på studier",
        subtitle: "Ordinær kvote ved Samordna opptak",
        unit: "poeng",
        icon: "🎓",
        description: "Hvilket studium krever høyest poenggrense for å komme inn?",
        items: [
          { title: "Medisin", org: "Universitetet i Oslo (UiO)", val: 68.5, image: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&auto=format&fit=crop&q=80" },
          { title: "Industriell økonomi (Indøk)", org: "NTNU Trondheim", val: 67.8, image: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&auto=format&fit=crop&q=80" },
          { title: "Psykologi profesjon", org: "Universitetet i Oslo (UiO)", val: 66.8, image: "https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=800&auto=format&fit=crop&q=80" },
          { title: "Rettsvitenskap (juss)", org: "Universitetet i Oslo (UiO)", val: 63.6, image: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80" },
          { title: "Siviløkonom", org: "Norges handelshøyskole (NHH)", val: 63.5, image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=80" },
          { title: "Datateknologi (siv.ing)", org: "NTNU Trondheim", val: 64.1, image: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop&q=80" }
        ]
      },
      {
        id: "sokertall",
        title: "Førsteprioritetssøkere",
        subtitle: "Antall primærsøkere ved Samordna opptak",
        unit: "søkere",
        icon: "👥",
        description: "Hvilket studium hadde flest søkere som sitt førstevalg?",
        items: [
          { title: "Siviløkonom", org: "Norges handelshøyskole (NHH)", val: 2154, image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=80" },
          { title: "Rettsvitenskap (juss)", org: "Universitetet i Bergen (UiB)", val: 1980, image: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80" },
          { title: "Medisin", org: "Universitetet i Oslo (UiO)", val: 1870, image: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&auto=format&fit=crop&q=80" },
          { title: "Politiutdanningen", org: "Politihøgskolen (Oslo)", val: 1720, image: "https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=800&auto=format&fit=crop&q=80" },
          { title: "Siviløkonom", org: "Handelshøyskolen BI (Oslo)", val: 1620, image: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&auto=format&fit=crop&q=80" },
          { title: "Industriell økonomi", org: "NTNU Trondheim", val: 1530, image: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&auto=format&fit=crop&q=80" }
        ]
      },
      {
        id: "strykprosent",
        title: "Strykprosent på universitetet",
        subtitle: "Offisiell eksamensstatistikk",
        unit: "% stryk",
        icon: "📉",
        description: "Hvilket beryktet emne har høyest strykprosent på eksamen?",
        items: [
          { title: "TMA4100 Matematikk 1", org: "NTNU Trondheim", val: 32.5, image: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&auto=format&fit=crop&q=80" },
          { title: "MAT1100 Kalkulus", org: "Universitetet i Oslo (UiO)", val: 28.4, image: "https://images.unsplash.com/photo-1509228468518-180dd4864904?w=800&auto=format&fit=crop&q=80" },
          { title: "MET4 Finans og investering", org: "NHH Bergen", val: 34.2, image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&auto=format&fit=crop&q=80" },
          { title: "TEP4120 Termodynamikk 1", org: "NTNU Gløshaugen", val: 36.8, image: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=80" },
          { title: "IN1010 Objektorientert programmering", org: "UiO Blindern", val: 24.1, image: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80" },
          { title: "BØK3411 Bedriftsøkonomisk analyse", org: "Handelshøyskolen BI", val: 35.6, image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80" }
        ]
      },
      {
        id: "studenttall",
        title: "Antall studenter",
        subtitle: "Offisielle tall fra Database for høyere utdanning",
        unit: "studenter",
        icon: "🏛️",
        description: "Hvilket universitet eller høyskole har flest registrerte studenter?",
        items: [
          { title: "NTNU", org: "Norges teknisk-naturvitenskapelige universitet", val: 44000, image: "https://images.unsplash.com/photo-1562774053-701939374585?w=800&auto=format&fit=crop&q=80" },
          { title: "Universitetet i Oslo", org: "UiO Blindern", val: 27500, image: "https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=800&auto=format&fit=crop&q=80" },
          { title: "Handelshøyskolen BI", org: "BI Nydalen", val: 21000, image: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&auto=format&fit=crop&q=80" },
          { title: "Universitetet i Bergen", org: "UiB Nygårdshøyden", val: 19500, image: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&auto=format&fit=crop&q=80" },
          { title: "Høgskulen på Vestlandet", org: "HVL Kronstad", val: 17500, image: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&auto=format&fit=crop&q=80" },
          { title: "Universitetet i Stavanger", org: "UiS Ullandhaug", val: 12500, image: "https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?w=800&auto=format&fit=crop&q=80" }
        ]
      },
      {
        id: "snitt_vgs",
        title: "Inntakssnitt på videregående",
        subtitle: "Studiespesialisering ved offentlig inntak",
        unit: "poeng",
        icon: "🏫",
        description: "Hvilken videregående skole krever høyest inntakspoeng?",
        items: [
          { title: "Elvebakken VGS", org: "Oslo", val: 56.5, image: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800&auto=format&fit=crop&q=80" },
          { title: "Nydalen VGS", org: "Oslo", val: 54.2, image: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&auto=format&fit=crop&q=80" },
          { title: "Oslo Katedralskole (Katta)", org: "Oslo", val: 55.8, image: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=800&auto=format&fit=crop&q=80" },
          { title: "Amalie Skram VGS", org: "Bergen", val: 53.4, image: "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800&auto=format&fit=crop&q=80" },
          { title: "Trondheim Katedralskole", org: "Trondheim", val: 52.8, image: "https://images.unsplash.com/photo-1562774053-701939374585?w=800&auto=format&fit=crop&q=80" },
          { title: "Stavanger Katedralskole (Kongsgård)", org: "Stavanger", val: 51.5, image: "https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?w=800&auto=format&fit=crop&q=80" }
        ]
      }
    ];
  }

  // Start game on load
  loadGame("daily");
})();
