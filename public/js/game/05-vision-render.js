/**
 * game/05-vision-render.js
 * Valid moves, vision/fog, drawBoard
 * Split from game.monolith.js lines 4122-4830.
 */
function drawPossibleMoves() {
  if (mode !== "play" || selectedPlayerIndex === -1 || gameWon) return;
  
  const player = players[selectedPlayerIndex];
  
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (isValidMove(selectedPlayerIndex, r, c)) {
        let x = c * TILE_SIZE;
        let y = r * TILE_SIZE;
        
        ctx.fillStyle = "rgba(41, 128, 185, 0.5)";
        ctx.beginPath();
        ctx.arc(x + TILE_SIZE/2, y + TILE_SIZE/2, TILE_SIZE/5, 0, Math.PI * 2); // Smaller circles
        ctx.fill();
        
        // Add a border to make it more visible
        ctx.strokeStyle = "rgba(21, 67, 96, 0.8)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }
}

// --- Draw selection indicator around selected player ---
function drawSelectionIndicator() {
  if (mode !== "play" || selectedPlayerIndex === -1 || gameWon) return;
  
  const player = players[selectedPlayerIndex];
  let x = player.col * TILE_SIZE;
  let y = player.row * TILE_SIZE;
  
  ctx.strokeStyle = "rgba(231, 76, 60, 0.8)";
  ctx.lineWidth = 2; // Thinner line
  ctx.beginPath();
  ctx.arc(x + TILE_SIZE/2, y + TILE_SIZE/2, TILE_SIZE/2 - 4, 0, Math.PI * 2); // Smaller circle
  ctx.stroke();
}

// Draw the piece selection menu
function drawPieceSelectionMenu() {
  if (!transformerPosition) return;
  
  // Always position menu in center of board instead of at transformer block
  const centerX = (COLS * TILE_SIZE) / 2;
  const centerY = (ROWS * TILE_SIZE) / 2;
  
  // Button size
  const buttonSize = 35;
  const spacing = 15;
  const menuWidth = 3 * buttonSize + 2 * spacing;
  const menuHeight = 3 * buttonSize + 2 * spacing;
  
  // Center the menu on the board
  const outerMargin = 20;
  const startX = centerX - menuWidth / 2;
  const startY = centerY - menuHeight / 2 - 10; // Slightly above center
  
  // Draw menu background
  ctx.fillStyle = "rgba(0, 0, 0, 0.95)";
  ctx.fillRect(
    startX - outerMargin, 
    startY - outerMargin, 
    menuWidth + (outerMargin * 2), 
    menuHeight + (outerMargin * 2) + 20
  );
  
  // Draw border
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = 4;
  ctx.strokeRect(
    startX - outerMargin, 
    startY - outerMargin, 
    menuWidth + (outerMargin * 2), 
    menuHeight + (outerMargin * 2) + 20
  );
  
  // Optional: Add a secondary inner border
  ctx.strokeStyle = "rgba(52, 152, 219, 0.6)";
  ctx.lineWidth = 2;
  ctx.strokeRect(
    startX - outerMargin + 4, 
    startY - outerMargin + 4, 
    menuWidth + (outerMargin * 2) - 8, 
    menuHeight + (outerMargin * 2) + 20 - 8
  );
  
  // Draw title
  ctx.fillStyle = "white";
  ctx.font = "bold 14px Arial";
  ctx.textAlign = "center";
  ctx.fillText("Choose Piece Type", centerX, startY - outerMargin + 12);
  
  // Define the piece grid layout
  const pieceLayout = [
    ["rook", "bishop", "queen"],
    ["knight", "king", "pawn"],
    ["castle_rook"]
  ];
  
  // Draw piece options
  pieceLayout.forEach((row, rowIndex) => {
    row.forEach((pieceType, colIndex) => {
      const btnX = startX + colIndex * (buttonSize + spacing);
      const btnY = startY + rowIndex * (buttonSize + spacing);
      
      // Draw button background
      ctx.fillStyle = "rgba(52, 152, 219, 0.9)";
      ctx.fillRect(btnX, btnY, buttonSize, buttonSize);
      ctx.strokeStyle = "white";
      ctx.lineWidth = 1;
      ctx.strokeRect(btnX, btnY, buttonSize, buttonSize);
      
      // Draw piece image
      const imgSize = buttonSize - 10;
      const imgX = btnX + (buttonSize - imgSize) / 2;
      const imgY = btnY + (buttonSize - imgSize) / 2;
      
      ctx.drawImage(pieceImages[pieceType], imgX, imgY, imgSize, imgSize);
      
      // Draw piece name below image
      ctx.fillStyle = "white";
      ctx.font = "10px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      
      const displayName = pieceType
        .split("_")
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
      ctx.fillText(displayName, btnX + buttonSize/2, btnY + buttonSize + 3);
    });
  });
  
  // Draw instruction text
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.font = "italic 10px Arial";
  ctx.fillText("Click outside to cancel", centerX, startY + menuHeight + outerMargin + 8);
  
  // Reset text alignment
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

// Fog reveals each player piece plus the eight surrounding squares.
function getVisibleSquares() {
  syncVisitedSquaresSize();
  const visible = Array.from({ length: ROWS }, () => Array(COLS).fill(false));

  if (!fogEnabled || (CM_EDITOR_PAGE && mode === "edit")) {
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        visible[r][c] = true;
    return visible;
  }

  players.forEach(player => {
    revealAdjacentSquares(visible, player.row, player.col);
  });

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (visible[r][c]) {
        visitedSquares[r][c] = true;
      } else if (visitedSquares[r][c]) {
        visible[r][c] = true;
      }
    }
  }

  return visible;
}

function getValidMovesFor(playerIndex) {
  const moves = [];
  if (playerIndex < 0 || playerIndex >= players.length) return moves;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (isValidMove(playerIndex, r, c)) moves.push([r, c]);
    }
  }
  return moves;
}

function getVisionForPiece(row, col, pieceType, playerIndex) {
  const visionSquares = [];

  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const visibleRow = row + dr;
      const visibleCol = col + dc;
      if (isInsideBoard(visibleRow, visibleCol)) {
        visionSquares.push([visibleRow, visibleCol]);
      }
    }
  }

  return visionSquares;
}

// Add this function to draw the content of a cell
function drawCellContent(cellType, x, y, row, col) {
  // Draw solid block (green square)
  if (cellType === CELL_TYPES.SOLID_BLOCK) {
    ctx.fillStyle = "rgba(46, 204, 113, 0.7)";
    ctx.fillRect(x+3, y+3, TILE_SIZE-6, TILE_SIZE-6);
  }
  
  // Draw inactive phase block (blue semi-transparent)
  if (cellType === CELL_TYPES.PHASE_BLOCK) {
    drawInactivePhaseBlock(ctx, x, y, TILE_SIZE);
  }
  
  // Draw active phase block (solid blue)
  if (cellType === CELL_TYPES.PHASE_BLOCK_ACTIVE) {
    ctx.fillStyle = "rgba(41, 128, 185, 0.8)";
    ctx.fillRect(x+3, y+3, TILE_SIZE-6, TILE_SIZE-6);
  }

  if (cellType === CELL_TYPES.MOVING_PLATFORM) {
    drawMovingPlatform(ctx, x, y, TILE_SIZE, getMovingPlatformAxisAt(row, col));
  }
  
  // Draw transformer block (purple with question mark)
  if (cellType === CELL_TYPES.TRANSFORMER) {
    ctx.fillStyle = "rgba(155, 89, 182, 0.7)";
    ctx.fillRect(x+3, y+3, TILE_SIZE-6, TILE_SIZE-6);
    
    // Draw question mark
    ctx.fillStyle = "white";
    ctx.font = "bold 30px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", x + TILE_SIZE/2, y + TILE_SIZE/2);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }
  
  // Draw objective block (orange diamond)
  if (cellType === CELL_TYPES.OBJECTIVE) {
    ctx.fillStyle = "rgba(243, 156, 18, 0.7)";
    ctx.beginPath();
    ctx.moveTo(x + TILE_SIZE/2, y + 3);
    ctx.lineTo(x + TILE_SIZE - 3, y + TILE_SIZE/2);
    ctx.lineTo(x + TILE_SIZE/2, y + TILE_SIZE - 3);
    ctx.lineTo(x + 3, y + TILE_SIZE/2);
    ctx.closePath();
    ctx.fill();
  }
  
  // Draw completed objective block (green diamond)
  if (cellType === CELL_TYPES.OBJECTIVE_COMPleted) {
    ctx.fillStyle = "rgba(46, 204, 113, 0.7)";
    ctx.beginPath();
    ctx.moveTo(x + TILE_SIZE/2, y + 3);
    ctx.lineTo(x + TILE_SIZE - 3, y + TILE_SIZE/2);
    ctx.lineTo(x + TILE_SIZE/2, y + TILE_SIZE - 3);
    ctx.lineTo(x + 3, y + TILE_SIZE/2);
    ctx.closePath();
    ctx.fill();
    
    // Draw checkmark
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 15, y + TILE_SIZE/2);
    ctx.lineTo(x + TILE_SIZE/2 - 4, y + TILE_SIZE - 15);
    ctx.lineTo(x + TILE_SIZE - 15, y + 15);
    ctx.stroke();
  }
  
  // Draw goal (red king)
  if (cellType === CELL_TYPES.GOAL && goal && goal.row === row && goal.col === col) {
    ctx.drawImage(pieceImages.target, x+8, y+8, TILE_SIZE-16, TILE_SIZE-16);
  }
  
  // Draw counter goal
  if (cellType === CELL_TYPES.COUNTER_GOAL && goal && goal.row === row && goal.col === col) {
    ctx.drawImage(pieceImages.target, x+8, y+8, TILE_SIZE-16, TILE_SIZE-16);
  }

  if (cellType === CELL_TYPES.BLACK_TARGET_PIECE) {
    const targetIndex = getTargetPieceAt(row, col);
    const targetPiece = targetIndex !== -1 ? targetPieces[targetIndex] : null;
    drawBlackTargetPiece(ctx, x, y, TILE_SIZE, targetPiece ? targetPiece.pieceType : "pawn");
  }
}

// --- Drawing ---
function drawCounterGoalBadge(x, y, counter, centerY = y + TILE_SIZE / 2) {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.beginPath();
  ctx.arc(x + TILE_SIZE / 2, centerY, 14, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = (counter <= 3) ? "red" : "white";
  ctx.font = "bold 16px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(counter, x + TILE_SIZE / 2, centerY);
  ctx.restore();
}

function drawLaserEmitter(renderCtx, x, y, tile, laser) {
  const plate = Math.max(5, tile * 0.12);
  const inset = Math.max(9, tile * 0.18);
  const active = isLaserActive(laser);
  const enabledDirections = normalizeLaserDirections(laser && laser.directions);
  const countdown = getLaserCountdown(laser);

  renderCtx.save();
  renderCtx.lineWidth = 1.5;

  const barsByDirection = {
    up: [x + inset, y + 2, tile - inset * 2, plate],
    down: [x + inset, y + tile - plate - 2, tile - inset * 2, plate],
    left: [x + 2, y + inset, plate, tile - inset * 2],
    right: [x + tile - plate - 2, y + inset, plate, tile - inset * 2]
  };

  for (const direction of DEFAULT_LASER_DIRECTIONS) {
    const [barX, barY, width, height] = barsByDirection[direction];
    const enabled = enabledDirections.includes(direction);
    renderCtx.fillStyle = enabled
      ? (active ? "#ff3b30" : "#6c1f1a")
      : "rgba(30, 30, 30, 0.72)";
    renderCtx.strokeStyle = enabled
      ? (active ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.35)")
      : "rgba(255,255,255,0.18)";
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
}

function drawLaserCell(renderCtx, x, y, direction) {
  const beamWidth = Math.max(8, TILE_SIZE * 0.16);
  const glowWidth = Math.max(18, TILE_SIZE * 0.34);
  const isVertical = direction === "up" || direction === "down";
  const centerX = x + TILE_SIZE / 2;
  const centerY = y + TILE_SIZE / 2;

  renderCtx.save();
  renderCtx.fillStyle = "rgba(255, 64, 64, 0.16)";
  if (isVertical) {
    renderCtx.fillRect(centerX - glowWidth / 2, y, glowWidth, TILE_SIZE);
  } else {
    renderCtx.fillRect(x, centerY - glowWidth / 2, TILE_SIZE, glowWidth);
  }

  renderCtx.fillStyle = "rgba(255, 0, 0, 0.75)";
  if (isVertical) {
    renderCtx.fillRect(centerX - beamWidth / 2, y, beamWidth, TILE_SIZE);
  } else {
    renderCtx.fillRect(x, centerY - beamWidth / 2, TILE_SIZE, beamWidth);
  }

  renderCtx.fillStyle = "rgba(255, 255, 255, 0.9)";
  const coreWidth = Math.max(2, beamWidth * 0.28);
  if (isVertical) {
    renderCtx.fillRect(centerX - coreWidth / 2, y, coreWidth, TILE_SIZE);
  } else {
    renderCtx.fillRect(x, centerY - coreWidth / 2, TILE_SIZE, coreWidth);
  }
  renderCtx.restore();
}

function drawLaserEffects(visible) {
  for (const laser of laserBlocks) {
    if (laser.row < 0 || laser.row >= ROWS || laser.col < 0 || laser.col >= COLS) continue;
    if (fogEnabled && !visible[laser.row][laser.col]) continue;
    drawLaserEmitter(ctx, laser.col * TILE_SIZE, laser.row * TILE_SIZE, TILE_SIZE, laser);
  }

  for (const laser of laserBlocks) {
    if (!isLaserActive(laser)) continue;
    for (const cell of getLaserCellsFromBlock(laser)) {
      if (fogEnabled && !visible[cell.row][cell.col]) continue;
      drawLaserCell(ctx, cell.col * TILE_SIZE, cell.row * TILE_SIZE, cell.direction);
    }
  }
}

function drawBoard() {
  const visible = fogEnabled ? getVisibleSquares() : null;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      let x = c * TILE_SIZE;
      let y = r * TILE_SIZE;

      // Draw checkerboard pattern
      ctx.fillStyle = (r + c) % 2 === 0 ? "#b6cce0ff" : "#ffffffff";  // light pink and sky blue
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

      // If fog is off, draw everything normally
      if (fogEnabled) {
        // If fog is on, only draw content if visible
        if (visible[r][c]) {
          drawCellContent(board[r][c], x, y, r, c);
        } else {
          // Overlay fog (dark square) but don't completely hide the cell
          ctx.fillStyle = "rgba(0,0,0,0.7)";
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          
          // Still show the basic checkerboard pattern underneath
          ctx.globalAlpha = 0.3;
          ctx.fillStyle = (r + c) % 2 === 0 ? "#EEE" : "#CCC";
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.globalAlpha = 1.0;
        }
      } else {
        // If fog is off, draw everything normally
        drawCellContent(board[r][c], x, y, r, c);
      }

      // Draw solid block (green square) - adjust size for smaller tiles
      if (board[r][c] === CELL_TYPES.SOLID_BLOCK) {
        if (!fogEnabled || visible[r][c]) {
          ctx.fillStyle = "rgba(46, 204, 113, 0.7)";
          ctx.fillRect(x+3, y+3, TILE_SIZE-6, TILE_SIZE-6);
        }
      }
      
      // Draw inactive phase block (blue semi-transparent) - adjust size
      if (board[r][c] === CELL_TYPES.PHASE_BLOCK) {
        if (!fogEnabled || visible[r][c]) {
          drawInactivePhaseBlock(ctx, x, y, TILE_SIZE);
        }
      }
      
      // Draw active phase block (solid blue) - adjust size
      if (board[r][c] === CELL_TYPES.PHASE_BLOCK_ACTIVE) {
        if (!fogEnabled || visible[r][c]) {
          ctx.fillStyle = "rgba(41, 128, 185, 0.8)";
          ctx.fillRect(x+3, y+3, TILE_SIZE-6, TILE_SIZE-6);
        }
      }

      if (board[r][c] === CELL_TYPES.MOVING_PLATFORM) {
        if (!fogEnabled || visible[r][c]) {
          drawMovingPlatform(ctx, x, y, TILE_SIZE, getMovingPlatformAxisAt(r, c));
        }
      }
      
      // Draw transformer block (purple with question mark) - adjust size
      if (board[r][c] === CELL_TYPES.TRANSFORMER) {
        if (!fogEnabled || visible[r][c]) {
          ctx.fillStyle = "rgba(155, 89, 182, 0.7)";
          ctx.fillRect(x+3, y+3, TILE_SIZE-6, TILE_SIZE-6);
          
          // Draw question mark
          ctx.fillStyle = "white";
          ctx.font = "bold 30px Arial"; // Smaller font
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("?", x + TILE_SIZE/2, y + TILE_SIZE/2);
          ctx.textAlign = "left";
          ctx.textBaseline = "alphabetic";
        }
      }
      
      // Draw objective block (orange diamond) - adjust size
      if (board[r][c] === CELL_TYPES.OBJECTIVE) {
        if (!fogEnabled || visible[r][c]) {
          ctx.fillStyle = "rgba(243, 156, 18, 0.7)";
          ctx.beginPath();
          ctx.moveTo(x + TILE_SIZE/2, y + 3);
          ctx.lineTo(x + TILE_SIZE - 3, y + TILE_SIZE/2);
          ctx.lineTo(x + TILE_SIZE/2, y + TILE_SIZE - 3);
          ctx.lineTo(x + 3, y + TILE_SIZE/2);
          ctx.closePath();
          ctx.fill();
        }
      }

      // Draw teleport blocks with their respective colors
      if ([
          CELL_TYPES.TELEPORT_PURPLE,
          CELL_TYPES.TELEPORT_GREEN,
          CELL_TYPES.TELEPORT_BLUE,
          CELL_TYPES.TELEPORT_ORANGE
      ].includes(board[r][c])) {
          if (!fogEnabled || visible[r][c]) {
              drawTeleporterDoor(ctx, x, y, TILE_SIZE, board[r][c], getTeleporterDoorRole(r, c, board[r][c]));
          }
      }
      
      // Draw completed objective block (green diamond) - adjust size
      if (board[r][c] === CELL_TYPES.OBJECTIVE_COMPLETED) {
        if (!fogEnabled || visible[r][c]) {
          ctx.fillStyle = "rgba(46, 204, 113, 0.7)";
          ctx.beginPath();
          ctx.moveTo(x + TILE_SIZE/2, y + 3);
          ctx.lineTo(x + TILE_SIZE - 3, y + TILE_SIZE/2);
          ctx.lineTo(x + TILE_SIZE/2, y + TILE_SIZE - 3);
          ctx.lineTo(x + 3, y + TILE_SIZE/2);
          ctx.closePath();
          ctx.fill();
          
          // Draw checkmark
          ctx.strokeStyle = "white";
          ctx.lineWidth = 2; // Thinner line
          ctx.beginPath();
          ctx.moveTo(x + 15, y + TILE_SIZE/2);
          ctx.lineTo(x + TILE_SIZE/2 - 4, y + TILE_SIZE - 15);
          ctx.lineTo(x + TILE_SIZE - 15, y + 15);
          ctx.stroke();
        }
      }

      // Draw player pieces - adjust size and position
      if (board[r][c] === CELL_TYPES.PLAYER) {
        // Find which player is at this position
        if (!fogEnabled || visible[r][c]) {
          const player = players.find(p => p.row === r && p.col === c);
          if (player) {
            // Check if there's a teleport block at this position
            const teleportBlock = teleportBlocks.find(tp => tp.row === r && tp.col === c);
            if (teleportBlock) {
                drawTeleporterDoor(ctx, x, y, TILE_SIZE, teleportBlock.type, getTeleporterDoorRole(r, c, teleportBlock.type));
            }
            
          // Draw the player piece on top
          ctx.drawImage(pieceImages[player.pieceType], x+8, y+8, TILE_SIZE-16, TILE_SIZE-16);
          if (player.pieceType === "castle_rook") {
            drawCastleRookMarker(ctx, x, y, TILE_SIZE);
          }
        }
      }
      }

      if (teleportBlocks.some(tp => tp.row === r && tp.col === c) && board[r][c] !== CELL_TYPES.PLAYER) {
        if (!fogEnabled || visible[r][c]) {
            const teleportBlock = teleportBlocks.find(tp => tp.row === r && tp.col === c);
            if (teleportBlock) {
              drawTeleporterDoor(ctx, x, y, TILE_SIZE, teleportBlock.type, getTeleporterDoorRole(r, c, teleportBlock.type));
            }
        }
      }

      // Draw bomb block
      if (board[r][c] === CELL_TYPES.BOMB) {
        if (!fogEnabled || visible[r][c]) {
          ctx.drawImage(pieceImages.bomb, x+8, y+8, TILE_SIZE-16, TILE_SIZE-16);
        }
      }

      // Draw goal (red king) - adjust size and position
      if (board[r][c] === CELL_TYPES.GOAL && goal) {
        if (!fogEnabled || visible[r][c]) {
          if (areAllObjectivesCompleted()) {
            // Goal is accessible - draw normally
            ctx.drawImage(pieceImages.target, x+8, y+8, TILE_SIZE-16, TILE_SIZE-16);
          } else {
            // Goal is not accessible yet - draw as locked
            ctx.drawImage(pieceImages.target, x+8, y+8, TILE_SIZE-16, TILE_SIZE-16);
            
            // Draw lock icon over the goal
            ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
            ctx.beginPath();
            ctx.arc(x + TILE_SIZE/2, y + TILE_SIZE/2, 12, 0, Math.PI * 2); // Smaller lock
            ctx.fill();
            
            ctx.fillStyle = "white";
            ctx.font = "bold 16px Arial"; // Smaller font
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("🔒", x + TILE_SIZE/2, y + TILE_SIZE/2);
            ctx.textAlign = "left";
            ctx.textBaseline = "alphabetic";
          }
        }
      }
    }
  }

  // Draw players
  fallingPieces.forEach(piece => {
    const x = piece.col * TILE_SIZE;

    // ghost at starting square
    // ctx.globalAlpha = 0.5; // translucent ghost
    // ctx.drawImage(pieceImages[piece.pieceType], x+8, piece.startRow * TILE_SIZE + 8, TILE_SIZE-16, TILE_SIZE-16);

    // falling piece
    ctx.globalAlpha = 1.0;
    ctx.drawImage(pieceImages[piece.pieceType], x+8, piece.y+8, TILE_SIZE-16, TILE_SIZE-16);
  });

  risingPieces.forEach(piece => {
    const x = piece.col * TILE_SIZE;
    ctx.globalAlpha = 1.0;
    ctx.drawImage(pieceImages[piece.pieceType], x+8, piece.currentY+8, TILE_SIZE-16, TILE_SIZE-16);
  });

  // Draw exploding players with rotation effect
  for (const p of explodingPlayers) {
    const img = pieceImages[p.pieceType];
    if (!img.complete) continue;

    ctx.save();
    ctx.translate(p.x + TILE_SIZE / 2, p.y + TILE_SIZE / 2);
    ctx.rotate(p.rotation);
    
    // Add a slight scale effect for more drama
    const scale = 1 + Math.sin(p.rotation) * 0.1;
    ctx.scale(scale, scale);
    
    // Draw the piece centered
    ctx.drawImage(img, -TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
    ctx.restore();
  }

  // draw normal (non-falling) players
  players.forEach((player, i) => {
    const isFalling = fallingPieces.find(fp => fp.playerIndex === i);
    const isRising = risingPieces.find(rp => rp.playerIndex === i);
    
    if (!isFalling && !isRising) {
      const x = player.col * TILE_SIZE;
      const y = player.row * TILE_SIZE;
      
      // Check if there's a teleport block at this position
      const teleportBlock = teleportBlocks.find(tp => tp.row === player.row && tp.col === player.col);
      if (teleportBlock) {
        drawTeleporterDoor(ctx, x, y, TILE_SIZE, teleportBlock.type, getTeleporterDoorRole(player.row, player.col, teleportBlock.type));
      }
      
      // Draw the player piece on top
      ctx.drawImage(pieceImages[player.pieceType], x+8, y+8, TILE_SIZE-16, TILE_SIZE-16);
      if (player.pieceType === "castle_rook") {
        drawCastleRookMarker(ctx, x, y, TILE_SIZE);
      }
    }
  });


  // Draw goal or counter goal
  if (goal) {
    const x = goal.col * TILE_SIZE;
    let y = goal.row * TILE_SIZE;

    // check if it's falling
    const isFalling = fallingPieces.find(fp => fp.playerIndex === "goal");
    if (isFalling) y = isFalling.y;

    // ✅ Only draw if fog is disabled OR square is visible
    if (!fogEnabled || visible[goal.row][goal.col]) {
      // Draw base king image
      ctx.drawImage(pieceImages.target, x+8, y+8, TILE_SIZE-16, TILE_SIZE-16);
      const goalLocked = !areAllObjectivesCompleted() ||
        (goal.type === "counter" && goal.counter <= 0);

      // If it's a counter goal, draw counter
      if (goal.type === "counter" && !goalLocked) {
        drawCounterGoalBadge(x, y, goal.counter);
      }

      // Lock overlay
      if (goalLocked) {
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.beginPath();
        ctx.arc(x + TILE_SIZE/2, y + TILE_SIZE/2, 12, 0, Math.PI*2);
        ctx.fill();

        ctx.fillStyle = "white";
        ctx.font = "bold 16px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🔒", x + TILE_SIZE/2, y + TILE_SIZE/2);
      }

      if (goal.type === "counter" && goalLocked) {
        drawCounterGoalBadge(x, y, goal.counter, y + 10);
      }
    }
  }

  for (const duck of ducks) {
    const isOnBoard =
      duck.row >= 0 &&
      duck.row < ROWS &&
      duck.col >= 0 &&
      duck.col < COLS;
    if (isOnBoard && (!fogEnabled || visible[duck.row][duck.col])) {
      drawDuck(ctx, duck);
    }
  }

  drawLaserEffects(visible);
  drawPlatformLevelGuide();
}

// --- Confetti Celebration ---
