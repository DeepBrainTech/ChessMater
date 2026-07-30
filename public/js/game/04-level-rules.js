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
  if (board[row][col] === CELL_TYPES.MOVING_PLATFORM) {
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

  // Check if player moved through a phase block from below and activate it
  if (newRow < fromRow) { // Moving upward
    for (let r = newRow + 1; r < fromRow; r++) {
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
