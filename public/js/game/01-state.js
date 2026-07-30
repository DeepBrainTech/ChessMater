/**
 * game/01-state.js
 * DOM refs, constants, images, mutable game state
 * Split from game.js lines 1-161 — logic unchanged.
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

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const statusMessage = document.getElementById("statusMessage");
const playerCount = document.getElementById("playerCount");
const objectiveCount = document.getElementById("objectiveCount");
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

// --- Load images (URLs from 00-assets-config.js → window.CM_ASSETS) ---
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
(function loadPieceImagesFromAssets() {
  const pieces = (window.CM_ASSETS && window.CM_ASSETS.pieces) || {};
  pieceImages.rook.src = pieces.rook || "";
  pieceImages.bishop.src = pieces.bishop || "";
  pieceImages.queen.src = pieces.queen || "";
  pieceImages.knight.src = pieces.knight || "";
  pieceImages.king.src = pieces.king || "";
  pieceImages.pawn.src = pieces.pawn || "";
  pieceImages.target.src = pieces.target || "";
  pieceImages.bomb.src = pieces.bomb || "";
})();

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
