/**
 * game/03-audio-canvas-hud-replay.js
 * Audio, HUD, replay, objectives, lasers/platforms helpers
 * Split from game.monolith.js lines 1138-2757.
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
  syncVisitedSquaresSize();
  
  // Resize canvas
  resizeCanvas();
  
  // Filter players and objectives that are still within bounds
  players = players.filter(player => 
    player.row < newRows && player.col < newCols
  );
  
  objectives = objectives.filter(obj => 
    obj.row < newRows && obj.col < newCols
  );

  targetPieces = targetPieces.filter(piece =>
    piece.row < newRows && piece.col < newCols
  );
  totalTargetPieces = targetPieces.length;
  targetPiecesCaptured = targetPieces.filter(piece => piece.captured).length;

  bombs = bombs.filter(bomb =>
    bomb.row < newRows && bomb.col < newCols
  );

  laserBlocks = laserBlocks.filter(laser =>
    laser.row < newRows && laser.col < newCols
  );

  ducks = ducks.filter(duck =>
    duck.row < newRows && duck.col < newCols
  );

  movingPlatforms = movingPlatforms
    .filter(platform => platform.row < newRows && platform.col < newCols)
    .map(normalizeMovingPlatformData);
  
  // Update goal if it's out of bounds
  if (goal && (goal.row >= newRows || goal.col >= newCols)) {
    goal = null;
  }
  
  // Update counts and redraw
  updatePlayerCount();
  updateObjectiveCount();
  updateTargetPieceCount();
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
    targetPieces: cloneGameData(targetPieces),
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

function drawInactivePhaseBlock(renderCtx, x, y, tile, inset = 3) {
  const innerSize = tile - inset * 2;
  const arrowY = y + tile * 0.48;
  const stemWidth = Math.max(2, tile * 0.06);
  const stemHeight = Math.max(6, tile * 0.18);
  const headWidth = Math.max(8, tile * 0.22);
  const headHeight = Math.max(6, tile * 0.16);
  const arrowGap = Math.max(1, (innerSize - headWidth * 3) / 4);
  const firstArrowCenterX = x + inset + arrowGap + headWidth / 2;

  renderCtx.save();
  renderCtx.fillStyle = "rgba(52, 152, 219, 0.3)";
  renderCtx.fillRect(x + inset, y + inset, innerSize, innerSize);

  renderCtx.fillStyle = "rgba(25, 118, 210, 0.65)";
  for (let i = 0; i < 3; i++) {
    const centerX = firstArrowCenterX + i * (headWidth + arrowGap);
    const stemTop = arrowY;
    renderCtx.fillRect(centerX - stemWidth / 2, stemTop, stemWidth, stemHeight);
    renderCtx.beginPath();
    renderCtx.moveTo(centerX, stemTop - headHeight);
    renderCtx.lineTo(centerX - headWidth / 2, stemTop);
    renderCtx.lineTo(centerX + headWidth / 2, stemTop);
    renderCtx.closePath();
    renderCtx.fill();
  }

  renderCtx.strokeStyle = "rgba(25, 118, 210, 0.8)";
  renderCtx.lineWidth = Math.max(2, tile * 0.04);
  renderCtx.setLineDash([Math.max(4, tile * 0.1), Math.max(3, tile * 0.07)]);
  renderCtx.beginPath();
  renderCtx.moveTo(x + inset, y + tile - inset);
  renderCtx.lineTo(x + tile - inset, y + tile - inset);
  renderCtx.stroke();
  renderCtx.restore();
}

function getMovingPlatformAt(row, col) {
  return movingPlatforms.find(platform => platform.row === row && platform.col === col) || null;
}

function getMovingPlatformAxisAt(row, col) {
  const platform = getMovingPlatformAt(row, col);
  return platform && platform.axis === "horizontal" ? "horizontal" : "vertical";
}

function drawSomersaultCloudPlatform(renderCtx, x, y, tile) {
  const centerX = x + tile / 2;
  const centerY = y + tile * 0.54;

  function drawCloudSpiral(cx, cy, radius, turns = 1.8) {
    renderCtx.beginPath();
    const steps = 44;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = t * turns * Math.PI * 2;
      const r = radius * (1 - t);
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;
      if (i === 0) {
        renderCtx.moveTo(px, py);
      } else {
        renderCtx.lineTo(px, py);
      }
    }
    renderCtx.stroke();
  }

  renderCtx.save();
  renderCtx.shadowColor = "rgba(250, 204, 21, 0.48)";
  renderCtx.shadowBlur = Math.max(5, tile * 0.14);
  renderCtx.fillStyle = "#f7d45a";
  renderCtx.strokeStyle = "#9f7a2d";
  renderCtx.lineWidth = Math.max(2, tile * 0.04);
  renderCtx.beginPath();
  renderCtx.moveTo(x + tile * 0.07, y + tile * 0.68);
  renderCtx.bezierCurveTo(x + tile * 0.22, y + tile * 0.82, x + tile * 0.42, y + tile * 0.72, x + tile * 0.34, y + tile * 0.57);
  renderCtx.bezierCurveTo(x + tile * 0.12, y + tile * 0.62, x + tile * 0.07, y + tile * 0.38, x + tile * 0.23, y + tile * 0.25);
  renderCtx.bezierCurveTo(x + tile * 0.25, y + tile * 0.05, x + tile * 0.5, y + tile * 0.03, x + tile * 0.56, y + tile * 0.2);
  renderCtx.bezierCurveTo(x + tile * 0.72, y + tile * 0.11, x + tile * 0.91, y + tile * 0.27, x + tile * 0.82, y + tile * 0.49);
  renderCtx.bezierCurveTo(x + tile * 0.96, y + tile * 0.57, x + tile * 0.88, y + tile * 0.82, x + tile * 0.67, y + tile * 0.78);
  renderCtx.bezierCurveTo(x + tile * 0.57, y + tile * 0.95, x + tile * 0.34, y + tile * 0.86, x + tile * 0.43, y + tile * 0.73);
  renderCtx.bezierCurveTo(x + tile * 0.3, y + tile * 0.81, x + tile * 0.15, y + tile * 0.79, x + tile * 0.02, y + tile * 0.68);
  renderCtx.bezierCurveTo(x - tile * 0.12, y + tile * 0.57, x + tile * 0.05, y + tile * 0.62, x + tile * 0.07, y + tile * 0.68);
  renderCtx.closePath();
  renderCtx.fill();
  renderCtx.shadowBlur = 0;
  renderCtx.stroke();

  renderCtx.strokeStyle = "rgba(159, 122, 45, 0.82)";
  renderCtx.lineWidth = Math.max(1.5, tile * 0.035);
  renderCtx.lineCap = "round";
  renderCtx.lineJoin = "round";
  drawCloudSpiral(centerX - tile * 0.19, centerY + tile * 0.06, tile * 0.13, 1.75);
  drawCloudSpiral(centerX + tile * 0.04, centerY - tile * 0.16, tile * 0.15, 1.7);
  drawCloudSpiral(centerX + tile * 0.23, centerY + tile * 0.1, tile * 0.16, 1.8);

  renderCtx.strokeStyle = "rgba(159, 122, 45, 0.42)";
  renderCtx.lineWidth = Math.max(1, tile * 0.025);
  renderCtx.beginPath();
  renderCtx.moveTo(x + tile * 0.18, y + tile * 0.72);
  renderCtx.bezierCurveTo(x + tile * 0.31, y + tile * 0.76, x + tile * 0.43, y + tile * 0.74, x + tile * 0.53, y + tile * 0.67);
  renderCtx.stroke();

  renderCtx.restore();
}

function drawMovingPlatform(renderCtx, x, y, tile, axis = "vertical") {
  if (axis === "horizontal") {
    drawSomersaultCloudPlatform(renderCtx, x, y, tile);
    return;
  }

  const inset = Math.max(2, tile * 0.08);
  const width = tile - inset * 2;
  const height = Math.max(8, tile * 0.28);
  const platformY = y + tile * 0.52;

  renderCtx.save();
  renderCtx.fillStyle = "rgba(20, 184, 166, 0.78)";
  renderCtx.fillRect(x + inset, platformY, width, height);
  renderCtx.strokeStyle = "rgba(15, 118, 110, 0.95)";
  renderCtx.lineWidth = Math.max(2, tile * 0.04);
  renderCtx.strokeRect(x + inset, platformY, width, height);

  renderCtx.fillStyle = "rgba(250, 204, 21, 0.9)";
  renderCtx.beginPath();
  renderCtx.moveTo(x + tile * 0.5, y + tile * 0.2);
  renderCtx.lineTo(x + tile * 0.35, y + tile * 0.38);
  renderCtx.lineTo(x + tile * 0.65, y + tile * 0.38);
  renderCtx.closePath();
  renderCtx.fill();

  renderCtx.restore();
}

function drawDuck(renderCtx, duck, tile = TILE_SIZE) {
  const x = duck.col * tile;
  const y = duck.row * tile;
  const direction = duck.direction === -1 ? -1 : 1;

  renderCtx.save();
  renderCtx.translate(x + tile / 2, y + tile / 2);
  renderCtx.scale(direction, 1);
  renderCtx.fillStyle = "#facc15";
  renderCtx.strokeStyle = "#a16207";
  renderCtx.lineWidth = Math.max(1.5, tile * 0.035);

  renderCtx.beginPath();
  renderCtx.ellipse(-tile * 0.05, tile * 0.12, tile * 0.3, tile * 0.22, 0, 0, Math.PI * 2);
  renderCtx.fill();
  renderCtx.stroke();

  renderCtx.beginPath();
  renderCtx.arc(tile * 0.18, -tile * 0.1, tile * 0.17, 0, Math.PI * 2);
  renderCtx.fill();
  renderCtx.stroke();

  renderCtx.fillStyle = "#f97316";
  renderCtx.beginPath();
  renderCtx.moveTo(tile * 0.32, -tile * 0.1);
  renderCtx.lineTo(tile * 0.48, -tile * 0.02);
  renderCtx.lineTo(tile * 0.32, tile * 0.03);
  renderCtx.closePath();
  renderCtx.fill();

  renderCtx.fillStyle = "#111827";
  renderCtx.beginPath();
  renderCtx.arc(tile * 0.22, -tile * 0.14, Math.max(1.5, tile * 0.025), 0, Math.PI * 2);
  renderCtx.fill();

  renderCtx.fillStyle = "rgba(234, 179, 8, 0.9)";
  renderCtx.beginPath();
  renderCtx.ellipse(-tile * 0.12, tile * 0.09, tile * 0.14, tile * 0.09, -0.35, 0, Math.PI * 2);
  renderCtx.fill();
  renderCtx.restore();
}

function getTeleporterDoorRole(row, col, teleportType) {
  const sameColorTeleports = teleportBlocks
    .filter(tp => tp.type === teleportType)
    .slice()
    .sort((a, b) => (a.row - b.row) || (a.col - b.col));

  if (sameColorTeleports.length !== 2) return "in";
  const isFirst =
    sameColorTeleports[0].row === row &&
    sameColorTeleports[0].col === col;
  return isFirst ? "in" : "out";
}

function drawTeleporterDoor(renderCtx, x, y, tile, teleportType, role = "in") {
  const color = TELEPORT_COLORS[teleportType];
  const doorColor = TELEPORT_DOOR_COLORS[teleportType];
  if (!color || !doorColor) return;

  const frameX = x + tile * 0.22;
  const frameY = y + tile * 0.1;
  const frameW = tile * 0.56;
  const frameH = tile * 0.8;
  const gapLeft = frameX + frameW * 0.08;
  const gapRight = frameX + frameW * 0.42;
  const slabLeft = frameX + frameW * 0.5;
  const slabTop = frameY + frameH * 0.04;
  const slabBottom = frameY + frameH * 0.96;
  const slabRightTop = frameX + frameW * 1.02;
  const slabRightBottom = frameX + frameW * 0.82;

  renderCtx.save();

  renderCtx.fillStyle = "rgba(15, 23, 42, 0.35)";
  renderCtx.beginPath();
  renderCtx.ellipse(x + tile / 2, y + tile * 0.9, tile * 0.31, tile * 0.06, 0, 0, Math.PI * 2);
  renderCtx.fill();

  // Teleporter color stays as light leaking from the opening, so the
  // object can look like a real wooden door while still showing its pair.
  renderCtx.fillStyle = doorColor.glow;
  renderCtx.globalAlpha = 1;
  renderCtx.fillRect(gapLeft, frameY + frameH * 0.08, gapRight - gapLeft, frameH * 0.82);

  // Doorway darkness visible through the half-open gap.
  renderCtx.fillStyle = "rgba(12, 8, 7, 0.86)";
  renderCtx.fillRect(gapLeft, frameY + frameH * 0.06, gapRight - gapLeft, frameH * 0.88);

  // Colored wooden frame matching the teleporter type.
  renderCtx.strokeStyle = doorColor.dark;
  renderCtx.lineWidth = Math.max(3, tile * 0.07);
  renderCtx.strokeRect(frameX, frameY, frameW, frameH);
  renderCtx.strokeStyle = doorColor.edge;
  renderCtx.lineWidth = Math.max(1, tile * 0.02);
  renderCtx.strokeRect(frameX + tile * 0.02, frameY + tile * 0.02, frameW - tile * 0.04, frameH - tile * 0.04);

  // Half-open colored wood slab, perspective skewed like the reference photo.
  renderCtx.fillStyle = doorColor.door;
  renderCtx.beginPath();
  renderCtx.moveTo(slabLeft, slabTop);
  renderCtx.lineTo(slabRightTop, frameY + frameH * 0.12);
  renderCtx.lineTo(slabRightBottom, slabBottom);
  renderCtx.lineTo(slabLeft, frameY + frameH * 0.9);
  renderCtx.closePath();
  renderCtx.fill();
  renderCtx.strokeStyle = doorColor.dark;
  renderCtx.lineWidth = Math.max(1.5, tile * 0.035);
  renderCtx.stroke();

  // Wood panels.
  renderCtx.strokeStyle = "rgba(255, 255, 255, 0.28)";
  renderCtx.lineWidth = Math.max(1, tile * 0.018);
  const panelLeft = slabLeft + frameW * 0.08;
  const panelRightTop = slabRightTop - frameW * 0.1;
  const panelRightBottom = slabRightBottom - frameW * 0.1;
  renderCtx.beginPath();
  renderCtx.moveTo(panelLeft, frameY + frameH * 0.2);
  renderCtx.lineTo(panelRightTop, frameY + frameH * 0.25);
  renderCtx.moveTo(panelLeft, frameY + frameH * 0.45);
  renderCtx.lineTo(panelRightTop - frameW * 0.03, frameY + frameH * 0.48);
  renderCtx.moveTo(panelLeft, frameY + frameH * 0.7);
  renderCtx.lineTo(panelRightBottom, frameY + frameH * 0.7);
  renderCtx.stroke();

  // Teleporter-colored rim light along the opening.
  renderCtx.strokeStyle = doorColor.edge;
  renderCtx.lineWidth = Math.max(1.5, tile * 0.035);
  renderCtx.beginPath();
  renderCtx.moveTo(gapRight, frameY + frameH * 0.1);
  renderCtx.lineTo(gapRight, frameY + frameH * 0.88);
  renderCtx.stroke();

  // Handle and lock plate.
  renderCtx.fillStyle = "#1f2937";
  renderCtx.fillRect(slabLeft + frameW * 0.12, frameY + frameH * 0.48, frameW * 0.08, frameH * 0.18);
  renderCtx.fillStyle = "#d1d5db";
  renderCtx.beginPath();
  renderCtx.arc(slabLeft + frameW * 0.2, frameY + frameH * 0.57, Math.max(1.5, tile * 0.028), 0, Math.PI * 2);
  renderCtx.fill();

  // White arrow inside the door gap:
  // "in" points into the doorway; "out" points out of the doorway.
  const arrowY = frameY + frameH * 0.58;
  const arrowStartX = role === "out" ? gapRight - frameW * 0.01 : gapLeft + frameW * 0.01;
  const arrowEndX = role === "out" ? gapLeft + frameW * 0.01 : gapRight - frameW * 0.01;
  const arrowDir = arrowEndX > arrowStartX ? 1 : -1;
  const headSize = Math.max(5, tile * 0.12);

  renderCtx.strokeStyle = "rgba(0, 0, 0, 0.55)";
  renderCtx.fillStyle = "rgba(0, 0, 0, 0.55)";
  renderCtx.lineWidth = Math.max(4, tile * 0.08);
  renderCtx.lineCap = "round";
  renderCtx.beginPath();
  renderCtx.moveTo(arrowStartX, arrowY);
  renderCtx.lineTo(arrowEndX - arrowDir * headSize * 0.55, arrowY);
  renderCtx.stroke();
  renderCtx.beginPath();
  renderCtx.moveTo(arrowEndX, arrowY);
  renderCtx.lineTo(arrowEndX - arrowDir * headSize, arrowY - headSize * 0.6);
  renderCtx.lineTo(arrowEndX - arrowDir * headSize, arrowY + headSize * 0.6);
  renderCtx.closePath();
  renderCtx.fill();

  renderCtx.strokeStyle = "#ffffff";
  renderCtx.fillStyle = "#ffffff";
  renderCtx.lineWidth = Math.max(2.5, tile * 0.055);
  renderCtx.lineCap = "round";
  renderCtx.beginPath();
  renderCtx.moveTo(arrowStartX, arrowY);
  renderCtx.lineTo(arrowEndX - arrowDir * headSize * 0.55, arrowY);
  renderCtx.stroke();
  renderCtx.beginPath();
  renderCtx.moveTo(arrowEndX, arrowY);
  renderCtx.lineTo(arrowEndX - arrowDir * headSize, arrowY - headSize * 0.6);
  renderCtx.lineTo(arrowEndX - arrowDir * headSize, arrowY + headSize * 0.6);
  renderCtx.closePath();
  renderCtx.fill();

  renderCtx.restore();
}

function drawPlatformLevelGuide() {
  if (!CM_EDITOR_PAGE || mode !== "edit") return;

  ctx.save();
  ctx.fillStyle = "rgba(15, 23, 42, 0.72)";
  ctx.font = "bold 18px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let r = 0; r < ROWS; r++) {
    const level = rowToPlatformLevel(r);
    const y = r * TILE_SIZE + TILE_SIZE / 2;
    ctx.fillText(String(level), TILE_SIZE * 0.24, y);
  }

  ctx.font = "bold 14px Arial";
  for (let c = 0; c < COLS; c++) {
    const x = c * TILE_SIZE + TILE_SIZE / 2;
    ctx.fillText(String(c), x, TILE_SIZE * 0.22);
  }

  ctx.restore();
}

function drawReplayCellDecoration(replayCtx, cellType, x, y, tile, row = null, col = null, targetPiecesData = []) {
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
    drawInactivePhaseBlock(replayCtx, x, y, tile, inset);
    return;
  }

  if (cellType === CELL_TYPES.PHASE_BLOCK_ACTIVE) {
    replayCtx.fillStyle = "rgba(41, 128, 185, 0.8)";
    replayCtx.fillRect(x + inset, y + inset, innerSize, innerSize);
    return;
  }

  if (cellType === CELL_TYPES.MOVING_PLATFORM) {
    drawMovingPlatform(replayCtx, x, y, tile);
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
    drawTeleporterDoor(replayCtx, x, y, tile, cellType, "in");
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
    if (pieceType === "castle_rook") {
      drawCastleRookMarker(replayCtx, x, y, tile);
    }
    return;
  }

  if (cellType === CELL_TYPES.BLACK_TARGET_PIECE) {
    const targetPiece = Array.isArray(targetPiecesData)
      ? targetPiecesData.find(piece => !piece.captured && piece.row === row && piece.col === col)
      : null;
    drawBlackTargetPiece(replayCtx, x, y, tile, targetPiece ? targetPiece.pieceType : "pawn");
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
  if (pieceType === "castle_rook") {
    drawCastleRookMarker(replayCtx, x, y, tile);
  }
}

function drawBlackTargetPiece(renderCtx, x, y, tile, pieceType) {
  const pad = Math.max(1, Math.floor(tile * 0.13));
  const img = targetPieceImages[pieceType] || targetPieceImages.pawn;

  renderCtx.save();
  renderCtx.fillStyle = "rgba(17, 24, 39, 0.18)";
  renderCtx.beginPath();
  renderCtx.arc(x + tile / 2, y + tile / 2, tile * 0.42, 0, Math.PI * 2);
  renderCtx.fill();

  if (img && img.complete) {
    renderCtx.drawImage(img, x + pad, y + pad, tile - pad * 2, tile - pad * 2);
  } else {
    renderCtx.fillStyle = "#111827";
    renderCtx.textAlign = "center";
    renderCtx.textBaseline = "middle";
    renderCtx.font = `700 ${Math.max(10, Math.floor(tile * 0.44))}px Arial`;
    renderCtx.fillText(String(pieceType || "P").charAt(0).toUpperCase(), x + tile / 2, y + tile / 2);
  }

  renderCtx.strokeStyle = "rgba(255, 255, 255, 0.75)";
  renderCtx.lineWidth = Math.max(1, tile * 0.035);
  renderCtx.beginPath();
  renderCtx.arc(x + tile / 2, y + tile / 2, tile * 0.42, 0, Math.PI * 2);
  renderCtx.stroke();
  renderCtx.restore();
}

function drawCastleRookMarker(renderCtx, x, y, size) {
  const radius = Math.max(4, size * 0.14);
  const centerX = x + size * 0.76;
  const centerY = y + size * 0.24;

  renderCtx.save();
  renderCtx.fillStyle = "rgba(245, 158, 11, 0.95)";
  renderCtx.beginPath();
  renderCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  renderCtx.fill();
  renderCtx.strokeStyle = "rgba(255, 255, 255, 0.95)";
  renderCtx.lineWidth = Math.max(1, size * 0.035);
  renderCtx.beginPath();
  renderCtx.moveTo(centerX - radius * 0.45, centerY);
  renderCtx.lineTo(centerX - radius * 0.08, centerY + radius * 0.38);
  renderCtx.lineTo(centerX + radius * 0.55, centerY - radius * 0.45);
  renderCtx.stroke();
  renderCtx.restore();
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
  const targetPiecesData = Array.isArray(snapshot.targetPieces) ? snapshot.targetPieces : [];

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
      drawReplayCellDecoration(replayCtx, cellType, x, y, tile, r, c, targetPiecesData);
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

function updateTargetPieceCount() {
  if (!targetPieceCount) return;
  const captured = targetPieces.filter(piece => piece.captured).length;
  targetPieceCount.textContent = `Target Pieces: ${captured}/${totalTargetPieces}`;
  if (typeof window.cmEmitGameUi === "function") {
    window.cmEmitGameUi({
      type: "targetPieceCount",
      captured,
      totalTargetPieces,
    });
  }
}

function getUnlockProgressText() {
  return `Objectives ${objectivesCompleted}/${totalObjectives}, Target Pieces ${targetPiecesCaptured}/${totalTargetPieces}`;
}

// Check if all objectives are completed
function areAllObjectivesCompleted() {
  return objectivesCompleted >= totalObjectives && targetPiecesCaptured >= totalTargetPieces;
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

function getObjectiveCellTypeAt(row, col) {
  const objective = objectives.find(obj => obj.row === row && obj.col === col);
  if (!objective) return CELL_TYPES.EMPTY;
  return objective.completed ? CELL_TYPES.OBJECTIVE_COMPLETED : CELL_TYPES.OBJECTIVE;
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

function getTargetPieceAt(row, col) {
  return targetPieces.findIndex(piece =>
    !piece.captured &&
    piece.row === row &&
    piece.col === col
  );
}

function removeTargetPieceAt(row, col) {
  const index = targetPieces.findIndex(piece => piece.row === row && piece.col === col);
  if (index !== -1) {
    targetPieces.splice(index, 1);
    totalTargetPieces = targetPieces.length;
    targetPiecesCaptured = targetPieces.filter(piece => piece.captured).length;
    updateTargetPieceCount();
  }
}

function completeTargetPiece(row, col) {
  const targetIndex = getTargetPieceAt(row, col);
  if (targetIndex === -1) return false;

  targetPieces[targetIndex].captured = true;
  targetPiecesCaptured++;
  board[row][col] = CELL_TYPES.EMPTY;
  updateTargetPieceCount();
  updateStatus(`Target piece captured! ${targetPiecesCaptured}/${totalTargetPieces}`);
  return true;
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

function createBoomBomb(row, col, type) {
  const isLeftDiagonal = type === "boom_left";
  return {
    row,
    col,
    type,
    rowDirection: 1,
    colDirection: isLeftDiagonal ? -1 : 1
  };
}

function normalizeBombData(bomb) {
  if (bomb.type === "boom_right" || bomb.type === "boom_left") {
    const defaultBoom = createBoomBomb(bomb.row, bomb.col, bomb.type);
    return {
      row: bomb.row,
      col: bomb.col,
      type: bomb.type,
      rowDirection: bomb.rowDirection || defaultBoom.rowDirection,
      colDirection: bomb.colDirection || defaultBoom.colDirection
    };
  }

  return {
    row: bomb.row,
    col: bomb.col,
    direction: bomb.direction || 1
  };
}

function normalizeDuckData(duck) {
  return {
    row: Number.parseInt(duck.row, 10),
    col: Number.parseInt(duck.col, 10),
    direction: duck.direction === -1 ? -1 : 1
  };
}

function normalizeTargetPieceData(piece) {
  const allowedTypes = ["rook", "bishop", "queen", "knight", "king", "pawn"];
  const pieceType = allowedTypes.includes(piece.pieceType) ? piece.pieceType : "pawn";
  return {
    row: Number.parseInt(piece.row, 10),
    col: Number.parseInt(piece.col, 10),
    pieceType,
    captured: !!piece.captured
  };
}

function normalizeLaserDirections(directions) {
  if (!Array.isArray(directions)) return DEFAULT_LASER_DIRECTIONS.slice();
  const validDirections = directions.filter(direction => DEFAULT_LASER_DIRECTIONS.includes(direction));
  return [...new Set(validDirections)];
}

function normalizeLaserFireEverySteps(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_LASER_FIRE_EVERY_STEPS;
  return Math.max(2, Math.min(99, parsed));
}

function getLaserFireEverySteps(laser) {
  return normalizeLaserFireEverySteps(laser && laser.fireEverySteps);
}

function normalizeLaserBlockData(laser) {
  return {
    row: Number.parseInt(laser.row, 10),
    col: Number.parseInt(laser.col, 10),
    directions: normalizeLaserDirections(laser.directions),
    fireEverySteps: normalizeLaserFireEverySteps(laser.fireEverySteps)
  };
}

function getDuckAt(row, col) {
  return ducks.findIndex(duck => duck.row === row && duck.col === col);
}

function isBoomPieceType(pieceType) {
  return pieceType === "boom_right" || pieceType === "boom_left";
}

function isBoomBomb(bomb) {
  return isBoomPieceType(bomb.type);
}

function isLaserBlockAt(row, col) {
  return laserBlocks.some(laser => laser.row === row && laser.col === col);
}

function removeLaserBlockAt(row, col) {
  const index = laserBlocks.findIndex(laser => laser.row === row && laser.col === col);
  if (index !== -1) {
    laserBlocks.splice(index, 1);
  }
}

function addLaserBlock(row, col, directions = DEFAULT_LASER_DIRECTIONS, fireEverySteps = DEFAULT_LASER_FIRE_EVERY_STEPS) {
  const normalizedDirections = normalizeLaserDirections(directions);
  const normalizedFireEverySteps = normalizeLaserFireEverySteps(fireEverySteps);
  const existing = laserBlocks.find(laser => laser.row === row && laser.col === col);
  if (existing) {
    existing.directions = normalizedDirections;
    existing.fireEverySteps = normalizedFireEverySteps;
    return;
  }

  if (!isLaserBlockAt(row, col)) {
    laserBlocks.push({ row, col, directions: normalizedDirections, fireEverySteps: normalizedFireEverySteps });
  }
}

function isLaserBlockingCell(row, col) {
  return board[row][col] === CELL_TYPES.SOLID_BLOCK ||
    board[row][col] === CELL_TYPES.PHASE_BLOCK_ACTIVE ||
    board[row][col] === CELL_TYPES.MOVING_PLATFORM;
}

function isLaserActive(laser, moveNumber = levelMoveCount) {
  const fireEverySteps = getLaserFireEverySteps(laser);
  return moveNumber > 0 && moveNumber % fireEverySteps === 0;
}

function getLaserCountdown(laser, moveNumber = levelMoveCount) {
  const fireEverySteps = getLaserFireEverySteps(laser);
  if (moveNumber > 0 && moveNumber % fireEverySteps === 0) {
    return 0;
  }
  return fireEverySteps - (moveNumber % fireEverySteps);
}

function getLaserDirections(laser) {
  const enabledDirections = normalizeLaserDirections(laser.directions);
  return LASER_DIRECTIONS.filter(direction => enabledDirections.includes(direction.name));
}

function getLaserCellsFromBlock(laser) {
  const cells = [];
  for (const direction of getLaserDirections(laser)) {
    let row = laser.row + direction.dr;
    let col = laser.col + direction.dc;
    while (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
      if (isLaserBlockingCell(row, col)) break;
      cells.push({ row, col, direction: direction.name });
      row += direction.dr;
      col += direction.dc;
    }
  }
  return cells;
}

function isCellInActiveLaser(row, col) {
  return laserBlocks.some(laser =>
    isLaserActive(laser) &&
    getLaserCellsFromBlock(laser).some(cell => cell.row === row && cell.col === col)
  );
}

function getMoveTraversalCells(fromRow, fromCol, toRow, toCol) {
  const rowDelta = toRow - fromRow;
  const colDelta = toCol - fromCol;
  const rowStep = Math.sign(rowDelta);
  const colStep = Math.sign(colDelta);
  const straightOrDiagonal =
    fromRow === toRow ||
    fromCol === toCol ||
    Math.abs(rowDelta) === Math.abs(colDelta);

  if (!straightOrDiagonal) {
    return [{ row: toRow, col: toCol }];
  }

  const steps = Math.max(Math.abs(rowDelta), Math.abs(colDelta));
  const cells = [];
  for (let i = 1; i <= steps; i++) {
    cells.push({
      row: fromRow + rowStep * i,
      col: fromCol + colStep * i
    });
  }
  return cells;
}

function getActiveLaserHitOnMove(player, toRow, toCol) {
  return getMoveTraversalCells(player.row, player.col, toRow, toCol)
    .find(cell => isCellInActiveLaser(cell.row, cell.col)) || null;
}

function clampPlatformLevel(level) {
  const parsed = Number.parseInt(level, 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(ROWS - 1, parsed));
}

function rowToPlatformLevel(row) {
  return clampPlatformLevel(ROWS - 1 - row);
}

function platformLevelToRow(level) {
  return ROWS - 1 - clampPlatformLevel(level);
}

function clampPlatformCol(col) {
  const parsed = Number.parseInt(col, 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(COLS - 1, parsed));
}

function normalizeMovingPlatformData(platform) {
  const axis = platform.axis === "horizontal" ? "horizontal" : "vertical";
  if (axis === "horizontal") {
    const currentCol = platform.currentCol !== undefined
      ? clampPlatformCol(platform.currentCol)
      : clampPlatformCol(platform.col);
    const minCol = clampPlatformCol(platform.minCol !== undefined ? platform.minCol : 0);
    const maxCol = clampPlatformCol(platform.maxCol !== undefined ? platform.maxCol : COLS - 1);
    const low = Math.min(minCol, maxCol);
    const high = Math.max(minCol, maxCol);

    return {
      axis: "horizontal",
      row: platform.row,
      col: platform.col !== undefined ? platform.col : currentCol,
      minCol: low,
      maxCol: high,
      currentCol: Math.max(low, Math.min(high, currentCol)),
      direction: platform.direction === -1 ? -1 : 1
    };
  }

  const currentLevel = platform.currentLevel !== undefined
    ? clampPlatformLevel(platform.currentLevel)
    : rowToPlatformLevel(platform.row);
  const minLevel = clampPlatformLevel(platform.minLevel !== undefined ? platform.minLevel : 0);
  const maxLevel = clampPlatformLevel(platform.maxLevel !== undefined ? platform.maxLevel : ROWS - 1);
  const low = Math.min(minLevel, maxLevel);
  const high = Math.max(minLevel, maxLevel);

  return {
    row: platform.row !== undefined ? platform.row : platformLevelToRow(currentLevel),
    col: platform.col,
    minLevel: low,
    maxLevel: high,
    currentLevel: Math.max(low, Math.min(high, currentLevel)),
    direction: platform.direction === -1 ? -1 : 1
  };
}

// Deferred from monolith ~1127-1135 (must run after openHintModal / setupReplayStepNav exist).
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

