/**
 * game/05-vision-render.js
 * Valid moves, vision/fog, drawCellContent, drawBoard
 * Split from game.js lines 3061-3757 — logic unchanged.
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
  const menuHeight = 2 * buttonSize + spacing;
  
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
  
  // Define the 2x3 grid layout
  const pieceLayout = [
    ["rook", "bishop", "queen"],
    ["knight", "king", "pawn"]
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
      
      const displayName = pieceType.charAt(0).toUpperCase() + pieceType.slice(1);
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

//visible for only piece can move to
function getVisibleSquares() {
  const visible = Array.from({ length: ROWS }, () => Array(COLS).fill(false));

  if (!fogEnabled || (CM_EDITOR_PAGE && mode === "edit")) {
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        visible[r][c] = true;
    return visible;
  }

  if (selectedPlayerIndex >= 0) {
    const p = players[selectedPlayerIndex];
    visible[p.row][p.col] = true;

    // Show all valid move targets in fog
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (isValidMove(selectedPlayerIndex, r, c) || visitedSquares[r][c]) {
          visible[r][c] = true;
        }
      }
    }
  }
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (visitedSquares[r][c]) {
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
  
  // Always include current position
  visionSquares.push([row, col]);
  
  switch (pieceType) {
    case "rook":
      // Rooks see in straight lines until blocked
      addLineOfSight(visionSquares, row, col, 1, 0, playerIndex);  // Down
      addLineOfSight(visionSquares, row, col, -1, 0, playerIndex); // Up
      addLineOfSight(visionSquares, row, col, 0, 1, playerIndex);  // Right
      addLineOfSight(visionSquares, row, col, 0, -1, playerIndex); // Left
      break;
      
    case "bishop":
      // Bishops see in diagonals until blocked
      addLineOfSight(visionSquares, row, col, 1, 1, playerIndex);   // Down-right
      addLineOfSight(visionSquares, row, col, 1, -1, playerIndex);  // Down-left
      addLineOfSight(visionSquares, row, col, -1, 1, playerIndex);  // Up-right
      addLineOfSight(visionSquares, row, col, -1, -1, playerIndex); // Up-left
      break;
      
    case "queen":
      // Queens see in all directions until blocked
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          addLineOfSight(visionSquares, row, col, dr, dc, playerIndex);
        }
      }
      break;
      
    case "knight":
      // Knights see all knight moves (2+1 pattern)
      const knightMoves = [
        [2, 1], [2, -1], [-2, 1], [-2, -1],
        [1, 2], [1, -2], [-1, 2], [-1, -2]
      ];
      knightMoves.forEach(([dr, dc]) => {
        const newRow = row + dr;
        const newCol = col + dc;
        if (newRow >= 0 && newRow < ROWS && newCol >= 0 && newCol < COLS) {
          visionSquares.push([newRow, newCol]);
        }
      });
      break;
      
    case "king":
      // Kings see all adjacent squares
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const newRow = row + dr;
          const newCol = col + dc;
          if (newRow >= 0 && newRow < ROWS && newCol >= 0 && newCol < COLS) {
            visionSquares.push([newRow, newCol]);
          }
        }
      }
      break;
      
    case "pawn":
      // Pawns see forward and diagonal for capturing
      const newRow = row + 1; // Assuming pawns move downward
      if (newRow < ROWS) {
        visionSquares.push([newRow, col]); // Forward
        if (col > 0) visionSquares.push([newRow, col - 1]); // Diagonal left
        if (col < COLS - 1) visionSquares.push([newRow, col + 1]); // Diagonal right
      }
      break;
  }
  
  return visionSquares;
}

// Helper function to add line-of-sight squares until blocked
function addLineOfSight(visionSquares, startRow, startCol, dr, dc, playerIndex) {
  let r = startRow + dr;
  let c = startCol + dc;
  
  while (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
    visionSquares.push([r, c]);
    
    // Stop if we hit a blocking cell (but allow seeing through players)
    if (board[r][c] === CELL_TYPES.SOLID_BLOCK || 
        board[r][c] === CELL_TYPES.PHASE_BLOCK_ACTIVE) {
      break;
    }
    
    r += dr;
    c += dc;
  }
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
    ctx.fillStyle = "rgba(52, 152, 219, 0.3)";
    ctx.fillRect(x+3, y+3, TILE_SIZE-6, TILE_SIZE-6);
    
    // Draw upward arrow to indicate you can pass through from below
    ctx.fillStyle = "rgba(25, 118, 210, 0.6)";
    ctx.beginPath();
    ctx.moveTo(x + TILE_SIZE/2, y + TILE_SIZE - 10);
    ctx.lineTo(x + TILE_SIZE/2 - 8, y + TILE_SIZE - 18);
    ctx.lineTo(x + TILE_SIZE/2 + 8, y + TILE_SIZE - 18);
    ctx.closePath();
    ctx.fill();
  }
  
  // Draw active phase block (solid blue)
  if (cellType === CELL_TYPES.PHASE_BLOCK_ACTIVE) {
    ctx.fillStyle = "rgba(41, 128, 185, 0.8)";
    ctx.fillRect(x+3, y+3, TILE_SIZE-6, TILE_SIZE-6);
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
}

// --- Drawing ---
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
          ctx.fillStyle = "rgba(52, 152, 219, 0.3)";
          ctx.fillRect(x+3, y+3, TILE_SIZE-6, TILE_SIZE-6);
          
          // Draw upward arrow to indicate you can pass through from below
          ctx.fillStyle = "rgba(25, 118, 210, 0.6)";
          ctx.beginPath();
          ctx.moveTo(x + TILE_SIZE/2, y + TILE_SIZE - 10);
          ctx.lineTo(x + TILE_SIZE/2 - 8, y + TILE_SIZE - 18);
          ctx.lineTo(x + TILE_SIZE/2 + 8, y + TILE_SIZE - 18);
          ctx.closePath();
          ctx.fill();
        }
      }
      
      // Draw active phase block (solid blue) - adjust size
      if (board[r][c] === CELL_TYPES.PHASE_BLOCK_ACTIVE) {
        if (!fogEnabled || visible[r][c]) {
          ctx.fillStyle = "rgba(41, 128, 185, 0.8)";
          ctx.fillRect(x+3, y+3, TILE_SIZE-6, TILE_SIZE-6);
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
              const color = TELEPORT_COLORS[board[r][c]];
              if (color) {
                  ctx.fillStyle = color.fill;
                  ctx.beginPath();
                  ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE / 3, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.strokeStyle = color.stroke;
                  ctx.lineWidth = 2;
                  ctx.stroke();
              }
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
                const color = TELEPORT_COLORS[teleportBlock.type];
                if (color) {
                    // Draw teleport block underneath
                    ctx.fillStyle = color.fill;
                    ctx.beginPath();
                    ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE / 3, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = color.stroke;
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
            }
            
            // Draw the player piece on top
            ctx.drawImage(pieceImages[player.pieceType], x+8, y+8, TILE_SIZE-16, TILE_SIZE-16);
          }
        }
      }

      if (teleportBlocks.some(tp => tp.row === r && tp.col === c) && board[r][c] !== CELL_TYPES.PLAYER) {
        if (!fogEnabled || visible[r][c]) {
            ctx.fillStyle = "rgba(155, 89, 182, 0.8)";
            ctx.beginPath();
            ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE / 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
            ctx.lineWidth = 2;
            ctx.stroke();
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
        const color = TELEPORT_COLORS[teleportBlock.type];
        if (color) {
          // Draw teleport block underneath
          ctx.fillStyle = color.fill;
          ctx.beginPath();
          ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE / 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = color.stroke;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
      
      // Draw the player piece on top
      ctx.drawImage(pieceImages[player.pieceType], x+8, y+8, TILE_SIZE-16, TILE_SIZE-16);
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

      // If it's a counter goal, draw counter
      if (goal.type === "counter") {
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.beginPath();
        ctx.arc(x + TILE_SIZE/2, y + TILE_SIZE/2, 14, 0, Math.PI*2);
        ctx.fill();

        ctx.fillStyle = (goal.counter <= 3) ? "red" : "white";
        ctx.font = "bold 16px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(goal.counter, x + TILE_SIZE/2, y + TILE_SIZE/2);
      }

      // Lock overlay
      if (!areAllObjectivesCompleted() ||
        (goal.type === "counter" && goal.counter <= 0)) {
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
    }
  }
}

// --- Confetti Celebration ---
