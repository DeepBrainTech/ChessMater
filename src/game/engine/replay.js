export function register(game) {
  game.buildCurrentReplaySnapshot = function (moveMeta = null) {
    return {
      rows: game.ROWS,
      cols: game.COLS,
      board: game.cloneGameData(game.board),
      players: game.cloneGameData(game.players),
      goal: game.cloneGameData(game.goal),
      objectives: game.cloneGameData(game.objectives),
      targetPieces: game.cloneGameData(game.targetPieces),
      move: moveMeta ? game.cloneGameData(moveMeta) : null
    };
  };
  game.resetCurrentLevelMoveTrace = function () {
    game.pendingMoveTraceEntry = null;
    game.currentLevelMoveTrace = [game.buildCurrentReplaySnapshot(null)];
  };
  game.queueMoveTraceCapture = function (moveMeta) {
    game.pendingMoveTraceEntry = moveMeta || {};
  };
  game.markPendingMoveTraceAntigravity = function (flag = true) {
    if (!game.pendingMoveTraceEntry) return;
    game.pendingMoveTraceEntry.antigravityApplied = !!flag;
  };
  game.queueSystemTraceCapture = function (meta) {
    if (game.pendingMoveTraceEntry) return;
    game.pendingMoveTraceEntry = meta || {};
  };
  game.tryCapturePendingMoveTrace = function (force) {
    if (!game.pendingMoveTraceEntry) return;
    const settled = force || game.fallingPieces.length === 0 && game.risingPieces.length === 0 && !game.pendingMoveCounter;
    if (!settled) return;
    const snapshot = game.buildCurrentReplaySnapshot(game.pendingMoveTraceEntry);
    game.currentLevelMoveTrace.push(snapshot);
    if (game.currentLevelMoveTrace.length > 500) {
      game.currentLevelMoveTrace.splice(1, game.currentLevelMoveTrace.length - 500);
    }
    game.pendingMoveTraceEntry = null;
  };
  game.sanitizeReplayPath = function (rawPath) {
    if (!Array.isArray(rawPath) || rawPath.length === 0) return null;
    const cleaned = rawPath.filter(step => step && Number.isFinite(Number(step.rows)) && Number.isFinite(Number(step.cols)) && Array.isArray(step.board) && Array.isArray(step.players));
    return cleaned.length ? cleaned : null;
  };
  game.hasReplayPlayerMove = function (step) {
    const moveMeta = step && step.move ? step.move : null;
    return !!(moveMeta && moveMeta.from && Number.isFinite(Number(moveMeta.from.row)) && Number.isFinite(Number(moveMeta.from.col)) && moveMeta.to && Number.isFinite(Number(moveMeta.to.row)) && Number.isFinite(Number(moveMeta.to.col)));
  };
  game.buildReplayStepNumbers = function (path) {
    if (!Array.isArray(path) || !path.length) return [];
    const numbers = Array(path.length).fill(0);
    const moveOrdinals = Array(path.length).fill(0);
    let moveCounter = 0;
    for (let i = 0; i < path.length; i++) {
      if (game.hasReplayPlayerMove(path[i])) {
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
  };
  game.drawReplayCellDecoration = function (replayCtx, cellType, x, y, tile, row = null, col = null, targetPiecesData = []) {
    const inset = Math.max(1, Math.floor(tile * 0.08));
    const innerSize = Math.max(1, tile - inset * 2);
    const centerX = x + tile / 2;
    const centerY = y + tile / 2;
    if (cellType === game.CELL_TYPES.SOLID_BLOCK) {
      replayCtx.fillStyle = "rgba(46, 204, 113, 0.7)";
      replayCtx.fillRect(x + inset, y + inset, innerSize, innerSize);
      return;
    }
    if (cellType === game.CELL_TYPES.PHASE_BLOCK) {
      game.drawInactivePhaseBlock(replayCtx, x, y, tile, inset);
      return;
    }
    if (cellType === game.CELL_TYPES.PHASE_BLOCK_ACTIVE) {
      replayCtx.fillStyle = "rgba(41, 128, 185, 0.8)";
      replayCtx.fillRect(x + inset, y + inset, innerSize, innerSize);
      return;
    }
    if (cellType === game.CELL_TYPES.MOVING_PLATFORM) {
      game.drawMovingPlatform(replayCtx, x, y, tile);
      return;
    }
    if (cellType === game.CELL_TYPES.TRANSFORMER) {
      replayCtx.fillStyle = "rgba(155, 89, 182, 0.7)";
      replayCtx.fillRect(x + inset, y + inset, innerSize, innerSize);
      replayCtx.fillStyle = "#ffffff";
      replayCtx.textAlign = "center";
      replayCtx.textBaseline = "middle";
      replayCtx.font = `bold ${Math.max(8, Math.floor(tile * 0.5))}px Arial`;
      replayCtx.fillText("?", centerX, centerY + 0.5);
      return;
    }
    if (cellType === game.CELL_TYPES.OBJECTIVE || cellType === game.CELL_TYPES.OBJECTIVE_COMPLETED) {
      replayCtx.fillStyle = cellType === game.CELL_TYPES.OBJECTIVE ? "rgba(243, 156, 18, 0.7)" : "rgba(46, 204, 113, 0.7)";
      replayCtx.beginPath();
      replayCtx.moveTo(centerX, y + inset);
      replayCtx.lineTo(x + tile - inset, centerY);
      replayCtx.lineTo(centerX, y + tile - inset);
      replayCtx.lineTo(x + inset, centerY);
      replayCtx.closePath();
      replayCtx.fill();
      if (cellType === game.CELL_TYPES.OBJECTIVE_COMPLETED) {
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
    if ([game.CELL_TYPES.TELEPORT_PURPLE, game.CELL_TYPES.TELEPORT_GREEN, game.CELL_TYPES.TELEPORT_BLUE, game.CELL_TYPES.TELEPORT_ORANGE].includes(cellType)) {
      game.drawTeleporterDoor(replayCtx, x, y, tile, cellType, "in");
      return;
    }
    if (cellType === game.CELL_TYPES.BOMB) {
      const img = game.pieceImages.bomb;
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
    if (cellType === game.CELL_TYPES.BLACK_TARGET_PIECE) {
      const targetPiece = Array.isArray(targetPiecesData) ? targetPiecesData.find(piece => !piece.captured && piece.row === row && piece.col === col) : null;
      game.drawBlackTargetPiece(replayCtx, x, y, tile, targetPiece ? targetPiece.pieceType : "pawn");
      return;
    }
    if (cellType === game.CELL_TYPES.GOAL || cellType === game.CELL_TYPES.COUNTER_GOAL) {
      const img = game.pieceImages.target;
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
  };
  game.drawReplayPlayerPiece = function (replayCtx, pieceType, row, col, ox, oy, tile) {
    const x = ox + col * tile;
    const y = oy + row * tile;
    const pad = Math.max(1, Math.floor(tile * 0.13));
    const img = game.pieceImages[pieceType];
    if (img && img.complete) {
      replayCtx.drawImage(img, x + pad, y + pad, tile - pad * 2, tile - pad * 2);
      if (pieceType === "castle_rook") {
        game.drawCastleRookMarker(replayCtx, x, y, tile);
      }
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
      game.drawCastleRookMarker(replayCtx, x, y, tile);
    }
  };
  game.drawReplaySnapshotOnCanvas = function (index, canvasEl, stepEl, eventEl) {
    if (!canvasEl || !game.fewestOtherMovesReplayPath || !game.fewestOtherMovesReplayPath.length) return;
    const replayCtx = canvasEl.getContext("2d");
    if (!replayCtx) return;
    const safeIndex = Math.max(0, Math.min(index, game.fewestOtherMovesReplayPath.length - 1));
    game.levelCompleteReplayIndex = safeIndex;
    const snapshot = game.fewestOtherMovesReplayPath[safeIndex];
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
        game.drawReplayCellDecoration(replayCtx, cellType, x, y, tile, r, c, targetPiecesData);
      }
    }
    for (const p of playersData) {
      if (!p || !Number.isFinite(p.row) || !Number.isFinite(p.col)) continue;
      game.drawReplayPlayerPiece(replayCtx, p.pieceType, p.row, p.col, ox, oy, tile);
    }
    if (stepEl) {
      const logicalStep = game.fewestOtherMovesReplayStepNumbers[safeIndex] || 0;
      const totalLogicalSteps = Number.isFinite(game.fewestOtherMovesForLevel) ? game.fewestOtherMovesForLevel : game.fewestOtherMovesReplayStepNumbers.length ? Math.max(...game.fewestOtherMovesReplayStepNumbers) : 0;
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
  };
  game.drawLevelCompleteReplaySnapshot = function (index) {
    game.drawReplaySnapshotOnCanvas(index, game.levelCompleteReplayCanvas, game.levelCompleteReplayStep, game.levelCompleteReplayEvent);
  };
  game.drawInGameWalkthroughSnapshot = function (index) {
    game.drawReplaySnapshotOnCanvas(index, game.inGameWalkthroughCanvas, game.inGameWalkthroughStep, game.inGameWalkthroughEvent);
  };
  game.stepReplayNavigation = function (action) {
    const walkthroughModalActive = game.inGameWalkthroughModal && game.inGameWalkthroughModal.classList.contains("active");
    const levelCompleteModalActive = game.levelCompleteModal && game.levelCompleteModal.classList.contains("active");
    if (!game.fewestOtherMovesReplayPath || !game.fewestOtherMovesReplayPath.length) return;
    if (levelCompleteModalActive && !game.replayUnlockedForLevel) return;
    const maxIndex = game.fewestOtherMovesReplayPath.length - 1;
    let nextIndex = game.levelCompleteReplayIndex;
    if (action === "prev") nextIndex = game.levelCompleteReplayIndex - 1;else if (action === "next") nextIndex = game.levelCompleteReplayIndex + 1;else if (action === "first") nextIndex = 0;else if (action === "last") nextIndex = maxIndex;else return;
    if (walkthroughModalActive) {
      game.drawInGameWalkthroughSnapshot(nextIndex);
    } else if (levelCompleteModalActive) {
      game.drawLevelCompleteReplaySnapshot(nextIndex);
    }
  };
  game.setReplayStepNavVisible = function (navEl, visible) {
    if (!navEl) return;
    navEl.style.display = visible ? "grid" : "none";
  };
  game.setupReplayStepNav = function () {
    document.querySelectorAll("[data-replay-step]").forEach(btn => {
      game.lifecycle.listen(btn, "click", e => {
        e.preventDefault();
        game.stepReplayNavigation(btn.getAttribute("data-replay-step"));
      });
    });
  };
}
