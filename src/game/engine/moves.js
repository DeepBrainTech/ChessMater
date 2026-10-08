export function register(game) {
  game.saveUndoSnapshot = function () {
    game.moveHistorySnapshots.push({
      ROWS: game.ROWS,
      COLS: game.COLS,
      board: game.cloneGameData(game.board),
      players: game.cloneGameData(game.players),
      goal: game.cloneGameData(game.goal),
      objectives: game.cloneGameData(game.objectives),
      objectivesCompleted: game.objectivesCompleted,
      totalObjectives: game.totalObjectives,
      targetPieces: game.cloneGameData(game.targetPieces),
      targetPiecesCaptured: game.targetPiecesCaptured,
      totalTargetPieces: game.totalTargetPieces,
      phaseBlockStates: game.cloneGameData(game.phaseBlockStates),
      bombs: game.cloneGameData(game.bombs),
      laserBlocks: game.cloneGameData(game.laserBlocks),
      ducks: game.cloneGameData(game.ducks),
      movingPlatforms: game.cloneGameData(game.movingPlatforms),
      teleportBlocks: game.cloneGameData(game.teleportBlocks),
      playerTeleportCooldowns: Array.from(game.playerTeleportCooldowns.entries()),
      gameWon: game.gameWon,
      selectedPlayerIndex: game.selectedPlayerIndex,
      levelMoveCount: game.levelMoveCount
    });
  };
  game.undoMove = async function () {
    if (game.undoCredits <= 0) {
      game.openUndoExchangeModal();
      return;
    }
    if (game.moveHistorySnapshots.length === 0) {
      return;
    }
    const consumed = await game.consumeUndoCredit(1);
    if (!consumed) {
      game.openUndoExchangeModal();
      return;
    }
    const snapshot = game.moveHistorySnapshots.pop();
    game.ROWS = snapshot.ROWS;
    game.COLS = snapshot.COLS;
    game.resizeCanvas();
    game.board = game.cloneGameData(snapshot.board);
    game.players = game.cloneGameData(snapshot.players);
    game.goal = game.cloneGameData(snapshot.goal);
    game.objectives = game.cloneGameData(snapshot.objectives);
    game.objectivesCompleted = snapshot.objectivesCompleted;
    game.totalObjectives = snapshot.totalObjectives;
    game.targetPieces = game.cloneGameData(snapshot.targetPieces || []);
    game.targetPiecesCaptured = snapshot.targetPiecesCaptured || game.targetPieces.filter(piece => piece.captured).length;
    game.totalTargetPieces = snapshot.totalTargetPieces || game.targetPieces.length;
    game.phaseBlockStates = game.cloneGameData(snapshot.phaseBlockStates);
    game.bombs = game.cloneGameData(snapshot.bombs);
    game.laserBlocks = game.cloneGameData(snapshot.laserBlocks || []);
    game.ducks = game.cloneGameData(snapshot.ducks || []);
    game.movingPlatforms = game.cloneGameData(snapshot.movingPlatforms || []);
    game.teleportBlocks = game.cloneGameData(snapshot.teleportBlocks);
    game.playerTeleportCooldowns = new Map(snapshot.playerTeleportCooldowns || []);
    game.gameWon = snapshot.gameWon;
    game.selectedPlayerIndex = -1;
    game.levelMoveCount = snapshot.levelMoveCount;
    game.pendingMoveTraceEntry = null;
    if (game.currentLevelMoveTrace.length > 1) {
      game.currentLevelMoveTrace.pop();
    }

    // Clear transient animation/effect state before redraw
    game.fallingPieces = [];
    game.risingPieces = [];
    game.pendingMoveCounter = false;
    game.explodingPlayers = [];
    game.showTransformerMenu = false;
    game.transformerPosition = null;
    game.transformerPlayerIndex = -1;
    game.updatePlayerCount();
    game.updateObjectiveCount();
    game.updateTargetPieceCount();
    game.updateMoveCountDisplay();
    game.drawBoard();
  };
  game.handleTeleport = function (player) {
    // Get the teleporter type the player is standing on
    const currentTeleportType = game.board[player.row][player.col];

    // Check if it's actually a teleporter type
    const teleportTypes = [game.CELL_TYPES.TELEPORT_PURPLE, game.CELL_TYPES.TELEPORT_GREEN, game.CELL_TYPES.TELEPORT_BLUE, game.CELL_TYPES.TELEPORT_ORANGE];
    if (!teleportTypes.includes(currentTeleportType)) {
      return;
    }

    // Get all teleport blocks of the same color
    const sameColorTeleports = game.teleportBlocks.filter(tp => tp.type === currentTeleportType);
    if (sameColorTeleports.length !== 2) {
      game.updateStatus("Need exactly 2 teleporters of the same color!");
      return;
    }

    // Find the other teleporter in the pair
    const otherTeleporter = sameColorTeleports.find(tp => !(tp.row === player.row && tp.col === player.col));
    if (!otherTeleporter) return;

    // ✅ TEMPORARILY DISABLE BOTH TELEPORTERS
    const sourcePos = `${player.row},${player.col}`;
    const destPos = `${otherTeleporter.row},${otherTeleporter.col}`;

    // Store original types
    const sourceType = game.board[player.row][player.col];
    const destType = game.board[otherTeleporter.row][otherTeleporter.col];

    // Change to inactive state (use a visual indicator)
    game.board[player.row][player.col] = game.CELL_TYPES.EMPTY;
    game.board[otherTeleporter.row][otherTeleporter.col] = game.CELL_TYPES.EMPTY;

    // ✅ Move player to destination
    player.row = otherTeleporter.row;
    player.col = otherTeleporter.col;
    const colorNames = {
      [game.CELL_TYPES.TELEPORT_PURPLE]: "Purple",
      [game.CELL_TYPES.TELEPORT_GREEN]: "Green",
      [game.CELL_TYPES.TELEPORT_BLUE]: "Blue",
      [game.CELL_TYPES.TELEPORT_ORANGE]: "Orange"
    };
    game.updateStatus(`✨ ${colorNames[currentTeleportType]} Teleport! Teleporters resetting...`);

    // ✅ RESTORE TELEPORTERS AFTER COOLDOWN
    game.lifecycle.setTimeout(() => {
      game.board[player.row][player.col] = destType; // Player's current position
      // Find and restore the source teleporter
      const sourceTeleporter = sameColorTeleports.find(tp => tp.row === parseInt(sourcePos.split(',')[0]) && tp.col === parseInt(sourcePos.split(',')[1]));
      if (sourceTeleporter) {
        game.board[sourceTeleporter.row][sourceTeleporter.col] = sourceType;
      }
      game.updateStatus(`${colorNames[currentTeleportType]} Teleporters ready!`);
    }, game.TELEPORT_COOLDOWN);
    game.checkObjectiveCompletion();

    // Apply gravity after teleporting
    if (game.gravityEnabled) {
      game.lifecycle.setTimeout(() => {
        game.applyGravity();
      }, 150);
    } else {
      // If gravity is disabled, place the player on the board
      game.lifecycle.setTimeout(() => {
        game.board[player.row][player.col] = game.CELL_TYPES.PLAYER;
        game.checkWinCondition();
      }, 50);
    }
  };
  game.getPlayerAt = // Find which player was clicked
  function (row, col) {
    for (let i = 0; i < game.players.length; i++) {
      if (game.players[i].row === row && game.players[i].col === col) {
        return i;
      }
    }
    return -1;
  };
  game.showPieceSelectionMenu = // --- Transformer block functions ---
  function (row, col, playerIndex) {
    game.showTransformerMenu = true;
    game.transformerPosition = {
      row,
      col
    };
    game.transformerPlayerIndex = playerIndex;
    game.updateStatus("Select a new piece type for this player");
  };
  game.transformPiece = function (playerIndex, newPieceType) {
    if (playerIndex >= 0 && playerIndex < game.players.length) {
      const oldType = game.players[playerIndex].pieceType;
      game.players[playerIndex].pieceType = newPieceType;

      // Remove the transformer block after use but keep the player visible
      if (game.transformerPosition) {
        game.board[game.transformerPosition.row][game.transformerPosition.col] = game.CELL_TYPES.PLAYER; // Keep player visible
      }
      game.updateStatus(`Player transformed from ${oldType} to ${newPieceType}`);

      // Check for objective completion after transformation
      game.checkObjectiveCompletion();

      // Apply gravity after transformation
      if (game.gravityEnabled) {
        game.applyGravity();
      }
    }
    game.showTransformerMenu = false;
    game.transformerPosition = null;
    game.transformerPlayerIndex = -1;
  };
  game.handleTransformerMenuClick = // Handle clicks on the transformer menu
  function (e) {
    const rect = game.canvas.getBoundingClientRect();
    const scaleX = game.canvas.width / rect.width;
    const scaleY = game.canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Always use center of board for menu positioning
    const centerX = game.COLS * game.TILE_SIZE / 2;
    const centerY = game.ROWS * game.TILE_SIZE / 2;
    const buttonSize = 35;
    const spacing = 15;
    const menuWidth = 3 * buttonSize + 2 * spacing;
    const menuHeight = 3 * buttonSize + 2 * spacing;
    const outerMargin = 20;
    const startX = centerX - menuWidth / 2;
    const startY = centerY - menuHeight / 2 - 10;

    // Define the piece grid layout
    const pieceLayout = [["rook", "bishop", "queen"], ["knight", "king", "pawn"], ["castle_rook"]];

    // Check if click is on any piece button
    pieceLayout.forEach((row, rowIndex) => {
      row.forEach((pieceType, colIndex) => {
        const btnX = startX + colIndex * (buttonSize + spacing);
        const btnY = startY + rowIndex * (buttonSize + spacing);
        if (x >= btnX && x <= btnX + buttonSize && y >= btnY && y <= btnY + buttonSize) {
          game.transformPiece(game.transformerPlayerIndex, pieceType);
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
  };
}
