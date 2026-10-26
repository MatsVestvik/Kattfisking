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
    mode: "party", // "party" | "solo"
    difficulty: "medium", // "easy" | "medium" | "hard"
    turnDuration: 9, // seconds
    players: [],
    activePlayerIndex: 0,
    currentPrompt: "BIL",
    usedWords: new Set(),
    timerRemaining: 9.0,
    timerInterval: null,
    isExploding: false,
    soloScore: 0,
    soloStreak: 0,
    soloMaxStreak: 0,
    soloWordsCount: 0,
    soloLongestWord: "",
    soloName: "Spiller 1",
  };

  // DOM Elements
  const el = {
    appShell: document.getElementById("appShell"),
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
    partyPlayersStrip: document.getElementById("partyPlayersStrip"),

    bombStageWrap: document.getElementById("bombStageWrap"),
    bombSparksCanvas: document.getElementById("bombSparksCanvas"),
    timerBarFill: document.getElementById("timerBarFill"),
    timerDigits: document.getElementById("timerDigits"),
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

  // Render party player pills
  function renderPartyPills() {
    el.partyPlayersStrip.innerHTML = "";
    state.players.forEach((p, idx) => {
      const pill = document.createElement("div");
      pill.className = `party-player-pill ${idx === state.activePlayerIndex ? "is-turn" : ""} ${p.eliminated ? "is-eliminated" : ""}`;
      const heartsStr = "❤️".repeat(p.lives) + "🖤".repeat(Math.max(0, 3 - p.lives));
      pill.innerHTML = `
        <span>${p.eliminated ? "💀" : "👤"}</span>
        <strong>${p.name}</strong>
        <span class="pill-hearts">${heartsStr}</span>
      `;
      el.partyPlayersStrip.appendChild(pill);
    });
  }

  // Start new round
  async function startGame() {
    sfx.init();

    // Mode-specific initialization
    if (state.mode === "party") {
      state.turnDuration = parseFloat(el.selectTimerDifficulty.value) || 9;
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
        });
      });
      state.activePlayerIndex = 0;

      el.partyPlayersStrip.classList.remove("hidden");
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
      }];
      state.activePlayerIndex = 0;

      el.partyPlayersStrip.classList.add("hidden");
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

    await fetchNewPrompt();
    startTurn();
  }

  // Start a turn
  function startTurn() {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }

    state.isExploding = false;
    el.appShell.classList.remove("exploded");
    el.bombStageWrap.classList.remove("urgent");

    // In solo mode, duration tightens as streak grows
    if (state.mode === "solo") {
      state.timerRemaining = Math.max(4.2, 10.0 - state.soloStreak * 0.35);
    } else {
      state.timerRemaining = state.turnDuration;
    }

    const curPlayer = state.players[state.activePlayerIndex];
    if (state.mode === "party") {
      el.turnPlayerName.textContent = curPlayer.name;
      el.turnOverline.textContent = "Din tur – send bomben:";
      renderHearts(el.activeHeartsBox, curPlayer.lives);
      renderPartyPills();
    } else {
      el.turnPlayerName.textContent = state.soloName;
      el.turnOverline.textContent = "Solomodus:";
      renderHearts(el.activeHeartsBox, curPlayer.lives);
    }

    updateTimerDisplay();
    sparks.start();

    // Focus input
    el.wordInput.value = "";
    el.wordInput.className = "word-input";
    el.wordInput.focus();

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
        sfx.tick(state.timerRemaining <= 3.0);
      }

      updateTimerDisplay();

      if (state.timerRemaining <= 3.0) {
        el.bombStageWrap.classList.add("urgent");
      }

      if (state.timerRemaining <= 0) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
        triggerExplosion();
      }
    }, 100);
  }

  function updateTimerDisplay() {
    const pct = Math.max(0, Math.min(100, (state.timerRemaining / state.turnDuration) * 100));
    el.timerBarFill.style.width = `${pct}%`;
    el.timerDigits.textContent = `${state.timerRemaining.toFixed(1)}s`;
  }

  // Trigger bomb explosion
  function triggerExplosion() {
    if (state.isExploding) return;
    state.isExploding = true;

    sparks.stop();
    sparks.explode(60);
    sfx.explosion();

    el.appShell.classList.add("exploded");
    el.wordInput.disabled = true;

    const curPlayer = state.players[state.activePlayerIndex];
    curPlayer.lives--;

    if (state.mode === "party") {
      renderHearts(el.activeHeartsBox, curPlayer.lives);
      renderPartyPills();

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

  function showFeedback(text, type = "ok") {
    el.inputFeedback.textContent = text;
    el.inputFeedback.className = `input-feedback ${type}`;
    el.inputFeedback.classList.remove("hidden");
  }

  // Handle word submission
  async function submitWord(e) {
    if (e) e.preventDefault();
    if (state.isExploding || state.timerRemaining <= 0) return;

    const rawWord = el.wordInput.value.trim().toLowerCase();
    const prompt = state.currentPrompt.toLowerCase();

    if (!rawWord) {
      el.wordInput.classList.add("shake");
      setTimeout(() => el.wordInput.classList.remove("shake"), 400);
      return;
    }

    if (rawWord.length < 2) {
      sfx.error();
      el.wordInput.classList.add("shake");
      showFeedback("Ordet må ha minst 2 bokstaver", "error");
      setTimeout(() => el.wordInput.classList.remove("shake"), 400);
      return;
    }

    if (!rawWord.includes(prompt)) {
      sfx.error();
      el.wordInput.classList.add("shake");
      showFeedback(`Ordet må inneholde «${state.currentPrompt}»!`, "error");
      setTimeout(() => el.wordInput.classList.remove("shake"), 400);
      return;
    }

    if (state.usedWords.has(rawWord)) {
      sfx.error();
      el.wordInput.classList.add("shake");
      showFeedback(`«${rawWord}» er allerede brukt i denne runden!`, "error");
      setTimeout(() => el.wordInput.classList.remove("shake"), 400);
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
          sfx.error();
          el.wordInput.classList.add("shake");
          showFeedback(data.reason || `«${rawWord}» finnes ikke i den norske ordboka`, "error");
          setTimeout(() => el.wordInput.classList.remove("shake"), 400);
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

    sfx.success();
    el.wordInput.classList.add("success");
    showFeedback(`✓ «${rawWord}» godkjent!`, "ok");

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

  el.btnPlayAgain.addEventListener("click", () => {
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
    if (e.key === "Escape" && !el.helpModal.classList.contains("hidden")) {
      el.helpModal.classList.add("hidden");
    }
  });

  // Keep word input focused during active game
  document.addEventListener("click", (e) => {
    if (!el.gameArena.classList.contains("hidden") && !el.wordInput.disabled) {
      if (!e.target.closest("button") && !e.target.closest("a") && !e.target.closest(".modal-backdrop")) {
        el.wordInput.focus();
      }
    }
  });

})();
