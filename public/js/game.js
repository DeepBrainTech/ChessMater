/** GENERATED FILE — edit public/js/game/*.js then run: node scripts/concat-game.mjs */

/**
 * Central asset URLs for ChessMater.
 *
 * Put design files under public/assets/, then point paths here.
 *
 * Folder map:
 *   public/assets/images/pieces/  → chess piece + goal/bomb sprites
 *   public/assets/images/blocks/  → solid / phase / teleporter / objective tiles
 *   public/assets/images/ui/      → HUD icons
 *   public/assets/images/fx/      → particles / VFX
 *   public/assets/audio/music/    → background loops
 *   public/assets/audio/sfx/      → move / explode / win sounds
 *   public/assets/fonts/          → custom UI fonts
 */
window.CM_ASSETS = {
  pieces: {
    rook: "https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg",
    castle_rook: "https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg",
    bishop: "https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg",
    queen: "https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg",
    knight: "https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg",
    king: "https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg",
    pawn: "https://upload.wikimedia.org/wikipedia/commons/4/45/Chess_plt45.svg",
    boom_right:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='40' fill='black'/%3E%3Ccircle cx='35' cy='40' r='5' fill='white'/%3E%3Ccircle cx='45' cy='35' r='3' fill='white'/%3E%3Cpath d='M60,30 L75,25 L70,40 Z' fill='red'/%3E%3C/svg%3E",
    boom_left:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='40' fill='black'/%3E%3Ccircle cx='35' cy='40' r='5' fill='white'/%3E%3Ccircle cx='45' cy='35' r='3' fill='white'/%3E%3Cpath d='M60,30 L75,25 L70,40 Z' fill='red'/%3E%3C/svg%3E",
    target: "https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg",
    bomb:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='40' fill='black'/%3E%3Ccircle cx='35' cy='40' r='5' fill='white'/%3E%3Ccircle cx='45' cy='35' r='3' fill='white'/%3E%3Cpath d='M60,30 L75,25 L70,40 Z' fill='red'/%3E%3C/svg%3E",
  },
  targetPieces: {
    rook: "https://upload.wikimedia.org/wikipedia/commons/f/ff/Chess_rdt45.svg",
    bishop: "https://upload.wikimedia.org/wikipedia/commons/9/98/Chess_bdt45.svg",
    queen: "https://upload.wikimedia.org/wikipedia/commons/4/47/Chess_qdt45.svg",
    knight: "https://upload.wikimedia.org/wikipedia/commons/e/ef/Chess_ndt45.svg",
    king: "https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg",
    pawn: "https://upload.wikimedia.org/wikipedia/commons/c/c7/Chess_pdt45.svg",
  },
  ui: {
    coin: "/assets/images/coin.svg",
    diamond: "/assets/images/diamond.svg",
    flower: "/assets/images/flower.svg",
  },
  audio: {
    music: "/assets/audio/background1.mp3",
    move: "/assets/audio/thump.mp3",
    explode: "/assets/audio/explosion.mp3",
    win: "/assets/audio/completion.mp3",
  },
  blocks: {},
};

/**
 * game/01-state.js
 * DOM refs, constants, images, mutable game state
 * Split from game.monolith.js lines 1-259.
 */
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
const CM_FREE_ANTIGRAVITY =
  CM_EDITOR_PAGE ||
  (typeof window !== "undefined" && window.CM_FREE_ANTIGRAVITY === true);

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const statusMessage = document.getElementById("statusMessage");
const playerCount = document.getElementById("playerCount");
const objectiveCount = document.getElementById("objectiveCount");
const targetPieceCount = document.getElementById("targetPieceCount");
const moveCountDisplay = document.getElementById("moveCount");
const fewestOtherMovesDisplay = document.getElementById("fewestOtherMoves");
const blockTipToggle = document.getElementById("blockTipToggle");
const blockTipModal = document.getElementById("blockTipModal");
const hintSolutionSummary = document.getElementById("hintSolutionSummary");
const hintSolutionActionBtn = document.getElementById("hintSolutionActionBtn");
const hintSolutionNote = document.getElementById("hintSolutionNote");
const inGameWalkthroughModal = document.getElementById("inGameWalkthroughModal");
const inGameWalkthroughTitle = document.getElementById("inGameWalkthroughTitle");
const inGameWalkthroughSubtitle = document.getElementById("inGameWalkthroughSubtitle");
const inGameWalkthroughCanvas = document.getElementById("inGameWalkthroughCanvas");
const inGameWalkthroughHint = document.getElementById("inGameWalkthroughHint");
const inGameWalkthroughStep = document.getElementById("inGameWalkthroughStep");
const inGameWalkthroughEvent = document.getElementById("inGameWalkthroughEvent");
const inGameReplayStepNav = document.getElementById("inGameReplayStepNav");
const closeInGameWalkthroughModalBtn = document.getElementById("closeInGameWalkthroughModal");
const inGameWalkthroughCloseBtn = document.getElementById("inGameWalkthroughCloseBtn");
const levelCompleteReplayStepNav = document.getElementById("levelCompleteReplayStepNav");
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
const levelCompleteReplayLockCostEl = document.getElementById("levelCompleteReplayLockCost");
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

function syncVisitedSquaresSize() {
  while (visitedSquares.length < ROWS) {
    visitedSquares.push(Array(COLS).fill(false));
  }
  visitedSquares.length = ROWS;

  for (const row of visitedSquares) {
    const previousLength = row.length;
    row.length = COLS;
    if (previousLength < COLS) {
      row.fill(false, previousLength);
    }
  }
}

function isInsideBoard(row, col) {
  return row >= 0 && row < ROWS && col >= 0 && col < COLS;
}

function revealAdjacentSquares(visible, row, col) {
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const visibleRow = row + dr;
      const visibleCol = col + dc;
      if (isInsideBoard(visibleRow, visibleCol)) {
        visible[visibleRow][visibleCol] = true;
      }
    }
  }
}


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
  BOMB: 14,    // bomb block
  MOVING_PLATFORM: 15, // vertically moving platform
  BLACK_TARGET_PIECE: 16 // Capturable black piece required to unlock the goal
};

const TELEPORT_COLORS = {
  [CELL_TYPES.TELEPORT_PURPLE]: { fill: "rgba(155, 89, 182, 0.8)", stroke: "rgba(255, 255, 255, 0.6)" },
  [CELL_TYPES.TELEPORT_GREEN]: { fill: "rgba(46, 204, 113, 0.8)", stroke: "rgba(255, 255, 255, 0.6)" },
  [CELL_TYPES.TELEPORT_BLUE]: { fill: "rgba(52, 152, 219, 0.8)", stroke: "rgba(255, 255, 255, 0.6)" },
  [CELL_TYPES.TELEPORT_ORANGE]: { fill: "rgba(243, 156, 18, 0.8)", stroke: "rgba(255, 255, 255, 0.6)" }
};

const TELEPORT_DOOR_COLORS = {
  [CELL_TYPES.TELEPORT_PURPLE]: {
    door: "#7e3fa0",
    dark: "#4b2364",
    edge: "#c084fc",
    glow: "rgba(192, 132, 252, 0.55)"
  },
  [CELL_TYPES.TELEPORT_GREEN]: {
    door: "#27965c",
    dark: "#17613c",
    edge: "#86efac",
    glow: "rgba(134, 239, 172, 0.55)"
  },
  [CELL_TYPES.TELEPORT_BLUE]: {
    door: "#2577b8",
    dark: "#174c75",
    edge: "#93c5fd",
    glow: "rgba(147, 197, 253, 0.55)"
  },
  [CELL_TYPES.TELEPORT_ORANGE]: {
    door: "#c97819",
    dark: "#7c4510",
    edge: "#fdba74",
    glow: "rgba(253, 186, 116, 0.55)"
  }
};

// Piece types
const PIECE_TYPES = ["rook", "bishop", "queen", "knight", "king", "pawn", "castle_rook"];

// --- Load images (URLs from 00-assets-config.js → window.CM_ASSETS) ---
const bombImageSrc =
  (window.CM_ASSETS && window.CM_ASSETS.pieces && window.CM_ASSETS.pieces.bomb) ||
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='40' fill='black'/%3E%3Ccircle cx='35' cy='40' r='5' fill='white'/%3E%3Ccircle cx='45' cy='35' r='3' fill='white'/%3E%3Cpath d='M60,30 L75,25 L70,40 Z' fill='red'/%3E%3C/svg%3E";
const pieceImages = {
  rook: new Image(),
  castle_rook: new Image(),
  bishop: new Image(),
  queen: new Image(),
  knight: new Image(),
  king: new Image(),
  pawn: new Image(),
  boom_right: new Image(),
  boom_left: new Image(),
  target: new Image(),
  bomb: new Image()
};
const targetPieceImages = {
  rook: new Image(),
  bishop: new Image(),
  queen: new Image(),
  knight: new Image(),
  king: new Image(),
  pawn: new Image()
};
(function loadPieceImagesFromAssets() {
  const pieces = (window.CM_ASSETS && window.CM_ASSETS.pieces) || {};
  const targets = (window.CM_ASSETS && window.CM_ASSETS.targetPieces) || {};
  pieceImages.rook.src = pieces.rook || "";
  pieceImages.castle_rook.src = pieces.castle_rook || pieces.rook || "";
  pieceImages.bishop.src = pieces.bishop || "";
  pieceImages.queen.src = pieces.queen || "";
  pieceImages.knight.src = pieces.knight || "";
  pieceImages.king.src = pieces.king || "";
  pieceImages.pawn.src = pieces.pawn || "";
  pieceImages.boom_right.src = pieces.boom_right || bombImageSrc;
  pieceImages.boom_left.src = pieces.boom_left || bombImageSrc;
  pieceImages.target.src = pieces.target || "";
  pieceImages.bomb.src = pieces.bomb || bombImageSrc;
  targetPieceImages.rook.src = targets.rook || "";
  targetPieceImages.bishop.src = targets.bishop || "";
  targetPieceImages.queen.src = targets.queen || "";
  targetPieceImages.knight.src = targets.knight || "";
  targetPieceImages.king.src = targets.king || pieces.target || "";
  targetPieceImages.pawn.src = targets.pawn || "";
})();

// tracker for players, goals, and objectives
let board = Array.from({ length: ROWS }, () => Array(COLS).fill(CELL_TYPES.EMPTY));
let players = []; // Array of { row, col, pieceType }
let goal   = null;
let objectives = []; // Array of { row, col, completed }
let objectivesCompleted = 0;
let totalObjectives = 0;
let targetPieces = []; // Array of { row, col, pieceType, captured }
let targetPiecesCaptured = 0;
let totalTargetPieces = 0;
let phaseBlockStates = {}; // Track which phase blocks have been activated
let bombs = []; // Horizontal bombs use {row, col, direction}; boom bombs use diagonal row/col directions.
let laserBlocks = []; // Solid blocks that emit selected edge-mounted lasers.
let ducks = []; // Horizontal hazards: {row, col, direction}; pieces can safely stand one row above.
const DUCK_EMPTY_GAP = 3;
const DUCK_COLUMN_STEP = DUCK_EMPTY_GAP + 1;
const LASER_DIRECTIONS = [
  { dr: -1, dc: 0, name: "up" },
  { dr: 1, dc: 0, name: "down" },
  { dr: 0, dc: -1, name: "left" },
  { dr: 0, dc: 1, name: "right" }
];
const DEFAULT_LASER_DIRECTIONS = LASER_DIRECTIONS.map(direction => direction.name);
const DEFAULT_LASER_FIRE_EVERY_STEPS = 2;
let movingPlatforms = []; // vertical: {row, col, minLevel, maxLevel, currentLevel}; horizontal: {axis, row, col, minCol, maxCol, currentCol}
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

/**
 * game/02-api-shop-exchange.js
 * API/credits/shop/exchange modal defs (setup calls deferred)
 * Split from game.monolith.js lines 260-1125.
 */
function updateUndoButtonLabel() {
  if (!undoMoveButton) return;
  undoMoveButton.textContent = `Undo(${undoCredits})`;
  if (typeof window.cmEmitGameUi === "function") {
    window.cmEmitGameUi({ type: "undoCredits", undoCredits });
  }
}

function updateAntigravityButtonLabel() {
  if (!antigravityToggleButton) return;
  const state = antigravityEnabled ? "ON" : "OFF";
  if (CM_FREE_ANTIGRAVITY) {
    antigravityToggleButton.textContent = `Antigravity ${state}`;
  } else if (antigravityUnlockedThisRun) {
    antigravityToggleButton.textContent = `Antigravity ${state}`;
  } else {
    antigravityToggleButton.textContent = `Antigravity(${antigravityCredits})`;
  }
  if (typeof window.cmEmitGameUi === "function") {
    window.cmEmitGameUi({
      type: "antigravity",
      antigravityCredits,
      antigravityEnabled,
      antigravityUnlockedThisRun,
    });
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
    const base = normalizePortalApiBase(window.cmPortalApiBase || "");
    if (!base) return false;

    try {
      const sessionRes = await fetch(`${base}/api/games/chessmater/session`, {
        method: "GET",
        credentials: "include"
      });
      if (sessionRes.status === 401) {
        if (typeof window.cmGetPortalLoginUrl === "function") {
          window.location.href = window.cmGetPortalLoginUrl();
        } else {
          const next = encodeURIComponent(location.href);
          window.location.href = "https://deepbraintechnology.com/zh/login?next=" + next;
        }
        return false;
      }
      const sessionData = await sessionRes.json().catch(() => null);
      const sessionToken =
        sessionData?.data?.game_token ||
        sessionData?.data?.token ||
        sessionData?.game_token ||
        sessionData?.token ||
        null;
      if (sessionRes.ok && sessionToken && typeof sessionToken === "string") {
        window.cmToken = sessionToken;
        if (sessionData?.data?.user) {
          window.cmUser = sessionData.data.user;
        }
        return true;
      }
      return false;
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

window.refreshGameTokenFromPortal = refreshGameTokenFromPortal;
window.apiFetchWithAuthRetry = apiFetchWithAuthRetry;

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

/** Fallback display prices when portal catalog/item fetch fails or API base is unset (align with shop_items.py). */
const SHOP_ITEM_FALLBACK_COST = {
  [PORTAL_UNDO_ITEM_ID]: { coins: 5, diamonds: 0, flowers: 0 },
  [PORTAL_ANTIGRAVITY_ITEM_ID]: { coins: 5, diamonds: 0, flowers: 0 },
  [PORTAL_REPLAY_ITEM_ID]: { coins: 0, diamonds: 2, flowers: 0 }
};

const shopPriceCache = {};
let shopCatalogWarmPromise = null;

function normalizePortalApiBase(base) {
  if (!base || typeof base !== "string") return "";
  return base.replace(/\/+$/, "");
}

function portalUndoShopAvailable() {
  const base = normalizePortalApiBase(window.cmPortalApiBase || "");
  return !!base;
}

function normalizePortalShopCost(raw) {
  const coins = Number(raw?.coins);
  const diamonds = Number(raw?.diamonds);
  const flowers = Number(raw?.flowers);
  return {
    coins: Number.isFinite(coins) ? Math.max(0, Math.floor(coins)) : 0,
    diamonds: Number.isFinite(diamonds) ? Math.max(0, Math.floor(diamonds)) : 0,
    flowers: Number.isFinite(flowers) ? Math.max(0, Math.floor(flowers)) : 0
  };
}

function getFallbackShopCost(itemId) {
  return SHOP_ITEM_FALLBACK_COST[itemId] || { coins: 0, diamonds: 0, flowers: 0 };
}

const CM_CURRENCY_ICON_SRC = {
  coin: (window.CM_ASSETS && window.CM_ASSETS.ui && window.CM_ASSETS.ui.coin) || "/assets/images/coin.svg",
  diamond: (window.CM_ASSETS && window.CM_ASSETS.ui && window.CM_ASSETS.ui.diamond) || "/assets/images/diamond.svg",
  flower: (window.CM_ASSETS && window.CM_ASSETS.ui && window.CM_ASSETS.ui.flower) || "/assets/images/flower.svg",
};

function currencyIconImgHtml(kind) {
  const src = CM_CURRENCY_ICON_SRC[kind];
  if (!src) return "";
  return `<img class="undo-exchange-currency-icon" src="${src}" alt="" aria-hidden="true" width="18" height="18" />`;
}

function formatShopCostForExchangeLineHtml(cost) {
  const c = normalizePortalShopCost(cost);
  const parts = [];
  if (c.coins > 0) {
    parts.push(
      `<span class="undo-exchange-cost-part">${currencyIconImgHtml("coin")}<span class="undo-exchange-cost-num">${c.coins}</span></span>`
    );
  }
  if (c.diamonds > 0) {
    parts.push(
      `<span class="undo-exchange-cost-part">${currencyIconImgHtml("diamond")}<span class="undo-exchange-cost-num">${c.diamonds}</span></span>`
    );
  }
  if (c.flowers > 0) {
    parts.push(
      `<span class="undo-exchange-cost-part">${currencyIconImgHtml("flower")}<span class="undo-exchange-cost-num">${c.flowers}</span></span>`
    );
  }
  if (!parts.length) return "—";
  return parts.join('<span class="undo-exchange-cost-sep">, </span>');
}

function refreshLevelCompleteReplayLockCostEl() {
  if (!levelCompleteReplayLockCostEl) return;
  levelCompleteReplayLockCostEl.textContent = "…";
  void (async () => {
    const cost = await ensureShopCostCached(PORTAL_REPLAY_ITEM_ID);
    levelCompleteReplayLockCostEl.innerHTML = formatShopCostForExchangeLineHtml(cost);
  })();
}

async function warmShopPriceCache() {
  const base = normalizePortalApiBase(window.cmPortalApiBase || "");
  if (!base) return;
  if (!shopCatalogWarmPromise) {
    shopCatalogWarmPromise = (async () => {
      try {
        const res = await fetch(
          `${base}/api/games/shop/catalog?game_mode=${encodeURIComponent(PORTAL_UNDO_GAME_MODE)}`,
          { method: "GET" }
        );
        const json = await res.json().catch(() => null);
        if (!res.ok || json == null || json.success === false || !json.data || typeof json.data.items !== "object") {
          return;
        }
        for (const [id, row] of Object.entries(json.data.items)) {
          if (row && row.cost && typeof row.cost === "object") {
            shopPriceCache[id] = normalizePortalShopCost(row.cost);
          }
        }
      } catch (_) {}
    })();
  }
  await shopCatalogWarmPromise;
}

async function ensureShopCostCached(itemId) {
  if (shopPriceCache[itemId]) return shopPriceCache[itemId];
  const base = normalizePortalApiBase(window.cmPortalApiBase || "");
  if (!base) return getFallbackShopCost(itemId);

  await warmShopPriceCache();
  if (shopPriceCache[itemId]) return shopPriceCache[itemId];

  try {
    const res = await fetch(
      `${base}/api/games/shop/item?item_id=${encodeURIComponent(itemId)}&game_mode=${encodeURIComponent(PORTAL_UNDO_GAME_MODE)}`,
      { method: "GET" }
    );
    const json = await res.json().catch(() => null);
    if (res.ok && json && json.success !== false && json.data && json.data.cost && typeof json.data.cost === "object") {
      const c = normalizePortalShopCost(json.data.cost);
      shopPriceCache[itemId] = c;
      return c;
    }
  } catch (_) {}

  return getFallbackShopCost(itemId);
}

async function getPortalAssets() {
  const base = normalizePortalApiBase(window.cmPortalApiBase || "");
  if (!base) return null;
  try {
    const res = await fetch(`${base}/api/user/assets`, {
      credentials: "include",
      headers: {
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
  const base = normalizePortalApiBase(window.cmPortalApiBase || "");
  if (!base) return { ok: false, message: "Portal session not available." };
  const url = `${base}/api/user/shop/redeem?item_id=${encodeURIComponent(itemId)}&game_mode=${encodeURIComponent(PORTAL_UNDO_GAME_MODE)}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: {
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
  if (undoExchangeCostTextEl) undoExchangeCostTextEl.textContent = "…";
  setUndoExchangeMessage("");
  undoExchangeModal.classList.add("active");
  undoExchangeModal.setAttribute("aria-hidden", "false");
  setUndoExchangeBusy(false);
  const [, cost] = await Promise.all([
    refreshUndoExchangeAssetsDisplay(),
    ensureShopCostCached(PORTAL_UNDO_ITEM_ID)
  ]);
  if (undoExchangeCostTextEl) undoExchangeCostTextEl.innerHTML = formatShopCostForExchangeLineHtml(cost);
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
window.warmShopPriceCache = warmShopPriceCache;
queueMicrotask(() => {
  if (portalUndoShopAvailable()) void warmShopPriceCache();
});

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
  if (antigravityExchangeCostTextEl) antigravityExchangeCostTextEl.textContent = "…";
  setGenericExchangeMessage(antigravityExchangeMessageEl, "");
  antigravityExchangeModal.classList.add("active");
  antigravityExchangeModal.setAttribute("aria-hidden", "false");
  setAntigravityExchangeBusy(false);
  const [, cost] = await Promise.all([
    refreshAntigravityExchangeAssetsDisplay(),
    ensureShopCostCached(PORTAL_ANTIGRAVITY_ITEM_ID)
  ]);
  if (antigravityExchangeCostTextEl) antigravityExchangeCostTextEl.innerHTML = formatShopCostForExchangeLineHtml(cost);
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
  if (replayExchangeCostTextEl) replayExchangeCostTextEl.textContent = "…";
  setGenericExchangeMessage(replayExchangeMessageEl, "");
  replayExchangeModal.classList.add("active");
  replayExchangeModal.setAttribute("aria-hidden", "false");
  setReplayExchangeBusy(false);
  const [, cost] = await Promise.all([
    refreshReplayExchangeAssetsDisplay(),
    ensureShopCostCached(PORTAL_REPLAY_ITEM_ID)
  ]);
  if (replayExchangeCostTextEl) replayExchangeCostTextEl.innerHTML = formatShopCostForExchangeLineHtml(cost);
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
  closeHintModal();
  const onLevelComplete =
    levelCompleteModal && levelCompleteModal.classList.contains("active");
  if (!onLevelComplete) {
    openInGameWalkthroughModal();
  }
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

function setupInGameWalkthrough() {
  if (hintSolutionActionBtn) {
    hintSolutionActionBtn.addEventListener("click", () => {
      handleSolutionGuideAction();
    });
  }
  const closeWalkthrough = () => closeInGameWalkthroughModal();
  if (closeInGameWalkthroughModalBtn) {
    closeInGameWalkthroughModalBtn.addEventListener("click", closeWalkthrough);
  }
  if (inGameWalkthroughCloseBtn) {
    inGameWalkthroughCloseBtn.addEventListener("click", closeWalkthrough);
  }
  if (inGameWalkthroughModal) {
    inGameWalkthroughModal.addEventListener("click", (e) => {
      if (e.target === inGameWalkthroughModal) closeWalkthrough();
    });
  }
}

function setupHintModal() {
  if (blockTipToggle && blockTipModal) {
    blockTipToggle.addEventListener("click", () => {
      openHintModal();
    });
  }
  const closeBtn = document.getElementById("closeBlockTip");
  if (blockTipModal && closeBtn) {
    closeBtn.addEventListener("click", closeHintModal);
    blockTipModal.addEventListener("click", (e) => {
      if (e.target === blockTipModal) closeHintModal();
    });
  }
}

/**
 * game/03-audio-canvas-hud-replay.js
 * Audio, HUD, replay, objectives, lasers/platforms helpers
 * Split from game.monolith.js lines 1138-2757.
 */
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

function bindLevelCompleteUi() {
  try {
    const legacyNextBtn = document.getElementById('nextLevelBtn');
    if (legacyNextBtn) {
      const legacyContainer = legacyNextBtn.parentElement;
      legacyNextBtn.remove();
      if (legacyContainer && legacyContainer.children.length === 0) {
        legacyContainer.remove();
      }
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
}
// React mounts scripts after DOMContentLoaded; run now if document is already ready.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bindLevelCompleteUi);
} else {
  bindLevelCompleteUi();
}

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
  syncVisitedSquaresSize();
  
  // Resize canvas
  resizeCanvas();
  
  // Filter players and objectives that are still within bounds
  players = players.filter(player => 
    player.row < newRows && player.col < newCols
  );
  
  objectives = objectives.filter(obj => 
    obj.row < newRows && obj.col < newCols
  );

  targetPieces = targetPieces.filter(piece =>
    piece.row < newRows && piece.col < newCols
  );
  totalTargetPieces = targetPieces.length;
  targetPiecesCaptured = targetPieces.filter(piece => piece.captured).length;

  bombs = bombs.filter(bomb =>
    bomb.row < newRows && bomb.col < newCols
  );

  laserBlocks = laserBlocks.filter(laser =>
    laser.row < newRows && laser.col < newCols
  );

  ducks = ducks.filter(duck =>
    duck.row < newRows && duck.col < newCols
  );

  movingPlatforms = movingPlatforms
    .filter(platform => platform.row < newRows && platform.col < newCols)
    .map(normalizeMovingPlatformData);
  
  // Update goal if it's out of bounds
  if (goal && (goal.row >= newRows || goal.col >= newCols)) {
    goal = null;
  }
  
  // Update counts and redraw
  updatePlayerCount();
  updateObjectiveCount();
  updateTargetPieceCount();
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
  if (typeof window.cmEmitGameUi === "function") {
    window.cmEmitGameUi({ type: "playerCount", count: players.length });
  }
}

function updateMoveCountDisplay() {
  if (moveCountDisplay) {
    moveCountDisplay.textContent = `Your move: ${levelMoveCount}`;
  }
  if (typeof window.cmEmitGameUi === "function") {
    window.cmEmitGameUi({ type: "moveCount", levelMoveCount });
  }
  updateLevelCompleteStatsDisplay();
}

function updateLevelCompleteStatsDisplay() {
  if (levelCompleteMoveCountDisplay) {
    levelCompleteMoveCountDisplay.textContent = `Your move: ${levelMoveCount}`;
  }
  if (levelCompleteFewestOtherMovesDisplay) {
    levelCompleteFewestOtherMovesDisplay.textContent = Number.isFinite(fewestOtherMovesForLevel)
      ? `Others' best: ${fewestOtherMovesForLevel}`
      : "Others' best: --";
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
    targetPieces: cloneGameData(targetPieces),
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

function drawInactivePhaseBlock(renderCtx, x, y, tile, inset = 3) {
  const innerSize = tile - inset * 2;
  const arrowY = y + tile * 0.48;
  const stemWidth = Math.max(2, tile * 0.06);
  const stemHeight = Math.max(6, tile * 0.18);
  const headWidth = Math.max(8, tile * 0.22);
  const headHeight = Math.max(6, tile * 0.16);
  const arrowGap = Math.max(1, (innerSize - headWidth * 3) / 4);
  const firstArrowCenterX = x + inset + arrowGap + headWidth / 2;

  renderCtx.save();
  renderCtx.fillStyle = "rgba(52, 152, 219, 0.3)";
  renderCtx.fillRect(x + inset, y + inset, innerSize, innerSize);

  renderCtx.fillStyle = "rgba(25, 118, 210, 0.65)";
  for (let i = 0; i < 3; i++) {
    const centerX = firstArrowCenterX + i * (headWidth + arrowGap);
    const stemTop = arrowY;
    renderCtx.fillRect(centerX - stemWidth / 2, stemTop, stemWidth, stemHeight);
    renderCtx.beginPath();
    renderCtx.moveTo(centerX, stemTop - headHeight);
    renderCtx.lineTo(centerX - headWidth / 2, stemTop);
    renderCtx.lineTo(centerX + headWidth / 2, stemTop);
    renderCtx.closePath();
    renderCtx.fill();
  }

  renderCtx.strokeStyle = "rgba(25, 118, 210, 0.8)";
  renderCtx.lineWidth = Math.max(2, tile * 0.04);
  renderCtx.setLineDash([Math.max(4, tile * 0.1), Math.max(3, tile * 0.07)]);
  renderCtx.beginPath();
  renderCtx.moveTo(x + inset, y + tile - inset);
  renderCtx.lineTo(x + tile - inset, y + tile - inset);
  renderCtx.stroke();
  renderCtx.restore();
}

function getMovingPlatformAt(row, col) {
  return movingPlatforms.find(platform => platform.row === row && platform.col === col) || null;
}

function getMovingPlatformAxisAt(row, col) {
  const platform = getMovingPlatformAt(row, col);
  return platform && platform.axis === "horizontal" ? "horizontal" : "vertical";
}

function drawSomersaultCloudPlatform(renderCtx, x, y, tile) {
  const centerX = x + tile / 2;
  const centerY = y + tile * 0.54;

  function drawCloudSpiral(cx, cy, radius, turns = 1.8) {
    renderCtx.beginPath();
    const steps = 44;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = t * turns * Math.PI * 2;
      const r = radius * (1 - t);
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;
      if (i === 0) {
        renderCtx.moveTo(px, py);
      } else {
        renderCtx.lineTo(px, py);
      }
    }
    renderCtx.stroke();
  }

  renderCtx.save();
  renderCtx.shadowColor = "rgba(250, 204, 21, 0.48)";
  renderCtx.shadowBlur = Math.max(5, tile * 0.14);
  renderCtx.fillStyle = "#f7d45a";
  renderCtx.strokeStyle = "#9f7a2d";
  renderCtx.lineWidth = Math.max(2, tile * 0.04);
  renderCtx.beginPath();
  renderCtx.moveTo(x + tile * 0.07, y + tile * 0.68);
  renderCtx.bezierCurveTo(x + tile * 0.22, y + tile * 0.82, x + tile * 0.42, y + tile * 0.72, x + tile * 0.34, y + tile * 0.57);
  renderCtx.bezierCurveTo(x + tile * 0.12, y + tile * 0.62, x + tile * 0.07, y + tile * 0.38, x + tile * 0.23, y + tile * 0.25);
  renderCtx.bezierCurveTo(x + tile * 0.25, y + tile * 0.05, x + tile * 0.5, y + tile * 0.03, x + tile * 0.56, y + tile * 0.2);
  renderCtx.bezierCurveTo(x + tile * 0.72, y + tile * 0.11, x + tile * 0.91, y + tile * 0.27, x + tile * 0.82, y + tile * 0.49);
  renderCtx.bezierCurveTo(x + tile * 0.96, y + tile * 0.57, x + tile * 0.88, y + tile * 0.82, x + tile * 0.67, y + tile * 0.78);
  renderCtx.bezierCurveTo(x + tile * 0.57, y + tile * 0.95, x + tile * 0.34, y + tile * 0.86, x + tile * 0.43, y + tile * 0.73);
  renderCtx.bezierCurveTo(x + tile * 0.3, y + tile * 0.81, x + tile * 0.15, y + tile * 0.79, x + tile * 0.02, y + tile * 0.68);
  renderCtx.bezierCurveTo(x - tile * 0.12, y + tile * 0.57, x + tile * 0.05, y + tile * 0.62, x + tile * 0.07, y + tile * 0.68);
  renderCtx.closePath();
  renderCtx.fill();
  renderCtx.shadowBlur = 0;
  renderCtx.stroke();

  renderCtx.strokeStyle = "rgba(159, 122, 45, 0.82)";
  renderCtx.lineWidth = Math.max(1.5, tile * 0.035);
  renderCtx.lineCap = "round";
  renderCtx.lineJoin = "round";
  drawCloudSpiral(centerX - tile * 0.19, centerY + tile * 0.06, tile * 0.13, 1.75);
  drawCloudSpiral(centerX + tile * 0.04, centerY - tile * 0.16, tile * 0.15, 1.7);
  drawCloudSpiral(centerX + tile * 0.23, centerY + tile * 0.1, tile * 0.16, 1.8);

  renderCtx.strokeStyle = "rgba(159, 122, 45, 0.42)";
  renderCtx.lineWidth = Math.max(1, tile * 0.025);
  renderCtx.beginPath();
  renderCtx.moveTo(x + tile * 0.18, y + tile * 0.72);
  renderCtx.bezierCurveTo(x + tile * 0.31, y + tile * 0.76, x + tile * 0.43, y + tile * 0.74, x + tile * 0.53, y + tile * 0.67);
  renderCtx.stroke();

  renderCtx.restore();
}

function drawMovingPlatform(renderCtx, x, y, tile, axis = "vertical") {
  if (axis === "horizontal") {
    drawSomersaultCloudPlatform(renderCtx, x, y, tile);
    return;
  }

  const inset = Math.max(2, tile * 0.08);
  const width = tile - inset * 2;
  const height = Math.max(8, tile * 0.28);
  const platformY = y + tile * 0.52;

  renderCtx.save();
  renderCtx.fillStyle = "rgba(20, 184, 166, 0.78)";
  renderCtx.fillRect(x + inset, platformY, width, height);
  renderCtx.strokeStyle = "rgba(15, 118, 110, 0.95)";
  renderCtx.lineWidth = Math.max(2, tile * 0.04);
  renderCtx.strokeRect(x + inset, platformY, width, height);

  renderCtx.fillStyle = "rgba(250, 204, 21, 0.9)";
  renderCtx.beginPath();
  renderCtx.moveTo(x + tile * 0.5, y + tile * 0.2);
  renderCtx.lineTo(x + tile * 0.35, y + tile * 0.38);
  renderCtx.lineTo(x + tile * 0.65, y + tile * 0.38);
  renderCtx.closePath();
  renderCtx.fill();

  renderCtx.restore();
}

function drawDuck(renderCtx, duck, tile = TILE_SIZE) {
  const x = duck.col * tile;
  const y = duck.row * tile;
  const direction = duck.direction === -1 ? -1 : 1;

  renderCtx.save();
  renderCtx.translate(x + tile / 2, y + tile / 2);
  renderCtx.scale(direction, 1);
  renderCtx.fillStyle = "#facc15";
  renderCtx.strokeStyle = "#a16207";
  renderCtx.lineWidth = Math.max(1.5, tile * 0.035);

  renderCtx.beginPath();
  renderCtx.ellipse(-tile * 0.05, tile * 0.12, tile * 0.3, tile * 0.22, 0, 0, Math.PI * 2);
  renderCtx.fill();
  renderCtx.stroke();

  renderCtx.beginPath();
  renderCtx.arc(tile * 0.18, -tile * 0.1, tile * 0.17, 0, Math.PI * 2);
  renderCtx.fill();
  renderCtx.stroke();

  renderCtx.fillStyle = "#f97316";
  renderCtx.beginPath();
  renderCtx.moveTo(tile * 0.32, -tile * 0.1);
  renderCtx.lineTo(tile * 0.48, -tile * 0.02);
  renderCtx.lineTo(tile * 0.32, tile * 0.03);
  renderCtx.closePath();
  renderCtx.fill();

  renderCtx.fillStyle = "#111827";
  renderCtx.beginPath();
  renderCtx.arc(tile * 0.22, -tile * 0.14, Math.max(1.5, tile * 0.025), 0, Math.PI * 2);
  renderCtx.fill();

  renderCtx.fillStyle = "rgba(234, 179, 8, 0.9)";
  renderCtx.beginPath();
  renderCtx.ellipse(-tile * 0.12, tile * 0.09, tile * 0.14, tile * 0.09, -0.35, 0, Math.PI * 2);
  renderCtx.fill();
  renderCtx.restore();
}

function getTeleporterDoorRole(row, col, teleportType) {
  const sameColorTeleports = teleportBlocks
    .filter(tp => tp.type === teleportType)
    .slice()
    .sort((a, b) => (a.row - b.row) || (a.col - b.col));

  if (sameColorTeleports.length !== 2) return "in";
  const isFirst =
    sameColorTeleports[0].row === row &&
    sameColorTeleports[0].col === col;
  return isFirst ? "in" : "out";
}

function drawTeleporterDoor(renderCtx, x, y, tile, teleportType, role = "in") {
  const color = TELEPORT_COLORS[teleportType];
  const doorColor = TELEPORT_DOOR_COLORS[teleportType];
  if (!color || !doorColor) return;

  const frameX = x + tile * 0.22;
  const frameY = y + tile * 0.1;
  const frameW = tile * 0.56;
  const frameH = tile * 0.8;
  const gapLeft = frameX + frameW * 0.08;
  const gapRight = frameX + frameW * 0.42;
  const slabLeft = frameX + frameW * 0.5;
  const slabTop = frameY + frameH * 0.04;
  const slabBottom = frameY + frameH * 0.96;
  const slabRightTop = frameX + frameW * 1.02;
  const slabRightBottom = frameX + frameW * 0.82;

  renderCtx.save();

  renderCtx.fillStyle = "rgba(15, 23, 42, 0.35)";
  renderCtx.beginPath();
  renderCtx.ellipse(x + tile / 2, y + tile * 0.9, tile * 0.31, tile * 0.06, 0, 0, Math.PI * 2);
  renderCtx.fill();

  // Teleporter color stays as light leaking from the opening, so the
  // object can look like a real wooden door while still showing its pair.
  renderCtx.fillStyle = doorColor.glow;
  renderCtx.globalAlpha = 1;
  renderCtx.fillRect(gapLeft, frameY + frameH * 0.08, gapRight - gapLeft, frameH * 0.82);

  // Doorway darkness visible through the half-open gap.
  renderCtx.fillStyle = "rgba(12, 8, 7, 0.86)";
  renderCtx.fillRect(gapLeft, frameY + frameH * 0.06, gapRight - gapLeft, frameH * 0.88);

  // Colored wooden frame matching the teleporter type.
  renderCtx.strokeStyle = doorColor.dark;
  renderCtx.lineWidth = Math.max(3, tile * 0.07);
  renderCtx.strokeRect(frameX, frameY, frameW, frameH);
  renderCtx.strokeStyle = doorColor.edge;
  renderCtx.lineWidth = Math.max(1, tile * 0.02);
  renderCtx.strokeRect(frameX + tile * 0.02, frameY + tile * 0.02, frameW - tile * 0.04, frameH - tile * 0.04);

  // Half-open colored wood slab, perspective skewed like the reference photo.
  renderCtx.fillStyle = doorColor.door;
  renderCtx.beginPath();
  renderCtx.moveTo(slabLeft, slabTop);
  renderCtx.lineTo(slabRightTop, frameY + frameH * 0.12);
  renderCtx.lineTo(slabRightBottom, slabBottom);
  renderCtx.lineTo(slabLeft, frameY + frameH * 0.9);
  renderCtx.closePath();
  renderCtx.fill();
  renderCtx.strokeStyle = doorColor.dark;
  renderCtx.lineWidth = Math.max(1.5, tile * 0.035);
  renderCtx.stroke();

  // Wood panels.
  renderCtx.strokeStyle = "rgba(255, 255, 255, 0.28)";
  renderCtx.lineWidth = Math.max(1, tile * 0.018);
  const panelLeft = slabLeft + frameW * 0.08;
  const panelRightTop = slabRightTop - frameW * 0.1;
  const panelRightBottom = slabRightBottom - frameW * 0.1;
  renderCtx.beginPath();
  renderCtx.moveTo(panelLeft, frameY + frameH * 0.2);
  renderCtx.lineTo(panelRightTop, frameY + frameH * 0.25);
  renderCtx.moveTo(panelLeft, frameY + frameH * 0.45);
  renderCtx.lineTo(panelRightTop - frameW * 0.03, frameY + frameH * 0.48);
  renderCtx.moveTo(panelLeft, frameY + frameH * 0.7);
  renderCtx.lineTo(panelRightBottom, frameY + frameH * 0.7);
  renderCtx.stroke();

  // Teleporter-colored rim light along the opening.
  renderCtx.strokeStyle = doorColor.edge;
  renderCtx.lineWidth = Math.max(1.5, tile * 0.035);
  renderCtx.beginPath();
  renderCtx.moveTo(gapRight, frameY + frameH * 0.1);
  renderCtx.lineTo(gapRight, frameY + frameH * 0.88);
  renderCtx.stroke();

  // Handle and lock plate.
  renderCtx.fillStyle = "#1f2937";
  renderCtx.fillRect(slabLeft + frameW * 0.12, frameY + frameH * 0.48, frameW * 0.08, frameH * 0.18);
  renderCtx.fillStyle = "#d1d5db";
  renderCtx.beginPath();
  renderCtx.arc(slabLeft + frameW * 0.2, frameY + frameH * 0.57, Math.max(1.5, tile * 0.028), 0, Math.PI * 2);
  renderCtx.fill();

  // White arrow inside the door gap:
  // "in" points into the doorway; "out" points out of the doorway.
  const arrowY = frameY + frameH * 0.58;
  const arrowStartX = role === "out" ? gapRight - frameW * 0.01 : gapLeft + frameW * 0.01;
  const arrowEndX = role === "out" ? gapLeft + frameW * 0.01 : gapRight - frameW * 0.01;
  const arrowDir = arrowEndX > arrowStartX ? 1 : -1;
  const headSize = Math.max(5, tile * 0.12);

  renderCtx.strokeStyle = "rgba(0, 0, 0, 0.55)";
  renderCtx.fillStyle = "rgba(0, 0, 0, 0.55)";
  renderCtx.lineWidth = Math.max(4, tile * 0.08);
  renderCtx.lineCap = "round";
  renderCtx.beginPath();
  renderCtx.moveTo(arrowStartX, arrowY);
  renderCtx.lineTo(arrowEndX - arrowDir * headSize * 0.55, arrowY);
  renderCtx.stroke();
  renderCtx.beginPath();
  renderCtx.moveTo(arrowEndX, arrowY);
  renderCtx.lineTo(arrowEndX - arrowDir * headSize, arrowY - headSize * 0.6);
  renderCtx.lineTo(arrowEndX - arrowDir * headSize, arrowY + headSize * 0.6);
  renderCtx.closePath();
  renderCtx.fill();

  renderCtx.strokeStyle = "#ffffff";
  renderCtx.fillStyle = "#ffffff";
  renderCtx.lineWidth = Math.max(2.5, tile * 0.055);
  renderCtx.lineCap = "round";
  renderCtx.beginPath();
  renderCtx.moveTo(arrowStartX, arrowY);
  renderCtx.lineTo(arrowEndX - arrowDir * headSize * 0.55, arrowY);
  renderCtx.stroke();
  renderCtx.beginPath();
  renderCtx.moveTo(arrowEndX, arrowY);
  renderCtx.lineTo(arrowEndX - arrowDir * headSize, arrowY - headSize * 0.6);
  renderCtx.lineTo(arrowEndX - arrowDir * headSize, arrowY + headSize * 0.6);
  renderCtx.closePath();
  renderCtx.fill();

  renderCtx.restore();
}

function drawPlatformLevelGuide() {
  if (!CM_EDITOR_PAGE || mode !== "edit") return;

  ctx.save();
  ctx.fillStyle = "rgba(15, 23, 42, 0.72)";
  ctx.font = "bold 18px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let r = 0; r < ROWS; r++) {
    const level = rowToPlatformLevel(r);
    const y = r * TILE_SIZE + TILE_SIZE / 2;
    ctx.fillText(String(level), TILE_SIZE * 0.24, y);
  }

  ctx.font = "bold 14px Arial";
  for (let c = 0; c < COLS; c++) {
    const x = c * TILE_SIZE + TILE_SIZE / 2;
    ctx.fillText(String(c), x, TILE_SIZE * 0.22);
  }

  ctx.restore();
}

function drawReplayCellDecoration(replayCtx, cellType, x, y, tile, row = null, col = null, targetPiecesData = []) {
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
    drawInactivePhaseBlock(replayCtx, x, y, tile, inset);
    return;
  }

  if (cellType === CELL_TYPES.PHASE_BLOCK_ACTIVE) {
    replayCtx.fillStyle = "rgba(41, 128, 185, 0.8)";
    replayCtx.fillRect(x + inset, y + inset, innerSize, innerSize);
    return;
  }

  if (cellType === CELL_TYPES.MOVING_PLATFORM) {
    drawMovingPlatform(replayCtx, x, y, tile);
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
    drawTeleporterDoor(replayCtx, x, y, tile, cellType, "in");
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
    if (pieceType === "castle_rook") {
      drawCastleRookMarker(replayCtx, x, y, tile);
    }
    return;
  }

  if (cellType === CELL_TYPES.BLACK_TARGET_PIECE) {
    const targetPiece = Array.isArray(targetPiecesData)
      ? targetPiecesData.find(piece => !piece.captured && piece.row === row && piece.col === col)
      : null;
    drawBlackTargetPiece(replayCtx, x, y, tile, targetPiece ? targetPiece.pieceType : "pawn");
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
  if (pieceType === "castle_rook") {
    drawCastleRookMarker(replayCtx, x, y, tile);
  }
}

function drawBlackTargetPiece(renderCtx, x, y, tile, pieceType) {
  const pad = Math.max(1, Math.floor(tile * 0.13));
  const img = targetPieceImages[pieceType] || targetPieceImages.pawn;

  renderCtx.save();
  renderCtx.fillStyle = "rgba(17, 24, 39, 0.18)";
  renderCtx.beginPath();
  renderCtx.arc(x + tile / 2, y + tile / 2, tile * 0.42, 0, Math.PI * 2);
  renderCtx.fill();

  if (img && img.complete) {
    renderCtx.drawImage(img, x + pad, y + pad, tile - pad * 2, tile - pad * 2);
  } else {
    renderCtx.fillStyle = "#111827";
    renderCtx.textAlign = "center";
    renderCtx.textBaseline = "middle";
    renderCtx.font = `700 ${Math.max(10, Math.floor(tile * 0.44))}px Arial`;
    renderCtx.fillText(String(pieceType || "P").charAt(0).toUpperCase(), x + tile / 2, y + tile / 2);
  }

  renderCtx.strokeStyle = "rgba(255, 255, 255, 0.75)";
  renderCtx.lineWidth = Math.max(1, tile * 0.035);
  renderCtx.beginPath();
  renderCtx.arc(x + tile / 2, y + tile / 2, tile * 0.42, 0, Math.PI * 2);
  renderCtx.stroke();
  renderCtx.restore();
}

function drawCastleRookMarker(renderCtx, x, y, size) {
  const radius = Math.max(4, size * 0.14);
  const centerX = x + size * 0.76;
  const centerY = y + size * 0.24;

  renderCtx.save();
  renderCtx.fillStyle = "rgba(245, 158, 11, 0.95)";
  renderCtx.beginPath();
  renderCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  renderCtx.fill();
  renderCtx.strokeStyle = "rgba(255, 255, 255, 0.95)";
  renderCtx.lineWidth = Math.max(1, size * 0.035);
  renderCtx.beginPath();
  renderCtx.moveTo(centerX - radius * 0.45, centerY);
  renderCtx.lineTo(centerX - radius * 0.08, centerY + radius * 0.38);
  renderCtx.lineTo(centerX + radius * 0.55, centerY - radius * 0.45);
  renderCtx.stroke();
  renderCtx.restore();
}

function drawReplaySnapshotOnCanvas(index, canvasEl, stepEl, eventEl) {
  if (!canvasEl || !fewestOtherMovesReplayPath || !fewestOtherMovesReplayPath.length) return;
  const replayCtx = canvasEl.getContext("2d");
  if (!replayCtx) return;

  const safeIndex = Math.max(0, Math.min(index, fewestOtherMovesReplayPath.length - 1));
  levelCompleteReplayIndex = safeIndex;
  const snapshot = fewestOtherMovesReplayPath[safeIndex];
  const rows = Number(snapshot.rows) || 1;
  const cols = Number(snapshot.cols) || 1;
  const boardData = Array.isArray(snapshot.board) ? snapshot.board : [];
  const playersData = Array.isArray(snapshot.players) ? snapshot.players : [];
  const targetPiecesData = Array.isArray(snapshot.targetPieces) ? snapshot.targetPieces : [];

  const cw = canvasEl.width;
  const ch = canvasEl.height;
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
      drawReplayCellDecoration(replayCtx, cellType, x, y, tile, r, c, targetPiecesData);
    }
  }

  for (const p of playersData) {
    if (!p || !Number.isFinite(p.row) || !Number.isFinite(p.col)) continue;
    drawReplayPlayerPiece(replayCtx, p.pieceType, p.row, p.col, ox, oy, tile);
  }

  if (stepEl) {
    const logicalStep = fewestOtherMovesReplayStepNumbers[safeIndex] || 0;
    const totalLogicalSteps = Number.isFinite(fewestOtherMovesForLevel)
      ? fewestOtherMovesForLevel
      : (fewestOtherMovesReplayStepNumbers.length ? Math.max(...fewestOtherMovesReplayStepNumbers) : 0);
    stepEl.textContent = `Step: ${logicalStep}/${totalLogicalSteps}`;
  }
  if (eventEl) {
    const moveMeta = snapshot && snapshot.move ? snapshot.move : null;
    if (moveMeta && moveMeta.antigravityApplied) {
      eventEl.textContent = "Antigravity used on this step.";
    } else {
      eventEl.textContent = "";
    }
  }
}

function drawLevelCompleteReplaySnapshot(index) {
  drawReplaySnapshotOnCanvas(
    index,
    levelCompleteReplayCanvas,
    levelCompleteReplayStep,
    levelCompleteReplayEvent
  );
}

function drawInGameWalkthroughSnapshot(index) {
  drawReplaySnapshotOnCanvas(
    index,
    inGameWalkthroughCanvas,
    inGameWalkthroughStep,
    inGameWalkthroughEvent
  );
}

function stepReplayNavigation(action) {
  const walkthroughModalActive =
    inGameWalkthroughModal && inGameWalkthroughModal.classList.contains("active");
  const levelCompleteModalActive =
    levelCompleteModal && levelCompleteModal.classList.contains("active");
  if (!fewestOtherMovesReplayPath || !fewestOtherMovesReplayPath.length) return;
  if (levelCompleteModalActive && !replayUnlockedForLevel) return;

  const maxIndex = fewestOtherMovesReplayPath.length - 1;
  let nextIndex = levelCompleteReplayIndex;
  if (action === "prev") nextIndex = levelCompleteReplayIndex - 1;
  else if (action === "next") nextIndex = levelCompleteReplayIndex + 1;
  else if (action === "first") nextIndex = 0;
  else if (action === "last") nextIndex = maxIndex;
  else return;

  if (walkthroughModalActive) {
    drawInGameWalkthroughSnapshot(nextIndex);
  } else if (levelCompleteModalActive) {
    drawLevelCompleteReplaySnapshot(nextIndex);
  }
}

function setReplayStepNavVisible(navEl, visible) {
  if (!navEl) return;
  navEl.style.display = visible ? "grid" : "none";
}

function setupReplayStepNav() {
  document.querySelectorAll("[data-replay-step]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      stepReplayNavigation(btn.getAttribute("data-replay-step"));
    });
  });
}

function updateHintSolutionSection() {
  const hasBenchmark = Number.isFinite(fewestOtherMovesForLevel);
  const hasReplay = !!(fewestOtherMovesReplayPath && fewestOtherMovesReplayPath.length >= 2);
  const shopAvailable = portalUndoShopAvailable();

  if (fewestOtherMovesDisplay) {
    fewestOtherMovesDisplay.textContent = hasBenchmark
      ? `Others' best: ${fewestOtherMovesForLevel}`
      : "Others' best: --";
  }

  if (blockTipToggle) {
    blockTipToggle.classList.toggle(
      "hint-toggle--notify",
      hasBenchmark && !replayUnlockedForLevel
    );
    blockTipToggle.title = hasBenchmark && !replayUnlockedForLevel
      ? "Hint — solution guide available to unlock"
      : "Level tips and solution guide";
  }

  if (!hintSolutionSummary || !hintSolutionActionBtn) return;

  if (!hasBenchmark) {
    hintSolutionSummary.textContent = "No other player has cleared this level yet.";
    hintSolutionActionBtn.style.display = "none";
    hintSolutionActionBtn.disabled = true;
    if (hintSolutionNote) hintSolutionNote.textContent = "Check back after someone else completes this level.";
    return;
  }

  const shownName =
    fewestOtherMovesUserName && String(fewestOtherMovesUserName).trim()
      ? String(fewestOtherMovesUserName).trim()
      : "another player";
  hintSolutionSummary.textContent = `Best route by ${shownName}: ${fewestOtherMovesForLevel} moves`;

  if (!replayUnlockedForLevel) {
    hintSolutionActionBtn.style.display = "inline-block";
    hintSolutionActionBtn.textContent = "Unlock guide";
    hintSolutionActionBtn.disabled = !shopAvailable;
    if (hintSolutionNote) {
      hintSolutionNote.textContent = shopAvailable
        ? "Watch their route step by step after unlocking."
        : "Unlock is not available in this environment (Portal shop required).";
    }
    return;
  }

  hintSolutionActionBtn.style.display = "inline-block";
  hintSolutionActionBtn.textContent = "View guide";
  hintSolutionActionBtn.disabled = !hasReplay;
  if (hintSolutionNote) {
    hintSolutionNote.textContent = hasReplay
      ? "Opens an interactive walkthrough you can step through."
      : "Route data is not available yet for this level.";
  }
}

function refreshFewestOtherMovesAffordance() {
  if (CM_EDITOR_PAGE) return;
  updateHintSolutionSection();
}

function closeHintModal() {
  if (!blockTipModal) return;
  blockTipModal.classList.remove("active");
  blockTipModal.setAttribute("aria-hidden", "true");
}

function openHintModal() {
  if (!blockTipModal) return;
  updateHintSolutionSection();
  blockTipModal.classList.add("active");
  blockTipModal.setAttribute("aria-hidden", "false");
}

function handleSolutionGuideAction() {
  if (CM_EDITOR_PAGE) return;

  if (!Number.isFinite(fewestOtherMovesForLevel)) {
    return;
  }
  if (!replayUnlockedForLevel) {
    closeHintModal();
    openReplayExchangeModal();
    return;
  }
  if (!fewestOtherMovesReplayPath || fewestOtherMovesReplayPath.length < 2) {
    return;
  }
  closeHintModal();
  openInGameWalkthroughModal();
}

function updateInGameWalkthroughPanel() {
  const hasName = !!(fewestOtherMovesUserName && String(fewestOtherMovesUserName).trim());
  const shownName = hasName ? String(fewestOtherMovesUserName).trim() : "Unknown";
  if (inGameWalkthroughTitle) {
    inGameWalkthroughTitle.textContent = `Best Route by ${shownName}`;
  }
  if (inGameWalkthroughSubtitle && Number.isFinite(fewestOtherMovesForLevel)) {
    inGameWalkthroughSubtitle.textContent = `Fewest moves: ${fewestOtherMovesForLevel}`;
  }
  if (inGameWalkthroughCanvas) inGameWalkthroughCanvas.style.display = "block";
  if (inGameWalkthroughHint) inGameWalkthroughHint.style.display = "block";
  if (inGameWalkthroughStep) inGameWalkthroughStep.style.display = "block";
  if (inGameWalkthroughEvent) inGameWalkthroughEvent.style.display = "block";
  setReplayStepNavVisible(inGameReplayStepNav, true);
}

function openInGameWalkthroughModal() {
  if (!inGameWalkthroughModal) return;
  if (!fewestOtherMovesReplayPath || fewestOtherMovesReplayPath.length < 2) {
    updateStatus("Walkthrough path is not available yet for this level.");
    return;
  }
  levelCompleteReplayIndex = 0;
  updateInGameWalkthroughPanel();
  drawInGameWalkthroughSnapshot(0);
  inGameWalkthroughModal.classList.add("active");
  inGameWalkthroughModal.setAttribute("aria-hidden", "false");
}

function closeInGameWalkthroughModal() {
  if (!inGameWalkthroughModal) return;
  inGameWalkthroughModal.classList.remove("active");
  inGameWalkthroughModal.setAttribute("aria-hidden", "true");
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
    setReplayStepNavVisible(levelCompleteReplayStepNav, false);
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
    setReplayStepNavVisible(levelCompleteReplayStepNav, false);
    if (levelCompleteReplayEvent) levelCompleteReplayEvent.style.display = "block";
    if (levelCompleteReplayLock) levelCompleteReplayLock.style.display = "flex";
    refreshLevelCompleteReplayLockCostEl();
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
    setReplayStepNavVisible(levelCompleteReplayStepNav, false);
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
  setReplayStepNavVisible(levelCompleteReplayStepNav, true);
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
  refreshFewestOtherMovesAffordance();
  updateLevelCompleteStatsDisplay();
  updateLevelCompleteReplayDisplay();
  if (typeof window.cmEmitGameUi === "function") {
    window.cmEmitGameUi({
      type: "fewestOtherMoves",
      bestMoves: fewestOtherMovesForLevel,
      userName: fewestOtherMovesUserName,
      replayUnlocked: replayUnlockedForLevel,
    });
  }
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
  if (typeof window.cmEmitGameUi === "function") {
    window.cmEmitGameUi({
      type: "objectiveCount",
      completed,
      totalObjectives,
    });
  }
}

function updateTargetPieceCount() {
  if (!targetPieceCount) return;
  const captured = targetPieces.filter(piece => piece.captured).length;
  targetPieceCount.textContent = `Target Pieces: ${captured}/${totalTargetPieces}`;
  if (typeof window.cmEmitGameUi === "function") {
    window.cmEmitGameUi({
      type: "targetPieceCount",
      captured,
      totalTargetPieces,
    });
  }
}

function getUnlockProgressText() {
  return `Objectives ${objectivesCompleted}/${totalObjectives}, Target Pieces ${targetPiecesCaptured}/${totalTargetPieces}`;
}

// Check if all objectives are completed
function areAllObjectivesCompleted() {
  return objectivesCompleted >= totalObjectives && targetPiecesCaptured >= totalTargetPieces;
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

function getObjectiveCellTypeAt(row, col) {
  const objective = objectives.find(obj => obj.row === row && obj.col === col);
  if (!objective) return CELL_TYPES.EMPTY;
  return objective.completed ? CELL_TYPES.OBJECTIVE_COMPLETED : CELL_TYPES.OBJECTIVE;
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

function getTargetPieceAt(row, col) {
  return targetPieces.findIndex(piece =>
    !piece.captured &&
    piece.row === row &&
    piece.col === col
  );
}

function removeTargetPieceAt(row, col) {
  const index = targetPieces.findIndex(piece => piece.row === row && piece.col === col);
  if (index !== -1) {
    targetPieces.splice(index, 1);
    totalTargetPieces = targetPieces.length;
    targetPiecesCaptured = targetPieces.filter(piece => piece.captured).length;
    updateTargetPieceCount();
  }
}

function completeTargetPiece(row, col) {
  const targetIndex = getTargetPieceAt(row, col);
  if (targetIndex === -1) return false;

  targetPieces[targetIndex].captured = true;
  targetPiecesCaptured++;
  board[row][col] = CELL_TYPES.EMPTY;
  updateTargetPieceCount();
  updateStatus(`Target piece captured! ${targetPiecesCaptured}/${totalTargetPieces}`);
  return true;
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

function createBoomBomb(row, col, type) {
  const isLeftDiagonal = type === "boom_left";
  return {
    row,
    col,
    type,
    rowDirection: 1,
    colDirection: isLeftDiagonal ? -1 : 1
  };
}

function normalizeBombData(bomb) {
  if (bomb.type === "boom_right" || bomb.type === "boom_left") {
    const defaultBoom = createBoomBomb(bomb.row, bomb.col, bomb.type);
    return {
      row: bomb.row,
      col: bomb.col,
      type: bomb.type,
      rowDirection: bomb.rowDirection || defaultBoom.rowDirection,
      colDirection: bomb.colDirection || defaultBoom.colDirection
    };
  }

  return {
    row: bomb.row,
    col: bomb.col,
    direction: bomb.direction || 1
  };
}

function normalizeDuckData(duck) {
  return {
    row: Number.parseInt(duck.row, 10),
    col: Number.parseInt(duck.col, 10),
    direction: duck.direction === -1 ? -1 : 1
  };
}

function normalizeTargetPieceData(piece) {
  const allowedTypes = ["rook", "bishop", "queen", "knight", "king", "pawn"];
  const pieceType = allowedTypes.includes(piece.pieceType) ? piece.pieceType : "pawn";
  return {
    row: Number.parseInt(piece.row, 10),
    col: Number.parseInt(piece.col, 10),
    pieceType,
    captured: !!piece.captured
  };
}

function normalizeLaserDirections(directions) {
  if (!Array.isArray(directions)) return DEFAULT_LASER_DIRECTIONS.slice();
  const validDirections = directions.filter(direction => DEFAULT_LASER_DIRECTIONS.includes(direction));
  return [...new Set(validDirections)];
}

function normalizeLaserFireEverySteps(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_LASER_FIRE_EVERY_STEPS;
  return Math.max(2, Math.min(99, parsed));
}

function getLaserFireEverySteps(laser) {
  return normalizeLaserFireEverySteps(laser && laser.fireEverySteps);
}

function normalizeLaserBlockData(laser) {
  return {
    row: Number.parseInt(laser.row, 10),
    col: Number.parseInt(laser.col, 10),
    directions: normalizeLaserDirections(laser.directions),
    fireEverySteps: normalizeLaserFireEverySteps(laser.fireEverySteps)
  };
}

function getDuckAt(row, col) {
  return ducks.findIndex(duck => duck.row === row && duck.col === col);
}

function isBoomPieceType(pieceType) {
  return pieceType === "boom_right" || pieceType === "boom_left";
}

function isBoomBomb(bomb) {
  return isBoomPieceType(bomb.type);
}

function isLaserBlockAt(row, col) {
  return laserBlocks.some(laser => laser.row === row && laser.col === col);
}

function removeLaserBlockAt(row, col) {
  const index = laserBlocks.findIndex(laser => laser.row === row && laser.col === col);
  if (index !== -1) {
    laserBlocks.splice(index, 1);
  }
}

function addLaserBlock(row, col, directions = DEFAULT_LASER_DIRECTIONS, fireEverySteps = DEFAULT_LASER_FIRE_EVERY_STEPS) {
  const normalizedDirections = normalizeLaserDirections(directions);
  const normalizedFireEverySteps = normalizeLaserFireEverySteps(fireEverySteps);
  const existing = laserBlocks.find(laser => laser.row === row && laser.col === col);
  if (existing) {
    existing.directions = normalizedDirections;
    existing.fireEverySteps = normalizedFireEverySteps;
    return;
  }

  if (!isLaserBlockAt(row, col)) {
    laserBlocks.push({ row, col, directions: normalizedDirections, fireEverySteps: normalizedFireEverySteps });
  }
}

function isLaserBlockingCell(row, col) {
  return board[row][col] === CELL_TYPES.SOLID_BLOCK ||
    board[row][col] === CELL_TYPES.PHASE_BLOCK_ACTIVE ||
    board[row][col] === CELL_TYPES.MOVING_PLATFORM;
}

function isLaserActive(laser, moveNumber = levelMoveCount) {
  const fireEverySteps = getLaserFireEverySteps(laser);
  return moveNumber > 0 && moveNumber % fireEverySteps === 0;
}

function getLaserCountdown(laser, moveNumber = levelMoveCount) {
  const fireEverySteps = getLaserFireEverySteps(laser);
  if (moveNumber > 0 && moveNumber % fireEverySteps === 0) {
    return 0;
  }
  return fireEverySteps - (moveNumber % fireEverySteps);
}

function getLaserDirections(laser) {
  const enabledDirections = normalizeLaserDirections(laser.directions);
  return LASER_DIRECTIONS.filter(direction => enabledDirections.includes(direction.name));
}

function getLaserCellsFromBlock(laser) {
  const cells = [];
  for (const direction of getLaserDirections(laser)) {
    let row = laser.row + direction.dr;
    let col = laser.col + direction.dc;
    while (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
      if (isLaserBlockingCell(row, col)) break;
      cells.push({ row, col, direction: direction.name });
      row += direction.dr;
      col += direction.dc;
    }
  }
  return cells;
}

function isCellInActiveLaser(row, col) {
  return laserBlocks.some(laser =>
    isLaserActive(laser) &&
    getLaserCellsFromBlock(laser).some(cell => cell.row === row && cell.col === col)
  );
}

function getMoveTraversalCells(fromRow, fromCol, toRow, toCol) {
  const rowDelta = toRow - fromRow;
  const colDelta = toCol - fromCol;
  const rowStep = Math.sign(rowDelta);
  const colStep = Math.sign(colDelta);
  const straightOrDiagonal =
    fromRow === toRow ||
    fromCol === toCol ||
    Math.abs(rowDelta) === Math.abs(colDelta);

  if (!straightOrDiagonal) {
    return [{ row: toRow, col: toCol }];
  }

  const steps = Math.max(Math.abs(rowDelta), Math.abs(colDelta));
  const cells = [];
  for (let i = 1; i <= steps; i++) {
    cells.push({
      row: fromRow + rowStep * i,
      col: fromCol + colStep * i
    });
  }
  return cells;
}

function getActiveLaserHitOnMove(player, toRow, toCol) {
  return getMoveTraversalCells(player.row, player.col, toRow, toCol)
    .find(cell => isCellInActiveLaser(cell.row, cell.col)) || null;
}

function clampPlatformLevel(level) {
  const parsed = Number.parseInt(level, 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(ROWS - 1, parsed));
}

function rowToPlatformLevel(row) {
  return clampPlatformLevel(ROWS - 1 - row);
}

function platformLevelToRow(level) {
  return ROWS - 1 - clampPlatformLevel(level);
}

function clampPlatformCol(col) {
  const parsed = Number.parseInt(col, 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(COLS - 1, parsed));
}

function normalizeMovingPlatformData(platform) {
  const axis = platform.axis === "horizontal" ? "horizontal" : "vertical";
  if (axis === "horizontal") {
    const currentCol = platform.currentCol !== undefined
      ? clampPlatformCol(platform.currentCol)
      : clampPlatformCol(platform.col);
    const minCol = clampPlatformCol(platform.minCol !== undefined ? platform.minCol : 0);
    const maxCol = clampPlatformCol(platform.maxCol !== undefined ? platform.maxCol : COLS - 1);
    const low = Math.min(minCol, maxCol);
    const high = Math.max(minCol, maxCol);

    return {
      axis: "horizontal",
      row: platform.row,
      col: platform.col !== undefined ? platform.col : currentCol,
      minCol: low,
      maxCol: high,
      currentCol: Math.max(low, Math.min(high, currentCol)),
      direction: platform.direction === -1 ? -1 : 1
    };
  }

  const currentLevel = platform.currentLevel !== undefined
    ? clampPlatformLevel(platform.currentLevel)
    : rowToPlatformLevel(platform.row);
  const minLevel = clampPlatformLevel(platform.minLevel !== undefined ? platform.minLevel : 0);
  const maxLevel = clampPlatformLevel(platform.maxLevel !== undefined ? platform.maxLevel : ROWS - 1);
  const low = Math.min(minLevel, maxLevel);
  const high = Math.max(minLevel, maxLevel);

  return {
    row: platform.row !== undefined ? platform.row : platformLevelToRow(currentLevel),
    col: platform.col,
    minLevel: low,
    maxLevel: high,
    currentLevel: Math.max(low, Math.min(high, currentLevel)),
    direction: platform.direction === -1 ? -1 : 1
  };
}

// Deferred from monolith ~1127-1135 (must run after openHintModal / setupReplayStepNav exist).
setupAntigravityExchangeModal();
setupReplayExchangeModal();
setupInGameWalkthrough();
setupReplayStepNav();
setupHintModal();
window.openAntigravityExchangeModal = openAntigravityExchangeModal;
window.openReplayExchangeModal = openReplayExchangeModal;
window.handleSolutionGuideAction = handleSolutionGuideAction;
window.openInGameWalkthroughModal = openInGameWalkthroughModal;
window.openHintModal = openHintModal;


/**
 * game/04-level-rules.js
 * loadPuzzle, gravity, moves, win, undo, teleport, transformer
 * Split from game.monolith.js lines 2758-4121.
 */
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
    
    bombs = [];
    if (Array.isArray(puzzleData.bombs)) {
      bombs = puzzleData.bombs
        .filter(b => b.row < loadedRows && b.col < loadedCols)
        .map(normalizeBombData);
    }

    laserBlocks = [];
    if (Array.isArray(puzzleData.laserBlocks)) {
      laserBlocks = puzzleData.laserBlocks
        .map(normalizeLaserBlockData)
        .filter(laser =>
          Number.isFinite(laser.row) &&
          Number.isFinite(laser.col) &&
          laser.row >= 0 &&
          laser.row < loadedRows &&
          laser.col >= 0 &&
          laser.col < loadedCols
        );
    }

    ducks = [];
    if (Array.isArray(puzzleData.ducks)) {
      ducks = puzzleData.ducks
        .map(normalizeDuckData)
        .filter(duck =>
          Number.isFinite(duck.row) &&
          Number.isFinite(duck.col) &&
          duck.row >= 0 &&
          duck.row < loadedRows &&
          duck.col >= 0 &&
          duck.col < loadedCols
        );
    }

    movingPlatforms = [];
    if (Array.isArray(puzzleData.movingPlatforms)) {
      movingPlatforms = puzzleData.movingPlatforms
        .filter(platform => platform.row < loadedRows && platform.col < loadedCols)
        .map(normalizeMovingPlatformData);
    }

    // Recreate players (filter out ones that don't fit)
    players = [];
    if (puzzleData.players && Array.isArray(puzzleData.players)) {
      puzzleData.players
        .filter(player => player.row < loadedRows && player.col < loadedCols)
        .forEach(player => {
          const pieceType = player.pieceType || "rook";
          if (isBoomPieceType(pieceType)) {
            bombs.push(createBoomBomb(player.row, player.col, pieceType));
            board[player.row][player.col] = CELL_TYPES.BOMB;
            return;
          }

          players.push({
            row: player.row,
            col: player.col,
            pieceType,
            hasMoved: !!player.hasMoved
          });
        });
    }
    for (const b of bombs) {
      board[b.row][b.col] = CELL_TYPES.BOMB;
    }
    for (const laser of laserBlocks) {
      board[laser.row][laser.col] = CELL_TYPES.SOLID_BLOCK;
    }
    for (const platform of movingPlatforms) {
      if (platform.axis === "horizontal") {
        platform.col = clampPlatformCol(platform.currentCol);
      } else {
        platform.row = platformLevelToRow(platform.currentLevel);
      }
      board[platform.row][platform.col] = CELL_TYPES.MOVING_PLATFORM;
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
      totalObjectives = objectives.length;
      objectivesCompleted = objectives.filter(obj => obj.completed).length;
    } else {
      objectives = [];
      totalObjectives = 0;
      objectivesCompleted = 0;
    }

    targetPieces = [];
    if (Array.isArray(puzzleData.targetPieces)) {
      targetPieces = puzzleData.targetPieces
        .map(normalizeTargetPieceData)
        .filter(piece =>
          Number.isFinite(piece.row) &&
          Number.isFinite(piece.col) &&
          piece.row >= 0 &&
          piece.row < loadedRows &&
          piece.col >= 0 &&
          piece.col < loadedCols
        );
      totalTargetPieces = targetPieces.length;
      targetPiecesCaptured = targetPieces.filter(piece => piece.captured).length;
      for (const piece of targetPieces) {
        if (!piece.captured) {
          board[piece.row][piece.col] = CELL_TYPES.BLACK_TARGET_PIECE;
        }
      }
    } else {
      targetPieces = [];
      totalTargetPieces = 0;
      targetPiecesCaptured = 0;
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
    updateTargetPieceCount();
    updateStatus(`Puzzle "${puzzleData.name}" loaded successfully! Size: ${loadedRows}x${loadedCols}`);
    // ✅ Reset state so pieces can move again
    mode = "play";
    gameWon = false;
    antigravityEnabled = false;
    antigravityUnlockedThisRun = false;
    frameCount = 0;
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

  if (board[row][col] === CELL_TYPES.MOVING_PLATFORM) {
    return true;
  }

  if (getDuckAt(row, col) !== -1) {
    return true;
  }

  if (board[row][col] === CELL_TYPES.BLACK_TARGET_PIECE) {
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

function isGravityPassableCell(row, col, playerStartCells) {
  return playerStartCells.has(`${row},${col}`) ||
    !isCellBlocked(row, col, null, "above");
}

function getGravityFallTargets() {
  const playerStartCells = new Set(players.map(player => `${player.row},${player.col}`));
  const finalRowsByColumn = new Map();
  const orderedPlayers = players
    .map((player, playerIndex) => ({ player, playerIndex }))
    .sort((a, b) => a.player.col - b.player.col || b.player.row - a.player.row);
  const targets = [];

  for (const { player, playerIndex } of orderedPlayers) {
    let targetRow = player.row;
    let finalRows = finalRowsByColumn.get(player.col);
    if (!finalRows) {
      finalRows = new Set();
      finalRowsByColumn.set(player.col, finalRows);
    }

    while (
      targetRow < ROWS - 1 &&
      isGravityPassableCell(targetRow + 1, player.col, playerStartCells) &&
      !finalRows.has(targetRow + 1)
    ) {
      targetRow++;
    }

    finalRows.add(targetRow);
    if (targetRow !== player.row) {
      targets.push({ player, playerIndex, targetRow });
    }
  }

  return targets;
}

// --- Apply gravity to all pieces ---
function applyGravity() {
  if (gameWon) return;

  const fallTargets = getGravityFallTargets();
  for (const { player, playerIndex, targetRow } of fallTargets) {
    const landingCellType = board[targetRow][player.col];
    const isTeleportBlock = [
      CELL_TYPES.TELEPORT_PURPLE,
      CELL_TYPES.TELEPORT_GREEN,
      CELL_TYPES.TELEPORT_BLUE,
      CELL_TYPES.TELEPORT_ORANGE
    ].includes(landingCellType);

    fallingPieces.push({
      playerIndex,
      startRow: player.row,
      targetRow,
      col: player.col,
      y: player.row * TILE_SIZE,
      pieceType: player.pieceType,
      isTeleport: isTeleportBlock,
      teleportType: isTeleportBlock ? landingCellType : null
    });

    // Clear board spot early so ghost rendering is manual
    board[player.row][player.col] = CELL_TYPES.EMPTY;
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
    let targetY = piece.targetRow * TILE_SIZE;
    const prevY = piece.y;

    // Move piece down
    piece.y += fallSpeed;

    // Check if we've passed through a bomb mid-fall
    const prevRow = Math.floor(prevY / TILE_SIZE);
    const currentRow = Math.floor(piece.y / TILE_SIZE);

    if (currentRow !== prevRow) {
      for (let r = prevRow + 1; r <= Math.min(currentRow, ROWS - 1); r++) {
        // A falling piece can land on a duck that moves into the same column.
        // The duck itself occupies row r, so the piece lands one cell above it.
        if (getDuckAt(r, piece.col) !== -1 && r > 0) {
          piece.targetRow = r - 1;
          targetY = piece.targetRow * TILE_SIZE;
          if (piece.y >= targetY) {
            piece.y = targetY;
          }
          break;
        }

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

  const headers = {
    "Content-Type": "application/json"
  };
  if (window.cmToken) {
    headers.Authorization = `Bearer ${window.cmToken}`;
  }

  apiFetchWithAuthRetry("/progress", {
    method: "POST",
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
        updateStatus("Puzzle solved! All requirements completed and goal reached!");
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

function isPawnForwardDestinationCell(row, col, movingPlayer) {
  return board[row][col] !== CELL_TYPES.PHASE_BLOCK &&
    !isCellBlocked(row, col, movingPlayer, "below");
}

function isPawnForwardPathCell(row, col, movingPlayer) {
  if (
    board[row][col] === CELL_TYPES.PHASE_BLOCK ||
    board[row][col] === CELL_TYPES.MOVING_PLATFORM ||
    getDuckAt(row, col) !== -1
  ) {
    return true;
  }
  return !isCellBlocked(row, col, movingPlayer, "below");
}

function isPawnDiagonalCaptureCell(row, col) {
  const cellType = board[row][col];
  return [
    CELL_TYPES.OBJECTIVE,
    CELL_TYPES.OBJECTIVE_COMPLETED,
    CELL_TYPES.TRANSFORMER,
    CELL_TYPES.GOAL,
    CELL_TYPES.COUNTER_GOAL,
    CELL_TYPES.BLACK_TARGET_PIECE
  ].includes(cellType);
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
      board[newRow][newCol] !== CELL_TYPES.BLACK_TARGET_PIECE &&
      getDuckAt(newRow, newCol) === -1 &&
      isCellBlocked(newRow, newCol, player, fromDirection)) {
    return false;
  }


  // Use the player's specific piece type
  switch (player.pieceType) {
    case "rook":
    case "castle_rook":
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
      // Pawns move upward. First move can advance two squares; later moves advance one.
      if (newCol === c && newRow === r - 1) {
        return isPawnForwardDestinationCell(newRow, newCol, player);
      } else if (newCol === c && newRow === r - 2 && !player.hasMoved) {
        const middleRow = r - 1;
        return middleRow >= 0 &&
          isPawnForwardPathCell(middleRow, c, player) &&
          isPawnForwardDestinationCell(newRow, newCol, player);
      } else if (Math.abs(newCol - c) === 1 && newRow === r - 1) {
        // Diagonal "captures" can take puzzle targets/blocks, like chess captures a piece.
        return isPawnDiagonalCaptureCell(newRow, newCol);
      }
      return false;
  }
  return false;
}

function canCastle(kingIndex, rookIndex) {
  if (kingIndex < 0 || rookIndex < 0 || kingIndex === rookIndex) return false;
  const king = players[kingIndex];
  const rook = players[rookIndex];
  if (!king || !rook) return false;
  if (king.pieceType !== "king" || rook.pieceType !== "castle_rook") return false;
  if (king.hasMoved || rook.hasMoved) return false;
  if (king.row !== rook.row) return false;

  const direction = rook.col > king.col ? 1 : -1;
  const kingTargetCol = king.col + direction * 2;
  const rookTargetCol = kingTargetCol - direction;
  if (kingTargetCol < 0 || kingTargetCol >= COLS || rookTargetCol < 0 || rookTargetCol >= COLS) return false;

  const start = Math.min(king.col, rook.col) + 1;
  const end = Math.max(king.col, rook.col);
  for (let col = start; col < end; col++) {
    if (board[king.row][col] !== CELL_TYPES.EMPTY || getPlayerAt(king.row, col) !== -1) {
      return false;
    }
  }

  const isOriginalKingOrRookCell = (col) =>
    col === king.col || col === rook.col;
  const isCastleTargetAvailable = (col) =>
    board[king.row][col] === CELL_TYPES.EMPTY || isOriginalKingOrRookCell(col);

  return (
    isCastleTargetAvailable(kingTargetCol) &&
    isCastleTargetAvailable(rookTargetCol)
  );
}

function castleKingWithRook(kingIndex, rookIndex) {
  if (!canCastle(kingIndex, rookIndex)) {
    updateStatus("Castling is not available here");
    return false;
  }

  const king = players[kingIndex];
  const rook = players[rookIndex];
  const oldKingRow = king.row;
  const oldKingCol = king.col;
  const oldRookRow = rook.row;
  const oldRookCol = rook.col;
  const direction = rook.col > king.col ? 1 : -1;
  const kingTargetCol = king.col + direction * 2;
  const rookTargetCol = kingTargetCol - direction;

  saveUndoSnapshot();
  queueMoveTraceCapture({
    from: { row: oldKingRow, col: oldKingCol },
    to: { row: oldKingRow, col: kingTargetCol },
    pieceType: "king",
    castling: direction > 0 ? "kingside" : "queenside",
    rookFrom: { row: oldRookRow, col: oldRookCol },
    rookTo: { row: oldRookRow, col: rookTargetCol }
  });

  board[oldKingRow][oldKingCol] = CELL_TYPES.EMPTY;
  board[oldRookRow][oldRookCol] = CELL_TYPES.EMPTY;
  king.col = kingTargetCol;
  rook.col = rookTargetCol;
  king.hasMoved = true;
  rook.hasMoved = true;
  board[king.row][king.col] = CELL_TYPES.PLAYER;
  board[rook.row][rook.col] = CELL_TYPES.PLAYER;
  visitedSquares[king.row][king.col] = true;
  visitedSquares[rook.row][rook.col] = true;

  levelMoveCount += 1;
  updateMoveCountDisplay();
  updateStatus(direction > 0 ? "Kingside castling!" : "Queenside castling!");
  checkWinCondition();

  if (gravityEnabled) {
    applyGravity();
  } else if (antigravityEnabled) {
    applyAntigravity();
  } else {
    tryCapturePendingMoveTrace(true);
  }

  return true;
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
      updateStatus("Complete all requirements first! " + getUnlockProgressText());
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

  // Check the full movement path against active lasers before moving.
  const laserHit = getActiveLaserHitOnMove(player, newRow, newCol);
  if (laserHit) {
    handleLaserCollision(playerIndex, laserHit.row, laserHit.col);
    return;
  }

  const isBombBlock = board[newRow][newCol] === CELL_TYPES.BOMB;
  const isDuckHazard = getDuckAt(newRow, newCol) !== -1;
  const isTargetPiece = board[newRow][newCol] === CELL_TYPES.BLACK_TARGET_PIECE;

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

  if (isDuckHazard) {
    handleDuckCollision(playerIndex);
    return;
  }

  board[player.row][player.col] = CELL_TYPES.EMPTY;
  player.row = newRow;
  player.col = newCol;
  player.hasMoved = true;
  visitedSquares[newRow][newCol] = true;

  if (isTargetPiece) {
    completeTargetPiece(newRow, newCol);
  }

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
    targetPieces: cloneGameData(targetPieces),
    targetPiecesCaptured,
    totalTargetPieces,
    phaseBlockStates: cloneGameData(phaseBlockStates),
    bombs: cloneGameData(bombs),
    laserBlocks: cloneGameData(laserBlocks),
    ducks: cloneGameData(ducks),
    movingPlatforms: cloneGameData(movingPlatforms),
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
  targetPieces = cloneGameData(snapshot.targetPieces || []);
  targetPiecesCaptured = snapshot.targetPiecesCaptured || targetPieces.filter(piece => piece.captured).length;
  totalTargetPieces = snapshot.totalTargetPieces || targetPieces.length;
  phaseBlockStates = cloneGameData(snapshot.phaseBlockStates);
  bombs = cloneGameData(snapshot.bombs);
  laserBlocks = cloneGameData(snapshot.laserBlocks || []);
  ducks = cloneGameData(snapshot.ducks || []);
  movingPlatforms = cloneGameData(snapshot.movingPlatforms || []);
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
  updateTargetPieceCount();
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
  const menuHeight = 3 * buttonSize + 2 * spacing;
  const outerMargin = 20;
  
  const startX = centerX - menuWidth / 2;
  const startY = centerY - menuHeight / 2 - 10;
  
  // Define the piece grid layout
  const pieceLayout = [
    ["rook", "bishop", "queen"],
    ["knight", "king", "pawn"],
    ["castle_rook"]
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

/**
 * game/05-vision-render.js
 * Valid moves, vision/fog, drawBoard
 * Split from game.monolith.js lines 4122-4830.
 */
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
  const menuHeight = 3 * buttonSize + 2 * spacing;
  
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
  
  // Define the piece grid layout
  const pieceLayout = [
    ["rook", "bishop", "queen"],
    ["knight", "king", "pawn"],
    ["castle_rook"]
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
      
      const displayName = pieceType
        .split("_")
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
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

// Fog reveals each player piece plus the eight surrounding squares.
function getVisibleSquares() {
  syncVisitedSquaresSize();
  const visible = Array.from({ length: ROWS }, () => Array(COLS).fill(false));

  if (!fogEnabled || (CM_EDITOR_PAGE && mode === "edit")) {
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        visible[r][c] = true;
    return visible;
  }

  players.forEach(player => {
    revealAdjacentSquares(visible, player.row, player.col);
  });

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (visible[r][c]) {
        visitedSquares[r][c] = true;
      } else if (visitedSquares[r][c]) {
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

  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const visibleRow = row + dr;
      const visibleCol = col + dc;
      if (isInsideBoard(visibleRow, visibleCol)) {
        visionSquares.push([visibleRow, visibleCol]);
      }
    }
  }

  return visionSquares;
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
    drawInactivePhaseBlock(ctx, x, y, TILE_SIZE);
  }
  
  // Draw active phase block (solid blue)
  if (cellType === CELL_TYPES.PHASE_BLOCK_ACTIVE) {
    ctx.fillStyle = "rgba(41, 128, 185, 0.8)";
    ctx.fillRect(x+3, y+3, TILE_SIZE-6, TILE_SIZE-6);
  }

  if (cellType === CELL_TYPES.MOVING_PLATFORM) {
    drawMovingPlatform(ctx, x, y, TILE_SIZE, getMovingPlatformAxisAt(row, col));
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

  if (cellType === CELL_TYPES.BLACK_TARGET_PIECE) {
    const targetIndex = getTargetPieceAt(row, col);
    const targetPiece = targetIndex !== -1 ? targetPieces[targetIndex] : null;
    drawBlackTargetPiece(ctx, x, y, TILE_SIZE, targetPiece ? targetPiece.pieceType : "pawn");
  }
}

// --- Drawing ---
function drawCounterGoalBadge(x, y, counter, centerY = y + TILE_SIZE / 2) {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.beginPath();
  ctx.arc(x + TILE_SIZE / 2, centerY, 14, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = (counter <= 3) ? "red" : "white";
  ctx.font = "bold 16px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(counter, x + TILE_SIZE / 2, centerY);
  ctx.restore();
}

function drawLaserEmitter(renderCtx, x, y, tile, laser) {
  const plate = Math.max(5, tile * 0.12);
  const inset = Math.max(9, tile * 0.18);
  const active = isLaserActive(laser);
  const enabledDirections = normalizeLaserDirections(laser && laser.directions);
  const countdown = getLaserCountdown(laser);

  renderCtx.save();
  renderCtx.lineWidth = 1.5;

  const barsByDirection = {
    up: [x + inset, y + 2, tile - inset * 2, plate],
    down: [x + inset, y + tile - plate - 2, tile - inset * 2, plate],
    left: [x + 2, y + inset, plate, tile - inset * 2],
    right: [x + tile - plate - 2, y + inset, plate, tile - inset * 2]
  };

  for (const direction of DEFAULT_LASER_DIRECTIONS) {
    const [barX, barY, width, height] = barsByDirection[direction];
    const enabled = enabledDirections.includes(direction);
    renderCtx.fillStyle = enabled
      ? (active ? "#ff3b30" : "#6c1f1a")
      : "rgba(30, 30, 30, 0.72)";
    renderCtx.strokeStyle = enabled
      ? (active ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.35)")
      : "rgba(255,255,255,0.18)";
    renderCtx.fillRect(barX, barY, width, height);
    renderCtx.strokeRect(barX, barY, width, height);
  }

  const badgeRadius = Math.max(9, tile * 0.24);
  const centerX = x + tile / 2;
  const centerY = y + tile / 2;
  renderCtx.fillStyle = active ? "rgba(255, 59, 48, 0.92)" : "rgba(20, 24, 31, 0.78)";
  renderCtx.strokeStyle = active ? "rgba(255, 255, 255, 0.95)" : "rgba(255, 255, 255, 0.78)";
  renderCtx.lineWidth = Math.max(1.5, tile * 0.035);
  renderCtx.beginPath();
  renderCtx.arc(centerX, centerY, badgeRadius, 0, Math.PI * 2);
  renderCtx.fill();
  renderCtx.stroke();

  renderCtx.fillStyle = "#ffffff";
  renderCtx.font = `bold ${Math.max(11, Math.floor(tile * 0.34))}px Arial`;
  renderCtx.textAlign = "center";
  renderCtx.textBaseline = "middle";
  renderCtx.fillText(String(countdown), centerX, centerY + 0.5);

  renderCtx.restore();
}

function drawLaserCell(renderCtx, x, y, direction) {
  const beamWidth = Math.max(8, TILE_SIZE * 0.16);
  const glowWidth = Math.max(18, TILE_SIZE * 0.34);
  const isVertical = direction === "up" || direction === "down";
  const centerX = x + TILE_SIZE / 2;
  const centerY = y + TILE_SIZE / 2;

  renderCtx.save();
  renderCtx.fillStyle = "rgba(255, 64, 64, 0.16)";
  if (isVertical) {
    renderCtx.fillRect(centerX - glowWidth / 2, y, glowWidth, TILE_SIZE);
  } else {
    renderCtx.fillRect(x, centerY - glowWidth / 2, TILE_SIZE, glowWidth);
  }

  renderCtx.fillStyle = "rgba(255, 0, 0, 0.75)";
  if (isVertical) {
    renderCtx.fillRect(centerX - beamWidth / 2, y, beamWidth, TILE_SIZE);
  } else {
    renderCtx.fillRect(x, centerY - beamWidth / 2, TILE_SIZE, beamWidth);
  }

  renderCtx.fillStyle = "rgba(255, 255, 255, 0.9)";
  const coreWidth = Math.max(2, beamWidth * 0.28);
  if (isVertical) {
    renderCtx.fillRect(centerX - coreWidth / 2, y, coreWidth, TILE_SIZE);
  } else {
    renderCtx.fillRect(x, centerY - coreWidth / 2, TILE_SIZE, coreWidth);
  }
  renderCtx.restore();
}

function drawLaserEffects(visible) {
  for (const laser of laserBlocks) {
    if (laser.row < 0 || laser.row >= ROWS || laser.col < 0 || laser.col >= COLS) continue;
    if (fogEnabled && !visible[laser.row][laser.col]) continue;
    drawLaserEmitter(ctx, laser.col * TILE_SIZE, laser.row * TILE_SIZE, TILE_SIZE, laser);
  }

  for (const laser of laserBlocks) {
    if (!isLaserActive(laser)) continue;
    for (const cell of getLaserCellsFromBlock(laser)) {
      if (fogEnabled && !visible[cell.row][cell.col]) continue;
      drawLaserCell(ctx, cell.col * TILE_SIZE, cell.row * TILE_SIZE, cell.direction);
    }
  }
}

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
          drawInactivePhaseBlock(ctx, x, y, TILE_SIZE);
        }
      }
      
      // Draw active phase block (solid blue) - adjust size
      if (board[r][c] === CELL_TYPES.PHASE_BLOCK_ACTIVE) {
        if (!fogEnabled || visible[r][c]) {
          ctx.fillStyle = "rgba(41, 128, 185, 0.8)";
          ctx.fillRect(x+3, y+3, TILE_SIZE-6, TILE_SIZE-6);
        }
      }

      if (board[r][c] === CELL_TYPES.MOVING_PLATFORM) {
        if (!fogEnabled || visible[r][c]) {
          drawMovingPlatform(ctx, x, y, TILE_SIZE, getMovingPlatformAxisAt(r, c));
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
              drawTeleporterDoor(ctx, x, y, TILE_SIZE, board[r][c], getTeleporterDoorRole(r, c, board[r][c]));
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
                drawTeleporterDoor(ctx, x, y, TILE_SIZE, teleportBlock.type, getTeleporterDoorRole(r, c, teleportBlock.type));
            }
            
          // Draw the player piece on top
          ctx.drawImage(pieceImages[player.pieceType], x+8, y+8, TILE_SIZE-16, TILE_SIZE-16);
          if (player.pieceType === "castle_rook") {
            drawCastleRookMarker(ctx, x, y, TILE_SIZE);
          }
        }
      }
      }

      if (teleportBlocks.some(tp => tp.row === r && tp.col === c) && board[r][c] !== CELL_TYPES.PLAYER) {
        if (!fogEnabled || visible[r][c]) {
            const teleportBlock = teleportBlocks.find(tp => tp.row === r && tp.col === c);
            if (teleportBlock) {
              drawTeleporterDoor(ctx, x, y, TILE_SIZE, teleportBlock.type, getTeleporterDoorRole(r, c, teleportBlock.type));
            }
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

  risingPieces.forEach(piece => {
    const x = piece.col * TILE_SIZE;
    ctx.globalAlpha = 1.0;
    ctx.drawImage(pieceImages[piece.pieceType], x+8, piece.currentY+8, TILE_SIZE-16, TILE_SIZE-16);
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
        drawTeleporterDoor(ctx, x, y, TILE_SIZE, teleportBlock.type, getTeleporterDoorRole(player.row, player.col, teleportBlock.type));
      }
      
      // Draw the player piece on top
      ctx.drawImage(pieceImages[player.pieceType], x+8, y+8, TILE_SIZE-16, TILE_SIZE-16);
      if (player.pieceType === "castle_rook") {
        drawCastleRookMarker(ctx, x, y, TILE_SIZE);
      }
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
      const goalLocked = !areAllObjectivesCompleted() ||
        (goal.type === "counter" && goal.counter <= 0);

      // If it's a counter goal, draw counter
      if (goal.type === "counter" && !goalLocked) {
        drawCounterGoalBadge(x, y, goal.counter);
      }

      // Lock overlay
      if (goalLocked) {
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

      if (goal.type === "counter" && goalLocked) {
        drawCounterGoalBadge(x, y, goal.counter, y + 10);
      }
    }
  }

  for (const duck of ducks) {
    const isOnBoard =
      duck.row >= 0 &&
      duck.row < ROWS &&
      duck.col >= 0 &&
      duck.col < COLS;
    if (isOnBoard && (!fogEnabled || visible[duck.row][duck.col])) {
      drawDuck(ctx, duck);
    }
  }

  drawLaserEffects(visible);
  drawPlatformLevelGuide();
}

// --- Confetti Celebration ---

/**
 * game/06-effects-bombs.js
 * Confetti, bombs, ducks, platforms, lasers collisions
 * Split from game.monolith.js lines 4831-5646.
 */
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
    const nextRow = isBoomBomb(bomb) ? bomb.row + bomb.rowDirection : bomb.row;
    const nextCol = isBoomBomb(bomb) ? bomb.col + bomb.colDirection : bomb.col + bomb.direction;

    // Check bounds - bounce if hitting the edge
    if (nextRow < 0 || nextRow >= ROWS || nextCol < 0 || nextCol >= COLS) {
      if (isBoomBomb(bomb)) {
        bomb.rowDirection *= -1;
        bomb.colDirection *= -1;
      } else {
        bomb.direction *= -1; // Reverse direction
      }
      continue;
    }

    // Check for collision with ANY player (regardless of selection state)
    const hitPlayerIndex = players.findIndex(p => p.row === nextRow && p.col === nextCol);
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
      bomb.row = nextRow;
      bomb.col = nextCol;
      board[bomb.row][bomb.col] = CELL_TYPES.BOMB;
      continue; // Skip the rest of the logic for this bomb this frame
    }

    // Only move if the next position is empty
    if (board[nextRow][nextCol] === CELL_TYPES.EMPTY) {
      // Clear current position
      board[bomb.row][bomb.col] = CELL_TYPES.EMPTY;
      
      // Move bomb
      bomb.row = nextRow;
      bomb.col = nextCol;
      board[bomb.row][bomb.col] = CELL_TYPES.BOMB;
    } else {
      // If the next position is blocked by something else, bounce
      if (isBoomBomb(bomb)) {
        bomb.rowDirection *= -1;
        bomb.colDirection *= -1;
      } else {
        bomb.direction *= -1;
      }
    }
  }
}

function handleDuckCollision(playerIndex) {
  const player = players[playerIndex];
  if (!player) return;

  explodingPlayers.push({
    x: player.col * TILE_SIZE,
    y: player.row * TILE_SIZE,
    velocityY: -7,
    velocityX: 0,
    rotation: 0,
    rotationSpeed: (Math.random() < 0.5 ? -1 : 1) * 0.22,
    pieceType: player.pieceType
  });

  if (board[player.row][player.col] === CELL_TYPES.PLAYER) {
    board[player.row][player.col] = CELL_TYPES.EMPTY;
  }

  players.splice(playerIndex, 1);
  updatePlayerCount();
  selectedPlayerIndex = -1;
  shakeAmount = 18;
  updateStatus("🦆 You ran into a duck!");
  scheduleAutoRestartAfterDeath("🦆 The duck knocked you out! Restarting level...");
}

function updateDucks() {
  let removedSupport = false;

  for (let i = ducks.length - 1; i >= 0; i--) {
    const duck = ducks[i];
    const isWaitingToRespawn = duck.col < 0 || duck.col >= COLS;
    const nextCol = isWaitingToRespawn
      ? (duck.direction === 1 ? 0 : COLS - 1)
      : duck.col + duck.direction;

    if (nextCol < 0 || nextCol >= COLS) {
      const riderIndex = duck.row > 0 ? getPlayerAt(duck.row - 1, duck.col) : -1;
      if (riderIndex !== -1) removedSupport = true;
      duck.col = duck.direction === 1 ? COLS : -1;
      continue;
    }

    const hitPlayerIndex = getPlayerAt(duck.row, nextCol);
    if (
      (board[duck.row][nextCol] !== CELL_TYPES.EMPTY && hitPlayerIndex === -1) ||
      getDuckAt(duck.row, nextCol) !== -1
    ) {
      continue;
    }

    const riderIndex = !isWaitingToRespawn && duck.row > 0
      ? getPlayerAt(duck.row - 1, duck.col)
      : -1;
    if (riderIndex !== -1) {
      const rider = players[riderIndex];
      const riderTargetPlayerIndex = getPlayerAt(rider.row, nextCol);
      const riderTargetCell = board[rider.row][nextCol];
      const riderIsBlocked =
        riderTargetPlayerIndex !== -1 ||
        ![
          CELL_TYPES.EMPTY,
          CELL_TYPES.OBJECTIVE,
          CELL_TYPES.OBJECTIVE_COMPLETED
        ].includes(riderTargetCell);

      if (riderIsBlocked) {
        // The duck keeps moving. The rider stays behind, loses support,
        // and is allowed to fall after all ducks finish this movement tick.
        removedSupport = true;
      } else {
        board[rider.row][rider.col] = getObjectiveCellTypeAt(rider.row, rider.col);
        rider.col = nextCol;
        board[rider.row][rider.col] = CELL_TYPES.PLAYER;
        visitedSquares[rider.row][rider.col] = true;
        checkObjectiveCompletion();
        checkWinCondition();
      }
    }

    duck.col = nextCol;
    if (hitPlayerIndex !== -1) {
      handleDuckCollision(hitPlayerIndex);
    }
  }

  if (removedSupport && gravityEnabled && !antigravityEnabled && fallingPieces.length === 0) {
    applyGravity();
  }
}

function reverseMovingPlatform(platform) {
  platform.direction *= -1;
}

function getGoalCellType() {
  return goal && goal.type === "counter" ? CELL_TYPES.COUNTER_GOAL : CELL_TYPES.GOAL;
}

function updateHorizontalMovingPlatform(platform) {
  const nextCol = platform.currentCol + platform.direction;
  if (nextCol < platform.minCol || nextCol > platform.maxCol) {
    reverseMovingPlatform(platform);
    return;
  }

  const currentRow = platform.row;
  const currentCol = platform.col;
  const deltaCol = nextCol - currentCol;
  if (deltaCol === 0) return;

  const carriedPlayerIndex = getPlayerAt(currentRow - 1, currentCol);
  const carriedPlayer = carriedPlayerIndex !== -1 ? players[carriedPlayerIndex] : null;
  const carriedGoal =
    goal && goal.row === currentRow - 1 && goal.col === currentCol ? goal : null;

  if (
    nextCol < 0 ||
    nextCol >= COLS ||
    board[currentRow][nextCol] !== CELL_TYPES.EMPTY
  ) {
    reverseMovingPlatform(platform);
    return;
  }

  let carriedPlayerTargetCol = null;
  if (carriedPlayer) {
    carriedPlayerTargetCol = carriedPlayer.col + deltaCol;
    if (carriedPlayerTargetCol < 0 || carriedPlayerTargetCol >= COLS) {
      reverseMovingPlatform(platform);
      return;
    }

    const targetCell = board[carriedPlayer.row][carriedPlayerTargetCol];
    const targetPlayerIndex = getPlayerAt(carriedPlayer.row, carriedPlayerTargetCol);
    if (targetPlayerIndex !== -1 || targetCell !== CELL_TYPES.EMPTY) {
      reverseMovingPlatform(platform);
      return;
    }
  }

  let carriedGoalTargetCol = null;
  if (carriedGoal) {
    carriedGoalTargetCol = carriedGoal.col + deltaCol;
    if (carriedGoalTargetCol < 0 || carriedGoalTargetCol >= COLS) {
      reverseMovingPlatform(platform);
      return;
    }

    const targetCell = board[carriedGoal.row][carriedGoalTargetCol];
    const targetPlayerIndex = getPlayerAt(carriedGoal.row, carriedGoalTargetCol);
    if (targetPlayerIndex !== -1 || targetCell !== CELL_TYPES.EMPTY) {
      reverseMovingPlatform(platform);
      return;
    }
  }

  board[currentRow][currentCol] = CELL_TYPES.EMPTY;
  if (carriedPlayer) {
    board[carriedPlayer.row][carriedPlayer.col] = CELL_TYPES.EMPTY;
    carriedPlayer.col = carriedPlayerTargetCol;
    visitedSquares[carriedPlayer.row][carriedPlayer.col] = true;
  }
  if (carriedGoal) {
    board[carriedGoal.row][carriedGoal.col] = CELL_TYPES.EMPTY;
    carriedGoal.col = carriedGoalTargetCol;
  }

  platform.currentCol = nextCol;
  platform.col = nextCol;
  board[platform.row][platform.col] = CELL_TYPES.MOVING_PLATFORM;
  if (carriedPlayer) {
    board[carriedPlayer.row][carriedPlayer.col] = CELL_TYPES.PLAYER;
  }
  if (carriedGoal) {
    board[carriedGoal.row][carriedGoal.col] = getGoalCellType();
  }
}

function updateMovingPlatforms() {
  for (const platform of movingPlatforms) {
    if (platform.axis === "horizontal") {
      updateHorizontalMovingPlatform(platform);
      continue;
    }

    const nextLevel = platform.currentLevel + platform.direction;
    if (nextLevel < platform.minLevel || nextLevel > platform.maxLevel) {
      reverseMovingPlatform(platform);
      continue;
    }

    const currentRow = platform.row;
    const nextRow = platformLevelToRow(nextLevel);
    const deltaRow = nextRow - currentRow;
    if (deltaRow === 0) continue;

    const carriedPlayerIndex = getPlayerAt(currentRow - 1, platform.col);
    const carriedPlayer = carriedPlayerIndex !== -1 ? players[carriedPlayerIndex] : null;
    const carriedGoal =
      goal && goal.row === currentRow - 1 && goal.col === platform.col ? goal : null;
    const platformDestinationPlayerIndex = getPlayerAt(nextRow, platform.col);
    const platformDestinationIsCarriedPlayer =
      carriedPlayer && platformDestinationPlayerIndex === carriedPlayerIndex;
    const platformDestinationIsCarriedGoal =
      carriedGoal && nextRow === carriedGoal.row && platform.col === carriedGoal.col;

    if (
      nextRow < 0 ||
      nextRow >= ROWS ||
      (
        board[nextRow][platform.col] !== CELL_TYPES.EMPTY &&
        !platformDestinationIsCarriedPlayer &&
        !platformDestinationIsCarriedGoal
      )
    ) {
      reverseMovingPlatform(platform);
      continue;
    }

    let carriedPlayerTargetRow = null;
    if (carriedPlayer) {
      carriedPlayerTargetRow = carriedPlayer.row + deltaRow;
      if (carriedPlayerTargetRow < 0 || carriedPlayerTargetRow >= ROWS) {
        reverseMovingPlatform(platform);
        continue;
      }

      const targetCell = board[carriedPlayerTargetRow][platform.col];
      const targetPlayerIndex = getPlayerAt(carriedPlayerTargetRow, platform.col);
      const targetIsCurrentPlatformCell = carriedPlayerTargetRow === currentRow;
      if (
        targetPlayerIndex !== -1 ||
        (targetCell !== CELL_TYPES.EMPTY && !targetIsCurrentPlatformCell)
      ) {
        reverseMovingPlatform(platform);
        continue;
      }
    }

    let carriedGoalTargetRow = null;
    if (carriedGoal) {
      carriedGoalTargetRow = carriedGoal.row + deltaRow;
      if (carriedGoalTargetRow < 0 || carriedGoalTargetRow >= ROWS) {
        reverseMovingPlatform(platform);
        continue;
      }

      const targetCell = board[carriedGoalTargetRow][platform.col];
      const targetPlayerIndex = getPlayerAt(carriedGoalTargetRow, platform.col);
      const targetIsCurrentPlatformCell = carriedGoalTargetRow === currentRow;
      if (
        targetPlayerIndex !== -1 ||
        (targetCell !== CELL_TYPES.EMPTY && !targetIsCurrentPlatformCell)
      ) {
        reverseMovingPlatform(platform);
        continue;
      }
    }

    board[currentRow][platform.col] = CELL_TYPES.EMPTY;
    if (carriedPlayer) {
      board[carriedPlayer.row][carriedPlayer.col] = CELL_TYPES.EMPTY;
      carriedPlayer.row = carriedPlayerTargetRow;
      visitedSquares[carriedPlayer.row][carriedPlayer.col] = true;
    }
    if (carriedGoal) {
      board[carriedGoal.row][carriedGoal.col] = CELL_TYPES.EMPTY;
      carriedGoal.row = carriedGoalTargetRow;
    }

    platform.currentLevel = nextLevel;
    platform.row = nextRow;
    board[platform.row][platform.col] = CELL_TYPES.MOVING_PLATFORM;
    if (carriedPlayer) {
      board[carriedPlayer.row][carriedPlayer.col] = CELL_TYPES.PLAYER;
    }
    if (carriedGoal) {
      board[carriedGoal.row][carriedGoal.col] = getGoalCellType();
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

function handleLaserCollision(playerIndex, laserRow, laserCol) {
  const player = players[playerIndex];
  if (!player) return;

  const explosionSound = document.getElementById("explosionSound");
  if (explosionSound) {
    playSound(explosionSound);
  }

  explodingPlayers.push({
    x: laserCol * TILE_SIZE,
    y: laserRow * TILE_SIZE,
    velocityY: -8,
    rotation: 0,
    rotationSpeed: (Math.random() < 0.5 ? -1 : 1) * 0.3,
    pieceType: player.pieceType
  });

  createExplosionParticles(laserCol * TILE_SIZE, laserRow * TILE_SIZE);

  board[player.row][player.col] = CELL_TYPES.EMPTY;
  players.splice(playerIndex, 1);
  updateStatus("A player was cut down by a laser!");
  updatePlayerCount();
  shakeAmount = 24;
  scheduleAutoRestartAfterDeath("You were hit by a laser! Restarting level...");

  if (selectedPlayerIndex === playerIndex) {
    selectedPlayerIndex = -1;
  } else if (selectedPlayerIndex > playerIndex) {
    selectedPlayerIndex--;
  }

  fallingPieces = fallingPieces.filter(piece => piece.playerIndex !== playerIndex);
  risingPieces = risingPieces.filter(piece => piece.playerIndex !== playerIndex);

  if (players.length === 0) {
    updateStatus("Game Over! All players destroyed!");
  }
}

function checkActiveLaserCollisions() {
  if (mode !== "play" || gameWon || laserBlocks.length === 0) return;
  if (!laserBlocks.some(laser => isLaserActive(laser))) return;

  const hits = new Map();
  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    if (isCellInActiveLaser(player.row, player.col)) {
      hits.set(i, { row: player.row, col: player.col });
    }
  }

  for (const piece of fallingPieces) {
    if (piece.playerIndex === "goal") continue;
    const row = Math.max(0, Math.min(ROWS - 1, Math.floor((piece.y + TILE_SIZE / 2) / TILE_SIZE)));
    if (isCellInActiveLaser(row, piece.col)) {
      hits.set(piece.playerIndex, { row, col: piece.col });
    }
  }

  for (const piece of risingPieces) {
    if (piece.playerIndex === "goal") continue;
    const row = Math.max(0, Math.min(ROWS - 1, Math.floor((piece.y + TILE_SIZE / 2) / TILE_SIZE)));
    if (isCellInActiveLaser(row, piece.col)) {
      hits.set(piece.playerIndex, { row, col: piece.col });
    }
  }

  [...hits.entries()]
    .sort((a, b) => b[0] - a[0])
    .forEach(([playerIndex, hit]) => handleLaserCollision(playerIndex, hit.row, hit.col));
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

/**
 * game/07-input-loop.js
 * Input, antigravity, restart, game loop, boot
 * Split from game.monolith.js lines 5647-6125.
 */
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
      window.cmEditorOnEditCell(row, col, x - col * TILE_SIZE, y - row * TILE_SIZE);
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
      if (selectedPlayerIndex !== -1) {
        const selectedPiece = players[selectedPlayerIndex];
        const clickedPiece = players[clickedPlayerIndex];
        const selectedKingClickedRook =
          selectedPiece?.pieceType === "king" && clickedPiece?.pieceType === "castle_rook";
        const selectedRookClickedKing =
          selectedPiece?.pieceType === "castle_rook" && clickedPiece?.pieceType === "king";

        if (selectedKingClickedRook || selectedRookClickedKing) {
          const castled = selectedKingClickedRook
            ? castleKingWithRook(selectedPlayerIndex, clickedPlayerIndex)
            : castleKingWithRook(clickedPlayerIndex, selectedPlayerIndex);
          if (castled) {
            selectedPlayerIndex = -1;
            return;
          }
        }
      }

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

function isAntigravityPassableCell(row, col, playerStartCells) {
  const cellType = board[row][col];
  return cellType === CELL_TYPES.EMPTY ||
    (cellType === CELL_TYPES.PLAYER && playerStartCells.has(`${row},${col}`));
}

function getAntigravityRiseTargets() {
  const playerStartCells = new Set(players.map(player => `${player.row},${player.col}`));
  const finalRowsByColumn = new Map();
  const orderedPlayers = players
    .map((player, playerIndex) => ({ player, playerIndex }))
    .sort((a, b) => a.player.col - b.player.col || a.player.row - b.player.row);
  const targets = [];

  for (const { player, playerIndex } of orderedPlayers) {
    let targetRow = player.row;
    let finalRows = finalRowsByColumn.get(player.col);
    if (!finalRows) {
      finalRows = new Set();
      finalRowsByColumn.set(player.col, finalRows);
    }

    while (
      targetRow > 0 &&
      isAntigravityPassableCell(targetRow - 1, player.col, playerStartCells) &&
      !finalRows.has(targetRow - 1)
    ) {
      targetRow--;
    }

    finalRows.add(targetRow);
    if (targetRow !== player.row) {
      targets.push({ player, playerIndex, targetRow });
    }
  }

  return targets;
}

function applyAntigravity() {
  risingPieces = [];

  const riseTargets = getAntigravityRiseTargets();
  for (const { player, playerIndex, targetRow } of riseTargets) {
    risingPieces.push({
      playerIndex,
      startRow: player.row,
      targetRow,
      col: player.col,
      startY: player.row * TILE_SIZE,
      targetY: targetRow * TILE_SIZE,
      currentY: player.row * TILE_SIZE,
      pieceType: player.pieceType
    });

    // Remove from board (we'll animate it)
    board[player.row][player.col] = CELL_TYPES.EMPTY;
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

  if (CM_EDITOR_PAGE && mode !== "play") {
    updateStatus("Switch to Play test to use Antigravity.");
    return;
  }

  if (CM_FREE_ANTIGRAVITY) {
    antigravityUnlockedThisRun = true;
  } else if (!antigravityUnlockedThisRun) {
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
  const walkthroughModalActive =
    inGameWalkthroughModal && inGameWalkthroughModal.classList.contains("active");
  const levelCompleteModalActive =
    levelCompleteModal && levelCompleteModal.classList.contains("active");
  const replayViewerActive =
    replayUnlockedForLevel &&
    fewestOtherMovesReplayPath &&
    fewestOtherMovesReplayPath.length &&
    (walkthroughModalActive || levelCompleteModalActive);

  if (replayViewerActive) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      stepReplayNavigation("prev");
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      stepReplayNavigation("next");
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      stepReplayNavigation("first");
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      stepReplayNavigation("last");
      return;
    }
  }

  if (e.key === "Escape") {
    const hintModalActive = blockTipModal && blockTipModal.classList.contains("active");
    if (walkthroughModalActive) {
      e.preventDefault();
      closeInGameWalkthroughModal();
      return;
    }
    if (hintModalActive) {
      e.preventDefault();
      closeHintModal();
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
  checkActiveLaserCollisions();
  tryCapturePendingMoveTrace(false);

  frameCount++;
  if (frameCount % 50 === 0) {
    updateBombs();
  }
  if (frameCount % 100 === 0) {
    updateDucks();
    updateMovingPlatforms();
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

let pageScrollLockY = 0;

const MODAL_SCROLL_LOCK_SELECTOR =
  ".leaderboard-modal.active, .block-tip-modal.active, .undo-exchange-modal.active";
const MODAL_SCROLLABLE_SELECTOR =
  ".leaderboard-content, .guide-content, .level-complete-content, .block-tip-content, .undo-exchange-panel";

function isAnyGameModalOpen() {
  return !!document.querySelector(MODAL_SCROLL_LOCK_SELECTOR);
}

function measureScrollbarWidth() {
  return Math.max(0, window.innerWidth - document.documentElement.clientWidth);
}

function syncPageScrollLock() {
  const open = isAnyGameModalOpen();
  const root = document.documentElement;
  const body = document.body;
  if (open) {
    if (!body.classList.contains("modal-scroll-lock")) {
      pageScrollLockY = window.scrollY || root.scrollTop || 0;
      const scrollbarWidth = measureScrollbarWidth();
      root.style.setProperty("--modal-scrollbar-width", `${scrollbarWidth}px`);
      body.classList.add("modal-scroll-lock");
      body.style.top = `-${pageScrollLockY}px`;
      root.classList.add("modal-scroll-lock");
    }
    return;
  }
  if (body.classList.contains("modal-scroll-lock")) {
    root.classList.remove("modal-scroll-lock");
    body.classList.remove("modal-scroll-lock");
    body.style.top = "";
    root.style.removeProperty("--modal-scrollbar-width");
    window.scrollTo(0, pageScrollLockY);
  }
}

function initModalScrollLock() {
  document
    .querySelectorAll(".leaderboard-modal, .block-tip-modal, .undo-exchange-modal")
    .forEach((modal) => {
      const observer = new MutationObserver(() => syncPageScrollLock());
      observer.observe(modal, { attributes: true, attributeFilter: ["class"] });
    });

  document.addEventListener(
    "touchmove",
    (e) => {
      if (!document.body.classList.contains("modal-scroll-lock")) return;
      if (!e.target.closest(MODAL_SCROLLABLE_SELECTOR)) {
        e.preventDefault();
      }
    },
    { passive: false }
  );

  document.addEventListener(
    "wheel",
    (e) => {
      if (!document.body.classList.contains("modal-scroll-lock")) return;
      if (!e.target.closest(MODAL_SCROLLABLE_SELECTOR)) {
        e.preventDefault();
      }
    },
    { passive: false }
  );
}

initModalScrollLock();

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
updateTargetPieceCount();

window.cmGetCurrentLevelIndex = function () {
  return currentLevelIndex;
};
window.cmSetCurrentLevelIndex = function (index) {
  currentLevelIndex = index;
};
window.toggleAntigravity = toggleAntigravity;
window.restartLevel = restartLevel;
window.undoMove = undoMove;
window.loadPuzzle = loadPuzzle;
window.updateStatus = updateStatus;

gameLoop();
