import { MOVE_MARKER } from '../moveMarker.js';
import { installPieceImageLayer } from '../pieceImageLayer.js';
import { ensurePlayerSelected } from '../playerSelection.js';
import { installPieceMovementAnimation, playerDrawPosition } from '../pieceMovementAnimation.js';

export function register(game) {
  game.drawTileTexture = function (renderCtx, name, x, y, size, { alpha = 1, rotation = 0 } = {}) {
    const image = game.tileImages && game.tileImages[name];
    const imageWidth = image && (image.naturalWidth || image.width);
    const imageHeight = image && (image.naturalHeight || image.height);
    if (!image || image.complete === false || !imageWidth || !imageHeight) return false;
    renderCtx.save();
    renderCtx.globalAlpha *= alpha;
    if (rotation) {
      renderCtx.translate(x + size / 2, y + size / 2);
      renderCtx.rotate(rotation);
      renderCtx.drawImage(image, -size / 2, -size / 2, size, size);
    } else if (name === "bomb") {
      const scale = Math.min(size / imageWidth, size / imageHeight);
      const width = imageWidth * scale;
      const height = imageHeight * scale;
      renderCtx.drawImage(image, x + (size - width) / 2, y + (size - height) / 2, width, height);
    } else {
      renderCtx.drawImage(image, x, y, size, size);
    }
    renderCtx.restore();
    return true;
  };

  game.drawBoardTile = function (renderCtx, x, y, row, col) {
    const texture = (row + col) % 2 === 0 ? "light" : "dark";
    if (!game.drawTileTexture(renderCtx, texture, x, y, game.TILE_SIZE)) {
      renderCtx.fillStyle = texture === "light" ? "#f3eee4" : "#a5a5a2";
      renderCtx.fillRect(x, y, game.TILE_SIZE, game.TILE_SIZE);
    }
  };

  game.drawPossibleMoveMarker = function (x, y) {
    game.ctx.save();
    game.ctx.fillStyle = MOVE_MARKER.fill;
    game.ctx.beginPath();
    game.ctx.arc(x + game.TILE_SIZE / 2, y + game.TILE_SIZE / 2, game.TILE_SIZE / 5, 0, Math.PI * 2);
    game.ctx.fill();
    game.ctx.strokeStyle = MOVE_MARKER.stroke;
    game.ctx.lineWidth = 2;
    game.ctx.stroke();
    game.ctx.restore();
  };
  game.drawFogOverlay = function (x, y, row, col) {
    game.ctx.save();
    game.ctx.fillStyle = "rgba(0,0,0,0.7)";
    game.ctx.fillRect(x, y, game.TILE_SIZE, game.TILE_SIZE);
    game.ctx.globalAlpha = 0.3;
    game.ctx.fillStyle = (row + col) % 2 === 0 ? "#EEE" : "#CCC";
    game.ctx.fillRect(x, y, game.TILE_SIZE, game.TILE_SIZE);
    game.ctx.restore();
  };
  game.drawGoalStyle = function (x, y, { locked = false, counter = null } = {}) {
    game.ctx.save();
    game.ctx.drawImage(game.pieceImages.target, x + 8, y + 8, game.TILE_SIZE - 16, game.TILE_SIZE - 16);
    if (game.pieceImageLayer) {
      game.pieceImageLayer.decorateGoal(locked, counter);
      game.ctx.restore();
      return;
    }
    if (counter !== null && !locked) game.drawCounterGoalBadge(x, y, counter);
    if (locked) {
      game.ctx.fillStyle = "rgba(0,0,0,0.7)";
      game.ctx.beginPath();
      game.ctx.arc(x + game.TILE_SIZE / 2, y + game.TILE_SIZE / 2, 12, 0, Math.PI * 2);
      game.ctx.fill();
      game.ctx.fillStyle = "white";
      game.ctx.font = "bold 16px Arial";
      game.ctx.textAlign = "center";
      game.ctx.textBaseline = "middle";
      game.ctx.fillText("🔒", x + game.TILE_SIZE / 2, y + game.TILE_SIZE / 2);
      if (counter !== null) game.drawCounterGoalBadge(x, y, counter, y + 10);
    }
    game.ctx.restore();
  };
  game.drawPossibleMoves = function () {
    ensurePlayerSelected(game);
    if (game.mode !== "play" || game.selectedPlayerIndex === -1 || game.gameWon) return;
    if (game.pieceMoveAnimation || game.fallingPieces.length || game.risingPieces.length || game.pendingMoveCounter || game.showTransformerMenu) return;
    const selected = game.players[game.selectedPlayerIndex];
    game.ctx.save();
    game.ctx.fillStyle = MOVE_MARKER.fill;
    game.ctx.globalAlpha = .25;
    game.ctx.fillRect(selected.col * game.TILE_SIZE, selected.row * game.TILE_SIZE, game.TILE_SIZE, game.TILE_SIZE);
    game.ctx.globalAlpha = 1;
    game.ctx.strokeStyle = MOVE_MARKER.stroke;
    game.ctx.lineWidth = 2;
    game.ctx.strokeRect(selected.col * game.TILE_SIZE + 1, selected.row * game.TILE_SIZE + 1, game.TILE_SIZE - 2, game.TILE_SIZE - 2);
    game.ctx.restore();
    for (let r = 0; r < game.ROWS; r++) {
      for (let c = 0; c < game.COLS; c++) {
        if (game.isValidMove(game.selectedPlayerIndex, r, c)) {
          let x = c * game.TILE_SIZE;
          let y = r * game.TILE_SIZE;
          game.drawPossibleMoveMarker(x, y);
        }
      }
    }
  };
  game.drawPieceSelectionMenu = // Draw the piece selection menu
  function () {
    if (!game.transformerPosition) return;

    // Always position menu in center of board instead of at transformer block
    const centerX = game.COLS * game.TILE_SIZE / 2;
    const centerY = game.ROWS * game.TILE_SIZE / 2;

    // Button size
    const buttonSize = 35;
    const spacing = 15;
    const menuWidth = 3 * buttonSize + 2 * spacing;
    const menuHeight = 3 * buttonSize + 2 * spacing;

    // Center the menu on the board
    const outerMargin = 20;
    const startX = centerX - menuWidth / 2;
    const startY = centerY - menuHeight / 2 - 10; // Slightly above center
    game.pieceImageLayer?.occludeRect(startX - outerMargin, startY - outerMargin, menuWidth + outerMargin * 2, menuHeight + outerMargin * 2 + 20);

    // Draw menu background
    game.ctx.fillStyle = "rgba(0, 0, 0, 0.95)";
    game.ctx.fillRect(startX - outerMargin, startY - outerMargin, menuWidth + outerMargin * 2, menuHeight + outerMargin * 2 + 20);

    // Draw border
    game.ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    game.ctx.lineWidth = 4;
    game.ctx.strokeRect(startX - outerMargin, startY - outerMargin, menuWidth + outerMargin * 2, menuHeight + outerMargin * 2 + 20);

    // Optional: Add a secondary inner border
    game.ctx.strokeStyle = "rgba(52, 152, 219, 0.6)";
    game.ctx.lineWidth = 2;
    game.ctx.strokeRect(startX - outerMargin + 4, startY - outerMargin + 4, menuWidth + outerMargin * 2 - 8, menuHeight + outerMargin * 2 + 20 - 8);

    // Draw title
    game.ctx.fillStyle = "white";
    game.ctx.font = "bold 14px Arial";
    game.ctx.textAlign = "center";
    game.ctx.fillText("Choose Piece Type", centerX, startY - outerMargin + 12);

    // Define the piece grid layout
    const pieceLayout = [["rook", "bishop", "queen"], ["knight", "king", "pawn"], ["castle_rook"]];

    // Draw piece options
    pieceLayout.forEach((row, rowIndex) => {
      row.forEach((pieceType, colIndex) => {
        const btnX = startX + colIndex * (buttonSize + spacing);
        const btnY = startY + rowIndex * (buttonSize + spacing);

        // Draw button background
        game.ctx.fillStyle = "rgba(52, 152, 219, 0.9)";
        game.ctx.fillRect(btnX, btnY, buttonSize, buttonSize);
        game.ctx.strokeStyle = "white";
        game.ctx.lineWidth = 1;
        game.ctx.strokeRect(btnX, btnY, buttonSize, buttonSize);

        // Draw piece image
        const imgSize = buttonSize - 10;
        const imgX = btnX + (buttonSize - imgSize) / 2;
        const imgY = btnY + (buttonSize - imgSize) / 2;
        game.ctx.drawImage(game.pieceImages[pieceType], imgX, imgY, imgSize, imgSize);

        // Draw piece name below image
        game.ctx.fillStyle = "white";
        game.ctx.font = "10px Arial";
        game.ctx.textAlign = "center";
        game.ctx.textBaseline = "top";
        const displayName = pieceType.split("_").map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
        game.ctx.fillText(displayName, btnX + buttonSize / 2, btnY + buttonSize + 3);
      });
    });

    // Draw instruction text
    game.ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    game.ctx.font = "italic 10px Arial";
    game.ctx.fillText("Click outside to cancel", centerX, startY + menuHeight + outerMargin + 8);

    // Reset text alignment
    game.ctx.textAlign = "left";
    game.ctx.textBaseline = "alphabetic";
  };
  game.getVisibleSquares = // Fog reveals each player piece plus the eight surrounding squares.
  function () {
    game.syncVisitedSquaresSize();
    const visible = Array.from({
      length: game.ROWS
    }, () => Array(game.COLS).fill(false));
    if (!game.fogEnabled || game.CM_EDITOR_PAGE && game.mode === "edit") {
      for (let r = 0; r < game.ROWS; r++) for (let c = 0; c < game.COLS; c++) visible[r][c] = true;
      return visible;
    }
    game.players.forEach(player => {
      game.revealAdjacentSquares(visible, player.row, player.col);
    });
    for (let r = 0; r < game.ROWS; r++) {
      for (let c = 0; c < game.COLS; c++) {
        if (visible[r][c]) {
          game.visitedSquares[r][c] = true;
        } else if (game.visitedSquares[r][c]) {
          visible[r][c] = true;
        }
      }
    }
    return visible;
  };
  game.getValidMovesFor = function (playerIndex) {
    const moves = [];
    if (playerIndex < 0 || playerIndex >= game.players.length) return moves;
    for (let r = 0; r < game.ROWS; r++) {
      for (let c = 0; c < game.COLS; c++) {
        if (game.isValidMove(playerIndex, r, c)) moves.push([r, c]);
      }
    }
    return moves;
  };
  game.getVisionForPiece = function (row, col, pieceType, playerIndex) {
    const visionSquares = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const visibleRow = row + dr;
        const visibleCol = col + dc;
        if (game.isInsideBoard(visibleRow, visibleCol)) {
          visionSquares.push([visibleRow, visibleCol]);
        }
      }
    }
    return visionSquares;
  };
  game.drawCellContent = function (cellType, x, y, row, col) {
    const tile = game.TILE_SIZE;
    const ctx = game.ctx;
    if (cellType === game.CELL_TYPES.SOLID_BLOCK) {
      if (!game.drawTileTexture(ctx, "blockOpen", x, y, tile)) {
        ctx.fillStyle = "#89c924";
        ctx.fillRect(x, y, tile, tile);
      }
    }

    if (game.isPhaseCell(cellType)) {
      game.drawDirectionalPhaseBlock(ctx, x, y, tile);
    }

    if (cellType === game.CELL_TYPES.MOVING_PLATFORM) {
      const axis = game.getMovingPlatformAxisAt(row, col);
      game.drawMovingPlatform(ctx, x, y, tile, axis);
    }

    if (cellType === game.CELL_TYPES.TRANSFORMER) {
      const isActive = game.transformerPosition?.row === row && game.transformerPosition?.col === col;
      game.drawTileTexture(ctx, isActive ? "swapActive" : "swap", x, y, tile);
    }

    if (cellType === game.CELL_TYPES.OBJECTIVE) {
      const inset = tile * 0.14;
      if (!game.drawTileTexture(ctx, "checkpoint", x + inset, y + inset, tile - inset * 2)) {
        ctx.fillStyle = "#fdb702";
        ctx.beginPath();
        ctx.moveTo(x + tile / 2, y + tile * 0.14);
        ctx.lineTo(x + tile * 0.86, y + tile / 2);
        ctx.lineTo(x + tile / 2, y + tile * 0.86);
        ctx.lineTo(x + tile * 0.14, y + tile / 2);
        ctx.closePath();
        ctx.fill();
      }
    }

    if (!game.pieceImageLayer && (cellType === game.CELL_TYPES.GOAL || cellType === game.CELL_TYPES.COUNTER_GOAL) && game.goal && game.goal.row === row && game.goal.col === col) {
      ctx.drawImage(game.pieceImages.target, x + tile * 0.12, y + tile * 0.12, tile * 0.76, tile * 0.76);
    }

    if (cellType === game.CELL_TYPES.BLACK_TARGET_PIECE) {
      const targetIndex = game.getTargetPieceAt(row, col);
      const targetPiece = targetIndex !== -1 ? game.targetPieces[targetIndex] : null;
      game.drawBlackTargetPiece(ctx, x, y, tile, targetPiece ? targetPiece.pieceType : "pawn");
    }
  };
  game.drawCounterGoalBadge = // --- Drawing ---
  function (x, y, counter, centerY = y + game.TILE_SIZE / 2) {
    game.ctx.save();
    game.ctx.fillStyle = "rgba(0,0,0,0.7)";
    game.ctx.beginPath();
    game.ctx.arc(x + game.TILE_SIZE / 2, centerY, 14, 0, Math.PI * 2);
    game.ctx.fill();
    game.ctx.fillStyle = counter <= 3 ? "red" : "white";
    game.ctx.font = "bold 16px Arial";
    game.ctx.textAlign = "center";
    game.ctx.textBaseline = "middle";
    game.ctx.fillText(counter, x + game.TILE_SIZE / 2, centerY);
    game.ctx.restore();
  };
  game.drawLaserEmitter = function (renderCtx, x, y, tile, laser) {
    const plate = Math.max(5, tile * 0.12);
    const inset = Math.max(9, tile * 0.18);
    const active = game.isLaserActive(laser);
    const enabledDirections = game.normalizeLaserDirections(laser && laser.directions);
    const countdown = game.getLaserCountdown(laser);
    renderCtx.save();
    renderCtx.lineWidth = 1.5;
    const barsByDirection = {
      up: [x + inset, y + 2, tile - inset * 2, plate],
      down: [x + inset, y + tile - plate - 2, tile - inset * 2, plate],
      left: [x + 2, y + inset, plate, tile - inset * 2],
      right: [x + tile - plate - 2, y + inset, plate, tile - inset * 2]
    };
    for (const direction of game.DEFAULT_LASER_DIRECTIONS) {
      const [barX, barY, width, height] = barsByDirection[direction];
      const enabled = enabledDirections.includes(direction);
      renderCtx.fillStyle = enabled ? active ? "#ff3b30" : "#6c1f1a" : "rgba(30, 30, 30, 0.72)";
      renderCtx.strokeStyle = enabled ? active ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.18)";
      renderCtx.fillRect(barX, barY, width, height);
      renderCtx.strokeRect(barX, barY, width, height);
    }
    const badgeRadius = Math.max(9, tile * 0.24);
    const centerX = x + tile / 2;
    const centerY = y + tile / 2;
    renderCtx.fillStyle = active ? "rgba(255, 59, 48, 0.92)" : "rgba(20, 24, 31, 0.78)";
    renderCtx.strokeStyle = active ? "rgba(255, 255, 255, 0.95)" : "rgba(255, 255, 255, 0.78)";
    renderCtx.lineWidth = Math.max(1.5, tile * 0.035);
    renderCtx.beginPath();
    renderCtx.arc(centerX, centerY, badgeRadius, 0, Math.PI * 2);
    renderCtx.fill();
    renderCtx.stroke();
    renderCtx.fillStyle = "#ffffff";
    renderCtx.font = `bold ${Math.max(11, Math.floor(tile * 0.34))}px Arial`;
    renderCtx.textAlign = "center";
    renderCtx.textBaseline = "middle";
    renderCtx.fillText(String(countdown), centerX, centerY + 0.5);
    renderCtx.restore();
  };
  game.drawLaserCell = function (renderCtx, x, y, direction) {
    const beamWidth = Math.max(8, game.TILE_SIZE * 0.16);
    const glowWidth = Math.max(18, game.TILE_SIZE * 0.34);
    const isVertical = direction === "up" || direction === "down";
    const centerX = x + game.TILE_SIZE / 2;
    const centerY = y + game.TILE_SIZE / 2;
    renderCtx.save();
    renderCtx.fillStyle = "rgba(255, 64, 64, 0.16)";
    if (isVertical) {
      renderCtx.fillRect(centerX - glowWidth / 2, y, glowWidth, game.TILE_SIZE);
    } else {
      renderCtx.fillRect(x, centerY - glowWidth / 2, game.TILE_SIZE, glowWidth);
    }
    renderCtx.fillStyle = "rgba(255, 0, 0, 0.75)";
    if (isVertical) {
      renderCtx.fillRect(centerX - beamWidth / 2, y, beamWidth, game.TILE_SIZE);
    } else {
      renderCtx.fillRect(x, centerY - beamWidth / 2, game.TILE_SIZE, beamWidth);
    }
    renderCtx.fillStyle = "rgba(255, 255, 255, 0.9)";
    const coreWidth = Math.max(2, beamWidth * 0.28);
    if (isVertical) {
      renderCtx.fillRect(centerX - coreWidth / 2, y, coreWidth, game.TILE_SIZE);
    } else {
      renderCtx.fillRect(x, centerY - coreWidth / 2, game.TILE_SIZE, coreWidth);
    }
    renderCtx.restore();
  };
  game.drawLaserEffects = function (visible) {
    for (const laser of game.laserBlocks) {
      if (laser.row < 0 || laser.row >= game.ROWS || laser.col < 0 || laser.col >= game.COLS) continue;
      if (game.fogEnabled && !visible[laser.row][laser.col]) continue;
      game.drawLaserEmitter(game.ctx, laser.col * game.TILE_SIZE, laser.row * game.TILE_SIZE, game.TILE_SIZE, laser);
    }
    for (const laser of game.laserBlocks) {
      if (!game.isLaserActive(laser)) continue;
      for (const cell of game.getLaserCellsFromBlock(laser)) {
        if (game.fogEnabled && !visible[cell.row][cell.col]) continue;
        game.drawLaserCell(game.ctx, cell.col * game.TILE_SIZE, cell.row * game.TILE_SIZE, cell.direction);
      }
    }
  };
  game.drawBoard = function () {
    game.pieceImageLayer?.beginFrame();
    const visible = game.fogEnabled ? game.getVisibleSquares() : null;
    for (let r = 0; r < game.ROWS; r++) {
      for (let c = 0; c < game.COLS; c++) {
        let x = c * game.TILE_SIZE;
        let y = r * game.TILE_SIZE;

        game.drawBoardTile(game.ctx, x, y, r, c);

        // If fog is off, draw everything normally
        if (game.fogEnabled) {
          // If fog is on, only draw content if visible
          if (visible[r][c]) {
            game.drawCellContent(game.board[r][c], x, y, r, c);
          } else {
            game.drawFogOverlay(x, y, r, c);
          }
        } else {
          // If fog is off, draw everything normally
          game.drawCellContent(game.board[r][c], x, y, r, c);
        }

        // Draw teleport blocks with their respective colors
        if ([game.CELL_TYPES.TELEPORT_PURPLE, game.CELL_TYPES.TELEPORT_GREEN, game.CELL_TYPES.TELEPORT_BLUE, game.CELL_TYPES.TELEPORT_ORANGE].includes(game.board[r][c])) {
          if (!game.fogEnabled || visible[r][c]) {
            game.drawTeleporterDoor(game.ctx, x, y, game.TILE_SIZE, game.board[r][c], game.getTeleporterDoorRole(r, c, game.board[r][c]));
          }
        }

        // Draw player pieces - adjust size and position
        if (game.board[r][c] === game.CELL_TYPES.PLAYER) {
          // Find which player is at this position
          if (!game.fogEnabled || visible[r][c]) {
            const player = game.players.find(p => p.row === r && p.col === c);
            if (player) {
              // Check if there's a teleport block at this position
              const teleportBlock = game.teleportBlocks.find(tp => tp.row === r && tp.col === c);
              if (teleportBlock) {
                game.drawTeleporterDoor(game.ctx, x, y, game.TILE_SIZE, teleportBlock.type, game.getTeleporterDoorRole(r, c, teleportBlock.type));
              }

              // Draw the player piece on top
              if (!game.pieceImageLayer) game.ctx.drawImage(game.pieceImages[player.pieceType], x + 8, y + 8, game.TILE_SIZE - 16, game.TILE_SIZE - 16);
              if (!game.pieceImageLayer && player.pieceType === "castle_rook") {
                game.drawCastleRookMarker(game.ctx, x, y, game.TILE_SIZE);
              }
            }
          }
        }
        if (game.teleportBlocks.some(tp => tp.row === r && tp.col === c) && game.board[r][c] !== game.CELL_TYPES.PLAYER) {
          if (!game.fogEnabled || visible[r][c]) {
            const teleportBlock = game.teleportBlocks.find(tp => tp.row === r && tp.col === c);
            if (teleportBlock) {
              game.drawTeleporterDoor(game.ctx, x, y, game.TILE_SIZE, teleportBlock.type, game.getTeleporterDoorRole(r, c, teleportBlock.type));
            }
          }
        }

        // Draw bomb block
        if (game.board[r][c] === game.CELL_TYPES.BOMB) {
          if (!game.fogEnabled || visible[r][c]) {
            if (!game.drawTileTexture(game.ctx, "bomb", x, y, game.TILE_SIZE)) {
              game.ctx.drawImage(game.pieceImages.bomb, x + 8, y + 8, game.TILE_SIZE - 16, game.TILE_SIZE - 16);
            }
          }
        }

        // Draw goal (red king) - adjust size and position
        if (!game.pieceImageLayer && game.board[r][c] === game.CELL_TYPES.GOAL && game.goal) {
          if (!game.fogEnabled || visible[r][c]) {
            if (game.areAllObjectivesCompleted()) {
              // Goal is accessible - draw normally
              game.ctx.drawImage(game.pieceImages.target, x + 8, y + 8, game.TILE_SIZE - 16, game.TILE_SIZE - 16);
            } else {
              // Goal is not accessible yet - draw as locked
              game.ctx.drawImage(game.pieceImages.target, x + 8, y + 8, game.TILE_SIZE - 16, game.TILE_SIZE - 16);

              // Draw lock icon over the goal
              game.ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
              game.ctx.beginPath();
              game.ctx.arc(x + game.TILE_SIZE / 2, y + game.TILE_SIZE / 2, 12, 0, Math.PI * 2); // Smaller lock
              game.ctx.fill();
              game.ctx.fillStyle = "white";
              game.ctx.font = "bold 16px Arial"; // Smaller font
              game.ctx.textAlign = "center";
              game.ctx.textBaseline = "middle";
              game.ctx.fillText("🔒", x + game.TILE_SIZE / 2, y + game.TILE_SIZE / 2);
              game.ctx.textAlign = "left";
              game.ctx.textBaseline = "alphabetic";
            }
          }
        }
      }
    }

    // Draw players
    game.fallingPieces.forEach(piece => {
      if (game.pieceImageLayer && piece.playerIndex === 'goal') return;
      const x = piece.col * game.TILE_SIZE;

      // ghost at starting square
      // ctx.globalAlpha = 0.5; // translucent ghost
      // ctx.drawImage(pieceImages[piece.pieceType], x+8, piece.startRow * TILE_SIZE + 8, TILE_SIZE-16, TILE_SIZE-16);

      // falling piece
      game.ctx.globalAlpha = 1.0;
      game.ctx.drawImage(game.pieceImages[piece.pieceType], x + 8, piece.y + 8, game.TILE_SIZE - 16, game.TILE_SIZE - 16);
    });
    if (game.pieceImageLayer) {
      for (const piece of game.risingPieces) {
        game.ctx.drawImage(game.pieceImages[piece.pieceType], piece.col * game.TILE_SIZE + 8, piece.currentY + 8, game.TILE_SIZE - 16, game.TILE_SIZE - 16);
      }
    }

    // Draw exploding players with rotation effect
    for (const p of game.explodingPlayers) {
      const img = game.pieceImages[p.pieceType];
      if (!img.complete) continue;
      game.ctx.save();
      game.ctx.translate(p.x + game.TILE_SIZE / 2, p.y + game.TILE_SIZE / 2);
      game.ctx.rotate(p.rotation);

      // Add a slight scale effect for more drama
      const scale = 1 + Math.sin(p.rotation) * 0.1;
      game.ctx.scale(scale, scale);

      // Draw the piece centered
      game.ctx.drawImage(img, -game.TILE_SIZE / 2, -game.TILE_SIZE / 2, game.TILE_SIZE, game.TILE_SIZE);
      game.ctx.restore();
    }

    // draw normal (non-falling) players
    game.players.forEach((player, i) => {
      const isFalling = game.fallingPieces.find(fp => fp.playerIndex === i);
      const isRising = game.risingPieces.find(rp => rp.playerIndex === i);
      if (!isFalling && !isRising && (!game.pieceImageLayer || !game.fogEnabled || visible[player.row]?.[player.col])) {
        const { x, y } = playerDrawPosition(game, player);

        // Check if there's a teleport block at this position
        const teleportBlock = game.teleportBlocks.find(tp => tp.row === player.row && tp.col === player.col);
        if (teleportBlock) {
          game.drawTeleporterDoor(game.ctx, x, y, game.TILE_SIZE, teleportBlock.type, game.getTeleporterDoorRole(player.row, player.col, teleportBlock.type));
        }

        // Draw the player piece on top
        game.ctx.drawImage(game.pieceImages[player.pieceType], x + 8, y + 8, game.TILE_SIZE - 16, game.TILE_SIZE - 16);
        if (player.pieceType === "castle_rook") {
          game.drawCastleRookMarker(game.ctx, x, y, game.TILE_SIZE);
        }
      }
    });

    // Draw goal or counter goal
    if (game.goal) {
      const x = game.goal.col * game.TILE_SIZE;
      let y = game.goal.row * game.TILE_SIZE;

      // check if it's falling
      const isFalling = game.fallingPieces.find(fp => fp.playerIndex === "goal");
      if (isFalling) y = isFalling.y;

      // ✅ Only draw if fog is disabled OR square is visible
      if ((!game.pieceImageLayer || !game.gameWon) && (!game.fogEnabled || visible[game.goal.row][game.goal.col])) {
        const goalLocked = !game.areAllObjectivesCompleted() || game.goal.type === "counter" && game.goal.counter <= 0;
        game.drawGoalStyle(x, y, { locked: goalLocked, counter: game.goal.type === "counter" ? game.goal.counter : null });
      }
    }
    for (const duck of game.ducks) {
      const isOnBoard = duck.row >= 0 && duck.row < game.ROWS && duck.col >= 0 && duck.col < game.COLS;
      if (isOnBoard && (!game.fogEnabled || visible[duck.row][duck.col])) {
        game.drawDuck(game.ctx, duck);
      }
    }
    game.drawLaserEffects(visible);
    game.drawPlatformLevelGuide();
  };
}
export function initialize(game) {
  if (!game.CM_EDITOR_PAGE) {
    installPieceImageLayer(game);
    installPieceMovementAnimation(game);
  }
}
