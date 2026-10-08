export function register(game) {
  game.syncVisitedSquaresSize = function () {
    while (game.visitedSquares.length < game.ROWS) {
      game.visitedSquares.push(Array(game.COLS).fill(false));
    }
    game.visitedSquares.length = game.ROWS;
    for (const row of game.visitedSquares) {
      const previousLength = row.length;
      row.length = game.COLS;
      if (previousLength < game.COLS) {
        row.fill(false, previousLength);
      }
    }
  };
  game.isInsideBoard = function (row, col) {
    return row >= 0 && row < game.ROWS && col >= 0 && col < game.COLS;
  };
  game.revealAdjacentSquares = function (visible, row, col) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const visibleRow = row + dr;
        const visibleCol = col + dc;
        if (game.isInsideBoard(visibleRow, visibleCol)) {
          visible[visibleRow][visibleCol] = true;
        }
      }
    }
  };
}
export function initialize(game) {
  game.CM_EDITOR_PAGE = typeof window !== "undefined" && game.CM_EDITOR_PAGE === true;
  game.canvas = document.getElementById("gameCanvas");
  game.ctx = game.canvas.getContext("2d");
  game.statusMessage = document.getElementById("statusMessage");
  game.playerCount = document.getElementById("playerCount");
  game.objectiveCount = document.getElementById("objectiveCount");
  game.targetPieceCount = document.getElementById("targetPieceCount");
  game.moveCountDisplay = document.getElementById("moveCount");
  game.fewestOtherMovesDisplay = document.getElementById("fewestOtherMoves");
  game.blockTipToggle = document.getElementById("blockTipToggle");
  game.blockTipModal = document.getElementById("blockTipModal");
  game.hintSolutionSummary = document.getElementById("hintSolutionSummary");
  game.hintSolutionActionBtn = document.getElementById("hintSolutionActionBtn");
  game.hintSolutionNote = document.getElementById("hintSolutionNote");
  game.inGameWalkthroughModal = document.getElementById("inGameWalkthroughModal");
  game.inGameWalkthroughTitle = document.getElementById("inGameWalkthroughTitle");
  game.inGameWalkthroughSubtitle = document.getElementById("inGameWalkthroughSubtitle");
  game.inGameWalkthroughCanvas = document.getElementById("inGameWalkthroughCanvas");
  game.inGameWalkthroughHint = document.getElementById("inGameWalkthroughHint");
  game.inGameWalkthroughStep = document.getElementById("inGameWalkthroughStep");
  game.inGameWalkthroughEvent = document.getElementById("inGameWalkthroughEvent");
  game.inGameReplayStepNav = document.getElementById("inGameReplayStepNav");
  game.closeInGameWalkthroughModalBtn = document.getElementById("closeInGameWalkthroughModal");
  game.inGameWalkthroughCloseBtn = document.getElementById("inGameWalkthroughCloseBtn");
  game.levelCompleteReplayStepNav = document.getElementById("levelCompleteReplayStepNav");
  game.undoMoveButton = document.getElementById("undoMoveBtn");
  game.antigravityToggleButton = document.getElementById("antigravityToggle");
  game.levelCompleteModal = document.getElementById("levelCompleteModal");
  game.levelCompleteText = document.getElementById("levelCompleteText");
  game.levelCompleteMoveCountDisplay = document.getElementById("levelCompleteMoveCount");
  game.levelCompleteFewestOtherMovesDisplay = document.getElementById("levelCompleteFewestOtherMoves");
  game.levelCompleteAchievement = document.getElementById("levelCompleteAchievement");
  game.levelCompleteReplayPanel = document.getElementById("levelCompleteReplayPanel");
  game.levelCompleteReplayLock = document.getElementById("levelCompleteReplayLock");
  game.levelCompleteReplayTitle = document.getElementById("levelCompleteReplayTitle");
  game.levelCompleteReplayCanvas = document.getElementById("levelCompleteReplayCanvas");
  game.levelCompleteReplaySubtitle = document.getElementById("levelCompleteReplaySubtitle");
  game.levelCompleteReplayHint = document.getElementById("levelCompleteReplayHint");
  game.levelCompleteReplayStep = document.getElementById("levelCompleteReplayStep");
  game.levelCompleteReplayEvent = document.getElementById("levelCompleteReplayEvent");
  game.levelCompleteReplayLockCostEl = document.getElementById("levelCompleteReplayLockCost");
  game.closeLevelCompleteModalBtn = document.getElementById("closeLevelCompleteModal");
  game.levelCompleteRetryBtn = document.getElementById("levelCompleteRetryBtn");
  game.levelCompleteNextBtn = document.getElementById("levelCompleteNextBtn");
  game.SHOW_IN_GAME_STATUS = false;
  game.TILE_SIZE = 60;
  game.ROWS = 10;
  game.COLS = 16;
  game.fallingPieces = [];
  game.fogEnabled = false;
  game.pendingMoveCounter = false;
  game.teleportBlocks = [];
  game.playerTeleportCooldowns = new Map();
  game.TELEPORT_COOLDOWN = 300;
  game.shakeAmount = 0;
  game.shakeDecay = 0.8;
  game.shakeX = 0;
  game.shakeY = 0;
  game.visitedSquares = Array.from({
    length: game.ROWS
  }, () => Array(game.COLS).fill(false));
  game.CELL_TYPES = {
    EMPTY: 0,
    SOLID_BLOCK: 1,
    // Regular solid block (green)
    PLAYER: 2,
    // Player piece
    GOAL: 3,
    // Goal (red king)
    PHASE_BLOCK: 4,
    // Phase-through block (blue)
    PHASE_BLOCK_ACTIVE: 5,
    // Phase block that has been activated (solid)
    TRANSFORMER: 6,
    // Transformer block (changes piece type)
    OBJECTIVE: 7,
    // Objective block (must be reached before goal)
    OBJECTIVE_COMPLETED: 8,
    // Completed objective block
    COUNTER_GOAL: 9,
    // Goal but with counter
    TELEPORT_PURPLE: 10,
    // Purple teleporter (pair 1)
    TELEPORT_GREEN: 11,
    // Green teleporter (pair 2)
    TELEPORT_BLUE: 12,
    // Blue teleporter (pair 3)
    TELEPORT_ORANGE: 13,
    // Orange teleporter (pair 4)
    BOMB: 14,
    // bomb block
    MOVING_PLATFORM: 15,
    // vertically moving platform
    BLACK_TARGET_PIECE: 16 // Capturable black piece required to unlock the goal
  };
  game.TELEPORT_COLORS = {
    [game.CELL_TYPES.TELEPORT_PURPLE]: {
      fill: "rgba(155, 89, 182, 0.8)",
      stroke: "rgba(255, 255, 255, 0.6)"
    },
    [game.CELL_TYPES.TELEPORT_GREEN]: {
      fill: "rgba(46, 204, 113, 0.8)",
      stroke: "rgba(255, 255, 255, 0.6)"
    },
    [game.CELL_TYPES.TELEPORT_BLUE]: {
      fill: "rgba(52, 152, 219, 0.8)",
      stroke: "rgba(255, 255, 255, 0.6)"
    },
    [game.CELL_TYPES.TELEPORT_ORANGE]: {
      fill: "rgba(243, 156, 18, 0.8)",
      stroke: "rgba(255, 255, 255, 0.6)"
    }
  };
  game.TELEPORT_DOOR_COLORS = {
    [game.CELL_TYPES.TELEPORT_PURPLE]: {
      door: "#7e3fa0",
      dark: "#4b2364",
      edge: "#c084fc",
      glow: "rgba(192, 132, 252, 0.55)"
    },
    [game.CELL_TYPES.TELEPORT_GREEN]: {
      door: "#27965c",
      dark: "#17613c",
      edge: "#86efac",
      glow: "rgba(134, 239, 172, 0.55)"
    },
    [game.CELL_TYPES.TELEPORT_BLUE]: {
      door: "#2577b8",
      dark: "#174c75",
      edge: "#93c5fd",
      glow: "rgba(147, 197, 253, 0.55)"
    },
    [game.CELL_TYPES.TELEPORT_ORANGE]: {
      door: "#c97819",
      dark: "#7c4510",
      edge: "#fdba74",
      glow: "rgba(253, 186, 116, 0.55)"
    }
  };
  game.PIECE_TYPES = ["rook", "bishop", "queen", "knight", "king", "pawn", "castle_rook"];
  game.bombImageSrc = game.CM_ASSETS && game.CM_ASSETS.pieces && game.CM_ASSETS.pieces.bomb || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='40' fill='black'/%3E%3Ccircle cx='35' cy='40' r='5' fill='white'/%3E%3Ccircle cx='45' cy='35' r='3' fill='white'/%3E%3Cpath d='M60,30 L75,25 L70,40 Z' fill='red'/%3E%3C/svg%3E";
  game.pieceImages = {
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
  game.targetPieceImages = {
    rook: new Image(),
    bishop: new Image(),
    queen: new Image(),
    knight: new Image(),
    king: new Image(),
    pawn: new Image()
  };
  (function loadPieceImagesFromAssets() {
    const pieces = game.CM_ASSETS && game.CM_ASSETS.pieces || {};
    const targets = game.CM_ASSETS && game.CM_ASSETS.targetPieces || {};
    game.pieceImages.rook.src = pieces.rook || "";
    game.pieceImages.castle_rook.src = pieces.castle_rook || pieces.rook || "";
    game.pieceImages.bishop.src = pieces.bishop || "";
    game.pieceImages.queen.src = pieces.queen || "";
    game.pieceImages.knight.src = pieces.knight || "";
    game.pieceImages.king.src = pieces.king || "";
    game.pieceImages.pawn.src = pieces.pawn || "";
    game.pieceImages.boom_right.src = pieces.boom_right || game.bombImageSrc;
    game.pieceImages.boom_left.src = pieces.boom_left || game.bombImageSrc;
    game.pieceImages.target.src = pieces.target || "";
    game.pieceImages.bomb.src = pieces.bomb || game.bombImageSrc;
    game.targetPieceImages.rook.src = targets.rook || "";
    game.targetPieceImages.bishop.src = targets.bishop || "";
    game.targetPieceImages.queen.src = targets.queen || "";
    game.targetPieceImages.knight.src = targets.knight || "";
    game.targetPieceImages.king.src = targets.king || pieces.target || "";
    game.targetPieceImages.pawn.src = targets.pawn || "";
  })();

  // tracker for players, goals, and objectives
  game.board = Array.from({
    length: game.ROWS
  }, () => Array(game.COLS).fill(game.CELL_TYPES.EMPTY));
  game.players = [];
  game.goal = null;
  game.objectives = [];
  game.objectivesCompleted = 0;
  game.totalObjectives = 0;
  game.targetPieces = [];
  game.targetPiecesCaptured = 0;
  game.totalTargetPieces = 0;
  game.phaseBlockStates = {};
  game.bombs = [];
  game.laserBlocks = [];
  game.ducks = [];
  game.DUCK_EMPTY_GAP = 3;
  game.DUCK_COLUMN_STEP = game.DUCK_EMPTY_GAP + 1;
  game.LASER_DIRECTIONS = [{
    dr: -1,
    dc: 0,
    name: "up"
  }, {
    dr: 1,
    dc: 0,
    name: "down"
  }, {
    dr: 0,
    dc: -1,
    name: "left"
  }, {
    dr: 0,
    dc: 1,
    name: "right"
  }];
  game.DEFAULT_LASER_DIRECTIONS = game.LASER_DIRECTIONS.map(direction => direction.name);
  game.DEFAULT_LASER_FIRE_EVERY_STEPS = 2;
  game.movingPlatforms = [];
  game.explodingPlayers = [];
  game.mode = game.CM_EDITOR_PAGE ? "edit" : "play";
  game.editMode = "player_rook";
  game.gravityEnabled = true;
  game.gameWon = false;
  game.selectedPlayerIndex = -1;
  // Track which player is selected
  game.teleportBlocks = []; // ✅ Clear teleport blocks
  game.currentPuzzleData = null;
  game.antigravityEnabled = false;
  game.risingPieces = [];
  game.lastRiseTime = 0;
  game.RISE_SPEED = 700;
  game.currentLevelIndex = 0;
  game.levelMoveCount = 0;
  game.fewestOtherMovesForLevel = null;
  game.fewestOtherMovesUserName = "";
  game.fewestOtherMovesReplayPath = null;
  game.fewestOtherMovesReplayMoveCounts = [];
  game.currentLevelMoveTrace = [];
  game.pendingMoveTraceEntry = null;
  game.levelCompleteReplayIndex = 0;
  game.moveHistorySnapshots = [];
  game.undoCredits = 0;
  game.antigravityCredits = 0;
  game.replayUnlockedForLevel = false;
  game.antigravityUnlockedThisRun = false;
  game.autoRestartScheduled = false;
}
