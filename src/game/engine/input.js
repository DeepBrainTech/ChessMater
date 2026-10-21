import { session } from '../../services/session.js';
export function register(game) {
  game.handleMove = function (e) {
    if (game.showTransformerMenu && game.transformerPosition) {
      game.handleTransformerMenuClick(e);
      return;
    }
    if (game.gameWon && game.mode === "play") return;
    let rect = game.canvas.getBoundingClientRect();
    const scaleX = game.canvas.width / rect.width;
    const scaleY = game.canvas.height / rect.height;
    let x = (e.clientX - rect.left) * scaleX;
    let y = (e.clientY - rect.top) * scaleY;
    let col = Math.floor(x / game.TILE_SIZE);
    let row = Math.floor(y / game.TILE_SIZE);
    if (row < 0 || row >= game.ROWS || col < 0 || col >= game.COLS) return;
    if (game.CM_EDITOR_PAGE && game.mode === "edit") {
      if (typeof game.cmEditorOnEditCell === "function") {
        game.cmEditorOnEditCell(row, col, x - col * game.TILE_SIZE, y - row * game.TILE_SIZE);
      }
      return;
    }
    if (game.mode === "play") {
      if (game.players.length === 0) {
        game.updateStatus("No pieces on this level. Choose another level.");
        return;
      }

      // Check if clicked on a player
      const clickedPlayerIndex = game.getPlayerAt(row, col);
      if (clickedPlayerIndex !== -1) {
        if (game.selectedPlayerIndex !== -1) {
          const selectedPiece = game.players[game.selectedPlayerIndex];
          const clickedPiece = game.players[clickedPlayerIndex];
          const selectedKingClickedRook = selectedPiece?.pieceType === "king" && clickedPiece?.pieceType === "castle_rook";
          const selectedRookClickedKing = selectedPiece?.pieceType === "castle_rook" && clickedPiece?.pieceType === "king";
          if (selectedKingClickedRook || selectedRookClickedKing) {
            const castled = selectedKingClickedRook ? game.castleKingWithRook(game.selectedPlayerIndex, clickedPlayerIndex) : game.castleKingWithRook(clickedPlayerIndex, game.selectedPlayerIndex);
            if (castled) {
              game.selectedPlayerIndex = -1;
            }
            return;
          }
        }
        game.selectedPlayerIndex = clickedPlayerIndex;
        const player = game.players[game.selectedPlayerIndex];
        game.updateStatus(`Selected ${player.pieceType} (player ${game.selectedPlayerIndex + 1} of ${game.players.length}). Click destination to move.`);
        return;
      }

      // If a player is selected and clicked on empty space, try to move
      if (game.selectedPlayerIndex !== -1) {
        if (game.isValidMove(game.selectedPlayerIndex, row, col)) {
          game.movePlayer(game.selectedPlayerIndex, row, col);
          game.selectedPlayerIndex = -1; // Deselect after moving
        } else {
          game.updateStatus("Invalid move for selected piece");
        }
      } else {
        game.updateStatus("Click on a player piece first to select it");
      }
    }
  };
  game.applyAntigravity = function () {
    if (game.gameWon) return false;
    game.risingPieces = [];

    // First, collect all pieces that need to rise
    for (let i = 0; i < game.players.length; i++) {
      const player = game.players[i];
      let targetRow = player.row;

      // Find how high this piece can rise
      while (targetRow > 0 && [game.CELL_TYPES.EMPTY, game.CELL_TYPES.OBJECTIVE, game.CELL_TYPES.OBJECTIVE_COMPLETED].includes(game.board[targetRow - 1][player.col])) {
        targetRow--;
      }
      if (targetRow !== player.row) {
        // Set up animation info
        game.risingPieces.push({
          playerIndex: i,
          startRow: player.row,
          targetRow: targetRow,
          col: player.col,
          startY: player.row * game.TILE_SIZE,
          targetY: targetRow * game.TILE_SIZE,
          currentY: player.row * game.TILE_SIZE,
          pieceType: player.pieceType
        });

        // Remove from board (we'll animate it)
        game.board[player.row][player.col] = game.CELL_TYPES.EMPTY;
      }
    }

    // Start the animation loop if we have pieces to rise
    if (game.risingPieces.length > 0) {
      game.lastRiseTime = performance.now();
      game.lifecycle.requestAnimationFrame(game.updateRisingPieces);
      return true; // Return true if pieces will rise
    }
    return false; // Return false if no pieces will rise
  };
  game.updateRisingPieces = function (timestamp) {
    if (game.gameWon) return;
    if (game.risingPieces.length === 0) return;
    const deltaTime = timestamp - game.lastRiseTime;
    game.lastRiseTime = timestamp;
    const distanceToMove = game.RISE_SPEED * deltaTime / 1000; // Convert to pixels per frame

    for (let i = game.risingPieces.length - 1; i >= 0; i--) {
      const piece = game.risingPieces[i];

      // Move piece up
      const previousRow = Math.floor(piece.currentY / game.TILE_SIZE);
      piece.currentY = Math.max(piece.targetY, piece.currentY - distanceToMove);
      const currentRow = Math.floor(piece.currentY / game.TILE_SIZE);
      let hitBomb = false;
      for (let row = previousRow - 1; row >= currentRow; row--) {
        if (game.board[row][piece.col] === game.CELL_TYPES.BOMB) {
          const player = game.players[piece.playerIndex];
          game.handleBombCollision(player, piece.playerIndex, row, piece.col);
          game.risingPieces.splice(i, 1);
          hitBomb = true;
          break;
        }
        game.completeObjective(row, piece.col);
      }
      if (hitBomb) continue;

      // Check if we've reached or passed the target
      if (piece.currentY <= piece.targetY) {
        piece.currentY = piece.targetY;
        const player = game.players[piece.playerIndex];
        player.row = piece.targetRow;
        player.col = piece.col;

        // Check if landing on a bomb
        if (game.board[player.row][player.col] === game.CELL_TYPES.BOMB) {
          game.handleBombCollision(player, piece.playerIndex, player.row, player.col);
        } else {
          game.board[player.row][player.col] = game.CELL_TYPES.PLAYER;
          game.checkObjectiveCompletion();
          game.checkWinCondition();
          if (game.gameWon) return;
        }
        game.risingPieces.splice(i, 1);
      }
    }

    // Force redraw to show animation
    game.drawBoard();

    // Draw the rising pieces on top
    game.ctx.save();
    for (const piece of game.risingPieces) {
      const x = piece.col * game.TILE_SIZE;
      game.ctx.drawImage(game.pieceImages[piece.pieceType], x + 8, piece.currentY + 8, game.TILE_SIZE - 16, game.TILE_SIZE - 16);
    }
    game.ctx.restore();

    // Continue animation if there are still pieces rising
    if (game.risingPieces.length > 0) {
      game.lifecycle.requestAnimationFrame(game.updateRisingPieces);
    } else {
      // Final draw to ensure everything is in place
      game.drawBoard();

      // ✅ ADD THIS PART - Decrement counter if nothing else is rising and we were waiting
      if (game.pendingMoveCounter) {
        game.decrementCounterAfterMove();
        game.pendingMoveCounter = false;
      }
    }
  };
  game.toggleAntigravity = async function () {
    if (game.gameWon) return;
    if (game.fallingPieces.length || game.risingPieces.length || game.pendingMoveCounter) return;
    if (!game.antigravityUnlockedThisRun) {
      if (game.antigravityCredits <= 0) {
        game.openAntigravityExchangeModal();
        return;
      }
      const consumed = await game.consumeAntigravityCredit(1);
      if (!consumed) {
        game.openAntigravityExchangeModal();
        return;
      }
      game.antigravityUnlockedThisRun = true;
    }
    game.tryCapturePendingMoveTrace(false);
    game.antigravityEnabled = !game.antigravityEnabled;
    // Record the switch before physics, which can immediately complete the level.
    game.queueSystemTraceCapture({
      systemEvent: "toggle_antigravity",
      antigravityEnabled: game.antigravityEnabled,
      antigravityApplied: game.antigravityEnabled
    });
    game.updateAntigravityButtonLabel();
    if (game.antigravityEnabled) {
      game.updateStatus("🔼 Antigravity enabled - pieces rise upward!");
      game.fallingPieces = [];
      game.applyAntigravity();
    } else {
      game.updateStatus("🔽 Gravity enabled - pieces fall downward!");
      game.applyGravity();
    }
  };
  game.restartLevel = function () {
    if (!game.currentPuzzleData) {
      game.updateStatus("No level is currently loaded.");
      return;
    }
    game.autoRestartScheduled = false;
    game.loadPuzzle(game.currentPuzzleData, { preserveHint: true });
  };
  game.initializeCanvas = // Initialize the canvas size on load
  function () {
    game.resizeCanvas();
  };
  game.gameLoop = // --- Game Loop ---
  function () {
    if (game.shakeAmount > 0.5) {
      game.shakeX = (Math.random() - 0.5) * game.shakeAmount;
      game.shakeY = (Math.random() - 0.5) * game.shakeAmount;
      game.shakeAmount *= game.shakeDecay;
    } else {
      game.shakeX = 0;
      game.shakeY = 0;
    }
    game.ctx.setTransform(1, 0, 0, 1, game.shakeX, game.shakeY);
    game.ctx.clearRect(-game.shakeX, -game.shakeY, game.canvas.width, game.canvas.height);
    if (game.gameWon) {
      game.drawBoard();
      game.lifecycle.requestAnimationFrame(game.gameLoop);
      return;
    }
    game.updateFallingPieces();
    if (game.gameWon) {
      game.drawBoard();
      game.lifecycle.requestAnimationFrame(game.gameLoop);
      return;
    }
    game.updateExplodingPlayers(); // 💣 Animate dead players
    game.checkActiveLaserCollisions();
    game.tryCapturePendingMoveTrace(false);
    game.frameCount++;
    if (game.frameCount % 50 === 0) {
      game.updateBombs();
    }
    if (game.frameCount % 100 === 0) {
      game.updateDucks();
      game.updateMovingPlatforms();
    }
    game.drawBoard();
    if (game.mode === "play") {
      game.drawPossibleMoves();
    }
    if (game.showTransformerMenu && game.transformerPosition) {
      game.drawPieceSelectionMenu();
    }
    game.lifecycle.requestAnimationFrame(game.gameLoop);
  };
  game.isAnyGameModalOpen = function () {
    return !!document.querySelector(game.MODAL_SCROLL_LOCK_SELECTOR);
  };
  game.measureScrollbarWidth = function () {
    return Math.max(0, window.innerWidth - document.documentElement.clientWidth);
  };
  game.syncPageScrollLock = function () {
    const open = game.isAnyGameModalOpen();
    const root = document.documentElement;
    const body = document.body;
    if (open) {
      if (!body.classList.contains("modal-scroll-lock")) {
        game.pageScrollLockY = window.scrollY || root.scrollTop || 0;
        const scrollbarWidth = game.measureScrollbarWidth();
        root.style.setProperty("--modal-scrollbar-width", `${scrollbarWidth}px`);
        body.classList.add("modal-scroll-lock");
        body.style.top = `-${game.pageScrollLockY}px`;
        root.classList.add("modal-scroll-lock");
      }
      return;
    }
    if (body.classList.contains("modal-scroll-lock")) {
      root.classList.remove("modal-scroll-lock");
      body.classList.remove("modal-scroll-lock");
      body.style.top = "";
      root.style.removeProperty("--modal-scrollbar-width");
      window.scrollTo(0, game.pageScrollLockY);
    }
  };
  game.initModalScrollLock = function () {
    document.querySelectorAll(".leaderboard-modal, .block-tip-modal, .undo-exchange-modal, .power-ups-modal").forEach(modal => {
      const observer = new game.lifecycle.MutationObserver(() => game.syncPageScrollLock());
      observer.observe(modal, {
        attributes: true,
        attributeFilter: ["class"]
      });
    });
    game.lifecycle.listen(document, "touchmove", e => {
      if (!document.body.classList.contains("modal-scroll-lock")) return;
      if (!e.target.closest(game.MODAL_SCROLLABLE_SELECTOR)) {
        e.preventDefault();
      }
    }, {
      passive: false
    });
    game.lifecycle.listen(document, "wheel", e => {
      if (!document.body.classList.contains("modal-scroll-lock")) return;
      if (!e.target.closest(game.MODAL_SCROLLABLE_SELECTOR)) {
        e.preventDefault();
      }
    }, {
      passive: false
    });
  };
}
export function initialize(game) {
  ;
  game.lifecycle.listen(game.canvas, "click", game.handleMove);

  // Touch support
  game.lifecycle.listen(game.canvas, "touchstart", e => {
    e.preventDefault();
    const touch = e.touches[0];
    game.handleMove({
      clientX: touch.clientX,
      clientY: touch.clientY
    });
  }, {
    passive: false
  });

  // --- Keyboard controls ---
  game.lifecycle.listen(document, "keydown", e => {
    if (document.getElementById('powerUpsModal')?.classList.contains('active')) return;
    const walkthroughModalActive = game.inGameWalkthroughModal && game.inGameWalkthroughModal.classList.contains("active");
    const levelCompleteModalActive = game.levelCompleteModal && game.levelCompleteModal.classList.contains("active");
    const replayViewerActive = game.hintUnlockedThisRun && game.fewestOtherMovesReplayPath && game.fewestOtherMovesReplayPath.length && (walkthroughModalActive || levelCompleteModalActive);
    if (replayViewerActive) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        game.stepReplayNavigation("prev");
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        game.stepReplayNavigation("next");
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        game.stepReplayNavigation("first");
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        game.stepReplayNavigation("last");
        return;
      }
    }
    if (e.key === "Escape") {
      if (walkthroughModalActive) {
        e.preventDefault();
        game.closeInGameWalkthroughModal();
        return;
      }
    }
    if (game.mode === "play" && e.key === "Escape") {
      game.selectedPlayerIndex = -1;
      game.updateStatus("Selection cleared");
    }
  });
  game.frameCount = 0;
  game.confettiStyle = document.createElement('style');
  game.confettiStyle.textContent = `
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
  document.head.appendChild(game.lifecycle.trackNode(game.confettiStyle));
  game.lifecycle.listen(window, "resize", game.resizeCanvas);
  if (window.visualViewport) {
    game.lifecycle.listen(window.visualViewport, "resize", game.resizeCanvas);
  }
  game.pageScrollLockY = 0;
  game.MODAL_SCROLL_LOCK_SELECTOR = ".leaderboard-modal.active, .block-tip-modal.active, .undo-exchange-modal.active, .power-ups-modal.active";
  game.MODAL_SCROLLABLE_SELECTOR = ".lb-content, .leaderboard-content, .guide-content, .level-complete-content, .block-tip-content, .undo-exchange-panel, .power-ups-inner";
  game.initModalScrollLock();

  // Initialize the game
  game.initializeCanvas();
  game.resizeCanvas();
  game.updateStatus(game.CM_EDITOR_PAGE ? "Level editor: place pieces and goal, then copy or download." : "Welcome! Choose a level from the list to play.");
  game.updateUndoButtonLabel();
  game.updateAntigravityButtonLabel();
  const syncInitialResources = async () => {
    if (!game.CM_EDITOR_PAGE) {
      await game.claimStarterPack();
      await game.recoverInventoryDeliveries();
      await game.recoverLevelCoinRewards();
    }
    await game.syncGameInventory();
  };
  game.lifecycle.listen(window, 'focus', () => {
    void game.recoverInventoryDeliveries().then(() => game.syncGameInventory());
    if (!game.CM_EDITOR_PAGE) void game.recoverLevelCoinRewards();
  });
  if (session.authReady && typeof session.authReady.finally === "function") {
    session.authReady.finally(syncInitialResources);
  } else {
    syncInitialResources();
  }
  game.updatePlayerCount();
  game.updateObjectiveCount();
  game.updateTargetPieceCount();
  game.cmGetCurrentLevelIndex = function () {
    return game.currentLevelIndex;
  };
  game.cmSetCurrentLevelIndex = function (index) {
    game.currentLevelIndex = index;
  };





  game.gameLoop();
}
