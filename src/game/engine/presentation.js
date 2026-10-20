import { session } from '../../services/session.js';
import { showModal, hideModal } from '../modalFocus.js';
export function register(game) {
  game.isAudioMuted = function () {
    return !!game.cmAudioMuted;
  };
  game.playSound = function (audioEl, volume) {
    if (!audioEl || game.isAudioMuted()) return;
    audioEl.currentTime = 0;
    if (typeof volume === "number") audioEl.volume = volume;
    audioEl.play().catch(() => {});
  };
  game.bindLevelCompleteUi = function () {
    try {
      if (game.levelCompleteRetryBtn) {
        game.lifecycle.listen(game.levelCompleteRetryBtn, 'click', () => {
          if (game.levelCompleteModal) game.levelCompleteModal.classList.remove('active');
          game.restartLevel();
        });
      }
      if (game.levelCompleteNextBtn) {
        game.lifecycle.listen(game.levelCompleteNextBtn, 'click', () => {
          if (game.currentLevelIndex < game.LEVELS.length - 1) {
            game.currentLevelIndex++;
            if (game.levelCompleteModal) game.levelCompleteModal.classList.remove('active');
            game.loadPuzzle(game.LEVELS[game.currentLevelIndex]);
          }
        });
      }
      if (game.closeLevelCompleteModalBtn && game.levelCompleteModal) {
        game.lifecycle.listen(game.closeLevelCompleteModalBtn, 'click', () => {
          game.levelCompleteModal.classList.remove('active');
        });
        game.lifecycle.listen(game.levelCompleteModal, 'click', e => {
          if (e.target === game.levelCompleteModal) {
            game.levelCompleteModal.classList.remove('active');
          }
        });
      }
    } catch (e) {}
  };
  game.resizeBoard = // Function to resize the board
  function (newRows, newCols) {
    if (newRows === game.ROWS && newCols === game.COLS) return;

    // Create new board
    const newBoard = Array.from({
      length: newRows
    }, () => Array(newCols).fill(game.CELL_TYPES.EMPTY));

    // Copy existing content (if it fits)
    const copyRows = Math.min(game.ROWS, newRows);
    const copyCols = Math.min(game.COLS, newCols);
    for (let r = 0; r < copyRows; r++) {
      for (let c = 0; c < copyCols; c++) {
        newBoard[r][c] = game.board[r][c];
      }
    }

    // Update board and dimensions
    game.board = newBoard;
    game.ROWS = newRows;
    game.COLS = newCols;
    game.syncVisitedSquaresSize();

    // Resize canvas
    game.resizeCanvas();

    // Filter players and objectives that are still within bounds
    game.players = game.players.filter(player => player.row < newRows && player.col < newCols);
    game.objectives = game.objectives.filter(obj => obj.row < newRows && obj.col < newCols);
    game.targetPieces = game.targetPieces.filter(piece => piece.row < newRows && piece.col < newCols);
    game.totalTargetPieces = game.targetPieces.length;
    game.targetPiecesCaptured = game.targetPieces.filter(piece => piece.captured).length;
    game.bombs = game.bombs.filter(bomb => bomb.row < newRows && bomb.col < newCols);
    game.laserBlocks = game.laserBlocks.filter(laser => laser.row < newRows && laser.col < newCols);
    game.ducks = game.ducks.filter(duck => duck.row < newRows && duck.col < newCols);
    game.movingPlatforms = game.movingPlatforms.filter(platform => platform.row < newRows && platform.col < newCols).map(game.normalizeMovingPlatformData);

    // Update goal if it's out of bounds
    if (game.goal && (game.goal.row >= newRows || game.goal.col >= newCols)) {
      game.goal = null;
    }

    // Update counts and redraw
    game.updatePlayerCount();
    game.updateObjectiveCount();
    game.updateTargetPieceCount();
    game.updateStatus(`Board resized to ${newRows}x${newCols}`);
  };
  game.resizeCanvas = function () {
    game.canvas.width = game.COLS * game.TILE_SIZE;
    game.canvas.height = game.ROWS * game.TILE_SIZE;
    const layoutRow = document.getElementById("gameLayoutRow");
    const sidePanel = document.getElementById("gameSidePanel");
    const canvasContainer = game.canvas.parentElement;
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

    let fitDesignFrame = false;
    if (canvasContainer?.classList.contains("game-board-frame")) {
      const slot = canvasContainer.parentElement;
      const slotStyle = window.getComputedStyle(slot);
      const availableWidth = slot.clientWidth - (parseFloat(slotStyle.paddingLeft) || 0) - (parseFloat(slotStyle.paddingRight) || 0);
      const availableHeight = slot.clientHeight - (parseFloat(slotStyle.paddingTop) || 0) - (parseFloat(slotStyle.paddingBottom) || 0);
      if (availableWidth > 0 && availableHeight > 0) {
        // The 1134 x 779 frame's rails end at x=37 and y=44.
        // Fit the whole grid with one scale, then wrap the artwork around it.
        const openingWidth = (1134 - 2 * 37) / 1134;
        const openingHeight = (779 - 2 * 44) / 779;
        const boardScale = Math.min(
          availableWidth * openingWidth / game.canvas.width,
          availableHeight * openingHeight / game.canvas.height
        );
        maxWidth = game.canvas.width * boardScale;
        maxHeight = game.canvas.height * boardScale;
        canvasContainer.style.width = `${maxWidth / openingWidth}px`;
        canvasContainer.style.height = `${maxHeight / openingHeight}px`;
        fitDesignFrame = true;
      }
    }

    // Calculate the best scale to fit BOTH width and height
    const scaleX = maxWidth / game.canvas.width;
    const scaleY = maxHeight / game.canvas.height;
    const scaleFactor = Math.min(scaleX, scaleY, 1);

    // Apply the scale
    game.canvas.style.width = (fitDesignFrame ? maxWidth : game.canvas.width * scaleFactor) + "px";
    game.canvas.style.height = (fitDesignFrame ? maxHeight : game.canvas.height * scaleFactor) + "px";
    if (game.lifecycle?.active && typeof game.drawBoard === "function") {
      if (game.canvasResizeFrame) game.lifecycle.cancelAnimationFrame(game.canvasResizeFrame);
      game.canvasResizeFrame = game.lifecycle.requestAnimationFrame(() => {
        game.canvasResizeFrame = 0;
        game.drawBoard();
      });
    }
  };
  game.updateStatus = function (message) {
    const editorBanner = document.getElementById("editorStatusBanner");
    if (editorBanner) {
      editorBanner.textContent = message;
      game.lifecycle.clearTimeout(game.updateStatus._editorT);
      game.updateStatus._editorT = game.lifecycle.setTimeout(() => {
        if (editorBanner.textContent === message) editorBanner.textContent = "";
      }, 5000);
    }
    if (!game.SHOW_IN_GAME_STATUS) return;
    if (!game.statusMessage) return;
    game.statusMessage.textContent = message;
    game.lifecycle.setTimeout(() => {
      if (game.statusMessage.textContent === message) {
        game.statusMessage.textContent = "";
      }
    }, 3000);
  };
  game.updatePlayerCount = function () {
    if (!game.playerCount) return;
    if (game.CM_EDITOR_PAGE) game.playerCount.textContent = `Players: ${game.players.length}`;
    if (typeof game.cmEmitGameUi === "function") {
      game.cmEmitGameUi({
        type: "playerCount",
        count: game.players.length
      });
    }
  };
  game.updateMoveCountDisplay = function () {
    if (game.moveCountDisplay) {
      if (game.CM_EDITOR_PAGE) game.moveCountDisplay.textContent = `Your move: ${game.levelMoveCount}`;
    }
    if (typeof game.cmEmitGameUi === "function") {
      game.cmEmitGameUi({
        type: "moveCount",
        levelMoveCount: game.levelMoveCount
      });
    }
    game.updateLevelCompleteStatsDisplay();
  };
  game.updateLevelCompleteStatsDisplay = function () {
    if (game.levelCompleteMoveCountDisplay) {
      game.levelCompleteMoveCountDisplay.textContent = game.levelCompleteReplayAuthor
        ? String(game.levelMoveCount) : `Your move: ${game.levelMoveCount}`;
    }
    if (game.levelCompleteFewestOtherMovesDisplay) {
      const best = Number.isFinite(game.fewestOtherMovesForLevel) ? String(game.fewestOtherMovesForLevel) : "--";
      game.levelCompleteFewestOtherMovesDisplay.textContent = game.levelCompleteReplayAuthor ? best : `Others' best: ${best}`;
    }
    game.updateLevelCompleteAchievementDisplay();
  };
  game.updateLevelCompleteAchievementDisplay = function () {
    if (!game.levelCompleteAchievement) return;
    if (!Number.isFinite(game.levelMoveCount) || game.levelMoveCount < 0) {
      game.levelCompleteAchievement.textContent = "";
      return;
    }
    if (!Number.isFinite(game.fewestOtherMovesForLevel)) {
      game.levelCompleteAchievement.textContent = "New record! No other player's best route exists yet.";
      return;
    }
    if (game.levelMoveCount < game.fewestOtherMovesForLevel) {
      const diff = game.fewestOtherMovesForLevel - game.levelMoveCount;
      game.levelCompleteAchievement.textContent = `New record! You beat the best other route by ${diff} move${diff === 1 ? "" : "s"}.`;
      return;
    }
    if (game.levelMoveCount === game.fewestOtherMovesForLevel) {
      game.levelCompleteAchievement.textContent = "Great run! You tied the best other route.";
      return;
    }
    game.levelCompleteAchievement.textContent = "";
  };
  game.updateHintButton = function () {
    const hasBenchmark = Number.isFinite(game.fewestOtherMovesForLevel);
    if (game.fewestOtherMovesDisplay) {
      if (game.CM_EDITOR_PAGE) game.fewestOtherMovesDisplay.textContent = hasBenchmark ? `Others' best: ${game.fewestOtherMovesForLevel}` : "Others' best: --";
    }
    if (game.blockTipToggle) {
      game.blockTipToggle.classList.toggle("hint-toggle--notify", hasBenchmark && !game.hintUnlockedThisRun);
      const hintTitle = !hasBenchmark ? "Hint — No guide available for this level"
        : game.hintUnlockedThisRun ? "Hint — Free views and retries until you leave this level" : "Hint — Use 1 Hint for unlimited views and retries until you leave this level";
      game.blockTipToggle.title = hintTitle;
      game.blockTipToggle.setAttribute("aria-label", hintTitle);
    }
  };
  game.refreshFewestOtherMovesAffordance = function () {
    if (!game.CM_EDITOR_PAGE) game.updateHintButton();
  };
  game.openHintModal = function () {
    return game.useHintForCurrentRun();
  };
  game.updateInGameWalkthroughPanel = function () {
    const hasRecord = Number.isFinite(game.fewestOtherMovesForLevel);
    const hasGuide = hasRecord && game.fewestOtherMovesReplayPath?.length >= 2;
    game.inGameWalkthroughModal?.classList.toggle('hint-empty', !hasGuide);
    const emptyTitle = game.inGameWalkthroughModal?.querySelector('#inGameWalkthroughEmptyTitle');
    if (emptyTitle) emptyTitle.textContent = hasRecord
      ? 'The best route is not available to view yet.'
      : 'No other player has completed this level yet.';
    const hasName = !!(game.fewestOtherMovesUserName && String(game.fewestOtherMovesUserName).trim());
    const shownName = hasName ? String(game.fewestOtherMovesUserName).trim() : "Unknown";
    if (game.inGameWalkthroughAuthor) game.inGameWalkthroughAuthor.textContent = shownName;
    if (game.inGameWalkthroughBestMoves) game.inGameWalkthroughBestMoves.textContent = hasRecord ? String(game.fewestOtherMovesForLevel) : "-";
    if (game.inGameWalkthroughCanvas) game.inGameWalkthroughCanvas.style.display = "block";
    if (game.inGameWalkthroughHint) game.inGameWalkthroughHint.style.display = "block";
    if (game.inGameWalkthroughStep) game.inGameWalkthroughStep.style.display = "block";
    if (game.inGameWalkthroughEvent) game.inGameWalkthroughEvent.style.display = "block";
    game.setReplayStepNavVisible(game.inGameReplayStepNav, true);
  };
  game.openInGameWalkthroughModal = function () {
    if (!game.inGameWalkthroughModal) return;
    game.levelCompleteReplayIndex = 0;
    game.updateInGameWalkthroughPanel();
    if (Number.isFinite(game.fewestOtherMovesForLevel) && game.fewestOtherMovesReplayPath?.length >= 2) {
      game.drawInGameWalkthroughSnapshot(0);
    }
    showModal(game.inGameWalkthroughModal);
  };
  game.closeInGameWalkthroughModal = function () {
    if (!game.inGameWalkthroughModal) return;
    hideModal(game.inGameWalkthroughModal);
  };
  game.updateLevelCompleteReplayDisplay = function () {
    if (!game.levelCompleteReplayPanel) return;
    game.levelCompleteReplayPanel.style.display = "block";
    const hasReplay = !!(game.fewestOtherMovesReplayPath && game.fewestOtherMovesReplayPath.length >= 2);
    const hasName = !!(game.fewestOtherMovesUserName && String(game.fewestOtherMovesUserName).trim());
    const showLocked = Number.isFinite(game.fewestOtherMovesForLevel) && !game.hintUnlockedThisRun;
    if (game.levelCompleteReplayAuthor) {
      game.levelCompleteReplayAuthor.textContent = Number.isFinite(game.fewestOtherMovesForLevel)
        ? (hasName ? String(game.fewestOtherMovesUserName).trim() : "Unknown") : "--";
    }
    if (game.levelCompleteReplayPanel) {
      game.levelCompleteReplayPanel.classList.toggle("locked", !!showLocked);
    }
    game.levelCompleteReplayStepNav?.querySelectorAll("button").forEach(button => {
      button.disabled = showLocked;
    });
    if (!Number.isFinite(game.fewestOtherMovesForLevel)) {
      if (game.levelCompleteReplayTitle && !game.levelCompleteReplayAuthor) {
        game.levelCompleteReplayTitle.textContent = "Best Route by --";
      }
      if (game.levelCompleteReplaySubtitle) {
        game.levelCompleteReplaySubtitle.textContent = "No other player's best route yet. You set the current record.";
      }
      if (game.levelCompleteReplayCanvas) game.levelCompleteReplayCanvas.style.display = "none";
      if (game.levelCompleteReplayHint) game.levelCompleteReplayHint.style.display = "none";
      if (game.levelCompleteReplayStep) game.levelCompleteReplayStep.style.display = "none";
      game.setReplayStepNavVisible(game.levelCompleteReplayStepNav, false);
      if (game.levelCompleteReplayEvent) {
        game.levelCompleteReplayEvent.style.display = "none";
        game.levelCompleteReplayEvent.textContent = "";
      }
      if (game.levelCompleteReplayLock) game.levelCompleteReplayLock.style.display = "none";
      if (game.levelCompleteReplayPanel) game.levelCompleteReplayPanel.classList.remove("locked");
      return;
    }
    if (showLocked) {
      if (game.levelCompleteReplayTitle && !game.levelCompleteReplayAuthor) {
        const shownName = hasName ? String(game.fewestOtherMovesUserName).trim() : "Unknown";
        game.levelCompleteReplayTitle.textContent = `Best Route by ${shownName}`;
      }
      if (game.levelCompleteReplaySubtitle) {
        game.levelCompleteReplaySubtitle.textContent = `Fewest moves: ${game.fewestOtherMovesForLevel}`;
      }
      if (game.levelCompleteReplayCanvas) game.levelCompleteReplayCanvas.style.display = "block";
      if (game.levelCompleteReplayHint) game.levelCompleteReplayHint.style.display = "block";
      if (game.levelCompleteReplayStep) game.levelCompleteReplayStep.style.display = "block";
      game.setReplayStepNavVisible(game.levelCompleteReplayStepNav, !!game.levelCompleteReplayAuthor);
      if (game.levelCompleteReplayEvent) game.levelCompleteReplayEvent.style.display = "block";
      if (game.levelCompleteReplayLock) game.levelCompleteReplayLock.style.display = "flex";
      game.refreshLevelCompleteReplayLockCostEl();
      if (hasReplay) {
        game.drawLevelCompleteReplaySnapshot(game.levelCompleteReplayIndex);
      }
      return;
    }
    if (!hasReplay) {
      if (game.levelCompleteReplayTitle && !game.levelCompleteReplayAuthor) {
        const shownName = hasName ? String(game.fewestOtherMovesUserName).trim() : "Unknown";
        game.levelCompleteReplayTitle.textContent = `Best Route by ${shownName}`;
      }
      if (game.levelCompleteReplaySubtitle) {
        game.levelCompleteReplaySubtitle.textContent = `Fewest moves: ${game.fewestOtherMovesForLevel}`;
      }
      if (game.levelCompleteReplayCanvas) game.levelCompleteReplayCanvas.style.display = "none";
      if (game.levelCompleteReplayHint) game.levelCompleteReplayHint.style.display = "none";
      if (game.levelCompleteReplayStep) game.levelCompleteReplayStep.style.display = "none";
      game.setReplayStepNavVisible(game.levelCompleteReplayStepNav, false);
      if (game.levelCompleteReplayEvent) {
        game.levelCompleteReplayEvent.style.display = "none";
        game.levelCompleteReplayEvent.textContent = "";
      }
      if (game.levelCompleteReplayLock) game.levelCompleteReplayLock.style.display = "none";
      return;
    }
    if (game.levelCompleteReplayLock) game.levelCompleteReplayLock.style.display = "none";
    if (game.levelCompleteReplayTitle && !game.levelCompleteReplayAuthor) {
      const shownName = hasName ? String(game.fewestOtherMovesUserName).trim() : "Unknown";
      game.levelCompleteReplayTitle.textContent = `Best Route by ${shownName}`;
    }
    if (game.levelCompleteReplaySubtitle) {
      game.levelCompleteReplaySubtitle.textContent = `Fewest moves: ${game.fewestOtherMovesForLevel}`;
    }
    if (game.levelCompleteReplayCanvas) game.levelCompleteReplayCanvas.style.display = "block";
    if (game.levelCompleteReplayHint) game.levelCompleteReplayHint.style.display = "block";
    if (game.levelCompleteReplayStep) game.levelCompleteReplayStep.style.display = "block";
    game.setReplayStepNavVisible(game.levelCompleteReplayStepNav, true);
    if (game.levelCompleteReplayEvent) game.levelCompleteReplayEvent.style.display = "block";
    game.drawLevelCompleteReplaySnapshot(game.levelCompleteReplayIndex);
  };
  game.updateFewestOtherMovesDisplay = function (bestMoves, replayPath, userName) {
    game.fewestOtherMovesForLevel = Number.isFinite(bestMoves) ? bestMoves : null;
    game.fewestOtherMovesUserName = typeof userName === "string" ? userName.trim() : "";
    game.fewestOtherMovesReplayPath = game.sanitizeReplayPath(replayPath);
    game.fewestOtherMovesReplayMoveCounts = game.buildReplayMoveCounts(game.fewestOtherMovesReplayPath || []);
    if (game.fewestOtherMovesReplayPath) {
      game.levelCompleteReplayIndex = 0;
    }
    game.refreshFewestOtherMovesAffordance();
    game.updateLevelCompleteStatsDisplay();
    game.updateLevelCompleteReplayDisplay();
    if (typeof game.cmEmitGameUi === "function") {
      game.cmEmitGameUi({
        type: "fewestOtherMoves",
        bestMoves: game.fewestOtherMovesForLevel,
        userName: game.fewestOtherMovesUserName,
        hintUnlockedThisRun: game.hintUnlockedThisRun
      });
    }
  };
  game.fetchFewestOtherMovesForCurrentLevel = async function () {
    const runId = game.hintRunId;
    const levelNumber = game.currentLevelIndex + 1;
    if (!Number.isFinite(levelNumber) || levelNumber <= 0) {
      game.updateFewestOtherMovesDisplay(null, null, "", false);
      return;
    }
    const apiBaseUrl = session.API_BASE_URL || "https://chessmater-production.up.railway.app";
    const headers = {};
    if (session.cmToken) {
      headers.Authorization = `Bearer ${session.cmToken}`;
    }
    try {
      const res = await fetch(`${apiBaseUrl}/stats/fewest-other-moves?level=${encodeURIComponent(levelNumber)}`, {
        method: "GET",
        credentials: "include",
        headers
      });
      if (game.hintRunId !== runId) return;
      if (!res.ok) {
        game.updateFewestOtherMovesDisplay(null, null, "", false);
        return;
      }
      const data = await res.json();
      if (game.hintRunId !== runId) return;
      const bestMoves = Number.parseInt(data?.best_moves, 10);
      const bestName = typeof data?.username === "string" && data.username.trim() ? data.username : "";
      game.updateFewestOtherMovesDisplay(bestMoves, data?.best_path, bestName);
    } catch (_) {
      if (game.hintRunId !== runId) return;
      game.updateFewestOtherMovesDisplay(null, null, "", false);
    }
  };
  game.updateObjectiveCount = // Update objective counter display
  function () {
    if (!game.objectiveCount) return;
    const completed = game.objectives.filter(obj => obj.completed).length;
    if (game.CM_EDITOR_PAGE) game.objectiveCount.textContent = `Objectives: ${completed}/${game.totalObjectives}`;
    if (typeof game.cmEmitGameUi === "function") {
      game.cmEmitGameUi({
        type: "objectiveCount",
        completed,
        totalObjectives: game.totalObjectives
      });
    }
  };
  game.updateTargetPieceCount = function () {
    if (!game.targetPieceCount) return;
    const captured = game.targetPieces.filter(piece => piece.captured).length;
    if (game.CM_EDITOR_PAGE) game.targetPieceCount.textContent = `Target Pieces: ${captured}/${game.totalTargetPieces}`;
    if (typeof game.cmEmitGameUi === "function") {
      game.cmEmitGameUi({
        type: "targetPieceCount",
        captured,
        totalTargetPieces: game.totalTargetPieces
      });
    }
  };
  game.getUnlockProgressText = function () {
    return `Objectives ${game.objectivesCompleted}/${game.totalObjectives}, Target Pieces ${game.targetPiecesCaptured}/${game.totalTargetPieces}`;
  };
  game.areAllObjectivesCompleted = // Check if all objectives are completed
  function () {
    return game.objectivesCompleted >= game.totalObjectives && game.targetPiecesCaptured >= game.totalTargetPieces;
  };
  game.completeObjective = // Complete an objective
  function (row, col) {
    const objective = game.objectives.find(obj => obj.row === row && obj.col === col);
    if (objective && !objective.completed) {
      objective.completed = true;
      game.objectivesCompleted++;
      // Remove only the collectible, preserving pieces and moving hazards.
      if (game.players.some(player => player.row === row && player.col === col)) {
        game.board[row][col] = game.CELL_TYPES.PLAYER;
      } else if ([game.CELL_TYPES.OBJECTIVE, game.CELL_TYPES.OBJECTIVE_COMPLETED].includes(game.board[row][col])) {
        game.board[row][col] = game.CELL_TYPES.EMPTY;
      }
      game.updateObjectiveCount();
      game.updateStatus(`Objective completed! ${game.objectivesCompleted}/${game.totalObjectives}`);
      return true;
    }
    return false;
  };
  game.getObjectiveCellTypeAt = function (row, col) {
    const objective = game.objectives.find(obj => obj.row === row && obj.col === col);
    if (!objective) return game.CELL_TYPES.EMPTY;
    return objective.completed ? game.CELL_TYPES.EMPTY : game.CELL_TYPES.OBJECTIVE;
  };
  game.collectObjectivesAlongMove = function (fromRow, fromCol, toRow, toCol, stopBefore = null) {
    for (const cell of game.getMoveTraversalCells(fromRow, fromCol, toRow, toCol)) {
      if (stopBefore && cell.row === stopBefore.row && cell.col === stopBefore.col) break;
      game.completeObjective(cell.row, cell.col);
    }
  };
  game.checkObjectiveCompletion = // Check for objective completion when players move
  function () {
    for (const player of game.players) {
      for (const objective of game.objectives) {
        if (!objective.completed && player.row === objective.row && player.col === objective.col) {
          game.completeObjective(objective.row, objective.col);
        }
      }
    }
  };
  game.getTargetPieceAt = function (row, col) {
    return game.targetPieces.findIndex(piece => !piece.captured && piece.row === row && piece.col === col);
  };
  game.removeTargetPieceAt = function (row, col) {
    const index = game.targetPieces.findIndex(piece => piece.row === row && piece.col === col);
    if (index !== -1) {
      game.targetPieces.splice(index, 1);
      game.totalTargetPieces = game.targetPieces.length;
      game.targetPiecesCaptured = game.targetPieces.filter(piece => piece.captured).length;
      game.updateTargetPieceCount();
    }
  };
  game.completeTargetPiece = function (row, col) {
    const targetIndex = game.getTargetPieceAt(row, col);
    if (targetIndex === -1) return false;
    game.targetPieces[targetIndex].captured = true;
    game.targetPiecesCaptured++;
    game.board[row][col] = game.CELL_TYPES.EMPTY;
    game.updateTargetPieceCount();
    game.updateStatus(`Target piece captured! ${game.targetPiecesCaptured}/${game.totalTargetPieces}`);
    return true;
  };
  game.resetPhaseBlocks = // Normalize legacy phase-cell values in editor data
  function () {
    game.phaseBlockStates = {};
    for (let r = 0; r < game.ROWS; r++) {
      for (let c = 0; c < game.COLS; c++) {
        if (game.board[r][c] === game.CELL_TYPES.PHASE_BLOCK_ACTIVE) {
          game.board[r][c] = game.CELL_TYPES.PHASE_BLOCK;
        }
      }
    }
  };
  game.createBoomBomb = function (row, col, type) {
    const isLeftDiagonal = type === "boom_left";
    return {
      row,
      col,
      type,
      rowDirection: 1,
      colDirection: isLeftDiagonal ? -1 : 1
    };
  };
  game.getDuckAt = function (row, col) {
    return game.ducks.findIndex(duck => duck.row === row && duck.col === col);
  };
  game.isBoomPieceType = function (pieceType) {
    return pieceType === "boom_right" || pieceType === "boom_left";
  };
  game.isBoomBomb = function (bomb) {
    return game.isBoomPieceType(bomb.type);
  };
}
export function initialize(game) {
  game.showTransformerMenu = false;
  game.transformerPosition = null;
  game.transformerPlayerIndex = -1;
  game.fogToggle = document.getElementById("levelFogToggle");
  if (game.fogToggle) {
    game.lifecycle.listen(game.fogToggle, "change", e => {
      game.fogEnabled = e.target.checked;
      game.updateStatus(`Fog of War ${game.fogEnabled ? "Enabled" : "Disabled"} for this level`);
      game.drawBoard(); // Redraw immediately to show/hide fog
    });
  }
  // Module initialization may precede DOMContentLoaded in the editor.
  if (document.readyState === "loading") {
    game.lifecycle.listen(document, "DOMContentLoaded", game.bindLevelCompleteUi);
  } else {
    game.bindLevelCompleteUi();
  }
  game.setupAntigravityExchangeModal();
  game.setupLevelCompleteHint();
  game.setupInGameWalkthrough();
  game.setupReplayStepNav();
  game.setupHintButton();





}
