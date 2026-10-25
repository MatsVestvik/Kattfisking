(() => {
  "use strict";

  // Norwegian trivia database for Mer eller Mindre
  const DATA = [
    { title: "Oslo (kommune)", metric: "Innbyggertall", val: 717710, unit: "innbyggere" },
    { title: "Bergen (kommune)", metric: "Innbyggertall", val: 291940, unit: "innbyggere" },
    { title: "Trondheim (kommune)", metric: "Innbyggertall", val: 214565, unit: "innbyggere" },
    { title: "Stavanger (kommune)", metric: "Innbyggertall", val: 149048, unit: "innbyggere" },
    { title: "Bærum (kommune)", metric: "Innbyggertall", val: 130921, unit: "innbyggere" },
    { title: "Kristiansand (kommune)", metric: "Innbyggertall", val: 116986, unit: "innbyggere" },
    { title: "Tromsø (kommune)", metric: "Innbyggertall", val: 78745, unit: "innbyggere" },
    { title: "Ålesund (kommune)", metric: "Innbyggertall", val: 67603, unit: "innbyggere" },
    { title: "Bodø (kommune)", metric: "Innbyggertall", val: 53259, unit: "innbyggere" },
    { title: "Lillehammer (kommune)", metric: "Innbyggertall", val: 28637, unit: "innbyggere" },
    { title: "Galdhøpiggen", metric: "Høyde over havet", val: 2469, unit: "meter" },
    { title: "Glittertind (uten fonn)", metric: "Høyde over havet", val: 2452, unit: "meter" },
    { title: "Store Skagastølstind", metric: "Høyde over havet", val: 2405, unit: "meter" },
    { title: "Snøhetta", metric: "Høyde over havet", val: 2286, unit: "meter" },
    { title: "Gaustatoppen", metric: "Høyde over havet", val: 1883, unit: "meter" },
    { title: "Preikestolen (stup)", metric: "Høyde over Lysefjorden", val: 604, unit: "meter" },
    { title: "Mjøsa", metric: "Areal", val: 365, unit: "km²" },
    { title: "Røssvatnet", metric: "Areal", val: 219, unit: "km²" },
    { title: "Femunden", metric: "Areal", val: 203, unit: "km²" },
    { title: "Hinnøya", metric: "Øyareal", val: 2204, unit: "km²" },
    { title: "Senja", metric: "Øyareal", val: 1586, unit: "km²" },
    { title: "Lærdalstunnelen", metric: "Veitunnellengde", val: 24510, unit: "meter" },
    { title: "Ryfylketunnelen", metric: "Undersjøisk lengde", val: 14459, unit: "meter" },
  ];

  let score = 0;
  let highScore = parseInt(localStorage.getItem("mer_eller_mindre_highscore") || "0", 10);
  let currentItem = null;
  let challengerItem = null;

  const scoreEl = document.getElementById("scoreDisplay");
  const highScoreEl = document.getElementById("highScoreDisplay");
  const titleA = document.getElementById("titleA");
  const metricA = document.getElementById("metricA");
  const valA = document.getElementById("valA");
  const unitA = document.getElementById("unitA");

  const titleB = document.getElementById("titleB");
  const metricB = document.getElementById("metricB");
  const valB = document.getElementById("valB");
  const unitB = document.getElementById("unitB");

  const btnHigher = document.getElementById("btnHigher");
  const btnLower = document.getElementById("btnLower");
  const feedbackOverlay = document.getElementById("feedbackOverlay");
  const feedbackIcon = document.getElementById("feedbackIcon");
  const feedbackTitle = document.getElementById("feedbackTitle");
  const feedbackText = document.getElementById("feedbackText");
  const btnNext = document.getElementById("btnNext");
  const themeToggleBtn = document.getElementById("themeToggleBtn");

  function formatNum(n) {
    return Number(n).toLocaleString("no-NO");
  }

  function pickRandomItem(exclude) {
    const pool = DATA.filter(d => !exclude || (d.title !== exclude.title && d.metric === exclude.metric));
    // If metric pool is too small, fallback to any item
    const finalPool = pool.length > 0 ? pool : DATA.filter(d => !exclude || d.title !== exclude.title);
    return finalPool[Math.floor(Math.random() * finalPool.length)];
  }

  function setupRound() {
    feedbackOverlay.classList.add("hidden");
    valB.classList.add("blurred-value");
    valB.textContent = "???";

    if (!currentItem) {
      currentItem = DATA[Math.floor(Math.random() * DATA.length)];
    }
    challengerItem = pickRandomItem(currentItem);

    titleA.textContent = currentItem.title;
    metricA.textContent = currentItem.metric;
    valA.textContent = formatNum(currentItem.val);
    unitA.textContent = currentItem.unit;

    titleB.textContent = challengerItem.title;
    metricB.textContent = challengerItem.metric;
    unitB.textContent = challengerItem.unit;

    btnHigher.disabled = false;
    btnLower.disabled = false;
  }

  function handleGuess(isHigherGuess) {
    btnHigher.disabled = true;
    btnLower.disabled = true;

    valB.classList.remove("blurred-value");
    valB.textContent = formatNum(challengerItem.val);

    const isActuallyHigher = challengerItem.val >= currentItem.val;
    const won = isHigherGuess === isActuallyHigher;

    setTimeout(() => {
      if (won) {
        score++;
        if (score > highScore) {
          highScore = score;
          localStorage.setItem("mer_eller_mindre_highscore", String(highScore));
        }
        feedbackIcon.textContent = "🎉";
        feedbackTitle.textContent = "Riktig!";
        feedbackText.textContent = `${challengerItem.title} (${formatNum(challengerItem.val)} ${challengerItem.unit}) er ${isActuallyHigher ? "mer/høyere" : "mindre/lavere"} enn ${currentItem.title}!`;
        btnNext.textContent = "Neste runde →";
        currentItem = challengerItem;
      } else {
        feedbackIcon.textContent = "💥";
        feedbackTitle.textContent = "Feil!";
        feedbackText.textContent = `${challengerItem.title} har ${formatNum(challengerItem.val)} ${challengerItem.unit}, mens ${currentItem.title} har ${formatNum(currentItem.val)} ${currentItem.unit}. Du fikk ${score} poeng!`;
        btnNext.textContent = "Spill på nytt ↺";
        score = 0;
        currentItem = null;
      }

      scoreEl.textContent = score;
      highScoreEl.textContent = highScore;
      feedbackOverlay.classList.remove("hidden");
    }, 600);
  }

  btnHigher.addEventListener("click", () => handleGuess(true));
  btnLower.addEventListener("click", () => handleGuess(false));
  btnNext.addEventListener("click", setupRound);

  // Theme support
  const savedTheme = localStorage.getItem("kattfisking_theme") || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);
  themeToggleBtn.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") || "dark";
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("kattfisking_theme", next);
  });

  highScoreEl.textContent = highScore;
  setupRound();
})();
