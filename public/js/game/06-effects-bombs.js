/**
 * game/06-effects-bombs.js
 * Confetti, explosions, bombs
 * Split from game.js lines 3758-4203 — logic unchanged.
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
    const nextCol = bomb.col + bomb.direction;

    // Check bounds - bounce if hitting the edge
    if (nextCol < 0 || nextCol >= COLS) {
      bomb.direction *= -1; // Reverse direction
      continue;
    }

    // Check for collision with ANY player (regardless of selection state)
    const hitPlayerIndex = players.findIndex(p => p.row === bomb.row && p.col === nextCol);
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
      bomb.col = nextCol;
      board[bomb.row][bomb.col] = CELL_TYPES.BOMB;
      continue; // Skip the rest of the logic for this bomb this frame
    }

    // Only move if the next position is empty
    if (board[bomb.row][nextCol] === CELL_TYPES.EMPTY) {
      // Clear current position
      board[bomb.row][bomb.col] = CELL_TYPES.EMPTY;
      
      // Move bomb
      bomb.col = nextCol;
      board[bomb.row][bomb.col] = CELL_TYPES.BOMB;
    } else {
      // If the next position is blocked by something else, bounce
      bomb.direction *= -1;
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
