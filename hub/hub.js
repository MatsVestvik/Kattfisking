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

  // Check Kattfisking completion
  const kattfiskingStatus = document.getElementById("kattfiskingStatus");
  const trackerKattfisking = document.getElementById("trackerKattfisking");

  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + todayIso);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.submittedToServer) {
        const solved = (data.progress || []).filter(p => p.status === "solved" || p.status === "half").length;
        const total = (data.progress || []).length || 5;
        const text = `Fullført i dag (${solved}/${total} ✓)`;
        if (kattfiskingStatus) {
          kattfiskingStatus.textContent = text;
          kattfiskingStatus.classList.add("completed");
        }
        if (trackerKattfisking) {
          trackerKattfisking.classList.add("done");
          trackerKattfisking.innerHTML = `<span>✓</span> Kattfisking (${solved}/${total})`;
        }
      }
    }
  } catch (e) {
    console.warn("Could not check local storage for kattfisking progress", e);
  }

  // Check Mer eller Mindre Completion and Status (supports both 25-duel and legacy keys)
  const merMindreStatus = document.getElementById("merMindreStatus");
  const trackerMerMindre = document.getElementById("trackerMerMindre");
  try {
    const rawMM25 = localStorage.getItem("mer_eller_mindre_25_daily_" + todayIso) || localStorage.getItem("mer_eller_mindre_daily_" + todayIso);
    if (rawMM25) {
      const dataMM = JSON.parse(rawMM25);
      if (dataMM && typeof dataMM.score === "number") {
        const maxScore = dataMM.total || 25;
        const textMM = `Fullført i dag (${dataMM.score}/${maxScore} ✓)`;
        if (merMindreStatus) {
          merMindreStatus.textContent = textMM;
          merMindreStatus.classList.add("completed");
        }
        if (trackerMerMindre) {
          trackerMerMindre.classList.add("done");
          trackerMerMindre.innerHTML = `<span>✓</span> Mer eller Mindre (${dataMM.score}/${maxScore})`;
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
})();
