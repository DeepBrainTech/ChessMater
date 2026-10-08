import { session } from '../../services/session.js';
export function register(game) {
  game.loadPuzzle = // --- Load puzzle from JSON file ---
  function (puzzleData) {
    game.currentPuzzleData = JSON.parse(JSON.stringify(puzzleData)); // Deep copy
    game.moveHistorySnapshots = [];
    game.showTransformerMenu = false;
    game.transformerPosition = null;
    game.transformerPlayerIndex = -1;
    if (game.levelCompleteModal) {
      game.levelCompleteModal.classList.remove("active");
    }
    try {
      // Use saved dimensions or default to current
      const loadedRows = puzzleData.rows || game.ROWS;
      const loadedCols = puzzleData.cols || game.COLS;
      game.fogEnabled = !!puzzleData.fog; // Default to false if property is missing
      const fogToggleBtn = document.getElementById("levelFogToggle");
      if (fogToggleBtn) {
        fogToggleBtn.checked = game.fogEnabled;
      }

      // Resize board first
      game.resizeBoard(loadedRows, loadedCols);

      // Clear current board
      game.board = Array.from({
        length: loadedRows
      }, () => Array(loadedCols).fill(game.CELL_TYPES.EMPTY));

      // Recreate board state (handle different sizes)
      const copyRows = Math.min(loadedRows, puzzleData.board.length);
      const copyCols = Math.min(loadedCols, puzzleData.board[0].length);
      for (let r = 0; r < copyRows; r++) {
        for (let c = 0; c < copyCols; c++) {
          game.board[r][c] = puzzleData.board[r][c];
        }
      }
      game.bombs = [];
      if (Array.isArray(puzzleData.bombs)) {
        game.bombs = puzzleData.bombs.filter(b => b.row < loadedRows && b.col < loadedCols).map(game.normalizeBombData);
      }
      game.laserBlocks = [];
      if (Array.isArray(puzzleData.laserBlocks)) {
        game.laserBlocks = puzzleData.laserBlocks.map(game.normalizeLaserBlockData).filter(laser => Number.isFinite(laser.row) && Number.isFinite(laser.col) && laser.row >= 0 && laser.row < loadedRows && laser.col >= 0 && laser.col < loadedCols);
      }
      game.ducks = [];
      if (Array.isArray(puzzleData.ducks)) {
        game.ducks = puzzleData.ducks.map(game.normalizeDuckData).filter(duck => Number.isFinite(duck.row) && Number.isFinite(duck.col) && duck.row >= 0 && duck.row < loadedRows && duck.col >= 0 && duck.col < loadedCols);
      }
      game.movingPlatforms = [];
      if (Array.isArray(puzzleData.movingPlatforms)) {
        game.movingPlatforms = puzzleData.movingPlatforms.filter(platform => platform.row < loadedRows && platform.col < loadedCols).map(game.normalizeMovingPlatformData);
      }

      // Recreate players (filter out ones that don't fit)
      game.players = [];
      if (puzzleData.players && Array.isArray(puzzleData.players)) {
        puzzleData.players.filter(player => player.row < loadedRows && player.col < loadedCols).forEach(player => {
          const pieceType = player.pieceType || "rook";
          if (game.isBoomPieceType(pieceType)) {
            game.bombs.push(game.createBoomBomb(player.row, player.col, pieceType));
            game.board[player.row][player.col] = game.CELL_TYPES.BOMB;
            return;
          }
          game.players.push({
            row: player.row,
            col: player.col,
            pieceType,
            hasMoved: !!player.hasMoved
          });
        });
      }
      for (const b of game.bombs) {
        game.board[b.row][b.col] = game.CELL_TYPES.BOMB;
      }
      for (const laser of game.laserBlocks) {
        game.board[laser.row][laser.col] = game.CELL_TYPES.SOLID_BLOCK;
      }
      for (const platform of game.movingPlatforms) {
        if (platform.axis === "horizontal") {
          platform.col = game.clampPlatformCol(platform.currentCol);
        } else {
          platform.row = game.platformLevelToRow(platform.currentLevel);
        }
        game.board[platform.row][platform.col] = game.CELL_TYPES.MOVING_PLATFORM;
      }
      for (const p of game.players) {
        game.visitedSquares[p.row][p.col] = true;
      }

      // Recreate goal (only if it fits) - FIXED: Preserve counter goal data
      if (puzzleData.goal && puzzleData.goal.row < loadedRows && puzzleData.goal.col < loadedCols) {
        // Check if it's a counter goal and preserve all properties
        if (puzzleData.goal.type === "counter") {
          game.goal = {
            row: puzzleData.goal.row,
            col: puzzleData.goal.col,
            type: "counter",
            counter: puzzleData.goal.counter || 5 // Default to 5 if missing
          };
        } else {
          // Regular goal
          game.goal = {
            row: puzzleData.goal.row,
            col: puzzleData.goal.col
          };
        }
      } else {
        game.goal = null;
      }

      // Recreate objectives (filter out ones that don't fit)
      if (puzzleData.objectives && Array.isArray(puzzleData.objectives)) {
        game.objectives = puzzleData.objectives.filter(obj => obj.row < loadedRows && obj.col < loadedCols).map(obj => ({
          row: obj.row,
          col: obj.col,
          completed: obj.completed || false
        }));

        // 💣 Recreate bombs from saved data
        game.totalObjectives = game.objectives.length;
        game.objectivesCompleted = game.objectives.filter(obj => obj.completed).length;
      } else {
        game.objectives = [];
        game.totalObjectives = 0;
        game.objectivesCompleted = 0;
      }
      game.targetPieces = [];
      if (Array.isArray(puzzleData.targetPieces)) {
        game.targetPieces = puzzleData.targetPieces.map(game.normalizeTargetPieceData).filter(piece => Number.isFinite(piece.row) && Number.isFinite(piece.col) && piece.row >= 0 && piece.row < loadedRows && piece.col >= 0 && piece.col < loadedCols);
        game.totalTargetPieces = game.targetPieces.length;
        game.targetPiecesCaptured = game.targetPieces.filter(piece => piece.captured).length;
        for (const piece of game.targetPieces) {
          if (!piece.captured) {
            game.board[piece.row][piece.col] = game.CELL_TYPES.BLACK_TARGET_PIECE;
          }
        }
      } else {
        game.targetPieces = [];
        game.totalTargetPieces = 0;
        game.targetPiecesCaptured = 0;
      }
      game.teleportBlocks = [];
      for (let r = 0; r < loadedRows; r++) {
        for (let c = 0; c < loadedCols; c++) {
          if ([game.CELL_TYPES.TELEPORT_PURPLE, game.CELL_TYPES.TELEPORT_GREEN, game.CELL_TYPES.TELEPORT_BLUE, game.CELL_TYPES.TELEPORT_ORANGE].includes(game.board[r][c])) {
            game.teleportBlocks.push({
              row: r,
              col: c,
              type: game.board[r][c]
            });
          }
        }
      }
      game.updatePlayerCount();
      game.updateObjectiveCount();
      game.updateTargetPieceCount();
      game.updateStatus(`Puzzle "${puzzleData.name}" loaded successfully! Size: ${loadedRows}x${loadedCols}`);
      // ✅ Reset state so pieces can move again
      game.mode = "play";
      game.gameWon = false;
      game.antigravityEnabled = false;
      game.antigravityUnlockedThisRun = false;
      game.frameCount = 0;
      game.levelMoveCount = 0;
      game.updateMoveCountDisplay();
      game.updateAntigravityButtonLabel();
      game.updateFewestOtherMovesDisplay(null, null, "", false);
      game.resetCurrentLevelMoveTrace();
      game.visitedSquares.forEach(row => row.fill(false)); // Reset fog on load
      if (typeof game.enablePlayerControls === "function") {
        game.enablePlayerControls();
      }
      const descText = document.getElementById("blockDescription");
      game.currentLevelIndex = game.LEVELS.findIndex(lvl => lvl.name === puzzleData.name);
      if (typeof game.highlightCurrentLevelButton === "function") {
        game.highlightCurrentLevelButton();
      }
      if (descText) {
        const rawTip = puzzleData.blockTip != null ? String(puzzleData.blockTip).trim() : "";
        descText.textContent = rawTip || "No tip for this level.";
      }
      if (session.authReady && typeof session.authReady.finally === "function") {
        session.authReady.finally(() => {
          game.fetchFewestOtherMovesForCurrentLevel();
        });
      } else {
        game.fetchFewestOtherMovesForCurrentLevel();
      }
      game.drawBoard();
    } catch (error) {
      game.updateStatus("Error loading puzzle: " + error.message);
    }
  };
  game.decrementCounterAfterMove = function () {
    // If landing on goal won the game, do nothing
    game.checkWinCondition();
    if (game.gameWon) return;
    if (game.goal && game.goal.type === "counter" && game.goal.counter > 0) {
      game.goal.counter--;
      game.updateStatus(`Counter goal: ${game.goal.counter} moves remaining`);
      if (game.goal.counter <= 0) {
        game.updateStatus("Counter goal locked!");
      }
    }
  };
  game.isCellBlocked = // --- Check if a cell is occupied by a block or player ---
  function (row, col, ignorePlayer = null, fromDirection = null) {
    // Check if cell has a solid block (but allow transformer blocks)
    if (game.board[row][col] === game.CELL_TYPES.SOLID_BLOCK) {
      return true;
    }
    if (game.board[row][col] === game.CELL_TYPES.MOVING_PLATFORM) {
      return true;
    }
    if (game.getDuckAt(row, col) !== -1) {
      return true;
    }
    if (game.board[row][col] === game.CELL_TYPES.BLACK_TARGET_PIECE) {
      return true;
    }

    // Check if cell has a goal that's not yet accessible
    if (game.board[row][col] === game.CELL_TYPES.GOAL && !game.areAllObjectivesCompleted()) {
      return true; // Goal acts as solid block until objectives are completed
    }
    if (game.board[row][col] === game.CELL_TYPES.COUNTER_GOAL) {
      if (!game.areAllObjectivesCompleted() || game.goal && game.goal.type === "counter" && game.goal.counter <= 0) {
        return true; // block movement
      }
    }

    // Check if cell has an active phase block (always solid)
    if (game.board[row][col] === game.CELL_TYPES.PHASE_BLOCK_ACTIVE) return true;

    // Check if cell has an inactive phase block
    if (game.board[row][col] === game.CELL_TYPES.PHASE_BLOCK) {
      // Allow passing through phase blocks from below, but block from above/sides
      if (fromDirection === "below") {
        return false; // Can pass through from below
      } else {
        return true; // Block from above and sides (should stand on top)
      }
    }

    // Check if cell has a player (optionally ignore a specific player)
    for (const player of game.players) {
      // Skip the player we're ignoring (useful for checking if a player can move to their own position)
      if (ignorePlayer && player === ignorePlayer) continue;
      if (player.row === row && player.col === col) {
        return true;
      }
    }
    return false;
  };
  game.activatePhaseBlock = // Activate a phase block (make it solid)
  function (row, col) {
    if (game.board[row][col] === game.CELL_TYPES.PHASE_BLOCK) {
      game.board[row][col] = game.CELL_TYPES.PHASE_BLOCK_ACTIVE;
      game.phaseBlockStates[`${row},${col}`] = true;
    }
  };
  game.applyGravity = // --- Apply gravity to all pieces ---
  function () {
    if (game.gameWon) return;
    for (let i = 0; i < game.players.length; i++) {
      const player = game.players[i];
      const newRow = game.findFallPosition(player.row, player.col);
      if (newRow !== player.row) {
        const landingCellType = game.board[newRow][player.col];
        const isTeleportBlock = [game.CELL_TYPES.TELEPORT_PURPLE, game.CELL_TYPES.TELEPORT_GREEN, game.CELL_TYPES.TELEPORT_BLUE, game.CELL_TYPES.TELEPORT_ORANGE].includes(landingCellType);
        game.fallingPieces.push({
          playerIndex: i,
          startRow: player.row,
          targetRow: newRow,
          col: player.col,
          y: player.row * game.TILE_SIZE,
          pieceType: player.pieceType,
          isTeleport: isTeleportBlock,
          teleportType: isTeleportBlock ? landingCellType : null
        });

        // Clear board spot early so ghost rendering is manual
        game.board[player.row][player.col] = game.CELL_TYPES.EMPTY;
      }
    }
    if (game.goal) {
      const newRow = game.findFallPosition(game.goal.row, game.goal.col);
      if (newRow !== game.goal.row) {
        game.fallingPieces.push({
          playerIndex: "goal",
          startRow: game.goal.row,
          targetRow: newRow,
          col: game.goal.col,
          y: game.goal.row * game.TILE_SIZE,
          pieceType: "target"
        });
        game.board[game.goal.row][game.goal.col] = game.CELL_TYPES.EMPTY;
      }
    }
  };
  game.updateFallingPieces = function () {
    const fallSpeed = 3;
    for (let i = game.fallingPieces.length - 1; i >= 0; i--) {
      const piece = game.fallingPieces[i];
      let targetY = piece.targetRow * game.TILE_SIZE;
      const prevY = piece.y;

      // Move piece down
      piece.y += fallSpeed;

      // Check if we've passed through a bomb mid-fall
      const prevRow = Math.floor(prevY / game.TILE_SIZE);
      const currentRow = Math.floor(piece.y / game.TILE_SIZE);
      if (currentRow !== prevRow) {
        for (let r = prevRow + 1; r <= Math.min(currentRow, game.ROWS - 1); r++) {
          // A falling piece can land on a duck that moves into the same column.
          // The duck itself occupies row r, so the piece lands one cell above it.
          if (game.getDuckAt(r, piece.col) !== -1 && r > 0) {
            piece.targetRow = r - 1;
            targetY = piece.targetRow * game.TILE_SIZE;
            if (piece.y >= targetY) {
              piece.y = targetY;
            }
            break;
          }

          // Check if landing on a bomb during fall
          if (game.board[r][piece.col] === game.CELL_TYPES.BOMB) {
            // Handle bomb collision for falling piece
            if (piece.playerIndex === "goal") {
              // Goal hit a bomb - remove goal
              game.fallingPieces.splice(i, 1);
              game.goal = null;
              game.updateStatus("💣 Goal destroyed by bomb!");
            } else {
              // Player hit a bomb
              const player = game.players[piece.playerIndex];
              game.handleBombCollision(player, piece.playerIndex, r, piece.col);
              game.fallingPieces.splice(i, 1);
            }
            return; // Skip rest of loop for this frame
          }
        }
      }

      // --- Usual landing logic
      if (piece.y >= targetY) {
        piece.y = targetY;

        // Check if landing on a bomb
        if (game.board[piece.targetRow][piece.col] === game.CELL_TYPES.BOMB) {
          if (piece.playerIndex === "goal") {
            // Goal hit a bomb
            game.fallingPieces.splice(i, 1);
            game.goal = null;
            game.updateStatus("💣 Goal destroyed by bomb!");
          } else {
            // Player hit a bomb
            const player = game.players[piece.playerIndex];
            game.handleBombCollision(player, piece.playerIndex, piece.targetRow, piece.col);
            game.fallingPieces.splice(i, 1);
          }
          continue;
        }
        if (piece.playerIndex === "goal") {
          game.goal.row = piece.targetRow;
          game.board[game.goal.row][piece.col] = game.CELL_TYPES.GOAL;
        } else {
          const player = game.players[piece.playerIndex];

          // Check if landing on a teleport block
          const landingCellType = game.board[piece.targetRow][piece.col];
          const isTeleportBlock = [game.CELL_TYPES.TELEPORT_PURPLE, game.CELL_TYPES.TELEPORT_GREEN, game.CELL_TYPES.TELEPORT_BLUE, game.CELL_TYPES.TELEPORT_ORANGE].includes(landingCellType);
          if (isTeleportBlock) {
            // Don't place player on board - let teleport logic handle it
            player.row = piece.targetRow;
            player.col = piece.col;
            game.handleGravityTeleport(player, landingCellType);
          } else {
            // Normal landing
            player.row = piece.targetRow;
            player.col = piece.col;
            const cellType = game.board[player.row][player.col];
            if (cellType === game.CELL_TYPES.TRANSFORMER) {
              // ✅ Activate transformer behavior
              game.transformerPlayerIndex = piece.playerIndex;
              game.transformerPosition = {
                row: player.row,
                col: player.col
              };
              game.showTransformerMenu = true;
              game.updateStatus("Transformer activated! Choose a new piece type.");
              // Do not overwrite the transformer cell
            } else {
              game.board[player.row][player.col] = game.CELL_TYPES.PLAYER;
            }
            game.playerTeleportCooldowns.delete(player);
            game.checkObjectiveCompletion();
            game.checkWinCondition();
          }
        }
        game.fallingPieces.splice(i, 1);

        // Decrement counter if nothing else is falling
        if (game.fallingPieces.length === 0 && game.pendingMoveCounter) {
          game.decrementCounterAfterMove();
          game.pendingMoveCounter = false;
        }
      }
    }
  };
  game.showLevelCompleteModal = function () {
    if (!game.levelCompleteModal) return;
    const hasNext = game.currentLevelIndex < game.LEVELS.length - 1;
    game.levelCompleteReplayIndex = 0;
    game.updateLevelCompleteStatsDisplay();
    game.updateLevelCompleteReplayDisplay();
    if (game.levelCompleteText) {
      game.levelCompleteText.textContent = hasNext ? "Great job!" : "Great job! You finished the final level. You can retry this level.";
    }
    if (game.levelCompleteNextBtn) {
      game.levelCompleteNextBtn.style.display = hasNext ? "inline-block" : "none";
    }
    game.levelCompleteModal.classList.add("active");
    void game.fetchFewestOtherMovesForCurrentLevel();
  };
  game.handleGravityTeleport = function (player, teleportType) {
    // Get all teleport blocks of the same color
    const sameColorTeleports = game.teleportBlocks.filter(tp => tp.type === teleportType);
    if (sameColorTeleports.length !== 2) {
      game.board[player.row][player.col] = game.CELL_TYPES.PLAYER;
      game.updateStatus("Need exactly 2 teleporters of the same color!");
      return;
    }

    // Find the other teleporter in the pair
    const otherTeleporter = sameColorTeleports.find(tp => !(tp.row === player.row && tp.col === player.col));
    if (!otherTeleporter) {
      game.board[player.row][player.col] = game.CELL_TYPES.PLAYER;
      return;
    }

    // ✅ Simply move the player to the other teleporter
    player.row = otherTeleporter.row;
    player.col = otherTeleporter.col;
    const colorNames = {
      [game.CELL_TYPES.TELEPORT_PURPLE]: "Purple",
      [game.CELL_TYPES.TELEPORT_GREEN]: "Green",
      [game.CELL_TYPES.TELEPORT_BLUE]: "Blue",
      [game.CELL_TYPES.TELEPORT_ORANGE]: "Orange"
    };
    game.updateStatus(`✨ ${colorNames[teleportType]} Teleport from gravity!`);

    // ✅ CRITICAL FIX: Clear the player from the board temporarily to reset teleport state
    game.board[player.row][player.col] = game.CELL_TYPES.EMPTY;

    // Check objectives after teleporting
    game.checkObjectiveCompletion();
    game.checkWinCondition();

    // Apply gravity again after teleporting
    if (game.gravityEnabled) {
      game.lifecycle.setTimeout(() => {
        game.applyGravity();
      }, 150);
    } else {
      // If gravity is disabled, still place the player on the board after teleport
      game.lifecycle.setTimeout(() => {
        game.board[player.row][player.col] = game.CELL_TYPES.PLAYER;
      }, 50);
    }
  };
  game.findFallPosition = // Find where a piece should fall to
  function (startRow, col) {
    let row = startRow;

    // Keep falling until we hit the bottom or a blocking cell
    while (row < game.ROWS - 1) {
      const nextRow = row + 1;

      // Check if the next cell is blocked when coming from above
      if (game.isCellBlocked(nextRow, col, null, "above")) {
        break;
      }

      // Move down
      row = nextRow;
    }
    return row;
  };
  game.checkGravityTeleportation = function () {
    for (let i = 0; i < game.players.length; i++) {
      const player = game.players[i];
      const cellType = game.board[player.row][player.col];
      const isTeleportBlock = [game.CELL_TYPES.TELEPORT_PURPLE, game.CELL_TYPES.TELEPORT_GREEN, game.CELL_TYPES.TELEPORT_BLUE, game.CELL_TYPES.TELEPORT_ORANGE].includes(cellType);
      if (isTeleportBlock) {
        // Small delay to ensure the piece has settled
        game.lifecycle.setTimeout(() => {
          if (game.players[i] && game.players[i].row === player.row && game.players[i].col === player.col) {
            game.handleTeleport(game.players[i]);
          }
        }, 50);
      }
    }
  };
  game.syncProgressAfterWin = function () {
    game.tryCapturePendingMoveTrace(true);
    let actualLevelIndex = game.currentLevelIndex;
    if (actualLevelIndex < 0 && typeof game.LEVELS !== "undefined" && game.currentPuzzleData && game.currentPuzzleData.name) {
      actualLevelIndex = game.LEVELS.findIndex(lvl => lvl.name === game.currentPuzzleData.name);
    }
    if (actualLevelIndex < 0) {
      actualLevelIndex = 0;
    }
    const solvedIndex = actualLevelIndex;
    const solvedLevel = solvedIndex + 1;
    const nextLevel = solvedIndex + 2;
    const mergedUnlocked = typeof game.mergeMaxUnlocked === "function" ? game.mergeMaxUnlocked(nextLevel) : Math.max(game.currentMaxUnlocked || 1, nextLevel);
    game.currentMaxUnlocked = mergedUnlocked;
    game.progressNeedsRefresh = true;
    if (typeof game.loadLevels === 'function') {
      game.loadLevels(mergedUnlocked);
    }
    const progressData = {
      maxUnlocked: mergedUnlocked,
      level: solvedLevel,
      moves: game.levelMoveCount,
      moveTrace: game.currentLevelMoveTrace
    };
    const jsonBody = JSON.stringify(progressData);
    const headers = {
      "Content-Type": "application/json"
    };
    if (session.cmToken) {
      headers.Authorization = `Bearer ${session.cmToken}`;
    }
    game.apiFetchWithAuthRetry("/progress", {
      method: "POST",
      headers,
      body: jsonBody
    }).then(async res => {
      if (!res.ok) return null;
      return res.json().catch(() => null);
    }).then(data => {
      if (!data) return;
      const credits = Number.parseInt(data?.undoCredits, 10);
      if (Number.isFinite(credits)) {
        game.localUndoCredits = credits;
        game.undoCredits = game.localUndoCredits + (game.portalQuantities[game.PORTAL_UNDO_ITEM_ID] || 0);
        game.updateUndoButtonLabel();
      }
      const antiCredits = Number.parseInt(data?.antigravityCredits, 10);
      if (Number.isFinite(antiCredits)) {
        game.localAntigravityCredits = antiCredits;
        game.antigravityCredits = game.localAntigravityCredits + (game.portalQuantities[game.PORTAL_ANTIGRAVITY_ITEM_ID] || 0);
        game.updateAntigravityButtonLabel();
      }
    }).catch(() => {});
  };
  game.checkWinCondition = function () {
    if (game.isCheckingWinCondition) {
      return;
    }
    game.isCheckingWinCondition = true;
    try {
      if (game.gameWon || !game.goal) return;

      // Counter goal locked?
      if (game.goal.type === "counter" && game.goal.counter <= 0) return;

      // Check if all objectives are completed first
      if (!game.areAllObjectivesCompleted()) {
        return;
      }
      for (const player of game.players) {
        if (player.row === game.goal.row && player.col === game.goal.col) {
          game.gameWon = true;
          game.updateStatus("Puzzle solved! All requirements completed and goal reached!");
          game.triggerConfetti();
          game.showLevelCompleteModal();
          game.syncProgressAfterWin();
          break;
        }
      }
    } finally {
      game.isCheckingWinCondition = false;
    }
  };
  game.isPathClear = // --- Fixed Path checking (rook/bishop/queen) ---
  function (r1, c1, r2, c2, movingPlayer = null) {
    if (r1 === r2) {
      // horizontal
      let start = Math.min(c1, c2) + 1;
      let end = Math.max(c1, c2);
      for (let c = start; c < end; c++) {
        // For horizontal movement, check from the side
        if (game.isCellBlocked(r1, c, movingPlayer, "side")) return false;
      }
    } else if (c1 === c2) {
      // vertical
      let start = Math.min(r1, r2) + 1;
      let end = Math.max(r1, r2);
      for (let r = start; r < end; r++) {
        // For vertical movement, check direction
        const fromDirection = r > r1 ? "above" : "below";
        if (game.isCellBlocked(r, c1, movingPlayer, fromDirection)) return false;
      }
    } else if (Math.abs(r2 - r1) === Math.abs(c2 - c1)) {
      // diagonal
      let stepR = r2 > r1 ? 1 : -1;
      let stepC = c2 > c1 ? 1 : -1;
      let steps = Math.abs(r2 - r1);
      for (let i = 1; i < steps; i++) {
        let checkR = r1 + i * stepR;
        let checkC = c1 + i * stepC;
        // For diagonal movement, check if we're moving upward or downward
        const fromDirection = checkR > r1 ? "above" : "below";
        if (game.isCellBlocked(checkR, checkC, movingPlayer, fromDirection)) return false;
      }
    }
    return true;
  };
  game.isPawnForwardDestinationCell = function (row, col, movingPlayer) {
    return game.board[row][col] !== game.CELL_TYPES.PHASE_BLOCK && !game.isCellBlocked(row, col, movingPlayer, "below");
  };
  game.isPawnForwardPathCell = function (row, col, movingPlayer) {
    if (game.board[row][col] === game.CELL_TYPES.MOVING_PLATFORM) {
      return true;
    }
    return !game.isCellBlocked(row, col, movingPlayer, "below");
  };
  game.isPawnDiagonalCaptureCell = function (row, col) {
    const cellType = game.board[row][col];
    return [game.CELL_TYPES.OBJECTIVE, game.CELL_TYPES.OBJECTIVE_COMPLETED, game.CELL_TYPES.TRANSFORMER, game.CELL_TYPES.GOAL, game.CELL_TYPES.COUNTER_GOAL, game.CELL_TYPES.BLACK_TARGET_PIECE].includes(cellType);
  };
  game.isValidMove = // --- Movement rules ---
  function (playerIndex, newRow, newCol) {
    if (playerIndex < 0 || playerIndex >= game.players.length) return false;
    if (newRow < 0 || newRow >= game.ROWS || newCol < 0 || newCol >= game.COLS) return false;
    const player = game.players[playerIndex];
    let r = player.row;
    let c = player.col;

    // Check if destination is blocked (considering movement direction)
    // Allow moving onto transformer blocks
    const movingDown = newRow > r;
    const fromDirection = movingDown ? "above" : "below";

    // Prevent moving directly onto a phase block
    if (game.board[newRow][newCol] === game.CELL_TYPES.PHASE_BLOCK) {
      return false;
    }

    // Block if the cell is otherwise invalid (except transformer and bomb)
    if (game.board[newRow][newCol] !== game.CELL_TYPES.TRANSFORMER && game.board[newRow][newCol] !== game.CELL_TYPES.BOMB && game.board[newRow][newCol] !== game.CELL_TYPES.BLACK_TARGET_PIECE && game.getDuckAt(newRow, newCol) === -1 && game.isCellBlocked(newRow, newCol, player, fromDirection)) {
      return false;
    }

    // Use the player's specific piece type
    switch (player.pieceType) {
      case "rook":
      case "castle_rook":
        if (r === newRow || c === newCol) return game.isPathClear(r, c, newRow, newCol, player);
        return false;
      case "bishop":
        if (Math.abs(newRow - r) === Math.abs(newCol - c)) {
          return game.isPathClear(r, c, newRow, newCol, player);
        }
        return false;
      case "queen":
        if (r === newRow || c === newCol || Math.abs(newRow - r) === Math.abs(newCol - c)) {
          return game.isPathClear(r, c, newRow, newCol, player);
        }
        return false;
      case "knight":
        let dr = Math.abs(newRow - r);
        let dc = Math.abs(newCol - c);
        return dr === 2 && dc === 1 || dr === 1 && dc === 2;
      case "king":
        return Math.abs(newRow - r) <= 1 && Math.abs(newCol - c) <= 1;
      case "pawn":
        // Pawns move upward. First move can advance two squares; later moves advance one.
        if (newCol === c && newRow === r - 1) {
          return game.isPawnForwardDestinationCell(newRow, newCol, player);
        } else if (newCol === c && newRow === r - 2 && !player.hasMoved) {
          const middleRow = r - 1;
          return middleRow >= 0 && game.isPawnForwardPathCell(middleRow, c, player) && game.isPawnForwardDestinationCell(newRow, newCol, player);
        } else if (Math.abs(newCol - c) === 1 && newRow === r - 1) {
          // Diagonal "captures" can take puzzle targets/blocks, like chess captures a piece.
          return game.isPawnDiagonalCaptureCell(newRow, newCol);
        }
        return false;
    }
    return false;
  };
  game.canCastle = function (kingIndex, rookIndex) {
    if (kingIndex < 0 || rookIndex < 0 || kingIndex === rookIndex) return false;
    const king = game.players[kingIndex];
    const rook = game.players[rookIndex];
    if (!king || !rook) return false;
    if (king.pieceType !== "king" || rook.pieceType !== "castle_rook") return false;
    if (king.hasMoved || rook.hasMoved) return false;
    if (king.row !== rook.row) return false;
    const direction = rook.col > king.col ? 1 : -1;
    const kingTargetCol = king.col + direction * 2;
    const rookTargetCol = kingTargetCol - direction;
    if (kingTargetCol < 0 || kingTargetCol >= game.COLS || rookTargetCol < 0 || rookTargetCol >= game.COLS) return false;
    const start = Math.min(king.col, rook.col) + 1;
    const end = Math.max(king.col, rook.col);
    for (let col = start; col < end; col++) {
      if (game.board[king.row][col] !== game.CELL_TYPES.EMPTY || game.getPlayerAt(king.row, col) !== -1) {
        return false;
      }
    }
    const isOriginalKingOrRookCell = col => col === king.col || col === rook.col;
    const isCastleTargetAvailable = col => game.board[king.row][col] === game.CELL_TYPES.EMPTY || isOriginalKingOrRookCell(col);
    return isCastleTargetAvailable(kingTargetCol) && isCastleTargetAvailable(rookTargetCol);
  };
  game.castleKingWithRook = function (kingIndex, rookIndex) {
    if (!game.canCastle(kingIndex, rookIndex)) {
      game.updateStatus("Castling is not available here");
      return false;
    }
    const king = game.players[kingIndex];
    const rook = game.players[rookIndex];
    const oldKingRow = king.row;
    const oldKingCol = king.col;
    const oldRookRow = rook.row;
    const oldRookCol = rook.col;
    const direction = rook.col > king.col ? 1 : -1;
    const kingTargetCol = king.col + direction * 2;
    const rookTargetCol = kingTargetCol - direction;
    game.saveUndoSnapshot();
    game.queueMoveTraceCapture({
      from: {
        row: oldKingRow,
        col: oldKingCol
      },
      to: {
        row: oldKingRow,
        col: kingTargetCol
      },
      pieceType: "king",
      castling: direction > 0 ? "kingside" : "queenside",
      rookFrom: {
        row: oldRookRow,
        col: oldRookCol
      },
      rookTo: {
        row: oldRookRow,
        col: rookTargetCol
      }
    });
    game.board[oldKingRow][oldKingCol] = game.CELL_TYPES.EMPTY;
    game.board[oldRookRow][oldRookCol] = game.CELL_TYPES.EMPTY;
    king.col = kingTargetCol;
    rook.col = rookTargetCol;
    king.hasMoved = true;
    rook.hasMoved = true;
    game.board[king.row][king.col] = game.CELL_TYPES.PLAYER;
    game.board[rook.row][rook.col] = game.CELL_TYPES.PLAYER;
    game.visitedSquares[king.row][king.col] = true;
    game.visitedSquares[rook.row][rook.col] = true;
    game.levelMoveCount += 1;
    game.updateMoveCountDisplay();
    game.updateStatus(direction > 0 ? "Kingside castling!" : "Queenside castling!");
    game.checkWinCondition();
    if (game.gravityEnabled) {
      game.applyGravity();
    } else if (game.antigravityEnabled) {
      game.applyAntigravity();
    } else {
      game.tryCapturePendingMoveTrace(true);
    }
    return true;
  };
  game.movePlayer = function (playerIndex, newRow, newCol) {
    if (playerIndex < 0 || playerIndex >= game.players.length) return;
    if (game.gameWon) return;
    const player = game.players[playerIndex];
    const fromRow = player.row;
    const fromCol = player.col;
    const pieceType = player.pieceType;
    if (!game.isValidMove(playerIndex, newRow, newCol)) {
      // Check if the move was invalid because goal is locked
      if (game.board[newRow][newCol] === game.CELL_TYPES.GOAL && !game.areAllObjectivesCompleted()) {
        game.updateStatus("Complete all requirements first! " + game.getUnlockProgressText());
      } else {
        game.updateStatus("Invalid move for selected piece");
      }
      return;
    }
    game.saveUndoSnapshot();
    game.queueMoveTraceCapture({
      from: {
        row: fromRow,
        col: fromCol
      },
      to: {
        row: newRow,
        col: newCol
      },
      pieceType
    });
    game.levelMoveCount += 1;
    game.updateMoveCountDisplay();

    // Check the full movement path against active lasers before moving.
    const laserHit = game.getActiveLaserHitOnMove(player, newRow, newCol);
    if (laserHit) {
      game.handleLaserCollision(playerIndex, laserHit.row, laserHit.col);
      return;
    }
    const isBombBlock = game.board[newRow][newCol] === game.CELL_TYPES.BOMB;
    const isDuckHazard = game.getDuckAt(newRow, newCol) !== -1;
    const isTargetPiece = game.board[newRow][newCol] === game.CELL_TYPES.BLACK_TARGET_PIECE;

    // Check if destination is ANY teleport block type BEFORE moving
    const isTeleportBlock = [game.CELL_TYPES.TELEPORT_PURPLE, game.CELL_TYPES.TELEPORT_GREEN, game.CELL_TYPES.TELEPORT_BLUE, game.CELL_TYPES.TELEPORT_ORANGE].includes(game.board[newRow][newCol]);

    // Check if destination is a transformer block BEFORE moving
    const isTransformerBlock = game.board[newRow][newCol] === game.CELL_TYPES.TRANSFORMER;

    // ✅ NEW: Handle bomb collision immediately BEFORE any movement
    if (isBombBlock) {
      game.handleBombCollision(player, playerIndex, newRow, newCol);
      return; // Stop further processing
    }
    if (isDuckHazard) {
      game.handleDuckCollision(playerIndex);
      return;
    }
    game.board[player.row][player.col] = game.CELL_TYPES.EMPTY;
    player.row = newRow;
    player.col = newCol;
    player.hasMoved = true;
    game.visitedSquares[newRow][newCol] = true;
    if (isTargetPiece) {
      game.completeTargetPiece(newRow, newCol);
    }
    if (isTeleportBlock) {
      game.handleTeleport(player);
      return; // stop rest of logic for this frame
    }

    // Only place player if it's not a teleport cell
    if (!isTeleportBlock) {
      game.board[player.row][player.col] = game.CELL_TYPES.PLAYER;
    }

    // Check if player moved onto a transformer block
    if (isTransformerBlock) {
      game.showPieceSelectionMenu(newRow, newCol, playerIndex);
      return; // Stop here to show the menu before applying gravity
    }

    // Rest of the function remains the same...
    game.checkObjectiveCompletion();

    // Check if player moved through a phase block from below and activate it
    if (newRow < fromRow) {
      // Moving upward
      for (let r = newRow + 1; r < fromRow; r++) {
        if (game.board[r][newCol] === game.CELL_TYPES.PHASE_BLOCK) {
          game.activatePhaseBlock(r, newCol);
        }
      }
    }
    game.checkWinCondition();

    // Apply gravity or antigravity after moving
    if (game.gravityEnabled && !game.antigravityEnabled) {
      const before = game.fallingPieces.length;
      game.applyGravity(); // may enqueue falls
      const after = game.fallingPieces.length;
      if (after > before) {
        // Something (maybe this piece) will fall → wait to decrement until falls finish
        game.pendingMoveCounter = true;
      } else {
        // Nothing will fall → decrement now
        game.decrementCounterAfterMove();
      }
    } else if (game.antigravityEnabled) {
      // Apply antigravity after moving
      const before = game.risingPieces.length;
      game.applyAntigravity(); // may enqueue rises
      const after = game.risingPieces.length;
      const usedAntigravity = after > before;
      if (usedAntigravity) {
        game.markPendingMoveTraceAntigravity(true);
      }
      if (usedAntigravity) {
        // Something (maybe this piece) will rise → wait to decrement until rises finish
        game.pendingMoveCounter = true;
      } else {
        // Nothing will rise → decrement now
        game.decrementCounterAfterMove();
      }
    } else {
      // Gravity off → decrement now (after checking for immediate win above)
      game.decrementCounterAfterMove();
    }
    const moveSound = document.getElementById("moveSound");
    if (moveSound) {
      game.playSound(moveSound);
    }
  };
  game.cloneGameData = function (data) {
    return data == null ? data : JSON.parse(JSON.stringify(data));
  };
}
export function initialize(game) {
  game.isCheckingWinCondition = false;
  // prevent duplicate checks

  if (game.CM_EDITOR_PAGE) {
    game.cmResetEditorAfterPlaytest = function () {
      game.levelMoveCount = 0;
      game.moveHistorySnapshots = [];
      game.currentLevelMoveTrace = [];
      game.pendingMoveTraceEntry = null;
      game.pendingMoveCounter = false;
      game.shakeAmount = 0;
      game.shakeX = 0;
      game.shakeY = 0;
      game.playerTeleportCooldowns.clear();
      game.risingPieces = [];
      game.isCheckingWinCondition = false;
      game.antigravityEnabled = false;
      game.antigravityUnlockedThisRun = false;
      if (game.levelCompleteModal) game.levelCompleteModal.classList.remove("active");
      game.gameWon = false;
      game.updateMoveCountDisplay();
      game.updateAntigravityButtonLabel();
      game.updateUndoButtonLabel();
    };
  }
}
