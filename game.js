/**
 * Multi-Player Chess Puzzle with Gravity
 * Copyright (c) 2024 [DeepBrainTech]
 * 
 * Chess piece images attribution:
 * - Created by Cburnett (https://en.wikipedia.org/wiki/User:Cburnett)
 * - Licensed under Creative Commons Attribution-ShareAlike 3.0 Unported (CC BY-SA 3.0)
 * - Source: https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces
 */

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const statusMessage = document.getElementById("statusMessage");
const playerCount = document.getElementById("playerCount");
const objectiveCount = document.getElementById("objectiveCount");
// const gravityBtn = document.getElementById("gravityBtn");
const downloadBtn = document.getElementById("downloadBtn");
const eraseBoardBtn = document.getElementById("eraseBoardBtn");
const puzzleNameInput = document.getElementById("puzzleName");
const saveNotice = document.getElementById("saveNotice");

//default board dimensions
const TILE_SIZE = 60;
let ROWS = 10;
let COLS = 16;
const DEFAULT_ROWS = 10;
const DEFAULT_COLS = 16;
let fallingPieces = [];
let fogEnabled = false;
let pendingMoveCounter = false;
let teleportBlocks = [];
let playerTeleportCooldowns = new Map();
const TELEPORT_COOLDOWN = 300;

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

let mode = "edit";     // edit or play
let editMode = "player_rook"; // tool in edit mode
let gravityEnabled = true;
let gameWon = false;
let selectedPlayerIndex = -1; // Track which player is selected
teleportBlocks = []; // ✅ Clear teleport blocks

// Transformer block variables
let showTransformerMenu = false;
let transformerPosition = null;
let transformerPlayerIndex = -1;

document.getElementById("boardSize").addEventListener("change", (e) => {
  const size = e.target.value;
  
  if (size === "custom") {
    document.getElementById("customSizeInputs").style.display = "block";
  } else {
    document.getElementById("customSizeInputs").style.display = "none";
    
    switch(size) {
      case "8x8":
        resizeBoard(8, 8);
        break;
      case "12x20":
        resizeBoard(12, 20);
        break;
      case "6x10":
        resizeBoard(6, 10);
        break;
      default: // 10x16
        resizeBoard(10, 16);
        break;
    }
  }
});

document.getElementById("visibilityMode").addEventListener("change", (e) => {
  fogEnabled = (e.target.value === "fog");
  updateStatus(`Mode switched to ${fogEnabled ? "Fog of War" : "Classic"}`);
});

document.getElementById("applyCustomSize").addEventListener("click", () => {
  const customRows = parseInt(document.getElementById("customRows").value) || DEFAULT_ROWS;
  const customCols = parseInt(document.getElementById("customCols").value) || DEFAULT_COLS;
  
  // Validate dimensions
  const validRows = Math.min(Math.max(customRows, 4), 20);
  const validCols = Math.min(Math.max(customCols, 4), 30);
  
  resizeBoard(validRows, validCols);
});

document.getElementById("modeSelect").addEventListener("change", (e) => {
  mode = e.target.value;
  selectedPlayerIndex = -1; // Deselect when switching modes
  updateStatus(`Mode: ${mode === 'edit' ? 'Edit Mode' : 'Play Mode'}`);
  
  // Reset phase block states when switching to edit mode
  if (mode === "edit") {
    resetPhaseBlocks();
  }
  
  // Close transformer menu when switching modes
  showTransformerMenu = false;
  transformerPosition = null;
  transformerPlayerIndex = -1;
  
  // Apply gravity automatically when switching to play mode
  if (mode === "play" && gravityEnabled && !gameWon) {
    applyGravity();
  }
});

document.getElementById("editMode").addEventListener("change", (e) => {
  editMode = e.target.value;
  updateStatus(`Tool: ${editMode.replace('player_', '')}`);

  // Show counter input only for counter goal
  document.getElementById("counterGoalSettings").style.display =
    editMode === "counter_goal" ? "block" : "none";
});

// gravityBtn.addEventListener("click", () => {
//   applyGravity();
// });

downloadBtn.addEventListener("click", () => {
  saveLevelToFolder();
});

eraseBoardBtn.addEventListener("click", () => {
  if (confirm("Are you sure you want to erase the entire board? This cannot be undone.")) {
    eraseBoard();
  }
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
  canvas.style.width = `${COLS * TILE_SIZE}px`;
  canvas.style.height = `${ROWS * TILE_SIZE}px`;
}

function updateStatus(message) {
  statusMessage.textContent = message;
  setTimeout(() => {
    if (statusMessage.textContent === message) {
      statusMessage.textContent = '';
    }
  }, 3000);
}

function updatePlayerCount() {
  playerCount.textContent = `Players: ${players.length}`;
}

// Update objective counter display
function updateObjectiveCount() {
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

// --- Erase the entire board ---
function eraseBoard() {
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(CELL_TYPES.EMPTY));
  players = [];
  goal = null;
  objectives = [];
  objectivesCompleted = 0;
  totalObjectives = 0;
  gameWon = false;
  selectedPlayerIndex = -1;
  resetPhaseBlocks();
  showTransformerMenu = false;
  transformerPosition = null;
  transformerPlayerIndex = -1;
  
  updatePlayerCount();
  updateObjectiveCount();
  updateStatus(`Board cleared! Size: ${ROWS}x${COLS}`);
}

// --- Save level to levels folder ---
// --- Save level to levels folder ---
function saveLevelToFolder() {
  if (players.length === 0) {
    updateStatus("Please add at least one player before saving");
    return;
  }
  
  if (!goal) {
    updateStatus("Please add a goal before saving");
    return;
  }
  
  const puzzleName = puzzleNameInput.value || "chess_puzzle";
  
  // Create puzzle data object - FIXED: Include all goal properties
  const puzzleData = {
    version: "1.3",
    name: puzzleName,
    rows: ROWS,
    cols: COLS,
    board: board,
    players: players,
    goal: goal, // This should include type and counter if it's a counter goal
    objectives: objectives,
    createdAt: new Date().toISOString()
  };
  
  // Convert to JSON string
  const jsonString = JSON.stringify(puzzleData, null, 2);
  
  // Create download link with levels/ path
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(jsonString);
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", `${puzzleName.replace(/\s+/g, '_')}.json`);
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
  
  // Show save notice
  saveNotice.style.display = 'block';
  setTimeout(() => {
    saveNotice.style.display = 'none';
  }, 3000);
  
  updateStatus(`Puzzle "${puzzleName}" saved to levels folder!`);
}

// --- Load puzzle from JSON file ---
// --- Load puzzle from JSON file ---
function loadPuzzle(puzzleData) {
  try {
    // Use saved dimensions or default to current
    const loadedRows = puzzleData.rows || ROWS;
    const loadedCols = puzzleData.cols || COLS;
    
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

    if (typeof enablePlayerControls === "function") {
        enablePlayerControls();
    }

    drawBoard();
  } catch (error) {
    updateStatus("Error loading puzzle: " + error.message);
  }
}

// --- Handle file upload for loading puzzles ---
function setupFileUpload() {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);
  
  fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const puzzleData = JSON.parse(e.target.result);
        loadPuzzle(puzzleData);
      } catch (error) {
        updateStatus("Error parsing puzzle file: " + error.message);
      }
    };
    reader.readAsText(file);
  });
  
  // Add load button to UI
  const loadButton = document.createElement('button');
  loadButton.textContent = 'Load Puzzle from Levels';
  loadButton.addEventListener('click', () => {
    fileInput.click();
  });
  
  document.querySelector('.download-section').appendChild(loadButton);
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
  const fallSpeed = 5;

  for (let i = fallingPieces.length - 1; i >= 0; i--) {
    const piece = fallingPieces[i];
    const targetY = piece.targetRow * TILE_SIZE;
    const prevY = piece.y;

    // Move piece down
    piece.y += fallSpeed;

    // --- 💡 NEW: Check if we've passed through a teleport block mid-fall
    const prevRow = Math.floor(prevY / TILE_SIZE);
    const currentRow = Math.floor(piece.y / TILE_SIZE);

    if (currentRow !== prevRow) {
      for (let r = prevRow + 1; r <= currentRow; r++) {
        const cellType = board[r][piece.col];
        if ([CELL_TYPES.TELEPORT_PURPLE, CELL_TYPES.TELEPORT_GREEN, CELL_TYPES.TELEPORT_BLUE, CELL_TYPES.TELEPORT_ORANGE].includes(cellType)) {
          // ⏩ Teleport immediately!
          const player = players[piece.playerIndex];

          // Set position before teleporting
          player.row = r;
          player.col = piece.col;

          // Clean up fall piece
          fallingPieces.splice(i, 1);

          // Trigger teleport
          handleGravityTeleport(player, cellType);

          return; // Skip rest of loop for this frame
        }
      }
    }

    // --- Usual landing logic
    if (piece.y >= targetY) {
      piece.y = targetY;

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
          board[player.row][player.col] = CELL_TYPES.PLAYER;
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
function checkWinCondition() {
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
      updateStatus("🎉 Puzzle solved! All objectives completed and goal reached!");
      triggerConfetti();
      break;
    }
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

  // Block if the cell is otherwise invalid (except transformer)
  if (board[newRow][newCol] !== CELL_TYPES.TRANSFORMER && 
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
  if (!isValidMove(playerIndex, newRow, newCol)) {
    // Check if the move was invalid because goal is locked
    if (board[newRow][newCol] === CELL_TYPES.GOAL && !areAllObjectivesCompleted()) {
      updateStatus("Complete all objectives first! " + objectivesCompleted + "/" + totalObjectives);
    } else {
      updateStatus("Invalid move for " + player.pieceType);
    }
    return;
  }

  // Check if destination is ANY teleport block type BEFORE moving
  const isTeleportBlock = [
    CELL_TYPES.TELEPORT_PURPLE,
    CELL_TYPES.TELEPORT_GREEN,
    CELL_TYPES.TELEPORT_BLUE,
    CELL_TYPES.TELEPORT_ORANGE
  ].includes(board[newRow][newCol]);

  // Check if destination is a transformer block BEFORE moving
  const isTransformerBlock = board[newRow][newCol] === CELL_TYPES.TRANSFORMER;

  board[player.row][player.col] = CELL_TYPES.EMPTY;
  player.row = newRow;
  player.col = newCol;

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

  // Check for objective completion after moving
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

  // Apply gravity after moving
  if (gravityEnabled) {
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
  } else {
    // Gravity off → decrement now (after checking for immediate win above)
    decrementCounterAfterMove();
  }

  const moveSound = document.getElementById("moveSound");
  if (moveSound) {
    moveSound.currentTime = 0; // reset to start for rapid reuse
    moveSound.play().catch(err => console.warn("Sound play blocked:", err));
  }

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
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
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
  
  if (x < menuBounds.left || x > menuBounds.right || y < menuBounds.top || y > menuBounds.bottom) {
    showTransformerMenu = false;
    
    if (transformerPosition) {
      board[transformerPosition.row][transformerPosition.col] = CELL_TYPES.PLAYER;
    }
    
    transformerPosition = null;
    transformerPlayerIndex = -1;
    updateStatus("Transformation cancelled");
    
    if (gravityEnabled) {
      applyGravity();
    }
  }
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

  if (!fogEnabled) {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) visible[r][c] = true;
    return visible;
  }

  if (mode === "edit") {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) visible[r][c] = true;
    return visible;
  }

  if (selectedPlayerIndex >= 0) {
    const p = players[selectedPlayerIndex];
    visible[p.row][p.col] = true;

    // get vision directions based on piece type
    let directions = [];
    if (p.pieceType === "queen") {
      directions = [
        [-1,0],[1,0],[0,-1],[0,1], // rook-like
        [-1,-1],[-1,1],[1,-1],[1,1] // bishop-like
      ];
    }
    // you could add rook/bishop/knight rules here too

    // extend vision along each direction
    for (const [dr, dc] of directions) {
      let r = p.row + dr, c = p.col + dc;
      while (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
        visible[r][c] = true;

        // stop if something is blocking (solid block, piece, etc.)
        if (board[r][c] !== CELL_TYPES.EMPTY) break;

        r += dr;
        c += dc;
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
      ctx.fillStyle = (r + c) % 2 === 0 ? "#EEE" : "#CCC";
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

  // draw normal (non-falling) players
  players.forEach((player, i) => {
    const isFalling = fallingPieces.find(fp => fp.playerIndex === i);
    if (!isFalling) {
      const x = player.col * TILE_SIZE;
      const y = player.row * TILE_SIZE;
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
  //const Winsound = new Audio("woo-hoo-82843.mp3");
  const Winsound = new Audio("completion.mp3");
  Winsound.currentTime = 0;
  Winsound.volume = 0.7;
  Winsound.play().catch(err => console.log("Audio err", err));
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
      // Remove player
      players.splice(hitPlayerIndex, 1);
      updateStatus("💥 A player was hit by a bomb!");
      updatePlayerCount();
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

    // Check for collision with player
    const hitPlayerIndex = players.findIndex(p => p.row === bomb.row && p.col === nextCol);
    if (hitPlayerIndex !== -1) {
      // Remove the player that got hit
      players.splice(hitPlayerIndex, 1);
      updateStatus("💣 A player was blown up!");
      updatePlayerCount();
      
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
  let x = e.clientX - rect.left;
  let y = e.clientY - rect.top;
  let col = Math.floor(x / TILE_SIZE);
  let row = Math.floor(y / TILE_SIZE);

  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return;

  if (mode === "edit") {
    if (editMode === "block") {
      board[row][col] = CELL_TYPES.SOLID_BLOCK;
      updateStatus(`Solid block placed at (${row}, ${col})`);
    } else if (editMode === "phase_block") {
      board[row][col] = CELL_TYPES.PHASE_BLOCK;
      updateStatus(`Phase-through block placed at (${row}, ${col})`);
    } else if (editMode === "transformer") {
      board[row][col] = CELL_TYPES.TRANSFORMER;
      updateStatus(`Transformer block placed at (${row}, ${col})`);
    } else if (editMode === "teleport") {
      board[row][col] = CELL_TYPES.TELEPORT;
      // Add to teleportBlocks array if not already there
      if (!teleportBlocks.some(tp => tp.row === row && tp.col === col)) {
        teleportBlocks.push({ row, col });
      }
      updateStatus(`Teleport block placed at (${row}, ${col})`);
    } else if (editMode === "objective") {
      // Check if there's already an objective here
      const existingObjective = objectives.find(obj => obj.row === row && obj.col === col);
      if (!existingObjective) {
        board[row][col] = CELL_TYPES.OBJECTIVE;
        objectives.push({ row, col, completed: false });
        totalObjectives = objectives.length;
        updateObjectiveCount();
        updateStatus(`Objective placed at (${row}, ${col}). Total: ${totalObjectives}`);
      } else {
        updateStatus("Objective already exists at this position");
      }
    } else if (editMode === "erase") {
      board[row][col] = CELL_TYPES.EMPTY;

      // Remove from teleportBlocks if it was a teleport block
      const teleportIndex = teleportBlocks.findIndex(tp => tp.row === row && tp.col === col);
      if (teleportIndex !== -1) {
        teleportBlocks.splice(teleportIndex, 1);
      }
      
      // Remove player if one was at this position
      const playerIndex = getPlayerAt(row, col);
      if (playerIndex !== -1) {
        players.splice(playerIndex, 1);
        updatePlayerCount();
      }
      
      // Remove goal if it was at this position
      if (goal && goal.row === row && goal.col === col) {
        goal = null;
      }
      
      // Remove objective if one was at this position
      const objectiveIndex = objectives.findIndex(obj => obj.row === row && obj.col === col);
      if (objectiveIndex !== -1) {
        objectives.splice(objectiveIndex, 1);
        totalObjectives = objectives.length;
        objectivesCompleted = objectives.filter(obj => obj.completed).length;
        updateObjectiveCount();
      }
      
      updateStatus(`Cell cleared at (${row}, ${col})`);
    } else if (editMode.startsWith("player_")) {
      // Extract piece type from edit mode
      const piece = editMode.split("_")[1];
      
      // Allow placing multiple players on the same cell (stacking)
      board[row][col] = CELL_TYPES.PLAYER;
      players.push({ row, col, pieceType: piece });
      updatePlayerCount();
      updateStatus(`${piece.charAt(0).toUpperCase() + piece.slice(1)} placed at (${row}, ${col}). Total: ${players.length}`);
      
      // Apply gravity after placing
      if (gravityEnabled) {
        applyGravity();
      }
    } else if (editMode.startsWith("teleport_")) {
      const color = editMode.split("_")[1]; // "purple", "green", etc.
      const teleportType = {
        purple: CELL_TYPES.TELEPORT_PURPLE,
        green: CELL_TYPES.TELEPORT_GREEN,
        blue: CELL_TYPES.TELEPORT_BLUE,
        orange: CELL_TYPES.TELEPORT_ORANGE
      }[color];
      
      if (teleportType) {
        board[row][col] = teleportType;
        // Add to teleportBlocks array if not already there
        if (!teleportBlocks.some(tp => tp.row === row && tp.col === col)) {
          teleportBlocks.push({ row, col, type: teleportType });
        }
        updateStatus(`${color.charAt(0).toUpperCase() + color.slice(1)} teleporter placed at (${row}, ${col})`);
      }
    } else if (editMode === "goal") {
      if (goal) board[goal.row][goal.col] = CELL_TYPES.EMPTY;
      board[row][col] = CELL_TYPES.GOAL;
      goal = { row, col };
      updateStatus(`Goal placed at (${row}, ${col})`);
      
      // Apply gravity after placing
      if (gravityEnabled) {
        applyGravity();
      }
    } else if (editMode === "counter_goal") {
      if (goal) board[goal.row][goal.col] = CELL_TYPES.EMPTY;

      const moves = parseInt(document.getElementById("counterGoalMoves").value) || 5;

      board[row][col] = CELL_TYPES.COUNTER_GOAL;
      goal = { row, col, type: "counter", counter: moves };

      updateStatus(`Counter Goal placed at (${row}, ${col}) with ${goal.counter} moves`);
    } else if (editMode === "bomb") {
      // Only place bomb on empty cells
      if (board[row][col] === CELL_TYPES.EMPTY) {
        board[row][col] = CELL_TYPES.BOMB;
        bombs.push({ row, col, direction: 1 }); // Default moving right
        updateStatus(`Bomb placed at (${row}, ${col})`);
      } else {
        updateStatus("Cannot place bomb on occupied cell");
      }
    }
  } else if (mode === "play") {
    if (players.length === 0) {
      updateStatus("Place at least one player piece first in Edit Mode");
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

canvas.addEventListener("click", handleMove);

// --- Add keyboard controls for deselection ---
document.addEventListener("keydown", (e) => {
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
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  updateFallingPieces();

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

// Initialize the game
initializeCanvas();
updateStatus("Welcome to Multi-Player Chess Puzzle with Gravity! Start by placing your player pieces.");
updatePlayerCount();
updateObjectiveCount();
setupFileUpload(); // Set up file upload functionality
gameLoop();