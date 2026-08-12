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
