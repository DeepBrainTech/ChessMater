/**
 * game/06-effects-bombs.js
 * Confetti, bombs, ducks, platforms, lasers collisions
 * Split from game.monolith.js lines 4831-5646.
 */
function triggerConfetti() {
  //const Winsound = new Audio("assets/audio/woo-hoo-82843.mp3");
  const Winsound = new Audio("assets/audio/completion.mp3");
  playSound(Winsound, 0.7);
  const confettiCount = 150; // More confetti!
  const confettiColors = [
    '#ff6b6b', '#4ecdc4', '#f9ca24', '#6c5ce7', '#00b894', 
    '#fd79a8', '#ff9ff3', '#54a0ff', '#ff5252', '#00cec9',
    '#fdcb6e', '#a29bfe', '#55efc4', '#74b9ff', '#ffeaa7'
  ];
  
  const container = document.createElement('div');
  container.className = 'confetti-container';
  document.body.appendChild(container);
  
  const canvasRect = canvas.getBoundingClientRect();
  const centerX = canvasRect.left + canvasRect.width / 2;
  const startY = canvasRect.top + 30; // Start near top of canvas
  
  const confettiPieces = [];
  const startTime = Date.now();
  
  // Create enhanced confetti pieces
  for (let i = 0; i < confettiCount; i++) {
    const confetti = document.createElement('div');
    const color = confettiColors[Math.floor(Math.random() * confettiColors.length)];
    const size = Math.random() * 10 + 6;
    const shapeType = Math.floor(Math.random() * 4); // 0: circle, 1: square, 2: rectangle, 3: diamond
    
    let styles = `
      position: absolute;
      background: ${color};
      z-index: 1000;
      pointer-events: none;
      opacity: ${Math.random() * 0.9 + 0.1};
    `;
    
    switch(shapeType) {
      case 0: // Circle
        styles += `width: ${size}px; height: ${size}px; border-radius: 50%;`;
        break;
      case 1: // Square
        styles += `width: ${size}px; height: ${size}px;`;
        break;
      case 2: // Rectangle
        styles += `width: ${size * 1.5}px; height: ${size * 0.6}px;`;
        break;
      case 3: // Diamond
        styles += `
          width: ${size}px; height: ${size}px;
          transform: rotate(45deg);
          margin: ${size/2}px;
        `;
        break;
    }
    
    confetti.style.cssText = styles;
    container.appendChild(confetti);
    
    // Different physics for different shapes
    const isLight = shapeType === 2 || shapeType === 3; // rectangles and diamonds float more
    
    confettiPieces.push({
      element: confetti,
      x: centerX - size/2 + (Math.random() * 200 - 100), // Wider spread
      y: startY,
      speed: Math.random() * 4 + (isLight ? 1 : 2), // Lighter pieces fall slower
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() * 0.3 - 0.15) * (isLight ? 1.5 : 1),
      horizontalSpeed: Math.random() * 6 - 3,
      horizontalWave: Math.random() * 0.05,
      waveOffset: Math.random() * Math.PI * 2,
      size: size,
      shapeType: shapeType,
      opacity: Math.random() * 0.9 + 0.1,
      wobbleSpeed: Math.random() * 0.1 + 0.05,
      wobbleAmount: Math.random() * 5 + 2
    });
  }
  
  // Add some streamers for extra effect
  addStreamers(container, canvasRect, centerX, startY);
  
  // Animation loop
  function animateConfetti() {
    const elapsed = Date.now() - startTime;
    
    if (elapsed > 5000) { // Longer duration
      container.remove();
      return;
    }
    
    const progress = elapsed / 5000;
    
    confettiPieces.forEach((piece, index) => {
      // Update position with wave motion
      piece.y += piece.speed;
      piece.x += piece.horizontalSpeed + Math.sin(elapsed * piece.horizontalWave + piece.waveOffset) * 2;
      
      // Wobble effect
      const wobble = Math.sin(elapsed * piece.wobbleSpeed) * piece.wobbleAmount;
      
      // Rotation
      piece.rotation += piece.rotationSpeed;
      
      // Fade out near the end
      const opacity = Math.max(0, piece.opacity * (1 - progress * 1.2));
      
      // Apply transformations
      let transform = `rotate(${piece.rotation}rad) translateX(${wobble}px)`;
      if (piece.shapeType === 3) { // Diamond
        transform += ' rotate(45deg)';
      }
      
      piece.element.style.transform = transform;
      piece.element.style.left = `${piece.x}px`;
      piece.element.style.top = `${piece.y}px`;
      piece.element.style.opacity = opacity;
      
      // Remove pieces that go off screen
      if (piece.y > window.innerHeight || opacity <= 0) {
        piece.element.remove();
        confettiPieces.splice(index, 1);
      }
    });
    
    if (confettiPieces.length > 0) {
      requestAnimationFrame(animateConfetti);
    } else {
      container.remove();
    }
  }
  
  // Add burst effect at the beginning
  createInitialBurst(container, canvasRect, centerX, startY);
  
  animateConfetti();
}

// Add streamers for extra celebration
function addStreamers(container, canvasRect, centerX, startY) {
  const streamerColors = ['#ff6b6b', '#f9ca24', '#6c5ce7', '#00b894'];
  
  for (let i = 0; i < 8; i++) {
    const streamer = document.createElement('div');
    const color = streamerColors[i % streamerColors.length];
    const angle = (i / 8) * Math.PI * 2;
    const length = 60 + Math.random() * 40;
    
    streamer.style.cssText = `
      position: absolute;
      background: ${color};
      width: 4px;
      height: ${length}px;
      left: ${centerX - 2}px;
      top: ${startY}px;
      transform-origin: center top;
      transform: rotate(${angle}rad);
      z-index: 1000;
      pointer-events: none;
      opacity: 0.9;
    `;
    
    container.appendChild(streamer);
    
    // Animate streamers
    let scale = 1;
    const streamerInterval = setInterval(() => {
      scale -= 0.05;
      if (scale <= 0) {
        clearInterval(streamerInterval);
        streamer.remove();
      } else {
        streamer.style.transform = `rotate(${angle}rad) scaleY(${scale})`;
        streamer.style.opacity = scale;
      }
    }, 50);
  }
}

function createExplosionParticles(x, y) {
  for (let i = 0; i < 8; i++) {
    explodingPlayers.push({
      x: x,
      y: y,
      velocityY: Math.random() * -6 - 2,
      velocityX: (Math.random() - 0.5) * 8,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.5,
      pieceType: "pawn" // Use pawn as small particle, or create custom particle images
    });
  }
}

function scheduleAutoRestartAfterDeath(reasonText) {
  if (autoRestartScheduled) return;
  if (!currentPuzzleData) return;
  autoRestartScheduled = true;
  updateStatus(reasonText || "You died. Restarting level...");
  setTimeout(() => {
    autoRestartScheduled = false;
    restartLevel();
  }, 700);
}

//moving bomb function
function moveBombs() {
  for (let i = bombs.length - 1; i >= 0; i--) {
    let bomb = bombs[i];
    // Clear current position
    board[bomb.row][bomb.col] = CELL_TYPES.EMPTY;

    // Move bomb in its direction
    let nextCol = bomb.col + bomb.direction;

    // Remove bomb if out of bounds
    if (nextCol < 0 || nextCol >= COLS) {
      bombs.splice(i, 1);
      continue;
    }

    // Check collision with player
    const hitPlayerIndex = players.findIndex(p => p.row === bomb.row && p.col === nextCol);
    if (hitPlayerIndex !== -1) {
      const player = players[hitPlayerIndex];

      // 💥 Play explosion sound
      const explosionSound = document.getElementById("explosionSound");
      if (explosionSound) {
          playSound(explosionSound);
      }

      // Save explosion animation details
      explodingPlayers.push({
        x: player.col * TILE_SIZE,
        y: player.row * TILE_SIZE,
        velocityY: -8,  // Initial jump velocity
        rotation: 0,
        rotationSpeed: (Math.random() < 0.5 ? -1 : 1) * 0.3,
        pieceType: player.pieceType
      });

      createExplosionParticles(player.col * TILE_SIZE, player.row * TILE_SIZE);

      players.splice(hitPlayerIndex, 1);
      updatePlayerCount();
      updateStatus("💣 A player was blown up!");
      scheduleAutoRestartAfterDeath("💀 You were blown up! Restarting level...");
    }

    // Place bomb in new location
    bomb.col = nextCol;
    board[bomb.row][bomb.col] = CELL_TYPES.BOMB;
  }
}

function updateBombs() {
  for (let i = bombs.length - 1; i >= 0; i--) {
    const bomb = bombs[i];
    const nextRow = isBoomBomb(bomb) ? bomb.row + bomb.rowDirection : bomb.row;
    const nextCol = isBoomBomb(bomb) ? bomb.col + bomb.colDirection : bomb.col + bomb.direction;

    // Check bounds - bounce if hitting the edge
    if (nextRow < 0 || nextRow >= ROWS || nextCol < 0 || nextCol >= COLS) {
      if (isBoomBomb(bomb)) {
        bomb.rowDirection *= -1;
        bomb.colDirection *= -1;
      } else {
        bomb.direction *= -1; // Reverse direction
      }
      continue;
    }

    // Check for collision with ANY player (regardless of selection state)
    const hitPlayerIndex = players.findIndex(p => p.row === nextRow && p.col === nextCol);
    if (hitPlayerIndex !== -1) {
      const player = players[hitPlayerIndex];

      // 💥 Play explosion sound
      const explosionSound = document.getElementById("explosionSound");
      if (explosionSound) {
        playSound(explosionSound);
      }
      
      // Create explosion animation
      explodingPlayers.push({
        x: player.col * TILE_SIZE,
        y: player.row * TILE_SIZE,
        velocityY: -8,  // Initial upward velocity
        rotation: 0,
        rotationSpeed: (Math.random() < 0.5 ? -1 : 1) * 0.3, // Random rotation direction
        pieceType: player.pieceType
      });

      // Remove the player that got hit (regardless of selection state)
      players.splice(hitPlayerIndex, 1);
      updateStatus("💣 A player was blown up!");
      updatePlayerCount();
      shakeAmount = 30; // shake intensity
      scheduleAutoRestartAfterDeath("💀 You were blown up! Restarting level...");
      
      // Clear selection if the selected player was blown up
      if (selectedPlayerIndex === hitPlayerIndex) {
        selectedPlayerIndex = -1;
      } else if (selectedPlayerIndex > hitPlayerIndex) {
        // Adjust selected index if a player before it was removed
        selectedPlayerIndex--;
      }
      
      // Check if all players are gone
      if (players.length === 0) {
        updateStatus("Game Over! All players destroyed!");
      }
      
      // Move the bomb to the player's position and continue
      board[bomb.row][bomb.col] = CELL_TYPES.EMPTY;
      bomb.row = nextRow;
      bomb.col = nextCol;
      board[bomb.row][bomb.col] = CELL_TYPES.BOMB;
      continue; // Skip the rest of the logic for this bomb this frame
    }

    // Only move if the next position is empty
    if (board[nextRow][nextCol] === CELL_TYPES.EMPTY) {
      // Clear current position
      board[bomb.row][bomb.col] = CELL_TYPES.EMPTY;
      
      // Move bomb
      bomb.row = nextRow;
      bomb.col = nextCol;
      board[bomb.row][bomb.col] = CELL_TYPES.BOMB;
    } else {
      // If the next position is blocked by something else, bounce
      if (isBoomBomb(bomb)) {
        bomb.rowDirection *= -1;
        bomb.colDirection *= -1;
      } else {
        bomb.direction *= -1;
      }
    }
  }
}

function handleDuckCollision(playerIndex) {
  const player = players[playerIndex];
  if (!player) return;

  explodingPlayers.push({
    x: player.col * TILE_SIZE,
    y: player.row * TILE_SIZE,
    velocityY: -7,
    velocityX: 0,
    rotation: 0,
    rotationSpeed: (Math.random() < 0.5 ? -1 : 1) * 0.22,
    pieceType: player.pieceType
  });

  if (board[player.row][player.col] === CELL_TYPES.PLAYER) {
    board[player.row][player.col] = CELL_TYPES.EMPTY;
  }

  players.splice(playerIndex, 1);
  updatePlayerCount();
  selectedPlayerIndex = -1;
  shakeAmount = 18;
  updateStatus("🦆 You ran into a duck!");
  scheduleAutoRestartAfterDeath("🦆 The duck knocked you out! Restarting level...");
}

function updateDucks() {
  let removedSupport = false;

  for (let i = ducks.length - 1; i >= 0; i--) {
    const duck = ducks[i];
    const isWaitingToRespawn = duck.col < 0 || duck.col >= COLS;
    const nextCol = isWaitingToRespawn
      ? (duck.direction === 1 ? 0 : COLS - 1)
      : duck.col + duck.direction;

    if (nextCol < 0 || nextCol >= COLS) {
      const riderIndex = duck.row > 0 ? getPlayerAt(duck.row - 1, duck.col) : -1;
      if (riderIndex !== -1) removedSupport = true;
      duck.col = duck.direction === 1 ? COLS : -1;
      continue;
    }

    const hitPlayerIndex = getPlayerAt(duck.row, nextCol);
    if (
      (board[duck.row][nextCol] !== CELL_TYPES.EMPTY && hitPlayerIndex === -1) ||
      getDuckAt(duck.row, nextCol) !== -1
    ) {
      continue;
    }

    const riderIndex = !isWaitingToRespawn && duck.row > 0
      ? getPlayerAt(duck.row - 1, duck.col)
      : -1;
    if (riderIndex !== -1) {
      const rider = players[riderIndex];
      const riderTargetPlayerIndex = getPlayerAt(rider.row, nextCol);
      const riderTargetCell = board[rider.row][nextCol];
      const riderIsBlocked =
        riderTargetPlayerIndex !== -1 ||
        ![
          CELL_TYPES.EMPTY,
          CELL_TYPES.OBJECTIVE,
          CELL_TYPES.OBJECTIVE_COMPLETED
        ].includes(riderTargetCell);

      if (riderIsBlocked) {
        // The duck keeps moving. The rider stays behind, loses support,
        // and is allowed to fall after all ducks finish this movement tick.
        removedSupport = true;
      } else {
        board[rider.row][rider.col] = getObjectiveCellTypeAt(rider.row, rider.col);
        rider.col = nextCol;
        board[rider.row][rider.col] = CELL_TYPES.PLAYER;
        visitedSquares[rider.row][rider.col] = true;
        checkObjectiveCompletion();
        checkWinCondition();
      }
    }

    duck.col = nextCol;
    if (hitPlayerIndex !== -1) {
      handleDuckCollision(hitPlayerIndex);
    }
  }

  if (removedSupport && gravityEnabled && !antigravityEnabled && fallingPieces.length === 0) {
    applyGravity();
  }
}

function reverseMovingPlatform(platform) {
  platform.direction *= -1;
}

function getGoalCellType() {
  return goal && goal.type === "counter" ? CELL_TYPES.COUNTER_GOAL : CELL_TYPES.GOAL;
}

function updateHorizontalMovingPlatform(platform) {
  const nextCol = platform.currentCol + platform.direction;
  if (nextCol < platform.minCol || nextCol > platform.maxCol) {
    reverseMovingPlatform(platform);
    return;
  }

  const currentRow = platform.row;
  const currentCol = platform.col;
  const deltaCol = nextCol - currentCol;
  if (deltaCol === 0) return;

  const carriedPlayerIndex = getPlayerAt(currentRow - 1, currentCol);
  const carriedPlayer = carriedPlayerIndex !== -1 ? players[carriedPlayerIndex] : null;
  const carriedGoal =
    goal && goal.row === currentRow - 1 && goal.col === currentCol ? goal : null;

  if (
    nextCol < 0 ||
    nextCol >= COLS ||
    board[currentRow][nextCol] !== CELL_TYPES.EMPTY
  ) {
    reverseMovingPlatform(platform);
    return;
  }

  let carriedPlayerTargetCol = null;
  if (carriedPlayer) {
    carriedPlayerTargetCol = carriedPlayer.col + deltaCol;
    if (carriedPlayerTargetCol < 0 || carriedPlayerTargetCol >= COLS) {
      reverseMovingPlatform(platform);
      return;
    }

    const targetCell = board[carriedPlayer.row][carriedPlayerTargetCol];
    const targetPlayerIndex = getPlayerAt(carriedPlayer.row, carriedPlayerTargetCol);
    if (targetPlayerIndex !== -1 || targetCell !== CELL_TYPES.EMPTY) {
      reverseMovingPlatform(platform);
      return;
    }
  }

  let carriedGoalTargetCol = null;
  if (carriedGoal) {
    carriedGoalTargetCol = carriedGoal.col + deltaCol;
    if (carriedGoalTargetCol < 0 || carriedGoalTargetCol >= COLS) {
      reverseMovingPlatform(platform);
      return;
    }

    const targetCell = board[carriedGoal.row][carriedGoalTargetCol];
    const targetPlayerIndex = getPlayerAt(carriedGoal.row, carriedGoalTargetCol);
    if (targetPlayerIndex !== -1 || targetCell !== CELL_TYPES.EMPTY) {
      reverseMovingPlatform(platform);
      return;
    }
  }

  board[currentRow][currentCol] = CELL_TYPES.EMPTY;
  if (carriedPlayer) {
    board[carriedPlayer.row][carriedPlayer.col] = CELL_TYPES.EMPTY;
    carriedPlayer.col = carriedPlayerTargetCol;
    visitedSquares[carriedPlayer.row][carriedPlayer.col] = true;
  }
  if (carriedGoal) {
    board[carriedGoal.row][carriedGoal.col] = CELL_TYPES.EMPTY;
    carriedGoal.col = carriedGoalTargetCol;
  }

  platform.currentCol = nextCol;
  platform.col = nextCol;
  board[platform.row][platform.col] = CELL_TYPES.MOVING_PLATFORM;
  if (carriedPlayer) {
    board[carriedPlayer.row][carriedPlayer.col] = CELL_TYPES.PLAYER;
  }
  if (carriedGoal) {
    board[carriedGoal.row][carriedGoal.col] = getGoalCellType();
  }
}

function updateMovingPlatforms() {
  for (const platform of movingPlatforms) {
    if (platform.axis === "horizontal") {
      updateHorizontalMovingPlatform(platform);
      continue;
    }

    const nextLevel = platform.currentLevel + platform.direction;
    if (nextLevel < platform.minLevel || nextLevel > platform.maxLevel) {
      reverseMovingPlatform(platform);
      continue;
    }

    const currentRow = platform.row;
    const nextRow = platformLevelToRow(nextLevel);
    const deltaRow = nextRow - currentRow;
    if (deltaRow === 0) continue;

    const carriedPlayerIndex = getPlayerAt(currentRow - 1, platform.col);
    const carriedPlayer = carriedPlayerIndex !== -1 ? players[carriedPlayerIndex] : null;
    const carriedGoal =
      goal && goal.row === currentRow - 1 && goal.col === platform.col ? goal : null;
    const platformDestinationPlayerIndex = getPlayerAt(nextRow, platform.col);
    const platformDestinationIsCarriedPlayer =
      carriedPlayer && platformDestinationPlayerIndex === carriedPlayerIndex;
    const platformDestinationIsCarriedGoal =
      carriedGoal && nextRow === carriedGoal.row && platform.col === carriedGoal.col;

    if (
      nextRow < 0 ||
      nextRow >= ROWS ||
      (
        board[nextRow][platform.col] !== CELL_TYPES.EMPTY &&
        !platformDestinationIsCarriedPlayer &&
        !platformDestinationIsCarriedGoal
      )
    ) {
      reverseMovingPlatform(platform);
      continue;
    }

    let carriedPlayerTargetRow = null;
    if (carriedPlayer) {
      carriedPlayerTargetRow = carriedPlayer.row + deltaRow;
      if (carriedPlayerTargetRow < 0 || carriedPlayerTargetRow >= ROWS) {
        reverseMovingPlatform(platform);
        continue;
      }

      const targetCell = board[carriedPlayerTargetRow][platform.col];
      const targetPlayerIndex = getPlayerAt(carriedPlayerTargetRow, platform.col);
      const targetIsCurrentPlatformCell = carriedPlayerTargetRow === currentRow;
      if (
        targetPlayerIndex !== -1 ||
        (targetCell !== CELL_TYPES.EMPTY && !targetIsCurrentPlatformCell)
      ) {
        reverseMovingPlatform(platform);
        continue;
      }
    }

    let carriedGoalTargetRow = null;
    if (carriedGoal) {
      carriedGoalTargetRow = carriedGoal.row + deltaRow;
      if (carriedGoalTargetRow < 0 || carriedGoalTargetRow >= ROWS) {
        reverseMovingPlatform(platform);
        continue;
      }

      const targetCell = board[carriedGoalTargetRow][platform.col];
      const targetPlayerIndex = getPlayerAt(carriedGoalTargetRow, platform.col);
      const targetIsCurrentPlatformCell = carriedGoalTargetRow === currentRow;
      if (
        targetPlayerIndex !== -1 ||
        (targetCell !== CELL_TYPES.EMPTY && !targetIsCurrentPlatformCell)
      ) {
        reverseMovingPlatform(platform);
        continue;
      }
    }

    board[currentRow][platform.col] = CELL_TYPES.EMPTY;
    if (carriedPlayer) {
      board[carriedPlayer.row][carriedPlayer.col] = CELL_TYPES.EMPTY;
      carriedPlayer.row = carriedPlayerTargetRow;
      visitedSquares[carriedPlayer.row][carriedPlayer.col] = true;
    }
    if (carriedGoal) {
      board[carriedGoal.row][carriedGoal.col] = CELL_TYPES.EMPTY;
      carriedGoal.row = carriedGoalTargetRow;
    }

    platform.currentLevel = nextLevel;
    platform.row = nextRow;
    board[platform.row][platform.col] = CELL_TYPES.MOVING_PLATFORM;
    if (carriedPlayer) {
      board[carriedPlayer.row][carriedPlayer.col] = CELL_TYPES.PLAYER;
    }
    if (carriedGoal) {
      board[carriedGoal.row][carriedGoal.col] = getGoalCellType();
    }
  }
}

function updateExplodingPlayers() {
  for (let i = explodingPlayers.length - 1; i >= 0; i--) {
    const p = explodingPlayers[i];
    
    // Apply gravity
    p.velocityY += 0.5;
    p.y += p.velocityY;
    
    // Apply rotation
    p.rotation += p.rotationSpeed;
    
    // Add some horizontal movement for more dynamic effect
    if (Math.abs(p.rotationSpeed) > 0.1) {
      p.x += p.rotationSpeed * 2; // Move horizontally based on rotation direction
    }

    // Remove if off screen or after a certain time
    if (p.y > canvas.height + TILE_SIZE || p.x < -TILE_SIZE || p.x > canvas.width + TILE_SIZE) {
      explodingPlayers.splice(i, 1);
    }
  }
}

function handleLaserCollision(playerIndex, laserRow, laserCol) {
  const player = players[playerIndex];
  if (!player) return;

  const explosionSound = document.getElementById("explosionSound");
  if (explosionSound) {
    playSound(explosionSound);
  }

  explodingPlayers.push({
    x: laserCol * TILE_SIZE,
    y: laserRow * TILE_SIZE,
    velocityY: -8,
    rotation: 0,
    rotationSpeed: (Math.random() < 0.5 ? -1 : 1) * 0.3,
    pieceType: player.pieceType
  });

  createExplosionParticles(laserCol * TILE_SIZE, laserRow * TILE_SIZE);

  board[player.row][player.col] = CELL_TYPES.EMPTY;
  players.splice(playerIndex, 1);
  updateStatus("A player was cut down by a laser!");
  updatePlayerCount();
  shakeAmount = 24;
  scheduleAutoRestartAfterDeath("You were hit by a laser! Restarting level...");

  if (selectedPlayerIndex === playerIndex) {
    selectedPlayerIndex = -1;
  } else if (selectedPlayerIndex > playerIndex) {
    selectedPlayerIndex--;
  }

  fallingPieces = fallingPieces.filter(piece => piece.playerIndex !== playerIndex);
  risingPieces = risingPieces.filter(piece => piece.playerIndex !== playerIndex);

  if (players.length === 0) {
    updateStatus("Game Over! All players destroyed!");
  }
}

function checkActiveLaserCollisions() {
  if (mode !== "play" || gameWon || laserBlocks.length === 0) return;
  if (!laserBlocks.some(laser => isLaserActive(laser))) return;

  const hits = new Map();
  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    if (isCellInActiveLaser(player.row, player.col)) {
      hits.set(i, { row: player.row, col: player.col });
    }
  }

  for (const piece of fallingPieces) {
    if (piece.playerIndex === "goal") continue;
    const row = Math.max(0, Math.min(ROWS - 1, Math.floor((piece.y + TILE_SIZE / 2) / TILE_SIZE)));
    if (isCellInActiveLaser(row, piece.col)) {
      hits.set(piece.playerIndex, { row, col: piece.col });
    }
  }

  for (const piece of risingPieces) {
    if (piece.playerIndex === "goal") continue;
    const row = Math.max(0, Math.min(ROWS - 1, Math.floor((piece.y + TILE_SIZE / 2) / TILE_SIZE)));
    if (isCellInActiveLaser(row, piece.col)) {
      hits.set(piece.playerIndex, { row, col: piece.col });
    }
  }

  [...hits.entries()]
    .sort((a, b) => b[0] - a[0])
    .forEach(([playerIndex, hit]) => handleLaserCollision(playerIndex, hit.row, hit.col));
}

function handleBombCollision(player, playerIndex, bombRow, bombCol) {
  // 💥 Play explosion sound
  const explosionSound = document.getElementById("explosionSound");
  if (explosionSound) {
    playSound(explosionSound);
  }

  // Create explosion animation at the bomb's position
  explodingPlayers.push({
    x: bombCol * TILE_SIZE,
    y: bombRow * TILE_SIZE,
    velocityY: -8,  // Initial upward velocity
    rotation: 0,
    rotationSpeed: (Math.random() < 0.5 ? -1 : 1) * 0.3, // Random rotation direction
    pieceType: player.pieceType
  });

  createExplosionParticles(bombCol * TILE_SIZE, bombRow * TILE_SIZE);

  // Remove the bomb from the bombs array
  const bombIndex = bombs.findIndex(b => b.row === bombRow && b.col === bombCol);
  if (bombIndex !== -1) {
    bombs.splice(bombIndex, 1);
  }

  // Remove the player
  players.splice(playerIndex, 1);
  updateStatus("💣 A player was blown up by moving into a bomb!");
  updatePlayerCount();
  shakeAmount = 30; // shake intensity
  scheduleAutoRestartAfterDeath("💀 You were blown up! Restarting level...");

  // Clear both the bomb and player from the board
  board[bombRow][bombCol] = CELL_TYPES.EMPTY;

  // Check if all players are gone
  if (players.length === 0) {
    updateStatus("Game Over! All players destroyed!");
  }

  // Clear selection since this player is gone
  selectedPlayerIndex = -1;
}

// Create initial burst effect
function createInitialBurst(container, canvasRect, centerX, startY) {
  const burstColors = ['#ff6b6b', '#f9ca24', '#6c5ce7', '#00b894', '#ffffff'];
  
  for (let i = 0; i < 20; i++) {
    const burst = document.createElement('div');
    const color = burstColors[Math.floor(Math.random() * burstColors.length)];
    const size = Math.random() * 15 + 8;
    const angle = (i / 20) * Math.PI * 2;
    const distance = 30 + Math.random() * 40;
    
    burst.style.cssText = `
      position: absolute;
      background: ${color};
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      left: ${centerX - size/2}px;
      top: ${startY}px;
      z-index: 1000;
      pointer-events: none;
      opacity: 0.9;
    `;
    
    container.appendChild(burst);
    
    // Animate burst
    let progress = 0;
    const burstInterval = setInterval(() => {
      progress += 0.1;
      if (progress >= 1) {
        clearInterval(burstInterval);
        burst.remove();
      } else {
        const x = centerX + Math.cos(angle) * distance * progress;
        const y = startY + Math.sin(angle) * distance * progress;
        const scale = 1 - progress;
        const opacity = 0.9 * (1 - progress);
        
        burst.style.left = `${x - size/2}px`;
        burst.style.top = `${y}px`;
        burst.style.transform = `scale(${scale})`;
        burst.style.opacity = opacity;
      }
    }, 30);
  }
}

// --- Click handler ---
