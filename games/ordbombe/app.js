/**
 * Ordbombe - Norsk Word Bomb Partyspill
 * Fast-paced Norwegian syllable party & solo survival game.
 */

(() => {
  "use strict";

  // --- AUDIO SYNTHESIZER (Web Audio API - Zero dependencies) ---
  class SoundFX {
    constructor() {
      this.ctx = null;
      this.muted = localStorage.getItem("ordbombe_sound_muted") === "true";
    }

    init() {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.ctx = new AudioContext();
        }
      }
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume();
      }
    }

    toggleMute() {
      this.muted = !this.muted;
      localStorage.setItem("ordbombe_sound_muted", String(this.muted));
      return this.muted;
    }

    tick(urgent = false) {
      if (this.muted || !this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(urgent ? 1100 : 700, this.ctx.currentTime);
      gain.gain.setValueAtTime(urgent ? 0.25 : 0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.06);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.06);
    }

    success() {
      if (this.muted || !this.ctx) return;
      const now = this.ctx.currentTime;
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);
        gain.gain.setValueAtTime(0.2, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.15);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.15);
      });
    }

    pass() {
      if (this.muted || !this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    }

    error() {
      if (this.muted || !this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.linearRampToValueAtTime(110, now + 0.18);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    }

    explosion() {
      if (this.muted || !this.ctx) return;
      const now = this.ctx.currentTime;
      // White noise burst
      const bufferSize = this.ctx.sampleRate * 0.6;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(600, now);
      filter.frequency.linearRampToValueAtTime(80, now + 0.5);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.7, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.55);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start(now);

      // Low bass thud
      const sub = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      sub.type = "sine";
      sub.frequency.setValueAtTime(140, now);
      sub.frequency.exponentialRampToValueAtTime(30, now + 0.4);
      subGain.gain.setValueAtTime(0.6, now);
      subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
      sub.connect(subGain);
      subGain.connect(this.ctx.destination);
      sub.start(now);
      sub.stop(now + 0.5);
    }

    victory() {
      if (this.muted || !this.ctx) return;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      const now = this.ctx.currentTime;
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);
        gain.gain.setValueAtTime(0.25, now + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.35);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.35);
      });
    }
  }

  const sfx = new SoundFX();

  // --- SPARKS CANVAS PARTICLE SYSTEM ---
  class SparksParticleSystem {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.particles = [];
      this.active = false;
      this.loop = this.loop.bind(this);
      requestAnimationFrame(this.loop);
    }

    start() {
      this.active = true;
    }

    stop() {
      this.active = false;
    }

    explode(count = 50) {
      const originX = this.canvas.width / 2;
      const originY = 130;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 8 + 3;
        this.particles.push({
          x: originX,
          y: originY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: Math.random() * 5 + 3,
          color: ["#ffd166", "#ff9f1c", "#ef476f", "#ffffff"][Math.floor(Math.random() * 4)],
          life: 1.0,
          decay: Math.random() * 0.03 + 0.02,
        });
      }
    }

    loop() {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      if (this.active) {
        // Emit fuse ember sparks from top-right of bomb
        // Bomb center: width / 2. Fuse tip offset ~ (+20px, 45px)
        const fuseX = this.canvas.width / 2 + 22;
        const fuseY = 65;

        for (let i = 0; i < 3; i++) {
          const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
          const speed = Math.random() * 3 + 1.5;
          this.particles.push({
            x: fuseX,
            y: fuseY,
            vx: Math.cos(angle) * speed + (Math.random() - 0.5),
            vy: Math.sin(angle) * speed - Math.random() * 1.5,
            size: Math.random() * 3 + 1.5,
            color: Math.random() > 0.4 ? "#ffd166" : "#ff9f1c",
            life: 1.0,
            decay: Math.random() * 0.04 + 0.03,
          });
        }
      }

      // Update and draw
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08; // Gravity
        p.life -= p.decay;

        if (p.life <= 0) {
          this.particles.splice(i, 1);
          continue;
        }

        this.ctx.save();
        this.ctx.globalAlpha = p.life;
        this.ctx.fillStyle = p.color;
        this.ctx.shadowColor = p.color;
        this.ctx.shadowBlur = 6;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
      }

      requestAnimationFrame(this.loop);
    }
  }

  // Fallback prompts if offline / initial cache
  const FALLBACK_PROMPTS = {
    easy: [
      "ST", "SK", "SP", "TR", "BL", "FL", "KL", "GR", "BR", "PR", "DR", "KN",
      "RE", "TE", "LE", "SE", "NE", "DE", "ME", "VE", "AN", "EN", "IN", "ON",
      "BIL", "TAK", "LYS", "HUS", "MAN", "FOR", "ING", "KOM", "TID", "SOL"
    ],
    medium: [
      "FIS", "BOK", "BAR", "VAN", "KOR", "VIN", "MAT", "VEI", "DAG", "LIV",
      "BYG", "GAT", "KIR", "SKO", "TOG", "VÅR", "HØS", "SOM", "SNØ", "HAV",
      "BÅT", "FLY", "BUS", "SYK", "LEK", "MOR", "FAR", "VEN", "GUT", "DRA",
      "STA", "SKA", "KLA", "SLA", "KRA", "BLA", "FLA", "GRA", "BRA", "TRE"
    ],
    hard: [
      "KNU", "BAM", "HJEL", "GNIS", "KVI", "PYN", "SKV", "FRØ", "SNU", "STØ",
      "DRØ", "TRØ", "BRØ", "FLØ", "KLØ", "GLØ", "SLØ", "BLØ", "SMØ", "SPØ",
      "VÆR", "BÆR", "TÆR", "LÆR", "SÆR", "NÆR", "FÆR", "MÆR", "KNA", "KNE"
    ]
  };

  // State
  const state = {
    isPlaying: false,
    mode: "party", // "party" | "solo"
    difficulty: "medium", // "easy" | "medium" | "hard"
    turnDuration: 6, // seconds
    players: [],
    activePlayerIndex: 0,
    currentPrompt: "BIL",
    usedWords: new Set(),
    timerRemaining: 6.0,
    timerInterval: null,
    isExploding: false,
    soloScore: 0,
    soloStreak: 0,
    soloMaxStreak: 0,
    soloWordsCount: 0,
    soloLongestWord: "",
    soloName: "Spiller 1",

    // Room Multiplayer Mode
    isRoomMode: false,
    roomCode: null,
    playerId: null,
    isHost: false,
    roomVersion: 0,
    lastHandledEventTimestamp: 0,
    currentTyping: "",
    typingThrottleTimer: null,
    lastTypingSentTime: 0,
    lastRoomPlayers: [],
    currentRoomStatus: "idle",
    lastRoomActivePlayerId: null,
    lastRoomPrompt: null,
  };

  // DOM Elements
  const el = {
    appShell: document.getElementById("appShell"),
    headerBackLink: document.getElementById("headerBackLink"),
    headerRoomBadge: document.getElementById("headerRoomBadge"),
    btnSoundToggle: document.getElementById("btnSoundToggle"),
    soundIcon: document.getElementById("soundIcon"),
    btnHelp: document.getElementById("btnHelp"),
    helpModal: document.getElementById("helpModal"),
    btnCloseHelp: document.getElementById("btnCloseHelp"),

    // Setup Card
    setupCard: document.getElementById("setupCard"),
    tabPartyMode: document.getElementById("tabPartyMode"),
    tabSoloMode: document.getElementById("tabSoloMode"),
    partySettingsBlock: document.getElementById("partySettingsBlock"),
    soloSettingsBlock: document.getElementById("soloSettingsBlock"),
    playerCountSelector: document.getElementById("playerCountSelector"),
    playersInputsList: document.getElementById("playersInputsList"),
    selectTimerDifficulty: document.getElementById("selectTimerDifficulty"),
    selectPromptDifficulty: document.getElementById("selectPromptDifficulty"),
    inputSoloName: document.getElementById("inputSoloName"),
    selectSoloDifficulty: document.getElementById("selectSoloDifficulty"),
    soloBestScore: document.getElementById("soloBestScore"),
    soloBestStreak: document.getElementById("soloBestStreak"),
    btnStartGame: document.getElementById("btnStartGame"),

    // Game Arena
    gameArena: document.getElementById("gameArena"),
    activeTurnCard: document.getElementById("activeTurnCard"),
    turnAvatar: document.getElementById("turnAvatar"),
    turnOverline: document.getElementById("turnOverline"),
    turnPlayerName: document.getElementById("turnPlayerName"),
    activeHeartsBox: document.getElementById("activeHeartsBox"),
    soloScoreDisplay: document.getElementById("soloScoreDisplay"),
    arenaScoreNum: document.getElementById("arenaScoreNum"),
    arenaStreakBadge: document.getElementById("arenaStreakBadge"),

    circularArenaWrapper: document.getElementById("circularArenaWrapper"),
    arenaPointerLayer: document.getElementById("arenaPointerLayer"),
    arenaPointerArrow: document.getElementById("arenaPointerArrow"),
    circlePlayersContainer: document.getElementById("circlePlayersContainer"),
    bombCenterHub: document.getElementById("bombCenterHub"),
    bombGraphic: document.getElementById("bombGraphic"),
    bombSparksCanvas: document.getElementById("bombSparksCanvas"),
    promptLetters: document.getElementById("promptLetters"),

    wordForm: document.getElementById("wordForm"),
    wordInput: document.getElementById("wordInput"),
    btnSubmitWord: document.getElementById("btnSubmitWord"),
    inputFeedback: document.getElementById("inputFeedback"),
    usedWordsContainer: document.getElementById("usedWordsContainer"),
    usedWordsCount: document.getElementById("usedWordsCount"),
    usedWordsList: document.getElementById("usedWordsList"),

    // Game Over Card
    gameOverCard: document.getElementById("gameOverCard"),
    victoryIconWrap: document.getElementById("victoryIconWrap"),
    gameOverBadge: document.getElementById("gameOverBadge"),
    gameOverTitle: document.getElementById("gameOverTitle"),
    gameOverSubtitle: document.getElementById("gameOverSubtitle"),
    partyStandingsBox: document.getElementById("partyStandingsBox"),
    partyStandingsList: document.getElementById("partyStandingsList"),
    soloSummaryBox: document.getElementById("soloSummaryBox"),
    endScoreNum: document.getElementById("endScoreNum"),
    endStreakNum: document.getElementById("endStreakNum"),
    endWordsCount: document.getElementById("endWordsCount"),
    btnPlayAgain: document.getElementById("btnPlayAgain"),
    btnChangeSettings: document.getElementById("btnChangeSettings"),
    btnBackToLobby: document.getElementById("btnBackToLobby"),
  };

  const sparks = new SparksParticleSystem(el.bombSparksCanvas);

  // Initialize Sound toggle icon
  function updateSoundIcon() {
    el.soundIcon.textContent = sfx.muted ? "🔇" : "🔊";
    el.btnSoundToggle.title = sfx.muted ? "Slå på lyd" : "Slå av lyd";
  }
  updateSoundIcon();

  // Setup player name inputs in party settings
  function renderPlayerNameInputs(count) {
    el.playersInputsList.innerHTML = "";
    const defaultNames = ["Mats", "Henrik", "Ingrid", "Sander", "Julie", "Emil", "Thea", "Jonas"];
    for (let i = 0; i < count; i++) {
      const chip = document.createElement("div");
      chip.className = "player-input-chip";
      const name = defaultNames[i] || `Spiller ${i + 1}`;
      chip.innerHTML = `
        <span class="player-chip-num">#${i + 1}</span>
        <input type="text" class="player-name-input" data-index="${i}" value="${name}" maxlength="18" placeholder="Spiller ${i + 1}" />
      `;
      el.playersInputsList.appendChild(chip);
    }
  }
  renderPlayerNameInputs(3);

  // Load Solo personal best
  function loadSoloBest() {
    const bestScore = localStorage.getItem("ordbombe_solo_best_score") || "0";
    const bestStreak = localStorage.getItem("ordbombe_solo_best_streak") || "0";
    el.soloBestScore.textContent = `${Number(bestScore).toLocaleString("no-NO")} poeng`;
    el.soloBestStreak.textContent = `${bestStreak} ord`;
  }
  loadSoloBest();

  // Mode Tabs Switching
  el.tabPartyMode.addEventListener("click", () => {
    state.mode = "party";
    el.tabPartyMode.classList.add("active");
    el.tabSoloMode.classList.remove("active");
    el.partySettingsBlock.classList.remove("hidden");
    el.soloSettingsBlock.classList.add("hidden");
  });

  el.tabSoloMode.addEventListener("click", () => {
    state.mode = "solo";
    el.tabSoloMode.classList.add("active");
    el.tabPartyMode.classList.remove("active");
    el.soloSettingsBlock.classList.remove("hidden");
    el.partySettingsBlock.classList.add("hidden");
  });

  // Player count button clicks
  el.playerCountSelector.addEventListener("click", (e) => {
    const btn = e.target.closest(".count-btn");
    if (!btn) return;
    el.playerCountSelector.querySelectorAll(".count-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const count = parseInt(btn.dataset.count, 10);
    renderPlayerNameInputs(count);
  });

  // Fetch or get prompt
  async function fetchNewPrompt() {
    try {
      const res = await fetch(`/api/ordbombe/prompt?difficulty=${encodeURIComponent(state.difficulty)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.prompt) {
          state.currentPrompt = data.prompt.toUpperCase();
          el.promptLetters.textContent = state.currentPrompt;
          return;
        }
      }
    } catch (e) {
      console.warn("Bruker fallback-prompts:", e);
    }

    const pool = FALLBACK_PROMPTS[state.difficulty] || FALLBACK_PROMPTS.medium;
    let nextP = pool[Math.floor(Math.random() * pool.length)];
    if (nextP === state.currentPrompt && pool.length > 1) {
      nextP = pool[(pool.indexOf(nextP) + 1) % pool.length];
    }
    state.currentPrompt = nextP.toUpperCase();
    el.promptLetters.textContent = state.currentPrompt;
  }

  // Update hearts UI
  function renderHearts(container, lives, maxLives = 3) {
    if (!container) return;
    container.innerHTML = "";
    for (let i = 0; i < maxLives; i++) {
      const span = document.createElement("span");
      span.className = `heart ${i < lives ? "active" : "lost"}`;
      span.textContent = "❤️";
      container.appendChild(span);
    }
  }

  // --- CIRCULAR ARENA & ARROW POINTER SYSTEM ---
  const DEFAULT_AVATARS = ["charbear", "jormundgandr", "pixiu", "squitonkey", "tanuki", "totter"];

  function getUserDefaultAvatar() {
    if (window.CharacterCreator && typeof window.CharacterCreator.getSavedConfigString === "function") {
      return window.CharacterCreator.getSavedConfigString();
    }
    return "charbear";
  }

  function renderAvatarHtml(avatar) {
    if (avatar === "💀") return `<span class="skull-emoji">💀</span>`;
    if (window.CharacterCreator && typeof window.CharacterCreator.getAvatarImgSrc === "function") {
      const src = window.CharacterCreator.getAvatarImgSrc(avatar);
      return `<img src="${src}" alt="Spillerfigur" class="player-mon-img" />`;
    }
    const monIds = ["charbear", "jormundgandr", "pixiu", "squitonkey", "tanuki", "totter"];
    if (avatar && (monIds.includes(avatar) || avatar.endsWith(".png") || avatar.startsWith("data:"))) {
      const src = (avatar.endsWith(".png") || avatar.startsWith("data:")) ? avatar : `/assets/mons/${avatar}.png`;
      return `<img src="${src}" alt="Monster" class="player-mon-img" />`;
    }
    return `<span class="avatar-fallback">${avatar || "👤"}</span>`;
  }

  let currentArrowAngle = 0;

  function setArrowAngle(targetDeg) {
    const layer = el.arenaPointerLayer || el.arenaPointerArrow;
    if (!layer) return;

    // Calculate shortest angular difference so rotation never loops awkwardly backward
    const currentNorm = ((currentArrowAngle % 360) + 360) % 360;
    const targetNorm = ((targetDeg % 360) + 360) % 360;
    let diff = targetNorm - currentNorm;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    currentArrowAngle += diff;

    // Concentric pure rotation around exact center 50% 50%
    layer.style.transform = `rotate(${currentArrowAngle}deg)`;
  }

  // Render players placed evenly in a circle around the bomb hub
  function renderCircularPlayers(playersList, activeIndexOrId) {
    if (!el.circlePlayersContainer) return;
    el.circlePlayersContainer.innerHTML = "";

    const list = playersList || (state.mode === "party" ? state.players : [
      { name: state.soloName, lives: state.players[0]?.lives ?? 3, eliminated: false, avatar: getUserDefaultAvatar() }
    ]);

    const total = list.length;
    if (total === 0) return;

    // 38% radius puts player nodes comfortably along the outer circular ring with ample room for bubbles
    const radiusPct = total === 1 ? 0 : 38;

    list.forEach((p, idx) => {
      const isActive = typeof activeIndexOrId === "number"
        ? idx === activeIndexOrId
        : (p.id ? p.id === activeIndexOrId : idx === state.activePlayerIndex);

      // Angle: 0 degrees is 12 o'clock (top)
      const angleDeg = total === 1 ? 0 : (idx / total) * 360;
      const angleRad = (angleDeg - 90) * (Math.PI / 180);

      // In Solo mode, single player is pinned at top center (50%, 14%)
      const leftPct = total === 1 ? 50 : 50 + radiusPct * Math.cos(angleRad);
      const topPct = total === 1 ? 14 : 50 + radiusPct * Math.sin(angleRad);

      const node = document.createElement("div");
      node.className = `circle-player-node ${isActive ? "is-active-turn" : ""} ${p.eliminated ? "is-eliminated" : ""}`;
      node.style.left = `${leftPct.toFixed(2)}%`;
      node.style.top = `${topPct.toFixed(2)}%`;
      node.dataset.index = idx;
      if (p.id) node.dataset.id = p.id;

      const avatar = p.avatar || (p.eliminated ? "💀" : DEFAULT_AVATARS[idx % DEFAULT_AVATARS.length]);
      const lives = Math.max(0, p.lives ?? 3);
      const heartsStr = "❤️".repeat(lives) + "🖤".repeat(Math.max(0, 3 - lives));

      const isMeInNode = state.isRoomMode
        ? (p.id === state.playerId)
        : (state.mode === "party" ? isActive : true);

      node.innerHTML = `
        <div class="cp-typing-bubble ${isActive && !p.eliminated ? 'is-active' : ''}" style="${isActive && !p.eliminated ? '' : 'display:none;'}">
          <span class="cp-typing-text">${isActive && isMeInNode ? '<span class="cp-placeholder">Tast inn ord...</span>' : ''}</span>
          ${isActive && isMeInNode ? '<span class="cp-typing-cursor"></span>' : ''}
        </div>
        <div class="cp-avatar-wrap">
          ${renderAvatarHtml(avatar)}
          ${isActive && !p.eliminated ? '<span class="cp-bomb-indicator" title="Har bomben!">💣</span>' : ""}
        </div>
        <div class="cp-info">
          <span class="cp-name" title="${p.name}">${p.name}</span>
          <span class="cp-hearts" aria-label="${lives} liv">${heartsStr}</span>
        </div>
      `;

      el.circlePlayersContainer.appendChild(node);
    });
  }

  // --- REAL-TIME TYPING SYNC & DISPLAY HELPERS ---
  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatPromptMatchHtml(text, prompt) {
    if (!text) return "";
    const upperText = text.toUpperCase();
    const upperPrompt = (prompt || "").toUpperCase();
    if (upperPrompt && upperText.includes(upperPrompt)) {
      const idx = upperText.indexOf(upperPrompt);
      const before = escapeHtml(text.slice(0, idx));
      const matched = escapeHtml(text.slice(idx, idx + upperPrompt.length));
      const after = escapeHtml(text.slice(idx + upperPrompt.length));
      return `${before}<span class="prompt-match-highlight">${matched}</span>${after}`;
    }
    return escapeHtml(text);
  }

  function updateTypingUI(rawText, prompt, isMyTurn, activeName, activeAvatar) {
    const clean = (rawText || "").trim();
    const upperPrompt = (prompt || state.currentPrompt || "").toUpperCase();
    const hasMatch = upperPrompt && clean.toUpperCase().includes(upperPrompt);

    // 1. Update Floating Speech Bubble on Active Circle Player Node
    const activeNode = el.circlePlayersContainer ? el.circlePlayersContainer.querySelector(".circle-player-node.is-active-turn") : null;
    if (activeNode) {
      let bubble = activeNode.querySelector(".cp-typing-bubble");
      if (!bubble) {
        bubble = document.createElement("div");
        bubble.className = "cp-typing-bubble is-active";
        bubble.innerHTML = '<span class="cp-typing-text"></span><span class="cp-typing-cursor"></span>';
        activeNode.prepend(bubble);
      }

      if (hasMatch && clean) {
        bubble.classList.add("has-match");
      } else {
        bubble.classList.remove("has-match");
      }

      const textEl = bubble.querySelector(".cp-typing-text");
      let cursorEl = bubble.querySelector(".cp-typing-cursor");

      if (textEl) {
        if (clean) {
          textEl.innerHTML = formatPromptMatchHtml(clean.toUpperCase(), upperPrompt);
        } else if (isMyTurn) {
          textEl.innerHTML = '<span class="cp-placeholder">Tast inn ord...</span>';
        } else {
          textEl.innerHTML = '<span class="cp-dots"><span>•</span><span>•</span><span>•</span></span>';
        }
      }

      if (!cursorEl && isMyTurn) {
        cursorEl = document.createElement("span");
        cursorEl.className = "cp-typing-cursor";
        bubble.appendChild(cursorEl);
      } else if (cursorEl && !isMyTurn) {
        cursorEl.remove();
      }

      bubble.style.display = "";
    }

    // 2. Spectator handling
    if (!isMyTurn && el.wordInput) {
      el.wordInput.value = "";
      el.wordInput.disabled = true;
    }
  }

  function sendTypingToServer(text) {
    if (!state.isRoomMode || !state.roomCode || !state.playerId) return;

    const now = Date.now();
    if (state.typingThrottleTimer) {
      clearTimeout(state.typingThrottleTimer);
      state.typingThrottleTimer = null;
    }

    const doSend = async (val) => {
      state.lastTypingSentTime = Date.now();
      try {
        await fetch("/api/party/ordbombe/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: state.roomCode,
            playerId: state.playerId,
            action: "typing",
            text: val,
          }),
        });
      } catch (e) {
        // Ignore network noise
      }
    };

    if (now - state.lastTypingSentTime > 85) {
      doSend(text);
    } else {
      state.typingThrottleTimer = setTimeout(() => {
        doSend(text);
      }, 85);
    }
  }

  // Smoothly rotate the central pointer arrow toward the active player
  function rotateArrowToActive(playersList, activeIndexOrId) {
    if (!el.arenaPointerArrow) return;
    const list = playersList || (state.mode === "party" ? state.players : [state.players[0]]);
    const total = list.length;
    if (total <= 1) {
      setArrowAngle(0);
      return;
    }

    let activeIdx = 0;
    if (typeof activeIndexOrId === "number") {
      activeIdx = activeIndexOrId;
    } else {
      activeIdx = list.findIndex(p => p.id === activeIndexOrId);
      if (activeIdx === -1) activeIdx = 0;
    }

    const targetDeg = (activeIdx / total) * 360;
    setArrowAngle(targetDeg);
  }

  // Start new round
  async function startGame() {
    sfx.init();

    // Mode-specific initialization
    if (state.mode === "party") {
      state.turnDuration = parseFloat(el.selectTimerDifficulty.value) || 6;
      state.difficulty = el.selectPromptDifficulty.value || "medium";

      const inputs = el.playersInputsList.querySelectorAll(".player-name-input");
      state.players = [];
      inputs.forEach((inp, idx) => {
        const name = inp.value.trim() || `Spiller ${idx + 1}`;
        state.players.push({
          name: name,
          lives: 3,
          eliminated: false,
          wordsCount: 0,
          avatar: DEFAULT_AVATARS[idx % DEFAULT_AVATARS.length],
        });
      });
      state.activePlayerIndex = 0;
      el.soloScoreDisplay.classList.add("hidden");
    } else {
      // Solo mode
      state.soloName = el.inputSoloName.value.trim() || "Spiller 1";
      state.difficulty = el.selectSoloDifficulty.value || "medium";
      state.turnDuration = 10;
      state.soloScore = 0;
      state.soloStreak = 0;
      state.soloMaxStreak = 0;
      state.soloWordsCount = 0;
      state.soloLongestWord = "";

      state.players = [{
        name: state.soloName,
        lives: 3,
        eliminated: false,
        wordsCount: 0,
        avatar: getUserDefaultAvatar(),
      }];
      state.activePlayerIndex = 0;

      el.soloScoreDisplay.classList.remove("hidden");
      el.arenaScoreNum.textContent = "0";
      el.arenaStreakBadge.textContent = "x1";
    }

    state.usedWords.clear();
    el.usedWordsCount.textContent = "0";
    el.usedWordsList.innerHTML = "";
    el.inputFeedback.className = "input-feedback hidden";

    // Switch view
    el.setupCard.classList.add("hidden");
    el.gameOverCard.classList.add("hidden");
    el.gameArena.classList.remove("hidden");
    state.isPlaying = true;

    await fetchNewPrompt();
    startTurn();
  }

  function ensureInputFocus() {
    if (el.helpModal && !el.helpModal.classList.contains("hidden")) return;
    if (el.gameOverCard && !el.gameOverCard.classList.contains("hidden")) return;
    if (el.gameArena && el.gameArena.classList.contains("hidden")) return;
    if (!state.isPlaying) return;

    const isMyTurn = state.isRoomMode
      ? (state.lastRoomState?.status === "playing" && state.lastRoomState?.active_player_id === state.playerId)
      : (state.mode === "party" ? !state.players[state.activePlayerIndex]?.eliminated : true);

    if (isMyTurn && el.wordInput) {
      if (el.wordInput.disabled) el.wordInput.disabled = false;
      if (document.activeElement !== el.wordInput) {
        try {
          el.wordInput.focus({ preventScroll: true });
        } catch (e) {
          el.wordInput.focus();
        }
      }
    }
  }

  // Start a turn
  function startTurn() {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }

    state.isExploding = false;
    el.appShell.classList.remove("exploded");
    if (el.bombCenterHub) el.bombCenterHub.classList.remove("ticking-panic");
    if (el.bombGraphic) el.bombGraphic.classList.remove("ticking-panic");
    if (el.arenaPointerArrow) el.arenaPointerArrow.classList.remove("ticking-panic");

    // In solo mode, duration tightens as streak grows
    if (state.mode === "solo") {
      state.timerRemaining = Math.max(4.2, 10.0 - state.soloStreak * 0.35);
    } else {
      state.timerRemaining = state.turnDuration;
    }

    const curPlayer = state.players[state.activePlayerIndex];
    if (state.mode === "party") {
      el.turnPlayerName.textContent = curPlayer.name;
      el.turnOverline.textContent = "Pil peker på:";
      el.turnAvatar.innerHTML = renderAvatarHtml(curPlayer.avatar || DEFAULT_AVATARS[state.activePlayerIndex % DEFAULT_AVATARS.length]);
      renderHearts(el.activeHeartsBox, curPlayer.lives);
      renderCircularPlayers();
      rotateArrowToActive();
    } else {
      el.turnPlayerName.textContent = state.soloName;
      el.turnOverline.textContent = "Solomodus:";
      el.turnAvatar.innerHTML = renderAvatarHtml(getUserDefaultAvatar());
      renderHearts(el.activeHeartsBox, curPlayer.lives);
      renderCircularPlayers();
      rotateArrowToActive();
    }

    updateTimerDisplay();
    sparks.start();

    // Focus input
    el.wordInput.disabled = false;
    if (el.btnSubmitWord) el.btnSubmitWord.disabled = false;
    el.wordInput.value = "";
    el.wordInput.className = "word-input-headless";
    ensureInputFocus();
    state.currentTyping = "";
    updateTypingUI(
      "",
      state.currentPrompt,
      true,
      state.mode === "party" ? curPlayer.name : state.soloName,
      state.mode === "party" ? (curPlayer.avatar || DEFAULT_AVATARS[state.activePlayerIndex % DEFAULT_AVATARS.length]) : getUserDefaultAvatar()
    );

    // Tick loop every 100ms
    const startTime = performance.now();
    const initialDuration = state.timerRemaining;
    let lastSecondInt = Math.ceil(initialDuration);

    state.timerInterval = setInterval(() => {
      const elapsed = (performance.now() - startTime) / 1000;
      state.timerRemaining = Math.max(0, initialDuration - elapsed);

      const currentSecondInt = Math.ceil(state.timerRemaining);
      if (currentSecondInt !== lastSecondInt && state.timerRemaining > 0) {
        lastSecondInt = currentSecondInt;
        sfx.tick(state.timerRemaining <= 3.2);
      }

      updateTimerDisplay();

      if (state.timerRemaining <= 0) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
        triggerExplosion();
      }
    }, 100);
  }

  function updateTimerDisplay() {
    // NO visible countdown numbers or progress bars!
    // The player relies entirely on ticking audio cues and bomb panic shaking.
    const isPanic = state.timerRemaining <= 3.2 && state.timerRemaining > 0;
    if (isPanic) {
      if (el.bombCenterHub) el.bombCenterHub.classList.add("ticking-panic");
      if (el.bombGraphic) el.bombGraphic.classList.add("ticking-panic");
      if (el.arenaPointerArrow) el.arenaPointerArrow.classList.add("ticking-panic");
    } else {
      if (el.bombCenterHub) el.bombCenterHub.classList.remove("ticking-panic");
      if (el.bombGraphic) el.bombGraphic.classList.remove("ticking-panic");
      if (el.arenaPointerArrow) el.arenaPointerArrow.classList.remove("ticking-panic");
    }
  }

  // Trigger bomb explosion
  function triggerExplosion() {
    if (state.isExploding) return;
    state.isExploding = true;

    const curPlayer = state.players[state.activePlayerIndex] || {
      name: state.soloName || "Spiller",
      avatar: "👤",
      lives: 3,
      wordsCount: 0,
      eliminated: false,
    };

    sparks.stop();
    sparks.explode(60);
    sfx.explosion();

    el.appShell.classList.add("exploded");
    if (el.bombCenterHub) {
      el.bombCenterHub.classList.add("exploding");
      setTimeout(() => el.bombCenterHub.classList.remove("exploding"), 1200);
    }
    el.wordInput.disabled = true;
    if (el.btnSubmitWord) el.btnSubmitWord.disabled = true;
    el.wordInput.value = "";
    state.currentTyping = "";
    updateTypingUI(
      "💥 BOOM!",
      state.currentPrompt,
      false,
      curPlayer.name,
      curPlayer.avatar || "👤"
    );

    curPlayer.lives--;

    if (state.mode === "party") {
      renderHearts(el.activeHeartsBox, curPlayer.lives);
      renderCircularPlayers();

      showFeedback(`💥 BOOM! Tiden gikk ut for ${curPlayer.name}! (-1 ❤️)`, "error");

      if (curPlayer.lives <= 0) {
        curPlayer.eliminated = true;
      }

      // Check remaining living players
      const livingPlayers = state.players.filter(p => !p.eliminated);
      if (livingPlayers.length <= 1) {
        setTimeout(() => finishGame(), 1600);
        return;
      }

      // Advance to next living player
      advanceToNextPlayer();
      setTimeout(async () => {
        el.wordInput.disabled = false;
        if (el.btnSubmitWord) el.btnSubmitWord.disabled = false;
        await fetchNewPrompt();
        startTurn();
      }, 1600);

    } else {
      // Solo mode
      state.soloStreak = 0;
      el.arenaStreakBadge.textContent = "x1";
      renderHearts(el.activeHeartsBox, curPlayer.lives);
      showFeedback(`💥 BOOM! Bomben smalt! (-1 ❤️)`, "error");

      if (curPlayer.lives <= 0) {
        setTimeout(() => finishGame(), 1500);
        return;
      }

      setTimeout(async () => {
        el.wordInput.disabled = false;
        if (el.btnSubmitWord) el.btnSubmitWord.disabled = false;
        await fetchNewPrompt();
        startTurn();
      }, 1500);
    }
  }

  function advanceToNextPlayer() {
    const total = state.players.length;
    for (let i = 1; i <= total; i++) {
      const nextIdx = (state.activePlayerIndex + i) % total;
      if (!state.players[nextIdx].eliminated) {
        state.activePlayerIndex = nextIdx;
        return;
      }
    }
  }

  let feedbackTimer = null;
  function showFeedback(text, type = "ok") {
    if (!el.inputFeedback) return;
    if (feedbackTimer) clearTimeout(feedbackTimer);
    el.inputFeedback.textContent = text;
    el.inputFeedback.className = `arena-feedback-pill ${type}`;
    el.inputFeedback.classList.remove("hidden");
    feedbackTimer = setTimeout(() => {
      if (el.inputFeedback) el.inputFeedback.classList.add("hidden");
    }, 2800);
  }

  function triggerBubbleError(msg) {
    sfx.error();
    const activeNode = el.circlePlayersContainer?.querySelector(".circle-player-node.is-active-turn");
    const bubble = activeNode?.querySelector(".cp-typing-bubble");
    if (bubble) {
      bubble.classList.remove("shake", "success");
      void bubble.offsetWidth; // Force CSS reflow to re-trigger animation
      bubble.classList.add("shake");
      setTimeout(() => bubble.classList.remove("shake"), 450);
    }
    if (msg) showFeedback(msg, "error");
    ensureInputFocus();
  }

  function triggerBubbleSuccess(msg) {
    sfx.success();
    const activeNode = el.circlePlayersContainer?.querySelector(".circle-player-node.is-active-turn");
    const bubble = activeNode?.querySelector(".cp-typing-bubble");
    if (bubble) {
      bubble.classList.remove("shake", "success");
      void bubble.offsetWidth;
      bubble.classList.add("success");
      setTimeout(() => bubble.classList.remove("success"), 500);
    }
    if (msg) showFeedback(msg, "ok");
  }

  // Handle word submission
  async function submitWord(e) {
    if (e) e.preventDefault();
    if (state.isExploding || state.timerRemaining <= 0) return;

    const rawWord = (el.wordInput.value || "").trim().toLowerCase();
    const prompt = (state.currentPrompt || "").toLowerCase();

    if (!rawWord) {
      triggerBubbleError("");
      return;
    }

    if (rawWord.length < 2) {
      triggerBubbleError("Ordet må ha minst 2 bokstaver");
      return;
    }

    if (!rawWord.includes(prompt)) {
      triggerBubbleError(`Ordet må inneholde «${state.currentPrompt}»!`);
      return;
    }

    if (state.isRoomMode) {
      try {
        const resp = await fetch("/api/party/ordbombe/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: state.roomCode,
            playerId: state.playerId,
            action: "submit_word",
            word: rawWord,
          }),
        });
        const res = await resp.json();
        if (res.ok && res.valid) {
          triggerBubbleSuccess(`✓ Godkjent: «${rawWord}»!`);
          el.wordInput.value = "";
          state.currentTyping = "";
          updateTypingUI("", state.currentPrompt, false);
          sendTypingToServer("");
        } else {
          triggerBubbleError(res.reason || res.error || "Ugyldig ord");
        }
      } catch (err) {
        triggerBubbleError("Nettverksfeil");
      }
      return;
    }

    if (state.usedWords.has(rawWord)) {
      triggerBubbleError(`«${rawWord}» er allerede brukt i denne runden!`);
      return;
    }

    // Validate with backend dictionary
    let isValid = false;
    let matchHighlight = null;

    try {
      const res = await fetch(`/api/ordbombe/check?word=${encodeURIComponent(rawWord)}&prompt=${encodeURIComponent(prompt)}`);
      if (res.ok) {
        const data = await res.json();
        isValid = data.valid;
        matchHighlight = data.highlight;
        if (!isValid) {
          triggerBubbleError(data.reason || `«${rawWord}» finnes ikke i den norske ordboka`);
          return;
        }
      } else {
        isValid = true; // Fallback if server error
      }
    } catch (err) {
      console.warn("Nettverksfeil ved ordboksjekk:", err);
      isValid = true;
    }

    if (!isValid) return;

    // WORD IS VALID!
    clearInterval(state.timerInterval);
    state.timerInterval = null;

    triggerBubbleSuccess(`✓ «${rawWord}» godkjent!`);
    el.wordInput.value = "";
    state.currentTyping = "";

    // Add to used words list
    state.usedWords.add(rawWord);
    el.usedWordsCount.textContent = String(state.usedWords.size);

    const chip = document.createElement("span");
    chip.className = "used-word-chip";
    const startIdx = rawWord.indexOf(prompt);
    if (startIdx !== -1) {
      const before = rawWord.slice(0, startIdx);
      const match = rawWord.slice(startIdx, startIdx + prompt.length);
      const after = rawWord.slice(startIdx + prompt.length);
      chip.innerHTML = `${before}<span class="match-highlight">${match.toUpperCase()}</span>${after}`;
    } else {
      chip.textContent = rawWord;
    }
    el.usedWordsList.prepend(chip);

    const curPlayer = state.players[state.activePlayerIndex];
    curPlayer.wordsCount++;

    if (state.mode === "party") {
      sfx.pass();
      advanceToNextPlayer();
      setTimeout(async () => {
        el.wordInput.classList.remove("success");
        await fetchNewPrompt();
        startTurn();
      }, 350);

    } else {
      // Solo mode score calculation
      state.soloWordsCount++;
      state.soloStreak++;
      if (state.soloStreak > state.soloMaxStreak) {
        state.soloMaxStreak = state.soloStreak;
      }
      if (rawWord.length > state.soloLongestWord.length) {
        state.soloLongestWord = rawWord;
      }

      const multiplier = Math.min(Math.floor(state.soloStreak / 3) + 1, 5);
      const points = rawWord.length * 40 * multiplier;
      state.soloScore += points;

      el.arenaScoreNum.textContent = Number(state.soloScore).toLocaleString("no-NO");
      el.arenaStreakBadge.textContent = `x${multiplier} (${state.soloStreak}🔥)`;

      setTimeout(async () => {
        el.wordInput.classList.remove("success");
        await fetchNewPrompt();
        startTurn();
      }, 350);
    }
  }

  // Finish Game (Victory or Solo game over)
  function finishGame() {
    state.isPlaying = false;
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
    sparks.stop();

    el.gameArena.classList.add("hidden");
    el.gameOverCard.classList.remove("hidden");

    if (state.mode === "party") {
      sfx.victory();
      const livingPlayers = state.players.filter(p => !p.eliminated);
      const winner = livingPlayers[0] || state.players[0];

      el.victoryIconWrap.textContent = "👑";
      el.gameOverBadge.textContent = "RUNDEN ER AVGJORT";
      el.gameOverTitle.textContent = `${winner.name} vant Ordbombe!`;
      el.gameOverSubtitle.textContent = `Siste overlevende spiller med ${winner.wordsCount} godkjente ord! Gratulerer!`;

      el.partyStandingsBox.classList.remove("hidden");
      el.soloSummaryBox.classList.add("hidden");

      el.partyStandingsList.innerHTML = "";
      // Sort: living first, then by words count
      const sorted = [...state.players].sort((a, b) => {
        if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
        return b.wordsCount - a.wordsCount;
      });

      sorted.forEach((p, rank) => {
        const row = document.createElement("div");
        row.className = `standing-row ${!p.eliminated ? "winner" : ""}`;
        row.innerHTML = `
          <div class="standing-name">
            <span>${rank === 0 ? "🥇" : rank === 1 ? "🥈" : rank === 2 ? "🥉" : "💀"}</span>
            <strong>${p.name}</strong>
          </div>
          <div class="standing-badge">
            ${p.eliminated ? "Utslått" : "🏆 Overlevde!"} (${p.wordsCount} ord)
          </div>
        `;
        el.partyStandingsList.appendChild(row);
      });

    } else {
      // Solo mode
      el.victoryIconWrap.textContent = "⚡";
      el.gameOverBadge.textContent = "SOLO GAME OVER";
      el.gameOverTitle.textContent = `${Number(state.soloScore).toLocaleString("no-NO")} poeng!`;
      el.gameOverSubtitle.textContent = `Flott innsats! Du klarte en streak på ${state.soloMaxStreak} ord på rad!`;

      el.partyStandingsBox.classList.add("hidden");
      el.soloSummaryBox.classList.remove("hidden");

      el.endScoreNum.textContent = Number(state.soloScore).toLocaleString("no-NO");
      el.endStreakNum.textContent = String(state.soloMaxStreak);
      el.endWordsCount.textContent = String(state.soloWordsCount);

      // Save highscore locally
      const prevBest = parseInt(localStorage.getItem("ordbombe_solo_best_score") || "0", 10);
      if (state.soloScore > prevBest) {
        localStorage.setItem("ordbombe_solo_best_score", String(state.soloScore));
      }
      const prevStreak = parseInt(localStorage.getItem("ordbombe_solo_best_streak") || "0", 10);
      if (state.soloMaxStreak > prevStreak) {
        localStorage.setItem("ordbombe_solo_best_streak", String(state.soloMaxStreak));
      }
      const prevHs = parseInt(localStorage.getItem("ordbombe_highscore") || "0", 10);
      if (state.soloMaxStreak > prevHs) {
        localStorage.setItem("ordbombe_highscore", String(state.soloMaxStreak));
      }
      loadSoloBest();

      // Submit highscore to backend
      fetch("/api/ordbombe/highscore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerName: state.soloName,
          score: state.soloScore,
          streak: state.soloMaxStreak,
          wordsCount: state.soloWordsCount,
        }),
      }).catch(err => console.warn("Kunne ikke lagre highscore:", err));
    }
  }

  // Event Listeners
  el.btnStartGame.addEventListener("click", startGame);
  el.wordForm.addEventListener("submit", submitWord);

  el.wordInput.addEventListener("input", () => {
    if (el.wordInput.disabled) return;
    const val = el.wordInput.value || "";
    state.currentTyping = val;

    let activeName = "Spiller";
    let activeAvatar = "👤";

    if (state.isRoomMode) {
      const activePlayer = state.lastRoomPlayers?.find(p => p.id === state.playerId);
      activeName = activePlayer ? activePlayer.name : "Du";
      activeAvatar = activePlayer ? (activePlayer.avatar || "👤") : "👤";
      sendTypingToServer(val);
    } else if (state.mode === "party") {
      const cur = state.players[state.activePlayerIndex];
      activeName = cur ? cur.name : "Spiller";
      activeAvatar = cur ? (cur.avatar || DEFAULT_AVATARS[state.activePlayerIndex % DEFAULT_AVATARS.length]) : "charbear";
    } else {
      activeName = state.soloName || "Spiller 1";
      activeAvatar = getUserDefaultAvatar();
    }

    updateTypingUI(val, state.currentPrompt, true, activeName, activeAvatar);
  });

  el.btnPlayAgain.addEventListener("click", async () => {
    if (state.isRoomMode && state.isHost) {
      const hostToken = state.hostToken || sessionStorage.getItem("party_host_token");
      if (hostToken) {
        try {
          await fetch("/api/party/ordbombe/action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              roomCode: state.roomCode,
              hostToken: hostToken,
              action: "restart",
              settings: {
                difficulty: "medium",
                turnDuration: 6.0,
              },
            }),
          });
        } catch (e) { }
      }
      return;
    }
    startGame();
  });

  el.btnChangeSettings.addEventListener("click", () => {
    el.gameOverCard.classList.add("hidden");
    el.gameArena.classList.add("hidden");
    el.setupCard.classList.remove("hidden");
  });

  el.btnSoundToggle.addEventListener("click", () => {
    sfx.init();
    sfx.toggleMute();
    updateSoundIcon();
  });

  // Help Modal
  el.btnHelp.addEventListener("click", () => el.helpModal.classList.remove("hidden"));
  el.btnCloseHelp.addEventListener("click", () => el.helpModal.classList.add("hidden"));
  el.helpModal.addEventListener("click", (e) => {
    if (e.target === el.helpModal) el.helpModal.classList.add("hidden");
  });

  window.addEventListener("keydown", (e) => {
    if (el.helpModal && !el.helpModal.classList.contains("hidden")) {
      if (e.key === "Escape") el.helpModal.classList.add("hidden");
      return;
    }
    if (el.gameArena && el.gameArena.classList.contains("hidden")) return;
    if (!state.isPlaying) return;
    if (e.key === "Escape") return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const isMyTurn = state.isRoomMode
      ? (state.lastRoomState?.status === "playing" && state.lastRoomState?.active_player_id === state.playerId)
      : (state.mode === "party" ? !state.players[state.activePlayerIndex]?.eliminated : true);

    if (!isMyTurn) return;

    if (e.key === "Enter") {
      e.preventDefault();
      submitWord(e);
      return;
    }

    if (document.activeElement !== el.wordInput && el.wordInput) {
      if (e.key === "Backspace") {
        e.preventDefault();
        el.wordInput.value = el.wordInput.value.slice(0, -1);
        el.wordInput.dispatchEvent(new Event("input", { bubbles: true }));
      } else if (e.key.length === 1) {
        e.preventDefault();
        el.wordInput.value += e.key;
        el.wordInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
      ensureInputFocus();
    }
  });

  // Keep word input ALWAYS focused and selected during active game (Desktop & Mobile)
  document.addEventListener("click", (e) => {
    if (!el.gameArena.classList.contains("hidden") && state.isPlaying) {
      if (!e.target.closest("button") && !e.target.closest("a") && !e.target.closest(".modal-backdrop") && !e.target.closest("select") && !e.target.closest("input:not(#wordInput)")) {
        ensureInputFocus();
      }
    }
  });

  document.addEventListener("touchstart", (e) => {
    if (!el.gameArena.classList.contains("hidden") && state.isPlaying) {
      if (!e.target.closest("button") && !e.target.closest("a") && !e.target.closest(".modal-backdrop") && !e.target.closest("select") && !e.target.closest("input:not(#wordInput)")) {
        ensureInputFocus();
      }
    }
  }, { passive: true });

  if (el.wordInput) {
    el.wordInput.addEventListener("blur", () => {
      setTimeout(() => {
        ensureInputFocus();
      }, 60);
    });
  }

  // --- MULTI-DEVICE ROOM SYNC ---
  async function pollRoomState() {
    if (!state.isRoomMode || !state.roomCode) return;

    try {
      const url = `/api/party/state?code=${encodeURIComponent(state.roomCode)}&playerId=${encodeURIComponent(state.playerId || "")}&v=${state.roomVersion}`;
      const resp = await fetch(url);

      if (resp.status === 404) {
        alert("Party-rommet er avsluttet.");
        window.location.href = "/party/";
        return;
      }

      const data = await resp.json();
      if (data.ok) {
        state.roomVersion = data.version;
        state.isHost = data.isHost;

        // If game was closed or returned to lobby
        if (!data.currentGame) {
          window.location.href = `/party/?code=${encodeURIComponent(state.roomCode)}`;
          return;
        }

        syncRoomGameState(data);
      }
    } catch (err) {
      console.warn("Room poll error:", err);
    }

    const pollInterval = (state.isRoomMode && state.currentRoomStatus === "playing") ? 220 : 450;
    setTimeout(pollRoomState, pollInterval);
  }

  function syncRoomGameState(data) {
    const gs = data.gameState;
    if (!gs) return;

    // Ensure arena is visible
    el.setupCard.classList.add("hidden");
    el.gameArena.classList.remove("hidden");

    state.currentPrompt = (gs.prompt || "").toUpperCase();
    el.promptLetters.textContent = state.currentPrompt;

    const remaining = Math.max(0, gs.time_remaining || 0);

    // Audio ticking & bomb vibration - NO visible timer digits or progress bar
    const isPanic = (gs.status === "playing" && remaining > 0 && remaining <= 3.2);
    if (gs.status === "playing" && remaining > 0) {
      sfx.tick(isPanic);
    }
    if (isPanic) {
      if (el.bombCenterHub) el.bombCenterHub.classList.add("ticking-panic");
      if (el.bombGraphic) el.bombGraphic.classList.add("ticking-panic");
      if (el.arenaPointerArrow) el.arenaPointerArrow.classList.add("ticking-panic");
    } else {
      if (el.bombCenterHub) el.bombCenterHub.classList.remove("ticking-panic");
      if (el.bombGraphic) el.bombGraphic.classList.remove("ticking-panic");
      if (el.arenaPointerArrow) el.arenaPointerArrow.classList.remove("ticking-panic");
    }

    // Active player and turn checking
    state.lastRoomPlayers = data.players || [];
    state.currentRoomStatus = gs.status || "idle";

    const isMyTurn = gs.active_player_id === state.playerId;
    const activePlayer = data.players.find(p => p.id === gs.active_player_id);

    // Detect turn or active player transitions and reset inputs cleanly
    const activePlayerChanged = (state.lastRoomActivePlayerId !== gs.active_player_id);
    const promptChanged = (state.lastRoomPrompt !== state.currentPrompt);

    if (activePlayerChanged || promptChanged) {
      state.lastRoomActivePlayerId = gs.active_player_id;
      state.lastRoomPrompt = state.currentPrompt;
      el.wordInput.value = "";
      state.currentTyping = "";

      if (isMyTurn && gs.status === "playing") {
        el.wordInput.disabled = false;
        if (el.btnSubmitWord) el.btnSubmitWord.disabled = false;
        setTimeout(() => {
          ensureInputFocus();
        }, 50);
      }
    }

    if (gs.status === "playing") {
      state.isPlaying = true;
    } else if (gs.status === "game_over") {
      state.isPlaying = false;
    }

    el.turnPlayerName.textContent = activePlayer ? activePlayer.name : (gs.active_player_name || "Spiller");
    el.turnAvatar.innerHTML = renderAvatarHtml(activePlayer ? activePlayer.avatar : getUserDefaultAvatar());

    // Render Circular Arena and point arrow
    renderCircularPlayers(data.players || [], gs.active_player_id);
    rotateArrowToActive(data.players || [], gs.active_player_id);

    const liveTypingText = isMyTurn ? (el.wordInput.value || "") : (gs.current_typing || "");

    updateTypingUI(
      liveTypingText,
      state.currentPrompt,
      isMyTurn,
      activePlayer ? activePlayer.name : (gs.active_player_name || "Spiller"),
      activePlayer ? (activePlayer.avatar || getUserDefaultAvatar()) : getUserDefaultAvatar()
    );

    if (isMyTurn) {
      el.turnOverline.textContent = "💣 DET ER DIN TUR!";
      el.wordInput.disabled = (gs.status !== "playing");
      el.wordInput.placeholder = `Skriv et ord med ${state.currentPrompt}...`;
      if (el.btnSubmitWord) el.btnSubmitWord.disabled = (gs.status !== "playing");
      el.appShell.classList.add("my-turn-active");
      if (gs.status === "playing") {
        ensureInputFocus();
      }
    } else {
      el.turnOverline.textContent = `${gs.active_player_name || 'En annen spiller'} har bomben:`;
      el.wordInput.disabled = true;
      el.wordInput.value = "";
      el.wordInput.placeholder = liveTypingText ? `✍️ ${liveTypingText}` : `Venter på at ${gs.active_player_name || 'spilleren'} skal svare...`;
      if (el.btnSubmitWord) el.btnSubmitWord.disabled = true;
      el.appShell.classList.remove("my-turn-active");
    }

    // Update my lives
    const me = data.me || data.players.find(p => p.id === state.playerId);
    if (me) {
      renderHearts(el.activeHeartsBox, me.lives);
    }

    // Check last event for explosions or sound
    if (gs.last_event && gs.last_event.timestamp > state.lastHandledEventTimestamp) {
      state.lastHandledEventTimestamp = gs.last_event.timestamp;
      if (gs.last_event.type === "explosion") {
        sfx.explosion();
        if (el.bombCenterHub) el.bombCenterHub.classList.add("exploding");
        if (el.bombGraphic) el.bombGraphic.classList.add("exploding");
        sparks.explode();
        setTimeout(() => {
          if (el.bombCenterHub) el.bombCenterHub.classList.remove("exploding");
          if (el.bombGraphic) el.bombGraphic.classList.remove("exploding");
        }, 1200);
      } else if (gs.last_event.type === "word_accepted") {
        sfx.pass();
      }
    }

    // Used words list
    const used = gs.used_words || [];
    el.usedWordsCount.textContent = String(used.length);
    el.usedWordsList.innerHTML = "";
    used.slice(-10).reverse().forEach(w => {
      const tag = document.createElement("span");
      tag.className = "used-word-tag";
      tag.textContent = w;
      el.usedWordsList.appendChild(tag);
    });

    // Game over state
    if (gs.status === "game_over") {
      showRoomGameOver(data);
    } else {
      el.gameOverCard.classList.add("hidden");
    }
  }

  function showRoomGameOver(data) {
    state.isPlaying = false;
    const gs = data.gameState;
    const winner = gs.winner;

    el.gameArena.classList.add("hidden");
    el.gameOverCard.classList.remove("hidden");

    el.victoryIconWrap.textContent = "👑";
    el.gameOverBadge.textContent = "RUNDEN ER OVER";
    el.gameOverTitle.textContent = winner ? `${winner.name} vant Ordbombe!` : "Ingen overlevende!";
    el.gameOverSubtitle.textContent = "Fantastisk innsats i party-rommet!";

    el.partyStandingsBox.classList.remove("hidden");
    el.soloSummaryBox.classList.add("hidden");

    el.partyStandingsList.innerHTML = "";
    (data.players || []).forEach(p => {
      const row = document.createElement("div");
      row.className = `standings-row ${p.id === (winner ? winner.id : '') ? 'is-winner' : ''}`;
      row.innerHTML = `
        <div class="standing-player">
          <span class="standing-avatar">${renderAvatarHtml(p.avatar)}</span>
          <strong>${p.name}</strong>
        </div>
        <div class="standing-badge">
          ${p.eliminated ? 'Utslått' : '🏆 Overlevde!'} (${p.wordsCount} ord)
        </div>
      `;
      el.partyStandingsList.appendChild(row);
    });

    if (el.btnBackToLobby) {
      el.btnBackToLobby.classList.remove("hidden");
    }

    if (state.isHost) {
      el.btnPlayAgain.classList.remove("hidden");
      el.btnPlayAgain.textContent = "Spill en ny runde ↺ (Vert)";
    } else {
      el.btnPlayAgain.classList.add("hidden");
    }
    el.btnChangeSettings.classList.add("hidden");
  }

  function initRoomModeIfPresent() {
    const params = new URLSearchParams(window.location.search);
    const roomCode = (params.get("room") || "").trim().toUpperCase();
    const playerId = (params.get("player") || sessionStorage.getItem("party_player_id") || "").trim();

    if (roomCode) {
      state.isRoomMode = true;
      state.roomCode = roomCode;
      state.playerId = playerId;
      state.hostToken = sessionStorage.getItem("party_host_token");
      state.isHost = !!state.hostToken;

      if (el.headerBackLink) {
        el.headerBackLink.href = `/party/?code=${encodeURIComponent(roomCode)}`;
        el.headerBackLink.textContent = "‹ Party Lounge";
      }
      if (el.headerRoomBadge) {
        el.headerRoomBadge.textContent = `💣 Rom: ${roomCode}`;
      }

      // Hide local setup, show arena
      el.setupCard.classList.add("hidden");
      el.gameArena.classList.remove("hidden");

      pollRoomState();
    }
  }

  // Back to lobby button action
  if (el.btnBackToLobby) {
    el.btnBackToLobby.addEventListener("click", async () => {
      if (state.isRoomMode && state.roomCode) {
        const hostToken = state.hostToken || sessionStorage.getItem("party_host_token");
        if (hostToken) {
          try {
            await fetch("/api/party/ordbombe/action", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                roomCode: state.roomCode,
                hostToken: hostToken,
                action: "to_lobby",
              }),
            });
          } catch (e) { }
        }
        window.location.href = `/party/?code=${encodeURIComponent(state.roomCode)}`;
      }
    });
  }

  initRoomModeIfPresent();

})();
