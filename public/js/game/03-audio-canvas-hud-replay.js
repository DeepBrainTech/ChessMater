/**
 * game/03-audio-canvas-hud-replay.js
 * Audio, canvas, HUD, replay, objectives + deferred setup*() from former lines 1029-1038
 * Split from game.js lines 1039-1950 — logic unchanged.
 */

function isAudioMuted() {
  return !!window.cmAudioMuted;
}

function playSound(audioEl, volume) {
  if (!audioEl || isAudioMuted()) return;
  audioEl.currentTime = 0;
  if (typeof volume === "number") audioEl.volume = volume;
  audioEl.play().catch(() => {});
}


// Transformer block variables
let showTransformerMenu = false;
let transformerPosition = null;
let transformerPlayerIndex = -1;

const fogToggle = document.getElementById("levelFogToggle");
if (fogToggle) {
  fogToggle.addEventListener("change", (e) => {
    fogEnabled = e.target.checked;
    updateStatus(`Fog of War ${fogEnabled ? "Enabled" : "Disabled"} for this level`);
    drawBoard(); // Redraw immediately to show/hide fog
  });
}

// gravityBtn.addEventListener("click", () => {
//   applyGravity();
// });

function bindLevelCompleteUi() {
  try {
    const legacyNextBtn = document.getElementById('nextLevelBtn');
    if (legacyNextBtn) {
      const legacyContainer = legacyNextBtn.parentElement;
      legacyNextBtn.remove();
      if (legacyContainer && legacyContainer.children.length === 0) {
        legacyContainer.remove();
      }
    }

    if (levelCompleteRetryBtn) {
      levelCompleteRetryBtn.addEventListener('click', () => {
        if (levelCompleteModal) levelCompleteModal.classList.remove('active');
        restartLevel();
      });
    }

    if (levelCompleteNextBtn) {
      levelCompleteNextBtn.addEventListener('click', () => {
        if (currentLevelIndex < LEVELS.length - 1) {
          currentLevelIndex++;
          if (levelCompleteModal) levelCompleteModal.classList.remove('active');
          loadPuzzle(LEVELS[currentLevelIndex]);
        }
      });
    }

    if (closeLevelCompleteModalBtn && levelCompleteModal) {
      closeLevelCompleteModalBtn.addEventListener('click', () => {
        levelCompleteModal.classList.remove('active');
      });
      levelCompleteModal.addEventListener('click', (e) => {
        if (e.target === levelCompleteModal) {
          levelCompleteModal.classList.remove('active');
        }
      });
    }
  } catch (e) {}
}
// React mounts scripts after DOMContentLoaded; run now if document is already ready.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bindLevelCompleteUi);
} else {
  bindLevelCompleteUi();
}

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

  const layoutRow = document.getElementById("gameLayoutRow");
  const sidePanel = document.getElementById("gameSidePanel");
  const canvasContainer = canvas.parentElement;

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

  // Calculate the best scale to fit BOTH width and height
  const scaleX = maxWidth / canvas.width;
  const scaleY = maxHeight / canvas.height;
  const scaleFactor = Math.min(scaleX, scaleY, 1); // Never scale up past 100%

  // Apply the scale
  canvas.style.width = (canvas.width * scaleFactor) + "px";
  canvas.style.height = (canvas.height * scaleFactor) + "px";
}

function updateStatus(message) {
  const editorBanner = document.getElementById("editorStatusBanner");
  if (editorBanner) {
    editorBanner.textContent = message;
    clearTimeout(updateStatus._editorT);
    updateStatus._editorT = setTimeout(() => {
      if (editorBanner.textContent === message) editorBanner.textContent = "";
    }, 5000);
  }
  if (!SHOW_IN_GAME_STATUS) return;
  if (!statusMessage) return;
  statusMessage.textContent = message;
  setTimeout(() => {
    if (statusMessage.textContent === message) {
      statusMessage.textContent = "";
    }
  }, 3000);
}

function updatePlayerCount() {
  if (!playerCount) return;
  playerCount.textContent = `Players: ${players.length}`;
  if (typeof window.cmEmitGameUi === "function") {
    window.cmEmitGameUi({ type: "playerCount", count: players.length });
  }
}

function updateMoveCountDisplay() {
  if (moveCountDisplay) {
    moveCountDisplay.textContent = `Your move: ${levelMoveCount}`;
  }
  if (typeof window.cmEmitGameUi === "function") {
    window.cmEmitGameUi({ type: "moveCount", levelMoveCount });
  }
  updateLevelCompleteStatsDisplay();
}

function updateLevelCompleteStatsDisplay() {
  if (levelCompleteMoveCountDisplay) {
    levelCompleteMoveCountDisplay.textContent = `Your move: ${levelMoveCount}`;
  }
  if (levelCompleteFewestOtherMovesDisplay) {
    levelCompleteFewestOtherMovesDisplay.textContent = Number.isFinite(fewestOtherMovesForLevel)
      ? `Others' best: ${fewestOtherMovesForLevel}`
      : "Others' best: --";
  }
  updateLevelCompleteAchievementDisplay();
}

function updateLevelCompleteAchievementDisplay() {
  if (!levelCompleteAchievement) return;
  if (!Number.isFinite(levelMoveCount) || levelMoveCount < 0) {
    levelCompleteAchievement.textContent = "";
    return;
  }

  if (!Number.isFinite(fewestOtherMovesForLevel)) {
    levelCompleteAchievement.textContent = "New record! No other player's best route exists yet.";
    return;
  }

  if (levelMoveCount < fewestOtherMovesForLevel) {
    const diff = fewestOtherMovesForLevel - levelMoveCount;
    levelCompleteAchievement.textContent = `New record! You beat the best other route by ${diff} move${diff === 1 ? "" : "s"}.`;
    return;
  }

  if (levelMoveCount === fewestOtherMovesForLevel) {
    levelCompleteAchievement.textContent = "Great run! You tied the best other route.";
    return;
  }

  levelCompleteAchievement.textContent = "";
}

function buildCurrentReplaySnapshot(moveMeta = null) {
  return {
    rows: ROWS,
    cols: COLS,
    board: cloneGameData(board),
    players: cloneGameData(players),
    goal: cloneGameData(goal),
    objectives: cloneGameData(objectives),
    move: moveMeta ? cloneGameData(moveMeta) : null
  };
}

function resetCurrentLevelMoveTrace() {
  pendingMoveTraceEntry = null;
  currentLevelMoveTrace = [buildCurrentReplaySnapshot(null)];
}

function queueMoveTraceCapture(moveMeta) {
  pendingMoveTraceEntry = moveMeta || {};
}

function markPendingMoveTraceAntigravity(flag = true) {
  if (!pendingMoveTraceEntry) return;
  pendingMoveTraceEntry.antigravityApplied = !!flag;
}

function queueSystemTraceCapture(meta) {
  if (pendingMoveTraceEntry) return;
  pendingMoveTraceEntry = meta || {};
}

function tryCapturePendingMoveTrace(force) {
  if (!pendingMoveTraceEntry) return;
  const settled = force || (
    fallingPieces.length === 0 &&
    risingPieces.length === 0 &&
    !pendingMoveCounter
  );
  if (!settled) return;

  const snapshot = buildCurrentReplaySnapshot(pendingMoveTraceEntry);
  currentLevelMoveTrace.push(snapshot);
  if (currentLevelMoveTrace.length > 500) {
    currentLevelMoveTrace.splice(1, currentLevelMoveTrace.length - 500);
  }
  pendingMoveTraceEntry = null;
}

function sanitizeReplayPath(rawPath) {
  if (!Array.isArray(rawPath) || rawPath.length === 0) return null;
  const cleaned = rawPath.filter(step =>
    step &&
    Number.isFinite(Number(step.rows)) &&
    Number.isFinite(Number(step.cols)) &&
    Array.isArray(step.board) &&
    Array.isArray(step.players)
  );
  return cleaned.length ? cleaned : null;
}

function hasReplayPlayerMove(step) {
  const moveMeta = step && step.move ? step.move : null;
  return !!(
    moveMeta &&
    moveMeta.from &&
    Number.isFinite(Number(moveMeta.from.row)) &&
    Number.isFinite(Number(moveMeta.from.col)) &&
    moveMeta.to &&
    Number.isFinite(Number(moveMeta.to.row)) &&
    Number.isFinite(Number(moveMeta.to.col))
  );
}

function buildReplayStepNumbers(path) {
  if (!Array.isArray(path) || !path.length) return [];

  const numbers = Array(path.length).fill(0);
  const moveOrdinals = Array(path.length).fill(0);
  let moveCounter = 0;

  for (let i = 0; i < path.length; i++) {
    if (hasReplayPlayerMove(path[i])) {
      moveCounter += 1;
      moveOrdinals[i] = moveCounter;
    }
  }

  for (let i = 0; i < path.length; i++) {
    if (i === 0) {
      numbers[i] = 0;
      continue;
    }

    if (moveOrdinals[i] > 0) {
      numbers[i] = moveOrdinals[i];
      continue;
    }

    // System-only frames share the next move number (if any), so users see
    // "antigravity result -> move" under one logical step.
    let nextMoveOrdinal = 0;
    for (let j = i + 1; j < path.length; j++) {
      if (moveOrdinals[j] > 0) {
        nextMoveOrdinal = moveOrdinals[j];
        break;
      }
    }
    numbers[i] = nextMoveOrdinal > 0 ? nextMoveOrdinal : moveCounter;
  }

  return numbers;
}

function drawReplayCellDecoration(replayCtx, cellType, x, y, tile) {
  const inset = Math.max(1, Math.floor(tile * 0.08));
  const innerSize = Math.max(1, tile - inset * 2);
  const centerX = x + tile / 2;
  const centerY = y + tile / 2;

  if (cellType === CELL_TYPES.SOLID_BLOCK) {
    replayCtx.fillStyle = "rgba(46, 204, 113, 0.7)";
    replayCtx.fillRect(x + inset, y + inset, innerSize, innerSize);
    return;
  }

  if (cellType === CELL_TYPES.PHASE_BLOCK) {
    replayCtx.fillStyle = "rgba(52, 152, 219, 0.3)";
    replayCtx.fillRect(x + inset, y + inset, innerSize, innerSize);
    replayCtx.fillStyle = "rgba(25, 118, 210, 0.6)";
    const arrow = Math.max(2, Math.floor(tile * 0.16));
    const bottom = y + tile - inset - 1;
    replayCtx.beginPath();
    replayCtx.moveTo(centerX, bottom);
    replayCtx.lineTo(centerX - arrow, bottom - arrow);
    replayCtx.lineTo(centerX + arrow, bottom - arrow);
    replayCtx.closePath();
    replayCtx.fill();
    return;
  }

  if (cellType === CELL_TYPES.PHASE_BLOCK_ACTIVE) {
    replayCtx.fillStyle = "rgba(41, 128, 185, 0.8)";
    replayCtx.fillRect(x + inset, y + inset, innerSize, innerSize);
    return;
  }

  if (cellType === CELL_TYPES.TRANSFORMER) {
    replayCtx.fillStyle = "rgba(155, 89, 182, 0.7)";
    replayCtx.fillRect(x + inset, y + inset, innerSize, innerSize);
    replayCtx.fillStyle = "#ffffff";
    replayCtx.textAlign = "center";
    replayCtx.textBaseline = "middle";
    replayCtx.font = `bold ${Math.max(8, Math.floor(tile * 0.5))}px Arial`;
    replayCtx.fillText("?", centerX, centerY + 0.5);
    return;
  }

  if (cellType === CELL_TYPES.OBJECTIVE || cellType === CELL_TYPES.OBJECTIVE_COMPLETED) {
    replayCtx.fillStyle = cellType === CELL_TYPES.OBJECTIVE
      ? "rgba(243, 156, 18, 0.7)"
      : "rgba(46, 204, 113, 0.7)";
    replayCtx.beginPath();
    replayCtx.moveTo(centerX, y + inset);
    replayCtx.lineTo(x + tile - inset, centerY);
    replayCtx.lineTo(centerX, y + tile - inset);
    replayCtx.lineTo(x + inset, centerY);
    replayCtx.closePath();
    replayCtx.fill();
    if (cellType === CELL_TYPES.OBJECTIVE_COMPLETED) {
      replayCtx.strokeStyle = "#ffffff";
      replayCtx.lineWidth = Math.max(1, tile * 0.06);
      replayCtx.beginPath();
      replayCtx.moveTo(x + tile * 0.28, centerY);
      replayCtx.lineTo(x + tile * 0.44, y + tile * 0.7);
      replayCtx.lineTo(x + tile * 0.74, y + tile * 0.3);
      replayCtx.stroke();
    }
    return;
  }

  if ([
    CELL_TYPES.TELEPORT_PURPLE,
    CELL_TYPES.TELEPORT_GREEN,
    CELL_TYPES.TELEPORT_BLUE,
    CELL_TYPES.TELEPORT_ORANGE
  ].includes(cellType)) {
    const color = TELEPORT_COLORS[cellType];
    if (color) {
      replayCtx.fillStyle = color.fill;
      replayCtx.beginPath();
      replayCtx.arc(centerX, centerY, tile / 3, 0, Math.PI * 2);
      replayCtx.fill();
      replayCtx.strokeStyle = color.stroke;
      replayCtx.lineWidth = Math.max(1, tile * 0.07);
      replayCtx.stroke();
    }
    return;
  }

  if (cellType === CELL_TYPES.BOMB) {
    const img = pieceImages.bomb;
    if (img && img.complete) {
      const pad = Math.max(1, Math.floor(tile * 0.13));
      replayCtx.drawImage(img, x + pad, y + pad, tile - pad * 2, tile - pad * 2);
    } else {
      replayCtx.fillStyle = "#111111";
      replayCtx.beginPath();
      replayCtx.arc(centerX, centerY, tile * 0.28, 0, Math.PI * 2);
      replayCtx.fill();
    }
    return;
  }

  if (cellType === CELL_TYPES.GOAL || cellType === CELL_TYPES.COUNTER_GOAL) {
    const img = pieceImages.target;
    if (img && img.complete) {
      const pad = Math.max(1, Math.floor(tile * 0.13));
      replayCtx.drawImage(img, x + pad, y + pad, tile - pad * 2, tile - pad * 2);
    } else {
      replayCtx.fillStyle = "#c62828";
      replayCtx.beginPath();
      replayCtx.arc(centerX, centerY, tile * 0.28, 0, Math.PI * 2);
      replayCtx.fill();
    }
  }
}

function drawReplayPlayerPiece(replayCtx, pieceType, row, col, ox, oy, tile) {
  const x = ox + col * tile;
  const y = oy + row * tile;
  const pad = Math.max(1, Math.floor(tile * 0.13));
  const img = pieceImages[pieceType];
  if (img && img.complete) {
    replayCtx.drawImage(img, x + pad, y + pad, tile - pad * 2, tile - pad * 2);
    return;
  }
  replayCtx.fillStyle = "#ffffff";
  replayCtx.beginPath();
  replayCtx.arc(x + tile / 2, y + tile / 2, Math.max(2, tile * 0.32), 0, Math.PI * 2);
  replayCtx.fill();
  replayCtx.fillStyle = "#2c3e50";
  replayCtx.textAlign = "center";
  replayCtx.textBaseline = "middle";
  replayCtx.font = `600 ${Math.max(7, Math.floor(tile * 0.35))}px Segoe UI`;
  replayCtx.fillText(String(pieceType || "P").charAt(0).toUpperCase(), x + tile / 2, y + tile / 2 + 0.5);
}

function drawReplaySnapshotOnCanvas(index, canvasEl, stepEl, eventEl) {
  if (!canvasEl || !fewestOtherMovesReplayPath || !fewestOtherMovesReplayPath.length) return;
  const replayCtx = canvasEl.getContext("2d");
  if (!replayCtx) return;

  const safeIndex = Math.max(0, Math.min(index, fewestOtherMovesReplayPath.length - 1));
  levelCompleteReplayIndex = safeIndex;
  const snapshot = fewestOtherMovesReplayPath[safeIndex];
  const rows = Number(snapshot.rows) || 1;
  const cols = Number(snapshot.cols) || 1;
  const boardData = Array.isArray(snapshot.board) ? snapshot.board : [];
  const playersData = Array.isArray(snapshot.players) ? snapshot.players : [];

  const cw = canvasEl.width;
  const ch = canvasEl.height;
  replayCtx.clearRect(0, 0, cw, ch);
  replayCtx.fillStyle = "#0d1118";
  replayCtx.fillRect(0, 0, cw, ch);

  const pad = 8;
  const tile = Math.max(4, Math.floor(Math.min((cw - pad * 2) / cols, (ch - pad * 2) / rows)));
  const boardW = tile * cols;
  const boardH = tile * rows;
  const ox = Math.floor((cw - boardW) / 2);
  const oy = Math.floor((ch - boardH) / 2);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cellType = Number(boardData?.[r]?.[c]);
      const x = ox + c * tile;
      const y = oy + r * tile;
      replayCtx.fillStyle = (r + c) % 2 === 0 ? "#b6cce0ff" : "#ffffffff";
      replayCtx.fillRect(x, y, tile, tile);
      replayCtx.strokeStyle = "rgba(0,0,0,0.12)";
      replayCtx.strokeRect(x + 0.5, y + 0.5, tile, tile);
      drawReplayCellDecoration(replayCtx, cellType, x, y, tile);
    }
  }

  for (const p of playersData) {
    if (!p || !Number.isFinite(p.row) || !Number.isFinite(p.col)) continue;
    drawReplayPlayerPiece(replayCtx, p.pieceType, p.row, p.col, ox, oy, tile);
  }

  if (stepEl) {
    const logicalStep = fewestOtherMovesReplayStepNumbers[safeIndex] || 0;
    const totalLogicalSteps = Number.isFinite(fewestOtherMovesForLevel)
      ? fewestOtherMovesForLevel
      : (fewestOtherMovesReplayStepNumbers.length ? Math.max(...fewestOtherMovesReplayStepNumbers) : 0);
    stepEl.textContent = `Step: ${logicalStep}/${totalLogicalSteps}`;
  }
  if (eventEl) {
    const moveMeta = snapshot && snapshot.move ? snapshot.move : null;
    if (moveMeta && moveMeta.antigravityApplied) {
      eventEl.textContent = "Antigravity used on this step.";
    } else {
      eventEl.textContent = "";
    }
  }
}

function drawLevelCompleteReplaySnapshot(index) {
  drawReplaySnapshotOnCanvas(
    index,
    levelCompleteReplayCanvas,
    levelCompleteReplayStep,
    levelCompleteReplayEvent
  );
}

function drawInGameWalkthroughSnapshot(index) {
  drawReplaySnapshotOnCanvas(
    index,
    inGameWalkthroughCanvas,
    inGameWalkthroughStep,
    inGameWalkthroughEvent
  );
}

function stepReplayNavigation(action) {
  const walkthroughModalActive =
    inGameWalkthroughModal && inGameWalkthroughModal.classList.contains("active");
  const levelCompleteModalActive =
    levelCompleteModal && levelCompleteModal.classList.contains("active");
  if (!fewestOtherMovesReplayPath || !fewestOtherMovesReplayPath.length) return;
  if (levelCompleteModalActive && !replayUnlockedForLevel) return;

  const maxIndex = fewestOtherMovesReplayPath.length - 1;
  let nextIndex = levelCompleteReplayIndex;
  if (action === "prev") nextIndex = levelCompleteReplayIndex - 1;
  else if (action === "next") nextIndex = levelCompleteReplayIndex + 1;
  else if (action === "first") nextIndex = 0;
  else if (action === "last") nextIndex = maxIndex;
  else return;

  if (walkthroughModalActive) {
    drawInGameWalkthroughSnapshot(nextIndex);
  } else if (levelCompleteModalActive) {
    drawLevelCompleteReplaySnapshot(nextIndex);
  }
}

function setReplayStepNavVisible(navEl, visible) {
  if (!navEl) return;
  navEl.style.display = visible ? "grid" : "none";
}

function setupReplayStepNav() {
  document.querySelectorAll("[data-replay-step]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      stepReplayNavigation(btn.getAttribute("data-replay-step"));
    });
  });
}

function updateHintSolutionSection() {
  const hasBenchmark = Number.isFinite(fewestOtherMovesForLevel);
  const hasReplay = !!(fewestOtherMovesReplayPath && fewestOtherMovesReplayPath.length >= 2);
  const shopAvailable = portalUndoShopAvailable();

  if (fewestOtherMovesDisplay) {
    fewestOtherMovesDisplay.textContent = hasBenchmark
      ? `Others' best: ${fewestOtherMovesForLevel}`
      : "Others' best: --";
  }
  if (typeof window.cmEmitGameUi === "function") {
    window.cmEmitGameUi({
      type: "fewestOtherMoves",
      bestMoves: hasBenchmark ? fewestOtherMovesForLevel : null,
      userName: fewestOtherMovesUserName,
      replayUnlocked: replayUnlockedForLevel,
    });
  }

  if (blockTipToggle) {
    blockTipToggle.classList.toggle(
      "hint-toggle--notify",
      hasBenchmark && !replayUnlockedForLevel
    );
    blockTipToggle.title = hasBenchmark && !replayUnlockedForLevel
      ? "Hint — solution guide available to unlock"
      : "Level tips and solution guide";
  }

  if (!hintSolutionSummary || !hintSolutionActionBtn) return;

  if (!hasBenchmark) {
    hintSolutionSummary.textContent = "No other player has cleared this level yet.";
    hintSolutionActionBtn.style.display = "none";
    hintSolutionActionBtn.disabled = true;
    if (hintSolutionNote) hintSolutionNote.textContent = "Check back after someone else completes this level.";
    return;
  }

  const shownName =
    fewestOtherMovesUserName && String(fewestOtherMovesUserName).trim()
      ? String(fewestOtherMovesUserName).trim()
      : "another player";
  hintSolutionSummary.textContent = `Best route by ${shownName}: ${fewestOtherMovesForLevel} moves`;

  if (!replayUnlockedForLevel) {
    hintSolutionActionBtn.style.display = "inline-block";
    hintSolutionActionBtn.textContent = "Unlock guide";
    hintSolutionActionBtn.disabled = !shopAvailable;
    if (hintSolutionNote) {
      hintSolutionNote.textContent = shopAvailable
        ? "Watch their route step by step after unlocking."
        : "Unlock is not available in this environment (Portal shop required).";
    }
    return;
  }

  hintSolutionActionBtn.style.display = "inline-block";
  hintSolutionActionBtn.textContent = "View guide";
  hintSolutionActionBtn.disabled = !hasReplay;
  if (hintSolutionNote) {
    hintSolutionNote.textContent = hasReplay
      ? "Opens an interactive walkthrough you can step through."
      : "Route data is not available yet for this level.";
  }
}

function refreshFewestOtherMovesAffordance() {
  if (CM_EDITOR_PAGE) return;
  updateHintSolutionSection();
}

function closeHintModal() {
  if (!blockTipModal) return;
  blockTipModal.classList.remove("active");
  blockTipModal.setAttribute("aria-hidden", "true");
}

function openHintModal() {
  if (!blockTipModal) return;
  updateHintSolutionSection();
  blockTipModal.classList.add("active");
  blockTipModal.setAttribute("aria-hidden", "false");
}

function handleSolutionGuideAction() {
  if (CM_EDITOR_PAGE) return;

  if (!Number.isFinite(fewestOtherMovesForLevel)) {
    return;
  }
  if (!replayUnlockedForLevel) {
    closeHintModal();
    openReplayExchangeModal();
    return;
  }
  if (!fewestOtherMovesReplayPath || fewestOtherMovesReplayPath.length < 2) {
    return;
  }
  closeHintModal();
  openInGameWalkthroughModal();
}

function updateInGameWalkthroughPanel() {
  const hasName = !!(fewestOtherMovesUserName && String(fewestOtherMovesUserName).trim());
  const shownName = hasName ? String(fewestOtherMovesUserName).trim() : "Unknown";
  if (inGameWalkthroughTitle) {
    inGameWalkthroughTitle.textContent = `Best Route by ${shownName}`;
  }
  if (inGameWalkthroughSubtitle && Number.isFinite(fewestOtherMovesForLevel)) {
    inGameWalkthroughSubtitle.textContent = `Fewest moves: ${fewestOtherMovesForLevel}`;
  }
  if (inGameWalkthroughCanvas) inGameWalkthroughCanvas.style.display = "block";
  if (inGameWalkthroughHint) inGameWalkthroughHint.style.display = "block";
  if (inGameWalkthroughStep) inGameWalkthroughStep.style.display = "block";
  if (inGameWalkthroughEvent) inGameWalkthroughEvent.style.display = "block";
  setReplayStepNavVisible(inGameReplayStepNav, true);
}

function openInGameWalkthroughModal() {
  if (!inGameWalkthroughModal) return;
  if (!fewestOtherMovesReplayPath || fewestOtherMovesReplayPath.length < 2) {
    updateStatus("Walkthrough path is not available yet for this level.");
    return;
  }
  levelCompleteReplayIndex = 0;
  updateInGameWalkthroughPanel();
  drawInGameWalkthroughSnapshot(0);
  inGameWalkthroughModal.classList.add("active");
  inGameWalkthroughModal.setAttribute("aria-hidden", "false");
}

function closeInGameWalkthroughModal() {
  if (!inGameWalkthroughModal) return;
  inGameWalkthroughModal.classList.remove("active");
  inGameWalkthroughModal.setAttribute("aria-hidden", "true");
}

function updateLevelCompleteReplayDisplay() {
  if (!levelCompleteReplayPanel) return;
  levelCompleteReplayPanel.style.display = "block";
  const hasReplay = !!(fewestOtherMovesReplayPath && fewestOtherMovesReplayPath.length >= 2);
  const hasName = !!(fewestOtherMovesUserName && String(fewestOtherMovesUserName).trim());
  const showLocked = Number.isFinite(fewestOtherMovesForLevel) && !replayUnlockedForLevel;

  if (levelCompleteReplayPanel) {
    levelCompleteReplayPanel.classList.toggle("locked", !!showLocked);
  }

  if (!Number.isFinite(fewestOtherMovesForLevel)) {
    if (levelCompleteReplayTitle) {
      levelCompleteReplayTitle.textContent = "Best Route by --";
    }
    if (levelCompleteReplaySubtitle) {
      levelCompleteReplaySubtitle.textContent = "No other player's best route yet. You set the current record.";
    }
    if (levelCompleteReplayCanvas) levelCompleteReplayCanvas.style.display = "none";
    if (levelCompleteReplayHint) levelCompleteReplayHint.style.display = "none";
    if (levelCompleteReplayStep) levelCompleteReplayStep.style.display = "none";
    setReplayStepNavVisible(levelCompleteReplayStepNav, false);
    if (levelCompleteReplayEvent) {
      levelCompleteReplayEvent.style.display = "none";
      levelCompleteReplayEvent.textContent = "";
    }
    if (levelCompleteReplayLock) levelCompleteReplayLock.style.display = "none";
    if (levelCompleteReplayPanel) levelCompleteReplayPanel.classList.remove("locked");
    return;
  }

  if (showLocked) {
    if (levelCompleteReplayTitle) {
      const shownName = hasName ? String(fewestOtherMovesUserName).trim() : "Unknown";
      levelCompleteReplayTitle.textContent = `Best Route by ${shownName}`;
    }
    if (levelCompleteReplaySubtitle) {
      levelCompleteReplaySubtitle.textContent = `Fewest moves: ${fewestOtherMovesForLevel}`;
    }
    if (levelCompleteReplayCanvas) levelCompleteReplayCanvas.style.display = "block";
    if (levelCompleteReplayHint) levelCompleteReplayHint.style.display = "block";
    if (levelCompleteReplayStep) levelCompleteReplayStep.style.display = "block";
    setReplayStepNavVisible(levelCompleteReplayStepNav, false);
    if (levelCompleteReplayEvent) levelCompleteReplayEvent.style.display = "block";
    if (levelCompleteReplayLock) levelCompleteReplayLock.style.display = "flex";
    refreshLevelCompleteReplayLockCostEl();
    if (hasReplay) {
      drawLevelCompleteReplaySnapshot(levelCompleteReplayIndex);
    }
    return;
  }

  if (!hasReplay) {
    if (levelCompleteReplayTitle) {
      const shownName = hasName ? String(fewestOtherMovesUserName).trim() : "Unknown";
      levelCompleteReplayTitle.textContent = `Best Route by ${shownName}`;
    }
    if (levelCompleteReplaySubtitle) {
      levelCompleteReplaySubtitle.textContent = `Fewest moves: ${fewestOtherMovesForLevel}`;
    }
    if (levelCompleteReplayCanvas) levelCompleteReplayCanvas.style.display = "none";
    if (levelCompleteReplayHint) levelCompleteReplayHint.style.display = "none";
    if (levelCompleteReplayStep) levelCompleteReplayStep.style.display = "none";
    setReplayStepNavVisible(levelCompleteReplayStepNav, false);
    if (levelCompleteReplayEvent) {
      levelCompleteReplayEvent.style.display = "none";
      levelCompleteReplayEvent.textContent = "";
    }
    if (levelCompleteReplayLock) levelCompleteReplayLock.style.display = "none";
    return;
  }

  if (levelCompleteReplayLock) levelCompleteReplayLock.style.display = "none";

  if (levelCompleteReplayTitle) {
    const shownName = hasName ? String(fewestOtherMovesUserName).trim() : "Unknown";
    levelCompleteReplayTitle.textContent = `Best Route by ${shownName}`;
  }
  if (levelCompleteReplaySubtitle) {
    levelCompleteReplaySubtitle.textContent = `Fewest moves: ${fewestOtherMovesForLevel}`;
  }
  if (levelCompleteReplayCanvas) levelCompleteReplayCanvas.style.display = "block";
  if (levelCompleteReplayHint) levelCompleteReplayHint.style.display = "block";
  if (levelCompleteReplayStep) levelCompleteReplayStep.style.display = "block";
  setReplayStepNavVisible(levelCompleteReplayStepNav, true);
  if (levelCompleteReplayEvent) levelCompleteReplayEvent.style.display = "block";
  drawLevelCompleteReplaySnapshot(levelCompleteReplayIndex);
}

function updateFewestOtherMovesDisplay(bestMoves, replayPath, userName, replayUnlocked) {
  fewestOtherMovesForLevel = Number.isFinite(bestMoves) ? bestMoves : null;
  fewestOtherMovesUserName = typeof userName === "string" ? userName.trim() : "";
  replayUnlockedForLevel = !!replayUnlocked;
  fewestOtherMovesReplayPath = sanitizeReplayPath(replayPath);
  fewestOtherMovesReplayStepNumbers = buildReplayStepNumbers(fewestOtherMovesReplayPath || []);
  if (fewestOtherMovesReplayPath) {
    levelCompleteReplayIndex = 0;
  }
  refreshFewestOtherMovesAffordance();
  updateLevelCompleteStatsDisplay();
  updateLevelCompleteReplayDisplay();
  if (typeof window.cmEmitGameUi === "function") {
    window.cmEmitGameUi({
      type: "fewestOtherMoves",
      bestMoves: fewestOtherMovesForLevel,
      userName: fewestOtherMovesUserName,
      replayUnlocked: replayUnlockedForLevel,
    });
  }
}

async function fetchFewestOtherMovesForCurrentLevel() {
  const levelNumber = currentLevelIndex + 1;
  if (!Number.isFinite(levelNumber) || levelNumber <= 0) {
    updateFewestOtherMovesDisplay(null, null, "", false);
    return;
  }

  const apiBaseUrl = window.API_BASE_URL || "https://chessmater-production.up.railway.app";
  const headers = {};
  if (window.cmToken) {
    headers.Authorization = `Bearer ${window.cmToken}`;
  }

  try {
    const res = await fetch(`${apiBaseUrl}/stats/fewest-other-moves?level=${encodeURIComponent(levelNumber)}`, {
      method: "GET",
      credentials: "include",
      headers
    });

    if (!res.ok) {
      updateFewestOtherMovesDisplay(null, null, "", false);
      return;
    }

    const data = await res.json();
    const bestMoves = Number.parseInt(data?.best_moves, 10);
    const bestName = typeof data?.username === "string" && data.username.trim()
      ? data.username
      : "";
    updateFewestOtherMovesDisplay(bestMoves, data?.best_path, bestName, !!data?.replay_unlocked);
  } catch (_) {
    updateFewestOtherMovesDisplay(null, null, "", false);
  }
}

// Update objective counter display
function updateObjectiveCount() {
  if (!objectiveCount) return;
  const completed = objectives.filter(obj => obj.completed).length;
  objectiveCount.textContent = `Objectives: ${completed}/${totalObjectives}`;
  if (typeof window.cmEmitGameUi === "function") {
    window.cmEmitGameUi({
      type: "objectiveCount",
      completed,
      totalObjectives,
    });
  }
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

// Deferred from former game.js ~1029-1038 (must run after openHintModal / setupReplayStepNav exist).
setupAntigravityExchangeModal();
setupReplayExchangeModal();
setupInGameWalkthrough();
setupReplayStepNav();
setupHintModal();
window.openAntigravityExchangeModal = openAntigravityExchangeModal;
window.openReplayExchangeModal = openReplayExchangeModal;
window.handleSolutionGuideAction = handleSolutionGuideAction;
window.openInGameWalkthroughModal = openInGameWalkthroughModal;
window.openHintModal = openHintModal;

// --- Load puzzle from JSON file ---
