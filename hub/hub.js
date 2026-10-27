(() => {
  "use strict";

  const STORAGE_PREFIX = "kattfisking_daily_v1_";

  // Lock to dark theme permanently
  document.documentElement.setAttribute("data-theme", "dark");

  // Date formatting in Norwegian
  const dateBadge = document.getElementById("hubDateBadge");
  const today = new Date();
  const dateFormatted = today.toLocaleDateString("no-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  if (dateBadge) {
    // Capitalize first letter of weekday
    dateBadge.textContent = dateFormatted.charAt(0).toUpperCase() + dateFormatted.slice(1);
  }

  // ISO date for checking localStorage: YYYY-MM-DD
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const todayIso = `${yyyy}-${mm}-${dd}`;

  // 1. Check Kattfisking completion & score indicator
  const cardKattfisking = document.getElementById("cardKattfisking");
  const kattfiskingStatus = document.getElementById("kattfiskingStatus");
  const kattfiskingBtn = document.getElementById("kattfiskingBtn");
  const kattfiskingPlayedBadge = document.getElementById("kattfiskingPlayedBadge");
  const kattfiskingScoreBadge = document.getElementById("kattfiskingScoreBadge");

  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + todayIso);
    if (raw) {
      const data = JSON.parse(raw);
      const isFinished = Boolean(
        data && (data.submittedToServer || (Array.isArray(data.progress) && data.progress.length > 0 && data.progress.every(p => p.status !== "pending")))
      );
      if (isFinished) {
        const solved = (data.progress || []).filter(p => p.status === "solved" || p.status === "half").length;
        const total = (data.progress || []).length || 5;

        if (cardKattfisking) {
          cardKattfisking.classList.add("daily-played");
          cardKattfisking.href = "/kattfisking/?result=1";
        }
        if (kattfiskingPlayedBadge) {
          kattfiskingPlayedBadge.classList.remove("hidden");
          if (kattfiskingScoreBadge) kattfiskingScoreBadge.textContent = `${solved}/${total}`;
        }
        if (kattfiskingStatus) {
          kattfiskingStatus.textContent = `✓ Spilt i dag (${solved}/${total} riktige)`;
          kattfiskingStatus.classList.add("completed");
        }
        if (kattfiskingBtn) {
          kattfiskingBtn.textContent = "Se resultat →";
        }
      }
    }
  } catch (e) {
    console.warn("Could not check local storage for kattfisking progress", e);
  }

  // 2. Check Mer eller Mindre Completion and Status
  const cardMerMindre = document.getElementById("cardMerMindre");
  const merMindreStatus = document.getElementById("merMindreStatus");
  const merMindreBtn = document.getElementById("merMindreBtn");
  const merMindrePlayedBadge = document.getElementById("merMindrePlayedBadge");
  const merMindreScoreBadge = document.getElementById("merMindreScoreBadge");

  try {
    const rawMM25 = localStorage.getItem("mer_eller_mindre_25_daily_" + todayIso) || localStorage.getItem("mer_eller_mindre_daily_" + todayIso);
    if (rawMM25) {
      const dataMM = JSON.parse(rawMM25);
      if (dataMM && typeof dataMM.score === "number") {
        const maxScore = dataMM.total || 25;
        const score = dataMM.score;

        if (cardMerMindre) {
          cardMerMindre.classList.add("daily-played");
          cardMerMindre.href = "/mer-eller-mindre/?result=1";
        }
        if (merMindrePlayedBadge) {
          merMindrePlayedBadge.classList.remove("hidden");
          if (merMindreScoreBadge) merMindreScoreBadge.textContent = `${score}/${maxScore}`;
        }
        if (merMindreStatus) {
          merMindreStatus.textContent = `✓ Spilt i dag (${score}/${maxScore} poeng)`;
          merMindreStatus.classList.add("completed");
        }
        if (merMindreBtn) {
          merMindreBtn.textContent = "Se resultat →";
        }
      }
    } else {
      const hs = localStorage.getItem("mer_eller_mindre_25_highscore") || localStorage.getItem("mer_eller_mindre_highscore");
      if (hs && merMindreStatus) {
        merMindreStatus.textContent = `Beste: ${hs} poeng`;
      }
    }
  } catch (e) {
    console.warn("Could not check mer eller mindre progress", e);
  }

  // Check Ordbombe Highscore & Party Status
  const ordbombeStatus = document.getElementById("ordbombeStatus");
  try {
    const obHs = localStorage.getItem("ordbombe_highscore");
    if (obHs && parseInt(obHs, 10) > 0) {
      const score = parseInt(obHs, 10);
      if (ordbombeStatus) {
        ordbombeStatus.textContent = `Beste solo: ${score} ord 🔥`;
      }
    }
  } catch (e) {
    console.warn("Could not check ordbombe progress", e);
  }

  // Category quick filter tabs
  const tabButtons = document.querySelectorAll(".hub-tab-btn[data-filter]");
  const sections = document.querySelectorAll(".game-category-section");

  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const filter = btn.dataset.filter;
      tabButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      sections.forEach(sec => {
        const secCat = sec.dataset.sectionCategory;
        if (filter === "all" || secCat === filter) {
          sec.classList.remove("hidden");
          sec.style.opacity = "0";
          sec.style.transform = "translateY(8px)";
          setTimeout(() => {
            sec.style.transition = "opacity 0.25s ease, transform 0.25s ease";
            sec.style.opacity = "1";
            sec.style.transform = "translateY(0)";
          }, 10);
        } else {
          sec.classList.add("hidden");
        }
      });
    });
  });

  // Handle initial hash on page load for deep links (e.g. #party scrolls smoothly to party section)
  const initialHash = window.location.hash.replace("#", "").toLowerCase();
  if (initialHash === "party") {
    const partySec = document.querySelector('[data-section-category="party"]');
    if (partySec) {
      setTimeout(() => {
        partySec.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }
})();
