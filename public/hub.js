(() => {
  "use strict";

  const THEME_KEY = "kattfisking_theme";
  const STORAGE_PREFIX = "kattfisking_daily_v1_";

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
  const kattfiskingHeroStatus = document.getElementById("kattfiskingHeroStatus");
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
        if (kattfiskingHeroStatus) {
          kattfiskingHeroStatus.textContent = text;
          kattfiskingHeroStatus.classList.add("completed");
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

  // Check Mer eller Mindre High Score
  const merMindreStatus = document.getElementById("merMindreStatus");
  const hs = localStorage.getItem("mer_eller_mindre_highscore");
  if (hs && merMindreStatus) {
    merMindreStatus.textContent = `Beste rekke: ${hs}`;
  }

  // Theme Sync
  const savedTheme = localStorage.getItem(THEME_KEY) || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);

  const themeBtn = document.getElementById("themeToggleBtn");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "dark";
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem(THEME_KEY, next);
    });
  }
})();
