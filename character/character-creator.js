/**
 * NTNU Games - Character Creator & Pixel Renderer (Skribbl.io Style)
 * Universal modular pixel art avatar generator for party games and hub.
 * Head is ALWAYS a circle (head_0001.png) tinted with the user's chosen color,
 * with customizable hair/crown, eyes, and mouth with skribbl.io style arrow controls.
 */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.CharacterCreator = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const ASSET_BASE = "/character/";

  // Curated 16-color party palette: Skin tones + vibrant campus colors
  const HEAD_COLORS = [
    { name: "Student-gull", hex: "#ffd166" },
    { name: "Fjord-blå", hex: "#00b4d8" },
    { name: "Samfundet-rød", hex: "#ef476f" },
    { name: "Dragvoll-grønn", hex: "#06d6a0" },
    { name: "Vors-oransje", hex: "#fb8500" },
    { name: "Linjeforening-lilla", hex: "#8338ec" },
    { name: "Neon-rosa", hex: "#ff70a6" },
    { name: "Alve-isblå", hex: "#a0c4ff" },
    { name: "Lys fersken", hex: "#fadcba" },
    { name: "Varm gyllen", hex: "#f3c299" },
    { name: "Solbrent", hex: "#dfa27a" },
    { name: "Kaffebrun", hex: "#8d5b36" },
    { name: "Dyp ibenholt", hex: "#4a2810" },
    { name: "Spøkelseshvit", hex: "#f1f5f9" },
    { name: "Robot-grå", hex: "#94a3b8" },
    { name: "Kullsvart", hex: "#1e293b" }
  ];

  const HEAD_FILE = "head/head.png";

  // Skribbl.io features
  const HAIR_OPTIONS = [
    { id: 0, name: "Snau (Skalla)", icon: "🥚", file: null },
    { id: 1, name: "Spire", icon: "🌱", file: "hair/hair_0001.png" },
    { id: 2, name: "Hane-kam", icon: "🔥", file: "hair/hair_0002.png" },
    { id: 3, name: "Blond sveis", icon: "👱", file: "hair/hair_0003.png" },
    { id: 4, name: "Doble knuter", icon: "🎀", file: "hair/hair_0004.png" },
    { id: 5, name: "Blader / Horn", icon: "🌿", file: "hair/hair_0005.png" },
    { id: 6, name: "Hodetelefoner", icon: "🎧", file: "hair/hair_0006.png" },
    { id: 7, name: "Djevelhorn / Ører", icon: "😈", file: "hair/hair_0007.png" },
    { id: 8, name: "Rød lue / Caps", icon: "🧢", file: "hair/hair_0008.png" },
    { id: 9, name: "Langt hår / Sider", icon: "💇", file: "hair/hair_0009.png" }
  ];

  const EYES_OPTIONS = [
    { id: 1, name: "Tegneserie-øyne", icon: "👀", file: "eyes/eyes_0001.png" },
    { id: 2, name: "Bryn & øyne", icon: "🤨", file: "eyes/eyes_0002.png" },
    { id: 3, name: "Store øyne", icon: "✨", file: "eyes/eyes_0003.png" },
    { id: 4, name: "Kyklop", icon: "👁️", file: "eyes/eyes_0004.png" },
    { id: 5, name: "Solbriller", icon: "😎", file: "eyes/eyes_0005.png" },
    { id: 6, name: "Rødme-blikk", icon: "😳", file: "eyes/eyes_0006.png" },
    { id: 7, name: "Smileøyne", icon: "😄", file: "eyes/eyes_0007.png" },
    { id: 8, name: "Prikkøyne", icon: "😶", file: "eyes/eyes_0008.png" },
    { id: 9, name: "Stjerneblikk", icon: "🤩", file: "eyes/eyes_0009.png" }
  ];

  const MOUTH_OPTIONS = [
    { id: 1, name: "Kinn & smil", icon: "😊", file: "mouth/mouth_0001.png" },
    { id: 2, name: "Skjegg & bart", icon: "🧔", file: "mouth/mouth_0002.png" },
    { id: 3, name: "Tunge / drypp", icon: "😋", file: "mouth/mouth_0003.png" },
    { id: 4, name: "Åpen munn", icon: "😮", file: "mouth/mouth_0004.png" },
    { id: 5, name: "Bredt glis", icon: "😁", file: "mouth/mouth_0005.png" },
    { id: 6, name: "Hoggtenner", icon: "🧛", file: "mouth/mouth_0006.png" },
    { id: 7, name: "Pipe / Sigarett", icon: "🚬", file: "mouth/mouth_0007.png" },
    { id: 8, name: "Sidelurv / Piercing", icon: "😏", file: "mouth/mouth_0008.png" },
    { id: 9, name: "Liten munn", icon: "😗", file: "mouth/mouth_0009.png" },
    { id: 0, name: "Uten munn", icon: "😶", file: null }
  ];

  const DEFAULT_CONFIG = {
    head: 1, // Circle head always!
    headColor: "#ffd166",
    hair: 1,
    eyes: 1,
    mouth: 1,
    brows: 0,
    nose: 0
  };

  // Image element cache to avoid re-fetching
  const imageCache = new Map();
  const dataUrlCache = new Map();
  let preloadingPromise = null;

  function preloadImage(relPath) {
    if (!relPath) return Promise.resolve(null);
    if (imageCache.has(relPath)) {
      return Promise.resolve(imageCache.get(relPath));
    }
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        imageCache.set(relPath, img);
        resolve(img);
      };
      img.onerror = () => {
        resolve(null);
      };
      img.src = ASSET_BASE + relPath;
    });
  }

  function preloadAllAssets() {
    if (preloadingPromise) return preloadingPromise;
    const files = [
      HEAD_FILE,
      "hair/hair_0001.png",
      "hair/hair_0002.png",
      "hair/hair_0003.png",
      "hair/hair_0004.png",
      "hair/hair_0005.png",
      "hair/hair_0006.png",
      "hair/hair_0007.png",
      "hair/hair_0008.png",
      "hair/hair_0009.png",
      "eyes/eyes_0001.png",
      "eyes/eyes_0002.png",
      "eyes/eyes_0003.png",
      "eyes/eyes_0004.png",
      "eyes/eyes_0005.png",
      "eyes/eyes_0006.png",
      "eyes/eyes_0007.png",
      "eyes/eyes_0008.png",
      "eyes/eyes_0009.png",
      "mouth/mouth_0001.png",
      "mouth/mouth_0002.png",
      "mouth/mouth_0003.png",
      "mouth/mouth_0004.png",
      "mouth/mouth_0005.png",
      "mouth/mouth_0006.png",
      "mouth/mouth_0007.png",
      "mouth/mouth_0008.png",
      "mouth/mouth_0009.png"
    ];
    preloadingPromise = Promise.all(files.map(preloadImage)).catch(() => {});
    return preloadingPromise;
  }

  function hexToRgb(hex) {
    if (!hex) return { r: 255, g: 209, b: 102 };
    let clean = hex.replace("#", "").trim();
    if (clean.length === 3) {
      clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
    }
    const num = parseInt(clean, 16);
    return isNaN(num)
      ? { r: 255, g: 209, b: 102 }
      : { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }

  function parseConfig(raw) {
    if (!raw) return { ...DEFAULT_CONFIG };
    if (typeof raw === "object") {
      return {
        head: 1, // Circle head always!
        headColor: String(raw.headColor || DEFAULT_CONFIG.headColor),
        hair: Number(raw.hair) ?? DEFAULT_CONFIG.hair,
        eyes: Number(raw.eyes) || DEFAULT_CONFIG.eyes,
        mouth: Number(raw.mouth) ?? DEFAULT_CONFIG.mouth,
        brows: Number(raw.brows) || 0,
        nose: Number(raw.nose) || 0
      };
    }
    const str = String(raw).trim();
    if (str.startsWith("{")) {
      try {
        return parseConfig(JSON.parse(str));
      } catch (e) {
        return { ...DEFAULT_CONFIG };
      }
    }
    if (str.startsWith("char:")) {
      const parts = str.slice(5).split(":");
      const cfg = { ...DEFAULT_CONFIG, head: 1 };
      parts.forEach((p) => {
        if (p.startsWith("c_") || p.startsWith("c")) {
          const colorHex = p.replace(/^c_?/, "");
          cfg.headColor = "#" + colorHex;
        } else if (p.startsWith("ha")) {
          cfg.hair = parseInt(p.slice(2), 10);
        } else if (p.startsWith("r")) {
          cfg.hair = parseInt(p.slice(1), 10);
        } else if (p.startsWith("e")) {
          cfg.eyes = parseInt(p.slice(1), 10) || 1;
        } else if (p.startsWith("m")) {
          cfg.mouth = parseInt(p.slice(1), 10);
        } else if (p.startsWith("b")) {
          cfg.brows = parseInt(p.slice(1), 10) || 0;
        } else if (p.startsWith("n")) {
          cfg.nose = parseInt(p.slice(1), 10) || 0;
        }
      });
      return cfg;
    }
    return { ...DEFAULT_CONFIG };
  }

  function getSavedConfigString() {
    return encodeConfig(getSavedCharacter());
  }

  function encodeConfig(cfg) {
    const c = parseConfig(cfg);
    const colorClean = c.headColor.replace("#", "").toLowerCase();
    return `char:h1:c_${colorClean}:r${c.hair}:e${c.eyes}:m${c.mouth}`;
  }

  function getRandomConfig(options = {}) {
    const excluded = (options.excludeColors || []).map((c) => String(c).toLowerCase());
    const availableHeadColors = HEAD_COLORS.filter((c) => !excluded.includes(c.hex.toLowerCase()));
    const palette = availableHeadColors.length > 0 ? availableHeadColors : HEAD_COLORS;
    const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const randomHeadColor = randomChoice(palette).hex;
    return {
      head: 1, // Always circle!
      headColor: randomHeadColor,
      hair: randomChoice(HAIR_OPTIONS).id,
      eyes: randomChoice(EYES_OPTIONS).id,
      mouth: randomChoice(MOUTH_OPTIONS).id,
      brows: 0,
      nose: 0
    };
  }

  function getHairFile(id) {
    const opt = HAIR_OPTIONS.find((h) => h.id === id);
    return opt ? opt.file : null;
  }

  function getEyesFile(id) {
    const opt = EYES_OPTIONS.find((e) => e.id === id);
    return opt ? opt.file : "eyes/eyes_0001.png";
  }

  function getMouthFile(id) {
    const opt = MOUTH_OPTIONS.find((m) => m.id === id);
    return opt ? opt.file : null;
  }

  /**
   * Tints the circle head image onto an offscreen canvas.
   * Pure white (255) pixels receive the full headColor.
   * Shading pixels (gray) receive proportionally shaded headColor.
   * Black outline (0) and transparent pixels are preserved.
   */
  function createTintedHeadCanvas(headImg, headColorHex) {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(headImg, 0, 0);

    const imgData = ctx.getImageData(0, 0, 64, 64);
    const data = imgData.data;
    const { r: tr, g: tg, b: tb } = hexToRgb(headColorHex);

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a === 0) continue;

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Keep black outline intact
      if (r === 0 && g === 0 && b === 0) continue;

      // Grayscale shading factor
      const factor = r / 255.0;
      data[i] = Math.round(tr * factor);
      data[i + 1] = Math.round(tg * factor);
      data[i + 2] = Math.round(tb * factor);
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  /**
   * Synchronously composites character into canvas using cached Image objects.
   */
  function compositeCharacterSync(canvas, config) {
    const cfg = parseConfig(config);
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;

    // 1. Circle Head (always HEAD_FILE)
    const headImg = imageCache.get(HEAD_FILE);
    if (headImg && headImg.complete) {
      const tinted = createTintedHeadCanvas(headImg, cfg.headColor);
      ctx.drawImage(tinted, 0, 0, canvas.width, canvas.height);
    }

    // 2. Mouth
    const mouthFile = getMouthFile(cfg.mouth);
    if (mouthFile) {
      const mouthImg = imageCache.get(mouthFile);
      if (mouthImg && mouthImg.complete) {
        ctx.drawImage(mouthImg, 0, 0, canvas.width, canvas.height);
      }
    }

    // 3. Eyes
    const eyesFile = getEyesFile(cfg.eyes);
    if (eyesFile) {
      const eyesImg = imageCache.get(eyesFile);
      if (eyesImg && eyesImg.complete) {
        ctx.drawImage(eyesImg, 0, 0, canvas.width, canvas.height);
      }
    }

    // 4. Hair / Crown (in authentic natural colors from asset)
    const hairFile = getHairFile(cfg.hair);
    if (hairFile) {
      const hairImg = imageCache.get(hairFile);
      if (hairImg && hairImg.complete) {
        ctx.drawImage(hairImg, 0, 0, canvas.width, canvas.height);
      }
    }

    return canvas;
  }

  /**
   * Asynchronously composites character into canvas.
   */
  async function compositeCharacter(canvas, config) {
    const cfg = parseConfig(config);
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;

    // 1. Circle Head (HEAD_FILE)
    const headImg = await preloadImage(HEAD_FILE);
    if (headImg) {
      const tinted = createTintedHeadCanvas(headImg, cfg.headColor);
      ctx.drawImage(tinted, 0, 0, canvas.width, canvas.height);
    }

    // 2. Mouth
    const mouthFile = getMouthFile(cfg.mouth);
    if (mouthFile) {
      const mouthImg = await preloadImage(mouthFile);
      if (mouthImg) ctx.drawImage(mouthImg, 0, 0, canvas.width, canvas.height);
    }

    // 3. Eyes
    const eyesFile = getEyesFile(cfg.eyes);
    if (eyesFile) {
      const eyesImg = await preloadImage(eyesFile);
      if (eyesImg) ctx.drawImage(eyesImg, 0, 0, canvas.width, canvas.height);
    }

    // 4. Hair / Crown
    const hairFile = getHairFile(cfg.hair);
    if (hairFile) {
      const hairImg = await preloadImage(hairFile);
      if (hairImg) ctx.drawImage(hairImg, 0, 0, canvas.width, canvas.height);
    }

    return canvas;
  }

  function getDataUrlSync(config) {
    const key = typeof config === "string" && config.startsWith("char:")
      ? config
      : encodeConfig(config);

    if (dataUrlCache.has(key)) {
      return dataUrlCache.get(key);
    }

    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    compositeCharacterSync(canvas, config);
    const dataUrl = canvas.toDataURL("image/png");
    dataUrlCache.set(key, dataUrl);
    return dataUrl;
  }

  async function getDataUrl(config) {
    const key = typeof config === "string" && config.startsWith("char:")
      ? config
      : encodeConfig(config);

    if (dataUrlCache.has(key)) {
      return dataUrlCache.get(key);
    }

    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    await compositeCharacter(canvas, config);
    const dataUrl = canvas.toDataURL("image/png");
    dataUrlCache.set(key, dataUrl);
    return dataUrl;
  }

  function getAvatarImgSrc(avatarId) {
    if (!avatarId) {
      return getDataUrlSync(getSavedCharacter());
    }

    const str = String(avatarId);
    if (str.startsWith("data:") || str.startsWith("/")) {
      return str;
    }
    if (str.startsWith("char:") || str.startsWith("{")) {
      return getDataUrlSync(str);
    }

    const legacyMons = ["charbear", "jormundgandr", "pixiu", "squitonkey", "tanuki", "totter"];
    if (legacyMons.includes(str)) {
      return `/assets/mons/${str}.png`;
    }

    return getDataUrlSync(getSavedCharacter());
  }

  const STORAGE_KEY = "spillhjornet_character";
  const STORAGE_DATAURL_KEY = "spillhjornet_character_dataurl";

  function getSavedCharacter() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("korridorer_character") || localStorage.getItem("party_character");
      if (raw) return parseConfig(raw);
    } catch (e) {}
    return { ...DEFAULT_CONFIG };
  }

  function saveCharacter(cfg, dataUrl = null, sourceId = null) {
    const encoded = encodeConfig(cfg);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
      localStorage.setItem("korridorer_character", encoded);
      localStorage.setItem("party_character", encoded);
      if (dataUrl) {
        localStorage.setItem(STORAGE_DATAURL_KEY, dataUrl);
      }
    } catch (e) {}

    try {
      window.dispatchEvent(
        new CustomEvent("spillhjornet:characterUpdated", {
          detail: { config: cfg, encoded, dataUrl, sourceId }
        })
      );
    } catch (e) {}

    return encoded;
  }

  /**
   * Universal Character Customizer Component.
   * Large expressive avatar preview with ambient glow, vertically stacked arrow controls,
   * feature description pills, and curated color palette.
   */
  function renderSkribblWidget(container, options = {}) {
    if (!container) return null;
    const widgetId = "skribbl_w_" + Math.random().toString(36).slice(2, 9);
    const initialRaw = options.initialConfig || getSavedCharacter();
    let currentConfig = parseConfig(initialRaw);
    let isUpdating = false;

    container.innerHTML = `
      <div class="skribbl-customizer-card">
        <!-- Stage Box: Left arrows, Large head in center, Right arrows -->
        <div class="skribbl-stage-box">
          <div class="skribbl-stage-content">
            <!-- Left Arrows (stacked vertically directly beside the head) -->
            <div class="skribbl-arrows-col col-left">
              <button type="button" class="skribbl-nav-btn btn-hair-prev" title="Forrige hår / hodeplagg" aria-label="Forrige hår">‹</button>
              <button type="button" class="skribbl-nav-btn btn-eyes-prev" title="Forrige øyne" aria-label="Forrige øyne">‹</button>
              <button type="button" class="skribbl-nav-btn btn-mouth-prev" title="Forrige munn" aria-label="Forrige munn">‹</button>
            </div>

            <!-- Center Large Avatar Preview Bubble -->
            <div class="skribbl-canvas-bubble">
              <canvas class="skribbl-canvas" width="64" height="64"></canvas>
            </div>

            <!-- Right Arrows (stacked vertically directly beside the head) -->
            <div class="skribbl-arrows-col col-right">
              <button type="button" class="skribbl-nav-btn btn-hair-next" title="Neste hår / hodeplagg" aria-label="Neste hår">›</button>
              <button type="button" class="skribbl-nav-btn btn-eyes-next" title="Neste øyne" aria-label="Neste øyne">›</button>
              <button type="button" class="skribbl-nav-btn btn-mouth-next" title="Neste munn" aria-label="Neste munn">›</button>
            </div>
          </div>

          <!-- Randomize Button under head -->
          <button type="button" class="skribbl-randomize-btn" title="Lag en helt tilfeldig figur!" aria-label="Tilfeldig figur">
            <span class="skribbl-dice-icon">🎲</span>
            <span class="skribbl-dice-text">Tilfeldig figur</span>
          </button>
        </div>

        <!-- Color Palette Tray -->
        <div class="skribbl-colors-section">
          <div class="skribbl-colors-grid"></div>
        </div>
      </div>
    `;

    const canvas = container.querySelector(".skribbl-canvas");
    const colorsGrid = container.querySelector(".skribbl-colors-grid");
    const diceBtn = container.querySelector(".skribbl-randomize-btn");
    let disabledColorsMap = {};

    function normalizeDisabledMap(input) {
      const map = {};
      if (Array.isArray(input)) {
        input.forEach((c) => {
          if (c) map[String(c).toLowerCase()] = true;
        });
      } else if (input && typeof input === "object") {
        Object.entries(input).forEach(([k, v]) => {
          if (k) map[String(k).toLowerCase()] = v || true;
        });
      }
      return map;
    }

    function refreshColorDots() {
      const dots = colorsGrid.querySelectorAll(".skribbl-color-dot");
      dots.forEach((chip) => {
        const hex = chip.dataset.hex;
        const col = HEAD_COLORS.find((c) => c.hex.toLowerCase() === hex);
        const colName = col ? col.name : hex;
        const disabledInfo = disabledColorsMap[hex];
        const isDis = Boolean(disabledInfo);

        chip.classList.toggle("is-disabled", isDis);
        chip.disabled = isDis;

        if (isDis) {
          const taker = typeof disabledInfo === "string" ? disabledInfo : "";
          chip.title = taker ? `${colName} (Tatt av ${taker})` : `${colName} (Allerede tatt)`;
        } else {
          chip.title = colName;
        }

        const isActive = hex === currentConfig.headColor.toLowerCase();
        chip.classList.toggle("active", isActive);
      });
    }

    // Populate color chips
    HEAD_COLORS.forEach((col) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "skribbl-color-dot";
      chip.dataset.hex = col.hex.toLowerCase();
      chip.style.backgroundColor = col.hex;
      chip.style.setProperty("--dot-col", col.hex);
      chip.title = col.name;
      if (col.hex.toLowerCase() === currentConfig.headColor.toLowerCase()) {
        chip.classList.add("active");
      }
      chip.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (disabledColorsMap[col.hex.toLowerCase()]) {
          return;
        }
        currentConfig.headColor = col.hex;
        applyUpdate(false);
      });
      colorsGrid.appendChild(chip);
    });

    if (options.disabledColors) {
      disabledColorsMap = normalizeDisabledMap(options.disabledColors);
      refreshColorDots();
    }

    // Cycle helper
    function cycleOption(list, currentId, dir) {
      const idx = list.findIndex((item) => item.id === currentId);
      const nextIdx = (idx + dir + list.length) % list.length;
      return list[nextIdx].id;
    }

    function triggerDiceSpin() {
      if (!diceBtn) return;
      diceBtn.classList.remove("spin");
      void diceBtn.offsetWidth;
      diceBtn.classList.add("spin");
    }

    // Hair controls (top row beside head)
    container.querySelector(".btn-hair-prev").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      currentConfig.hair = cycleOption(HAIR_OPTIONS, currentConfig.hair, -1);
      applyUpdate(false);
    });
    container.querySelector(".btn-hair-next").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      currentConfig.hair = cycleOption(HAIR_OPTIONS, currentConfig.hair, 1);
      applyUpdate(false);
    });

    // Eyes controls (middle row beside head)
    container.querySelector(".btn-eyes-prev").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      currentConfig.eyes = cycleOption(EYES_OPTIONS, currentConfig.eyes, -1);
      applyUpdate(false);
    });
    container.querySelector(".btn-eyes-next").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      currentConfig.eyes = cycleOption(EYES_OPTIONS, currentConfig.eyes, 1);
      applyUpdate(false);
    });

    // Mouth controls (bottom row beside head)
    container.querySelector(".btn-mouth-prev").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      currentConfig.mouth = cycleOption(MOUTH_OPTIONS, currentConfig.mouth, -1);
      applyUpdate(false);
    });
    container.querySelector(".btn-mouth-next").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      currentConfig.mouth = cycleOption(MOUTH_OPTIONS, currentConfig.mouth, 1);
      applyUpdate(false);
    });

    // 🎲 Dice button randomizer
    diceBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      triggerDiceSpin();
      currentConfig = getRandomConfig({ excludeColors: Object.keys(disabledColorsMap) });
      applyUpdate(false);
    });

    async function applyUpdate(skipSave = false) {
      if (isUpdating) return;
      isUpdating = true;
      try {
        await compositeCharacter(canvas, currentConfig);
        refreshColorDots();

        const encoded = encodeConfig(currentConfig);
        if (!skipSave) {
          saveCharacter(currentConfig, null, widgetId);
        }

        if (options.onChange) {
          options.onChange(encoded, canvas.toDataURL("image/png"), currentConfig);
        }
      } finally {
        isUpdating = false;
      }
    }

    // Initial render
    applyUpdate(true);

    // Listen to external updates from other widgets
    const handleGlobalUpdate = (e) => {
      if (e.detail && e.detail.config && e.detail.sourceId !== widgetId) {
        const nextCfg = parseConfig(e.detail.config);
        if (encodeConfig(nextCfg) !== encodeConfig(currentConfig)) {
          currentConfig = nextCfg;
          applyUpdate(true);
        }
      }
    };
    window.addEventListener("spillhjornet:characterUpdated", handleGlobalUpdate);

    return {
      widgetId,
      getConfig: () => ({ ...currentConfig }),
      setConfig: (newCfg, silent = false) => {
        const parsed = parseConfig(newCfg);
        if (encodeConfig(parsed) === encodeConfig(currentConfig)) return;
        currentConfig = parsed;
        applyUpdate(silent);
      },
      setDisabledColors: (newDisabled) => {
        disabledColorsMap = normalizeDisabledMap(newDisabled);
        refreshColorDots();
      },
      getDisabledColors: () => ({ ...disabledColorsMap }),
      randomize: () => {
        currentConfig = getRandomConfig({ excludeColors: Object.keys(disabledColorsMap) });
        applyUpdate(false);
      },
      destroy: () => {
        window.removeEventListener("spillhjornet:characterUpdated", handleGlobalUpdate);
      }
    };
  }

  /**
   * Character Customizer Modal
   */
  function openModal({ initialConfig, title = "Tilpass din spillfigur", onSave, onCancel } = {}) {
    const existing = document.getElementById("ntnuCharacterCreatorModal");
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.id = "ntnuCharacterCreatorModal";
    modal.className = "cc-modal-backdrop";

    modal.innerHTML = `
      <div class="skribbl-modal-card" role="dialog" aria-modal="true" aria-labelledby="skribblModalTitle">
        <div class="skribbl-modal-header">
          <div class="skribbl-modal-title-group">
            <span class="skribbl-modal-badge">🎨 Karakterdesigner</span>
            <h2 class="skribbl-modal-title" id="skribblModalTitle">${title}</h2>
          </div>
          <button type="button" class="cc-btn-close" id="ccBtnClose" aria-label="Lukk">&times;</button>
        </div>

        <div class="skribbl-modal-body" id="skribblModalWidgetContainer">
          <!-- Widget rendered here -->
        </div>

        <div class="skribbl-modal-footer">
          <button type="button" class="cc-btn-cancel" id="ccBtnCancel">Avbryt</button>
          <button type="button" class="cc-btn-save" id="ccBtnSave">
            ✓ Bruk denne figuren
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const widgetContainer = modal.querySelector("#skribblModalWidgetContainer");
    let activeConfig = parseConfig(initialConfig || getSavedCharacter());

    const widget = renderSkribblWidget(widgetContainer, {
      initialConfig: activeConfig,
      onChange: (encoded, dataUrl, cfg) => {
        activeConfig = cfg;
      }
    });

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        closeModal();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    const closeModal = () => {
      document.removeEventListener("keydown", onKeyDown);
      modal.classList.add("closing");
      setTimeout(() => modal.remove(), 200);
      if (onCancel) onCancel();
    };

    modal.querySelector("#ccBtnClose").addEventListener("click", closeModal);
    modal.querySelector("#ccBtnCancel").addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });

    modal.querySelector("#ccBtnSave").addEventListener("click", async () => {
      document.removeEventListener("keydown", onKeyDown);
      const cfg = widget ? widget.getConfig() : activeConfig;
      const dataUrl = await getDataUrl(cfg);
      const encoded = saveCharacter(cfg, dataUrl);
      if (onSave) onSave(cfg, dataUrl, encoded);
      modal.remove();
    });
  }

  // Preload immediately if in browser
  if (typeof window !== "undefined") {
    preloadAllAssets();
  }

  return {
    HAIR_OPTIONS,
    EYES_OPTIONS,
    MOUTH_OPTIONS,
    HEAD_COLORS,
    DEFAULT_CONFIG,
    parseConfig,
    encodeConfig,
    getRandomConfig,
    preloadAllAssets,
    compositeCharacter,
    compositeCharacterSync,
    getDataUrl,
    getDataUrlSync,
    getAvatarImgSrc,
    getSavedCharacter,
    getSavedConfigString,
    saveCharacter,
    renderSkribblWidget,
    openModal
  };
});
