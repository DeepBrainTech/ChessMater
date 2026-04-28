/**
 * Multi-Player Chess Puzzle with Gravity
 * Copyright (c) 2024 [DeepBrainTech]
 * 
 * Chess piece images attribution:
 * - Created by Cburnett (https://en.wikipedia.org/wiki/User:Cburnett)
 * - Licensed under Creative Commons Attribution-ShareAlike 3.0 Unported (CC BY-SA 3.0)
 * - Source: https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces
 */

const CM_EDITOR_PAGE =
  typeof window !== "undefined" && window.CM_EDITOR_PAGE === true;

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const statusMessage = document.getElementById("statusMessage");
const playerCount = document.getElementById("playerCount");
const objectiveCount = document.getElementById("objectiveCount");
const moveCountDisplay = document.getElementById("moveCount");
const fewestOtherMovesDisplay = document.getElementById("fewestOtherMoves");
const undoMoveButton = document.getElementById("undoMoveBtn");
const antigravityToggleButton = document.getElementById("antigravityToggle");
const levelCompleteModal = document.getElementById("levelCompleteModal");
const levelCompleteText = document.getElementById("levelCompleteText");
const levelCompleteMoveCountDisplay = document.getElementById("levelCompleteMoveCount");
const levelCompleteFewestOtherMovesDisplay = document.getElementById("levelCompleteFewestOtherMoves");
const levelCompleteAchievement = document.getElementById("levelCompleteAchievement");
const levelCompleteReplayPanel = document.getElementById("levelCompleteReplayPanel");
const levelCompleteReplayLock = document.getElementById("levelCompleteReplayLock");
const levelCompleteReplayTitle = document.getElementById("levelCompleteReplayTitle");
const levelCompleteReplayCanvas = document.getElementById("levelCompleteReplayCanvas");
const levelCompleteReplaySubtitle = document.getElementById("levelCompleteReplaySubtitle");
const levelCompleteReplayHint = document.getElementById("levelCompleteReplayHint");
const levelCompleteReplayStep = document.getElementById("levelCompleteReplayStep");
const levelCompleteReplayEvent = document.getElementById("levelCompleteReplayEvent");
const closeLevelCompleteModalBtn = document.getElementById("closeLevelCompleteModal");
const levelCompleteRetryBtn = document.getElementById("levelCompleteRetryBtn");
const levelCompleteNextBtn = document.getElementById("levelCompleteNextBtn");
const SHOW_IN_GAME_STATUS = false;
// const gravityBtn = document.getElementById("gravityBtn");

//default board dimensions
const TILE_SIZE = 60;
let ROWS = 10;
let COLS = 16;
let fallingPieces = [];
let fogEnabled = false;
let pendingMoveCounter = false;
let teleportBlocks = [];
let playerTeleportCooldowns = new Map();
const TELEPORT_COOLDOWN = 300;
let shakeAmount = 0;
let shakeDecay = 0.8;
let shakeX = 0;
let shakeY = 0;
const visitedSquares = Array.from({ length: ROWS }, () => Array(COLS).fill(false));


// Board block types
const CELL_TYPES = {
  EMPTY: 0,
  SOLID_BLOCK: 1,      // Regular solid block (green)
  PLAYER: 2,           // Player piece
  GOAL: 3,             // Goal (red king)
  PHASE_BLOCK: 4,      // Phase-through block (blue)
  PHASE_BLOCK_ACTIVE: 5, // Phase block that has been activated (solid)
  TRANSFORMER: 6,      // Transformer block (changes piece type)
  OBJECTIVE: 7,        // Objective block (must be reached before goal)
  OBJECTIVE_COMPLETED: 8, // Completed objective block
  COUNTER_GOAL: 9,         // Goal but with counter
  TELEPORT_PURPLE: 10, // Purple teleporter (pair 1)
  TELEPORT_GREEN: 11,  // Green teleporter (pair 2)
  TELEPORT_BLUE: 12,   // Blue teleporter (pair 3)
  TELEPORT_ORANGE: 13,  // Orange teleporter (pair 4)
  BOMB: 14    // bomb block
};

const TELEPORT_COLORS = {
  [CELL_TYPES.TELEPORT_PURPLE]: { fill: "rgba(155, 89, 182, 0.8)", stroke: "rgba(255, 255, 255, 0.6)" },
  [CELL_TYPES.TELEPORT_GREEN]: { fill: "rgba(46, 204, 113, 0.8)", stroke: "rgba(255, 255, 255, 0.6)" },
  [CELL_TYPES.TELEPORT_BLUE]: { fill: "rgba(52, 152, 219, 0.8)", stroke: "rgba(255, 255, 255, 0.6)" },
  [CELL_TYPES.TELEPORT_ORANGE]: { fill: "rgba(243, 156, 18, 0.8)", stroke: "rgba(255, 255, 255, 0.6)" }
};

// Piece types
const PIECE_TYPES = ["rook", "bishop", "queen", "knight", "king", "pawn"];

// --- Load images ---
const pieceImages = {
  rook: new Image(),
  bishop: new Image(),
  queen: new Image(),
  knight: new Image(),
  king: new Image(),
  pawn: new Image(),
  target: new Image(),
  bomb: new Image()
};
pieceImages.rook.src   = "https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg";
pieceImages.bishop.src = "https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg";
pieceImages.queen.src  = "https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg";
pieceImages.knight.src = "https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg";
pieceImages.king.src   = "https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg";
pieceImages.pawn.src   = "https://upload.wikimedia.org/wikipedia/commons/4/45/Chess_plt45.svg";
pieceImages.target.src = "https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg";
pieceImages.bomb.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='40' fill='black'/%3E%3Ccircle cx='35' cy='40' r='5' fill='white'/%3E%3Ccircle cx='45' cy='35' r='3' fill='white'/%3E%3Cpath d='M60,30 L75,25 L70,40 Z' fill='red'/%3E%3C/svg%3E";

// tracker for players, goals, and objectives
let board = Array.from({ length: ROWS }, () => Array(COLS).fill(CELL_TYPES.EMPTY));
let players = []; // Array of { row, col, pieceType }
let goal   = null;
let objectives = []; // Array of { row, col, completed }
let objectivesCompleted = 0;
let totalObjectives = 0;
let phaseBlockStates = {}; // Track which phase blocks have been activated
let bombs = []; // {row, col, direction}
let explodingPlayers = []; // { x, y, rotation, velocityY, img }
let mode = CM_EDITOR_PAGE ? "edit" : "play";
let editMode = "player_rook"; // tool in edit mode (editor page only)
let gravityEnabled = true;
let gameWon = false;
let selectedPlayerIndex = -1; // Track which player is selected
teleportBlocks = []; // ✅ Clear teleport blocks
let currentPuzzleData = null;
let antigravityEnabled = false;
let risingPieces = [];
let lastRiseTime = 0;
const RISE_SPEED = 700; // pixels per second
let currentLevelIndex = 0;
let levelMoveCount = 0;
let fewestOtherMovesForLevel = null;
let fewestOtherMovesUserName = "";
let fewestOtherMovesReplayPath = null;
let fewestOtherMovesReplayStepNumbers = [];
let currentLevelMoveTrace = [];
let pendingMoveTraceEntry = null;
let levelCompleteReplayIndex = 0;
let moveHistorySnapshots = [];
let undoCredits = 0;
let antigravityCredits = 0;
let replayUnlockedForLevel = false;
let antigravityUnlockedThisRun = false;
let autoRestartScheduled = false;

function updateUndoButtonLabel() {
  if (!undoMoveButton) return;
  undoMoveButton.textContent = `Undo(${undoCredits})`;
}

function updateAntigravityButtonLabel() {
  if (!antigravityToggleButton) return;
  const state = antigravityEnabled ? "ON" : "OFF";
  if (antigravityUnlockedThisRun) {
    antigravityToggleButton.textContent = `Antigravity ${state}`;
  } else {
    antigravityToggleButton.textContent = `Antigravity(${antigravityCredits})`;
  }
}

function getApiBaseUrl() {
  return window.API_BASE_URL || "https://chessmater-production.up.railway.app";
}

function buildAuthHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (window.cmToken) {
    headers.Authorization = `Bearer ${window.cmToken}`;
  }
  return headers;
}

function getTokenExpSeconds(token) {
  if (!token || typeof token !== "string") return null;
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(atob(parts[1]));
    const exp = Number.parseInt(payload?.exp, 10);
    return Number.isFinite(exp) ? exp : null;
  } catch (_) {
    return null;
  }
}

function shouldRefreshGameTokenSoon(token, bufferSeconds = 45) {
  const exp = getTokenExpSeconds(token);
  if (!exp) return true;
  const now = Math.floor(Date.now() / 1000);
  return exp - now <= bufferSeconds;
}

async function refreshGameTokenFromPortal(force = false) {
  if (!force && !shouldRefreshGameTokenSoon(window.cmToken)) return !!window.cmToken;
  if (window.cmRefreshPromise) return window.cmRefreshPromise;

  window.cmRefreshPromise = (async () => {
    const portalToken = window.cmPortalToken;
    const base = normalizePortalApiBase(window.cmPortalApiBase || "");
    if (!portalToken || !base) return false;

    try {
      const res = await fetch(`${base}/api/games/chessmater/token`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${portalToken}`,
          "Content-Type": "application/json",
          "X-User-Timezone": Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
        }
      });
      if (!res.ok) return false;
      const data = await res.json().catch(() => null);
      const freshToken =
        data?.data?.game_token ||
        data?.data?.token ||
        data?.game_token ||
        data?.token ||
        null;
      if (!freshToken || typeof freshToken !== "string") return false;
      window.cmToken = freshToken;
      return true;
    } catch (_) {
      return false;
    } finally {
      window.cmRefreshPromise = null;
    }
  })();

  return window.cmRefreshPromise;
}

async function apiFetchWithAuthRetry(path, options = {}) {
  await (window.authReady || Promise.resolve());

  const firstHeaders = { ...(options.headers || {}) };
  if (!firstHeaders.Authorization && window.cmToken) {
    firstHeaders.Authorization = `Bearer ${window.cmToken}`;
  }

  let response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    credentials: "include",
    headers: firstHeaders
  });

  if (response.status !== 401) return response;

  const refreshed = await refreshGameTokenFromPortal(true);
  if (!refreshed) return response;

  const retryHeaders = { ...(options.headers || {}) };
  if (window.cmToken) {
    retryHeaders.Authorization = `Bearer ${window.cmToken}`;
  }

  response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    credentials: "include",
    headers: retryHeaders
  });
  return response;
}

async function syncUndoCreditsFromServer() {
  try {
    const res = await apiFetchWithAuthRetry("/undo-credits", {
      method: "GET",
      headers: buildAuthHeaders()
    });
    if (!res.ok) return false;
    const data = await res.json();
    const credits = Number.parseInt(data?.undoCredits, 10);
    undoCredits = Number.isFinite(credits) ? credits : 0;
    updateUndoButtonLabel();
    return true;
  } catch (_) {
    return false;
  }
}

async function syncAntigravityCreditsFromServer() {
  try {
    const res = await apiFetchWithAuthRetry("/antigravity-credits", {
      method: "GET",
      headers: buildAuthHeaders()
    });
    if (!res.ok) return false;
    const data = await res.json();
    const credits = Number.parseInt(data?.antigravityCredits, 10);
    antigravityCredits = Number.isFinite(credits) ? credits : 0;
    updateAntigravityButtonLabel();
    return true;
  } catch (_) {
    return false;
  }
}

async function grantUndoCredit(amount = 1) {
  const parsed = Number.parseInt(amount, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return;

  try {
    const res = await apiFetchWithAuthRetry("/undo-credits/grant", {
      method: "POST",
      headers: buildAuthHeaders(),
      body: JSON.stringify({ amount: parsed })
    });
    if (res.ok) {
      const data = await res.json();
      const credits = Number.parseInt(data?.undoCredits, 10);
      undoCredits = Number.isFinite(credits) ? credits : undoCredits + parsed;
      updateUndoButtonLabel();
      return;
    }
  } catch (_) {}

  undoCredits += parsed;
  updateUndoButtonLabel();
}

async function consumeUndoCredit(amount = 1) {
  const parsed = Number.parseInt(amount, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return false;

  try {
    const res = await apiFetchWithAuthRetry("/undo-credits/use", {
      method: "POST",
      headers: buildAuthHeaders(),
      body: JSON.stringify({ amount: parsed })
    });
    if (res.status === 400) {
      return false;
    }
    if (res.ok) {
      const data = await res.json();
      const credits = Number.parseInt(data?.undoCredits, 10);
      undoCredits = Number.isFinite(credits) ? credits : Math.max(undoCredits - parsed, 0);
      updateUndoButtonLabel();
      return true;
    }
  } catch (_) {}

  if (undoCredits < parsed) return false;
  undoCredits -= parsed;
  updateUndoButtonLabel();
  return true;
}

async function grantAntigravityCreditsFromServerOnly(amount = 1) {
  const parsed = Number.parseInt(amount, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return false;
  try {
    const res = await apiFetchWithAuthRetry("/antigravity-credits/grant", {
      method: "POST",
      headers: buildAuthHeaders(),
      body: JSON.stringify({ amount: parsed })
    });
    if (!res.ok) return false;
    const data = await res.json();
    const credits = Number.parseInt(data?.antigravityCredits, 10);
    antigravityCredits = Number.isFinite(credits) ? credits : antigravityCredits + parsed;
    updateAntigravityButtonLabel();
    return true;
  } catch (_) {
    return false;
  }
}

async function consumeAntigravityCredit(amount = 1) {
  const parsed = Number.parseInt(amount, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return false;
  try {
    const res = await apiFetchWithAuthRetry("/antigravity-credits/use", {
      method: "POST",
      headers: buildAuthHeaders(),
      body: JSON.stringify({ amount: parsed })
    });
    if (res.status === 400) return false;
    if (res.ok) {
      const data = await res.json();
      const credits = Number.parseInt(data?.antigravityCredits, 10);
      antigravityCredits = Number.isFinite(credits) ? credits : Math.max(antigravityCredits - parsed, 0);
      updateAntigravityButtonLabel();
      return true;
    }
  } catch (_) {}

  if (antigravityCredits < parsed) return false;
  antigravityCredits -= parsed;
  updateAntigravityButtonLabel();
  return true;
}

/** Main portal shop item (must match portal config). */
const PORTAL_UNDO_ITEM_ID = "chess_mater_undo";
const PORTAL_ANTIGRAVITY_ITEM_ID = "chess_mater_antigravity";
const PORTAL_REPLAY_ITEM_ID = "chess_mater_reply";
const PORTAL_UNDO_GAME_MODE = "chessmater";
const UNDO_SHOP_HINT_COINS = 5;
const ANTIGRAVITY_SHOP_HINT_COINS = 5;
const REPLAY_SHOP_HINT_DIAMONDS = 2;

function normalizePortalApiBase(base) {
  if (!base || typeof base !== "string") return "";
  return base.replace(/\/+$/, "");
}

function portalUndoShopAvailable() {
  const token = window.cmPortalToken;
  const base = normalizePortalApiBase(window.cmPortalApiBase || "");
  return !!(token && base);
}

async function getPortalAssets() {
  const token = window.cmPortalToken;
  const base = normalizePortalApiBase(window.cmPortalApiBase || "");
  if (!token || !base) return null;
  try {
    const res = await fetch(`${base}/api/user/assets`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-User-Timezone": Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
      }
    });
    const data = await res.json().catch(() => null);
    const coins = data?.data?.coins;
    const diamonds = data?.data?.diamonds;
    const flowers = data?.data?.flowers;
    if (typeof coins !== "number" || typeof diamonds !== "number" || typeof flowers !== "number") {
      return null;
    }
    return {
      coins: Math.max(0, Math.floor(coins)),
      diamonds: Math.max(0, Math.floor(diamonds)),
      flowers: Math.max(0, Math.floor(flowers))
    };
  } catch (_) {
    return null;
  }
}

async function postPortalRedeemUndo() {
  return postPortalRedeemItem(PORTAL_UNDO_ITEM_ID);
}

async function postPortalRedeemItem(itemId) {
  const token = window.cmPortalToken;
  const base = normalizePortalApiBase(window.cmPortalApiBase || "");
  if (!token || !base) return { ok: false, message: "Portal session not available." };
  const url = `${base}/api/user/shop/redeem?item_id=${encodeURIComponent(itemId)}&game_mode=${encodeURIComponent(PORTAL_UNDO_GAME_MODE)}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-User-Timezone": Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
      }
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const msg =
        (data && (data.message || data.error || data.detail)) ||
        `Redeem failed (${res.status}).`;
      return { ok: false, message: String(msg) };
    }
    if (data && data.success === false) {
      const msg = (data.message || data.error || "Redeem rejected.") + "";
      return { ok: false, message: msg };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err && err.message ? err.message : "Network error during redeem." };
  }
}

async function grantUndoCreditsFromServerOnly(amount = 1) {
  const parsed = Number.parseInt(amount, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return false;
  try {
    const res = await apiFetchWithAuthRetry("/undo-credits/grant", {
      method: "POST",
      headers: buildAuthHeaders(),
      body: JSON.stringify({ amount: parsed })
    });
    if (!res.ok) return false;
    const data = await res.json();
    const credits = Number.parseInt(data?.undoCredits, 10);
    if (Number.isFinite(credits)) {
      undoCredits = credits;
    } else {
      undoCredits += parsed;
    }
    updateUndoButtonLabel();
    return true;
  } catch (_) {
    return false;
  }
}

const undoExchangeModal = document.getElementById("undoExchangeModal");
const undoExchangeCoinsEl = document.getElementById("undoExchangeCoins");
const undoExchangeDiamondsEl = document.getElementById("undoExchangeDiamonds");
const undoExchangeFlowersEl = document.getElementById("undoExchangeFlowers");
const undoExchangeMessageEl = document.getElementById("undoExchangeMessage");
const undoExchangeRedeemBtn = document.getElementById("undoExchangeRedeemBtn");
const undoExchangeCloseBtn = document.getElementById("undoExchangeCloseBtn");
const undoExchangeCostTextEl = document.getElementById("undoExchangeCostText");
const antigravityExchangeModal = document.getElementById("antigravityExchangeModal");
const antigravityExchangeCoinsEl = document.getElementById("antigravityExchangeCoins");
const antigravityExchangeDiamondsEl = document.getElementById("antigravityExchangeDiamonds");
const antigravityExchangeFlowersEl = document.getElementById("antigravityExchangeFlowers");
const antigravityExchangeMessageEl = document.getElementById("antigravityExchangeMessage");
const antigravityExchangeRedeemBtn = document.getElementById("antigravityExchangeRedeemBtn");
const antigravityExchangeCloseBtn = document.getElementById("antigravityExchangeCloseBtn");
const antigravityExchangeCostTextEl = document.getElementById("antigravityExchangeCostText");
const replayExchangeModal = document.getElementById("replayExchangeModal");
const replayExchangeCoinsEl = document.getElementById("replayExchangeCoins");
const replayExchangeDiamondsEl = document.getElementById("replayExchangeDiamonds");
const replayExchangeFlowersEl = document.getElementById("replayExchangeFlowers");
const replayExchangeMessageEl = document.getElementById("replayExchangeMessage");
const replayExchangeRedeemBtn = document.getElementById("replayExchangeRedeemBtn");
const replayExchangeCloseBtn = document.getElementById("replayExchangeCloseBtn");
const replayExchangeCostTextEl = document.getElementById("replayExchangeCostText");

function setUndoExchangeBalanceCells(coinsText, diamondsText, flowersText) {
  if (undoExchangeCoinsEl) undoExchangeCoinsEl.textContent = coinsText;
  if (undoExchangeDiamondsEl) undoExchangeDiamondsEl.textContent = diamondsText;
  if (undoExchangeFlowersEl) undoExchangeFlowersEl.textContent = flowersText;
}

function setUndoExchangeMessage(text, kind) {
  if (!undoExchangeMessageEl) return;
  undoExchangeMessageEl.textContent = text || "";
  undoExchangeMessageEl.classList.remove("error", "success", "hint");
  if (kind === "error") undoExchangeMessageEl.classList.add("error");
  if (kind === "success") undoExchangeMessageEl.classList.add("success");
  if (kind === "hint") undoExchangeMessageEl.classList.add("hint");
}

function setUndoExchangeBusy(busy) {
  if (!undoExchangeRedeemBtn) return;
  undoExchangeRedeemBtn.disabled = !!busy || !portalUndoShopAvailable();
}

function closeUndoExchangeModal() {
  if (!undoExchangeModal) return;
  undoExchangeModal.classList.remove("active");
  undoExchangeModal.setAttribute("aria-hidden", "true");
}

async function refreshUndoExchangeAssetsDisplay() {
  if (!portalUndoShopAvailable()) {
    setUndoExchangeBalanceCells("—", "—", "—");
    setUndoExchangeMessage("Open from the main portal to load your coins, diamonds, and flowers.", "hint");
    return;
  }
  setUndoExchangeMessage("");
  setUndoExchangeBalanceCells("…", "…", "…");
  const assets = await getPortalAssets();
  if (!assets) {
    setUndoExchangeBalanceCells("—", "—", "—");
    setUndoExchangeMessage("Could not load assets. Check portal session.", "error");
    return;
  }
  setUndoExchangeBalanceCells(String(assets.coins), String(assets.diamonds), String(assets.flowers));
}

async function openUndoExchangeModal() {
  if (!undoExchangeModal) return;
  if (undoExchangeCostTextEl) {
    undoExchangeCostTextEl.textContent = `${UNDO_SHOP_HINT_COINS} coins`;
  }
  setUndoExchangeMessage("");
  undoExchangeModal.classList.add("active");
  undoExchangeModal.setAttribute("aria-hidden", "false");
  setUndoExchangeBusy(false);
  await refreshUndoExchangeAssetsDisplay();
}

async function handleUndoExchangeRedeem() {
  if (!portalUndoShopAvailable()) return;
  setUndoExchangeMessage("");
  setUndoExchangeBusy(true);
  const redeem = await postPortalRedeemUndo();
  if (!redeem.ok) {
    setUndoExchangeMessage(redeem.message || "Redeem failed.", "error");
    setUndoExchangeBusy(false);
    await refreshUndoExchangeAssetsDisplay();
    return;
  }
  const granted = await grantUndoCreditsFromServerOnly(1);
  if (!granted) {
    setUndoExchangeMessage(
      "Portal redeem may have succeeded, but adding undo credits failed. Please refresh or contact support if coins were deducted.",
      "error"
    );
    setUndoExchangeBusy(false);
    await syncUndoCreditsFromServer();
    await refreshUndoExchangeAssetsDisplay();
    return;
  }
  await refreshUndoExchangeAssetsDisplay();
  await syncUndoCreditsFromServer();
  setUndoExchangeBusy(false);
  closeUndoExchangeModal();
}

function setupUndoExchangeModal() {
  if (undoExchangeCloseBtn) {
    undoExchangeCloseBtn.addEventListener("click", closeUndoExchangeModal);
  }
  if (undoExchangeModal) {
    undoExchangeModal.addEventListener("click", (e) => {
      if (e.target === undoExchangeModal) closeUndoExchangeModal();
    });
  }
  if (undoExchangeRedeemBtn) {
    undoExchangeRedeemBtn.addEventListener("click", () => {
      handleUndoExchangeRedeem();
    });
  }
}

setupUndoExchangeModal();
window.openUndoExchangeModal = openUndoExchangeModal;

function setGenericExchangeBalanceCells(coinsEl, diamondsEl, flowersEl, coinsText, diamondsText, flowersText) {
  if (coinsEl) coinsEl.textContent = coinsText;
  if (diamondsEl) diamondsEl.textContent = diamondsText;
  if (flowersEl) flowersEl.textContent = flowersText;
}

function setGenericExchangeMessage(messageEl, text, kind) {
  if (!messageEl) return;
  messageEl.textContent = text || "";
  messageEl.classList.remove("error", "success", "hint");
  if (kind === "error") messageEl.classList.add("error");
  if (kind === "success") messageEl.classList.add("success");
  if (kind === "hint") messageEl.classList.add("hint");
}

async function fetchReplayUnlockStatusForLevel(levelNumber) {
  const lvl = Number.parseInt(levelNumber, 10);
  if (!Number.isFinite(lvl) || lvl <= 0) return false;
  try {
    const res = await apiFetchWithAuthRetry(`/replay-unlocks/status?level=${encodeURIComponent(lvl)}`, {
      method: "GET",
      headers: buildAuthHeaders()
    });
    if (!res.ok) return false;
    const data = await res.json();
    return !!data?.unlocked;
  } catch (_) {
    return false;
  }
}

async function activateReplayUnlockForLevel(levelNumber) {
  const lvl = Number.parseInt(levelNumber, 10);
  if (!Number.isFinite(lvl) || lvl <= 0) return false;
  try {
    const res = await apiFetchWithAuthRetry("/replay-unlocks/activate", {
      method: "POST",
      headers: buildAuthHeaders(),
      body: JSON.stringify({ level: lvl })
    });
    return res.ok;
  } catch (_) {
    return false;
  }
}

function closeAntigravityExchangeModal() {
  if (!antigravityExchangeModal) return;
  antigravityExchangeModal.classList.remove("active");
  antigravityExchangeModal.setAttribute("aria-hidden", "true");
}

async function refreshAntigravityExchangeAssetsDisplay() {
  if (!portalUndoShopAvailable()) {
    setGenericExchangeBalanceCells(antigravityExchangeCoinsEl, antigravityExchangeDiamondsEl, antigravityExchangeFlowersEl, "—", "—", "—");
    setGenericExchangeMessage(antigravityExchangeMessageEl, "Open from the main portal to load your coins, diamonds, and flowers.", "hint");
    return;
  }
  setGenericExchangeMessage(antigravityExchangeMessageEl, "");
  setGenericExchangeBalanceCells(antigravityExchangeCoinsEl, antigravityExchangeDiamondsEl, antigravityExchangeFlowersEl, "…", "…", "…");
  const assets = await getPortalAssets();
  if (!assets) {
    setGenericExchangeBalanceCells(antigravityExchangeCoinsEl, antigravityExchangeDiamondsEl, antigravityExchangeFlowersEl, "—", "—", "—");
    setGenericExchangeMessage(antigravityExchangeMessageEl, "Could not load assets. Check portal session.", "error");
    return;
  }
  setGenericExchangeBalanceCells(antigravityExchangeCoinsEl, antigravityExchangeDiamondsEl, antigravityExchangeFlowersEl, String(assets.coins), String(assets.diamonds), String(assets.flowers));
}

function setAntigravityExchangeBusy(busy) {
  if (!antigravityExchangeRedeemBtn) return;
  antigravityExchangeRedeemBtn.disabled = !!busy || !portalUndoShopAvailable();
}

async function openAntigravityExchangeModal() {
  if (!antigravityExchangeModal) return;
  if (antigravityExchangeCostTextEl) {
    antigravityExchangeCostTextEl.textContent = `${ANTIGRAVITY_SHOP_HINT_COINS} coins`;
  }
  setGenericExchangeMessage(antigravityExchangeMessageEl, "");
  antigravityExchangeModal.classList.add("active");
  antigravityExchangeModal.setAttribute("aria-hidden", "false");
  setAntigravityExchangeBusy(false);
  await refreshAntigravityExchangeAssetsDisplay();
}

async function handleAntigravityExchangeRedeem() {
  if (!portalUndoShopAvailable()) return;
  setGenericExchangeMessage(antigravityExchangeMessageEl, "");
  setAntigravityExchangeBusy(true);
  const redeem = await postPortalRedeemItem(PORTAL_ANTIGRAVITY_ITEM_ID);
  if (!redeem.ok) {
    setGenericExchangeMessage(antigravityExchangeMessageEl, redeem.message || "Redeem failed.", "error");
    setAntigravityExchangeBusy(false);
    await refreshAntigravityExchangeAssetsDisplay();
    return;
  }
  const granted = await grantAntigravityCreditsFromServerOnly(1);
  if (!granted) {
    setGenericExchangeMessage(antigravityExchangeMessageEl, "Portal redeem may have succeeded, but adding antigravity credits failed. Please refresh.", "error");
    setAntigravityExchangeBusy(false);
    await syncAntigravityCreditsFromServer();
    await refreshAntigravityExchangeAssetsDisplay();
    return;
  }
  await refreshAntigravityExchangeAssetsDisplay();
  await syncAntigravityCreditsFromServer();
  setAntigravityExchangeBusy(false);
  closeAntigravityExchangeModal();
}

function setupAntigravityExchangeModal() {
  if (antigravityExchangeCloseBtn) antigravityExchangeCloseBtn.addEventListener("click", closeAntigravityExchangeModal);
  if (antigravityExchangeModal) {
    antigravityExchangeModal.addEventListener("click", (e) => {
      if (e.target === antigravityExchangeModal) closeAntigravityExchangeModal();
    });
  }
  if (antigravityExchangeRedeemBtn) {
    antigravityExchangeRedeemBtn.addEventListener("click", () => {
      handleAntigravityExchangeRedeem();
    });
  }
}

function closeReplayExchangeModal() {
  if (!replayExchangeModal) return;
  replayExchangeModal.classList.remove("active");
  replayExchangeModal.setAttribute("aria-hidden", "true");
}

async function refreshReplayExchangeAssetsDisplay() {
  if (!portalUndoShopAvailable()) {
    setGenericExchangeBalanceCells(replayExchangeCoinsEl, replayExchangeDiamondsEl, replayExchangeFlowersEl, "—", "—", "—");
    setGenericExchangeMessage(replayExchangeMessageEl, "Open from the main portal to load your coins, diamonds, and flowers.", "hint");
    return;
  }
  setGenericExchangeMessage(replayExchangeMessageEl, "");
  setGenericExchangeBalanceCells(replayExchangeCoinsEl, replayExchangeDiamondsEl, replayExchangeFlowersEl, "…", "…", "…");
  const assets = await getPortalAssets();
  if (!assets) {
    setGenericExchangeBalanceCells(replayExchangeCoinsEl, replayExchangeDiamondsEl, replayExchangeFlowersEl, "—", "—", "—");
    setGenericExchangeMessage(replayExchangeMessageEl, "Could not load assets. Check portal session.", "error");
    return;
  }
  setGenericExchangeBalanceCells(replayExchangeCoinsEl, replayExchangeDiamondsEl, replayExchangeFlowersEl, String(assets.coins), String(assets.diamonds), String(assets.flowers));
}

function setReplayExchangeBusy(busy) {
  if (!replayExchangeRedeemBtn) return;
  replayExchangeRedeemBtn.disabled = !!busy || !portalUndoShopAvailable();
}

async function openReplayExchangeModal() {
  if (!replayExchangeModal) return;
  if (replayExchangeCostTextEl) replayExchangeCostTextEl.textContent = `${REPLAY_SHOP_HINT_DIAMONDS} diamonds`;
  setGenericExchangeMessage(replayExchangeMessageEl, "");
  replayExchangeModal.classList.add("active");
  replayExchangeModal.setAttribute("aria-hidden", "false");
  setReplayExchangeBusy(false);
  await refreshReplayExchangeAssetsDisplay();
}

async function handleReplayExchangeRedeem() {
  if (!portalUndoShopAvailable()) return;
  const levelNumber = currentLevelIndex + 1;
  if (!Number.isFinite(levelNumber) || levelNumber <= 0) return;
  setGenericExchangeMessage(replayExchangeMessageEl, "");
  setReplayExchangeBusy(true);
  const redeem = await postPortalRedeemItem(PORTAL_REPLAY_ITEM_ID);
  if (!redeem.ok) {
    setGenericExchangeMessage(replayExchangeMessageEl, redeem.message || "Redeem failed.", "error");
    setReplayExchangeBusy(false);
    await refreshReplayExchangeAssetsDisplay();
    return;
  }
  const activated = await activateReplayUnlockForLevel(levelNumber);
  if (!activated) {
    setGenericExchangeMessage(replayExchangeMessageEl, "Redeem succeeded, but replay unlock sync failed. Please refresh.", "error");
    setReplayExchangeBusy(false);
    await refreshReplayExchangeAssetsDisplay();
    return;
  }

  replayUnlockedForLevel = true;
  await fetchFewestOtherMovesForCurrentLevel();
  updateLevelCompleteReplayDisplay();
  await refreshReplayExchangeAssetsDisplay();
  setReplayExchangeBusy(false);
  closeReplayExchangeModal();
}

function setupReplayExchangeModal() {
  if (replayExchangeCloseBtn) replayExchangeCloseBtn.addEventListener("click", closeReplayExchangeModal);
  if (replayExchangeModal) {
    replayExchangeModal.addEventListener("click", (e) => {
      if (e.target === replayExchangeModal) closeReplayExchangeModal();
    });
  }
  if (replayExchangeRedeemBtn) {
    replayExchangeRedeemBtn.addEventListener("click", () => {
      handleReplayExchangeRedeem();
    });
  }
  if (levelCompleteReplayLock) {
    levelCompleteReplayLock.addEventListener("click", () => {
      openReplayExchangeModal();
    });
  }
}

setupAntigravityExchangeModal();
setupReplayExchangeModal();
window.openAntigravityExchangeModal = openAntigravityExchangeModal;
window.openReplayExchangeModal = openReplayExchangeModal;

function isAudioMuted() {
  return !!window.cmAudioMuted;
}

function playSound(audioEl, volume) {
  if (!audioEl || isAudioMuted()) return;
  audioEl.currentTime = 0;
  if (typeof volume === "number") audioEl.volume = volume;
  audioEl.play().catch(() => {});
}


// Transformer block variables
let showTransformerMenu = false;
let transformerPosition = null;
let transformerPlayerIndex = -1;

const fogToggle = document.getElementById("levelFogToggle");
if (fogToggle) {
  fogToggle.addEventListener("change", (e) => {
    fogEnabled = e.target.checked;
    updateStatus(`Fog of War ${fogEnabled ? "Enabled" : "Disabled"} for this level`);
    drawBoard(); // Redraw immediately to show/hide fog
  });
}

// gravityBtn.addEventListener("click", () => {
//   applyGravity();
// });

document.addEventListener('DOMContentLoaded', () => {
  try {
    const legacyNextBtn = document.getElementById('nextLevelBtn');
    if (legacyNextBtn) {
      const legacyContainer = legacyNextBtn.parentElement;
      legacyNextBtn.remove();
      if (legacyContainer && legacyContainer.children.length === 0) {
        legacyContainer.remove();
      }
    }

    const tipToggle = document.getElementById('blockTipToggle');
    const tipModal = document.getElementById('blockTipModal');
    const closeBlockTip = document.getElementById('closeBlockTip');
    if (tipModal && tipToggle && typeof tipToggle.addEventListener === 'function') {
      tipToggle.addEventListener('click', () => {
        tipModal.classList.add('active');
      });
    }
    if (tipModal && closeBlockTip) {
      closeBlockTip.addEventListener('click', () => {
        tipModal.classList.remove('active');
      });
      tipModal.addEventListener('click', (e) => {
        if (e.target === tipModal) {
          tipModal.classList.remove('active');
        }
      });
    }

    if (levelCompleteRetryBtn) {
      levelCompleteRetryBtn.addEventListener('click', () => {
        if (levelCompleteModal) levelCompleteModal.classList.remove('active');
        restartLevel();
      });
    }

    if (levelCompleteNextBtn) {
      levelCompleteNextBtn.addEventListener('click', () => {
        if (currentLevelIndex < LEVELS.length - 1) {
          currentLevelIndex++;
          if (levelCompleteModal) levelCompleteModal.classList.remove('active');
          loadPuzzle(LEVELS[currentLevelIndex]);
        }
      });
    }

    if (closeLevelCompleteModalBtn && levelCompleteModal) {
      closeLevelCompleteModalBtn.addEventListener('click', () => {
        levelCompleteModal.classList.remove('active');
      });
      levelCompleteModal.addEventListener('click', (e) => {
        if (e.target === levelCompleteModal) {
          levelCompleteModal.classList.remove('active');
        }
      });
    }
  } catch (e) {}
});

// Function to resize the board
function resizeBoard(newRows, newCols) {
  if (newRows === ROWS && newCols === COLS) return;
  
  // Create new board
  const newBoard = Array.from({ length: newRows }, () => Array(newCols).fill(CELL_TYPES.EMPTY));
  
  // Copy existing content (if it fits)
  const copyRows = Math.min(ROWS, newRows);
  const copyCols = Math.min(COLS, newCols);
  
  for (let r = 0; r < copyRows; r++) {
    for (let c = 0; c < copyCols; c++) {
      newBoard[r][c] = board[r][c];
    }
  }
  
  // Update board and dimensions
  board = newBoard;
  ROWS = newRows;
  COLS = newCols;
  
  // Resize canvas
  resizeCanvas();
  
  // Filter players and objectives that are still within bounds
  players = players.filter(player => 
    player.row < newRows && player.col < newCols
  );
  
  objectives = objectives.filter(obj => 
    obj.row < newRows && obj.col < newCols
  );
  
  // Update goal if it's out of bounds
  if (goal && (goal.row >= newRows || goal.col >= newCols)) {
    goal = null;
  }
  
  // Update counts and redraw
  updatePlayerCount();
  updateObjectiveCount();
  updateStatus(`Board resized to ${newRows}x${newCols}`);
}

function resizeCanvas() {
  canvas.width = COLS * TILE_SIZE;
  canvas.height = ROWS * TILE_SIZE;

  const layoutRow = document.getElementById("gameLayoutRow");
  const sidePanel = document.getElementById("gameSidePanel");
  const canvasContainer = canvas.parentElement;

  const vv = window.visualViewport;
  const viewW = vv ? vv.width : window.innerWidth;
  const viewH = vv ? vv.height : window.innerHeight;

  const viewportPadding = 20;
  let maxWidth = viewW - viewportPadding * 2;
  let maxHeight = viewH - 90;

  if (layoutRow && canvasContainer) {
    const layoutStyle = window.getComputedStyle(layoutRow);
    const isColumn = (layoutStyle.flexDirection || "").startsWith("column");
    const rowRect = layoutRow.getBoundingClientRect();
    const gap = Number.parseFloat(layoutStyle.columnGap || layoutStyle.gap || "0") || 0;

    // Height budget from layout row down to viewport bottom.
    maxHeight = Math.max(220, viewH - rowRect.top - 24);

    if (isColumn) {
      maxWidth = Math.max(220, canvasContainer.clientWidth || maxWidth);
    } else {
      const rowWidth = layoutRow.clientWidth || maxWidth;
      const sideWidth = sidePanel ? sidePanel.getBoundingClientRect().width : 0;
      maxWidth = Math.max(220, rowWidth - sideWidth - gap);
    }
  }

  // Calculate the best scale to fit BOTH width and height
  const scaleX = maxWidth / canvas.width;
  const scaleY = maxHeight / canvas.height;
  const scaleFactor = Math.min(scaleX, scaleY, 1); // Never scale up past 100%

  // Apply the scale
  canvas.style.width = (canvas.width * scaleFactor) + "px";
  canvas.style.height = (canvas.height * scaleFactor) + "px";
}

function updateStatus(message) {
  const editorBanner = document.getElementById("editorStatusBanner");
  if (editorBanner) {
    editorBanner.textContent = message;
    clearTimeout(updateStatus._editorT);
    updateStatus._editorT = setTimeout(() => {
      if (editorBanner.textContent === message) editorBanner.textContent = "";
    }, 5000);
  }
  if (!SHOW_IN_GAME_STATUS) return;
  if (!statusMessage) return;
  statusMessage.textContent = message;
  setTimeout(() => {
    if (statusMessage.textContent === message) {
      statusMessage.textContent = "";
    }
  }, 3000);
}

function updatePlayerCount() {
  if (!playerCount) return;
  playerCount.textContent = `Players: ${players.length}`;
}

function updateMoveCountDisplay() {
  if (moveCountDisplay) {
    moveCountDisplay.textContent = `Your move: ${levelMoveCount}`;
  }
  updateLevelCompleteStatsDisplay();
}

function updateLevelCompleteStatsDisplay() {
  if (levelCompleteMoveCountDisplay) {
    levelCompleteMoveCountDisplay.textContent = `Your move: ${levelMoveCount}`;
  }
  if (levelCompleteFewestOtherMovesDisplay) {
    levelCompleteFewestOtherMovesDisplay.textContent = Number.isFinite(fewestOtherMovesForLevel)
      ? `Fewest move by other user: ${fewestOtherMovesForLevel}`
      : "Fewest move by other user: --";
  }
  updateLevelCompleteAchievementDisplay();
}

function updateLevelCompleteAchievementDisplay() {
  if (!levelCompleteAchievement) return;
  if (!Number.isFinite(levelMoveCount) || levelMoveCount < 0) {
    levelCompleteAchievement.textContent = "";
    return;
  }

  if (!Number.isFinite(fewestOtherMovesForLevel)) {
    levelCompleteAchievement.textContent = "New record! No other player's best route exists yet.";
    return;
  }

  if (levelMoveCount < fewestOtherMovesForLevel) {
    const diff = fewestOtherMovesForLevel - levelMoveCount;
    levelCompleteAchievement.textContent = `New record! You beat the best other route by ${diff} move${diff === 1 ? "" : "s"}.`;
    return;
  }

  if (levelMoveCount === fewestOtherMovesForLevel) {
    levelCompleteAchievement.textContent = "Great run! You tied the best other route.";
    return;
  }

  levelCompleteAchievement.textContent = "";
}

function buildCurrentReplaySnapshot(moveMeta = null) {
  return {
    rows: ROWS,
    cols: COLS,
    board: cloneGameData(board),
    players: cloneGameData(players),
    goal: cloneGameData(goal),
    objectives: cloneGameData(objectives),
    move: moveMeta ? cloneGameData(moveMeta) : null
  };
}

function resetCurrentLevelMoveTrace() {
  pendingMoveTraceEntry = null;
  currentLevelMoveTrace = [buildCurrentReplaySnapshot(null)];
}

function queueMoveTraceCapture(moveMeta) {
  pendingMoveTraceEntry = moveMeta || {};
}

function markPendingMoveTraceAntigravity(flag = true) {
  if (!pendingMoveTraceEntry) return;
  pendingMoveTraceEntry.antigravityApplied = !!flag;
}

function queueSystemTraceCapture(meta) {
  if (pendingMoveTraceEntry) return;
  pendingMoveTraceEntry = meta || {};
}

function tryCapturePendingMoveTrace(force) {
  if (!pendingMoveTraceEntry) return;
  const settled = force || (
    fallingPieces.length === 0 &&
    risingPieces.length === 0 &&
    !pendingMoveCounter
  );
  if (!settled) return;

  const snapshot = buildCurrentReplaySnapshot(pendingMoveTraceEntry);
  currentLevelMoveTrace.push(snapshot);
  if (currentLevelMoveTrace.length > 500) {
    currentLevelMoveTrace.splice(1, currentLevelMoveTrace.length - 500);
  }
  pendingMoveTraceEntry = null;
}

function sanitizeReplayPath(rawPath) {
  if (!Array.isArray(rawPath) || rawPath.length === 0) return null;
  const cleaned = rawPath.filter(step =>
    step &&
    Number.isFinite(Number(step.rows)) &&
    Number.isFinite(Number(step.cols)) &&
    Array.isArray(step.board) &&
    Array.isArray(step.players)
  );
  return cleaned.length ? cleaned : null;
}

function hasReplayPlayerMove(step) {
  const moveMeta = step && step.move ? step.move : null;
  return !!(
    moveMeta &&
    moveMeta.from &&
    Number.isFinite(Number(moveMeta.from.row)) &&
    Number.isFinite(Number(moveMeta.from.col)) &&
    moveMeta.to &&
    Number.isFinite(Number(moveMeta.to.row)) &&
    Number.isFinite(Number(moveMeta.to.col))
  );
}

function buildReplayStepNumbers(path) {
  if (!Array.isArray(path) || !path.length) return [];

  const numbers = Array(path.length).fill(0);
  const moveOrdinals = Array(path.length).fill(0);
  let moveCounter = 0;

  for (let i = 0; i < path.length; i++) {
    if (hasReplayPlayerMove(path[i])) {
      moveCounter += 1;
      moveOrdinals[i] = moveCounter;
    }
  }

  for (let i = 0; i < path.length; i++) {
    if (i === 0) {
      numbers[i] = 0;
      continue;
    }

    if (moveOrdinals[i] > 0) {
      numbers[i] = moveOrdinals[i];
      continue;
    }

    // System-only frames share the next move number (if any), so users see
    // "antigravity result -> move" under one logical step.
    let nextMoveOrdinal = 0;
    for (let j = i + 1; j < path.length; j++) {
      if (moveOrdinals[j] > 0) {
        nextMoveOrdinal = moveOrdinals[j];
        break;
      }
    }
    numbers[i] = nextMoveOrdinal > 0 ? nextMoveOrdinal : moveCounter;
  }

  return numbers;
}

function drawReplayCellDecoration(replayCtx, cellType, x, y, tile) {
  const inset = Math.max(1, Math.floor(tile * 0.08));
  const innerSize = Math.max(1, tile - inset * 2);
  const centerX = x + tile / 2;
  const centerY = y + tile / 2;

  if (cellType === CELL_TYPES.SOLID_BLOCK) {
    replayCtx.fillStyle = "rgba(46, 204, 113, 0.7)";
    replayCtx.fillRect(x + inset, y + inset, innerSize, innerSize);
    return;
  }

  if (cellType === CELL_TYPES.PHASE_BLOCK) {
    replayCtx.fillStyle = "rgba(52, 152, 219, 0.3)";
    replayCtx.fillRect(x + inset, y + inset, innerSize, innerSize);
    replayCtx.fillStyle = "rgba(25, 118, 210, 0.6)";
    const arrow = Math.max(2, Math.floor(tile * 0.16));
    const bottom = y + tile - inset - 1;
    replayCtx.beginPath();
    replayCtx.moveTo(centerX, bottom);
    replayCtx.lineTo(centerX - arrow, bottom - arrow);
    replayCtx.lineTo(centerX + arrow, bottom - arrow);
    replayCtx.closePath();
    replayCtx.fill();
    return;
  }

  if (cellType === CELL_TYPES.PHASE_BLOCK_ACTIVE) {
    replayCtx.fillStyle = "rgba(41, 128, 185, 0.8)";
    replayCtx.fillRect(x + inset, y + inset, innerSize, innerSize);
    return;
  }

  if (cellType === CELL_TYPES.TRANSFORMER) {
    replayCtx.fillStyle = "rgba(155, 89, 182, 0.7)";
    replayCtx.fillRect(x + inset, y + inset, innerSize, innerSize);
    replayCtx.fillStyle = "#ffffff";
    replayCtx.textAlign = "center";
    replayCtx.textBaseline = "middle";
    replayCtx.font = `bold ${Math.max(8, Math.floor(tile * 0.5))}px Arial`;
    replayCtx.fillText("?", centerX, centerY + 0.5);
    return;
  }

  if (cellType === CELL_TYPES.OBJECTIVE || cellType === CELL_TYPES.OBJECTIVE_COMPLETED) {
    replayCtx.fillStyle = cellType === CELL_TYPES.OBJECTIVE
      ? "rgba(243, 156, 18, 0.7)"
      : "rgba(46, 204, 113, 0.7)";
    replayCtx.beginPath();
    replayCtx.moveTo(centerX, y + inset);
    replayCtx.lineTo(x + tile - inset, centerY);
    replayCtx.lineTo(centerX, y + tile - inset);
    replayCtx.lineTo(x + inset, centerY);
    replayCtx.closePath();
    replayCtx.fill();
    if (cellType === CELL_TYPES.OBJECTIVE_COMPLETED) {
      replayCtx.strokeStyle = "#ffffff";
      replayCtx.lineWidth = Math.max(1, tile * 0.06);
      replayCtx.beginPath();
      replayCtx.moveTo(x + tile * 0.28, centerY);
      replayCtx.lineTo(x + tile * 0.44, y + tile * 0.7);
      replayCtx.lineTo(x + tile * 0.74, y + tile * 0.3);
      replayCtx.stroke();
    }
    return;
  }

  if ([
    CELL_TYPES.TELEPORT_PURPLE,
    CELL_TYPES.TELEPORT_GREEN,
    CELL_TYPES.TELEPORT_BLUE,
    CELL_TYPES.TELEPORT_ORANGE
  ].includes(cellType)) {
    const color = TELEPORT_COLORS[cellType];
    if (color) {
      replayCtx.fillStyle = color.fill;
      replayCtx.beginPath();
      replayCtx.arc(centerX, centerY, tile / 3, 0, Math.PI * 2);
      replayCtx.fill();
      replayCtx.strokeStyle = color.stroke;
      replayCtx.lineWidth = Math.max(1, tile * 0.07);
      replayCtx.stroke();
    }
    return;
  }

  if (cellType === CELL_TYPES.BOMB) {
    const img = pieceImages.bomb;
    if (img && img.complete) {
      const pad = Math.max(1, Math.floor(tile * 0.13));
      replayCtx.drawImage(img, x + pad, y + pad, tile - pad * 2, tile - pad * 2);
    } else {
      replayCtx.fillStyle = "#111111";
      replayCtx.beginPath();
      replayCtx.arc(centerX, centerY, tile * 0.28, 0, Math.PI * 2);
      replayCtx.fill();
    }
    return;
  }

  if (cellType === CELL_TYPES.GOAL || cellType === CELL_TYPES.COUNTER_GOAL) {
    const img = pieceImages.target;
    if (img && img.complete) {
      const pad = Math.max(1, Math.floor(tile * 0.13));
      replayCtx.drawImage(img, x + pad, y + pad, tile - pad * 2, tile - pad * 2);
    } else {
      replayCtx.fillStyle = "#c62828";
      replayCtx.beginPath();
      replayCtx.arc(centerX, centerY, tile * 0.28, 0, Math.PI * 2);
      replayCtx.fill();
    }
  }
}

function drawReplayPlayerPiece(replayCtx, pieceType, row, col, ox, oy, tile) {
  const x = ox + col * tile;
  const y = oy + row * tile;
  const pad = Math.max(1, Math.floor(tile * 0.13));
  const img = pieceImages[pieceType];
  if (img && img.complete) {
    replayCtx.drawImage(img, x + pad, y + pad, tile - pad * 2, tile - pad * 2);
    return;
  }
  replayCtx.fillStyle = "#ffffff";
  replayCtx.beginPath();
  replayCtx.arc(x + tile / 2, y + tile / 2, Math.max(2, tile * 0.32), 0, Math.PI * 2);
  replayCtx.fill();
  replayCtx.fillStyle = "#2c3e50";
  replayCtx.textAlign = "center";
  replayCtx.textBaseline = "middle";
  replayCtx.font = `600 ${Math.max(7, Math.floor(tile * 0.35))}px Segoe UI`;
  replayCtx.fillText(String(pieceType || "P").charAt(0).toUpperCase(), x + tile / 2, y + tile / 2 + 0.5);
}

function drawLevelCompleteReplaySnapshot(index) {
  if (!levelCompleteReplayCanvas || !fewestOtherMovesReplayPath || !fewestOtherMovesReplayPath.length) return;
  const replayCtx = levelCompleteReplayCanvas.getContext("2d");
  if (!replayCtx) return;

  const safeIndex = Math.max(0, Math.min(index, fewestOtherMovesReplayPath.length - 1));
  levelCompleteReplayIndex = safeIndex;
  const snapshot = fewestOtherMovesReplayPath[safeIndex];
  const rows = Number(snapshot.rows) || 1;
  const cols = Number(snapshot.cols) || 1;
  const boardData = Array.isArray(snapshot.board) ? snapshot.board : [];
  const playersData = Array.isArray(snapshot.players) ? snapshot.players : [];

  const cw = levelCompleteReplayCanvas.width;
  const ch = levelCompleteReplayCanvas.height;
  replayCtx.clearRect(0, 0, cw, ch);
  replayCtx.fillStyle = "#0d1118";
  replayCtx.fillRect(0, 0, cw, ch);

  const pad = 8;
  const tile = Math.max(4, Math.floor(Math.min((cw - pad * 2) / cols, (ch - pad * 2) / rows)));
  const boardW = tile * cols;
  const boardH = tile * rows;
  const ox = Math.floor((cw - boardW) / 2);
  const oy = Math.floor((ch - boardH) / 2);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cellType = Number(boardData?.[r]?.[c]);
      const x = ox + c * tile;
      const y = oy + r * tile;
      replayCtx.fillStyle = (r + c) % 2 === 0 ? "#b6cce0ff" : "#ffffffff";
      replayCtx.fillRect(x, y, tile, tile);
      replayCtx.strokeStyle = "rgba(0,0,0,0.12)";
      replayCtx.strokeRect(x + 0.5, y + 0.5, tile, tile);
      drawReplayCellDecoration(replayCtx, cellType, x, y, tile);
    }
  }

  for (const p of playersData) {
    if (!p || !Number.isFinite(p.row) || !Number.isFinite(p.col)) continue;
    drawReplayPlayerPiece(replayCtx, p.pieceType, p.row, p.col, ox, oy, tile);
  }

  if (levelCompleteReplayStep) {
    const logicalStep = fewestOtherMovesReplayStepNumbers[safeIndex] || 0;
    const totalLogicalSteps = Number.isFinite(fewestOtherMovesForLevel)
      ? fewestOtherMovesForLevel
      : (fewestOtherMovesReplayStepNumbers.length ? Math.max(...fewestOtherMovesReplayStepNumbers) : 0);
    levelCompleteReplayStep.textContent = `Step: ${logicalStep}/${totalLogicalSteps}`;
  }
  if (levelCompleteReplayEvent) {
    const moveMeta = snapshot && snapshot.move ? snapshot.move : null;
    if (moveMeta && moveMeta.antigravityApplied) {
      levelCompleteReplayEvent.textContent = "Antigravity used on this step.";
    } else {
      levelCompleteReplayEvent.textContent = "";
    }
  }
}

function updateLevelCompleteReplayDisplay() {
  if (!levelCompleteReplayPanel) return;
  levelCompleteReplayPanel.style.display = "block";
  const hasReplay = !!(fewestOtherMovesReplayPath && fewestOtherMovesReplayPath.length >= 2);
  const hasName = !!(fewestOtherMovesUserName && String(fewestOtherMovesUserName).trim());
  const showLocked = Number.isFinite(fewestOtherMovesForLevel) && !replayUnlockedForLevel;

  if (levelCompleteReplayPanel) {
    levelCompleteReplayPanel.classList.toggle("locked", !!showLocked);
  }

  if (!Number.isFinite(fewestOtherMovesForLevel)) {
    if (levelCompleteReplayTitle) {
      levelCompleteReplayTitle.textContent = "Best Route by --";
    }
    if (levelCompleteReplaySubtitle) {
      levelCompleteReplaySubtitle.textContent = "No other player's best route yet. You set the current record.";
    }
    if (levelCompleteReplayCanvas) levelCompleteReplayCanvas.style.display = "none";
    if (levelCompleteReplayHint) levelCompleteReplayHint.style.display = "none";
    if (levelCompleteReplayStep) levelCompleteReplayStep.style.display = "none";
    if (levelCompleteReplayEvent) {
      levelCompleteReplayEvent.style.display = "none";
      levelCompleteReplayEvent.textContent = "";
    }
    if (levelCompleteReplayLock) levelCompleteReplayLock.style.display = "none";
    if (levelCompleteReplayPanel) levelCompleteReplayPanel.classList.remove("locked");
    return;
  }

  if (showLocked) {
    if (levelCompleteReplayTitle) {
      const shownName = hasName ? String(fewestOtherMovesUserName).trim() : "Unknown";
      levelCompleteReplayTitle.textContent = `Best Route by ${shownName}`;
    }
    if (levelCompleteReplaySubtitle) {
      levelCompleteReplaySubtitle.textContent = `Fewest moves: ${fewestOtherMovesForLevel}`;
    }
    if (levelCompleteReplayCanvas) levelCompleteReplayCanvas.style.display = "block";
    if (levelCompleteReplayHint) levelCompleteReplayHint.style.display = "block";
    if (levelCompleteReplayStep) levelCompleteReplayStep.style.display = "block";
    if (levelCompleteReplayEvent) levelCompleteReplayEvent.style.display = "block";
    if (levelCompleteReplayLock) levelCompleteReplayLock.style.display = "flex";
    if (hasReplay) {
      drawLevelCompleteReplaySnapshot(levelCompleteReplayIndex);
    }
    return;
  }

  if (!hasReplay) {
    if (levelCompleteReplayTitle) {
      const shownName = hasName ? String(fewestOtherMovesUserName).trim() : "Unknown";
      levelCompleteReplayTitle.textContent = `Best Route by ${shownName}`;
    }
    if (levelCompleteReplaySubtitle) {
      levelCompleteReplaySubtitle.textContent = `Fewest moves: ${fewestOtherMovesForLevel}`;
    }
    if (levelCompleteReplayCanvas) levelCompleteReplayCanvas.style.display = "none";
    if (levelCompleteReplayHint) levelCompleteReplayHint.style.display = "none";
    if (levelCompleteReplayStep) levelCompleteReplayStep.style.display = "none";
    if (levelCompleteReplayEvent) {
      levelCompleteReplayEvent.style.display = "none";
      levelCompleteReplayEvent.textContent = "";
    }
    if (levelCompleteReplayLock) levelCompleteReplayLock.style.display = "none";
    return;
  }

  if (levelCompleteReplayLock) levelCompleteReplayLock.style.display = "none";

  if (levelCompleteReplayTitle) {
    const shownName = hasName ? String(fewestOtherMovesUserName).trim() : "Unknown";
    levelCompleteReplayTitle.textContent = `Best Route by ${shownName}`;
  }
  if (levelCompleteReplaySubtitle) {
    levelCompleteReplaySubtitle.textContent = `Fewest moves: ${fewestOtherMovesForLevel}`;
  }
  if (levelCompleteReplayCanvas) levelCompleteReplayCanvas.style.display = "block";
  if (levelCompleteReplayHint) levelCompleteReplayHint.style.display = "block";
  if (levelCompleteReplayStep) levelCompleteReplayStep.style.display = "block";
  if (levelCompleteReplayEvent) levelCompleteReplayEvent.style.display = "block";
  drawLevelCompleteReplaySnapshot(levelCompleteReplayIndex);
}

function updateFewestOtherMovesDisplay(bestMoves, replayPath, userName, replayUnlocked) {
  fewestOtherMovesForLevel = Number.isFinite(bestMoves) ? bestMoves : null;
  fewestOtherMovesUserName = typeof userName === "string" ? userName.trim() : "";
  replayUnlockedForLevel = !!replayUnlocked;
  fewestOtherMovesReplayPath = sanitizeReplayPath(replayPath);
  fewestOtherMovesReplayStepNumbers = buildReplayStepNumbers(fewestOtherMovesReplayPath || []);
  if (fewestOtherMovesReplayPath) {
    levelCompleteReplayIndex = 0;
  }
  if (fewestOtherMovesDisplay) {
    fewestOtherMovesDisplay.textContent = Number.isFinite(fewestOtherMovesForLevel)
      ? `Fewest move by other user: ${fewestOtherMovesForLevel}`
      : "Fewest move by other user: --";
  }
  updateLevelCompleteStatsDisplay();
  updateLevelCompleteReplayDisplay();
}

async function fetchFewestOtherMovesForCurrentLevel() {
  const levelNumber = currentLevelIndex + 1;
  if (!Number.isFinite(levelNumber) || levelNumber <= 0) {
    updateFewestOtherMovesDisplay(null, null, "", false);
    return;
  }

  const apiBaseUrl = window.API_BASE_URL || "https://chessmater-production.up.railway.app";
  const headers = {};
  if (window.cmToken) {
    headers.Authorization = `Bearer ${window.cmToken}`;
  }

  try {
    const res = await fetch(`${apiBaseUrl}/stats/fewest-other-moves?level=${encodeURIComponent(levelNumber)}`, {
      method: "GET",
      credentials: "include",
      headers
    });

    if (!res.ok) {
      updateFewestOtherMovesDisplay(null, null, "", false);
      return;
    }

    const data = await res.json();
    const bestMoves = Number.parseInt(data?.best_moves, 10);
    const bestName = typeof data?.username === "string" && data.username.trim()
      ? data.username
      : "";
    updateFewestOtherMovesDisplay(bestMoves, data?.best_path, bestName, !!data?.replay_unlocked);
  } catch (_) {
    updateFewestOtherMovesDisplay(null, null, "", false);
  }
}

// Update objective counter display
function updateObjectiveCount() {
  if (!objectiveCount) return;
  const completed = objectives.filter(obj => obj.completed).length;
  objectiveCount.textContent = `Objectives: ${completed}/${totalObjectives}`;
}

// Check if all objectives are completed
function areAllObjectivesCompleted() {
  return objectivesCompleted >= totalObjectives;
}

// Complete an objective
function completeObjective(row, col) {
  const objective = objectives.find(obj => obj.row === row && obj.col === col);
  if (objective && !objective.completed) {
    objective.completed = true;
    objectivesCompleted++;
    board[row][col] = CELL_TYPES.OBJECTIVE_COMPLETED;
    updateObjectiveCount();
    updateStatus(`Objective completed! ${objectivesCompleted}/${totalObjectives}`);
    return true;
  }
  return false;
}

// Check for objective completion when players move
function checkObjectiveCompletion() {
  for (const player of players) {
    for (const objective of objectives) {
      if (!objective.completed && player.row === objective.row && player.col === objective.col) {
        completeObjective(objective.row, objective.col);
      }
    }
  }
}

// Reset all phase blocks to inactive state
function resetPhaseBlocks() {
  phaseBlockStates = {};
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] === CELL_TYPES.PHASE_BLOCK_ACTIVE) {
        board[r][c] = CELL_TYPES.PHASE_BLOCK;
      }
    }
  }
}

// --- Load puzzle from JSON file ---
function loadPuzzle(puzzleData) {
  currentPuzzleData = JSON.parse(JSON.stringify(puzzleData)); // Deep copy
  moveHistorySnapshots = [];
  showTransformerMenu = false;
  transformerPosition = null;
  transformerPlayerIndex = -1;
  if (levelCompleteModal) {
    levelCompleteModal.classList.remove("active");
  }
  try {
    // Use saved dimensions or default to current
    const loadedRows = puzzleData.rows || ROWS;
    const loadedCols = puzzleData.cols || COLS;

    fogEnabled = !!puzzleData.fog; // Default to false if property is missing
    const fogToggleBtn = document.getElementById("levelFogToggle");
    if (fogToggleBtn) {
      fogToggleBtn.checked = fogEnabled;
    }
    
    // Resize board first
    resizeBoard(loadedRows, loadedCols);
    
    // Clear current board
    board = Array.from({ length: loadedRows }, () => Array(loadedCols).fill(CELL_TYPES.EMPTY));
    
    // Recreate board state (handle different sizes)
    const copyRows = Math.min(loadedRows, puzzleData.board.length);
    const copyCols = Math.min(loadedCols, puzzleData.board[0].length);
    
    for (let r = 0; r < copyRows; r++) {
      for (let c = 0; c < copyCols; c++) {
        board[r][c] = puzzleData.board[r][c];
      }
    }
    
    // Recreate players (filter out ones that don't fit)
    if (puzzleData.players && Array.isArray(puzzleData.players)) {
      players = puzzleData.players
        .filter(player => player.row < loadedRows && player.col < loadedCols)
        .map(player => ({ 
          row: player.row, 
          col: player.col, 
          pieceType: player.pieceType || "rook"
        }));
    }
    for (const p of players) {
      visitedSquares[p.row][p.col] = true;
    }
    
    // Recreate goal (only if it fits) - FIXED: Preserve counter goal data
    if (puzzleData.goal && puzzleData.goal.row < loadedRows && puzzleData.goal.col < loadedCols) {
      // Check if it's a counter goal and preserve all properties
      if (puzzleData.goal.type === "counter") {
        goal = { 
          row: puzzleData.goal.row, 
          col: puzzleData.goal.col, 
          type: "counter", 
          counter: puzzleData.goal.counter || 5 // Default to 5 if missing
        };
      } else {
        // Regular goal
        goal = { row: puzzleData.goal.row, col: puzzleData.goal.col };
      }
    } else {
      goal = null;
    }
    
    // Recreate objectives (filter out ones that don't fit)
    if (puzzleData.objectives && Array.isArray(puzzleData.objectives)) {
      objectives = puzzleData.objectives
        .filter(obj => obj.row < loadedRows && obj.col < loadedCols)
        .map(obj => ({
          row: obj.row,
          col: obj.col,
          completed: obj.completed || false
        }));

      // 💣 Recreate bombs from saved data
      bombs = [];
      if (Array.isArray(puzzleData.bombs)) {
        bombs = puzzleData.bombs
          .filter(b => b.row < loadedRows && b.col < loadedCols)
          .map(b => ({
            row: b.row,
            col: b.col,
            direction: b.direction || 1 // Default to moving right if direction not specified
          }));
        
        // Update board with bomb positions
        for (const b of bombs) {
          board[b.row][b.col] = CELL_TYPES.BOMB;
        }
      }

      totalObjectives = objectives.length;
      objectivesCompleted = objectives.filter(obj => obj.completed).length;
    }

    teleportBlocks = [];
    for (let r = 0; r < loadedRows; r++) {
      for (let c = 0; c < loadedCols; c++) {
        if ([
          CELL_TYPES.TELEPORT_PURPLE,
          CELL_TYPES.TELEPORT_GREEN,
          CELL_TYPES.TELEPORT_BLUE,
          CELL_TYPES.TELEPORT_ORANGE
        ].includes(board[r][c])) {
          teleportBlocks.push({ row: r, col: c, type: board[r][c] });
        }
      }
    }

    updatePlayerCount();
    updateObjectiveCount();
    updateStatus(`Puzzle "${puzzleData.name}" loaded successfully! Size: ${loadedRows}x${loadedCols}`);
    // ✅ Reset state so pieces can move again
    mode = "play";
    gameWon = false;
    antigravityEnabled = false;
    antigravityUnlockedThisRun = false;
    levelMoveCount = 0;
    updateMoveCountDisplay();
    updateAntigravityButtonLabel();
    updateFewestOtherMovesDisplay(null, null, "", false);
    resetCurrentLevelMoveTrace();
    visitedSquares.forEach(row => row.fill(false)); // Reset fog on load
    if (typeof enablePlayerControls === "function") {
        enablePlayerControls();
    }
    const descText = document.getElementById("blockDescription");

    currentLevelIndex = LEVELS.findIndex(lvl => lvl.name === puzzleData.name);
    if (typeof window.highlightCurrentLevelButton === "function") {
      window.highlightCurrentLevelButton();
    }
    if (descText) {
      const rawTip = puzzleData.blockTip != null ? String(puzzleData.blockTip).trim() : "";
      descText.textContent = rawTip || "No tip for this level.";
    }

    if (window.authReady && typeof window.authReady.finally === "function") {
      window.authReady.finally(() => {
        fetchFewestOtherMovesForCurrentLevel();
      });
    } else {
      fetchFewestOtherMovesForCurrentLevel();
    }
    drawBoard();
  } catch (error) {
    updateStatus("Error loading puzzle: " + error.message);
  }
}

function decrementCounterAfterMove() {
  // If landing on goal won the game, do nothing
  checkWinCondition();
  if (gameWon) return;

  if (goal && goal.type === "counter" && goal.counter > 0) {
    goal.counter--;
    updateStatus(`Counter goal: ${goal.counter} moves remaining`);
    if (goal.counter <= 0) {
      updateStatus("Counter goal locked!");
    }
  }
}

// --- Check if a cell is occupied by a block or player ---
function isCellBlocked(row, col, ignorePlayer = null, fromDirection = null) {
  // Check if cell has a solid block (but allow transformer blocks)
  if (board[row][col] === CELL_TYPES.SOLID_BLOCK) {
    return true;
  }

    // Check if cell has a goal that's not yet accessible
  if (board[row][col] === CELL_TYPES.GOAL && !areAllObjectivesCompleted()) {
    return true; // Goal acts as solid block until objectives are completed
  }
  if (board[row][col] === CELL_TYPES.COUNTER_GOAL) {
    if (!areAllObjectivesCompleted() || (goal && goal.type === "counter" && goal.counter <= 0)) {
      return true; // block movement
    }
  }
  
  // Check if cell has an active phase block (always solid)
  if (board[row][col] === CELL_TYPES.PHASE_BLOCK_ACTIVE) return true;
  
  // Check if cell has an inactive phase block
  if (board[row][col] === CELL_TYPES.PHASE_BLOCK) {
    // Allow passing through phase blocks from below, but block from above/sides
    if (fromDirection === "below") {
      return false; // Can pass through from below
    } else {
      return true; // Block from above and sides (should stand on top)
    }
  }
  
  // Check if cell has a player (optionally ignore a specific player)
  for (const player of players) {
    // Skip the player we're ignoring (useful for checking if a player can move to their own position)
    if (ignorePlayer && player === ignorePlayer) continue;
    
    if (player.row === row && player.col === col) {
      return true;
    }
  }
  
  return false;
}

// Activate a phase block (make it solid)
function activatePhaseBlock(row, col) {
  if (board[row][col] === CELL_TYPES.PHASE_BLOCK) {
    board[row][col] = CELL_TYPES.PHASE_BLOCK_ACTIVE;
    phaseBlockStates[`${row},${col}`] = true;
  }
}

// --- Apply gravity to all pieces ---
function applyGravity() {
  if (gameWon) return;

  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const newRow = findFallPosition(player.row, player.col);

    if (newRow !== player.row) {
      const landingCellType = board[newRow][player.col];
      const isTeleportBlock = [
        CELL_TYPES.TELEPORT_PURPLE,
        CELL_TYPES.TELEPORT_GREEN,
        CELL_TYPES.TELEPORT_BLUE,
        CELL_TYPES.TELEPORT_ORANGE
      ].includes(landingCellType);

      fallingPieces.push({
        playerIndex: i,
        startRow: player.row,
        targetRow: newRow,
        col: player.col,
        y: player.row * TILE_SIZE,
        pieceType: player.pieceType,
        isTeleport: isTeleportBlock,
        teleportType: isTeleportBlock ? landingCellType : null
      });

      // Clear board spot early so ghost rendering is manual
      board[player.row][player.col] = CELL_TYPES.EMPTY;
    }
  }

  if (goal) {
    const newRow = findFallPosition(goal.row, goal.col);
    if (newRow !== goal.row) {
      fallingPieces.push({
        playerIndex: "goal",
        startRow: goal.row,
        targetRow: newRow,
        col: goal.col,
        y: goal.row * TILE_SIZE,
        pieceType: "target"
      });

      board[goal.row][goal.col] = CELL_TYPES.EMPTY;
    }
  }
}

function updateFallingPieces() {
  const fallSpeed = 3;

  for (let i = fallingPieces.length - 1; i >= 0; i--) {
    const piece = fallingPieces[i];
    const targetY = piece.targetRow * TILE_SIZE;
    const prevY = piece.y;

    // Move piece down
    piece.y += fallSpeed;

    // Check if we've passed through a bomb mid-fall
    const prevRow = Math.floor(prevY / TILE_SIZE);
    const currentRow = Math.floor(piece.y / TILE_SIZE);

    if (currentRow !== prevRow) {
      for (let r = prevRow + 1; r <= currentRow; r++) {
        // Check if landing on a bomb during fall
        if (board[r][piece.col] === CELL_TYPES.BOMB) {
          // Handle bomb collision for falling piece
          if (piece.playerIndex === "goal") {
            // Goal hit a bomb - remove goal
            fallingPieces.splice(i, 1);
            goal = null;
            updateStatus("💣 Goal destroyed by bomb!");
          } else {
            // Player hit a bomb
            const player = players[piece.playerIndex];
            handleBombCollision(player, piece.playerIndex, r, piece.col);
            fallingPieces.splice(i, 1);
          }
          return; // Skip rest of loop for this frame
        }
      }
    }

    // --- Usual landing logic
    if (piece.y >= targetY) {
      piece.y = targetY;

      // Check if landing on a bomb
      if (board[piece.targetRow][piece.col] === CELL_TYPES.BOMB) {
        if (piece.playerIndex === "goal") {
          // Goal hit a bomb
          fallingPieces.splice(i, 1);
          goal = null;
          updateStatus("💣 Goal destroyed by bomb!");
        } else {
          // Player hit a bomb
          const player = players[piece.playerIndex];
          handleBombCollision(player, piece.playerIndex, piece.targetRow, piece.col);
          fallingPieces.splice(i, 1);
        }
        continue;
      }

      if (piece.playerIndex === "goal") {
        goal.row = piece.targetRow;
        board[goal.row][piece.col] = CELL_TYPES.GOAL;
      } else {
        const player = players[piece.playerIndex];

        // Check if landing on a teleport block
        const landingCellType = board[piece.targetRow][piece.col];
        const isTeleportBlock = [
          CELL_TYPES.TELEPORT_PURPLE,
          CELL_TYPES.TELEPORT_GREEN,
          CELL_TYPES.TELEPORT_BLUE,
          CELL_TYPES.TELEPORT_ORANGE
        ].includes(landingCellType);

        if (isTeleportBlock) {
          // Don't place player on board - let teleport logic handle it
          player.row = piece.targetRow;
          player.col = piece.col;
          handleGravityTeleport(player, landingCellType);
        } else {
          // Normal landing
          player.row = piece.targetRow;
          player.col = piece.col;

          const cellType = board[player.row][player.col];

          if (cellType === CELL_TYPES.TRANSFORMER) {
            // ✅ Activate transformer behavior
            transformerPlayerIndex = piece.playerIndex;
            transformerPosition = { row: player.row, col: player.col };
            showTransformerMenu = true;
            updateStatus("Transformer activated! Choose a new piece type.");
            // Do not overwrite the transformer cell
          } else {
            board[player.row][player.col] = CELL_TYPES.PLAYER;
          }
          playerTeleportCooldowns.delete(player);
          checkObjectiveCompletion();
          checkWinCondition();
        }
      }

      fallingPieces.splice(i, 1);

      // Decrement counter if nothing else is falling
      if (fallingPieces.length === 0 && pendingMoveCounter) {
        decrementCounterAfterMove();
        pendingMoveCounter = false;
      }
    }
  }
}

function showLevelCompleteModal() {
  if (!levelCompleteModal) return;
  const hasNext = currentLevelIndex < LEVELS.length - 1;
  levelCompleteReplayIndex = 0;
  updateLevelCompleteStatsDisplay();
  updateLevelCompleteReplayDisplay();
  if (levelCompleteText) {
    levelCompleteText.textContent = hasNext
      ? "Great job!"
      : "Great job! You finished the final level. You can retry this level.";
  }
  if (levelCompleteNextBtn) {
    levelCompleteNextBtn.style.display = hasNext ? "inline-block" : "none";
  }
  levelCompleteModal.classList.add("active");
  void fetchFewestOtherMovesForCurrentLevel();
}


function handleGravityTeleport(player, teleportType) {
  // Get all teleport blocks of the same color
  const sameColorTeleports = teleportBlocks.filter(tp => tp.type === teleportType);
  
  if (sameColorTeleports.length !== 2) {
    board[player.row][player.col] = CELL_TYPES.PLAYER;
    updateStatus("Need exactly 2 teleporters of the same color!");
    return;
  }

  // Find the other teleporter in the pair
  const otherTeleporter = sameColorTeleports.find(tp => 
    !(tp.row === player.row && tp.col === player.col)
  );
  
  if (!otherTeleporter) {
    board[player.row][player.col] = CELL_TYPES.PLAYER;
    return;
  }

  // ✅ Simply move the player to the other teleporter
  player.row = otherTeleporter.row;
  player.col = otherTeleporter.col;

  const colorNames = {
    [CELL_TYPES.TELEPORT_PURPLE]: "Purple",
    [CELL_TYPES.TELEPORT_GREEN]: "Green",
    [CELL_TYPES.TELEPORT_BLUE]: "Blue",
    [CELL_TYPES.TELEPORT_ORANGE]: "Orange"
  };
  
  updateStatus(`✨ ${colorNames[teleportType]} Teleport from gravity!`);

  // ✅ CRITICAL FIX: Clear the player from the board temporarily to reset teleport state
  board[player.row][player.col] = CELL_TYPES.EMPTY;

  // Check objectives after teleporting
  checkObjectiveCompletion();
  checkWinCondition();
  
  // Apply gravity again after teleporting
  if (gravityEnabled) {
    setTimeout(() => {
      applyGravity();
    }, 150);
  } else {
    // If gravity is disabled, still place the player on the board after teleport
    setTimeout(() => {
      board[player.row][player.col] = CELL_TYPES.PLAYER;
    }, 50);
  }
}

// Find where a piece should fall to
function findFallPosition(startRow, col) {
  let row = startRow;

  // Keep falling until we hit the bottom or a blocking cell
  while (row < ROWS - 1) {
    const nextRow = row + 1;

    // Check if the next cell is blocked when coming from above
    if (isCellBlocked(nextRow, col, null, "above")) {
      break;
    }

    // Move down
    row = nextRow;
  }

  return row;
}

function checkGravityTeleportation() {
  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const cellType = board[player.row][player.col];
    
    const isTeleportBlock = [
      CELL_TYPES.TELEPORT_PURPLE,
      CELL_TYPES.TELEPORT_GREEN,
      CELL_TYPES.TELEPORT_BLUE,
      CELL_TYPES.TELEPORT_ORANGE
    ].includes(cellType);
    
    if (isTeleportBlock) {
      // Small delay to ensure the piece has settled
      setTimeout(() => {
        if (players[i] && players[i].row === player.row && players[i].col === player.col) {
          handleTeleport(players[i]);
        }
      }, 50);
    }
  }
}

// Check if any player has reached the goal
let isCheckingWinCondition = false; // prevent duplicate checks

if (CM_EDITOR_PAGE) {
  window.cmResetEditorAfterPlaytest = function () {
    levelMoveCount = 0;
    moveHistorySnapshots = [];
    currentLevelMoveTrace = [];
    pendingMoveTraceEntry = null;
    pendingMoveCounter = false;
    shakeAmount = 0;
    shakeX = 0;
    shakeY = 0;
    playerTeleportCooldowns.clear();
    risingPieces = [];
    isCheckingWinCondition = false;
    antigravityEnabled = false;
    antigravityUnlockedThisRun = false;
    if (levelCompleteModal) levelCompleteModal.classList.remove("active");
    gameWon = false;
    updateMoveCountDisplay();
    updateAntigravityButtonLabel();
    updateUndoButtonLabel();
  };
}

function syncProgressAfterWin() {
  tryCapturePendingMoveTrace(true);
  let actualLevelIndex = currentLevelIndex;
  if (actualLevelIndex < 0 && typeof LEVELS !== "undefined" && currentPuzzleData && currentPuzzleData.name) {
    actualLevelIndex = LEVELS.findIndex(lvl => lvl.name === currentPuzzleData.name);
  }
  if (actualLevelIndex < 0) {
    actualLevelIndex = 0;
  }

  const solvedIndex = actualLevelIndex;
  const solvedLevel = solvedIndex + 1;
  const nextLevel = solvedIndex + 2;

  const mergedUnlocked = typeof window.mergeMaxUnlocked === "function"
    ? window.mergeMaxUnlocked(nextLevel)
    : Math.max(window.currentMaxUnlocked || 1, nextLevel);

  window.currentMaxUnlocked = mergedUnlocked;
  window.progressNeedsRefresh = true;

  if (typeof loadLevels === 'function') {
    loadLevels(mergedUnlocked);
  }

  const progressData = {
    maxUnlocked: mergedUnlocked,
    level: solvedLevel,
    moves: levelMoveCount,
    moveTrace: currentLevelMoveTrace
  };
  const jsonBody = JSON.stringify(progressData);

  const apiBaseUrl = window.API_BASE_URL || 'https://chessmater-production.up.railway.app';
  const headers = {
    "Content-Type": "application/json"
  };
  if (window.cmToken) {
    headers.Authorization = `Bearer ${window.cmToken}`;
  }

  fetch(`${apiBaseUrl}/progress`, {
    method: "POST",
    credentials: 'include',
    headers,
    body: jsonBody
  })
    .then(async (res) => {
      if (!res.ok) return null;
      return res.json().catch(() => null);
    })
    .then((data) => {
      if (!data) return;
      const credits = Number.parseInt(data?.undoCredits, 10);
      if (Number.isFinite(credits)) {
        undoCredits = credits;
        updateUndoButtonLabel();
      }
      const antiCredits = Number.parseInt(data?.antigravityCredits, 10);
      if (Number.isFinite(antiCredits)) {
        antigravityCredits = antiCredits;
        updateAntigravityButtonLabel();
      }
    })
    .catch(() => {});
}

function checkWinCondition() {
  if (isCheckingWinCondition) {
    return;
  }

  isCheckingWinCondition = true;
  try {
    if (gameWon || !goal) return;

    // Counter goal locked?
    if (goal.type === "counter" && goal.counter <= 0) return;

    // Check if all objectives are completed first
    if (!areAllObjectivesCompleted()) {
      return;
    }

    for (const player of players) {
      if (player.row === goal.row && player.col === goal.col) {
        gameWon = true;
        updateStatus("Puzzle solved! All objectives completed and goal reached!");
        triggerConfetti();
        showLevelCompleteModal();
        syncProgressAfterWin();
        break;
      }
    }
  } finally {
    isCheckingWinCondition = false;
  }
}

// --- Fixed Path checking (rook/bishop/queen) ---
function isPathClear(r1, c1, r2, c2, movingPlayer = null) {
  if (r1 === r2) { // horizontal
    let start = Math.min(c1, c2) + 1;
    let end = Math.max(c1, c2);
    for (let c = start; c < end; c++) {
      // For horizontal movement, check from the side
      if (isCellBlocked(r1, c, movingPlayer, "side")) return false;
    }
  } else if (c1 === c2) { // vertical
    let start = Math.min(r1, r2) + 1;
    let end = Math.max(r1, r2);
    for (let r = start; r < end; r++) {
      // For vertical movement, check direction
      const fromDirection = r > r1 ? "above" : "below";
      if (isCellBlocked(r, c1, movingPlayer, fromDirection)) return false;
    }
  } else if (Math.abs(r2 - r1) === Math.abs(c2 - c1)) { // diagonal
    let stepR = (r2 > r1) ? 1 : -1;
    let stepC = (c2 > c1) ? 1 : -1;
    let steps = Math.abs(r2 - r1);
    
    for (let i = 1; i < steps; i++) {
      let checkR = r1 + i * stepR;
      let checkC = c1 + i * stepC;
      // For diagonal movement, check if we're moving upward or downward
      const fromDirection = checkR > r1 ? "above" : "below";
      if (isCellBlocked(checkR, checkC, movingPlayer, fromDirection)) return false;
    }
  }
  return true;
}

// --- Movement rules ---
function isValidMove(playerIndex, newRow, newCol) {
  if (playerIndex < 0 || playerIndex >= players.length) return false;
  if (newRow < 0 || newRow >= ROWS || newCol < 0 || newCol >= COLS) return false;
  
  const player = players[playerIndex];
  let r = player.row;
  let c = player.col;

  // Check if destination is blocked (considering movement direction)
  // Allow moving onto transformer blocks
  const movingDown = newRow > r;
  const fromDirection = movingDown ? "above" : "below";
  
  // Prevent moving directly onto a phase block
  if (board[newRow][newCol] === CELL_TYPES.PHASE_BLOCK) {
    return false;
  }

  // Block if the cell is otherwise invalid (except transformer and bomb)
  if (board[newRow][newCol] !== CELL_TYPES.TRANSFORMER && 
      board[newRow][newCol] !== CELL_TYPES.BOMB &&
      isCellBlocked(newRow, newCol, player, fromDirection)) {
    return false;
  }


  // Use the player's specific piece type
  switch (player.pieceType) {
    case "rook":
      if (r === newRow || c === newCol) return isPathClear(r, c, newRow, newCol, player);
      return false;
    case "bishop":
      if (Math.abs(newRow - r) === Math.abs(newCol - c)) {
        return isPathClear(r, c, newRow, newCol, player);
      }
      return false;
    case "queen":
      if (r === newRow || c === newCol || Math.abs(newRow - r) === Math.abs(newCol - c)) {
        return isPathClear(r, c, newRow, newCol, player);
      }
      return false;
    case "knight":
      let dr = Math.abs(newRow - r);
      let dc = Math.abs(newCol - c);
      return (dr === 2 && dc === 1) || (dr === 1 && dc === 2);
    case "king":
      return Math.abs(newRow - r) <= 1 && Math.abs(newCol - c) <= 1;
    case "pawn":
      // Pawns can only move forward one square
      // In this puzzle, we'll assume all pawns move downward (increasing row)
      if (newCol === c && newRow === r + 1) {
        // Moving straight forward - can only move to empty square
        return !isCellBlocked(newRow, newCol, player, "above");
      } else if (Math.abs(newCol - c) === 1 && newRow === r + 1) {
        // Capturing diagonally - can only move to occupied square (not blocks, but can capture other players)
        return isCellBlocked(newRow, newCol, player, "above") && board[newRow][newCol] !== CELL_TYPES.SOLID_BLOCK && board[newRow][newCol] !== CELL_TYPES.PHASE_BLOCK && board[newRow][newCol] !== CELL_TYPES.PHASE_BLOCK_ACTIVE;
      }
      return false;
  }
  return false;
}

function movePlayer(playerIndex, newRow, newCol) {
  if (playerIndex < 0 || playerIndex >= players.length) return;
  if (gameWon) return;
  
  const player = players[playerIndex];
  const fromRow = player.row;
  const fromCol = player.col;
  const pieceType = player.pieceType;
  if (!isValidMove(playerIndex, newRow, newCol)) {
    // Check if the move was invalid because goal is locked
    if (board[newRow][newCol] === CELL_TYPES.GOAL && !areAllObjectivesCompleted()) {
      updateStatus("Complete all objectives first! " + objectivesCompleted + "/" + totalObjectives);
    } else {
      updateStatus("Invalid move for selected piece");
    }
    return;
  }

  saveUndoSnapshot();
  queueMoveTraceCapture({
    from: { row: fromRow, col: fromCol },
    to: { row: newRow, col: newCol },
    pieceType
  });

  levelMoveCount += 1;
  updateMoveCountDisplay();

  // ✅ NEW: Check if moving into a bomb BEFORE moving
  const isBombBlock = board[newRow][newCol] === CELL_TYPES.BOMB;

  // Check if destination is ANY teleport block type BEFORE moving
  const isTeleportBlock = [
    CELL_TYPES.TELEPORT_PURPLE,
    CELL_TYPES.TELEPORT_GREEN,
    CELL_TYPES.TELEPORT_BLUE,
    CELL_TYPES.TELEPORT_ORANGE
  ].includes(board[newRow][newCol]);

  // Check if destination is a transformer block BEFORE moving
  const isTransformerBlock = board[newRow][newCol] === CELL_TYPES.TRANSFORMER;

  // ✅ NEW: Handle bomb collision immediately BEFORE any movement
  if (isBombBlock) {
    handleBombCollision(player, playerIndex, newRow, newCol);
    return; // Stop further processing
  }

  board[player.row][player.col] = CELL_TYPES.EMPTY;
  player.row = newRow;
  player.col = newCol;
  visitedSquares[newRow][newCol] = true;

  if (isTeleportBlock) {
    handleTeleport(player);
    return; // stop rest of logic for this frame
  }

  // Only place player if it's not a teleport cell
  if (!isTeleportBlock) {
    board[player.row][player.col] = CELL_TYPES.PLAYER;
  }

  // Check if player moved onto a transformer block
  if (isTransformerBlock) {
    showPieceSelectionMenu(newRow, newCol, playerIndex);
    return; // Stop here to show the menu before applying gravity
  }

  // Rest of the function remains the same...
  checkObjectiveCompletion();

  // Check if player moved through a phase block from below and activate it
  if (newRow < player.row) { // Moving upward
    for (let r = newRow + 1; r < player.row; r++) {
      if (board[r][newCol] === CELL_TYPES.PHASE_BLOCK) {
        activatePhaseBlock(r, newCol);
      }
    }
  }
  checkWinCondition();

  // Apply gravity or antigravity after moving
  if (gravityEnabled && !antigravityEnabled) {
    const before = fallingPieces.length;
    applyGravity();                              // may enqueue falls
    const after = fallingPieces.length;

    if (after > before) {
      // Something (maybe this piece) will fall → wait to decrement until falls finish
      pendingMoveCounter = true;
    } else {
      // Nothing will fall → decrement now
      decrementCounterAfterMove();
    }
  } else if (antigravityEnabled) {
    // Apply antigravity after moving
    const before = risingPieces.length;
    applyAntigravity();                          // may enqueue rises
    const after = risingPieces.length;
    const usedAntigravity = after > before;
    if (usedAntigravity) {
      markPendingMoveTraceAntigravity(true);
    }

    if (usedAntigravity) {
      // Something (maybe this piece) will rise → wait to decrement until rises finish
      pendingMoveCounter = true;
    } else {
      // Nothing will rise → decrement now
      decrementCounterAfterMove();
    }
  } else {
    // Gravity off → decrement now (after checking for immediate win above)
    decrementCounterAfterMove();
  }

  const moveSound = document.getElementById("moveSound");
  if (moveSound) {
    playSound(moveSound);
  }
}

function cloneGameData(data) {
  return data == null ? data : JSON.parse(JSON.stringify(data));
}

function saveUndoSnapshot() {
  moveHistorySnapshots.push({
    ROWS,
    COLS,
    board: cloneGameData(board),
    players: cloneGameData(players),
    goal: cloneGameData(goal),
    objectives: cloneGameData(objectives),
    objectivesCompleted,
    totalObjectives,
    phaseBlockStates: cloneGameData(phaseBlockStates),
    bombs: cloneGameData(bombs),
    teleportBlocks: cloneGameData(teleportBlocks),
    playerTeleportCooldowns: Array.from(playerTeleportCooldowns.entries()),
    gameWon,
    selectedPlayerIndex,
    levelMoveCount
  });
}

async function undoMove() {
  if (undoCredits <= 0) {
    openUndoExchangeModal();
    return;
  }

  if (moveHistorySnapshots.length === 0) {
    return;
  }

  const consumed = await consumeUndoCredit(1);
  if (!consumed) {
    openUndoExchangeModal();
    return;
  }

  const snapshot = moveHistorySnapshots.pop();

  ROWS = snapshot.ROWS;
  COLS = snapshot.COLS;
  resizeCanvas();

  board = cloneGameData(snapshot.board);
  players = cloneGameData(snapshot.players);
  goal = cloneGameData(snapshot.goal);
  objectives = cloneGameData(snapshot.objectives);
  objectivesCompleted = snapshot.objectivesCompleted;
  totalObjectives = snapshot.totalObjectives;
  phaseBlockStates = cloneGameData(snapshot.phaseBlockStates);
  bombs = cloneGameData(snapshot.bombs);
  teleportBlocks = cloneGameData(snapshot.teleportBlocks);
  playerTeleportCooldowns = new Map(snapshot.playerTeleportCooldowns || []);
  gameWon = snapshot.gameWon;
  selectedPlayerIndex = -1;
  levelMoveCount = snapshot.levelMoveCount;
  pendingMoveTraceEntry = null;
  if (currentLevelMoveTrace.length > 1) {
    currentLevelMoveTrace.pop();
  }

  // Clear transient animation/effect state before redraw
  fallingPieces = [];
  risingPieces = [];
  pendingMoveCounter = false;
  explodingPlayers = [];
  showTransformerMenu = false;
  transformerPosition = null;
  transformerPlayerIndex = -1;

  updatePlayerCount();
  updateObjectiveCount();
  updateMoveCountDisplay();
  drawBoard();
}

function handleTeleport(player) {
  // Get the teleporter type the player is standing on
  const currentTeleportType = board[player.row][player.col];
  
  // Check if it's actually a teleporter type
  const teleportTypes = [
    CELL_TYPES.TELEPORT_PURPLE,
    CELL_TYPES.TELEPORT_GREEN, 
    CELL_TYPES.TELEPORT_BLUE,
    CELL_TYPES.TELEPORT_ORANGE
  ];
  
  if (!teleportTypes.includes(currentTeleportType)) {
    return;
  }

  // Get all teleport blocks of the same color
  const sameColorTeleports = teleportBlocks.filter(tp => tp.type === currentTeleportType);
  
  if (sameColorTeleports.length !== 2) {
    updateStatus("Need exactly 2 teleporters of the same color!");
    return;
  }

  // Find the other teleporter in the pair
  const otherTeleporter = sameColorTeleports.find(tp => 
    !(tp.row === player.row && tp.col === player.col)
  );
  
  if (!otherTeleporter) return;

  // ✅ TEMPORARILY DISABLE BOTH TELEPORTERS
  const sourcePos = `${player.row},${player.col}`;
  const destPos = `${otherTeleporter.row},${otherTeleporter.col}`;
  
  // Store original types
  const sourceType = board[player.row][player.col];
  const destType = board[otherTeleporter.row][otherTeleporter.col];
  
  // Change to inactive state (use a visual indicator)
  board[player.row][player.col] = CELL_TYPES.EMPTY;
  board[otherTeleporter.row][otherTeleporter.col] = CELL_TYPES.EMPTY;

  // ✅ Move player to destination
  player.row = otherTeleporter.row;
  player.col = otherTeleporter.col;

  const colorNames = {
    [CELL_TYPES.TELEPORT_PURPLE]: "Purple",
    [CELL_TYPES.TELEPORT_GREEN]: "Green",
    [CELL_TYPES.TELEPORT_BLUE]: "Blue",
    [CELL_TYPES.TELEPORT_ORANGE]: "Orange"
  };
  
  updateStatus(`✨ ${colorNames[currentTeleportType]} Teleport! Teleporters resetting...`);
  
  // ✅ RESTORE TELEPORTERS AFTER COOLDOWN
  setTimeout(() => {
    board[player.row][player.col] = destType; // Player's current position
    // Find and restore the source teleporter
    const sourceTeleporter = sameColorTeleports.find(tp => 
      tp.row === parseInt(sourcePos.split(',')[0]) && tp.col === parseInt(sourcePos.split(',')[1])
    );
    if (sourceTeleporter) {
      board[sourceTeleporter.row][sourceTeleporter.col] = sourceType;
    }
    updateStatus(`${colorNames[currentTeleportType]} Teleporters ready!`);
  }, TELEPORT_COOLDOWN);

  checkObjectiveCompletion();
  
  // Apply gravity after teleporting
  if (gravityEnabled) {
    setTimeout(() => {
      applyGravity();
    }, 150);
  } else {
    // If gravity is disabled, place the player on the board
    setTimeout(() => {
      board[player.row][player.col] = CELL_TYPES.PLAYER;
      checkWinCondition();
    }, 50);
  }
}


// Find which player was clicked
function getPlayerAt(row, col) {
  for (let i = 0; i < players.length; i++) {
    if (players[i].row === row && players[i].col === col) {
      return i;
    }
  }
  return -1;
}

// --- Transformer block functions ---
function showPieceSelectionMenu(row, col, playerIndex) {
  showTransformerMenu = true;
  transformerPosition = { row, col };
  transformerPlayerIndex = playerIndex;
  updateStatus("Select a new piece type for this player");
}

function transformPiece(playerIndex, newPieceType) {
  if (playerIndex >= 0 && playerIndex < players.length) {
    const oldType = players[playerIndex].pieceType;
    players[playerIndex].pieceType = newPieceType;
    
    // Remove the transformer block after use but keep the player visible
    if (transformerPosition) {
      board[transformerPosition.row][transformerPosition.col] = CELL_TYPES.PLAYER; // Keep player visible
    }
    
    updateStatus(`Player transformed from ${oldType} to ${newPieceType}`);
    
    // Check for objective completion after transformation
    checkObjectiveCompletion();
    
    // Apply gravity after transformation
    if (gravityEnabled) {
      applyGravity();
    }
  }
  showTransformerMenu = false;
  transformerPosition = null;
  transformerPlayerIndex = -1;
}

// Handle clicks on the transformer menu
function handleTransformerMenuClick(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;

  // Always use center of board for menu positioning
  const centerX = (COLS * TILE_SIZE) / 2;
  const centerY = (ROWS * TILE_SIZE) / 2;
  
  const buttonSize = 35;
  const spacing = 15;
  const menuWidth = 3 * buttonSize + 2 * spacing;
  const menuHeight = 2 * buttonSize + spacing;
  const outerMargin = 20;
  
  const startX = centerX - menuWidth / 2;
  const startY = centerY - menuHeight / 2 - 10;
  
  // Define the 2x3 grid layout
  const pieceLayout = [
    ["rook", "bishop", "queen"],
    ["knight", "king", "pawn"]
  ];
  
  // Check if click is on any piece button
  pieceLayout.forEach((row, rowIndex) => {
    row.forEach((pieceType, colIndex) => {
      const btnX = startX + colIndex * (buttonSize + spacing);
      const btnY = startY + rowIndex * (buttonSize + spacing);
      
      if (x >= btnX && x <= btnX + buttonSize && y >= btnY && y <= btnY + buttonSize) {
        transformPiece(transformerPlayerIndex, pieceType);
        return;
      }
    });
  });
  
  // Menu bounds based on center positioning
  const menuBounds = {
    left: startX - outerMargin,
    right: startX + menuWidth + outerMargin,
    top: startY - outerMargin,
    bottom: startY + menuHeight + outerMargin + 20
  };
  
  // if (x < menuBounds.left || x > menuBounds.right || y < menuBounds.top || y > menuBounds.bottom) {
  //   showTransformerMenu = false;
    
  //   if (transformerPosition) {
  //     board[transformerPosition.row][transformerPosition.col] = CELL_TYPES.PLAYER;
  //   }
    
  //   transformerPosition = null;
  //   transformerPlayerIndex = -1;
  //   updateStatus("Transformation cancelled");
    
  //   if (gravityEnabled) {
  //     applyGravity();
  //   }
  // }
}

// --- Draw possible moves for selected player ---
function drawPossibleMoves() {
  if (mode !== "play" || selectedPlayerIndex === -1 || gameWon) return;
  
  const player = players[selectedPlayerIndex];
  
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (isValidMove(selectedPlayerIndex, r, c)) {
        let x = c * TILE_SIZE;
        let y = r * TILE_SIZE;
        
        ctx.fillStyle = "rgba(41, 128, 185, 0.5)";
        ctx.beginPath();
        ctx.arc(x + TILE_SIZE/2, y + TILE_SIZE/2, TILE_SIZE/5, 0, Math.PI * 2); // Smaller circles
        ctx.fill();
        
        // Add a border to make it more visible
        ctx.strokeStyle = "rgba(21, 67, 96, 0.8)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }
}

// --- Draw selection indicator around selected player ---
function drawSelectionIndicator() {
  if (mode !== "play" || selectedPlayerIndex === -1 || gameWon) return;
  
  const player = players[selectedPlayerIndex];
  let x = player.col * TILE_SIZE;
  let y = player.row * TILE_SIZE;
  
  ctx.strokeStyle = "rgba(231, 76, 60, 0.8)";
  ctx.lineWidth = 2; // Thinner line
  ctx.beginPath();
  ctx.arc(x + TILE_SIZE/2, y + TILE_SIZE/2, TILE_SIZE/2 - 4, 0, Math.PI * 2); // Smaller circle
  ctx.stroke();
}

// Draw the piece selection menu
function drawPieceSelectionMenu() {
  if (!transformerPosition) return;
  
  // Always position menu in center of board instead of at transformer block
  const centerX = (COLS * TILE_SIZE) / 2;
  const centerY = (ROWS * TILE_SIZE) / 2;
  
  // Button size
  const buttonSize = 35;
  const spacing = 15;
  const menuWidth = 3 * buttonSize + 2 * spacing;
  const menuHeight = 2 * buttonSize + spacing;
  
  // Center the menu on the board
  const outerMargin = 20;
  const startX = centerX - menuWidth / 2;
  const startY = centerY - menuHeight / 2 - 10; // Slightly above center
  
  // Draw menu background
  ctx.fillStyle = "rgba(0, 0, 0, 0.95)";
  ctx.fillRect(
    startX - outerMargin, 
    startY - outerMargin, 
    menuWidth + (outerMargin * 2), 
    menuHeight + (outerMargin * 2) + 20
  );
  
  // Draw border
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = 4;
  ctx.strokeRect(
    startX - outerMargin, 
    startY - outerMargin, 
    menuWidth + (outerMargin * 2), 
    menuHeight + (outerMargin * 2) + 20
  );
  
  // Optional: Add a secondary inner border
  ctx.strokeStyle = "rgba(52, 152, 219, 0.6)";
  ctx.lineWidth = 2;
  ctx.strokeRect(
    startX - outerMargin + 4, 
    startY - outerMargin + 4, 
    menuWidth + (outerMargin * 2) - 8, 
    menuHeight + (outerMargin * 2) + 20 - 8
  );
  
  // Draw title
  ctx.fillStyle = "white";
  ctx.font = "bold 14px Arial";
  ctx.textAlign = "center";
  ctx.fillText("Choose Piece Type", centerX, startY - outerMargin + 12);
  
  // Define the 2x3 grid layout
  const pieceLayout = [
    ["rook", "bishop", "queen"],
    ["knight", "king", "pawn"]
  ];
  
  // Draw piece options
  pieceLayout.forEach((row, rowIndex) => {
    row.forEach((pieceType, colIndex) => {
      const btnX = startX + colIndex * (buttonSize + spacing);
      const btnY = startY + rowIndex * (buttonSize + spacing);
      
      // Draw button background
      ctx.fillStyle = "rgba(52, 152, 219, 0.9)";
      ctx.fillRect(btnX, btnY, buttonSize, buttonSize);
      ctx.strokeStyle = "white";
      ctx.lineWidth = 1;
      ctx.strokeRect(btnX, btnY, buttonSize, buttonSize);
      
      // Draw piece image
      const imgSize = buttonSize - 10;
      const imgX = btnX + (buttonSize - imgSize) / 2;
      const imgY = btnY + (buttonSize - imgSize) / 2;
      
      ctx.drawImage(pieceImages[pieceType], imgX, imgY, imgSize, imgSize);
      
      // Draw piece name below image
      ctx.fillStyle = "white";
      ctx.font = "10px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      
      const displayName = pieceType.charAt(0).toUpperCase() + pieceType.slice(1);
      ctx.fillText(displayName, btnX + buttonSize/2, btnY + buttonSize + 3);
    });
  });
  
  // Draw instruction text
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.font = "italic 10px Arial";
  ctx.fillText("Click outside to cancel", centerX, startY + menuHeight + outerMargin + 8);
  
  // Reset text alignment
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

//visible for only piece can move to
function getVisibleSquares() {
  const visible = Array.from({ length: ROWS }, () => Array(COLS).fill(false));

  if (!fogEnabled || (CM_EDITOR_PAGE && mode === "edit")) {
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        visible[r][c] = true;
    return visible;
  }

  if (selectedPlayerIndex >= 0) {
    const p = players[selectedPlayerIndex];
    visible[p.row][p.col] = true;

    // Show all valid move targets in fog
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (isValidMove(selectedPlayerIndex, r, c) || visitedSquares[r][c]) {
          visible[r][c] = true;
        }
      }
    }
  }
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (visitedSquares[r][c]) {
        visible[r][c] = true;
      }
    }
  }

  return visible;
}

function getValidMovesFor(playerIndex) {
  const moves = [];
  if (playerIndex < 0 || playerIndex >= players.length) return moves;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (isValidMove(playerIndex, r, c)) moves.push([r, c]);
    }
  }
  return moves;
}

function getVisionForPiece(row, col, pieceType, playerIndex) {
  const visionSquares = [];
  
  // Always include current position
  visionSquares.push([row, col]);
  
  switch (pieceType) {
    case "rook":
      // Rooks see in straight lines until blocked
      addLineOfSight(visionSquares, row, col, 1, 0, playerIndex);  // Down
      addLineOfSight(visionSquares, row, col, -1, 0, playerIndex); // Up
      addLineOfSight(visionSquares, row, col, 0, 1, playerIndex);  // Right
      addLineOfSight(visionSquares, row, col, 0, -1, playerIndex); // Left
      break;
      
    case "bishop":
      // Bishops see in diagonals until blocked
      addLineOfSight(visionSquares, row, col, 1, 1, playerIndex);   // Down-right
      addLineOfSight(visionSquares, row, col, 1, -1, playerIndex);  // Down-left
      addLineOfSight(visionSquares, row, col, -1, 1, playerIndex);  // Up-right
      addLineOfSight(visionSquares, row, col, -1, -1, playerIndex); // Up-left
      break;
      
    case "queen":
      // Queens see in all directions until blocked
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          addLineOfSight(visionSquares, row, col, dr, dc, playerIndex);
        }
      }
      break;
      
    case "knight":
      // Knights see all knight moves (2+1 pattern)
      const knightMoves = [
        [2, 1], [2, -1], [-2, 1], [-2, -1],
        [1, 2], [1, -2], [-1, 2], [-1, -2]
      ];
      knightMoves.forEach(([dr, dc]) => {
        const newRow = row + dr;
        const newCol = col + dc;
        if (newRow >= 0 && newRow < ROWS && newCol >= 0 && newCol < COLS) {
          visionSquares.push([newRow, newCol]);
        }
      });
      break;
      
    case "king":
      // Kings see all adjacent squares
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const newRow = row + dr;
          const newCol = col + dc;
          if (newRow >= 0 && newRow < ROWS && newCol >= 0 && newCol < COLS) {
            visionSquares.push([newRow, newCol]);
          }
        }
      }
      break;
      
    case "pawn":
      // Pawns see forward and diagonal for capturing
      const newRow = row + 1; // Assuming pawns move downward
      if (newRow < ROWS) {
        visionSquares.push([newRow, col]); // Forward
        if (col > 0) visionSquares.push([newRow, col - 1]); // Diagonal left
        if (col < COLS - 1) visionSquares.push([newRow, col + 1]); // Diagonal right
      }
      break;
  }
  
  return visionSquares;
}

// Helper function to add line-of-sight squares until blocked
function addLineOfSight(visionSquares, startRow, startCol, dr, dc, playerIndex) {
  let r = startRow + dr;
  let c = startCol + dc;
  
  while (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
    visionSquares.push([r, c]);
    
    // Stop if we hit a blocking cell (but allow seeing through players)
    if (board[r][c] === CELL_TYPES.SOLID_BLOCK || 
        board[r][c] === CELL_TYPES.PHASE_BLOCK_ACTIVE) {
      break;
    }
    
    r += dr;
    c += dc;
  }
}

// Add this function to draw the content of a cell
function drawCellContent(cellType, x, y, row, col) {
  // Draw solid block (green square)
  if (cellType === CELL_TYPES.SOLID_BLOCK) {
    ctx.fillStyle = "rgba(46, 204, 113, 0.7)";
    ctx.fillRect(x+3, y+3, TILE_SIZE-6, TILE_SIZE-6);
  }
  
  // Draw inactive phase block (blue semi-transparent)
  if (cellType === CELL_TYPES.PHASE_BLOCK) {
    ctx.fillStyle = "rgba(52, 152, 219, 0.3)";
    ctx.fillRect(x+3, y+3, TILE_SIZE-6, TILE_SIZE-6);
    
    // Draw upward arrow to indicate you can pass through from below
    ctx.fillStyle = "rgba(25, 118, 210, 0.6)";
    ctx.beginPath();
    ctx.moveTo(x + TILE_SIZE/2, y + TILE_SIZE - 10);
    ctx.lineTo(x + TILE_SIZE/2 - 8, y + TILE_SIZE - 18);
    ctx.lineTo(x + TILE_SIZE/2 + 8, y + TILE_SIZE - 18);
    ctx.closePath();
    ctx.fill();
  }
  
  // Draw active phase block (solid blue)
  if (cellType === CELL_TYPES.PHASE_BLOCK_ACTIVE) {
    ctx.fillStyle = "rgba(41, 128, 185, 0.8)";
    ctx.fillRect(x+3, y+3, TILE_SIZE-6, TILE_SIZE-6);
  }
  
  // Draw transformer block (purple with question mark)
  if (cellType === CELL_TYPES.TRANSFORMER) {
    ctx.fillStyle = "rgba(155, 89, 182, 0.7)";
    ctx.fillRect(x+3, y+3, TILE_SIZE-6, TILE_SIZE-6);
    
    // Draw question mark
    ctx.fillStyle = "white";
    ctx.font = "bold 30px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", x + TILE_SIZE/2, y + TILE_SIZE/2);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }
  
  // Draw objective block (orange diamond)
  if (cellType === CELL_TYPES.OBJECTIVE) {
    ctx.fillStyle = "rgba(243, 156, 18, 0.7)";
    ctx.beginPath();
    ctx.moveTo(x + TILE_SIZE/2, y + 3);
    ctx.lineTo(x + TILE_SIZE - 3, y + TILE_SIZE/2);
    ctx.lineTo(x + TILE_SIZE/2, y + TILE_SIZE - 3);
    ctx.lineTo(x + 3, y + TILE_SIZE/2);
    ctx.closePath();
    ctx.fill();
  }
  
  // Draw completed objective block (green diamond)
  if (cellType === CELL_TYPES.OBJECTIVE_COMPleted) {
    ctx.fillStyle = "rgba(46, 204, 113, 0.7)";
    ctx.beginPath();
    ctx.moveTo(x + TILE_SIZE/2, y + 3);
    ctx.lineTo(x + TILE_SIZE - 3, y + TILE_SIZE/2);
    ctx.lineTo(x + TILE_SIZE/2, y + TILE_SIZE - 3);
    ctx.lineTo(x + 3, y + TILE_SIZE/2);
    ctx.closePath();
    ctx.fill();
    
    // Draw checkmark
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 15, y + TILE_SIZE/2);
    ctx.lineTo(x + TILE_SIZE/2 - 4, y + TILE_SIZE - 15);
    ctx.lineTo(x + TILE_SIZE - 15, y + 15);
    ctx.stroke();
  }
  
  // Draw goal (red king)
  if (cellType === CELL_TYPES.GOAL && goal && goal.row === row && goal.col === col) {
    ctx.drawImage(pieceImages.target, x+8, y+8, TILE_SIZE-16, TILE_SIZE-16);
  }
  
  // Draw counter goal
  if (cellType === CELL_TYPES.COUNTER_GOAL && goal && goal.row === row && goal.col === col) {
    ctx.drawImage(pieceImages.target, x+8, y+8, TILE_SIZE-16, TILE_SIZE-16);
  }
}

// --- Drawing ---
function drawBoard() {
  const visible = fogEnabled ? getVisibleSquares() : null;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      let x = c * TILE_SIZE;
      let y = r * TILE_SIZE;

      // Draw checkerboard pattern
      ctx.fillStyle = (r + c) % 2 === 0 ? "#b6cce0ff" : "#ffffffff";  // light pink and sky blue
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

      // If fog is off, draw everything normally
      if (fogEnabled) {
        // If fog is on, only draw content if visible
        if (visible[r][c]) {
          drawCellContent(board[r][c], x, y, r, c);
        } else {
          // Overlay fog (dark square) but don't completely hide the cell
          ctx.fillStyle = "rgba(0,0,0,0.7)";
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          
          // Still show the basic checkerboard pattern underneath
          ctx.globalAlpha = 0.3;
          ctx.fillStyle = (r + c) % 2 === 0 ? "#EEE" : "#CCC";
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.globalAlpha = 1.0;
        }
      } else {
        // If fog is off, draw everything normally
        drawCellContent(board[r][c], x, y, r, c);
      }

      // Draw solid block (green square) - adjust size for smaller tiles
      if (board[r][c] === CELL_TYPES.SOLID_BLOCK) {
        if (!fogEnabled || visible[r][c]) {
          ctx.fillStyle = "rgba(46, 204, 113, 0.7)";
          ctx.fillRect(x+3, y+3, TILE_SIZE-6, TILE_SIZE-6);
        }
      }
      
      // Draw inactive phase block (blue semi-transparent) - adjust size
      if (board[r][c] === CELL_TYPES.PHASE_BLOCK) {
        if (!fogEnabled || visible[r][c]) {
          ctx.fillStyle = "rgba(52, 152, 219, 0.3)";
          ctx.fillRect(x+3, y+3, TILE_SIZE-6, TILE_SIZE-6);
          
          // Draw upward arrow to indicate you can pass through from below
          ctx.fillStyle = "rgba(25, 118, 210, 0.6)";
          ctx.beginPath();
          ctx.moveTo(x + TILE_SIZE/2, y + TILE_SIZE - 10);
          ctx.lineTo(x + TILE_SIZE/2 - 8, y + TILE_SIZE - 18);
          ctx.lineTo(x + TILE_SIZE/2 + 8, y + TILE_SIZE - 18);
          ctx.closePath();
          ctx.fill();
        }
      }
      
      // Draw active phase block (solid blue) - adjust size
      if (board[r][c] === CELL_TYPES.PHASE_BLOCK_ACTIVE) {
        if (!fogEnabled || visible[r][c]) {
          ctx.fillStyle = "rgba(41, 128, 185, 0.8)";
          ctx.fillRect(x+3, y+3, TILE_SIZE-6, TILE_SIZE-6);
        }
      }
      
      // Draw transformer block (purple with question mark) - adjust size
      if (board[r][c] === CELL_TYPES.TRANSFORMER) {
        if (!fogEnabled || visible[r][c]) {
          ctx.fillStyle = "rgba(155, 89, 182, 0.7)";
          ctx.fillRect(x+3, y+3, TILE_SIZE-6, TILE_SIZE-6);
          
          // Draw question mark
          ctx.fillStyle = "white";
          ctx.font = "bold 30px Arial"; // Smaller font
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("?", x + TILE_SIZE/2, y + TILE_SIZE/2);
          ctx.textAlign = "left";
          ctx.textBaseline = "alphabetic";
        }
      }
      
      // Draw objective block (orange diamond) - adjust size
      if (board[r][c] === CELL_TYPES.OBJECTIVE) {
        if (!fogEnabled || visible[r][c]) {
          ctx.fillStyle = "rgba(243, 156, 18, 0.7)";
          ctx.beginPath();
          ctx.moveTo(x + TILE_SIZE/2, y + 3);
          ctx.lineTo(x + TILE_SIZE - 3, y + TILE_SIZE/2);
          ctx.lineTo(x + TILE_SIZE/2, y + TILE_SIZE - 3);
          ctx.lineTo(x + 3, y + TILE_SIZE/2);
          ctx.closePath();
          ctx.fill();
        }
      }

      // Draw teleport blocks with their respective colors
      if ([
          CELL_TYPES.TELEPORT_PURPLE,
          CELL_TYPES.TELEPORT_GREEN,
          CELL_TYPES.TELEPORT_BLUE,
          CELL_TYPES.TELEPORT_ORANGE
      ].includes(board[r][c])) {
          if (!fogEnabled || visible[r][c]) {
              const color = TELEPORT_COLORS[board[r][c]];
              if (color) {
                  ctx.fillStyle = color.fill;
                  ctx.beginPath();
                  ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE / 3, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.strokeStyle = color.stroke;
                  ctx.lineWidth = 2;
                  ctx.stroke();
              }
          }
      }
      
      // Draw completed objective block (green diamond) - adjust size
      if (board[r][c] === CELL_TYPES.OBJECTIVE_COMPLETED) {
        if (!fogEnabled || visible[r][c]) {
          ctx.fillStyle = "rgba(46, 204, 113, 0.7)";
          ctx.beginPath();
          ctx.moveTo(x + TILE_SIZE/2, y + 3);
          ctx.lineTo(x + TILE_SIZE - 3, y + TILE_SIZE/2);
          ctx.lineTo(x + TILE_SIZE/2, y + TILE_SIZE - 3);
          ctx.lineTo(x + 3, y + TILE_SIZE/2);
          ctx.closePath();
          ctx.fill();
          
          // Draw checkmark
          ctx.strokeStyle = "white";
          ctx.lineWidth = 2; // Thinner line
          ctx.beginPath();
          ctx.moveTo(x + 15, y + TILE_SIZE/2);
          ctx.lineTo(x + TILE_SIZE/2 - 4, y + TILE_SIZE - 15);
          ctx.lineTo(x + TILE_SIZE - 15, y + 15);
          ctx.stroke();
        }
      }

      // Draw player pieces - adjust size and position
      if (board[r][c] === CELL_TYPES.PLAYER) {
        // Find which player is at this position
        if (!fogEnabled || visible[r][c]) {
          const player = players.find(p => p.row === r && p.col === c);
          if (player) {
            // Check if there's a teleport block at this position
            const teleportBlock = teleportBlocks.find(tp => tp.row === r && tp.col === c);
            if (teleportBlock) {
                const color = TELEPORT_COLORS[teleportBlock.type];
                if (color) {
                    // Draw teleport block underneath
                    ctx.fillStyle = color.fill;
                    ctx.beginPath();
                    ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE / 3, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = color.stroke;
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
            }
            
            // Draw the player piece on top
            ctx.drawImage(pieceImages[player.pieceType], x+8, y+8, TILE_SIZE-16, TILE_SIZE-16);
          }
        }
      }

      if (teleportBlocks.some(tp => tp.row === r && tp.col === c) && board[r][c] !== CELL_TYPES.PLAYER) {
        if (!fogEnabled || visible[r][c]) {
            ctx.fillStyle = "rgba(155, 89, 182, 0.8)";
            ctx.beginPath();
            ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE / 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
            ctx.lineWidth = 2;
            ctx.stroke();
        }
      }

      // Draw bomb block
      if (board[r][c] === CELL_TYPES.BOMB) {
        if (!fogEnabled || visible[r][c]) {
          ctx.drawImage(pieceImages.bomb, x+8, y+8, TILE_SIZE-16, TILE_SIZE-16);
        }
      }

      // Draw goal (red king) - adjust size and position
      if (board[r][c] === CELL_TYPES.GOAL && goal) {
        if (!fogEnabled || visible[r][c]) {
          if (areAllObjectivesCompleted()) {
            // Goal is accessible - draw normally
            ctx.drawImage(pieceImages.target, x+8, y+8, TILE_SIZE-16, TILE_SIZE-16);
          } else {
            // Goal is not accessible yet - draw as locked
            ctx.drawImage(pieceImages.target, x+8, y+8, TILE_SIZE-16, TILE_SIZE-16);
            
            // Draw lock icon over the goal
            ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
            ctx.beginPath();
            ctx.arc(x + TILE_SIZE/2, y + TILE_SIZE/2, 12, 0, Math.PI * 2); // Smaller lock
            ctx.fill();
            
            ctx.fillStyle = "white";
            ctx.font = "bold 16px Arial"; // Smaller font
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("🔒", x + TILE_SIZE/2, y + TILE_SIZE/2);
            ctx.textAlign = "left";
            ctx.textBaseline = "alphabetic";
          }
        }
      }
    }
  }

  // Draw players
  fallingPieces.forEach(piece => {
    const x = piece.col * TILE_SIZE;

    // ghost at starting square
    // ctx.globalAlpha = 0.5; // translucent ghost
    // ctx.drawImage(pieceImages[piece.pieceType], x+8, piece.startRow * TILE_SIZE + 8, TILE_SIZE-16, TILE_SIZE-16);

    // falling piece
    ctx.globalAlpha = 1.0;
    ctx.drawImage(pieceImages[piece.pieceType], x+8, piece.y+8, TILE_SIZE-16, TILE_SIZE-16);
  });

  // Draw exploding players with rotation effect
  for (const p of explodingPlayers) {
    const img = pieceImages[p.pieceType];
    if (!img.complete) continue;

    ctx.save();
    ctx.translate(p.x + TILE_SIZE / 2, p.y + TILE_SIZE / 2);
    ctx.rotate(p.rotation);
    
    // Add a slight scale effect for more drama
    const scale = 1 + Math.sin(p.rotation) * 0.1;
    ctx.scale(scale, scale);
    
    // Draw the piece centered
    ctx.drawImage(img, -TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
    ctx.restore();
  }

  // draw normal (non-falling) players
  players.forEach((player, i) => {
    const isFalling = fallingPieces.find(fp => fp.playerIndex === i);
    const isRising = risingPieces.find(rp => rp.playerIndex === i);
    
    if (!isFalling && !isRising) {
      const x = player.col * TILE_SIZE;
      const y = player.row * TILE_SIZE;
      
      // Check if there's a teleport block at this position
      const teleportBlock = teleportBlocks.find(tp => tp.row === player.row && tp.col === player.col);
      if (teleportBlock) {
        const color = TELEPORT_COLORS[teleportBlock.type];
        if (color) {
          // Draw teleport block underneath
          ctx.fillStyle = color.fill;
          ctx.beginPath();
          ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE / 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = color.stroke;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
      
      // Draw the player piece on top
      ctx.drawImage(pieceImages[player.pieceType], x+8, y+8, TILE_SIZE-16, TILE_SIZE-16);
    }
  });


  // Draw goal or counter goal
  if (goal) {
    const x = goal.col * TILE_SIZE;
    let y = goal.row * TILE_SIZE;

    // check if it's falling
    const isFalling = fallingPieces.find(fp => fp.playerIndex === "goal");
    if (isFalling) y = isFalling.y;

    // ✅ Only draw if fog is disabled OR square is visible
    if (!fogEnabled || visible[goal.row][goal.col]) {
      // Draw base king image
      ctx.drawImage(pieceImages.target, x+8, y+8, TILE_SIZE-16, TILE_SIZE-16);

      // If it's a counter goal, draw counter
      if (goal.type === "counter") {
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.beginPath();
        ctx.arc(x + TILE_SIZE/2, y + TILE_SIZE/2, 14, 0, Math.PI*2);
        ctx.fill();

        ctx.fillStyle = (goal.counter <= 3) ? "red" : "white";
        ctx.font = "bold 16px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(goal.counter, x + TILE_SIZE/2, y + TILE_SIZE/2);
      }

      // Lock overlay
      if (!areAllObjectivesCompleted() ||
        (goal.type === "counter" && goal.counter <= 0)) {
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.beginPath();
        ctx.arc(x + TILE_SIZE/2, y + TILE_SIZE/2, 12, 0, Math.PI*2);
        ctx.fill();

        ctx.fillStyle = "white";
        ctx.font = "bold 16px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🔒", x + TILE_SIZE/2, y + TILE_SIZE/2);
      }
    }
  }
}

// --- Confetti Celebration ---
function triggerConfetti() {
  //const Winsound = new Audio("assets/audio/woo-hoo-82843.mp3");
  const Winsound = new Audio("assets/audio/completion.mp3");
  playSound(Winsound, 0.7);
  const confettiCount = 150; // More confetti!
  const confettiColors = [
    '#ff6b6b', '#4ecdc4', '#f9ca24', '#6c5ce7', '#00b894', 
    '#fd79a8', '#ff9ff3', '#54a0ff', '#ff5252', '#00cec9',
    '#fdcb6e', '#a29bfe', '#55efc4', '#74b9ff', '#ffeaa7'
  ];
  
  const container = document.createElement('div');
  container.className = 'confetti-container';
  document.body.appendChild(container);
  
  const canvasRect = canvas.getBoundingClientRect();
  const centerX = canvasRect.left + canvasRect.width / 2;
  const startY = canvasRect.top + 30; // Start near top of canvas
  
  const confettiPieces = [];
  const startTime = Date.now();
  
  // Create enhanced confetti pieces
  for (let i = 0; i < confettiCount; i++) {
    const confetti = document.createElement('div');
    const color = confettiColors[Math.floor(Math.random() * confettiColors.length)];
    const size = Math.random() * 10 + 6;
    const shapeType = Math.floor(Math.random() * 4); // 0: circle, 1: square, 2: rectangle, 3: diamond
    
    let styles = `
      position: absolute;
      background: ${color};
      z-index: 1000;
      pointer-events: none;
      opacity: ${Math.random() * 0.9 + 0.1};
    `;
    
    switch(shapeType) {
      case 0: // Circle
        styles += `width: ${size}px; height: ${size}px; border-radius: 50%;`;
        break;
      case 1: // Square
        styles += `width: ${size}px; height: ${size}px;`;
        break;
      case 2: // Rectangle
        styles += `width: ${size * 1.5}px; height: ${size * 0.6}px;`;
        break;
      case 3: // Diamond
        styles += `
          width: ${size}px; height: ${size}px;
          transform: rotate(45deg);
          margin: ${size/2}px;
        `;
        break;
    }
    
    confetti.style.cssText = styles;
    container.appendChild(confetti);
    
    // Different physics for different shapes
    const isLight = shapeType === 2 || shapeType === 3; // rectangles and diamonds float more
    
    confettiPieces.push({
      element: confetti,
      x: centerX - size/2 + (Math.random() * 200 - 100), // Wider spread
      y: startY,
      speed: Math.random() * 4 + (isLight ? 1 : 2), // Lighter pieces fall slower
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() * 0.3 - 0.15) * (isLight ? 1.5 : 1),
      horizontalSpeed: Math.random() * 6 - 3,
      horizontalWave: Math.random() * 0.05,
      waveOffset: Math.random() * Math.PI * 2,
      size: size,
      shapeType: shapeType,
      opacity: Math.random() * 0.9 + 0.1,
      wobbleSpeed: Math.random() * 0.1 + 0.05,
      wobbleAmount: Math.random() * 5 + 2
    });
  }
  
  // Add some streamers for extra effect
  addStreamers(container, canvasRect, centerX, startY);
  
  // Animation loop
  function animateConfetti() {
    const elapsed = Date.now() - startTime;
    
    if (elapsed > 5000) { // Longer duration
      container.remove();
      return;
    }
    
    const progress = elapsed / 5000;
    
    confettiPieces.forEach((piece, index) => {
      // Update position with wave motion
      piece.y += piece.speed;
      piece.x += piece.horizontalSpeed + Math.sin(elapsed * piece.horizontalWave + piece.waveOffset) * 2;
      
      // Wobble effect
      const wobble = Math.sin(elapsed * piece.wobbleSpeed) * piece.wobbleAmount;
      
      // Rotation
      piece.rotation += piece.rotationSpeed;
      
      // Fade out near the end
      const opacity = Math.max(0, piece.opacity * (1 - progress * 1.2));
      
      // Apply transformations
      let transform = `rotate(${piece.rotation}rad) translateX(${wobble}px)`;
      if (piece.shapeType === 3) { // Diamond
        transform += ' rotate(45deg)';
      }
      
      piece.element.style.transform = transform;
      piece.element.style.left = `${piece.x}px`;
      piece.element.style.top = `${piece.y}px`;
      piece.element.style.opacity = opacity;
      
      // Remove pieces that go off screen
      if (piece.y > window.innerHeight || opacity <= 0) {
        piece.element.remove();
        confettiPieces.splice(index, 1);
      }
    });
    
    if (confettiPieces.length > 0) {
      requestAnimationFrame(animateConfetti);
    } else {
      container.remove();
    }
  }
  
  // Add burst effect at the beginning
  createInitialBurst(container, canvasRect, centerX, startY);
  
  animateConfetti();
}

// Add streamers for extra celebration
function addStreamers(container, canvasRect, centerX, startY) {
  const streamerColors = ['#ff6b6b', '#f9ca24', '#6c5ce7', '#00b894'];
  
  for (let i = 0; i < 8; i++) {
    const streamer = document.createElement('div');
    const color = streamerColors[i % streamerColors.length];
    const angle = (i / 8) * Math.PI * 2;
    const length = 60 + Math.random() * 40;
    
    streamer.style.cssText = `
      position: absolute;
      background: ${color};
      width: 4px;
      height: ${length}px;
      left: ${centerX - 2}px;
      top: ${startY}px;
      transform-origin: center top;
      transform: rotate(${angle}rad);
      z-index: 1000;
      pointer-events: none;
      opacity: 0.9;
    `;
    
    container.appendChild(streamer);
    
    // Animate streamers
    let scale = 1;
    const streamerInterval = setInterval(() => {
      scale -= 0.05;
      if (scale <= 0) {
        clearInterval(streamerInterval);
        streamer.remove();
      } else {
        streamer.style.transform = `rotate(${angle}rad) scaleY(${scale})`;
        streamer.style.opacity = scale;
      }
    }, 50);
  }
}

function createExplosionParticles(x, y) {
  for (let i = 0; i < 8; i++) {
    explodingPlayers.push({
      x: x,
      y: y,
      velocityY: Math.random() * -6 - 2,
      velocityX: (Math.random() - 0.5) * 8,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.5,
      pieceType: "pawn" // Use pawn as small particle, or create custom particle images
    });
  }
}

function scheduleAutoRestartAfterDeath(reasonText) {
  if (autoRestartScheduled) return;
  if (!currentPuzzleData) return;
  autoRestartScheduled = true;
  updateStatus(reasonText || "You died. Restarting level...");
  setTimeout(() => {
    autoRestartScheduled = false;
    restartLevel();
  }, 700);
}

//moving bomb function
function moveBombs() {
  for (let i = bombs.length - 1; i >= 0; i--) {
    let bomb = bombs[i];
    // Clear current position
    board[bomb.row][bomb.col] = CELL_TYPES.EMPTY;

    // Move bomb in its direction
    let nextCol = bomb.col + bomb.direction;

    // Remove bomb if out of bounds
    if (nextCol < 0 || nextCol >= COLS) {
      bombs.splice(i, 1);
      continue;
    }

    // Check collision with player
    const hitPlayerIndex = players.findIndex(p => p.row === bomb.row && p.col === nextCol);
    if (hitPlayerIndex !== -1) {
      const player = players[hitPlayerIndex];

      // 💥 Play explosion sound
      const explosionSound = document.getElementById("explosionSound");
      if (explosionSound) {
          playSound(explosionSound);
      }

      // Save explosion animation details
      explodingPlayers.push({
        x: player.col * TILE_SIZE,
        y: player.row * TILE_SIZE,
        velocityY: -8,  // Initial jump velocity
        rotation: 0,
        rotationSpeed: (Math.random() < 0.5 ? -1 : 1) * 0.3,
        pieceType: player.pieceType
      });

      createExplosionParticles(player.col * TILE_SIZE, player.row * TILE_SIZE);

      players.splice(hitPlayerIndex, 1);
      updatePlayerCount();
      updateStatus("💣 A player was blown up!");
      scheduleAutoRestartAfterDeath("💀 You were blown up! Restarting level...");
    }

    // Place bomb in new location
    bomb.col = nextCol;
    board[bomb.row][bomb.col] = CELL_TYPES.BOMB;
  }
}

function updateBombs() {
  for (let i = bombs.length - 1; i >= 0; i--) {
    const bomb = bombs[i];
    const nextCol = bomb.col + bomb.direction;

    // Check bounds - bounce if hitting the edge
    if (nextCol < 0 || nextCol >= COLS) {
      bomb.direction *= -1; // Reverse direction
      continue;
    }

    // Check for collision with ANY player (regardless of selection state)
    const hitPlayerIndex = players.findIndex(p => p.row === bomb.row && p.col === nextCol);
    if (hitPlayerIndex !== -1) {
      const player = players[hitPlayerIndex];

      // 💥 Play explosion sound
      const explosionSound = document.getElementById("explosionSound");
      if (explosionSound) {
        playSound(explosionSound);
      }
      
      // Create explosion animation
      explodingPlayers.push({
        x: player.col * TILE_SIZE,
        y: player.row * TILE_SIZE,
        velocityY: -8,  // Initial upward velocity
        rotation: 0,
        rotationSpeed: (Math.random() < 0.5 ? -1 : 1) * 0.3, // Random rotation direction
        pieceType: player.pieceType
      });

      // Remove the player that got hit (regardless of selection state)
      players.splice(hitPlayerIndex, 1);
      updateStatus("💣 A player was blown up!");
      updatePlayerCount();
      shakeAmount = 30; // shake intensity
      scheduleAutoRestartAfterDeath("💀 You were blown up! Restarting level...");
      
      // Clear selection if the selected player was blown up
      if (selectedPlayerIndex === hitPlayerIndex) {
        selectedPlayerIndex = -1;
      } else if (selectedPlayerIndex > hitPlayerIndex) {
        // Adjust selected index if a player before it was removed
        selectedPlayerIndex--;
      }
      
      // Check if all players are gone
      if (players.length === 0) {
        updateStatus("Game Over! All players destroyed!");
      }
      
      // Move the bomb to the player's position and continue
      board[bomb.row][bomb.col] = CELL_TYPES.EMPTY;
      bomb.col = nextCol;
      board[bomb.row][bomb.col] = CELL_TYPES.BOMB;
      continue; // Skip the rest of the logic for this bomb this frame
    }

    // Only move if the next position is empty
    if (board[bomb.row][nextCol] === CELL_TYPES.EMPTY) {
      // Clear current position
      board[bomb.row][bomb.col] = CELL_TYPES.EMPTY;
      
      // Move bomb
      bomb.col = nextCol;
      board[bomb.row][bomb.col] = CELL_TYPES.BOMB;
    } else {
      // If the next position is blocked by something else, bounce
      bomb.direction *= -1;
    }
  }
}

function updateExplodingPlayers() {
  for (let i = explodingPlayers.length - 1; i >= 0; i--) {
    const p = explodingPlayers[i];
    
    // Apply gravity
    p.velocityY += 0.5;
    p.y += p.velocityY;
    
    // Apply rotation
    p.rotation += p.rotationSpeed;
    
    // Add some horizontal movement for more dynamic effect
    if (Math.abs(p.rotationSpeed) > 0.1) {
      p.x += p.rotationSpeed * 2; // Move horizontally based on rotation direction
    }

    // Remove if off screen or after a certain time
    if (p.y > canvas.height + TILE_SIZE || p.x < -TILE_SIZE || p.x > canvas.width + TILE_SIZE) {
      explodingPlayers.splice(i, 1);
    }
  }
}

function handleBombCollision(player, playerIndex, bombRow, bombCol) {
  // 💥 Play explosion sound
  const explosionSound = document.getElementById("explosionSound");
  if (explosionSound) {
    playSound(explosionSound);
  }

  // Create explosion animation at the bomb's position
  explodingPlayers.push({
    x: bombCol * TILE_SIZE,
    y: bombRow * TILE_SIZE,
    velocityY: -8,  // Initial upward velocity
    rotation: 0,
    rotationSpeed: (Math.random() < 0.5 ? -1 : 1) * 0.3, // Random rotation direction
    pieceType: player.pieceType
  });

  createExplosionParticles(bombCol * TILE_SIZE, bombRow * TILE_SIZE);

  // Remove the bomb from the bombs array
  const bombIndex = bombs.findIndex(b => b.row === bombRow && b.col === bombCol);
  if (bombIndex !== -1) {
    bombs.splice(bombIndex, 1);
  }

  // Remove the player
  players.splice(playerIndex, 1);
  updateStatus("💣 A player was blown up by moving into a bomb!");
  updatePlayerCount();
  shakeAmount = 30; // shake intensity
  scheduleAutoRestartAfterDeath("💀 You were blown up! Restarting level...");

  // Clear both the bomb and player from the board
  board[bombRow][bombCol] = CELL_TYPES.EMPTY;

  // Check if all players are gone
  if (players.length === 0) {
    updateStatus("Game Over! All players destroyed!");
  }

  // Clear selection since this player is gone
  selectedPlayerIndex = -1;
}

// Create initial burst effect
function createInitialBurst(container, canvasRect, centerX, startY) {
  const burstColors = ['#ff6b6b', '#f9ca24', '#6c5ce7', '#00b894', '#ffffff'];
  
  for (let i = 0; i < 20; i++) {
    const burst = document.createElement('div');
    const color = burstColors[Math.floor(Math.random() * burstColors.length)];
    const size = Math.random() * 15 + 8;
    const angle = (i / 20) * Math.PI * 2;
    const distance = 30 + Math.random() * 40;
    
    burst.style.cssText = `
      position: absolute;
      background: ${color};
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      left: ${centerX - size/2}px;
      top: ${startY}px;
      z-index: 1000;
      pointer-events: none;
      opacity: 0.9;
    `;
    
    container.appendChild(burst);
    
    // Animate burst
    let progress = 0;
    const burstInterval = setInterval(() => {
      progress += 0.1;
      if (progress >= 1) {
        clearInterval(burstInterval);
        burst.remove();
      } else {
        const x = centerX + Math.cos(angle) * distance * progress;
        const y = startY + Math.sin(angle) * distance * progress;
        const scale = 1 - progress;
        const opacity = 0.9 * (1 - progress);
        
        burst.style.left = `${x - size/2}px`;
        burst.style.top = `${y}px`;
        burst.style.transform = `scale(${scale})`;
        burst.style.opacity = opacity;
      }
    }, 30);
  }
}

// --- Click handler ---
function handleMove(e) {
  if (showTransformerMenu && transformerPosition) {
    handleTransformerMenuClick(e);
    return;
  }
  
  if (gameWon && mode === "play") return;
  
  let rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  let x = (e.clientX - rect.left) * scaleX;
  let y = (e.clientY - rect.top) * scaleY;
  let col = Math.floor(x / TILE_SIZE);
  let row = Math.floor(y / TILE_SIZE);

  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return;

  if (CM_EDITOR_PAGE && mode === "edit") {
    if (typeof window.cmEditorOnEditCell === "function") {
      window.cmEditorOnEditCell(row, col);
    }
    return;
  }

  if (mode === "play") {
    if (players.length === 0) {
      updateStatus("No pieces on this level. Choose another level.");
      return;
    }
    
    // Check if clicked on a player
    const clickedPlayerIndex = getPlayerAt(row, col);
    if (clickedPlayerIndex !== -1) {
      selectedPlayerIndex = clickedPlayerIndex;
      const player = players[selectedPlayerIndex];
      updateStatus(`Selected ${player.pieceType} (player ${selectedPlayerIndex + 1} of ${players.length}). Click destination to move.`);
      return;
    }
    
    // If a player is selected and clicked on empty space, try to move
    if (selectedPlayerIndex !== -1) {
      if (isValidMove(selectedPlayerIndex, row, col)) {
        movePlayer(selectedPlayerIndex, row, col);
        selectedPlayerIndex = -1; // Deselect after moving
      } else {
        updateStatus("Invalid move for selected piece");
      }
    } else {
      updateStatus("Click on a player piece first to select it");
    }
  }
};

function applyAntigravity() {
  risingPieces = [];
  
  // First, collect all pieces that need to rise
  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    let targetRow = player.row;
    
    // Find how high this piece can rise
    while (targetRow > 0 && board[targetRow - 1][player.col] === CELL_TYPES.EMPTY) {
      targetRow--;
    }
    
    if (targetRow !== player.row) {
      // Set up animation info
      risingPieces.push({
        playerIndex: i,
        startRow: player.row,
        targetRow: targetRow,
        col: player.col,
        startY: player.row * TILE_SIZE,
        targetY: targetRow * TILE_SIZE,
        currentY: player.row * TILE_SIZE,
        pieceType: player.pieceType
      });
      
      // Remove from board (we'll animate it)
      board[player.row][player.col] = CELL_TYPES.EMPTY;
    }
  }
  
  // Start the animation loop if we have pieces to rise
  if (risingPieces.length > 0) {
    lastRiseTime = performance.now();
    requestAnimationFrame(updateRisingPieces);
    return true; // Return true if pieces will rise
  }
  return false; // Return false if no pieces will rise
}

function updateRisingPieces(timestamp) {
  if (risingPieces.length === 0) return;
  
  const deltaTime = timestamp - lastRiseTime;
  lastRiseTime = timestamp;
  
  const distanceToMove = (RISE_SPEED * deltaTime) / 1000; // Convert to pixels per frame
  
  for (let i = risingPieces.length - 1; i >= 0; i--) {
    const piece = risingPieces[i];
    
    // Move piece up
    piece.currentY -= distanceToMove;
    
    // Check if we've reached or passed the target
    if (piece.currentY <= piece.targetY) {
      piece.currentY = piece.targetY;
      
      const player = players[piece.playerIndex];
      player.row = piece.targetRow;
      player.col = piece.col;
      
      // Check if landing on a bomb
      if (board[player.row][player.col] === CELL_TYPES.BOMB) {
        handleBombCollision(player, piece.playerIndex, player.row, player.col);
      } else {
        board[player.row][player.col] = CELL_TYPES.PLAYER;
        checkObjectiveCompletion();
        checkWinCondition();
      }
      
      risingPieces.splice(i, 1);
    } else {
      // Check for mid-rise bomb collisions
      const currentRow = Math.floor(piece.currentY / TILE_SIZE);
      const prevRow = Math.floor((piece.currentY + distanceToMove) / TILE_SIZE);
      
      if (currentRow !== prevRow) {
        for (let r = prevRow; r >= currentRow; r--) {
          if (board[r][piece.col] === CELL_TYPES.BOMB) {
            const player = players[piece.playerIndex];
            handleBombCollision(player, piece.playerIndex, r, piece.col);
            risingPieces.splice(i, 1);
            break;
          }
        }
      }
    }
  }
  
  // Force redraw to show animation
  drawBoard();
  
  // Draw the rising pieces on top
  ctx.save();
  for (const piece of risingPieces) {
    const x = piece.col * TILE_SIZE;
    ctx.drawImage(pieceImages[piece.pieceType], x + 8, piece.currentY + 8, TILE_SIZE - 16, TILE_SIZE - 16);
  }
  ctx.restore();
  
  // Continue animation if there are still pieces rising
  if (risingPieces.length > 0) {
    requestAnimationFrame(updateRisingPieces);
  } else {
    // Final draw to ensure everything is in place
    drawBoard();

    // ✅ ADD THIS PART - Decrement counter if nothing else is rising and we were waiting
    if (pendingMoveCounter) {
      decrementCounterAfterMove();
      pendingMoveCounter = false;
    }
  }
}

async function toggleAntigravity() {
  if (gameWon) return;

  if (!antigravityUnlockedThisRun) {
    if (antigravityCredits <= 0) {
      openAntigravityExchangeModal();
      return;
    }
    const consumed = await consumeAntigravityCredit(1);
    if (!consumed) {
      openAntigravityExchangeModal();
      return;
    }
    antigravityUnlockedThisRun = true;
  }

  antigravityEnabled = !antigravityEnabled;
  updateAntigravityButtonLabel();

  if (antigravityEnabled) {
    updateStatus("🔼 Antigravity enabled - pieces rise upward!");
    fallingPieces = [];
    setTimeout(() => {
      const didRise = applyAntigravity();
      if (didRise) {
        queueSystemTraceCapture({
          systemEvent: "toggle_antigravity",
          antigravityApplied: true
        });
      }
    }, 100);
  } else {
    updateStatus("🔽 Gravity enabled - pieces fall downward!");
    applyGravity();
  }
}

function restartLevel() {
  if (!currentPuzzleData) {
    updateStatus("No level is currently loaded.");
    return;
  }
  autoRestartScheduled = false;
  loadPuzzle(currentPuzzleData);
}

canvas.addEventListener("click", handleMove);

// Touch support
canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();

  const touch = e.touches[0];
  handleMove({
    clientX: touch.clientX,
    clientY: touch.clientY
  });
}, { passive: false });

// --- Keyboard controls ---
document.addEventListener("keydown", (e) => {
  if (
    levelCompleteModal &&
    levelCompleteModal.classList.contains("active") &&
    replayUnlockedForLevel &&
    fewestOtherMovesReplayPath &&
    fewestOtherMovesReplayPath.length
  ) {
    const maxIndex = fewestOtherMovesReplayPath.length - 1;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      drawLevelCompleteReplaySnapshot(levelCompleteReplayIndex - 1);
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      drawLevelCompleteReplaySnapshot(levelCompleteReplayIndex + 1);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      drawLevelCompleteReplaySnapshot(0);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      drawLevelCompleteReplaySnapshot(maxIndex);
      return;
    }
  }

  if (mode === "play" && e.key === "Escape") {
    selectedPlayerIndex = -1;
    updateStatus("Selection cleared");
  }
});

// Initialize the canvas size on load
function initializeCanvas() {
  resizeCanvas();
}


let frameCount = 0;
// --- Game Loop ---
function gameLoop() {
  if (shakeAmount > 0.5) {
    shakeX = (Math.random() - 0.5) * shakeAmount;
    shakeY = (Math.random() - 0.5) * shakeAmount;
    shakeAmount *= shakeDecay;
  } else {
    shakeX = 0;
    shakeY = 0;
  }

  ctx.setTransform(1, 0, 0, 1, shakeX, shakeY);
  ctx.clearRect(-shakeX, -shakeY, canvas.width, canvas.height);
  updateFallingPieces();
  updateExplodingPlayers(); // 💣 Animate dead players
  tryCapturePendingMoveTrace(false);

  frameCount++;
  if (frameCount % 50 === 0) {
    updateBombs();
  }


  drawBoard();
  
  if (mode === "play") {
    drawPossibleMoves();
    drawSelectionIndicator();
  }

  if (showTransformerMenu && transformerPosition) {
    drawPieceSelectionMenu();
  }
  
  requestAnimationFrame(gameLoop);
}

const confettiStyle = document.createElement('style');
confettiStyle.textContent = `
  @keyframes confetti-fall {
    0% {
      transform: translate(-50%, 0) rotate(0deg) scale(1);
      opacity: 1;
    }
    100% {
      transform: translate(${Math.random() * 200 - 100}px, 80vh) rotate(360deg) scale(0);
      opacity: 0;
    }
  }
  
  @keyframes confetti-spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
`;

document.head.appendChild(confettiStyle);
window.addEventListener("resize", resizeCanvas);
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", resizeCanvas);
}

// Initialize the game
initializeCanvas();
resizeCanvas();
updateStatus(
  CM_EDITOR_PAGE
    ? "Level editor: place pieces and goal, then copy or download."
    : "Welcome! Choose a level from the list to play."
);
updateUndoButtonLabel();
updateAntigravityButtonLabel();
if (window.authReady && typeof window.authReady.finally === "function") {
  window.authReady.finally(() => {
    syncUndoCreditsFromServer();
    syncAntigravityCreditsFromServer();
  });
} else {
  syncUndoCreditsFromServer();
  syncAntigravityCreditsFromServer();
}
updatePlayerCount();
updateObjectiveCount();

gameLoop();

