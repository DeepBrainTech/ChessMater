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
