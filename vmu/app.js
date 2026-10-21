/**
 * TYPESCRIPT KAHOOT ARENA - GERÇEK ZAMANLI YARIŞMA VE KATILIMCI ONAY MOTORU
 * Çift Ekran (Tahta / Host Ekranı & Katılımcı / Oyuncu Ekranı)
 * Hibrit Gerçek Zamanlı Senkronizasyon: PeerJS (WebRTC) + BroadcastChannel + LocalStorage
 */

const TEACHER_PASSWORD = "vm2627";
const DEFAULT_ROOM_PIN = "2627";

const STORAGE_KEYS = {
  ROOM_STATE: "ts_kahoot_arena_room_state_v1",
  THEME: "mining_workshop_theme_v5",
  HOST_UNLOCKED: "ts_kahoot_host_unlocked_v1",
  PLAYER_SESSION: "ts_kahoot_player_session_v1"
};

// ==========================================================================
// UYGULAMA DURUMU (STATE)
// ==========================================================================
const appState = {
  viewMode: "player", // "player" | "host"
  isHostUnlocked: false,
  theme: "dark",

  // Oda / Sunucu Durumu (Host tarafından yönetilir ve tüm istemcilere senkronize edilir)
  room: {
    pin: DEFAULT_ROOM_PIN,
    phase: "LOBBY", // "LOBBY" | "QUESTION_ACTIVE" | "QUESTION_REVEAL" | "FINAL_PODIUM"
    currentQuestionIndex: 0,
    questionStartTime: null,
    questionDuration: 30,
    remainingSeconds: 30,
    players: {}, // { playerId: { id, name, status: 'pending'|'approved'|'rejected', score: 0, correctCount: 0, wrongCount: 0, joinedAt, answers: { [qId]: { option, timeMs, isCorrect, points } } } }
    updatedAt: Date.now()
  },

  // Bu sekmedeki Katılımcı (Oyuncu) Kimliği
  localPlayer: {
    id: null,
    name: "",
    pin: DEFAULT_ROOM_PIN
  },

  // Zamanlayıcılar ve Bağlantı Nesneleri
  timerInterval: null,
  heartbeatInterval: null,
  bc: null,
  peer: null,
  hostConnections: {}, // Host tarafında bağlı PeerJS istemcileri: { peerId: DataConnection }
  playerConn: null     // Oyuncu tarafında Host'a olan PeerJS bağlantısı
};

// ==========================================================================
// YARDIMCI FONKSİYONLAR
// ==========================================================================
function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
    toast.style.transition = "all 0.25s ease";
    setTimeout(() => toast.remove(), 260);
  }, 3200);
}

function generatePlayerId() {
  return "plr_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now().toString(36).slice(-4);
}

// ==========================================================================
// TEMA YÖNETİMİ (KOYU & AÇIK TEMA)
// ==========================================================================
function initTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || "dark";
  applyTheme(savedTheme);
}

function applyTheme(theme) {
  appState.theme = theme;
  const body = document.body;
  const themeText = document.getElementById("themeText");
  const themeIcon = document.getElementById("themeIcon");

  if (theme === "light") {
    body.classList.add("theme-light");
    body.classList.remove("theme-dark");
    if (themeText) themeText.textContent = "Koyu Tema";
    if (themeIcon) {
      themeIcon.innerHTML = `<svg class="ui-icon" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
    }
  } else {
    body.classList.remove("theme-light");
    body.classList.add("theme-dark");
    if (themeText) themeText.textContent = "Açık Tema";
    if (themeIcon) {
      themeIcon.innerHTML = `<svg class="ui-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
    }
  }
  localStorage.setItem(STORAGE_KEYS.THEME, theme);
}

function toggleTheme() {
  applyTheme(appState.theme === "dark" ? "light" : "dark");
}

// ==========================================================================
// YEREL DEPOLAMA & OTURUM YÖNETİMİ
// ==========================================================================
function loadInitialState() {
  // Oda durumunu yükle
  try {
    const savedRoom = localStorage.getItem(STORAGE_KEYS.ROOM_STATE);
    if (savedRoom) {
      const parsed = JSON.parse(savedRoom);
      if (parsed && parsed.players) {
        appState.room = {
          ...appState.room,
          ...parsed
        };
      }
    }
  } catch (e) {
    console.warn("Oda durumu yüklenemedi:", e);
  }

  // Bu sekmenin oyuncu oturumunu yükle (Her sekme bağımsız oyuncu olabilir)
  try {
    const savedPlayer = sessionStorage.getItem(STORAGE_KEYS.PLAYER_SESSION);
    if (savedPlayer) {
      const parsedPlayer = JSON.parse(savedPlayer);
      if (parsedPlayer && parsedPlayer.id) {
        appState.localPlayer = parsedPlayer;
      }
    }
  } catch (e) {
    console.warn("Oyuncu oturumu yüklenemedi:", e);
  }

  if (!appState.localPlayer.id) {
    appState.localPlayer.id = generatePlayerId();
    saveLocalPlayerSession();
  }

  // URL parametrelerini kontrol et
  const params = new URLSearchParams(window.location.search);
  const urlPin = params.get("pin");
  if (urlPin) {
    appState.localPlayer.pin = urlPin.trim();
  }

  const unlocked = sessionStorage.getItem(STORAGE_KEYS.HOST_UNLOCKED) === "true";
  appState.isHostUnlocked = unlocked;

  const requestedMode = params.get("mode");
  if (requestedMode === "player") {
    appState.viewMode = "player";
  } else if (requestedMode === "host" && unlocked) {
    appState.viewMode = "host";
  }
}

function saveRoomStateToStorage() {
  appState.room.updatedAt = Date.now();
  try {
    localStorage.setItem(STORAGE_KEYS.ROOM_STATE, JSON.stringify(appState.room));
  } catch (e) {
    console.warn("Oda durumu kaydedilemedi:", e);
  }
}

function saveLocalPlayerSession() {
  try {
    sessionStorage.setItem(STORAGE_KEYS.PLAYER_SESSION, JSON.stringify(appState.localPlayer));
  } catch (e) {
    console.warn("Oyuncu oturumu kaydedilemedi:", e);
  }
}

// ==========================================================================
// HİBRİT GERÇEK ZAMANLI HABERLEŞME (BROADCASTCHANNEL + LOCALSTORAGE + PEERJS)
// ==========================================================================
function initRealtimeNetwork() {
  // 1. BroadcastChannel (Aynı bilgisayar / tarayıcıdaki sekmeler arası anlık iletişim)
  if ("BroadcastChannel" in window) {
    appState.bc = new BroadcastChannel("ts_kahoot_arena_channel_v1");
    appState.bc.onmessage = (event) => {
      if (event && event.data) {
        handleIncomingNetworkMessage(event.data);
      }
    };
  }

  // 2. LocalStorage 'storage' Event (Yedek sekme senkronizasyonu)
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEYS.ROOM_STATE && event.newValue) {
      try {
        const updatedRoom = JSON.parse(event.newValue);
        if (updatedRoom) {
          appState.room = updatedRoom;
          renderAll();
        }
      } catch (err) {
        // ignore
      }
    }
  });

  // 3. PeerJS (Farklı telefon / bilgisayarlardan WebRTC üzerinden bağlantı)
  initPeerJsConnection();

  // 4. Periyodik Senkronizasyon & Geri Sayım Kontrolü
  appState.heartbeatInterval = setInterval(() => {
    if (appState.viewMode === "player") {
      const me = appState.room.players[appState.localPlayer.id];
      // Eğer oyuncu adını yazmış ama henüz Host listesinde yoksa isteği tekrar yayınla
      if (appState.localPlayer.name && !me && appState.localPlayer.PendingRequest) {
        sendNetworkMessage({
          type: "JOIN_REQUEST",
          playerId: appState.localPlayer.id,
          name: appState.localPlayer.name,
          pin: appState.localPlayer.pin || DEFAULT_ROOM_PIN
        });
      }
    }
  }, 2500);
}

function getHostPeerId(pin) {
  const cleanPin = String(pin || DEFAULT_ROOM_PIN).trim().replace(/[^a-zA-Z0-9]/g, "");
  return `vmu-ts-kahoot-room-${cleanPin || DEFAULT_ROOM_PIN}`;
}

function initPeerJsConnection() {
  if (typeof Peer === "undefined") {
    // PeerJS henüz yüklenmediyse kısa süre sonra tekrar dene
    setTimeout(initPeerJsConnection, 600);
    return;
  }

  if (appState.viewMode === "host") {
    setupHostPeer();
  } else {
    setupPlayerPeer();
  }
}

function setupHostPeer() {
  if (appState.peer && !appState.peer.destroyed) {
    appState.peer.destroy();
  }

  const targetPeerId = getHostPeerId(appState.room.pin);
  try {
    const peer = new Peer(targetPeerId);
    appState.peer = peer;

    peer.on("open", () => {
      updateConnectionBadge("CANLI TAHTA AKTİF", true);
    });

    peer.on("connection", (conn) => {
      appState.hostConnections[conn.peer] = conn;

      conn.on("open", () => {
        // Bağlanan istemciye anında mevcut oda durumunu gönder
        conn.send({
          type: "ROOM_SYNC",
          room: appState.room
        });
      });

      conn.on("data", (data) => {
        handleIncomingNetworkMessage(data, conn);
      });

      conn.on("close", () => {
        delete appState.hostConnections[conn.peer];
      });
    });

    peer.on("error", (err) => {
      // Eğer aynı bilgisayarda başka sekmede Host açıksa BroadcastChannel zaten çalışır
      console.info("PeerJS durum notu:", err.type);
      updateConnectionBadge("YEREL AĞ / SEKME AKTİF", true);
    });
  } catch (e) {
    console.warn("PeerJS başlatılamadı:", e);
  }
}

function setupPlayerPeer() {
  if (appState.peer && !appState.peer.destroyed) {
    return;
  }

  try {
    const peer = new Peer();
    appState.peer = peer;

    peer.on("open", () => {
      connectPlayerToHostPeer(appState.localPlayer.pin || DEFAULT_ROOM_PIN);
    });

    peer.on("error", () => {
      updateConnectionBadge("SEKME SENKRON AKTİF", true);
    });
  } catch (e) {
    console.warn("Oyuncu PeerJS hatası:", e);
  }
}

function connectPlayerToHostPeer(pin) {
  if (!appState.peer || appState.peer.destroyed) return;
  const hostPeerId = getHostPeerId(pin);

  try {
    const conn = appState.peer.connect(hostPeerId, { reliable: true });
    appState.playerConn = conn;

    conn.on("open", () => {
      updateConnectionBadge("TAHTAYA BAĞLANDI", true);
      if (appState.localPlayer.name && appState.localPlayer.PendingRequest) {
        conn.send({
          type: "JOIN_REQUEST",
          playerId: appState.localPlayer.id,
          name: appState.localPlayer.name,
          pin: pin
        });
      } else {
        conn.send({ type: "REQUEST_SYNC" });
      }
    });

    conn.on("data", (data) => {
      handleIncomingNetworkMessage(data);
    });
  } catch (e) {
    // BroadcastChannel fallback devrede
  }
}

function updateConnectionBadge(text, isOnline) {
  const label = document.getElementById("connectionStatusLabel");
  const dot = document.getElementById("connectionDot");
  if (label) label.textContent = text;
  if (dot) {
    dot.style.background = isOnline ? "var(--accent-primary)" : "var(--accent-amber)";
  }
}

function sendNetworkMessage(payload) {
  // 1. BroadcastChannel ile gönder
  if (appState.bc) {
    try {
      appState.bc.postMessage(payload);
    } catch (e) {}
  }

  // 2. Oyuncu ise Host Peer bağlantısına gönder
  if (appState.playerConn && appState.playerConn.open) {
    try {
      appState.playerConn.send(payload);
    } catch (e) {}
  }

  // 3. Aynı sekmede hem Host hem Oyuncu test ediliyorsa doğrudan işle
  handleIncomingNetworkMessage(payload);
}

function broadcastRoomSync() {
  saveRoomStateToStorage();
  const payload = {
    type: "ROOM_SYNC",
    room: appState.room
  };

  if (appState.bc) {
    try {
      appState.bc.postMessage(payload);
    } catch (e) {}
  }

  Object.values(appState.hostConnections).forEach((conn) => {
    if (conn && conn.open) {
      try {
        conn.send(payload);
      } catch (e) {}
    }
  });

  renderAll();
}

function handleIncomingNetworkMessage(msg, sourceConn = null) {
  if (!msg || !msg.type) return;

  if (msg.type === "ROOM_SYNC" && msg.room) {
    appState.room = msg.room;
    renderAll();
    return;
  }

  if (msg.type === "REQUEST_SYNC") {
    if (appState.viewMode === "host") {
      if (sourceConn && sourceConn.open) {
        sourceConn.send({ type: "ROOM_SYNC", room: appState.room });
      } else {
        broadcastRoomSync();
      }
    }
    return;
  }

  if (msg.type === "JOIN_REQUEST") {
    const { playerId, name } = msg;
    if (!playerId || !name) return;

    const existing = appState.room.players[playerId];
    if (!existing) {
      appState.room.players[playerId] = {
        id: playerId,
        name: name.trim(),
        status: "pending", // Yönetici onayı bekliyor
        score: 0,
        correctCount: 0,
        wrongCount: 0,
        joinedAt: Date.now(),
        answers: {}
      };
      if (appState.viewMode === "host") {
        showToast(`Yeni katılımcı onay bekliyor: ${name}`, "warning");
      }
    } else {
      existing.name = name.trim();
      if (existing.status === "rejected") {
        existing.status = "pending";
      }
    }

    broadcastRoomSync();
    return;
  }

  if (msg.type === "CANCEL_JOIN") {
    const { playerId } = msg;
    if (playerId && appState.room.players[playerId]) {
      delete appState.room.players[playerId];
      broadcastRoomSync();
    }
    return;
  }

  if (msg.type === "SUBMIT_ANSWER") {
    const { playerId, questionId, optionId } = msg;
    const player = appState.room.players[playerId];
    if (!player || player.status !== "approved") return;
    if (appState.room.phase !== "QUESTION_ACTIVE") return;

    const currentQ = QUESTIONS[appState.room.currentQuestionIndex];
    if (!currentQ || currentQ.id !== questionId) return;

    // Zaten cevaplamışsa tekrar kaydetme
    if (player.answers && player.answers[questionId]) return;

    const now = Date.now();
    const elapsedSec = Math.max(0, (now - (appState.room.questionStartTime || now)) / 1000);
    const totalSec = appState.room.questionDuration || currentQ.timeLimit || 30;
    const remainingRatio = Math.max(0, Math.min(1, (totalSec - elapsedSec) / totalSec));

    const isCorrect = optionId === currentQ.correctOption;
    let earnedPoints = 0;
    if (isCorrect) {
      earnedPoints = QUIZ_CONFIG.basePoints + Math.round(QUIZ_CONFIG.speedBonusMax * remainingRatio);
    }

    if (!player.answers) player.answers = {};
    player.answers[questionId] = {
      option: optionId,
      timeSec: Number(elapsedSec.toFixed(1)),
      isCorrect: isCorrect,
      points: earnedPoints
    };

    // Tüm onaylı oyuncular cevapladıysa ve Host ekranındaysak otomatik sonucu göster
    const approvedPlayers = getApprovedPlayers();
    const answeredCount = approvedPlayers.filter(p => p.answers && p.answers[currentQ.id]).length;

    broadcastRoomSync();

    if (appState.viewMode === "host" && approvedPlayers.length > 0 && answeredCount >= approvedPlayers.length) {
      setTimeout(() => {
        if (appState.room.phase === "QUESTION_ACTIVE") {
          revealCurrentQuestionAnswer();
        }
      }, 650);
    }
  }
}

// ==========================================================================
// YÖNETİCİ (HOST) AKSİYONLARI: ONAYLAMA, SORU BAŞLATMA, SÜRE VE PUANLAMA
// ==========================================================================
function getPendingPlayers() {
  return Object.values(appState.room.players)
    .filter(p => p.status === "pending")
    .sort((a, b) => a.joinedAt - b.joinedAt);
}

function getApprovedPlayers() {
  return Object.values(appState.room.players)
    .filter(p => p.status === "approved")
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.joinedAt - b.joinedAt;
    });
}

function approvePlayer(playerId) {
  const player = appState.room.players[playerId];
  if (!player) return;
  player.status = "approved";
  showToast(`${player.name} yarışmaya onaylandı!`, "info");
  broadcastRoomSync();
}

function rejectOrKickPlayer(playerId) {
  const player = appState.room.players[playerId];
  if (!player) return;
  const name = player.name;
  player.status = "rejected";
  showToast(`${name} reddedildi / çıkarıldı.`, "warning");
  broadcastRoomSync();
}

function approveAllPendingPlayers() {
  const pending = getPendingPlayers();
  if (pending.length === 0) {
    showToast("Şu anda onay bekleyen katılımcı yok.", "info");
    return;
  }
  pending.forEach(p => {
    p.status = "approved";
  });
  showToast(`${pending.length} katılımcı onaylandı!`, "info");
  broadcastRoomSync();
}

function startQuestionByIndex(index) {
  if (index < 0 || index >= QUESTIONS.length) return;
  const q = QUESTIONS[index];

  appState.room.currentQuestionIndex = index;
  appState.room.phase = "QUESTION_ACTIVE";
  appState.room.questionDuration = q.timeLimit || 35;
  appState.room.remainingSeconds = q.timeLimit || 35;
  appState.room.questionStartTime = Date.now();

  // Eğer bu soru yeniden başlatılıyorsa bu soruya ait eski cevapları temizle ve puanları yeniden hesapla
  Object.values(appState.room.players).forEach(p => {
    if (p.answers && p.answers[q.id]) {
      delete p.answers[q.id];
    }
  });
  recalculateAllPlayerTotals();

  startHostCountdownTimer();
  broadcastRoomSync();
}

function startHostCountdownTimer() {
  clearInterval(appState.timerInterval);
  appState.timerInterval = setInterval(() => {
    if (appState.room.phase !== "QUESTION_ACTIVE") {
      clearInterval(appState.timerInterval);
      return;
    }

    const elapsed = Math.floor((Date.now() - appState.room.questionStartTime) / 1000);
    const remaining = Math.max(0, appState.room.questionDuration - elapsed);
    appState.room.remainingSeconds = remaining;

    if (remaining <= 0) {
      clearInterval(appState.timerInterval);
      revealCurrentQuestionAnswer();
    } else {
      broadcastRoomSync();
    }
  }, 1000);
}

function addExtraTime15() {
  if (appState.room.phase !== "QUESTION_ACTIVE") return;
  appState.room.questionDuration += 15;
  appState.room.remainingSeconds += 15;
  showToast("Süreye +15 saniye eklendi!", "info");
  broadcastRoomSync();
}

function recalculateAllPlayerTotals() {
  Object.values(appState.room.players).forEach(p => {
    let totalScore = 0;
    let correct = 0;
    let wrong = 0;
    const ansMap = p.answers || {};

    Object.values(ansMap).forEach(ans => {
      if (ans.isCorrect) {
        totalScore += ans.points || 0;
        correct++;
      } else {
        wrong++;
      }
    });

    p.score = totalScore;
    p.correctCount = correct;
    p.wrongCount = wrong;
  });
}

function revealCurrentQuestionAnswer() {
  clearInterval(appState.timerInterval);
  appState.room.phase = "QUESTION_REVEAL";
  appState.room.remainingSeconds = 0;
  recalculateAllPlayerTotals();
  broadcastRoomSync();
}

function goToNextQuestionOrPodium() {
  const nextIdx = appState.room.currentQuestionIndex + 1;
  if (nextIdx < QUESTIONS.length) {
    startQuestionByIndex(nextIdx);
  } else {
    showFinalPodium();
  }
}

function showFinalPodium() {
  clearInterval(appState.timerInterval);
  recalculateAllPlayerTotals();
  appState.room.phase = "FINAL_PODIUM";
  broadcastRoomSync();
}

function resetQuizRoomConfirm() {
  if (!confirm("Yarışmayı sıfırlamak istiyor musunuz?\n\nOnaylı katılımcılar korunacak, tüm puanlar sıfırlanıp Lobi ekranına dönülecektir. (Tamamen silmek için İptal'e basabilirsiniz)")) {
    if (confirm("Tüm katılımcı listesini de tamamen silmek ister misiniz?")) {
      clearInterval(appState.timerInterval);
      appState.room.players = {};
      appState.room.phase = "LOBBY";
      appState.room.currentQuestionIndex = 0;
      broadcastRoomSync();
      showToast("Tüm katılımcılar ve yarışma sıfırlandı.", "warning");
    }
    return;
  }

  clearInterval(appState.timerInterval);
  Object.values(appState.room.players).forEach(p => {
    p.score = 0;
    p.correctCount = 0;
    p.wrongCount = 0;
    p.answers = {};
  });
  appState.room.phase = "LOBBY";
  appState.room.currentQuestionIndex = 0;
  broadcastRoomSync();
  showToast("Puanlar sıfırlandı, Lobi ekranına dönüldü.", "info");
}

// ==========================================================================
// KATILIMCI (OYUNCU) AKSİYONLARI
// ==========================================================================
function handlePlayerJoinSubmit(e) {
  e.preventDefault();
  const nameInput = document.getElementById("playerNameInput");
  const pinInput = document.getElementById("playerRoomPinInput");

  const name = (nameInput.value || "").trim();
  if (!name) {
    showToast("Lütfen adınızı veya grup adınızı yazınız.", "warning");
    nameInput.focus();
    return;
  }

  const enteredPin = (pinInput.value || "").trim() || appState.room.pin || DEFAULT_ROOM_PIN;

  appState.localPlayer.name = name;
  appState.localPlayer.pin = enteredPin;
  appState.localPlayer.PendingRequest = true;
  saveLocalPlayerSession();

  connectPlayerToHostPeer(enteredPin);

  sendNetworkMessage({
    type: "JOIN_REQUEST",
    playerId: appState.localPlayer.id,
    name: name,
    pin: enteredPin
  });

  showToast("Katılma isteğiniz gönderildi! Yönetici onayı bekleniyor.", "info");
  renderAll();
}

function handleCancelJoinRequest() {
  const playerId = appState.localPlayer.id;
  appState.localPlayer.PendingRequest = false;
  saveLocalPlayerSession();

  sendNetworkMessage({
    type: "CANCEL_JOIN",
    playerId: playerId
  });

  renderAll();
}

function submitPlayerOption(optionId) {
  if (appState.room.phase !== "QUESTION_ACTIVE") return;
  const currentQ = QUESTIONS[appState.room.currentQuestionIndex];
  if (!currentQ) return;

  const me = appState.room.players[appState.localPlayer.id];
  if (!me || me.status !== "approved") return;
  if (me.answers && me.answers[currentQ.id]) return;

  sendNetworkMessage({
    type: "SUBMIT_ANSWER",
    playerId: appState.localPlayer.id,
    questionId: currentQ.id,
    optionId: optionId
  });
}

// ==========================================================================
// EKRAN GEÇİŞİ & HOCA ŞİFRE DOĞRULAMA (vm2627)
// ==========================================================================
function switchViewMode(targetMode) {
  if (targetMode === "host") {
    if (!appState.isHostUnlocked) {
      openHostPasswordModal();
      return;
    }
    appState.viewMode = "host";
    setupHostPeer();
  } else {
    appState.viewMode = "player";
    setupPlayerPeer();
  }
  renderAll();
}

function openHostPasswordModal() {
  const modal = document.getElementById("hostPasswordModal");
  const input = document.getElementById("hostPasswordInput");
  const err = document.getElementById("hostModalError");
  if (err) err.style.display = "none";
  if (input) input.value = "";
  if (modal) modal.style.display = "flex";
  setTimeout(() => input && input.focus(), 80);
}

function closeHostPasswordModal() {
  const modal = document.getElementById("hostPasswordModal");
  if (modal) modal.style.display = "none";
}

function verifyHostPassword() {
  const input = document.getElementById("hostPasswordInput");
  const err = document.getElementById("hostModalError");
  const val = (input.value || "").trim();

  if (val === TEACHER_PASSWORD) {
    appState.isHostUnlocked = true;
    sessionStorage.setItem(STORAGE_KEYS.HOST_UNLOCKED, "true");
    closeHostPasswordModal();
    switchViewMode("host");
    showToast("Tahta / Yönetici ekranı açıldı.", "info");
  } else {
    if (err) {
      err.textContent = "Hatalı yönetici şifresi! Lütfen tekrar deneyin.";
      err.style.display = "block";
    }
    if (input) input.select();
  }
}

// ==========================================================================
// ARAYÜZ RENDER MOTORU (TAHTA EKRANI & KATILIMCI EKRANI)
// ==========================================================================
function renderAll() {
  const playerContainer = document.getElementById("playerScreenContainer");
  const hostContainer = document.getElementById("hostScreenContainer");
  const btnPlayer = document.getElementById("btnSwitchPlayerView");
  const btnHost = document.getElementById("btnSwitchHostView");
  const headerPendingBadge = document.getElementById("headerPendingBadge");

  const pendingPlayers = getPendingPlayers();
  if (headerPendingBadge) {
    if (pendingPlayers.length > 0) {
      headerPendingBadge.style.display = "inline-flex";
      headerPendingBadge.textContent = pendingPlayers.length;
    } else {
      headerPendingBadge.style.display = "none";
    }
  }

  if (appState.viewMode === "host") {
    if (playerContainer) playerContainer.style.display = "none";
    if (hostContainer) hostContainer.style.display = "block";
    if (btnPlayer) btnPlayer.classList.remove("active");
    if (btnHost) btnHost.classList.add("active");
    renderHostScreen();
  } else {
    if (hostContainer) hostContainer.style.display = "none";
    if (playerContainer) playerContainer.style.display = "block";
    if (btnHost) btnHost.classList.remove("active");
    if (btnPlayer) btnPlayer.classList.add("active");
    renderPlayerScreen();
  }
}

// --------------------------------------------------------------------------
// 1. KATILIMCI (OYUNCU) EKRANI RENDER
// --------------------------------------------------------------------------
function renderPlayerScreen() {
  const joinCard = document.getElementById("playerJoinCard");
  const waitingCard = document.getElementById("playerWaitingApprovalCard");
  const rejectedCard = document.getElementById("playerRejectedCard");
  const approvedLobbyCard = document.getElementById("playerApprovedLobbyCard");
  const questionCard = document.getElementById("playerQuestionCard");
  const finalCard = document.getElementById("playerFinalCard");

  [joinCard, waitingCard, rejectedCard, approvedLobbyCard, questionCard, finalCard].forEach(el => {
    if (el) el.style.display = "none";
  });

  const me = appState.room.players[appState.localPlayer.id];
  const pinInput = document.getElementById("playerRoomPinInput");
  if (pinInput && !pinInput.value) {
    pinInput.value = appState.localPlayer.pin || appState.room.pin || DEFAULT_ROOM_PIN;
  }

  // Henüz katılmamışsa
  if (!me) {
    if (appState.localPlayer.PendingRequest && appState.localPlayer.name) {
      if (waitingCard) waitingCard.style.display = "flex";
      const titleEl = document.getElementById("waitingPlayerNameTitle");
      if (titleEl) titleEl.textContent = `Merhaba, ${appState.localPlayer.name}!`;
    } else {
      if (joinCard) joinCard.style.display = "block";
    }
    return;
  }

  // Reddedildiyse
  if (me.status === "rejected") {
    if (rejectedCard) rejectedCard.style.display = "flex";
    return;
  }

  // Onay bekliyorsa
  if (me.status === "pending") {
    if (waitingCard) waitingCard.style.display = "flex";
    const titleEl = document.getElementById("waitingPlayerNameTitle");
    if (titleEl) titleEl.textContent = `Merhaba, ${me.name}!`;
    return;
  }

  // ONAYLANMIŞ KATILIMCI:
  const approvedList = getApprovedPlayers();
  const myRankIndex = approvedList.findIndex(p => p.id === me.id);
  const myRankText = myRankIndex >= 0 ? `#${myRankIndex + 1}` : "#-";

  // Yarışma Lobi aşamasındaysa
  if (appState.room.phase === "LOBBY") {
    if (approvedLobbyCard) approvedLobbyCard.style.display = "flex";
    document.getElementById("approvedPlayerTitle").textContent = `Hoş Geldin, ${me.name}!`;
    document.getElementById("lobbyPlayerScore").textContent = `${me.score} Puan`;
    document.getElementById("lobbyPlayerRank").textContent = `${myRankText} / ${approvedList.length}`;
    return;
  }

  // Yarışma Final Podyum aşamasındaysa
  if (appState.room.phase === "FINAL_PODIUM") {
    if (finalCard) finalCard.style.display = "flex";
    document.getElementById("playerFinalRankTitle").textContent = `Tebrikler, ${me.name}!`;
    document.getElementById("playerFinalRankVal").textContent = `${myRankText} / ${approvedList.length}`;
    document.getElementById("playerFinalScoreVal").textContent = `${me.score}`;
    document.getElementById("playerFinalCorrectVal").textContent = `${me.correctCount || 0} / ${QUESTIONS.length}`;
    return;
  }

  // Aktif Soru veya Soru Sonucu (QUESTION_ACTIVE / QUESTION_REVEAL)
  if (questionCard) questionCard.style.display = "block";

  const currentQ = QUESTIONS[appState.room.currentQuestionIndex] || QUESTIONS[0];
  const isReveal = appState.room.phase === "QUESTION_REVEAL";
  const myAnswer = me.answers && me.answers[currentQ.id];

  document.getElementById("playerQNumBadge").textContent = `SORU ${currentQ.number} / ${QUESTIONS.length}`;
  const diffBadge = document.getElementById("playerQDiffBadge");
  diffBadge.textContent = currentQ.difficulty;
  diffBadge.className = `diff-badge ${currentQ.difficultyClass}`;

  document.getElementById("playerTimerText").textContent = isReveal ? "Süre Bitti" : `${appState.room.remainingSeconds} sn`;
  document.getElementById("playerHudScoreBadge").textContent = `${me.score} Puan • ${myRankText}`;

  const pct = isReveal ? 0 : Math.max(0, Math.min(100, (appState.room.remainingSeconds / (appState.room.questionDuration || 30)) * 100));
  const timerBar = document.getElementById("playerTimerBar");
  timerBar.style.width = `${pct}%`;
  timerBar.classList.toggle("timer-low", appState.room.remainingSeconds <= 8);

  document.getElementById("playerQTitle").textContent = currentQ.title;
  document.getElementById("playerQPrompt").textContent = currentQ.prompt;
  document.getElementById("playerBuggyCode").textContent = currentQ.buggyCode;
  document.getElementById("playerQRequirement").textContent = currentQ.requirement;

  // 4 Şık Butonu Render
  const optionsGrid = document.getElementById("playerOptionsGrid");
  optionsGrid.innerHTML = "";

  currentQ.options.forEach(opt => {
    const btn = document.createElement("button");
    btn.type = "button";
    const isSelected = myAnswer && myAnswer.option === opt.id;
    let extraClass = "";

    if (isSelected) extraClass += " selected-choice";
    if (isReveal) {
      if (opt.id === currentQ.correctOption) {
        extraClass += " reveal-correct";
      } else {
        extraClass += " reveal-wrong";
      }
    }

    btn.className = `kahoot-option-btn opt-${opt.id}${extraClass}`;
    btn.disabled = Boolean(myAnswer) || isReveal;

    btn.innerHTML = `
      <div class="opt-top-bar">
        <span class="opt-letter-badge">${opt.id}</span>
        <span class="opt-note-text">${escapeHtml(opt.note)}</span>
      </div>
      <pre class="opt-code-snippet"><code>${escapeHtml(opt.code)}</code></pre>
    `;

    btn.addEventListener("click", () => submitPlayerOption(opt.id));
    optionsGrid.appendChild(btn);
  });

  // Kilitli Cevap Bannerı
  const lockedBanner = document.getElementById("playerAnswerLockedBanner");
  if (myAnswer && !isReveal) {
    lockedBanner.style.display = "flex";
    document.getElementById("playerLockedChoiceTitle").textContent = `Cevabınız Kaydedildi (Şık ${myAnswer.option} • ${myAnswer.timeSec} sn)`;
  } else {
    lockedBanner.style.display = "none";
  }

  // Sonuç Açıklama Kutusu (QUESTION_REVEAL)
  const revealBox = document.getElementById("playerRevealBox");
  if (isReveal) {
    revealBox.style.display = "block";
    const banner = document.getElementById("playerRevealBanner");
    const heading = document.getElementById("playerRevealHeading");
    const ptsText = document.getElementById("playerRevealPoints");

    if (myAnswer && myAnswer.isCorrect) {
      banner.className = "reveal-status-banner is-correct";
      heading.textContent = "DOĞRU CEVAP!";
      ptsText.textContent = `+${myAnswer.points} Puan Kazandınız • Güncel Sıranız: ${myRankText}`;
    } else if (myAnswer && !myAnswer.isCorrect) {
      banner.className = "reveal-status-banner is-wrong";
      heading.textContent = `YANLIŞ CEVAP (Seçiminiz: Şık ${myAnswer.option})`;
      ptsText.textContent = `0 Puan • Güncel Sıranız: ${myRankText}`;
    } else {
      banner.className = "reveal-status-banner is-wrong";
      heading.textContent = "SÜRE DOLDU (Cevap Verilmedi)";
      ptsText.textContent = `0 Puan • Güncel Sıranız: ${myRankText}`;
    }

    document.getElementById("playerRevealCorrectOpt").textContent = `Şık ${currentQ.correctOption}`;
    document.getElementById("playerRevealExplanation").textContent = currentQ.explanation;
    document.getElementById("playerRevealFixedCode").textContent = currentQ.fixedCode;
  } else {
    revealBox.style.display = "none";
  }
}

// --------------------------------------------------------------------------
// 2. TAHTA / YÖNETİCİ (HOST) EKRANI RENDER
// --------------------------------------------------------------------------
function renderHostScreen() {
  document.getElementById("hostRoomPinDisplay").textContent = appState.room.pin || DEFAULT_ROOM_PIN;

  // Üstteki 1..10 Soru Gezinti Hapları
  const navContainer = document.getElementById("hostQuestionNavPills");
  navContainer.innerHTML = "";
  QUESTIONS.forEach((q, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    const isActive = (appState.room.phase === "QUESTION_ACTIVE" || appState.room.phase === "QUESTION_REVEAL") && appState.room.currentQuestionIndex === idx;
    btn.className = `q-nav-pill ${isActive ? "active" : ""}`;
    btn.title = `${q.title} (${q.difficulty})`;
    btn.textContent = q.number;
    btn.addEventListener("click", () => startQuestionByIndex(idx));
    navContainer.appendChild(btn);
  });

  // Sağ Yan Panel: Onay Bekleyenler ve Canlı Puan Sıralaması (Her zaman görünür)
  renderHostSidebar();

  // Sol Ana Sahne: LOBBY | QUESTION | PODIUM
  const stageLobby = document.getElementById("hostStageLobby");
  const stageQuestion = document.getElementById("hostStageQuestion");
  const stagePodium = document.getElementById("hostStagePodium");

  [stageLobby, stageQuestion, stagePodium].forEach(el => {
    if (el) el.style.display = "none";
  });

  if (appState.room.phase === "LOBBY") {
    stageLobby.style.display = "block";
    renderHostLobbyStage();
  } else if (appState.room.phase === "FINAL_PODIUM") {
    stagePodium.style.display = "block";
    renderHostPodiumStage();
  } else {
    stageQuestion.style.display = "block";
    renderHostQuestionStage();
  }
}

function renderHostSidebar() {
  const pendingList = getPendingPlayers();
  const approvedList = getApprovedPlayers();

  document.getElementById("sidebarPendingCount").textContent = pendingList.length;
  document.getElementById("sidebarApprovedCount").textContent = approvedList.length;

  const btnApproveAllSidebar = document.getElementById("btnApproveAllSidebar");
  if (btnApproveAllSidebar) {
    btnApproveAllSidebar.style.display = pendingList.length > 0 ? "inline-flex" : "none";
  }

  // Onay Bekleyenler Listesi
  const pendingContainer = document.getElementById("hostPendingList");
  pendingContainer.innerHTML = "";
  if (pendingList.length === 0) {
    pendingContainer.innerHTML = `<div class="empty-sidebar-state"><span>Onay bekleyen katılımcı yok.</span></div>`;
  } else {
    pendingList.forEach(p => {
      const row = document.createElement("div");
      row.className = "pending-item-row";
      row.innerHTML = `
        <span class="pending-player-name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</span>
        <div class="pending-actions">
          <button type="button" class="btn btn-xs btn-primary-clean" data-approve="${p.id}">✓ Onayla</button>
          <button type="button" class="btn btn-xs btn-danger-soft" data-reject="${p.id}">✕</button>
        </div>
      `;
      row.querySelector(`[data-approve="${p.id}"]`).addEventListener("click", () => approvePlayer(p.id));
      row.querySelector(`[data-reject="${p.id}"]`).addEventListener("click", () => rejectOrKickPlayer(p.id));
      pendingContainer.appendChild(row);
    });
  }

  // Canlı Puan Sıralaması (Leaderboard)
  const lbContainer = document.getElementById("hostLiveLeaderboard");
  lbContainer.innerHTML = "";
  if (approvedList.length === 0) {
    lbContainer.innerHTML = `<div class="empty-sidebar-state"><span>Henüz onaylanmış yarışmacı yok. Katılımcılar isim yazıp gönderdiğinde yukarıdan onaylayabilirsiniz.</span></div>`;
  } else {
    const currentQ = QUESTIONS[appState.room.currentQuestionIndex];
    const isQuestionPhase = appState.room.phase === "QUESTION_ACTIVE" || appState.room.phase === "QUESTION_REVEAL";
    const isReveal = appState.room.phase === "QUESTION_REVEAL";

    approvedList.forEach((p, idx) => {
      const rank = idx + 1;
      const rankClass = rank <= 3 ? `rank-${rank}` : "";
      let statusHtml = `<span class="lb-answer-status">Hazır • ${p.correctCount || 0} Doğru</span>`;

      if (isQuestionPhase && currentQ) {
        const ans = p.answers && p.answers[currentQ.id];
        if (!ans) {
          statusHtml = `<span class="lb-answer-status">${isReveal ? "Cevaplamadı" : "Düşünüyor..."}</span>`;
        } else if (!isReveal) {
          statusHtml = `<span class="lb-answer-status answered">✓ Cevapladı (${ans.timeSec}s)</span>`;
        } else if (ans.isCorrect) {
          statusHtml = `<span class="lb-answer-status answered">✓ Doğru (+${ans.points}p)</span>`;
        } else {
          statusHtml = `<span class="lb-answer-status wrong">✕ Yanlış (Şık ${ans.option})</span>`;
        }
      }

      const row = document.createElement("div");
      row.className = `leaderboard-row ${rankClass}`;
      row.innerHTML = `
        <div class="lb-left">
          <span class="lb-rank-badge">${rank}</span>
          <div class="lb-player-info">
            <span class="lb-player-name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</span>
            ${statusHtml}
          </div>
        </div>
        <div class="lb-right">
          <span class="lb-score-val">${p.score}p</span>
          <button type="button" class="btn-kick-player" title="Yarışmacıyı çıkar" data-kick="${p.id}">✕</button>
        </div>
      `;
      row.querySelector(`[data-kick="${p.id}"]`).addEventListener("click", () => rejectOrKickPlayer(p.id));
      lbContainer.appendChild(row);
    });
  }
}

function renderHostLobbyStage() {
  const pendingCount = getPendingPlayers().length;
  const approvedCount = getApprovedPlayers().length;

  document.getElementById("lobbyApprovedCount").textContent = approvedCount;
  document.getElementById("lobbyPendingCount").textContent = pendingCount;

  const previewGrid = document.getElementById("hostQuestionsPreviewGrid");
  previewGrid.innerHTML = "";

  QUESTIONS.forEach((q, idx) => {
    const item = document.createElement("div");
    item.className = "q-preview-item";
    item.innerHTML = `
      <div class="q-prev-left">
        <span class="q-prev-num">#${q.number}</span>
        <span class="q-prev-title">${escapeHtml(q.title)}</span>
      </div>
      <span class="diff-badge ${q.difficultyClass}">${escapeHtml(q.difficulty)}</span>
    `;
    item.addEventListener("click", () => startQuestionByIndex(idx));
    previewGrid.appendChild(item);
  });
}

function renderHostQuestionStage() {
  const currentQ = QUESTIONS[appState.room.currentQuestionIndex] || QUESTIONS[0];
  const isReveal = appState.room.phase === "QUESTION_REVEAL";
  const approvedPlayers = getApprovedPlayers();
  const answeredCount = approvedPlayers.filter(p => p.answers && p.answers[currentQ.id]).length;

  document.getElementById("hostQNumberBadge").textContent = `SORU ${String(currentQ.number).padStart(2, "0")} / ${QUESTIONS.length}`;
  const diffBadge = document.getElementById("hostQDifficultyBadge");
  diffBadge.textContent = currentQ.difficulty;
  diffBadge.className = `diff-badge ${currentQ.difficultyClass}`;

  document.getElementById("hostTimerSeconds").textContent = isReveal ? "0" : appState.room.remainingSeconds;
  document.getElementById("hostAnswerCountText").textContent = `${answeredCount} / ${approvedPlayers.length}`;

  const pct = isReveal ? 0 : Math.max(0, Math.min(100, (appState.room.remainingSeconds / (appState.room.questionDuration || 30)) * 100));
  const timerBar = document.getElementById("hostTimerBar");
  timerBar.style.width = `${pct}%`;
  timerBar.classList.toggle("timer-low", appState.room.remainingSeconds <= 8);

  const btnReveal = document.getElementById("btnRevealAnswer");
  if (btnReveal) {
    btnReveal.style.display = isReveal ? "none" : "inline-flex";
  }

  const btnNextText = document.getElementById("btnNextQuestionText");
  if (btnNextText) {
    btnNextText.textContent = appState.room.currentQuestionIndex + 1 < QUESTIONS.length
      ? `Sonraki Soru (Soru ${appState.room.currentQuestionIndex + 2})`
      : "Final Podyumu & Sonuçları Gör";
  }

  document.getElementById("hostQTitle").textContent = currentQ.title;
  document.getElementById("hostQPrompt").textContent = currentQ.prompt;
  document.getElementById("hostBuggyCode").textContent = currentQ.buggyCode;
  document.getElementById("hostQRequirement").textContent = currentQ.requirement;

  // Şık Oy Dağılımlarını Hesapla
  const voteCounts = { A: 0, B: 0, C: 0, D: 0 };
  approvedPlayers.forEach(p => {
    const ans = p.answers && p.answers[currentQ.id];
    if (ans && voteCounts[ans.option] !== undefined) {
      voteCounts[ans.option]++;
    }
  });

  const optionsGrid = document.getElementById("hostOptionsGrid");
  optionsGrid.innerHTML = "";

  currentQ.options.forEach(opt => {
    const card = document.createElement("div");
    let extraClass = "";
    if (isReveal) {
      extraClass = opt.id === currentQ.correctOption ? " reveal-correct" : " reveal-wrong";
    }
    card.className = `kahoot-option-btn opt-${opt.id}${extraClass}`;

    const count = voteCounts[opt.id] || 0;
    const voteBadgeHtml = isReveal
      ? `<span class="opt-vote-pill">${count} Oy ${opt.id === currentQ.correctOption ? "✓ DOĞRU" : ""}</span>`
      : `<span class="opt-note-text">${escapeHtml(opt.note)}</span>`;

    card.innerHTML = `
      <div class="opt-top-bar">
        <span class="opt-letter-badge">${opt.id}</span>
        ${voteBadgeHtml}
      </div>
      <pre class="opt-code-snippet"><code>${escapeHtml(opt.code)}</code></pre>
    `;
    optionsGrid.appendChild(card);
  });

  // Çözüm Açıklama Paneli
  const solPanel = document.getElementById("hostSolutionPanel");
  if (isReveal) {
    solPanel.style.display = "flex";
    document.getElementById("hostSolCorrectOption").textContent = currentQ.correctOption;
    document.getElementById("hostSolExplanation").textContent = currentQ.explanation;
    document.getElementById("hostSolFixedCode").textContent = currentQ.fixedCode;
  } else {
    solPanel.style.display = "none";
  }
}

function renderHostPodiumStage() {
  const approved = getApprovedPlayers();
  const showcase = document.getElementById("hostPodiumShowcase");
  showcase.innerHTML = "";

  const podiumOrder = [
    { rank: 2, player: approved[1], cls: "podium-2" },
    { rank: 1, player: approved[0], cls: "podium-1" },
    { rank: 3, player: approved[2], cls: "podium-3" }
  ];

  podiumOrder.forEach(slot => {
    const col = document.createElement("div");
    col.className = `podium-col ${slot.cls}`;
    if (slot.player) {
      col.innerHTML = `
        <div class="podium-rank-num">${slot.rank}</div>
        <div class="podium-name">${escapeHtml(slot.player.name)}</div>
        <div class="podium-score">${slot.player.score} Puan</div>
        <span class="opt-note-text">${slot.player.correctCount || 0} / ${QUESTIONS.length} Doğru</span>
      `;
    } else {
      col.innerHTML = `
        <div class="podium-rank-num">${slot.rank}</div>
        <div class="podium-name">-</div>
        <div class="podium-score">0 Puan</div>
      `;
    }
    showcase.appendChild(col);
  });

  const tbody = document.getElementById("finalLeaderboardTableBody");
  tbody.innerHTML = "";

  if (approved.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Henüz yarışmacı verisi bulunmuyor.</td></tr>`;
    return;
  }

  approved.forEach((p, idx) => {
    const totalAnswered = (p.correctCount || 0) + (p.wrongCount || 0);
    const rate = totalAnswered > 0 ? Math.round(((p.correctCount || 0) / QUESTIONS.length) * 100) : 0;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>#${idx + 1}</strong></td>
      <td>${escapeHtml(p.name)}</td>
      <td><strong>${p.score} Puan</strong></td>
      <td style="color: var(--accent-primary); font-weight:700;">${p.correctCount || 0}</td>
      <td style="color: var(--accent-danger);">${p.wrongCount || 0}</td>
      <td>%${rate}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ==========================================================================
// SONUÇLARI CSV OLARAK İNDİRME VE BAĞLANTI KOPYALAMA
// ==========================================================================
function exportResultsCsv() {
  const approved = getApprovedPlayers();
  if (approved.length === 0) {
    showToast("İndirilecek katılımcı verisi yok.", "warning");
    return;
  }

  const rows = [
    ["Sira", "Katilimci Adi", "Toplam Puan", "Dogru Sayisi", "Yanlis Sayisi"]
  ];
  approved.forEach((p, idx) => {
    rows.push([
      idx + 1,
      `"${String(p.name).replace(/"/g, '""')}"`,
      p.score,
      p.correctCount || 0,
      p.wrongCount || 0
    ]);
  });

  const csvContent = "\uFEFF" + rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `TypeScript_Quiz_Sonuclari_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast("Sıralama tablosu CSV olarak indirildi!", "info");
}

function copyJoinLinkToClipboard() {
  const baseUrl = window.location.href.split("?")[0];
  const joinUrl = `${baseUrl}?mode=player&pin=${encodeURIComponent(appState.room.pin || DEFAULT_ROOM_PIN)}`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(joinUrl).then(() => {
      showToast("Katılımcı giriş linki panoya kopyalandı!", "info");
    });
  } else {
    showToast(`Oda Kodu: ${appState.room.pin || DEFAULT_ROOM_PIN}`, "info");
  }
}

// ==========================================================================
// ETKİNLİK DİNLEYİCİLERİ (EVENT LISTENERS)
// ==========================================================================
function setupEventListeners() {
  const mainHeader = document.getElementById("mainHeader");
  if (mainHeader) {
    mainHeader.style.setProperty("position", "relative", "important");
    mainHeader.style.setProperty("top", "auto", "important");
  }

  document.getElementById("btnToggleTheme")?.addEventListener("click", toggleTheme);

  // Mod Geçiş Butonları
  document.getElementById("btnSwitchPlayerView")?.addEventListener("click", () => switchViewMode("player"));
  document.getElementById("btnSwitchHostView")?.addEventListener("click", () => switchViewMode("host"));

  // Yönetici Şifre Modalı
  document.getElementById("btnCloseHostModal")?.addEventListener("click", closeHostPasswordModal);
  document.getElementById("btnCancelHostModal")?.addEventListener("click", closeHostPasswordModal);
  document.getElementById("btnSubmitHostPassword")?.addEventListener("click", verifyHostPassword);
  document.getElementById("hostPasswordInput")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      verifyHostPassword();
    }
  });

  // Katılımcı (Oyuncu) Formu ve Aksiyonları
  document.getElementById("playerJoinForm")?.addEventListener("submit", handlePlayerJoinSubmit);
  document.getElementById("btnCancelJoinRequest")?.addEventListener("click", handleCancelJoinRequest);
  document.getElementById("btnRetryJoin")?.addEventListener("click", handleCancelJoinRequest);

  // Tahta (Host) Aksiyonları
  document.getElementById("btnStartQuizMain")?.addEventListener("click", () => startQuestionByIndex(0));
  document.getElementById("btnApproveAllLobby")?.addEventListener("click", approveAllPendingPlayers);
  document.getElementById("btnApproveAllSidebar")?.addEventListener("click", approveAllPendingPlayers);
  document.getElementById("btnAddTime15")?.addEventListener("click", addExtraTime15);
  document.getElementById("btnRevealAnswer")?.addEventListener("click", revealCurrentQuestionAnswer);
  document.getElementById("btnNextQuestion")?.addEventListener("click", goToNextQuestionOrPodium);
  document.getElementById("btnShowPodiumView")?.addEventListener("click", showFinalPodium);
  document.getElementById("btnResetQuizRoom")?.addEventListener("click", resetQuizRoomConfirm);
  document.getElementById("btnExportResultsCsv")?.addEventListener("click", exportResultsCsv);
  document.getElementById("btnBackToLobbyFromPodium")?.addEventListener("click", () => {
    appState.room.phase = "LOBBY";
    broadcastRoomSync();
  });

  document.getElementById("btnCopyJoinLink")?.addEventListener("click", copyJoinLinkToClipboard);
  document.getElementById("btnOpenTestPlayerTab")?.addEventListener("click", () => {
    const baseUrl = window.location.href.split("?")[0];
    window.open(`${baseUrl}?mode=player&pin=${encodeURIComponent(appState.room.pin || DEFAULT_ROOM_PIN)}`, "_blank");
  });
}

// ==========================================================================
// UYGULAMA BAŞLATICI
// ==========================================================================
window.addEventListener("DOMContentLoaded", () => {
  initTheme();
  loadInitialState();
  setupEventListeners();
  initRealtimeNetwork();
  renderAll();

  if (appState.viewMode === "host" && appState.room.phase === "QUESTION_ACTIVE") {
    startHostCountdownTimer();
  }
});
