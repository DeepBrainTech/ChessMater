export function register(game) {
  game.drawInactivePhaseBlock = function (renderCtx, x, y, tile, inset = 3) {
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
  };
  game.drawSomersaultCloudPlatform = function (renderCtx, x, y, tile) {
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
  };
  game.drawMovingPlatform = function (renderCtx, x, y, tile, axis = "vertical") {
    if (axis === "horizontal") {
      game.drawSomersaultCloudPlatform(renderCtx, x, y, tile);
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
  };
  game.drawDuck = function (renderCtx, duck, tile = game.TILE_SIZE) {
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
  };
  game.getTeleporterDoorRole = function (row, col, teleportType) {
    const sameColorTeleports = game.teleportBlocks.filter(tp => tp.type === teleportType).slice().sort((a, b) => a.row - b.row || a.col - b.col);
    if (sameColorTeleports.length !== 2) return "in";
    const isFirst = sameColorTeleports[0].row === row && sameColorTeleports[0].col === col;
    return isFirst ? "in" : "out";
  };
  game.drawTeleporterDoor = function (renderCtx, x, y, tile, teleportType, role = "in") {
    const color = game.TELEPORT_COLORS[teleportType];
    const doorColor = game.TELEPORT_DOOR_COLORS[teleportType];
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
  };
  game.drawPlatformLevelGuide = function () {
    if (!game.CM_EDITOR_PAGE || game.mode !== "edit") return;
    game.ctx.save();
    game.ctx.fillStyle = "rgba(15, 23, 42, 0.72)";
    game.ctx.font = "bold 18px Arial";
    game.ctx.textAlign = "center";
    game.ctx.textBaseline = "middle";
    for (let r = 0; r < game.ROWS; r++) {
      const level = game.rowToPlatformLevel(r);
      const y = r * game.TILE_SIZE + game.TILE_SIZE / 2;
      game.ctx.fillText(String(level), game.TILE_SIZE * 0.24, y);
    }
    game.ctx.font = "bold 14px Arial";
    for (let c = 0; c < game.COLS; c++) {
      const x = c * game.TILE_SIZE + game.TILE_SIZE / 2;
      game.ctx.fillText(String(c), x, game.TILE_SIZE * 0.22);
    }
    game.ctx.restore();
  };
  game.drawBlackTargetPiece = function (renderCtx, x, y, tile, pieceType) {
    const pad = Math.max(1, Math.floor(tile * 0.13));
    const img = game.targetPieceImages[pieceType] || game.targetPieceImages.pawn;
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
  };
  game.drawCastleRookMarker = function (renderCtx, x, y, size) {
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
  };
}
