/**
 * Korridorer – Taktisk labyrintduell for 2–4 spillere (Quoridor)
 * Complete game engine, Web Audio effects, Local Pass & Play,
 * Solo vs AI bots, and real-time party room multiplayer.
 */

(() => {
  "use strict";

  // Available Mons Character Sprites in NTNU Games
  const MONS = [
    { id: "charbear", name: "Charbear", desc: "Ildbjørn", img: "/assets/mons/charbear.png" },
    { id: "jormundgandr", name: "Jørmungandr", desc: "Midgardsorm", img: "/assets/mons/jormundgandr.png" },
    { id: "pixiu", name: "Pixiu", desc: "Gulløve", img: "/assets/mons/pixiu.png" },
    { id: "squitonkey", name: "Squitonkey", desc: "Blekksprutape", img: "/assets/mons/squitonkey.png" },
    { id: "tanuki", name: "Tanuki", desc: "Mårhund", img: "/assets/mons/tanuki.png" },
    { id: "totter", name: "Totter", desc: "Elveoter", img: "/assets/mons/totter.png" },
  ];

  function getMonImg(avatarId) {
    if (!avatarId) return "/assets/mons/charbear.png";
    if (avatarId.startsWith("/") || avatarId.startsWith("data:")) return avatarId;
    const found = MONS.find(m => m.id === avatarId);
    return found ? found.img : `/assets/mons/${avatarId}.png`;
  }

  // Player configuration defaults for 4 slots
  const PLAYER_DEFAULTS = [
    {
      slot: 0,
      color: "#ef4444",
      colorName: "Rød",
      start: [8, 4],
      goalDesc: "Nå rad 0 (øverst)",
      goalFn: (r, c) => r === 0,
      defaultAvatar: "charbear",
      defaultName: "Spiller 1",
    },
    {
      slot: 1,
      color: "#06b6d4",
      colorName: "Cyan",
      start: [0, 4],
      goalDesc: "Nå rad 8 (nederst)",
      goalFn: (r, c) => r === 8,
      defaultAvatar: "jormundgandr",
      defaultName: "Spiller 2",
    },
    {
      slot: 2,
      color: "#10b981",
      colorName: "Grønn",
      start: [4, 0],
      goalDesc: "Nå kolonne 8 (høyre)",
      goalFn: (r, c) => c === 8,
      defaultAvatar: "tanuki",
      defaultName: "Spiller 3",
    },
    {
      slot: 3,
      color: "#a855f7",
      colorName: "Lilla",
      start: [4, 8],
      goalDesc: "Nå kolonne 0 (venstre)",
      goalFn: (r, c) => c === 0,
      defaultAvatar: "squitonkey",
      defaultName: "Spiller 4",
    },
  ];

  // --- Web Audio Synthesizer ---
  const soundEngine = {
    ctx: null,
    enabled: true,

    init() {
      if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume();
      }
    },

    playPawnMove() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(320, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(160, this.ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.08);
      } catch (_) {}
    },

    playWallPlace() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(140, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.12);
      } catch (_) {}
    },

    playWallRotate() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(540, this.ctx.currentTime);
        osc.frequency.setValueAtTime(680, this.ctx.currentTime + 0.04);
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.08);
      } catch (_) {}
    },

    playInvalid() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(130, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.14);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.14);
      } catch (_) {}
    },

    playTurn() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, this.ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, this.ctx.currentTime + 0.07); // A5
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.18);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.18);
      } catch (_) {}
    },

    playVictory() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const notes = [440, 554.37, 659.25, 880];
        notes.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, now + idx * 0.1);
          gain.gain.setValueAtTime(0.3, now + idx * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.1 + 0.3);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now + idx * 0.1);
          osc.stop(now + idx * 0.1 + 0.3);
        });
      } catch (_) {}
    },

    playReaction() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(420, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(740, this.ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.12);
      } catch (_) {}
    },
  };

  // --- Quoridor Core Rules & Logic Engine ---
  function inBounds(r, c) {
    return r >= 0 && r <= 8 && c >= 0 && c <= 8;
  }

  function isPassageBlocked(r1, c1, r2, c2, wallsSet) {
    if (!inBounds(r2, c2)) return true;
    if (r2 === r1 - 1 && c2 === c1) {
      // North
      return wallsSet.has(`${r1 - 1},${c1 - 1},H`) || wallsSet.has(`${r1 - 1},${c1},H`);
    } else if (r2 === r1 + 1 && c2 === c1) {
      // South
      return wallsSet.has(`${r1},${c1 - 1},H`) || wallsSet.has(`${r1},${c1},H`);
    } else if (r2 === r1 && c2 === c1 - 1) {
      // West
      return wallsSet.has(`${r1 - 1},${c1 - 1},V`) || wallsSet.has(`${r1},${c1 - 1},V`);
    } else if (r2 === r1 && c2 === c1 + 1) {
      // East
      return wallsSet.has(`${r1 - 1},${c1},V`) || wallsSet.has(`${r1},${c1},V`);
    }
    return true;
  }

  function getValidPawnMoves(currPos, allPlayersPos, wallsSet) {
    const [r, c] = currPos;
    const moves = [];
    const directions = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];

    const occupied = new Set(
      allPlayersPos.filter(([pr, pc]) => !(pr === r && pc === c)).map(([pr, pc]) => `${pr},${pc}`)
    );

    for (const [dr, dc] of directions) {
      const nr = r + dr;
      const nc = c + dc;
      if (!inBounds(nr, nc) || isPassageBlocked(r, c, nr, nc, wallsSet)) continue;

      if (!occupied.has(`${nr},${nc}`)) {
        moves.push([nr, nc]);
      } else {
        // Adjacent square has an opponent -> check jumps
        const br = nr + dr;
        const bc = nc + dc;
        const canStraightJump =
          inBounds(br, bc) && !isPassageBlocked(nr, nc, br, bc, wallsSet) && !occupied.has(`${br},${bc}`);

        if (canStraightJump) {
          moves.push([br, bc]);
        } else {
          // Behind is blocked -> diagonal jumps
          const perpDirs = [
            [-dc, dr],
            [dc, -dr],
          ];
          for (const [pdr, pdc] of perpDirs) {
            const drDiag = nr + pdr;
            const dcDiag = nc + pdc;
            if (
              inBounds(drDiag, dcDiag) &&
              !isPassageBlocked(nr, nc, drDiag, dcDiag, wallsSet) &&
              !occupied.has(`${drDiag},${dcDiag}`)
            ) {
              moves.push([drDiag, dcDiag]);
            }
          }
        }
      }
    }

    // Return unique sorted moves
    const seen = new Set();
    const result = [];
    for (const m of moves) {
      const key = `${m[0]},${m[1]}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(m);
      }
    }
    return result;
  }

  function hasPathToGoal(startPos, goalFn, wallsSet) {
    const queue = [startPos];
    const visited = new Set([`${startPos[0]},${startPos[1]}`]);

    while (queue.length > 0) {
      const [cr, cc] = queue.shift();
      if (goalFn(cr, cc)) return true;

      for (const [dr, dc] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        const nr = cr + dr;
        const nc = cc + dc;
        const key = `${nr},${nc}`;
        if (inBounds(nr, nc) && !visited.has(key)) {
          if (!isPassageBlocked(cr, cc, nr, nc, wallsSet)) {
            visited.add(key);
            queue.push([nr, nc]);
          }
        }
      }
    }
    return false;
  }

  function getShortestPathDistance(startPos, goalFn, wallsSet) {
    const queue = [[startPos[0], startPos[1], 0]];
    const visited = new Set([`${startPos[0]},${startPos[1]}`]);

    while (queue.length > 0) {
      const [cr, cc, dist] = queue.shift();
      if (goalFn(cr, cc)) return dist;

      for (const [dr, dc] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        const nr = cr + dr;
        const nc = cc + dc;
        const key = `${nr},${nc}`;
        if (inBounds(nr, nc) && !visited.has(key)) {
          if (!isPassageBlocked(cr, cc, nr, nc, wallsSet)) {
            visited.add(key);
            queue.push([nr, nc, dist + 1]);
          }
        }
      }
    }
    return 999; // unreachable
  }

  function validateWallPlacement(r, c, orientation, wallsList, activePlayers) {
    if (r < 0 || r > 7 || c < 0 || c > 7) {
      return { ok: false, error: "Vegg må være innenfor brettets 8x8 kryss." };
    }

    // Check collisions with existing walls
    for (const w of wallsList) {
      if (w.orientation === orientation) {
        if (orientation === "H" && w.r === r && Math.abs(w.c - c) <= 1) {
          return { ok: false, error: "Overlapper med en eksisterende horisontal vegg." };
        } else if (orientation === "V" && w.c === c && Math.abs(w.r - r) <= 1) {
          return { ok: false, error: "Overlapper med en eksisterende vertikal vegg." };
        }
      } else {
        if (w.r === r && w.c === c) {
          return { ok: false, error: "Vegger kan ikke krysse hverandre i midten." };
        }
      }
    }

    // Build candidate walls set
    const candidateSet = new Set(wallsList.map(w => `${w.r},${w.c},${w.orientation}`));
    candidateSet.add(`${r},${c},${orientation}`);

    // BFS path check for ALL players
    for (let i = 0; i < activePlayers.length; i++) {
      const p = activePlayers[i];
      const goalFn = PLAYER_DEFAULTS[i].goalFn;
      if (!hasPathToGoal(p.pos, goalFn, candidateSet)) {
        return { ok: false, error: `Blokkerer alle veier til målet for ${p.name}!` };
      }
    }

    return { ok: true };
  }

  // --- Client State ---
  const state = {
    mode: "online", // 'online', 'local', 'bot'
    gameActive: false,
    roomCode: null,
    playerId: null,
    playerIndex: 0,
    isHost: false,
    role: "p1", // 'p1', 'p2', 'p3', 'p4', 'spectator'
    pollTimer: null,
    lastPolledVersion: 0,

    // UI state
    actionState: "pawn", // 'pawn' or 'wall'
    wallOrientation: "H", // 'H' or 'V'
    hoveredIntersection: null, // [r, c]
    stagedWall: null, // null or { r, c, orientation }

    // Active Match State
    players: [],
    walls: [],
    currentTurn: 0,
    winner: null,
    turnCount: 0,
    chatMessages: [],

    // Bot Config
    botDifficulty: "hard", // 'easy' or 'hard'
    isBotThinking: false,
  };

  // Saved preferences in localStorage
  const savedName = localStorage.getItem("korridorer_player_name") || localStorage.getItem("party_player_name") || "";
  let selectedCreateAvatar = localStorage.getItem("korridorer_avatar") || localStorage.getItem("spillhjornet_avatar") || "charbear";
  let selectedJoinAvatar = localStorage.getItem("korridorer_avatar") || "jormundgandr";
  let selectedBotAvatar = localStorage.getItem("korridorer_avatar") || "charbear";
  let createMaxPlayers = 4;
  let localPlayersCount = 2;
  let botPlayersCount = 2;

  // Local Pass & Play temporary player settings
  const localConfig = [
    { name: savedName || "Spiller 1", avatar: "charbear" },
    { name: "Spiller 2", avatar: "jormundgandr" },
    { name: "Spiller 3", avatar: "tanuki" },
    { name: "Spiller 4", avatar: "squitonkey" },
  ];

  // DOM Elements
  const el = {
    viewLobby: document.getElementById("viewLobby"),
    viewWaitingRoom: document.getElementById("viewWaitingRoom"),
    viewGame: document.getElementById("viewGame"),

    // Header
    btnAudioToggle: document.getElementById("btnAudioToggle"),
    audioIcon: document.getElementById("audioIcon"),
    btnRulesModal: document.getElementById("btnRulesModal"),
    btnLeaveRoomHeader: document.getElementById("btnLeaveRoomHeader"),

    // Lobby Tabs
    tabOnline: document.getElementById("tabOnline"),
    tabLocal: document.getElementById("tabLocal"),
    tabBot: document.getElementById("tabBot"),
    panelOnline: document.getElementById("panelOnline"),
    panelLocal: document.getElementById("panelLocal"),
    panelBot: document.getElementById("panelBot"),

    // Online Lobby Form
    createPlayerName: document.getElementById("createPlayerName"),
    onlineAvatarPreview: document.getElementById("onlineAvatarPreview"),
    pickerCreateSprite: document.getElementById("pickerCreateSprite"),
    controlPlayerCount: document.getElementById("controlPlayerCount"),
    btnSubmitCreate: document.getElementById("btnSubmitCreate"),

    joinRoomCode: document.getElementById("joinRoomCode"),
    joinPlayerName: document.getElementById("joinPlayerName"),
    pickerJoinSprite: document.getElementById("pickerJoinSprite"),
    btnSubmitJoin: document.getElementById("btnSubmitJoin"),

    // Waiting Room
    dispRoomCode: document.getElementById("dispRoomCode"),
    dispWaitingSubtitle: document.getElementById("dispWaitingSubtitle"),
    containerWaitingSlots: document.getElementById("containerWaitingSlots"),
    btnHostStartOnline: document.getElementById("btnHostStartOnline"),
    btnAddBotOnline: document.getElementById("btnAddBotOnline"),
    dispHostHint: document.getElementById("dispHostHint"),
    btnCopyInviteLink: document.getElementById("btnCopyInviteLink"),

    // Local Tab
    controlLocalCount: document.getElementById("controlLocalCount"),
    localPlayersList: document.getElementById("localPlayersList"),
    btnStartLocal: document.getElementById("btnStartLocal"),

    // Bot Tab
    botPlayerName: document.getElementById("botPlayerName"),
    pickerBotSprite: document.getElementById("pickerBotSprite"),
    controlBotCount: document.getElementById("controlBotCount"),
    controlBotDiff: document.getElementById("controlBotDiff"),
    btnStartBot: document.getElementById("btnStartBot"),

    // Game Arena
    turnAnnouncer: document.getElementById("turnAnnouncer"),
    turnPawnImg: document.getElementById("turnPawnImg"),
    turnLabel: document.getElementById("turnLabel"),
    turnSub: document.getElementById("turnSub"),
    btnModePawn: document.getElementById("btnModePawn"),
    btnModeWall: document.getElementById("btnModeWall"),
    btnRotateWall: document.getElementById("btnRotateWall"),
    btnWallsCount: document.getElementById("btnWallsCount"),
    labelOrientation: document.getElementById("labelOrientation"),

    colPlayersLeft: document.getElementById("colPlayersLeft"),
    colPlayersRight: document.getElementById("colPlayersRight"),

    boardWrapper: document.getElementById("boardWrapper"),
    boardCells: document.getElementById("boardCells"),
    boardWallsLayer: document.getElementById("boardWallsLayer"),
    boardGroovesLayer: document.getElementById("boardGroovesLayer"),

    // Floating On-Board Wall Toolbar & Tooltip
    floatingWallToolbar: document.getElementById("floatingWallToolbar"),
    btnFloatRotate: document.getElementById("btnFloatRotate"),
    btnFloatConfirm: document.getElementById("btnFloatConfirm"),
    btnFloatCancel: document.getElementById("btnFloatCancel"),
    ghostWallTooltip: document.getElementById("ghostWallTooltip"),

    // Ergonomic Action Command Dock
    gameActionDock: document.getElementById("gameActionDock"),
    btnDockPawn: document.getElementById("btnDockPawn"),
    btnDockWall: document.getElementById("btnDockWall"),
    btnDockRotate: document.getElementById("btnDockRotate"),
    dockWallsLeft: document.getElementById("dockWallsLeft"),
    dockRotateTitle: document.getElementById("dockRotateTitle"),
    dockRotateBadge: document.getElementById("dockRotateBadge"),

    btnRestartGame: document.getElementById("btnRestartGame"),
    btnBackToLobby: document.getElementById("btnBackToLobby"),
    chatToastContainer: document.getElementById("chatToastContainer"),

    // Modals
    modalRules: document.getElementById("modalRules"),
    btnCloseRules: document.getElementById("btnCloseRules"),
    btnDismissRules: document.getElementById("btnDismissRules"),

    modalVictory: document.getElementById("modalVictory"),
    victoryWinnerImg: document.getElementById("victoryWinnerImg"),
    victoryTitle: document.getElementById("victoryTitle"),
    victoryDesc: document.getElementById("victoryDesc"),
    statTurnCount: document.getElementById("statTurnCount"),
    statWallsPlaced: document.getElementById("statWallsPlaced"),
    btnVictoryRematch: document.getElementById("btnVictoryRematch"),
    btnVictoryLobby: document.getElementById("btnVictoryLobby"),
  };

  // --- Initial Setup & Event Listeners ---
  function init() {
    // Populate stored names
    if (savedName) {
      if (el.createPlayerName) el.createPlayerName.value = savedName;
      if (el.joinPlayerName) el.joinPlayerName.value = savedName;
      if (el.botPlayerName) el.botPlayerName.value = savedName;
    }

    if (el.onlineAvatarPreview) {
      el.onlineAvatarPreview.src = getMonImg(selectedCreateAvatar);
    }

    // Render Avatar Pickers
    renderSpritePicker(el.pickerCreateSprite, selectedCreateAvatar, id => {
      selectedCreateAvatar = id;
      selectedJoinAvatar = id;
      localStorage.setItem("korridorer_avatar", id);
      if (el.onlineAvatarPreview) el.onlineAvatarPreview.src = getMonImg(id);
      renderSpritePicker(el.pickerCreateSprite, selectedCreateAvatar);
    });

    if (el.pickerJoinSprite) {
      renderSpritePicker(el.pickerJoinSprite, selectedJoinAvatar, id => {
        selectedJoinAvatar = id;
        localStorage.setItem("korridorer_avatar", id);
        renderSpritePicker(el.pickerJoinSprite, selectedJoinAvatar);
      });
    }

    renderSpritePicker(el.pickerBotSprite, selectedBotAvatar, id => {
      selectedBotAvatar = id;
      localStorage.setItem("korridorer_avatar", id);
      renderSpritePicker(el.pickerBotSprite, selectedBotAvatar);
    });

    // Keep name inputs synced
    if (el.createPlayerName) {
      el.createPlayerName.addEventListener("input", e => {
        const val = e.target.value;
        if (el.joinPlayerName) el.joinPlayerName.value = val;
        localStorage.setItem("korridorer_player_name", val);
      });
    }

    renderLocalPlayersSetup();
    renderBoardBaseGrid();

    setupUIEventListeners();
    checkUrlQueryParams();
  }

  // Render Sprite Picker Chips
  function renderSpritePicker(container, selectedId, onSelect) {
    if (!container) return;
    container.innerHTML = "";
    MONS.forEach(mon => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = `sprite-chip ${mon.id === selectedId ? "selected" : ""}`;
      chip.title = `${mon.name} (${mon.desc})`;
      chip.innerHTML = `
        <img src="${mon.img}" alt="${mon.name}" class="sprite-chip-img" />
        <span class="sprite-chip-name">${mon.name}</span>
      `;
      if (onSelect) {
        chip.addEventListener("click", () => onSelect(mon.id));
      }
      container.appendChild(chip);
    });
  }

  // Render Local Pass & Play Configuration Rows
  function renderLocalPlayersSetup() {
    if (!el.localPlayersList) return;
    el.localPlayersList.innerHTML = "";

    for (let i = 0; i < localPlayersCount; i++) {
      const cfg = PLAYER_DEFAULTS[i];
      const pData = localConfig[i];
      const row = document.createElement("div");
      row.className = "local-player-row";

      row.innerHTML = `
        <span class="local-p-badge" style="background:${cfg.color};">P${i + 1}</span>
        <button type="button" class="local-p-avatar-btn" id="btnLocalAvatarP${i}" title="Bytt monster">
          <img src="${getMonImg(pData.avatar)}" class="local-p-avatar-img" id="imgLocalAvatarP${i}" alt="Monster" />
        </button>
        <input type="text" class="local-p-input" id="inputLocalNameP${i}" maxlength="18" value="${pData.name}" placeholder="${cfg.defaultName}" />
      `;

      // Cycle monster on click
      const btnAv = row.querySelector(`#btnLocalAvatarP${i}`);
      const imgAv = row.querySelector(`#imgLocalAvatarP${i}`);
      btnAv.addEventListener("click", () => {
        const curIdx = MONS.findIndex(m => m.id === pData.avatar);
        const nextMon = MONS[(curIdx + 1) % MONS.length];
        pData.avatar = nextMon.id;
        imgAv.src = nextMon.img;
        soundEngine.playWallRotate();
      });

      // Name change listener
      const inputName = row.querySelector(`#inputLocalNameP${i}`);
      inputName.addEventListener("input", e => {
        pData.name = e.target.value.trim() || cfg.defaultName;
      });

      el.localPlayersList.appendChild(row);
    }
  }

  // Render static 9x9 board cells and 8x8 wall groove intersection points
  function renderBoardBaseGrid() {
    if (!el.boardCells || !el.boardGroovesLayer) return;
    el.boardCells.innerHTML = "";
    el.boardGroovesLayer.innerHTML = "";

    // 81 cells (9 rows x 9 columns)
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cell = document.createElement("div");
        cell.className = "board-cell";
        cell.dataset.r = r;
        cell.dataset.c = c;
        cell.id = `cell_${r}_${c}`;

        cell.addEventListener("click", () => onCellClicked(r, c));
        el.boardCells.appendChild(cell);
      }
    }

    // 8x8 wall groove intersection points (r: 0-7, c: 0-7)
    // Board is 9 cells with 8 gaps.
    // Each cell is 1fr, gap is 8px.
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const groove = document.createElement("div");
        groove.className = "groove-intersection";
        groove.dataset.r = r;
        groove.dataset.c = c;

        // Position percentage: cell index + 1
        // In CSS grid: percentage calculation: (index + 1) / 9 * 100%
        groove.style.top = `${((r + 1) / 9) * 100}%`;
        groove.style.left = `${((c + 1) / 9) * 100}%`;

        groove.addEventListener("mouseenter", () => onGrooveHover(r, c));
        groove.addEventListener("mouseleave", () => onGrooveLeave(r, c));
        groove.addEventListener("click", () => onGrooveClick(r, c));

        el.boardGroovesLayer.appendChild(groove);
      }
    }
  }

  // --- UI Event Listeners ---
  function setupUIEventListeners() {
    // Audio Toggle
    el.btnAudioToggle.addEventListener("click", () => {
      soundEngine.enabled = !soundEngine.enabled;
      el.audioIcon.textContent = soundEngine.enabled ? "🔊" : "🔇";
    });

    // Rules Modal
    el.btnRulesModal.addEventListener("click", () => el.modalRules.classList.remove("hidden"));
    el.btnCloseRules.addEventListener("click", () => el.modalRules.classList.add("hidden"));
    el.btnDismissRules.addEventListener("click", () => el.modalRules.classList.add("hidden"));
    el.modalRules.addEventListener("click", e => {
      if (e.target === el.modalRules) el.modalRules.classList.add("hidden");
    });

    // Header Leave Room
    el.btnLeaveRoomHeader.addEventListener("click", () => {
      if (confirm("Vil du forlate rommet og gå til lobbyen?")) {
        leaveToLobby();
      }
    });

    // Lobby Tabs Switching
    el.tabOnline.addEventListener("click", () => switchLobbyTab("online"));
    el.tabLocal.addEventListener("click", () => switchLobbyTab("local"));
    el.tabBot.addEventListener("click", () => switchLobbyTab("bot"));

    // Online Mode Controls
    el.controlPlayerCount.querySelectorAll(".seg-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        el.controlPlayerCount.querySelectorAll(".seg-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        createMaxPlayers = parseInt(btn.dataset.count, 10);
      });
    });

    el.btnSubmitCreate.addEventListener("click", handleCreateOnlineRoom);
    el.btnSubmitJoin.addEventListener("click", handleJoinOnlineRoom);
    el.btnCopyInviteLink.addEventListener("click", handleCopyInviteLink);
    el.btnHostStartOnline.addEventListener("click", handleHostStartOnline);
    if (el.btnAddBotOnline) {
      el.btnAddBotOnline.addEventListener("click", handleAddBotOnline);
    }

    // Local Mode Controls
    el.controlLocalCount.querySelectorAll(".seg-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        el.controlLocalCount.querySelectorAll(".seg-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        localPlayersCount = parseInt(btn.dataset.count, 10);
        renderLocalPlayersSetup();
      });
    });
    el.btnStartLocal.addEventListener("click", handleStartLocalGame);

    // Bot Mode Controls
    el.controlBotCount.querySelectorAll(".seg-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        el.controlBotCount.querySelectorAll(".seg-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        botPlayersCount = parseInt(btn.dataset.count, 10);
      });
    });

    el.controlBotDiff.querySelectorAll(".seg-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        el.controlBotDiff.querySelectorAll(".seg-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        state.botDifficulty = btn.dataset.diff;
      });
    });
    el.btnStartBot.addEventListener("click", handleStartBotGame);

    // In-Game Mode Toggles (Pawn Move vs Place Wall)
    el.btnModePawn.addEventListener("click", () => setActionState("pawn"));
    el.btnModeWall.addEventListener("click", () => setActionState("wall"));
    el.btnRotateWall.addEventListener("click", toggleWallOrientation);

    // Ergonomic Action Command Dock Listeners
    if (el.btnDockPawn) el.btnDockPawn.addEventListener("click", () => setActionState("pawn"));
    if (el.btnDockWall) el.btnDockWall.addEventListener("click", () => setActionState("wall"));
    if (el.btnDockRotate) el.btnDockRotate.addEventListener("click", toggleWallOrientation);

    // Floating On-Board Wall Toolbar Buttons
    if (el.btnFloatRotate) {
      el.btnFloatRotate.addEventListener("click", e => {
        e.stopPropagation();
        toggleWallOrientation();
      });
    }
    if (el.btnFloatConfirm) {
      el.btnFloatConfirm.addEventListener("click", e => {
        e.stopPropagation();
        confirmStagedWall();
      });
    }
    if (el.btnFloatCancel) {
      el.btnFloatCancel.addEventListener("click", e => {
        e.stopPropagation();
        clearStagedWall();
      });
    }

    // Board Wrapper right-click & wheel rotation, and outside click to cancel
    if (el.boardWrapper) {
      el.boardWrapper.addEventListener("contextmenu", e => {
        e.preventDefault();
        toggleWallOrientation();
      });

      let lastWheelTime = 0;
      el.boardWrapper.addEventListener("wheel", () => {
        const now = Date.now();
        if (now - lastWheelTime > 160) {
          lastWheelTime = now;
          toggleWallOrientation();
        }
      }, { passive: true });

      el.boardWrapper.addEventListener("click", e => {
        if (e.target === el.boardWrapper || e.target === el.boardWallsLayer || e.target === el.boardGroovesLayer) {
          clearStagedWall();
        }
      });
    }

    // Keyboard Shortcuts (Arrow keys / WASD for pawn movement, R for rotation, V for mode toggle, Enter to confirm staged wall)
    window.addEventListener("keydown", e => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

      if (e.key === "Enter") {
        if (state.stagedWall) {
          e.preventDefault();
          confirmStagedWall();
          return;
        }
      }

      if (e.key === "r" || e.key === "R" || e.code === "Space") {
        e.preventDefault();
        toggleWallOrientation();
        return;
      }

      if (e.key === "v" || e.key === "V") {
        e.preventDefault();
        setActionState(state.actionState === "pawn" ? "wall" : "pawn");
        return;
      }

      if (e.key === "Escape") {
        el.modalRules.classList.add("hidden");
        el.modalVictory.classList.add("hidden");
        clearStagedWall();
        return;
      }

      // Arrow keys / WASD for pawn movement
      if (state.gameActive) {
        const isMyTurn =
          state.mode === "online"
            ? state.playerIndex === state.currentTurn
            : state.mode === "bot"
            ? state.currentTurn === 0
            : true;

        if (isMyTurn) {
          const curPlayer = state.players[state.currentTurn];
          if (curPlayer) {
            let dir = null;
            if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") dir = [-1, 0];
            else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") dir = [1, 0];
            else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") dir = [0, -1];
            else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") dir = [0, 1];

            if (dir) {
              e.preventDefault();
              const wallsSet = new Set(state.walls.map(w => `${w.r},${w.c},${w.orientation}`));
              const allPos = state.players.map(p => p.pos);
              const validMoves = getValidPawnMoves(curPlayer.pos, allPos, wallsSet);

              const [dr, dc] = dir;
              const [cr, cc] = curPlayer.pos;
              // Check single step or jump 2 steps in that direction
              const target = validMoves.find(
                ([mr, mc]) => (mr === cr + dr && mc === cc + dc) || (mr === cr + dr * 2 && mc === cc + dc * 2)
              );
              if (target) {
                commitPawnMove(target[0], target[1]);
              } else {
                soundEngine.playInvalid();
              }
            }
          }
        }
      }
    });

    // In-Game Reactions
    document.querySelectorAll(".reaction-chip").forEach(btn => {
      btn.addEventListener("click", () => sendReaction(btn.dataset.emoji));
    });

    // In-Game Footer Controls
    el.btnRestartGame.addEventListener("click", handleRequestRematch);
    el.btnBackToLobby.addEventListener("click", leaveToLobby);

    // Victory Modal Buttons
    el.btnVictoryRematch.addEventListener("click", () => {
      el.modalVictory.classList.add("hidden");
      handleRequestRematch();
    });
    el.btnVictoryLobby.addEventListener("click", () => {
      el.modalVictory.classList.add("hidden");
      leaveToLobby();
    });
  }

  function switchLobbyTab(tabName) {
    [el.tabOnline, el.tabLocal, el.tabBot].forEach(b => b.classList.remove("active"));
    [el.panelOnline, el.panelLocal, el.panelBot].forEach(p => p.classList.add("hidden"));

    if (tabName === "online") {
      el.tabOnline.classList.add("active");
      el.panelOnline.classList.remove("hidden");
    } else if (tabName === "local") {
      el.tabLocal.classList.add("active");
      el.panelLocal.classList.remove("hidden");
    } else if (tabName === "bot") {
      el.tabBot.classList.add("active");
      el.panelBot.classList.remove("hidden");
    }
  }

  function checkUrlQueryParams() {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room") || params.get("code");
    const playerParam = params.get("player");

    if (roomParam) {
      const code = roomParam.trim().toUpperCase();
      if (el.joinRoomCode) el.joinRoomCode.value = code;

      if (playerParam) {
        // Direct launch from Party Lounge bridge!
        state.mode = "online";
        state.roomCode = code;
        state.playerId = playerParam;
        startOnlineRoomPolling();
      } else {
        switchLobbyTab("online");
      }
    }
  }

  // --- ONLINE MULTIPLAYER HANDLERS ---
  async function handleCreateOnlineRoom() {
    const name = el.createPlayerName.value.trim() || "Spiller 1";
    localStorage.setItem("korridorer_player_name", name);

    el.btnSubmitCreate.disabled = true;
    el.btnSubmitCreate.textContent = "Oppretter rom…";

    try {
      const resp = await fetch("/api/korridorer/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostName: name,
          avatar: selectedCreateAvatar,
          maxPlayers: createMaxPlayers,
        }),
      });

      const data = await resp.json();
      if (!data.ok) {
        alert(data.error || "Kunne ikke opprette rom.");
        el.btnSubmitCreate.disabled = false;
        el.btnSubmitCreate.textContent = "✨ Opprett rom";
        return;
      }

      state.mode = "online";
      state.roomCode = data.roomCode;
      state.playerId = data.playerId;
      state.playerIndex = 0;
      state.isHost = true;
      state.role = "p1";

      startOnlineRoomPolling();
    } catch (err) {
      console.error(err);
      alert("Nettverksfeil ved opprettelse av rom.");
      el.btnSubmitCreate.disabled = false;
      el.btnSubmitCreate.textContent = "✨ Opprett rom";
    }
  }

  async function handleJoinOnlineRoom() {
    const code = el.joinRoomCode.value.trim().toUpperCase();
    const name = el.joinPlayerName.value.trim() || "Spiller";

    if (!code) {
      alert("Vennligst skriv inn en 4-bokstavs romkode.");
      return;
    }

    localStorage.setItem("korridorer_player_name", name);
    el.btnSubmitJoin.disabled = true;
    el.btnSubmitJoin.textContent = "Kobler til…";

    try {
      const resp = await fetch("/api/korridorer/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: code,
          playerName: name,
          avatar: selectedJoinAvatar,
        }),
      });

      const data = await resp.json();
      if (!data.ok) {
        alert(data.error || "Kunne ikke bli med i rommet.");
        el.btnSubmitJoin.disabled = false;
        el.btnSubmitJoin.textContent = "🚀 Koble til parti";
        return;
      }

      state.mode = "online";
      state.roomCode = data.roomCode;
      state.playerId = data.playerId;
      state.playerIndex = data.playerIndex || 0;
      state.isHost = Boolean(data.isHost);
      state.role = data.role || "p2";

      startOnlineRoomPolling();
    } catch (err) {
      console.error(err);
      alert("Nettverksfeil ved tilkobling til rom.");
      el.btnSubmitJoin.disabled = false;
      el.btnSubmitJoin.textContent = "🚀 Koble til parti";
    }
  }

  function handleCopyInviteLink() {
    const joinUrl = `${window.location.origin}/korridorer/?room=${encodeURIComponent(state.roomCode)}`;
    navigator.clipboard
      .writeText(joinUrl)
      .then(() => {
        const orig = el.btnCopyInviteLink.textContent;
        el.btnCopyInviteLink.textContent = "✓ Kopiert!";
        setTimeout(() => (el.btnCopyInviteLink.textContent = orig), 2000);
      })
      .catch(() => alert(`Kopier denne lenken: ${joinUrl}`));
  }

  async function handleHostStartOnline() {
    if (!state.isHost || !state.roomCode) return;
    el.btnHostStartOnline.disabled = true;
    el.btnHostStartOnline.textContent = "Starter spill…";

    try {
      const resp = await fetch("/api/korridorer/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: state.roomCode,
          playerId: state.playerId,
        }),
      });
      const data = await resp.json();
      if (!data.ok) {
        alert(data.error || "Kunne ikke starte spill.");
        el.btnHostStartOnline.disabled = false;
        el.btnHostStartOnline.textContent = "🎮 Start spill nå";
      } else if (data.state) {
        syncOnlineState(data.state);
      }
    } catch (err) {
      console.error(err);
      el.btnHostStartOnline.disabled = false;
      el.btnHostStartOnline.textContent = "🎮 Start spill nå";
    }
  }

  async function handleAddBotOnline() {
    if (!state.isHost || !state.roomCode) return;
    if (el.btnAddBotOnline) {
      el.btnAddBotOnline.disabled = true;
      el.btnAddBotOnline.textContent = "Legger til…";
    }

    try {
      const resp = await fetch("/api/korridorer/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: state.roomCode,
          playerId: state.playerId,
        }),
      });
      const data = await resp.json();
      if (!data.ok) {
        alert(data.error || "Kunne ikke legge til bot.");
      } else if (data.state) {
        syncOnlineState(data.state);
      }
    } catch (err) {
      console.error(err);
      alert("Nettverksfeil ved tilføyelse av bot.");
    } finally {
      if (el.btnAddBotOnline) {
        el.btnAddBotOnline.disabled = false;
        el.btnAddBotOnline.textContent = "🤖 + Legg til bot";
      }
    }
  }

  function startOnlineRoomPolling() {
    if (state.pollTimer) clearInterval(state.pollTimer);

    el.btnLeaveRoomHeader.classList.remove("hidden");

    async function poll() {
      if (!state.roomCode) return;
      try {
        const url = `/api/korridorer/state?room=${encodeURIComponent(state.roomCode)}&player=${encodeURIComponent(state.playerId || "")}`;
        const resp = await fetch(url);
        if (!resp.ok) return;

        const data = await resp.json();
        if (data.ok) {
          syncOnlineState(data);
        }
      } catch (err) {
        console.warn("Polling hiccup:", err);
      }
    }

    state.pollTimer = setInterval(poll, 750);
    poll();
  }

  function syncOnlineState(data) {
    const prevTurn = state.currentTurn;
    const prevStatus = state.gameActive;

    state.players = data.players || [];
    state.walls = data.walls || [];
    state.currentTurn = data.currentTurn || 0;
    state.winner = data.winner;
    state.role = data.myRole || "spectator";
    state.playerIndex = typeof data.myIndex === "number" ? data.myIndex : 0;

    // Chat messages check
    if (Array.isArray(data.chatMessages) && data.chatMessages.length > state.chatMessages.length) {
      const newMessages = data.chatMessages.slice(state.chatMessages.length);
      newMessages.forEach(msg => showChatToast(msg));
      state.chatMessages = data.chatMessages;
    }

    if (data.status === "waiting") {
      state.gameActive = false;
      showView("waiting");
      renderWaitingRoomSlots(data);
    } else if (data.status === "active") {
      state.gameActive = true;
      showView("game");
      renderGameBoard();

      // Play chime when turn changes to user
      if (prevStatus && prevTurn !== state.currentTurn && state.playerIndex === state.currentTurn) {
        soundEngine.playTurn();
      }
    } else if (data.status === "finished") {
      state.gameActive = false;
      renderGameBoard();
      if (data.winner) {
        showVictoryModal(data.winner);
      }
    }
  }

  function renderWaitingRoomSlots(data) {
    el.dispRoomCode.textContent = data.roomCode;
    el.containerWaitingSlots.innerHTML = "";

    const max = data.maxPlayers || 4;
    for (let i = 0; i < max; i++) {
      const p = data.players[i];
      const card = document.createElement("div");

      if (p) {
        card.className = "player-slot-card occupied";
        card.innerHTML = `
          <div class="slot-avatar-wrap" style="border-color:${p.color};">
            <img src="${getMonImg(p.avatar)}" class="slot-avatar-img" alt="${p.name}" />
          </div>
          <span class="slot-name">${p.name}</span>
          <span class="slot-role-tag" style="color:${p.color};">${p.isHost ? "Romvert (P1)" : `P${i + 1}`}</span>
        `;
      } else {
        card.className = "player-slot-card slot-empty";
        card.innerHTML = `
          <div class="slot-empty-icon">⏳</div>
          <span class="slot-name" style="color:var(--text-muted);">Ledig plass</span>
          <span class="slot-role-tag">Venter…</span>
        `;
      }
      el.containerWaitingSlots.appendChild(card);
    }

    // Host Start Button state
    if (state.isHost) {
      el.btnHostStartOnline.style.display = "block";
      el.dispHostHint.style.display = "block";
      if (el.btnAddBotOnline) {
        el.btnAddBotOnline.style.display = data.players.length >= max ? "none" : "block";
      }
      el.btnHostStartOnline.disabled = false;
      if (data.players.length >= 2) {
        el.btnHostStartOnline.textContent = `🎮 Start spill nå (${data.players.length} spillere)`;
        el.dispHostHint.textContent = "Klar til start! Eller legg til flere spillere/boter.";
      } else {
        el.btnHostStartOnline.textContent = "🎮 Start spill nå (med bot)";
        el.dispHostHint.textContent = "Du kan invitere en venn, eller starte med en datastyrt motstander.";
      }
    } else {
      el.btnHostStartOnline.style.display = "none";
      if (el.btnAddBotOnline) el.btnAddBotOnline.style.display = "none";
      el.dispHostHint.textContent = "Venter på at romverten skal starte partiet…";
    }
  }

  // --- LOCAL PASS & PLAY HANDLERS ---
  function handleStartLocalGame() {
    state.mode = "local";
    state.roomCode = null;
    state.playerId = "local_p0";
    state.currentTurn = 0;
    state.winner = null;
    state.walls = [];
    state.turnCount = 0;

    const wallsCount = localPlayersCount === 2 ? 10 : localPlayersCount === 3 ? 6 : 5;

    state.players = [];
    for (let i = 0; i < localPlayersCount; i++) {
      const cfg = PLAYER_DEFAULTS[i];
      const pData = localConfig[i];
      state.players.push({
        id: `local_p${i}`,
        name: pData.name || cfg.defaultName,
        avatar: pData.avatar || cfg.defaultAvatar,
        color: cfg.color,
        colorName: cfg.colorName,
        pos: [...cfg.start],
        walls: wallsCount,
        goalDesc: cfg.goalDesc,
        isHost: i === 0,
      });
    }

    state.gameActive = true;
    clearStagedWall();
    setActionState("pawn");

    el.btnLeaveRoomHeader.classList.remove("hidden");
    showView("game");
    renderGameBoard();
    soundEngine.playTurn();
  }

  // --- SOLO VS BOT HANDLERS ---
  function handleStartBotGame() {
    state.mode = "bot";
    state.roomCode = null;
    state.playerId = "player_human";
    state.currentTurn = 0;
    state.winner = null;
    state.walls = [];
    state.turnCount = 0;
    state.isBotThinking = false;

    const humanName = el.botPlayerName ? (el.botPlayerName.value.trim() || "Mester") : "Mester";
    localStorage.setItem("korridorer_player_name", humanName);

    const count = botPlayersCount;
    const wallsCount = count === 2 ? 10 : 5;

    state.players = [
      {
        id: "player_human",
        name: humanName,
        avatar: selectedBotAvatar,
        color: PLAYER_DEFAULTS[0].color,
        colorName: PLAYER_DEFAULTS[0].colorName,
        pos: [...PLAYER_DEFAULTS[0].start],
        walls: wallsCount,
        goalDesc: PLAYER_DEFAULTS[0].goalDesc,
        isHost: true,
      },
    ];

    const botAvatars = ["jormundgandr", "tanuki", "squitonkey", "totter", "pixiu"];
    const botNames = ["Bot Sigurd", "Bot Freja", "Bot Thor", "Bot Odin"];

    for (let i = 1; i < count; i++) {
      const cfg = PLAYER_DEFAULTS[i];
      state.players.push({
        id: `bot_${i}`,
        name: botNames[i - 1],
        avatar: botAvatars[i - 1],
        color: cfg.color,
        colorName: cfg.colorName,
        pos: [...cfg.start],
        walls: wallsCount,
        goalDesc: cfg.goalDesc,
        isHost: false,
        isBot: true,
      });
    }

    state.gameActive = true;
    clearStagedWall();
    setActionState("pawn");

    el.btnLeaveRoomHeader.classList.remove("hidden");
    showView("game");
    renderGameBoard();
    soundEngine.playTurn();
  }

  // --- BOT AI DECISION ENGINE ---
  function triggerBotTurnIfNeeded() {
    if (state.mode !== "bot" || !state.gameActive || state.isBotThinking) return;

    const curPlayer = state.players[state.currentTurn];
    if (!curPlayer || !curPlayer.isBot) return;

    state.isBotThinking = true;
    el.turnLabel.textContent = `${curPlayer.name} tenker…`;

    setTimeout(() => {
      executeBotMove(curPlayer);
      state.isBotThinking = false;
    }, Math.floor(Math.random() * 400) + 600);
  }

  function executeBotMove(botPlayer) {
    const wallsSet = new Set(state.walls.map(w => `${w.r},${w.c},${w.orientation}`));
    const allPos = state.players.map(p => p.pos);
    const validMoves = getValidPawnMoves(botPlayer.pos, allPos, wallsSet);
    const botGoalFn = PLAYER_DEFAULTS[state.currentTurn].goalFn;

    // Check if bot can win immediately with pawn move
    for (const [mr, mc] of validMoves) {
      if (botGoalFn(mr, mc)) {
        commitPawnMove(mr, mc);
        return;
      }
    }

    // Evaluate Human's distance vs Bot's distance
    const humanPlayer = state.players[0];
    const humanGoalFn = PLAYER_DEFAULTS[0].goalFn;
    const humanDist = getShortestPathDistance(humanPlayer.pos, humanGoalFn, wallsSet);
    const botDist = getShortestPathDistance(botPlayer.pos, botGoalFn, wallsSet);

    let placedWall = false;

    // Tactical Wall Consideration: If bot has walls and human is getting uncomfortably close
    if (botPlayer.walls > 0 && (humanDist <= 3 || (humanDist < botDist && state.botDifficulty === "hard"))) {
      // Find candidate walls near human
      const hr = humanPlayer.pos[0];
      const hc = humanPlayer.pos[1];
      const candidateIntersections = [
        [hr, hc - 1, "H"],
        [hr, hc, "H"],
        [hr - 1, hc, "V"],
        [hr, hc, "V"],
        [hr - 1, hc - 1, "H"],
        [hr, hc - 1, "V"],
      ];

      for (const [cwr, cwc, cori] of candidateIntersections) {
        if (cwr >= 0 && cwr <= 7 && cwc >= 0 && cwc <= 7) {
          const val = validateWallPlacement(cwr, cwc, cori, state.walls, state.players);
          if (val.ok) {
            // Check if placing this wall actually increases human distance
            const testSet = new Set(wallsSet);
            testSet.add(`${cwr},${cwc},${cori}`);
            const newHumanDist = getShortestPathDistance(humanPlayer.pos, humanGoalFn, testSet);
            const newBotDist = getShortestPathDistance(botPlayer.pos, botGoalFn, testSet);

            if (newHumanDist > humanDist && newBotDist < 900) {
              commitWallPlacement(cwr, cwc, cori);
              placedWall = true;
              break;
            }
          }
        }
      }
    }

    if (!placedWall) {
      // Advance along pawn shortest path
      let bestMove = validMoves[0];
      let bestDist = 999;

      for (const m of validMoves) {
        const d = getShortestPathDistance(m, botGoalFn, wallsSet);
        if (d < bestDist) {
          bestDist = d;
          bestMove = m;
        }
      }

      if (bestMove) {
        commitPawnMove(bestMove[0], bestMove[1]);
      }
    }
  }

  // --- GAMEPLAY INTERACTIONS (Pawn Moves & Wall Placements) ---
  function updateOrientationUI() {
    const isH = state.wallOrientation === "H";
    const label = isH ? "Horisontal" : "Vertikal";
    if (el.labelOrientation) el.labelOrientation.textContent = label;
    if (el.dockRotateTitle) el.dockRotateTitle.textContent = `Retning: ${label}`;
    if (el.dockRotateBadge) el.dockRotateBadge.textContent = isH ? "↔" : "↕";
  }

  function toggleWallOrientation() {
    state.wallOrientation = state.wallOrientation === "H" ? "V" : "H";
    updateOrientationUI();
    soundEngine.playWallRotate();

    if (state.stagedWall) {
      state.stagedWall.orientation = state.wallOrientation;
      updateStagedWallView();
    } else if (state.hoveredIntersection) {
      onGrooveHover(state.hoveredIntersection[0], state.hoveredIntersection[1]);
    }
  }

  function showGhostWallTooltip(msg, r, c, isStaged) {
    if (!el.ghostWallTooltip) return;
    el.ghostWallTooltip.textContent = msg;
    const topPct = ((r + 1) / 9) * 100;
    const leftPct = ((c + 1) / 9) * 100;
    el.ghostWallTooltip.style.top = `${topPct}%`;
    el.ghostWallTooltip.style.left = `${leftPct}%`;

    // Position above or below depending on row and if toolbar is visible
    if (r === 0) {
      el.ghostWallTooltip.style.transform = isStaged ? "translate(-50%, 150%)" : "translate(-50%, 80%)";
    } else {
      el.ghostWallTooltip.style.transform = isStaged ? "translate(-50%, -240%)" : "translate(-50%, -150%)";
    }
    el.ghostWallTooltip.classList.remove("hidden");
  }

  function hideGhostWallTooltip() {
    if (el.ghostWallTooltip) el.ghostWallTooltip.classList.add("hidden");
  }

  function stageWall(r, c, orientation) {
    state.stagedWall = { r, c, orientation: orientation || state.wallOrientation };
    updateStagedWallView();
  }

  function clearStagedWall() {
    state.stagedWall = null;
    if (el.floatingWallToolbar) el.floatingWallToolbar.classList.add("hidden");
    hideGhostWallTooltip();
    clearGhostWall();
  }

  function updateStagedWallView() {
    if (!state.stagedWall) {
      clearStagedWall();
      return;
    }
    const { r, c, orientation } = state.stagedWall;
    renderGhostWall(r, c, orientation, true);

    const val = validateWallPlacement(r, c, orientation, state.walls, state.players);
    if (!val.ok) {
      showGhostWallTooltip(val.error || "Ugyldig veggplassering", r, c, true);
      if (el.btnFloatConfirm) {
        el.btnFloatConfirm.disabled = true;
      }
    } else {
      hideGhostWallTooltip();
      if (el.btnFloatConfirm) {
        el.btnFloatConfirm.disabled = false;
      }
    }

    if (el.floatingWallToolbar) {
      const topPct = ((r + 1) / 9) * 100;
      const leftPct = ((c + 1) / 9) * 100;
      el.floatingWallToolbar.style.top = `${topPct}%`;
      el.floatingWallToolbar.style.left = `${leftPct}%`;

      if (r === 0) {
        el.floatingWallToolbar.style.transform = "translate(-50%, 60%)";
      } else {
        el.floatingWallToolbar.style.transform = "translate(-50%, -140%)";
      }
      el.floatingWallToolbar.classList.remove("hidden");
    }
  }

  function confirmStagedWall() {
    if (!state.stagedWall) return;
    const { r, c, orientation } = state.stagedWall;
    const val = validateWallPlacement(r, c, orientation, state.walls, state.players);
    if (!val.ok) {
      soundEngine.playInvalid();
      showGhostWallTooltip(val.error || "Ugyldig vegg", r, c, true);
      return;
    }
    commitWallPlacement(r, c, orientation);
    clearStagedWall();
  }

  function setActionState(action) {
    state.actionState = action;
    el.btnModePawn.classList.toggle("active", action === "pawn");
    el.btnModeWall.classList.toggle("active", action === "wall");
    if (el.btnDockPawn) el.btnDockPawn.classList.toggle("active", action === "pawn");
    if (el.btnDockWall) el.btnDockWall.classList.toggle("active", action === "wall");

    if (el.boardWrapper) {
      el.boardWrapper.classList.toggle("wall-mode-active", action === "wall");
    }

    if (action === "pawn") {
      clearStagedWall();
    }

    renderBoardHighlights();
  }

  function onCellClicked(r, c) {
    if (!state.gameActive) return;

    // Check if it's user's turn
    if (state.mode === "online") {
      if (state.role === "spectator" || state.playerIndex !== state.currentTurn) return;
    } else if (state.mode === "bot") {
      if (state.currentTurn !== 0) return;
    }

    const curPlayer = state.players[state.currentTurn];
    if (!curPlayer) return;

    // If clicking own pawn: ensure pawn move mode and clear staged wall
    if (curPlayer.pos[0] === r && curPlayer.pos[1] === c) {
      clearStagedWall();
      setActionState("pawn");
      soundEngine.playTurn();
      return;
    }

    const wallsSet = new Set(state.walls.map(w => `${w.r},${w.c},${w.orientation}`));
    const allPos = state.players.map(p => p.pos);
    const validMoves = getValidPawnMoves(curPlayer.pos, allPos, wallsSet);

    const isValid = validMoves.some(([mr, mc]) => mr === r && mc === c);
    if (isValid) {
      clearStagedWall();
      if (state.actionState !== "pawn") {
        setActionState("pawn");
      }
      commitPawnMove(r, c);
    } else {
      if (state.stagedWall) {
        clearStagedWall();
      } else if (state.actionState === "pawn") {
        soundEngine.playInvalid();
      }
    }
  }

  function onGrooveHover(r, c) {
    if (!state.gameActive) return;
    state.hoveredIntersection = [r, c];

    // If a wall is currently staged, don't overwrite preview unless hovering staged wall
    if (state.stagedWall) return;

    const curPlayer = state.players[state.currentTurn];
    if (!curPlayer) return;

    if (curPlayer.walls <= 0) {
      showGhostWallTooltip("Ingen vegger igjen!", r, c, false);
      return;
    }

    renderGhostWall(r, c, state.wallOrientation, false);

    const val = validateWallPlacement(r, c, state.wallOrientation, state.walls, state.players);
    if (!val.ok) {
      showGhostWallTooltip(val.error, r, c, false);
    } else {
      hideGhostWallTooltip();
    }
  }

  function onGrooveLeave(r, c) {
    if (state.hoveredIntersection && state.hoveredIntersection[0] === r && state.hoveredIntersection[1] === c) {
      state.hoveredIntersection = null;
    }
    if (!state.stagedWall) {
      clearGhostWall();
      hideGhostWallTooltip();
    }
  }

  function onGrooveClick(r, c) {
    if (!state.gameActive) return;

    // Check if it's user's turn
    if (state.mode === "online") {
      if (state.role === "spectator" || state.playerIndex !== state.currentTurn) return;
    } else if (state.mode === "bot") {
      if (state.currentTurn !== 0) return;
    }

    const curPlayer = state.players[state.currentTurn];
    if (!curPlayer || curPlayer.walls <= 0) {
      soundEngine.playInvalid();
      showGhostWallTooltip("Du har ingen vegger igjen!", r, c, false);
      return;
    }

    // Automatically switch to wall mode if not already
    if (state.actionState !== "wall") {
      setActionState("wall");
    }

    // If clicking the currently staged wall: confirm placement immediately (fast double-click workflow)
    if (state.stagedWall && state.stagedWall.r === r && state.stagedWall.c === c) {
      confirmStagedWall();
      return;
    }

    // Otherwise, stage this new intersection
    stageWall(r, c, state.wallOrientation);
    soundEngine.playWallRotate();
  }

  // Commit Pawn Move (Dispatch online or apply locally)
  async function commitPawnMove(r, c) {
    soundEngine.playPawnMove();
    clearStagedWall();

    if (state.mode === "online") {
      try {
        const resp = await fetch("/api/korridorer/move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: state.roomCode,
            playerId: state.playerId,
            r: r,
            c: c,
          }),
        });
        const data = await resp.json();
        if (data.ok && data.state) {
          syncOnlineState(data.state);
        } else {
          soundEngine.playInvalid();
          alert(data.error || "Ugyldig trekk.");
        }
      } catch (err) {
        console.error(err);
      }
      return;
    }

    // Local / Bot mode
    const curPlayer = state.players[state.currentTurn];
    curPlayer.pos = [r, c];
    state.turnCount++;

    // Check victory
    const goalFn = PLAYER_DEFAULTS[state.currentTurn].goalFn;
    if (goalFn(r, c)) {
      state.gameActive = false;
      state.winner = curPlayer;
      renderGameBoard();
      showVictoryModal(curPlayer);
      return;
    }

    // Next turn
    state.currentTurn = (state.currentTurn + 1) % state.players.length;
    renderGameBoard();
    soundEngine.playTurn();
    triggerBotTurnIfNeeded();
  }

  // Commit Wall Placement (Dispatch online or apply locally)
  async function commitWallPlacement(r, c, orientation) {
    soundEngine.playWallPlace();
    clearStagedWall();

    if (state.mode === "online") {
      try {
        const resp = await fetch("/api/korridorer/wall", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: state.roomCode,
            playerId: state.playerId,
            r: r,
            c: c,
            orientation: orientation,
          }),
        });
        const data = await resp.json();
        if (data.ok && data.state) {
          syncOnlineState(data.state);
        } else {
          soundEngine.playInvalid();
          alert(data.error || "Ugyldig vegg.");
        }
      } catch (err) {
        console.error(err);
      }
      return;
    }

    // Local / Bot mode
    const curPlayer = state.players[state.currentTurn];
    curPlayer.walls = Math.max(0, curPlayer.walls - 1);
    state.walls.push({
      r: r,
      c: c,
      orientation: orientation,
      owner: curPlayer.id,
      color: curPlayer.color,
    });
    state.turnCount++;

    // Next turn
    state.currentTurn = (state.currentTurn + 1) % state.players.length;
    renderGameBoard();
    soundEngine.playTurn();
    triggerBotTurnIfNeeded();
  }

  // --- RENDERING ARENA & BOARD ---
  function renderGameBoard() {
    renderTopStatusBar();
    renderPlayersSideCards();
    renderBoardWalls();
    renderBoardPawns();
    renderBoardHighlights();
  }

  function renderTopStatusBar() {
    const curPlayer = state.players[state.currentTurn];
    if (!curPlayer) return;

    el.turnPawnImg.src = getMonImg(curPlayer.avatar);
    el.btnWallsCount.textContent = curPlayer.walls;
    if (el.dockWallsLeft) el.dockWallsLeft.textContent = curPlayer.walls;
    updateOrientationUI();

    if (state.mode === "online") {
      if (state.role === "spectator") {
        el.turnLabel.textContent = `${curPlayer.name}s tur`;
        el.turnSub.textContent = "Du er tilskuer.";
      } else if (state.playerIndex === state.currentTurn) {
        el.turnLabel.textContent = "DIN TUR!";
        el.turnSub.textContent =
          state.actionState === "pawn"
            ? "Klikk en rute for å flytte monsteret ditt (eller velg en vegg)."
            : "Klikk et kryss for å bygge en vegg (R / høyreklikk for å rotere).";
      } else {
        el.turnLabel.textContent = `${curPlayer.name}s tur`;
        el.turnSub.textContent = "Venter på trekk…";
      }
    } else {
      el.turnLabel.textContent = `${curPlayer.name}s tur`;
      el.turnSub.textContent =
        state.actionState === "pawn"
          ? "Klikk en rute for å flytte monsteret ditt (eller velg en vegg)."
          : "Klikk et kryss for å bygge en vegg (R / høyreklikk for å rotere).";
    }
  }

  function renderPlayersSideCards() {
    el.colPlayersLeft.innerHTML = "";
    el.colPlayersRight.innerHTML = "";

    state.players.forEach((p, idx) => {
      const isTurn = idx === state.currentTurn;
      const card = document.createElement("div");
      card.className = `player-game-card ${isTurn ? "active-turn" : ""}`;
      card.id = `playerCard_${idx}`;

      const totalWalls = state.players.length === 2 ? 10 : state.players.length === 3 ? 6 : 5;
      let slatsHtml = "";
      for (let s = 0; s < totalWalls; s++) {
        slatsHtml += `<div class="wall-slat ${s >= p.walls ? "used" : ""}"></div>`;
      }

      card.innerHTML = `
        <div class="pg-header">
          <div class="pg-avatar-wrap" style="border-color:${p.color};">
            <img src="${getMonImg(p.avatar)}" class="pg-avatar-img" alt="${p.name}" />
            ${p.isHost ? '<span class="pg-crown">👑</span>' : ""}
          </div>
          <div class="pg-info">
            <span class="pg-name">${p.name}</span>
            <span class="pg-goal">${p.goalDesc || ""}</span>
          </div>
        </div>
        <div class="pg-walls-rack">
          <div class="pg-walls-label">
            <span>Vegger:</span>
            <span><strong>${p.walls}</strong>/${totalWalls}</span>
          </div>
          <div class="pg-walls-slats">${slatsHtml}</div>
        </div>
      `;

      // Allow clicking on active player's rack or avatar to switch modes easily
      if (isTurn) {
        const rack = card.querySelector(".pg-walls-rack");
        if (rack) {
          rack.style.cursor = "pointer";
          rack.title = "Klikk for å bygge en vegg";
          rack.addEventListener("click", () => setActionState("wall"));
        }
        const avatarWrap = card.querySelector(".pg-avatar-wrap");
        if (avatarWrap) {
          avatarWrap.style.cursor = "pointer";
          avatarWrap.title = "Klikk for å flytte monsteret";
          avatarWrap.addEventListener("click", () => setActionState("pawn"));
        }
      }

      if (idx % 2 === 0) {
        el.colPlayersLeft.appendChild(card);
      } else {
        el.colPlayersRight.appendChild(card);
      }
    });
  }

  function renderBoardPawns() {
    // Remove existing pawns
    document.querySelectorAll(".pawn-token").forEach(pt => pt.remove());

    state.players.forEach((p, idx) => {
      const [r, c] = p.pos;
      const cell = document.getElementById(`cell_${r}_${c}`);
      if (!cell) return;

      const pawn = document.createElement("div");
      const isTurn = idx === state.currentTurn;
      pawn.className = `pawn-token ${isTurn ? "active-turn" : ""}`;
      pawn.style.borderColor = p.color;

      pawn.innerHTML = `
        <img src="${getMonImg(p.avatar)}" alt="${p.name}" />
        <span class="pawn-player-tag" style="background:${p.color};">P${idx + 1}</span>
      `;

      cell.appendChild(pawn);
    });
  }

  function renderBoardWalls() {
    el.boardWallsLayer.innerHTML = "";

    // Placed walls
    state.walls.forEach(w => {
      const wall = document.createElement("div");
      wall.className = `placed-wall wall-${w.orientation.toLowerCase()}`;

      // Calculate position and dimension
      // In 9x9 board with 8px gaps:
      // cell size: calc((100% - 64px) / 9)
      const r = w.r;
      const c = w.c;

      if (w.orientation === "H") {
        wall.style.top = `${((r + 1) / 9) * 100}%`;
        wall.style.left = `${(c / 9) * 100}%`;
        wall.style.width = `${(2 / 9) * 100}%`;
      } else {
        wall.style.left = `${((c + 1) / 9) * 100}%`;
        wall.style.top = `${(r / 9) * 100}%`;
        wall.style.height = `${(2 / 9) * 100}%`;
      }

      el.boardWallsLayer.appendChild(wall);
    });
  }

  function renderBoardHighlights() {
    // Clear previous cell highlights
    document.querySelectorAll(".board-cell").forEach(cell => {
      cell.classList.remove("valid-move");
      const ghost = cell.querySelector(".ghost-preview-pawn");
      if (ghost) ghost.remove();
    });

    if (!state.gameActive) return;

    // Check if it's user's turn
    const isMyTurn =
      state.mode === "online"
        ? state.playerIndex === state.currentTurn
        : state.mode === "bot"
        ? state.currentTurn === 0
        : true;

    if (!isMyTurn || state.actionState !== "pawn") return;

    const curPlayer = state.players[state.currentTurn];
    if (!curPlayer || !curPlayer.pos) return;
    const wallsSet = new Set(state.walls.map(w => `${w.r},${w.c},${w.orientation}`));
    const allPos = state.players.map(p => p.pos);
    const validMoves = getValidPawnMoves(curPlayer.pos, allPos, wallsSet);

    validMoves.forEach(([r, c]) => {
      const cell = document.getElementById(`cell_${r}_${c}`);
      if (cell) {
        cell.classList.add("valid-move");

        // Hover ghost pawn inside
        const ghost = document.createElement("img");
        ghost.src = getMonImg(curPlayer.avatar);
        ghost.className = "ghost-preview-pawn pawn-token";
        ghost.style.position = "absolute";
        ghost.style.inset = "8px";
        ghost.style.pointerEvents = "none";

        cell.appendChild(ghost);
      }
    });
  }

  function renderGhostWall(r, c, orientation, isStaged = false) {
    clearGhostWall();

    const val = validateWallPlacement(r, c, orientation, state.walls, state.players);
    const ghost = document.createElement("div");
    ghost.id = "activeGhostWall";
    ghost.className = `ghost-wall ${val.ok ? "valid" : "invalid"} ${isStaged ? "staged" : ""} wall-${orientation.toLowerCase()}`;

    if (orientation === "H") {
      ghost.style.top = `${((r + 1) / 9) * 100}%`;
      ghost.style.left = `${(c / 9) * 100}%`;
      ghost.style.width = `${(2 / 9) * 100}%`;
    } else {
      ghost.style.left = `${((c + 1) / 9) * 100}%`;
      ghost.style.top = `${(r / 9) * 100}%`;
      ghost.style.height = `${(2 / 9) * 100}%`;
    }

    el.boardWallsLayer.appendChild(ghost);
  }

  function clearGhostWall() {
    const existing = document.getElementById("activeGhostWall");
    if (existing) existing.remove();
  }

  // --- REACTIONS & CHAT ---
  async function sendReaction(emoji) {
    soundEngine.playReaction();

    if (state.mode === "online") {
      try {
        await fetch("/api/korridorer/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: state.roomCode,
            playerId: state.playerId,
            message: emoji,
          }),
        });
      } catch (err) {
        console.error(err);
      }
    } else {
      const curPlayer = state.players[state.currentTurn];
      showChatToast({
        sender: curPlayer ? curPlayer.name : "Deg",
        avatar: curPlayer ? curPlayer.avatar : "charbear",
        text: emoji,
      });
    }
  }

  function showChatToast(msg) {
    if (!el.chatToastContainer) return;
    const toast = document.createElement("div");
    toast.className = "chat-bubble-toast";
    toast.innerHTML = `
      <img src="${getMonImg(msg.avatar)}" class="chat-bubble-img" alt="" />
      <span class="chat-bubble-sender">${msg.sender}:</span>
      <span class="chat-bubble-text">${msg.text}</span>
    `;
    el.chatToastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  // --- VICTORY & REMATCH ---
  function showVictoryModal(winner) {
    soundEngine.playVictory();
    el.victoryWinnerImg.src = getMonImg(winner.avatar);
    el.victoryTitle.textContent = `${winner.name} Vinner!`;
    el.victoryDesc.textContent = `Gratulerer! ${winner.name} manøvrerte monsteret sitt i mål over brettet!`;

    el.statTurnCount.textContent = state.turnCount;
    el.statWallsPlaced.textContent = state.walls.length;

    el.modalVictory.classList.remove("hidden");
  }

  async function handleRequestRematch() {
    if (state.mode === "online") {
      try {
        const resp = await fetch("/api/korridorer/rematch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: state.roomCode,
            playerId: state.playerId,
          }),
        });
        const data = await resp.json();
        if (data.ok && data.state) {
          syncOnlineState(data.state);
        }
      } catch (err) {
        console.error(err);
      }
    } else if (state.mode === "local") {
      handleStartLocalGame();
    } else if (state.mode === "bot") {
      handleStartBotGame();
    }
  }

  function leaveToLobby() {
    if (state.pollTimer) clearInterval(state.pollTimer);
    state.pollTimer = null;
    state.roomCode = null;
    state.gameActive = false;
    state.winner = null;
    clearStagedWall();

    // Remove ?room query param without full page reload
    window.history.replaceState({}, document.title, window.location.pathname);
    el.btnLeaveRoomHeader.classList.add("hidden");
    showView("lobby");
  }

  function showView(viewName) {
    el.viewLobby.classList.add("hidden");
    el.viewWaitingRoom.classList.add("hidden");
    el.viewGame.classList.add("hidden");

    if (viewName === "lobby") {
      el.viewLobby.classList.remove("hidden");
    } else if (viewName === "waiting") {
      el.viewWaitingRoom.classList.remove("hidden");
    } else if (viewName === "game") {
      el.viewGame.classList.remove("hidden");
    }
  }

  // Run on startup
  window.addEventListener("DOMContentLoaded", init);
})();
