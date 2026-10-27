/**
 * Party Lounge & Multi-Device Lobby Client
 */

(() => {
  "use strict";

  const MONS = [
    { id: "charbear", name: "Charbear", img: "/assets/mons/charbear.png" },
    { id: "jormundgandr", name: "Jørmungandr", img: "/assets/mons/jormundgandr.png" },
    { id: "pixiu", name: "Pixiu", img: "/assets/mons/pixiu.png" },
    { id: "squitonkey", name: "Squitonkey", img: "/assets/mons/squitonkey.png" },
    { id: "tanuki", name: "Tanuki", img: "/assets/mons/tanuki.png" },
    { id: "totter", name: "Totter", img: "/assets/mons/totter.png" },
  ];

  function getMonImg(avatar) {
    if (!avatar) return "/assets/mons/charbear.png";
    if (avatar.startsWith("/") || avatar.startsWith("data:") || avatar.endsWith(".png")) return avatar;
    const found = MONS.find(m => m.id === avatar);
    return found ? found.img : `/assets/mons/${avatar}.png`;
  }

  function renderAvatarHtml(avatar, extraClass = "") {
    const src = getMonImg(avatar);
    return `<img src="${src}" alt="Monster" class="player-mon-img ${extraClass}" />`;
  }

  // State
  const state = {
    roomCode: null,
    hostToken: null,
    playerId: null,
    playerName: null,
    avatar: "charbear",
    isHost: false,
    version: 0,
    pollTimer: null,
    isPolling: false,
  };

  // Elements
  const el = {
    viewAuth: document.getElementById("viewAuth"),
    viewLobby: document.getElementById("viewLobby"),
    tabJoin: document.getElementById("tabJoin"),
    tabCreate: document.getElementById("tabCreate"),
    contentJoin: document.getElementById("contentJoin"),
    contentCreate: document.getElementById("contentCreate"),
    formJoin: document.getElementById("formJoin"),
    formCreate: document.getElementById("formCreate"),
    inputJoinCode: document.getElementById("inputJoinCode"),
    inputJoinName: document.getElementById("inputJoinName"),
    inputCreateName: document.getElementById("inputCreateName"),
    avatarPickerJoin: document.getElementById("avatarPickerJoin"),
    avatarPickerCreate: document.getElementById("avatarPickerCreate"),
    btnSubmitJoin: document.getElementById("btnSubmitJoin"),
    btnSubmitCreate: document.getElementById("btnSubmitCreate"),

    roomCodeDisplay: document.getElementById("roomCodeDisplay"),
    domainHostDisplay: document.getElementById("domainHostDisplay"),
    btnCopyLink: document.getElementById("btnCopyLink"),
    playersCountNum: document.getElementById("playersCountNum"),
    hostHint: document.getElementById("hostHint"),
    playersGrid: document.getElementById("playersGrid"),
    sectionGameSelector: document.getElementById("sectionGameSelector"),
    playerWaitingBox: document.getElementById("playerWaitingBox"),
    btnStartOrdbombe: document.getElementById("btnStartOrdbombe"),
    selectTimerParty: document.getElementById("selectTimerParty"),
    selectDiffParty: document.getElementById("selectDiffParty"),
    btnStartTegnOgGjett: document.getElementById("btnStartTegnOgGjett"),
    selectTimerDraw: document.getElementById("selectTimerDraw"),
    selectRoundsDraw: document.getElementById("selectRoundsDraw"),
    btnStartSjakk: document.getElementById("btnStartSjakk"),
    selectTimerSjakk: document.getElementById("selectTimerSjakk"),
    btnLeaveRoom: document.getElementById("btnLeaveRoom"),
    connStatusText: document.getElementById("connStatusText"),
  };

  // Render Avatar pickers
  function renderAvatarPicker(container, selectedAvatar, onSelect) {
    if (!container) return;
    container.innerHTML = "";
    MONS.forEach(mon => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = `avatar-chip ${mon.id === selectedAvatar ? "selected" : ""}`;
      chip.title = mon.name;
      chip.innerHTML = `<img src="${mon.img}" alt="${mon.name}" class="mon-picker-img" />`;
      chip.addEventListener("click", () => {
        container.querySelectorAll(".avatar-chip").forEach(c => c.classList.remove("selected"));
        chip.classList.add("selected");
        onSelect(mon.id);
      });
      container.appendChild(chip);
    });
  }

  let selectedJoinAvatar = "jormundgandr";
  let selectedCreateAvatar = "charbear";

  renderAvatarPicker(el.avatarPickerJoin, selectedJoinAvatar, av => selectedJoinAvatar = av);
  renderAvatarPicker(el.avatarPickerCreate, selectedCreateAvatar, av => selectedCreateAvatar = av);

  // Tabs switching (Join / Create)
  el.tabJoin.addEventListener("click", () => {
    el.tabJoin.classList.add("active");
    el.tabCreate.classList.remove("active");
    el.contentJoin.classList.remove("hidden");
    el.contentCreate.classList.add("hidden");
  });

  el.tabCreate.addEventListener("click", () => {
    el.tabCreate.classList.add("active");
    el.tabJoin.classList.remove("active");
    el.contentCreate.classList.remove("hidden");
    el.contentJoin.classList.add("hidden");
  });

  // Display domain host in instructions
  if (el.domainHostDisplay) {
    el.domainHostDisplay.textContent = `${window.location.host}/party/`;
  }

  // Create Room Handler
  el.formCreate.addEventListener("submit", async (e) => {
    e.preventDefault();
    const hostName = el.inputCreateName.value.trim() || "Vert";
    el.btnSubmitCreate.disabled = true;
    el.btnSubmitCreate.textContent = "Oppretter rom…";

    try {
      const resp = await fetch("/api/party/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostName: hostName,
          avatar: selectedCreateAvatar,
        }),
      });

      const data = await resp.json();
      if (!data.ok) {
        alert(data.error || "Kunne ikke opprette rom.");
        el.btnSubmitCreate.disabled = false;
        el.btnSubmitCreate.textContent = "Opprett rom 🎉";
        return;
      }

      state.roomCode = data.roomCode;
      state.hostToken = data.hostToken;
      state.playerId = data.playerId;
      state.playerName = hostName;
      state.avatar = selectedCreateAvatar;
      state.isHost = true;

      saveSession();
      enterLobbyView();
    } catch (err) {
      console.error(err);
      alert("Nettverksfeil ved oppretting av rom.");
    } finally {
      el.btnSubmitCreate.disabled = false;
      el.btnSubmitCreate.textContent = "Opprett rom 🎉";
    }
  });

  // Join Room Handler
  el.formJoin.addEventListener("submit", async (e) => {
    e.preventDefault();
    const code = el.inputJoinCode.value.trim().toUpperCase();
    const playerName = el.inputJoinName.value.trim() || "Spiller";

    if (!code) {
      alert("Vennligst skriv inn en romkode.");
      return;
    }

    el.btnSubmitJoin.disabled = true;
    el.btnSubmitJoin.textContent = "Kobler til…";

    try {
      const resp = await fetch("/api/party/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: code,
          playerName: playerName,
          avatar: selectedJoinAvatar,
        }),
      });

      const data = await resp.json();
      if (!data.ok) {
        alert(data.error || "Fant ikke rommet.");
        el.btnSubmitJoin.disabled = false;
        el.btnSubmitJoin.textContent = "Bli med i festen 🚀";
        return;
      }

      state.roomCode = data.roomCode;
      state.hostToken = null;
      state.playerId = data.playerId;
      state.playerName = data.playerName;
      state.avatar = data.avatar;
      state.isHost = false;

      saveSession();
      enterLobbyView();
    } catch (err) {
      console.error(err);
      alert("Nettverksfeil ved tilkobling til rom.");
    } finally {
      el.btnSubmitJoin.disabled = false;
      el.btnSubmitJoin.textContent = "Bli med i festen 🚀";
    }
  });

  function saveSession() {
    sessionStorage.setItem("party_room_code", state.roomCode || "");
    sessionStorage.setItem("party_player_id", state.playerId || "");
    sessionStorage.setItem("party_player_name", state.playerName || "");
    sessionStorage.setItem("party_avatar", state.avatar || "");
    if (state.hostToken) {
      sessionStorage.setItem("party_host_token", state.hostToken);
    } else {
      sessionStorage.removeItem("party_host_token");
    }
  }

  function loadSession() {
    const code = sessionStorage.getItem("party_room_code");
    const pId = sessionStorage.getItem("party_player_id");
    const pName = sessionStorage.getItem("party_player_name");
    const av = sessionStorage.getItem("party_avatar");
    const hToken = sessionStorage.getItem("party_host_token");

    if (code && pId) {
      state.roomCode = code;
      state.playerId = pId;
      state.playerName = pName || "Spiller";
      state.avatar = av || "charbear";
      state.hostToken = hToken || null;
      state.isHost = !!hToken;
      return true;
    }
    return false;
  }

  function enterLobbyView() {
    el.viewAuth.classList.add("hidden");
    el.viewLobby.classList.remove("hidden");

    el.roomCodeDisplay.textContent = state.roomCode;
    el.hostHint.textContent = state.isHost ? "Du er vert 👑" : `Tilkoblet som ${state.playerName}`;

    // Adjust views depending on whether client is host or normal player
    if (state.isHost) {
      el.sectionGameSelector.classList.remove("hidden");
      el.playerWaitingBox.classList.add("hidden");
    } else {
      el.sectionGameSelector.classList.add("hidden");
      el.playerWaitingBox.classList.remove("hidden");
    }

    // Update URL without reloading
    const newUrl = `${window.location.pathname}?code=${state.roomCode}`;
    history.replaceState(null, "", newUrl);

    startPolling();
  }

  // Polling loop to sync room state in real-time
  function startPolling() {
    if (state.isPolling) return;
    state.isPolling = true;

    async function poll() {
      if (!state.roomCode || !state.playerId) return;

      try {
        const url = `/api/party/state?code=${encodeURIComponent(state.roomCode)}&playerId=${encodeURIComponent(state.playerId)}&v=${state.version}`;
        const resp = await fetch(url);

        if (resp.status === 404) {
          // Room expired or deleted
          alert("Party-rommet er ikke lenger tilgjengelig.");
          leaveRoom();
          return;
        }

        const data = await resp.json();
        if (data.ok) {
          state.version = data.version;
          state.isHost = data.isHost;

          updateLobbyUI(data);

          // Check if active game was launched!
          if (data.currentGame === "ordbombe") {
            // Redirect to Ordbombe in room mode!
            const target = `/ordbombe/?room=${encodeURIComponent(state.roomCode)}&player=${encodeURIComponent(state.playerId)}`;
            window.location.href = target;
            return;
          }

          if (data.currentGame === "tegn_og_gjett") {
            // Redirect to Tegn & Gjett in room mode!
            const target = `/tegn-og-gjett/?room=${encodeURIComponent(state.roomCode)}&player=${encodeURIComponent(state.playerId)}`;
            window.location.href = target;
            return;
          }

          if (data.currentGame === "sjakk") {
            // Redirect to Sjakk in room mode!
            const target = `/sjakk/?room=${encodeURIComponent(state.roomCode)}&player=${encodeURIComponent(state.playerId)}`;
            window.location.href = target;
            return;
          }
        }
      } catch (err) {
        console.warn("Poll connection hiccup:", err);
        el.connStatusText.textContent = "Kobler til på nytt…";
      }

      state.pollTimer = setTimeout(poll, 800);
    }

    poll();
  }

  function stopPolling() {
    state.isPolling = false;
    if (state.pollTimer) {
      clearTimeout(state.pollTimer);
      state.pollTimer = null;
    }
  }

  function updateLobbyUI(room) {
    el.connStatusText.textContent = "Live";
    el.playersCountNum.textContent = String(room.playerCount || 1);

    // Render players grid
    el.playersGrid.innerHTML = "";
    (room.players || []).forEach(p => {
      const tile = document.createElement("div");
      tile.className = `player-tile ${p.isHost ? "is-host" : ""}`;
      tile.innerHTML = `
        ${p.isHost ? '<span class="player-crown-badge">VERT</span>' : ''}
        <div class="player-avatar-circle" style="border-color: ${p.color || '#3b5080'}">${renderAvatarHtml(p.avatar)}</div>
        <div class="player-name-text">${escapeHtml(p.name)}</div>
      `;
      el.playersGrid.appendChild(tile);
    });

    // If host status changed
    if (room.isHost && !state.isHost) {
      state.isHost = true;
      el.sectionGameSelector.classList.remove("hidden");
      el.playerWaitingBox.classList.add("hidden");
      el.hostHint.textContent = "Du er nå vert 👑";
    }
  }

  // Host launches Ordbombe
  el.btnStartOrdbombe.addEventListener("click", async () => {
    if (!state.isHost || !state.hostToken) return;

    el.btnStartOrdbombe.disabled = true;
    el.btnStartOrdbombe.textContent = "Starter spill…";

    const turnDuration = parseFloat(el.selectTimerParty.value) || 6.0;
    const difficulty = el.selectDiffParty.value || "medium";

    try {
      const resp = await fetch("/api/party/select-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: state.roomCode,
          hostToken: state.hostToken,
          gameId: "ordbombe",
          settings: {
            turnDuration: turnDuration,
            difficulty: difficulty,
          },
        }),
      });

      const data = await resp.json();
      if (!data.ok) {
        alert(data.error || "Kunne ikke starte spillet.");
        el.btnStartOrdbombe.disabled = false;
        el.btnStartOrdbombe.textContent = "Start Ordbombe 💣";
        return;
      }

      // Transition self immediately
      window.location.href = `/ordbombe/?room=${encodeURIComponent(state.roomCode)}&player=${encodeURIComponent(state.playerId)}`;
    } catch (err) {
      console.error(err);
      alert("Feil ved start av spill.");
      el.btnStartOrdbombe.disabled = false;
      el.btnStartOrdbombe.textContent = "Start Ordbombe 💣";
    }
  });

  // Host launches Tegn & Gjett
  if (el.btnStartTegnOgGjett) {
    el.btnStartTegnOgGjett.addEventListener("click", async () => {
      if (!state.isHost || !state.hostToken) return;

      el.btnStartTegnOgGjett.disabled = true;
      el.btnStartTegnOgGjett.textContent = "Starter spill…";

      const drawTime = parseInt(el.selectTimerDraw?.value || "80", 10);
      const rounds = parseInt(el.selectRoundsDraw?.value || "3", 10);

      try {
        const resp = await fetch("/api/party/select-game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: state.roomCode,
            hostToken: state.hostToken,
            gameId: "tegn_og_gjett",
            settings: {
              drawTime: drawTime,
              rounds: rounds,
            },
          }),
        });

        const data = await resp.json();
        if (!data.ok) {
          alert(data.error || "Kunne ikke starte Tegn & Gjett.");
          el.btnStartTegnOgGjett.disabled = false;
          el.btnStartTegnOgGjett.textContent = "Start Tegn & Gjett 🎨";
          return;
        }

        // Transition self immediately
        window.location.href = `/tegn-og-gjett/?room=${encodeURIComponent(state.roomCode)}&player=${encodeURIComponent(state.playerId)}`;
      } catch (err) {
        console.error(err);
        alert("Feil ved start av spill.");
        el.btnStartTegnOgGjett.disabled = false;
        el.btnStartTegnOgGjett.textContent = "Start Tegn & Gjett 🎨";
      }
    });
  }

  // Host launches Sjakk
  if (el.btnStartSjakk) {
    el.btnStartSjakk.addEventListener("click", async () => {
      if (!state.isHost || !state.hostToken) return;

      el.btnStartSjakk.disabled = true;
      el.btnStartSjakk.textContent = "Starter spill…";

      const timeControl = parseInt(el.selectTimerSjakk?.value || "300", 10);

      try {
        const resp = await fetch("/api/party/select-game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: state.roomCode,
            hostToken: state.hostToken,
            gameId: "sjakk",
            settings: {
              timeControl: timeControl,
            },
          }),
        });

        const data = await resp.json();
        if (!data.ok) {
          alert(data.error || "Kunne ikke starte Sjakk.");
          el.btnStartSjakk.disabled = false;
          el.btnStartSjakk.textContent = "Start Sjakk ♟️";
          return;
        }

        // Transition self immediately
        window.location.href = `/sjakk/?room=${encodeURIComponent(state.roomCode)}&player=${encodeURIComponent(state.playerId)}`;
      } catch (err) {
        console.error(err);
        alert("Feil ved start av spill.");
        el.btnStartSjakk.disabled = false;
        el.btnStartSjakk.textContent = "Start Sjakk ♟️";
      }
    });
  }

  // Copy invitation link
  el.btnCopyLink.addEventListener("click", async () => {
    const joinUrl = `${window.location.origin}/party/?code=${encodeURIComponent(state.roomCode)}`;
    try {
      await navigator.clipboard.writeText(joinUrl);
      const originalText = el.btnCopyLink.textContent;
      el.btnCopyLink.textContent = "✓ Kopiert!";
      setTimeout(() => el.btnCopyLink.textContent = originalText, 2000);
    } catch (e) {
      prompt("Kopier denne lenken:", joinUrl);
    }
  });

  // Leave room
  async function leaveRoom() {
    stopPolling();
    if (state.roomCode && state.playerId) {
      try {
        await fetch("/api/party/leave", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: state.roomCode,
            playerId: state.playerId,
          }),
        });
      } catch (e) { }
    }

    sessionStorage.clear();
    state.roomCode = null;
    state.hostToken = null;
    state.playerId = null;
    state.isHost = false;

    el.viewLobby.classList.add("hidden");
    el.viewAuth.classList.remove("hidden");
    history.replaceState(null, "", window.location.pathname);
  }

  el.btnLeaveRoom.addEventListener("click", () => {
    if (confirm("Er du sikker på at du vil forlate party-rommet?")) {
      leaveRoom();
    }
  });

  // Cheer / reaction button animations
  document.querySelectorAll(".cheer-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      btn.style.transform = "scale(1.4)";
      setTimeout(() => btn.style.transform = "", 200);
    });
  });

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, m => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[m]);
  }

  // Initialization: check query params (?code=ABCD or ?room=ABCD)
  const urlParams = new URLSearchParams(window.location.search);
  const codeParam = (urlParams.get("code") || urlParams.get("room") || "").trim().toUpperCase();

  if (loadSession()) {
    enterLobbyView();
  } else if (codeParam) {
    el.inputJoinCode.value = codeParam;
    el.tabJoin.click();
    el.inputJoinName.focus();
  }

})();
