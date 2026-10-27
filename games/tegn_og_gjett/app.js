/**
 * Tegn & Gjett (skribbl.io inspirert) - Client Application
 * Features:
 * - Real-time canvas drawing with normalized 800x500 coordinates and smooth quadratic curves.
 * - 12 curated vibrant colors, 4 brush sizes, eraser, undo, fill, and canvas clear.
 * - Full multiplayer synchronization (stroke batching, delta polling, word choice modal).
 * - Real-time chat & guessing stream with close-guess feedback and point calculation.
 * - Standalone solo practice mode with offline word prompts and PNG download.
 * - Web Audio API synthesized sound effects.
 */

(function () {
  "use strict";

  // URL parameters for multiplayer room integration
  const urlParams = new URLSearchParams(window.location.search);
  const roomCodeParam = (urlParams.get("room") || urlParams.get("code") || "").trim().toUpperCase();
  const playerIdParam = (urlParams.get("player") || urlParams.get("playerId") || "").trim();

  // Curated 12 Colors Palette
  const PALETTE_COLORS = [
    "#111827", // Svart
    "#4b5563", // Mørk grå
    "#ffffff", // Hvit
    "#ef4444", // Rød
    "#f97316", // Oransje
    "#eab308", // Gul
    "#84cc16", // Lime
    "#10b981", // Grønn
    "#06b6d4", // Cyan
    "#3b82f6", // Blå
    "#8b5cf6", // Lilla
    "#ec4899", // Rosa
  ];

  // Fallback Norwegian words for solo mode
  const SOLO_WORDS = [
    "Katt", "Hund", "Pizza", "Sykkel", "Tannbørste", "Solbriller",
    "Gitar", "Elefant", "Pingvin", "Snømann", "Vaffel", "Brunost",
    "Kaffekopp", "Fly", "Båt", "Helikopter", "Trollmann", "Pirat",
    "Vulkan", "Regnbue", "Palme", "Burger", "Sjokolade", "Støvsuger",
    "Klokke", "Bål", "Samfundet", "Hybel", "Trommer", "Eple"
  ];

  // Application State
  const state = {
    isSolo: !roomCodeParam || !playerIdParam,
    roomCode: roomCodeParam,
    playerId: playerIdParam,
    playerName: "Spiller",
    isHost: false,
    version: -1,
    lastActionId: 0,
    pollTimer: null,
    drawSyncTimer: null,
    isPolling: false,

    // Game state
    turnState: "choosing", // "choosing", "drawing", "round_recap", "game_over"
    isDrawer: false,
    hasGuessed: false,
    currentRound: 1,
    totalRounds: 3,
    timeRemaining: 80,
    activeDrawerId: null,
    activeDrawerName: "",
    secretWord: "",
    maskedWord: "",
    wordCategory: "",

    // Drawing Tool State
    tool: "pencil", // "pencil", "eraser"
    currentColor: "#111827",
    currentSize: 7,
    isDrawing: false,
    currentStrokePoints: [],
    unsentActions: [],
    localStrokes: [], // For undo functionality

    // Audio
    soundEnabled: localStorage.getItem("tegn_sound") !== "false",
    audioCtx: null,
  };

  // DOM Elements
  const el = {
    // Header
    btnBack: document.getElementById("btnBack"),
    backBtnText: document.getElementById("backBtnText"),
    roundIndicator: document.getElementById("roundIndicator"),
    wordStatusLabel: document.getElementById("wordStatusLabel"),
    wordDisplayBox: document.getElementById("wordDisplayBox"),
    maskedWordText: document.getElementById("maskedWordText"),
    wordLengthHint: document.getElementById("wordLengthHint"),
    timerBubble: document.getElementById("timerBubble"),
    timerText: document.getElementById("timerText"),
    btnSoundToggle: document.getElementById("btnSoundToggle"),

    // Left Leaderboard
    playersCountBadge: document.getElementById("playersCountBadge"),
    playersList: document.getElementById("playersList"),

    // Center Canvas & Tools
    soloModeBar: document.getElementById("soloModeBar"),
    soloWordTarget: document.getElementById("soloWordTarget"),
    btnSoloNewWord: document.getElementById("btnSoloNewWord"),
    btnSoloDownload: document.getElementById("btnSoloDownload"),
    canvasViewportWrap: document.getElementById("canvasViewportWrap"),
    canvas: document.getElementById("paintCanvas"),
    canvasNoticeOverlay: document.getElementById("canvasNoticeOverlay"),
    noticeIcon: document.getElementById("noticeIcon"),
    noticeTitle: document.getElementById("noticeTitle"),
    noticeSubtitle: document.getElementById("noticeSubtitle"),
    drawingToolbar: document.getElementById("drawingToolbar"),
    colorsPalette: document.getElementById("colorsPalette"),
    brushSizesGroup: document.getElementById("brushSizesGroup"),
    btnToolPencil: document.getElementById("btnToolPencil"),
    btnToolEraser: document.getElementById("btnToolEraser"),
    btnToolFill: document.getElementById("btnToolFill"),
    btnToolUndo: document.getElementById("btnToolUndo"),
    btnToolClear: document.getElementById("btnToolClear"),

    // Right Chat
    chatConnDot: document.getElementById("chatConnDot"),
    chatMessagesContainer: document.getElementById("chatMessagesContainer"),
    chatForm: document.getElementById("chatForm"),
    chatInput: document.getElementById("chatInput"),
    btnSendGuess: document.getElementById("btnSendGuess"),

    // Modals
    modalWordChoice: document.getElementById("modalWordChoice"),
    wordChoicesGrid: document.getElementById("wordChoicesGrid"),
    choiceTimerText: document.getElementById("choiceTimerText"),
    modalGameOver: document.getElementById("modalGameOver"),
    gameOverSubtitle: document.getElementById("gameOverSubtitle"),
    podiumContainer: document.getElementById("podiumContainer"),
    btnPlayAgain: document.getElementById("btnPlayAgain"),
    btnReturnLobby: document.getElementById("btnReturnLobby"),
  };

  const ctx = el.canvas.getContext("2d", { willReadFrequently: true });
  // Set default canvas background
  clearCanvasLocally("#ffffff");

  // =========================================================================
  // Web Audio Synthesizer (Zero asset dependencies)
  // =========================================================================
  function getAudioContext() {
    if (!state.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) state.audioCtx = new AudioCtx();
    }
    if (state.audioCtx && state.audioCtx.state === "suspended") {
      state.audioCtx.resume();
    }
    return state.audioCtx;
  }

  function playTone(freq, duration = 0.1, type = "sine", gainVal = 0.15) {
    if (!state.soundEnabled) return;
    try {
      const ac = getAudioContext();
      if (!ac) return;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ac.currentTime);
      gain.gain.setValueAtTime(gainVal, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + duration);
    } catch (e) { }
  }

  function playCorrectGuessSound() {
    if (!state.soundEnabled) return;
    try {
      const ac = getAudioContext();
      if (!ac) return;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        setTimeout(() => playTone(freq, 0.22, "triangle", 0.2), idx * 70);
      });
    } catch (e) { }
  }

  function playTickSound() {
    playTone(587.33, 0.08, "sine", 0.1);
  }

  function playFanfareSound() {
    if (!state.soundEnabled) return;
    try {
      const ac = getAudioContext();
      if (!ac) return;
      const chords = [
        [523.25, 659.25],
        [659.25, 783.99],
        [783.99, 1046.50],
        [1046.50, 1318.51],
      ];
      chords.forEach((chord, i) => {
        setTimeout(() => {
          chord.forEach(f => playTone(f, 0.35, "triangle", 0.2));
        }, i * 150);
      });
    } catch (e) { }
  }

  function updateSoundButton() {
    el.btnSoundToggle.textContent = state.soundEnabled ? "🔊" : "🔇";
    localStorage.setItem("tegn_sound", String(state.soundEnabled));
  }

  el.btnSoundToggle.addEventListener("click", () => {
    state.soundEnabled = !state.soundEnabled;
    updateSoundButton();
    if (state.soundEnabled) playTone(659.25, 0.15);
  });
  updateSoundButton();

  // =========================================================================
  // Palette & Tools Initialization
  // =========================================================================
  function initPalette() {
    el.colorsPalette.innerHTML = "";
    PALETTE_COLORS.forEach(color => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `color-swatch-btn ${color === state.currentColor ? "active" : ""}`;
      btn.style.backgroundColor = color;
      if (color.toLowerCase() === "#ffffff") {
        btn.style.borderColor = "#94a3b8";
      }
      btn.addEventListener("click", () => {
        state.currentColor = color;
        state.tool = "pencil";
        updateActiveToolUI();
        el.colorsPalette.querySelectorAll(".color-swatch-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        playTone(400, 0.05);
      });
      el.colorsPalette.appendChild(btn);
    });

    // Brush sizes
    el.brushSizesGroup.querySelectorAll(".size-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        state.currentSize = parseInt(btn.dataset.size, 10) || 7;
        el.brushSizesGroup.querySelectorAll(".size-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        playTone(480, 0.05);
      });
    });

    // Tool actions
    el.btnToolPencil.addEventListener("click", () => {
      state.tool = "pencil";
      updateActiveToolUI();
      playTone(440, 0.05);
    });

    el.btnToolEraser.addEventListener("click", () => {
      state.tool = "eraser";
      updateActiveToolUI();
      playTone(330, 0.05);
    });

    el.btnToolFill.addEventListener("click", () => {
      const fillColor = state.tool === "eraser" ? "#ffffff" : state.currentColor;
      clearCanvasLocally(fillColor);
      recordAction({ type: "clear", color: fillColor });
      playTone(300, 0.15);
    });

    el.btnToolClear.addEventListener("click", () => {
      if (confirm("Vil du tømme hele tegningen?")) {
        clearCanvasLocally("#ffffff");
        recordAction({ type: "clear", color: "#ffffff" });
        playTone(220, 0.15);
      }
    });

    el.btnToolUndo.addEventListener("click", () => {
      if (state.localStrokes.length > 0) {
        state.localStrokes.pop();
        redrawAllLocalStrokes();
        recordAction({ type: "clear", color: "#ffffff" });
        state.localStrokes.forEach(act => recordAction(act));
        playTone(350, 0.08);
      }
    });
  }

  function updateActiveToolUI() {
    el.btnToolPencil.classList.toggle("active", state.tool === "pencil");
    el.btnToolEraser.classList.toggle("active", state.tool === "eraser");
  }

  // =========================================================================
  // Canvas Coordinate & Drawing Engine (800x500 Normalized Space)
  // =========================================================================
  function getNormalizedPoint(e) {
    const rect = el.canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const scaleX = 800 / rect.width;
    const scaleY = 500 / rect.height;
    return {
      x: Math.round(Math.max(0, Math.min(800, (clientX - rect.left) * scaleX))),
      y: Math.round(Math.max(0, Math.min(500, (clientY - rect.top) * scaleY))),
    };
  }

  function clearCanvasLocally(fillColor = "#ffffff") {
    ctx.fillStyle = fillColor;
    ctx.fillRect(0, 0, 800, 500);
  }

  function drawSmoothLine(points, color, size) {
    if (!points || points.length === 0) return;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (points.length === 1) {
      ctx.beginPath();
      ctx.arc(points[0][0], points[0][1], size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);

    for (let i = 1; i < points.length - 1; i++) {
      const midX = (points[i][0] + points[i + 1][0]) / 2;
      const midY = (points[i][1] + points[i + 1][1]) / 2;
      ctx.quadraticCurveTo(points[i][0], points[i][1], midX, midY);
    }

    const last = points[points.length - 1];
    ctx.lineTo(last[0], last[1]);
    ctx.stroke();
    ctx.restore();
  }

  function redrawAllLocalStrokes() {
    clearCanvasLocally("#ffffff");
    state.localStrokes.forEach(act => {
      if (act.type === "stroke") {
        drawSmoothLine(act.points, act.color, act.size);
      } else if (act.type === "clear") {
        clearCanvasLocally(act.color || "#ffffff");
      }
    });
  }

  function onPointerDown(e) {
    if (!canUserDraw()) return;
    if (e.touches && e.touches.length > 1) return;
    if (e.cancelable) e.preventDefault();

    state.isDrawing = true;
    const pt = getNormalizedPoint(e);
    state.currentStrokePoints = [[pt.x, pt.y]];

    const drawColor = state.tool === "eraser" ? "#ffffff" : state.currentColor;
    drawSmoothLine(state.currentStrokePoints, drawColor, state.currentSize);
  }

  function onPointerMove(e) {
    if (!state.isDrawing || !canUserDraw()) return;
    if (e.cancelable) e.preventDefault();

    const pt = getNormalizedPoint(e);
    const pts = state.currentStrokePoints;
    const lastPt = pts[pts.length - 1];

    // Only add point if moved at least 2 pixels to optimize points array
    const distSq = (pt.x - lastPt[0]) ** 2 + (pt.y - lastPt[1]) ** 2;
    if (distSq >= 4) {
      pts.push([pt.x, pt.y]);
      const drawColor = state.tool === "eraser" ? "#ffffff" : state.currentColor;
      drawSmoothLine(pts.slice(-3), drawColor, state.currentSize);
    }
  }

  function onPointerUp(e) {
    if (!state.isDrawing) return;
    state.isDrawing = false;

    if (state.currentStrokePoints.length > 0) {
      const drawColor = state.tool === "eraser" ? "#ffffff" : state.currentColor;
      const action = {
        type: "stroke",
        color: drawColor,
        size: state.currentSize,
        points: state.currentStrokePoints,
      };

      state.localStrokes.push(action);
      recordAction(action);
      state.currentStrokePoints = [];
    }
  }

  function canUserDraw() {
    if (state.isSolo) return true;
    return state.isDrawer && state.turnState === "drawing";
  }

  // Setup Canvas Event Listeners (Mouse + Touch)
  el.canvas.addEventListener("mousedown", onPointerDown);
  window.addEventListener("mousemove", onPointerMove);
  window.addEventListener("mouseup", onPointerUp);

  el.canvas.addEventListener("touchstart", onPointerDown, { passive: false });
  window.addEventListener("touchmove", onPointerMove, { passive: false });
  window.addEventListener("touchend", onPointerUp);
  window.addEventListener("touchcancel", onPointerUp);

  // =========================================================================
  // Drawing Action Batching & Synchronization
  // =========================================================================
  function recordAction(action) {
    if (state.isSolo) return;
    state.unsentActions.push(action);

    // Flush batch after 100ms or when batch exceeds 15 actions
    if (state.unsentActions.length >= 10) {
      flushUnsentDrawActions();
    }
  }

  async function flushUnsentDrawActions() {
    if (state.unsentActions.length === 0 || state.isSolo) return;
    const batch = state.unsentActions.splice(0, 40);

    try {
      await fetch("/api/party/tegn-og-gjett/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: state.roomCode,
          playerId: state.playerId,
          action: "draw",
          actions: batch,
        }),
      });
    } catch (err) {
      console.warn("Draw stroke sync network glitch:", err);
      // Re-queue unsent on failure
      state.unsentActions.unshift(...batch);
    }
  }

  // Regularly flush unsent drawer strokes every 150ms
  setInterval(flushUnsentDrawActions, 150);

  // =========================================================================
  // Solo Practice Mode
  // =========================================================================
  function initSoloMode() {
    el.soloModeBar.classList.remove("hidden");
    el.roundIndicator.textContent = "Solo Øving 🎨";
    el.backBtnText.textContent = "NTNU Games";
    el.btnBack.href = "/";
    el.timerBubble.classList.add("hidden");
    el.drawingToolbar.classList.remove("disabled");

    pickNewSoloWord();

    el.btnSoloNewWord.addEventListener("click", () => {
      pickNewSoloWord();
      playTone(520, 0.08);
    });

    el.btnSoloDownload.addEventListener("click", () => {
      downloadCanvasImage();
    });

    // Populate fake solo players list
    el.playersList.innerHTML = `
      <div class="player-row is-me is-drawer">
        <span class="player-rank">1</span>
        <div class="player-avatar-wrap">
          <div class="player-avatar">🎨</div>
          <span class="player-status-badge status-drawer">✏️</span>
        </div>
        <div class="player-info">
          <div class="player-name">Meg (Tegner)</div>
          <div class="player-score">Fri øving</div>
        </div>
      </div>
    `;
    el.playersCountBadge.textContent = "1";

    // Fake solo chat
    addChatMessage({
      type: "system",
      sender: "System",
      text: "🎨 Velkommen til Solo Tegn & Gjett! Øv deg på å tegne, eller trykk «Flerspiller» for å spille med vennegjengen.",
    });

    // Handle solo guess checking
    el.chatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const val = el.chatInput.value.trim();
      if (!val) return;
      el.chatInput.value = "";

      addChatMessage({ type: "guess", sender: "Meg", text: val });

      if (val.toLowerCase() === state.secretWord.toLowerCase()) {
        playCorrectGuessSound();
        addChatMessage({
          type: "correct",
          sender: "Meg",
          text: `gjettet riktig! Ordet var «${state.secretWord}»! 🎉`,
        });
        setTimeout(pickNewSoloWord, 1800);
      } else {
        playTone(260, 0.1);
      }
    });
  }

  function pickNewSoloWord() {
    const word = SOLO_WORDS[Math.floor(Math.random() * SOLO_WORDS.length)];
    state.secretWord = word;
    el.soloWordTarget.textContent = word;
    el.wordStatusLabel.textContent = "Du øver på å tegne:";
    el.maskedWordText.textContent = word.toUpperCase();
    el.maskedWordText.className = "drawer-word-text";
    el.wordLengthHint.textContent = `(${word.length} bokstaver)`;
  }

  function downloadCanvasImage() {
    const link = document.createElement("a");
    link.download = `tegn-og-gjett-${state.secretWord.toLowerCase() || "tegning"}.png`;
    link.href = el.canvas.toDataURL("image/png");
    link.click();
    playTone(600, 0.1);
  }

  // =========================================================================
  // Multiplayer Room State Polling & Synchronization
  // =========================================================================
  function initMultiplayer() {
    el.soloModeBar.classList.add("hidden");
    el.backBtnText.textContent = "Lounge";
    el.btnBack.href = `/party/?code=${encodeURIComponent(state.roomCode)}`;
    el.timerBubble.classList.remove("hidden");

    // Start room heartbeat polling
    startPolling();

    // Start fast draw delta sync loop (every 240ms)
    startDrawSyncLoop();

    // Chat form submit
    el.chatForm.addEventListener("submit", onChatSubmit);

    // Host Play Again & Return to Lobby
    el.btnPlayAgain.addEventListener("click", async () => {
      if (!state.isHost) return;
      el.btnPlayAgain.disabled = true;
      el.btnPlayAgain.textContent = "Starter på nytt…";
      const hostToken = sessionStorage.getItem("party_host_token") || "";

      try {
        await fetch("/api/party/tegn-og-gjett/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: state.roomCode,
            playerId: state.playerId,
            hostToken: hostToken,
            action: "restart",
            settings: { drawTime: 80, rounds: state.totalRounds },
          }),
        });
      } catch (e) {
        console.error(e);
      } finally {
        el.btnPlayAgain.disabled = false;
        el.btnPlayAgain.textContent = "🔄 Spill igjen";
      }
    });

    el.btnReturnLobby.addEventListener("click", async (e) => {
      e.preventDefault();
      const hostToken = sessionStorage.getItem("party_host_token");
      if (state.isHost && hostToken) {
        try {
          await fetch("/api/party/tegn-og-gjett/action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              roomCode: state.roomCode,
              playerId: state.playerId,
              hostToken: hostToken,
              action: "to_lobby",
            }),
          });
        } catch (err) { }
      }
      window.location.href = `/party/?code=${encodeURIComponent(state.roomCode)}`;
    });
  }

  function startPolling() {
    if (state.isPolling) return;
    state.isPolling = true;

    async function poll() {
      if (!state.roomCode || !state.playerId) return;

      try {
        const url = `/api/party/state?code=${encodeURIComponent(state.roomCode)}&playerId=${encodeURIComponent(state.playerId)}&v=${state.version}`;
        const resp = await fetch(url);

        if (resp.status === 404) {
          alert("Party-rommet er ikke lenger tilgjengelig.");
          window.location.href = "/party/";
          return;
        }

        const data = await resp.json();
        if (data.ok) {
          state.version = data.version;
          state.isHost = !!data.isHost;

          // Check if host transitioned back to lobby or another game
          if (!data.currentGame || data.currentGame !== "tegn_og_gjett") {
            window.location.href = `/party/?code=${encodeURIComponent(state.roomCode)}`;
            return;
          }

          updateMultiplayerUI(data);
        }
      } catch (err) {
        console.warn("Poll hiccup:", err);
      }

      state.pollTimer = setTimeout(poll, 700);
    }

    poll();
  }

  function startDrawSyncLoop() {
    async function syncDraw() {
      // Only guessers fetch draw strokes via delta loop; drawers own the canvas!
      if (!state.isDrawer && state.turnState === "drawing" && state.roomCode) {
        try {
          const url = `/api/party/tegn-og-gjett/draw-sync?code=${encodeURIComponent(state.roomCode)}&since=${state.lastActionId}`;
          const resp = await fetch(url);
          const data = await resp.json();

          if (data.ok && Array.isArray(data.actions)) {
            data.actions.forEach(action => {
              if (action.id > state.lastActionId) {
                applyRemoteDrawAction(action);
                state.lastActionId = action.id;
              }
            });
            if (data.lastActionId !== undefined && data.lastActionId > state.lastActionId) {
              state.lastActionId = data.lastActionId;
            }
          }
        } catch (e) {
          // silently continue
        }
      }
      state.drawSyncTimer = setTimeout(syncDraw, 220);
    }

    syncDraw();
  }

  function applyRemoteDrawAction(action) {
    if (action.type === "stroke") {
      drawSmoothLine(action.points, action.color, action.size);
    } else if (action.type === "clear") {
      clearCanvasLocally(action.color || "#ffffff");
    }
  }

  function updateMultiplayerUI(room) {
    const gs = room.gameState || {};
    const oldTurnState = state.turnState;
    const oldDrawerId = state.activeDrawerId;

    state.turnState = gs.turn_state || "choosing";
    state.isDrawer = !!gs.is_drawer;
    state.hasGuessed = !!gs.has_guessed;
    state.currentRound = gs.current_round || 1;
    state.totalRounds = gs.total_rounds || 3;
    state.timeRemaining = Math.max(0, Math.round(gs.time_remaining || 0));
    state.activeDrawerId = gs.active_drawer_id;
    state.activeDrawerName = gs.active_drawer_name || "Tegner";
    state.secretWord = gs.word || "";
    state.maskedWord = gs.masked_word || "";
    state.wordCategory = gs.category || "";

    // Turn transition detected (new drawer or turn restarted)
    if (oldDrawerId !== state.activeDrawerId || (oldTurnState === "round_recap" && state.turnState === "drawing")) {
      clearCanvasLocally("#ffffff");
      state.lastActionId = 0;
      state.localStrokes = [];
    }

    // 1. Update Header & Timer
    el.roundIndicator.textContent = `Runde ${state.currentRound} av ${state.totalRounds}`;
    el.timerText.textContent = String(state.timeRemaining);

    el.timerBubble.classList.remove("warning", "danger");
    if (state.timeRemaining <= 15 && state.turnState === "drawing") {
      el.timerBubble.classList.add("danger");
      if (state.timeRemaining <= 5 && state.timeRemaining > 0) {
        playTickSound();
      }
    } else if (state.timeRemaining <= 30 && state.turnState === "drawing") {
      el.timerBubble.classList.add("warning");
    }

    // 2. Update Word Banner Display
    if (state.turnState === "choosing") {
      el.wordStatusLabel.textContent = "Ordvalg pågår";
      if (state.isDrawer) {
        el.maskedWordText.textContent = "Velg et ord nedenfor!";
        el.maskedWordText.className = "drawer-word-text";
        el.wordLengthHint.textContent = "(15 sekunder)";
      } else {
        el.maskedWordText.textContent = `${state.activeDrawerName} velger et ord…`;
        el.maskedWordText.className = "masked-word-text";
        el.wordLengthHint.textContent = "Gjør deg klar til å gjette!";
      }
    } else if (state.turnState === "drawing") {
      if (state.isDrawer) {
        el.wordStatusLabel.textContent = "Ditt hemmelige ord:";
        el.maskedWordText.innerHTML = `🌟 ${escapeHtml(state.secretWord.toUpperCase())} <span class="word-category-tag">${escapeHtml(state.wordCategory)}</span>`;
        el.maskedWordText.className = "drawer-word-text";
        el.wordLengthHint.textContent = "(Hold det hemmelig for de andre!)";
      } else if (state.hasGuessed) {
        el.wordStatusLabel.textContent = "Du gjettet riktig!";
        el.maskedWordText.innerHTML = `✓ ${escapeHtml(state.secretWord.toUpperCase())}`;
        el.maskedWordText.className = "drawer-word-text";
        el.maskedWordText.style.color = "#10b981";
        el.wordLengthHint.textContent = "Vent på at de andre gjetter ferdig!";
      } else {
        el.wordStatusLabel.textContent = `Gjett ordet (${escapeHtml(state.wordCategory || "Ting")}):`;
        el.maskedWordText.textContent = state.maskedWord || "_ _ _ _ _";
        el.maskedWordText.className = "masked-word-text";
        el.maskedWordText.style.color = "";
        const cleanCount = (state.maskedWord || "").replace(/[^_]/g, "").length;
        el.wordLengthHint.textContent = `(${cleanCount} bokstaver gjenstår)`;
      }
    } else if (state.turnState === "round_recap") {
      el.wordStatusLabel.textContent = "Runden er over!";
      el.maskedWordText.innerHTML = `Ordet var: <strong style="color: #fb8500;">${escapeHtml((state.secretWord || "").toUpperCase())}</strong>`;
      el.maskedWordText.className = "drawer-word-text";
      el.wordLengthHint.textContent = "Neste runde starter straks…";
    }

    // 3. Update Canvas Overlay & Tool Permissions
    if (state.turnState === "choosing") {
      el.drawingToolbar.classList.add("disabled");
      el.canvas.classList.add("guesser-cursor");

      if (state.isDrawer) {
        // Show Word Choice Modal!
        showWordChoiceModal(gs.word_choices || []);
        el.canvasNoticeOverlay.classList.remove("active");
      } else {
        hideWordChoiceModal();
        showCanvasNotice("🎨", `${state.activeDrawerName} velger ord`, "Runden starter straks så fort ordet er valgt…");
      }
    } else if (state.turnState === "drawing") {
      hideWordChoiceModal();
      el.canvasNoticeOverlay.classList.remove("active");

      if (state.isDrawer) {
        el.drawingToolbar.classList.remove("disabled");
        el.canvas.classList.remove("guesser-cursor");
      } else {
        el.drawingToolbar.classList.add("disabled");
        el.canvas.classList.add("guesser-cursor");
      }
    } else if (state.turnState === "round_recap") {
      hideWordChoiceModal();
      el.drawingToolbar.classList.add("disabled");
      el.canvas.classList.add("guesser-cursor");
      showCanvasNotice("⏰", `Tiden er ute!`, `Riktig ord var: «${(state.secretWord || "").toUpperCase()}»`);
    } else if (state.turnState === "game_over") {
      hideWordChoiceModal();
      el.drawingToolbar.classList.add("disabled");
      showGameOverModal(gs.podium || [], gs.winner);
    }

    // 4. Update Chat Input Permissions
    if (state.isDrawer) {
      el.chatInput.disabled = true;
      el.chatInput.placeholder = "Du tegner denne runden…";
      el.btnSendGuess.disabled = true;
    } else if (state.hasGuessed) {
      el.chatInput.disabled = true;
      el.chatInput.placeholder = "✓ Du har gjettet riktig! Slapp av og se på de andre…";
      el.btnSendGuess.disabled = true;
    } else if (state.turnState !== "drawing") {
      el.chatInput.disabled = true;
      el.chatInput.placeholder = "Venter på at runden starter…";
      el.btnSendGuess.disabled = true;
    } else {
      el.chatInput.disabled = false;
      el.chatInput.placeholder = "Gjett ordet her…";
      el.btnSendGuess.disabled = false;
    }

    // 5. Update Leaderboard
    renderLeaderboard(room.players || [], state.activeDrawerId, gs.guessed_player_ids || []);

    // 6. Update Chat Stream
    renderChatMessages(gs.chat_messages || []);
  }

  // =========================================================================
  // Word Selection Modal (Drawer Only)
  // =========================================================================
  function showWordChoiceModal(choices) {
    if (!choices || choices.length === 0) return;
    el.modalWordChoice.classList.add("active");
    el.choiceTimerText.textContent = String(state.timeRemaining);

    el.wordChoicesGrid.innerHTML = "";
    choices.forEach(c => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "word-choice-btn";
      btn.innerHTML = `
        <span class="word-choice-name">${escapeHtml(c.word)}</span>
        <span class="word-choice-cat">${escapeHtml(c.category || "Ting")}</span>
        <span class="word-choice-diff">${escapeHtml(c.difficulty || "middels")}</span>
      `;
      btn.addEventListener("click", () => {
        selectWordChoice(c.word);
      });
      el.wordChoicesGrid.appendChild(btn);
    });
  }

  function hideWordChoiceModal() {
    el.modalWordChoice.classList.remove("active");
  }

  async function selectWordChoice(word) {
    hideWordChoiceModal();
    playTone(600, 0.1);

    try {
      await fetch("/api/party/tegn-og-gjett/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: state.roomCode,
          playerId: state.playerId,
          action: "choose_word",
          word: word,
        }),
      });
    } catch (e) {
      console.error(e);
    }
  }

  function showCanvasNotice(icon, title, subtitle) {
    el.noticeIcon.textContent = icon;
    el.noticeTitle.textContent = title;
    el.noticeSubtitle.textContent = subtitle;
    el.canvasNoticeOverlay.classList.add("active");
  }

  // =========================================================================
  // Game Over Podium Modal
  // =========================================================================
  let gameOverModalShown = false;
  function showGameOverModal(podium, winner) {
    if (gameOverModalShown) return;
    gameOverModalShown = true;
    playFanfareSound();

    el.modalGameOver.classList.add("active");
    el.gameOverSubtitle.textContent = winner
      ? `👑 Gratulerer til ${winner.name} som vant med ${winner.score} poeng!`
      : "Her er stillingen:";

    // Render 1st, 2nd, 3rd podium pillars
    el.podiumContainer.innerHTML = "";
    const p1 = podium[0];
    const p2 = podium[1];
    const p3 = podium[2];

    const ordered = [
      { p: p2, rankClass: "podium-2nd", rankNum: "2" },
      { p: p1, rankClass: "podium-1st", rankNum: "1" },
      { p: p3, rankClass: "podium-3rd", rankNum: "3" },
    ];

    ordered.forEach(item => {
      const step = document.createElement("div");
      step.className = `podium-step ${item.rankClass}`;
      if (item.p) {
        step.innerHTML = `
          <div style="font-size: 2rem; margin-bottom: 0.25rem;">${renderAvatarHtml(item.p.avatar)}</div>
          <div class="podium-pillar">${item.rankNum}</div>
          <div class="podium-player-name">${escapeHtml(item.p.name)}</div>
          <div class="podium-score">${item.p.score || 0} p</div>
        `;
      } else {
        step.innerHTML = `
          <div style="font-size: 1.5rem; opacity: 0.3;">👤</div>
          <div class="podium-pillar" style="opacity: 0.4;">${item.rankNum}</div>
          <div class="podium-player-name" style="opacity: 0.4;">–</div>
        `;
      }
      el.podiumContainer.appendChild(step);
    });

    if (!state.isHost) {
      el.btnPlayAgain.classList.add("hidden");
    } else {
      el.btnPlayAgain.classList.remove("hidden");
    }
  }

  // =========================================================================
  // Leaderboard Rendering
  // =========================================================================
  function renderLeaderboard(players, activeDrawerId, guessedIds) {
    el.playersCountBadge.textContent = String(players.length);

    // Sort players descending by score
    const sorted = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));

    el.playersList.innerHTML = "";
    sorted.forEach((p, idx) => {
      const isMe = p.id === state.playerId;
      const isDrawer = p.id === activeDrawerId;
      const hasGuessed = guessedIds.includes(p.id);

      const row = document.createElement("div");
      row.className = `player-row ${isMe ? "is-me" : ""} ${isDrawer ? "is-drawer" : ""} ${hasGuessed ? "has-guessed" : ""}`;

      let badgeHtml = "";
      if (isDrawer) {
        badgeHtml = '<span class="player-status-badge status-drawer" title="Tegner denne runden">✏️</span>';
      } else if (hasGuessed) {
        badgeHtml = '<span class="player-status-badge status-guessed" title="Gjettet riktig">✓</span>';
      }

      row.innerHTML = `
        <span class="player-rank">#${idx + 1}</span>
        <div class="player-avatar-wrap">
          <div class="player-avatar" style="border-color: ${p.color || '#3b82f6'};">${renderAvatarHtml(p.avatar)}</div>
          ${badgeHtml}
        </div>
        <div class="player-info">
          <div class="player-name">${escapeHtml(p.name)} ${p.isHost ? '👑' : ''}</div>
          <div class="player-score">${p.score || 0} poeng</div>
        </div>
      `;
      el.playersList.appendChild(row);
    });
  }

  // =========================================================================
  // Live Chat & Guess Submission
  // =========================================================================
  async function onChatSubmit(e) {
    e.preventDefault();
    const text = el.chatInput.value.trim();
    if (!text || state.isDrawer || state.hasGuessed) return;

    el.chatInput.value = "";
    el.btnSendGuess.disabled = true;

    try {
      const resp = await fetch("/api/party/tegn-og-gjett/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: state.roomCode,
          playerId: state.playerId,
          action: "guess",
          text: text,
        }),
      });

      const res = await resp.json();
      if (res.ok) {
        if (res.correct) {
          playCorrectGuessSound();
          state.hasGuessed = true;
        } else if (res.close) {
          playTone(480, 0.15);
          addChatMessage({
            type: "close",
            sender: "Tips",
            text: `«${escapeHtml(res.guess)}» er veldig nærme!`,
          });
        }
      }
    } catch (err) {
      console.warn("Guess send error:", err);
    } finally {
      el.btnSendGuess.disabled = false;
      el.chatInput.focus();
    }
  }

  let lastChatMessagesCount = 0;
  function renderChatMessages(messages) {
    if (!Array.isArray(messages)) return;
    if (messages.length === lastChatMessagesCount) return;
    lastChatMessagesCount = messages.length;

    el.chatMessagesContainer.innerHTML = "";
    messages.forEach(msg => {
      addChatMessage(msg, false);
    });

    el.chatMessagesContainer.scrollTop = el.chatMessagesContainer.scrollHeight;
  }

  function addChatMessage(msg, scrollToBottom = true) {
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble ${msg.type || "guess"}`;

    if (msg.type === "guess") {
      bubble.innerHTML = `<span class="sender">${escapeHtml(msg.sender)}:</span> ${escapeHtml(msg.text)}`;
    } else if (msg.type === "correct") {
      bubble.innerHTML = `🎉 <strong>${escapeHtml(msg.sender)}</strong> ${escapeHtml(msg.text)}`;
    } else if (msg.type === "close") {
      bubble.innerHTML = `💡 <strong>${escapeHtml(msg.sender)}:</strong> ${escapeHtml(msg.text)}`;
    } else if (msg.type === "system_highlight") {
      bubble.innerHTML = `📢 ${escapeHtml(msg.text)}`;
    } else if (msg.type === "winner") {
      bubble.innerHTML = `👑 ${escapeHtml(msg.text)}`;
    } else {
      bubble.innerHTML = escapeHtml(msg.text);
    }

    el.chatMessagesContainer.appendChild(bubble);
    if (scrollToBottom) {
      el.chatMessagesContainer.scrollTop = el.chatMessagesContainer.scrollHeight;
    }
  }

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, m => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[m]);
  }

  function renderAvatarHtml(avatar) {
    const monIds = ["charbear", "jormundgandr", "pixiu", "squitonkey", "tanuki", "totter"];
    if (avatar && (monIds.includes(avatar) || avatar.endsWith(".png"))) {
      const src = avatar.endsWith(".png") ? avatar : `/assets/mons/${avatar}.png`;
      return `<img src="${src}" alt="Monster" class="player-mon-img" />`;
    }
    return `<span class="avatar-fallback">${avatar || "👤"}</span>`;
  }

  // =========================================================================
  // Initialize Application
  // =========================================================================
  initPalette();

  if (state.isSolo) {
    initSoloMode();
  } else {
    initMultiplayer();
  }

})();
