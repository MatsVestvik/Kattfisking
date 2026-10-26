/**
 * Kattfisking – Frontend Game Engine
 * Inspired by catfishing.net, built for Norwegian Wikipedia (no.wikipedia.org)
 */

(() => {
  "use strict";

  const STORAGE_PREFIX = "kattfisking_daily_v1_";
  const THEME_KEY = "kattfisking_theme";
  const AUTOCOMPLETE_KEY = "kattfisking_autocomplete";

  const TRIVIAL_WORDS = new Set([
    "den", "det", "de", "en", "et", "ei", "the", "a", "an", "og", "and", "i", "på", "av"
  ]);

  // App State
  const state = {
    mode: "daily", // "daily" | "practice" | "archive" | "curate"
    todayStr: "",
    activeDate: "",
    puzzleNumber: 1,
    totalPlays: 0,
    averageScore: null,
    articles: [],
    currentIndex: 0,
    // Per-article state in Daily mode: { status: "pending"|"solved"|"half"|"gaveup", score: 0|0.5|1, guesses: [], letterHint: false, sentenceHint: false }
    progress: [],
    submittedToServer: false,

    // Practice (Frispill) state
    practiceArticle: null,
    practiceStatus: "pending",
    practiceScore: 0,
    practiceTotalScore: 0,
    practiceCount: 0,
    practiceStreak: 0,
    practiceGuesses: [],
    practiceSeenIds: [],
    practiceLetterHint: false,
    practiceSentenceHint: false,

    // Pending "Did you mean?" candidate
    dymCandidate: null,

    // Community comparison & distribution
    percentile: null,
    betterThanPct: null,
    distribution: null,
    stats: null,
  };

  // DOM Elements
  const el = {
    brandHomeBtn: document.getElementById("brandHomeBtn"),
    navDailyBtn: document.getElementById("navDailyBtn"),
    navArchiveBtn: document.getElementById("navArchiveBtn"),
    navPracticeBtn: document.getElementById("navPracticeBtn"),
    navCurateBtn: document.getElementById("navCurateBtn"),
    helpModalBtn: document.getElementById("helpModalBtn"),

    loadingSection: document.getElementById("loadingSection"),
    loadingText: document.getElementById("loadingText"),
    gameSection: document.getElementById("gameSection"),
    archiveSection: document.getElementById("archiveSection"),
    curateSection: document.getElementById("curateSection"),

    puzzleTitleBadge: document.getElementById("puzzleTitleBadge"),
    puzzleDateLabel: document.getElementById("puzzleDateLabel"),
    dailyStepTracker: document.getElementById("dailyStepTracker"),
    practiceTracker: document.getElementById("practiceTracker"),
    practiceStreakVal: document.getElementById("practiceStreakVal"),
    practiceScoreVal: document.getElementById("practiceScoreVal"),
    practiceCountVal: document.getElementById("practiceCountVal"),
    dailyScoreWrap: document.getElementById("dailyScoreWrap"),
    currentScoreVal: document.getElementById("currentScoreVal"),
    currentMaxVal: document.getElementById("currentMaxVal"),

    questionCounterHeading: document.getElementById("questionCounterHeading"),
    categoryCountNum: document.getElementById("categoryCountNum"),
    hintControls: document.getElementById("hintControls"),
    hintLettersBtn: document.getElementById("hintLettersBtn"),
    hintSentenceBtn: document.getElementById("hintSentenceBtn"),
    categoryList: document.getElementById("categoryList"),
    hintsDisplayBox: document.getElementById("hintsDisplayBox"),
    letterHintRow: document.getElementById("letterHintRow"),
    letterHintText: document.getElementById("letterHintText"),
    sentenceHintRow: document.getElementById("sentenceHintRow"),
    sentenceHintText: document.getElementById("sentenceHintText"),

    didYouMeanBox: document.getElementById("didYouMeanBox"),
    didYouMeanTarget: document.getElementById("didYouMeanTarget"),
    dymYesBtn: document.getElementById("dymYesBtn"),
    dymNoBtn: document.getElementById("dymNoBtn"),

    guessForm: document.getElementById("guessForm"),
    guessInput: document.getElementById("guessInput"),
    autocompleteList: document.getElementById("autocompleteList"),
    submitGuessBtn: document.getElementById("submitGuessBtn"),
    giveUpBtn: document.getElementById("giveUpBtn"),
    wrongGuessesContainer: document.getElementById("wrongGuessesContainer"),
    autocompleteToggle: document.getElementById("autocompleteToggle"),

    revealCard: document.getElementById("revealCard"),
    revealBanner: document.getElementById("revealBanner"),
    revealIcon: document.getElementById("revealIcon"),
    revealStatusTitle: document.getElementById("revealStatusTitle"),
    revealGuessSub: document.getElementById("revealGuessSub"),
    closeEnoughBtn: document.getElementById("closeEnoughBtn"),
    nextArticleBtn: document.getElementById("nextArticleBtn"),
    revealThumb: document.getElementById("revealThumb"),
    revealWikiLink: document.getElementById("revealWikiLink"),
    revealSolveBadge: document.getElementById("revealSolveBadge"),
    revealExtract: document.getElementById("revealExtract"),
    revealAliasesRow: document.getElementById("revealAliasesRow"),
    revealAliasesText: document.getElementById("revealAliasesText"),
    revealHiddenCatsRow: document.getElementById("revealHiddenCatsRow"),
    revealHiddenCatsList: document.getElementById("revealHiddenCatsList"),

    summaryCard: document.getElementById("summaryCard"),
    summaryOverline: document.getElementById("summaryOverline"),
    summaryScoreBig: document.getElementById("summaryScoreBig"),
    summaryRankText: document.getElementById("summaryRankText"),
    summaryEmojiGrid: document.getElementById("summaryEmojiGrid"),
    copyShareBtn: document.getElementById("copyShareBtn"),
    copyConfirmToast: document.getElementById("copyConfirmToast"),
    statPlayerScore: document.getElementById("statPlayerScore"),
    statServerAvg: document.getElementById("statServerAvg"),
    statTotalPlays: document.getElementById("statTotalPlays"),
    kattfiskingGraphCard: document.getElementById("kattfiskingGraphCard"),
    kattfiskingPercentilePill: document.getElementById("kattfiskingPercentilePill"),
    kattfiskingPercentileText: document.getElementById("kattfiskingPercentileText"),
    kattfiskingChartBars: document.getElementById("kattfiskingChartBars"),
    kattfiskingAvgIndicator: document.getElementById("kattfiskingAvgIndicator"),
    summaryRecapList: document.getElementById("summaryRecapList"),
    summaryToArchiveBtn: document.getElementById("summaryToArchiveBtn"),
    summaryToPracticeBtn: document.getElementById("summaryToPracticeBtn"),

    archiveList: document.getElementById("archiveList"),

    curateForm: document.getElementById("curateForm"),
    curateTitleInput: document.getElementById("curateTitleInput"),
    curateAutocompleteList: document.getElementById("curateAutocompleteList"),
    curatePreviewBtn: document.getElementById("curatePreviewBtn"),
    curateSaveBtn: document.getElementById("curateSaveBtn"),
    curateStatusMsg: document.getElementById("curateStatusMsg"),
    curatePreviewCard: document.getElementById("curatePreviewCard"),
    curatePrevTitle: document.getElementById("curatePrevTitle"),
    curatePrevExtract: document.getElementById("curatePrevExtract"),
    curateKeptCount: document.getElementById("curateKeptCount"),
    curateKeptList: document.getElementById("curateKeptList"),
    curateHiddenCount: document.getElementById("curateHiddenCount"),
    curateHiddenList: document.getElementById("curateHiddenList"),
    dbStatsText: document.getElementById("dbStatsText"),
    harvestMoreBtn: document.getElementById("harvestMoreBtn"),

    helpModal: document.getElementById("helpModal"),
    closeHelpModalBtn: document.getElementById("closeHelpModalBtn"),
  };

  // --- Utilities & Normalization ---

  function formatNoScore(num) {
    if (num === null || num === undefined || Number.isNaN(num)) return "–";
    return Number(num).toLocaleString("nb-NO", {
      minimumFractionDigits: num % 1 !== 0 ? 1 : 0,
      maximumFractionDigits: 2,
    });
  }

  function stripDisambiguation(str) {
    return String(str || "").replace(/\s*\([^)]*\)\s*$/g, "").trim();
  }

  function normalizeAnswer(str, dropTrivial = false) {
    let s = stripDisambiguation(str)
      .toLowerCase()
      .normalize("NFC")
      .replace(/[«»"“”'’`.,!?:;–—\-_/\\()[\]]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (dropTrivial && s) {
      const tokens = s.split(" ").filter((w) => !TRIVIAL_WORDS.has(w));
      if (tokens.length > 0) {
        s = tokens.join(" ");
      }
    }
    return s;
  }

  function levenshteinDistance(a, b) {
    if (a === b) return 0;
    const m = a.length;
    const n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;

    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
        // Transposition support (Damerau)
        if (
          i > 1 &&
          j > 1 &&
          a[i - 1] === b[j - 2] &&
          a[i - 2] === b[j - 1]
        ) {
          dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + cost);
        }
      }
    }
    return dp[m][n];
  }

  /**
   * Evaluates a user's guess against an article.
   * Returns: { type: "exact" | "dym" | "wrong", matchedLabel?: string }
   */
  function evaluateGuess(rawGuess, article) {
    const gStrict = normalizeAnswer(rawGuess, false);
    const gLoose = normalizeAnswer(rawGuess, true);
    if (!gStrict) return { type: "wrong" };

    const targets = [
      article.title,
      article.cleanTitle,
      ...(article.aliases || []),
    ].filter(Boolean);

    // 1. Check exact match (strict or trivial-word-stripped)
    for (const t of targets) {
      const tStrict = normalizeAnswer(t, false);
      const tLoose = normalizeAnswer(t, true);
      if (gStrict === tStrict || (gLoose && gLoose === tLoose)) {
        return { type: "exact", matchedLabel: article.cleanTitle };
      }
    }

    // 2. Check "Did you mean?" (typo tolerance or surname-only match)
    let bestCandidate = null;
    let bestRatio = 1.0;

    for (const t of targets) {
      const tLoose = normalizeAnswer(t, true);
      if (!tLoose || tLoose.length < 3) continue;

      const dist = levenshteinDistance(gLoose, tLoose);
      const maxLen = Math.max(gLoose.length, tLoose.length);
      const ratio = dist / maxLen;

      const allowedDist =
        maxLen <= 5 ? 1 : maxLen <= 10 ? 2 : Math.floor(maxLen * 0.26);

      if (dist <= allowedDist && ratio < bestRatio) {
        bestRatio = ratio;
        bestCandidate = article.cleanTitle;
      }
    }

    // Also check if the user typed the exact last word (e.g. surname "Munch" for "Edvard Munch")
    const cleanWords = normalizeAnswer(article.cleanTitle, true).split(" ");
    if (cleanWords.length >= 2 && gLoose.length >= 4) {
      const lastWord = cleanWords[cleanWords.length - 1];
      const firstWord = cleanWords[0];
      if (
        levenshteinDistance(gLoose, lastWord) <= 1 ||
        (cleanWords.length === 2 && levenshteinDistance(gLoose, firstWord) <= 1)
      ) {
        bestCandidate = article.cleanTitle;
      }
    }

    if (bestCandidate) {
      return { type: "dym", matchedLabel: bestCandidate };
    }

    return { type: "wrong" };
  }

  function buildLetterMask(cleanTitle) {
    const words = String(cleanTitle || "").trim().split(/\s+/);
    const masked = words.map((w) => {
      if (w.length <= 1) return w;
      const first = w[0];
      const rest = Array.from(w.slice(1))
        .map((ch) => (/[a-zA-ZæøåÆØÅ0-9]/.test(ch) ? "_" : ch))
        .join("");
      return first + rest;
    });
    return `${masked.join("   ")}  (${words.length} ${words.length === 1 ? "ord" : "ord"})`;
  }

  // --- LocalStorage Persistence ---

  function saveDailyProgress() {
    if (!state.activeDate || !state.articles.length) return;
    const payload = {
      date: state.activeDate,
      currentIndex: state.currentIndex,
      progress: state.progress,
      submittedToServer: state.submittedToServer,
    };
    try {
      localStorage.setItem(
        STORAGE_PREFIX + state.activeDate,
        JSON.stringify(payload)
      );
    } catch (_) {}
  }

  function loadDailyProgress(dateStr, count) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + dateStr);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (Array.isArray(data.progress) && data.progress.length === count) {
        return data;
      }
    } catch (_) {}
    return null;
  }

  function createFreshProgress(count) {
    return Array.from({ length: count }, () => ({
      status: "pending", // "pending" | "solved" | "half" | "gaveup"
      score: 0,
      guesses: [],
      letterHint: false,
      sentenceHint: false,
    }));
  }

  // --- Navigation & Views ---

  function setActiveNav(mode) {
    state.mode = mode;
    [
      [el.navDailyBtn, "daily"],
      [el.navArchiveBtn, "archive"],
      [el.navPracticeBtn, "practice"],
      [el.navCurateBtn, "curate"],
    ].forEach(([btn, m]) => {
      btn.classList.toggle("active", m === mode);
    });

    el.loadingSection.classList.add("hidden");
    el.gameSection.classList.toggle(
      "hidden",
      mode !== "daily" && mode !== "practice"
    );
    el.archiveSection.classList.toggle("hidden", mode !== "archive");
    el.curateSection.classList.toggle("hidden", mode !== "curate");
  }

  // --- Daily Mode ---

  async function loadDailyPuzzle(dateStr = "") {
    el.loadingSection.classList.remove("hidden");
    el.gameSection.classList.add("hidden");
    el.archiveSection.classList.add("hidden");
    el.curateSection.classList.add("hidden");

    const url = dateStr
      ? `/api/daily?date=${encodeURIComponent(dateStr)}`
      : "/api/daily";
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Kunne ikke laste utfordring");
      }

      state.todayStr = data.today || data.date;
      state.activeDate = data.date;
      state.puzzleNumber = data.puzzleNumber;
      state.totalPlays = data.totalPlays || 0;
      state.averageScore = data.averageScore;
      state.articles = data.articles || [];
      if (data.stats) {
        state.distribution = data.stats.distribution;
        state.stats = data.stats;
      }

      const saved = loadDailyProgress(state.activeDate, state.articles.length);
      if (saved) {
        state.progress = saved.progress;
        state.currentIndex = saved.currentIndex || 0;
        state.submittedToServer = Boolean(saved.submittedToServer);
      } else {
        state.progress = createFreshProgress(state.articles.length);
        state.currentIndex = 0;
        state.submittedToServer = false;
      }

      // If currentIndex points to a finished item, jump to first pending if any
      const firstPending = state.progress.findIndex(
        (p) => p.status === "pending"
      );
      if (
        state.progress[state.currentIndex]?.status !== "pending" &&
        firstPending !== -1
      ) {
        state.currentIndex = firstPending;
      }

      setActiveNav("daily");
      renderGameView();
    } catch (err) {
      el.loadingText.textContent = `Feil: ${err.message}`;
    }
  }

  // --- Practice (Frispill) Mode ---

  async function startPracticeMode() {
    setActiveNav("practice");
    await fetchNextPracticeArticle();
  }

  async function fetchNextPracticeArticle() {
    const ex = state.practiceSeenIds.slice(-100).join(",");
    const res = await fetch(`/api/practice?exclude=${encodeURIComponent(ex)}`);
    const data = await res.json();
    if (!data.article) return;

    state.practiceArticle = data.article;
    state.practiceSeenIds.push(data.article.id);
    state.practiceStatus = "pending";
    state.practiceScore = 0;
    state.practiceGuesses = [];
    state.practiceLetterHint = false;
    state.practiceSentenceHint = false;
    state.dymCandidate = null;

    renderGameView();
  }

  // --- Rendering Game View ---

  function getCurrentArticle() {
    if (state.mode === "practice") return state.practiceArticle;
    return state.articles[state.currentIndex] || null;
  }

  function getCurrentItemState() {
    if (state.mode === "practice") {
      return {
        status: state.practiceStatus,
        score: state.practiceScore,
        guesses: state.practiceGuesses,
        letterHint: state.practiceLetterHint,
        sentenceHint: state.practiceSentenceHint,
      };
    }
    return (
      state.progress[state.currentIndex] || {
        status: "pending",
        score: 0,
        guesses: [],
        letterHint: false,
        sentenceHint: false,
      }
    );
  }

  function isAllDailyFinished() {
    return (
      state.mode === "daily" &&
      state.progress.length > 0 &&
      state.progress.every((p) => p.status !== "pending")
    );
  }

  function renderGameView() {
    const art = getCurrentArticle();
    const item = getCurrentItemState();
    state.dymCandidate = null;
    el.didYouMeanBox.classList.add("hidden");

    // Top Status Bar
    if (state.mode === "daily") {
      const isToday = state.activeDate === state.todayStr;
      el.puzzleTitleBadge.textContent = `${isToday ? "Dagens" : "Arkiv"} #${state.puzzleNumber}`;
      el.puzzleDateLabel.textContent = state.activeDate;
      el.dailyStepTracker.classList.remove("hidden");
      el.dailyScoreWrap.classList.remove("hidden");
      el.practiceTracker.classList.add("hidden");

      const totalScore = state.progress.reduce((acc, p) => acc + p.score, 0);
      el.currentScoreVal.textContent = formatNoScore(totalScore);
      el.currentMaxVal.textContent = `/ ${state.articles.length}`;

      renderStepDots();
    } else {
      el.puzzleTitleBadge.textContent = "Frispill";
      el.puzzleDateLabel.textContent = "Tilfeldige norske artikler";
      el.dailyStepTracker.classList.add("hidden");
      el.dailyScoreWrap.classList.add("hidden");
      el.practiceTracker.classList.remove("hidden");

      el.practiceStreakVal.textContent = String(state.practiceStreak);
      el.practiceScoreVal.textContent = formatNoScore(state.practiceTotalScore);
      el.practiceCountVal.textContent = String(state.practiceCount);
    }

    if (!art) return;

    // Clues Card
    if (state.mode === "daily") {
      el.questionCounterHeading.textContent = `Artikkel ${state.currentIndex + 1} av ${state.articles.length}`;
    } else {
      el.questionCounterHeading.textContent = `Frispill-artikkel #${state.practiceCount + (item.status === "pending" ? 1 : 0)}`;
    }
    el.categoryCountNum.textContent = String(art.categories.length);

    el.categoryList.innerHTML = "";
    art.categories.forEach((cat) => {
      const pill = document.createElement("span");
      pill.className = "category-pill";
      pill.setAttribute("role", "listitem");
      pill.textContent = cat;
      el.categoryList.appendChild(pill);
    });

    // Hints
    const showHintsBox = item.letterHint || item.sentenceHint;
    el.hintsDisplayBox.classList.toggle("hidden", !showHintsBox);
    el.letterHintRow.classList.toggle("hidden", !item.letterHint);
    if (item.letterHint) {
      el.letterHintText.textContent = buildLetterMask(art.cleanTitle);
    }
    el.sentenceHintRow.classList.toggle("hidden", !item.sentenceHint);
    if (item.sentenceHint) {
      el.sentenceHintText.textContent =
        art.redactedExtract || "Ingen setningshint tilgjengelig.";
    }
    el.hintLettersBtn.disabled = item.letterHint || item.status !== "pending";
    el.hintSentenceBtn.disabled =
      item.sentenceHint || item.status !== "pending";

    // Wrong guesses pills
    el.wrongGuessesContainer.innerHTML = "";
    item.guesses.forEach((g) => {
      const pill = document.createElement("span");
      pill.className = "wrong-pill";
      pill.textContent = `[X] ${g}`;
      el.wrongGuessesContainer.appendChild(pill);
    });

    // Active vs Revealed state
    if (item.status === "pending") {
      el.guessForm.classList.remove("hidden");
      el.revealCard.classList.add("hidden");
      el.summaryCard.classList.add("hidden");
      el.guessInput.value = "";
      hideAutocomplete(el.autocompleteList);
      setTimeout(() => el.guessInput.focus(), 20);
    } else {
      el.guessForm.classList.add("hidden");
      renderRevealCard(art, item);

      if (isAllDailyFinished()) {
        maybeSubmitDailyScore();
        renderSummaryCard();
      } else {
        el.summaryCard.classList.add("hidden");
      }
    }
  }

  function renderStepDots() {
    el.dailyStepTracker.innerHTML = "";
    state.progress.forEach((p, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "step-dot";
      if (idx === state.currentIndex) btn.classList.add("current");

      if (p.status === "solved") {
        btn.classList.add("done-full");
        btn.innerHTML = '<img src="/assets/cat.png?v=2" alt="Katt" class="pixel-icon step-pixel-icon" />';
      } else if (p.status === "half") {
        btn.classList.add("done-half");
        btn.innerHTML = '<img src="/assets/catfish.png?v=2" alt="Kattfisk" class="pixel-icon step-pixel-icon" />';
      } else if (p.status === "gaveup") {
        btn.classList.add("done-zero");
        btn.innerHTML = '<img src="/assets/fish.png?v=2" alt="Fisk" class="pixel-icon step-pixel-icon" />';
      } else {
        btn.textContent = String(idx + 1);
      }

      btn.title = `Artikkel ${idx + 1}`;
      btn.addEventListener("click", () => {
        state.currentIndex = idx;
        saveDailyProgress();
        renderGameView();
      });
      el.dailyStepTracker.appendChild(btn);
    });
  }

  function renderRevealCard(art, item) {
    el.revealCard.classList.remove("hidden");
    el.revealBanner.className = "reveal-banner";

    if (item.status === "solved") {
      el.revealBanner.classList.add("status-full");
      el.revealIcon.innerHTML = '<img src="/assets/cat.png?v=2" alt="Katt" class="pixel-icon reveal-pixel-icon" />';
      el.revealStatusTitle.textContent = "Fulltreff! (+1 poeng)";
      const lastGuess = item.guesses[item.guesses.length - 1];
      el.revealGuessSub.textContent = lastGuess
        ? `Du gjettet «${lastGuess}»`
        : "Riktig svar!";
      el.closeEnoughBtn.classList.add("hidden");
    } else if (item.status === "half") {
      el.revealBanner.classList.add("status-half");
      el.revealIcon.innerHTML = '<img src="/assets/catfish.png?v=2" alt="Kattfisk" class="pixel-icon reveal-pixel-icon" />';
      el.revealStatusTitle.textContent = "Nære nok! (+0,5 poeng)";
      el.revealGuessSub.textContent = "Du ga deg selv 0,5 poeng for å være nære.";
      el.closeEnoughBtn.classList.add("hidden");
    } else {
      el.revealBanner.classList.add("status-zero");
      el.revealIcon.innerHTML = '<img src="/assets/fish.png?v=2" alt="Fisk" class="pixel-icon reveal-pixel-icon" />';
      el.revealStatusTitle.textContent = "Feil svar (0 poeng)";
      const lastGuess = item.guesses[item.guesses.length - 1];
      el.revealGuessSub.textContent = lastGuess
        ? `Du gjettet «${lastGuess}»`
        : "Du ga opp denne artikkelen.";
      el.closeEnoughBtn.classList.remove("hidden");
    }

    // Next button text
    if (state.mode === "daily") {
      const nextPending = findNextPendingIndex();
      if (nextPending === -1) {
        el.nextArticleBtn.textContent = "Se oppsummering ↓";
      } else {
        el.nextArticleBtn.textContent = `Neste artikkel (${nextPending + 1}/10) →`;
      }
    } else {
      el.nextArticleBtn.textContent = "Neste frispill-artikkel →";
    }

    // Thumbnail
    if (art.thumbnailUrl) {
      el.revealThumb.src = art.thumbnailUrl;
      el.revealThumb.alt = art.title;
      el.revealThumb.classList.remove("hidden");
    } else {
      el.revealThumb.classList.add("hidden");
    }

    el.revealWikiLink.href = art.wikiUrl;
    el.revealWikiLink.textContent = `${art.title} ↗`;

    if (art.solvePct !== null && art.solvePct !== undefined) {
      el.revealSolveBadge.textContent = `${art.solvePct} % klarte denne`;
      el.revealSolveBadge.classList.remove("hidden");
    } else {
      el.revealSolveBadge.classList.add("hidden");
    }

    el.revealExtract.textContent = art.extract || "";

    // Aliases
    const cleanAliases = (art.aliases || []).filter(
      (a) => a.toLowerCase() !== art.title.toLowerCase()
    );
    if (cleanAliases.length > 0) {
      el.revealAliasesRow.classList.remove("hidden");
      el.revealAliasesText.textContent = cleanAliases.slice(0, 8).join(", ");
    } else {
      el.revealAliasesRow.classList.add("hidden");
    }

    // Hidden Giveaway Categories
    if (art.hiddenCategories && art.hiddenCategories.length > 0) {
      el.revealHiddenCatsRow.classList.remove("hidden");
      el.revealHiddenCatsList.innerHTML = "";
      art.hiddenCategories.forEach((hc) => {
        const tag = document.createElement("span");
        tag.className = "hidden-cat-tag";
        tag.textContent = hc;
        el.revealHiddenCatsList.appendChild(tag);
      });
    } else {
      el.revealHiddenCatsRow.classList.add("hidden");
    }
  }

  function findNextPendingIndex() {
    for (let offset = 1; offset <= state.progress.length; offset++) {
      const idx = (state.currentIndex + offset) % state.progress.length;
      if (state.progress[idx].status === "pending") return idx;
    }
    return -1;
  }

  // --- Gameplay Actions ---

  function handleGuessSubmit(e) {
    if (e) e.preventDefault();
    const rawGuess = el.guessInput.value.trim();
    if (!rawGuess) return;

    hideAutocomplete(el.autocompleteList);
    const art = getCurrentArticle();
    const item = getCurrentItemState();
    if (!art || item.status !== "pending") return;

    const evalRes = evaluateGuess(rawGuess, art);

    if (evalRes.type === "exact") {
      item.guesses.push(rawGuess);
      markCurrentArticle("solved", 1.0);
    } else if (evalRes.type === "dym") {
      state.dymCandidate = rawGuess;
      el.didYouMeanTarget.textContent = evalRes.matchedLabel;
      el.didYouMeanBox.classList.remove("hidden");
    } else {
      // Kun 1 gjett: feil svar avslutter runden for denne artikkelen (0 poeng)
      item.guesses.push(rawGuess);
      markCurrentArticle("gaveup", 0.0);
    }
  }

  function markCurrentArticle(status, score) {
    state.dymCandidate = null;
    el.didYouMeanBox.classList.add("hidden");

    if (state.mode === "practice") {
      state.practiceStatus = status;
      state.practiceScore = score;
      state.practiceCount += 1;
      state.practiceTotalScore += score;
      if (score >= 0.5) {
        state.practiceStreak += 1;
      } else {
        state.practiceStreak = 0;
      }
      renderGameView();
      return;
    }

    const item = state.progress[state.currentIndex];
    if (!item) return;
    item.status = status;
    item.score = score;
    saveDailyProgress();
    renderGameView();
  }

  function handleCloseEnoughAward() {
    if (state.mode === "practice") {
      if (state.practiceStatus === "gaveup") {
        state.practiceStatus = "half";
        state.practiceScore = 0.5;
        state.practiceTotalScore += 0.5;
        state.practiceStreak += 1;
        renderGameView();
      }
      return;
    }

    const item = state.progress[state.currentIndex];
    if (!item || item.status !== "gaveup") return;
    item.status = "half";
    item.score = 0.5;
    saveDailyProgress();
    renderGameView();
  }

  function advanceToNextArticle() {
    if (state.mode === "practice") {
      fetchNextPracticeArticle();
      return;
    }

    const nextIdx = findNextPendingIndex();
    if (nextIdx !== -1) {
      state.currentIndex = nextIdx;
      saveDailyProgress();
      renderGameView();
    } else {
      el.summaryCard.scrollIntoView({ behavior: "smooth" });
    }
  }

  // --- Daily Summary & Server Score Submission ---

  async function maybeSubmitDailyScore() {
    if (state.submittedToServer || state.mode !== "daily") return;
    state.submittedToServer = true;
    saveDailyProgress();

    const results = state.progress.map((p) => p.score);
    const totalScore = results.reduce((a, b) => a + b, 0);

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: state.activeDate,
          totalScore,
          results,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        state.totalPlays = data.totalPlays;
        state.averageScore = data.averageScore;
        state.percentile = data.percentile;
        state.betterThanPct = data.betterThanPct;
        state.distribution = data.distribution;
        state.stats = data.stats;
        if (Array.isArray(data.articles) && data.articles.length) {
          state.articles = data.articles;
        }
        renderSummaryCard();
      }
    } catch (_) {}
  }

  function getRankComment(score) {
    if (score >= 9.5) return '<img src="/assets/cat.png?v=2" class="pixel-icon inline-pixel-icon" alt="" /> Leksikalsk mesterkatt! Helt suverent!';
    if (score >= 7.5) return '<img src="/assets/cat.png?v=2" class="pixel-icon inline-pixel-icon" alt="" /> Skarp kattepus! Du kan ditt norske leksikon!';
    if (score >= 5.0) return '<img src="/assets/fish.png?v=2" class="pixel-icon inline-pixel-icon" alt="" /> Solid fangst ved fiskedammen!';
    if (score >= 3.0) return "Godt forsøk – noen vriene kategorier i dag!";
    return "Krevende sett i dag – ny sjanse i morgen!";
  }

  function buildEmojiGridString() {
    const symbols = state.progress.map((p) => {
      if (p.status === "solved") return "[1.0]";
      if (p.status === "half") return "[0.5]";
      return "[0.0]";
    });
    const row1 = symbols.slice(0, 5).join(" ");
    const row2 = symbols.slice(5, 10).join(" ");
    return `${row1}\n${row2}`;
  }

  function renderDistributionGraph(container, distribution, userScore, avgScore, maxScore = 10) {
    if (!container || !Array.isArray(distribution) || !distribution.length) return;
    container.innerHTML = "";

    const maxPct = Math.max(...distribution.map((d) => d.pct || 0), 10);
    const roundedUserScore = userScore !== null && userScore !== undefined ? Math.round(userScore) : null;

    distribution.forEach((item) => {
      const isUser = roundedUserScore !== null && item.score === roundedUserScore;
      const heightPct = Math.max(5, Math.round(((item.pct || 0) / maxPct) * 100));

      const col = document.createElement("div");
      col.className = `chart-col ${isUser ? "is-user" : ""}`;
      col.title = `${item.score} poeng: ${item.pct}% (${item.count} spillere)`;

      col.innerHTML = `
        <span class="col-pct">${item.pct}%</span>
        <div class="col-bar-wrap">
          <div class="col-bar" style="height: 0%">
            ${isUser ? `<span class="user-pin">DEG (${userScore}p)</span>` : ""}
          </div>
        </div>
        <span class="col-label">${item.score}</span>
      `;
      container.appendChild(col);

      // Smooth height animation
      requestAnimationFrame(() => {
        setTimeout(() => {
          const bar = col.querySelector(".col-bar");
          if (bar) bar.style.height = `${heightPct}%`;
        }, 60);
      });
    });
  }

  function renderSummaryCard() {
    el.summaryCard.classList.remove("hidden");
    const totalScore = state.progress.reduce((acc, p) => acc + p.score, 0);

    el.summaryOverline.textContent = `Kattfisking #${state.puzzleNumber} (${state.activeDate})`;
    el.summaryScoreBig.textContent = `${formatNoScore(totalScore)} / ${state.articles.length}`;
    el.summaryRankText.innerHTML = getRankComment(totalScore);

    el.summaryEmojiGrid.innerHTML = "";
    state.progress.forEach((p) => {
      const img = document.createElement("img");
      img.className = "pixel-icon grid-pixel-icon";
      if (p.status === "solved") {
        img.src = "/assets/cat.png?v=2";
        img.alt = "Katt (1p)";
      } else if (p.status === "half") {
        img.src = "/assets/catfish.png?v=2";
        img.alt = "Kattfisk (0.5p)";
      } else {
        img.src = "/assets/fish.png?v=2";
        img.alt = "Fisk (0p)";
      }
      el.summaryEmojiGrid.appendChild(img);
    });

    el.statPlayerScore.textContent = `${formatNoScore(totalScore)} / 10`;
    el.statServerAvg.textContent =
      state.averageScore !== null ? `${formatNoScore(state.averageScore)} / 10` : "–";
    el.statTotalPlays.textContent = String(state.totalPlays || 1);

    // Render Community Distribution Graph & Percentile Comparison
    const distData = state.distribution || (state.stats && state.stats.distribution);
    if (distData && el.kattfiskingChartBars) {
      renderDistributionGraph(
        el.kattfiskingChartBars,
        distData,
        totalScore,
        state.averageScore,
        10
      );
    }

    if (el.kattfiskingPercentileText) {
      const betterPct =
        state.betterThanPct !== null && state.betterThanPct !== undefined
          ? state.betterThanPct
          : (state.stats && state.stats.betterThanPct);

      if (betterPct !== null && betterPct !== undefined) {
        if (betterPct >= 75) {
          el.kattfiskingPercentileText.textContent = `Du slo ${betterPct} % av dagens spillere! 🌟`;
        } else if (betterPct >= 40) {
          el.kattfiskingPercentileText.textContent = `Du slo ${betterPct} % av dagens spillere! 👏`;
        } else {
          el.kattfiskingPercentileText.textContent = `Fullført! Bedre enn ${betterPct} % av spillere 💪`;
        }
      } else {
        el.kattfiskingPercentileText.textContent = `Dagens spill registrert! 🎯`;
      }
    }

    if (el.kattfiskingAvgIndicator && state.averageScore !== null) {
      el.kattfiskingAvgIndicator.textContent = `Gjennomsnitt: ${formatNoScore(state.averageScore)} poeng`;
    }

    el.summaryRecapList.innerHTML = "";
    state.articles.forEach((art, idx) => {
      const p = state.progress[idx];
      const icon =
        p.status === "solved"
          ? '<img src="/assets/cat.png?v=2" alt="Katt" class="pixel-icon recap-pixel-icon" />'
          : p.status === "half"
          ? '<img src="/assets/catfish.png?v=2" alt="Kattfisk" class="pixel-icon recap-pixel-icon" />'
          : '<img src="/assets/fish.png?v=2" alt="Fisk" class="pixel-icon recap-pixel-icon" />';
      const row = document.createElement("div");
      row.className = "recap-row";

      const left = document.createElement("div");
      left.className = "recap-left";
      left.innerHTML = `<span>${icon}</span> <strong>${idx + 1}.</strong> <a href="${art.wikiUrl}" target="_blank" rel="noopener noreferrer">${art.title} -></a>`;

      const right = document.createElement("div");
      right.className = "recap-right";
      const pctText =
        art.solvePct !== null && art.solvePct !== undefined
          ? `${art.solvePct} % løste`
          : "";
      right.innerHTML = `<span>${pctText}</span> <strong>+${formatNoScore(p.score)}p</strong>`;

      row.appendChild(left);
      row.appendChild(right);
      el.summaryRecapList.appendChild(row);
    });
  }

  function copyShareableResult() {
    const totalScore = state.progress.reduce((acc, p) => acc + p.score, 0);
    const shareText = [
      `Kattfisking #${state.puzzleNumber} (${state.activeDate})`,
      buildEmojiGridString(),
      `${formatNoScore(totalScore)} / ${state.articles.length} poeng`,
    ].join("\n");

    navigator.clipboard.writeText(shareText).then(() => {
      el.copyConfirmToast.classList.remove("hidden");
      setTimeout(() => el.copyConfirmToast.classList.add("hidden"), 2500);
    });
  }

  // --- Archive View ---

  async function openArchiveView() {
    setActiveNav("archive");
    el.archiveList.innerHTML = "<p class='muted-text'>Laster arkiv…</p>";

    try {
      const res = await fetch("/api/archive");
      const data = await res.json();
      el.archiveList.innerHTML = "";

      (data.puzzles || []).forEach((p) => {
        const saved = loadDailyProgress(p.date, 10);
        const isDone =
          saved && saved.progress.every((item) => item.status !== "pending");
        const myScore = saved
          ? saved.progress.reduce((acc, item) => acc + item.score, 0)
          : null;

        const card = document.createElement("div");
        card.className = "archive-item";
        card.innerHTML = `
          <div class="archive-top">
            <span class="archive-num">Kattfisking #${p.puzzleNumber}</span>
            <span class="archive-date">${p.date === data.today ? "I dag (" + p.date + ")" : p.date}</span>
          </div>
          <div class="archive-bottom">
            <span>${
              isDone
                ? `<img src="/assets/cat.png?v=2" alt="" class="pixel-icon inline-pixel-icon" /> Din score: <strong>${formatNoScore(myScore)} / 10</strong>`
                : saved
                ? "Påbegynt"
                : "Ikke spilt ennå"
            }</span>
            <span class="muted-text">Snitt: ${formatNoScore(p.averageScore)}</span>
          </div>
        `;
        card.addEventListener("click", () => loadDailyPuzzle(p.date));
        el.archiveList.appendChild(card);
      });
    } catch (err) {
      el.archiveList.innerHTML = `<p class="muted-text">Kunne ikke laste arkiv: ${err.message}</p>`;
    }
  }

  // --- Curate / Add Article View ---

  async function openCurateView() {
    setActiveNav("curate");
    el.curateStatusMsg.classList.add("hidden");
    refreshDbStats();
  }

  async function refreshDbStats() {
    try {
      const res = await fetch("/api/stats");
      const s = await res.json();
      el.dbStatsText.textContent = `Totalt ${s.totalArticles} norske Wikipedia-artikler i databasen (${s.unusedArticles} ubrukte til kommende dager) • ${s.totalPuzzles} dagsutfordringer • ${s.totalPlays} runder spilt.`;
    } catch (_) {}
  }

  async function submitCurateArticle(previewOnly) {
    const title = el.curateTitleInput.value.trim();
    if (!title) return;
    hideAutocomplete(el.curateAutocompleteList);

    el.curateStatusMsg.className = "curate-alert";
    el.curateStatusMsg.textContent = "Henter og analyserer artikkel fra no.wikipedia.org…";
    el.curateStatusMsg.classList.remove("hidden");

    try {
      const res = await fetch("/api/curate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, previewOnly }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        el.curateStatusMsg.className = "curate-alert error";
        el.curateStatusMsg.textContent = data.error || "Feil ved henting.";
        el.curatePreviewCard.classList.add("hidden");
        return;
      }

      const art = data.article;
      el.curateStatusMsg.className = "curate-alert success";
      el.curateStatusMsg.textContent = data.saved
        ? `«${art.title}» er lagret i databasen med ${art.categories.length} kategorier!`
        : `Forhåndsvisning av «${art.title}» (${art.categories.length} gyldige kategorier):`;

      el.curatePreviewCard.classList.remove("hidden");
      el.curatePrevTitle.textContent = art.title;
      el.curatePrevExtract.textContent = art.extract;
      el.curateKeptCount.textContent = String(art.categories.length);
      el.curateKeptList.innerHTML = "";
      art.categories.forEach((c) => {
        const span = document.createElement("span");
        span.className = "category-pill";
        span.textContent = c;
        el.curateKeptList.appendChild(span);
      });

      el.curateHiddenCount.textContent = String(
        (art.hiddenCategories || []).length
      );
      el.curateHiddenList.innerHTML = "";
      (art.hiddenCategories || []).forEach((hc) => {
        const span = document.createElement("span");
        span.className = "hidden-cat-tag";
        span.textContent = hc;
        el.curateHiddenList.appendChild(span);
      });

      if (data.saved) {
        refreshDbStats();
      }
    } catch (err) {
      el.curateStatusMsg.className = "curate-alert error";
      el.curateStatusMsg.textContent = `Feil: ${err.message}`;
    }
  }

  // --- Live Wikipedia Autocomplete ---

  let searchTimer = null;

  function setupAutocomplete(inputEl, listEl, shouldCheckToggle = false) {
    inputEl.addEventListener("input", () => {
      if (shouldCheckToggle && !el.autocompleteToggle.checked) {
        hideAutocomplete(listEl);
        return;
      }
      const q = inputEl.value.trim();
      clearTimeout(searchTimer);
      if (q.length < 2) {
        hideAutocomplete(listEl);
        return;
      }
      searchTimer = setTimeout(async () => {
        try {
          const res = await fetch(
            `/api/wiki-search?q=${encodeURIComponent(q)}`
          );
          const data = await res.json();
          const suggestions = data.suggestions || [];
          if (!suggestions.length) {
            hideAutocomplete(listEl);
            return;
          }
          listEl.innerHTML = "";
          suggestions.forEach((s) => {
            const li = document.createElement("li");
            li.className = "autocomplete-item";
            li.textContent = s;
            li.addEventListener("mousedown", (ev) => {
              ev.preventDefault();
              inputEl.value = s;
              hideAutocomplete(listEl);
              inputEl.focus();
            });
            listEl.appendChild(li);
          });
          listEl.classList.remove("hidden");
        } catch (_) {
          hideAutocomplete(listEl);
        }
      }, 180);
    });

    inputEl.addEventListener("blur", () => {
      setTimeout(() => hideAutocomplete(listEl), 150);
    });
  }

  function hideAutocomplete(listEl) {
    listEl.classList.add("hidden");
    listEl.innerHTML = "";
  }

  // --- Theme & Event Listeners ---

  function initTheme() {
    document.documentElement.setAttribute("data-theme", "dark");
    const savedAuto = localStorage.getItem(AUTOCOMPLETE_KEY);
    el.autocompleteToggle.checked = savedAuto === null ? true : savedAuto === "1";
  }

  function bindEvents() {
    el.brandHomeBtn.addEventListener("click", () => loadDailyPuzzle());
    el.navDailyBtn.addEventListener("click", () => loadDailyPuzzle());
    el.navArchiveBtn.addEventListener("click", () => openArchiveView());
    el.navPracticeBtn.addEventListener("click", () => startPracticeMode());
    el.navCurateBtn.addEventListener("click", () => openCurateView());

    el.autocompleteToggle.addEventListener("change", () => {
      localStorage.setItem(
        AUTOCOMPLETE_KEY,
        el.autocompleteToggle.checked ? "1" : "0"
      );
      if (!el.autocompleteToggle.checked) {
        hideAutocomplete(el.autocompleteList);
      }
    });

    el.helpModalBtn.addEventListener("click", () => {
      el.helpModal.classList.remove("hidden");
    });
    el.closeHelpModalBtn.addEventListener("click", () => {
      el.helpModal.classList.add("hidden");
    });
    el.helpModal.addEventListener("click", (e) => {
      if (e.target === el.helpModal) el.helpModal.classList.add("hidden");
    });

    // Hints
    el.hintLettersBtn.addEventListener("click", () => {
      if (state.mode === "practice") {
        state.practiceLetterHint = true;
      } else {
        state.progress[state.currentIndex].letterHint = true;
        saveDailyProgress();
      }
      renderGameView();
    });

    el.hintSentenceBtn.addEventListener("click", () => {
      if (state.mode === "practice") {
        state.practiceSentenceHint = true;
      } else {
        state.progress[state.currentIndex].sentenceHint = true;
        saveDailyProgress();
      }
      renderGameView();
    });

    // Guess form & Give Up
    el.guessForm.addEventListener("submit", handleGuessSubmit);
    el.giveUpBtn.addEventListener("click", () => {
      const raw = el.guessInput.value.trim();
      const item = getCurrentItemState();
      if (raw && !item.guesses.includes(raw)) {
        item.guesses.push(raw);
      }
      markCurrentArticle("gaveup", 0.0);
    });

    // Did you mean buttons
    el.dymYesBtn.addEventListener("click", () => {
      const item = getCurrentItemState();
      if (state.dymCandidate && !item.guesses.includes(state.dymCandidate)) {
        item.guesses.push(state.dymCandidate);
      }
      markCurrentArticle("solved", 1.0);
    });
    el.dymNoBtn.addEventListener("click", () => {
      const item = getCurrentItemState();
      if (state.dymCandidate && !item.guesses.includes(state.dymCandidate)) {
        item.guesses.push(state.dymCandidate);
      }
      state.dymCandidate = null;
      el.didYouMeanBox.classList.add("hidden");
      markCurrentArticle("gaveup", 0.0);
    });

    // Reveal card actions
    el.closeEnoughBtn.addEventListener("click", handleCloseEnoughAward);
    el.nextArticleBtn.addEventListener("click", advanceToNextArticle);

    // Keyboard shortcut: Enter advances when reveal card is shown
    document.addEventListener("keydown", (e) => {
      if (
        e.key === "Enter" &&
        (state.mode === "daily" || state.mode === "practice") &&
        !el.revealCard.classList.contains("hidden") &&
        document.activeElement !== el.guessInput
      ) {
        e.preventDefault();
        advanceToNextArticle();
      }
    });

    // Summary actions
    el.copyShareBtn.addEventListener("click", copyShareableResult);
    el.summaryToArchiveBtn.addEventListener("click", openArchiveView);
    el.summaryToPracticeBtn.addEventListener("click", startPracticeMode);

    // Curate form
    el.curatePreviewBtn.addEventListener("click", () =>
      submitCurateArticle(true)
    );
    el.curateForm.addEventListener("submit", (e) => {
      e.preventDefault();
      submitCurateArticle(false);
    });
    el.harvestMoreBtn.addEventListener("click", async () => {
      el.harvestMoreBtn.disabled = true;
      el.harvestMoreBtn.textContent = "Henter artikler fra Wikipedia…";
      try {
        const res = await fetch("/api/harvest", { method: "POST" });
        const data = await res.json();
        el.harvestMoreBtn.textContent = `Hentet ${data.added || 0} nye artikler!`;
        refreshDbStats();
      } catch (_) {
        el.harvestMoreBtn.textContent = "Feil ved henting";
      } finally {
        setTimeout(() => {
          el.harvestMoreBtn.disabled = false;
          el.harvestMoreBtn.textContent =
            "Hent flere populære artikler fra Wikipedia nå";
        }, 3000);
      }
    });

    setupAutocomplete(el.guessInput, el.autocompleteList, true);
    setupAutocomplete(el.curateTitleInput, el.curateAutocompleteList, false);
  }

  // Init
  initTheme();
  bindEvents();
  loadDailyPuzzle();
})();
