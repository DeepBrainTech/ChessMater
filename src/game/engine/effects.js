export function register(game) {
  game.triggerConfetti = function () {
    //const Winsound = new Audio("assets/audio/woo-hoo-82843.mp3");
    const Winsound = new Audio("assets/audio/completion.mp3");
    game.playSound(Winsound, 0.7);
    const confettiCount = 150; // More confetti!
    const confettiColors = ['#ff6b6b', '#4ecdc4', '#f9ca24', '#6c5ce7', '#00b894', '#fd79a8', '#ff9ff3', '#54a0ff', '#ff5252', '#00cec9', '#fdcb6e', '#a29bfe', '#55efc4', '#74b9ff', '#ffeaa7'];
    const container = document.createElement('div');
    container.className = 'confetti-container';
    document.body.appendChild(game.lifecycle.trackNode(container));
    const canvasRect = game.canvas.getBoundingClientRect();
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
      switch (shapeType) {
        case 0:
          // Circle
          styles += `width: ${size}px; height: ${size}px; border-radius: 50%;`;
          break;
        case 1:
          // Square
          styles += `width: ${size}px; height: ${size}px;`;
          break;
        case 2:
          // Rectangle
          styles += `width: ${size * 1.5}px; height: ${size * 0.6}px;`;
          break;
        case 3:
          // Diamond
          styles += `
          width: ${size}px; height: ${size}px;
          transform: rotate(45deg);
          margin: ${size / 2}px;
        `;
          break;
      }
      confetti.style.cssText = styles;
      container.appendChild(confetti);

      // Different physics for different shapes
      const isLight = shapeType === 2 || shapeType === 3; // rectangles and diamonds float more

      confettiPieces.push({
        element: confetti,
        x: centerX - size / 2 + (Math.random() * 200 - 100),
        // Wider spread
        y: startY,
        speed: Math.random() * 4 + (isLight ? 1 : 2),
        // Lighter pieces fall slower
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
    game.addStreamers(container, canvasRect, centerX, startY);

    // Animation loop
    function animateConfetti() {
      const elapsed = Date.now() - startTime;
      if (elapsed > 5000) {
        // Longer duration
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
        if (piece.shapeType === 3) {
          // Diamond
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
        game.lifecycle.requestAnimationFrame(animateConfetti);
      } else {
        container.remove();
      }
    }

    // Add burst effect at the beginning
    game.createInitialBurst(container, canvasRect, centerX, startY);
    animateConfetti();
  };
  game.addStreamers = // Add streamers for extra celebration
  function (container, canvasRect, centerX, startY) {
    const streamerColors = ['#ff6b6b', '#f9ca24', '#6c5ce7', '#00b894'];
    for (let i = 0; i < 8; i++) {
      const streamer = document.createElement('div');
      const color = streamerColors[i % streamerColors.length];
      const angle = i / 8 * Math.PI * 2;
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
      const streamerInterval = game.lifecycle.setInterval(() => {
        scale -= 0.05;
        if (scale <= 0) {
          game.lifecycle.clearInterval(streamerInterval);
          streamer.remove();
        } else {
          streamer.style.transform = `rotate(${angle}rad) scaleY(${scale})`;
          streamer.style.opacity = scale;
        }
      }, 50);
    }
  };
  game.createExplosionParticles = function (x, y) {
    for (let i = 0; i < 8; i++) {
      game.explodingPlayers.push({
        x: x,
        y: y,
        velocityY: Math.random() * -6 - 2,
        velocityX: (Math.random() - 0.5) * 8,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.5,
        pieceType: "pawn" // Use pawn as small particle, or create custom particle images
      });
    }
  };
  game.scheduleAutoRestartAfterDeath = function (reasonText) {
    if (game.autoRestartScheduled) return;
    if (!game.currentPuzzleData) return;
    game.autoRestartScheduled = true;
    game.updateStatus(reasonText || "You died. Restarting level...");
    game.lifecycle.setTimeout(() => {
      game.autoRestartScheduled = false;
      game.restartLevel();
    }, 700);
  };
  game.moveBombs = //moving bomb function
  function () {
    for (let i = game.bombs.length - 1; i >= 0; i--) {
      let bomb = game.bombs[i];
      // Clear current position
      game.board[bomb.row][bomb.col] = game.CELL_TYPES.EMPTY;

      // Move bomb in its direction
      let nextCol = bomb.col + bomb.direction;

      // Remove bomb if out of bounds
      if (nextCol < 0 || nextCol >= game.COLS) {
        game.bombs.splice(i, 1);
        continue;
      }

      // Check collision with player
      const hitPlayerIndex = game.players.findIndex(p => p.row === bomb.row && p.col === nextCol);
      if (hitPlayerIndex !== -1) {
        const player = game.players[hitPlayerIndex];

        // 💥 Play explosion sound
        const explosionSound = document.getElementById("explosionSound");
        if (explosionSound) {
          game.playSound(explosionSound);
        }

        // Save explosion animation details
        game.explodingPlayers.push({
          x: player.col * game.TILE_SIZE,
          y: player.row * game.TILE_SIZE,
          velocityY: -8,
          // Initial jump velocity
          rotation: 0,
          rotationSpeed: (Math.random() < 0.5 ? -1 : 1) * 0.3,
          pieceType: player.pieceType
        });
        game.createExplosionParticles(player.col * game.TILE_SIZE, player.row * game.TILE_SIZE);
        game.players.splice(hitPlayerIndex, 1);
        game.updatePlayerCount();
        game.updateStatus("💣 A player was blown up!");
        game.scheduleAutoRestartAfterDeath("💀 You were blown up! Restarting level...");
      }

      // Place bomb in new location
      bomb.col = nextCol;
      game.board[bomb.row][bomb.col] = game.CELL_TYPES.BOMB;
    }
  };
  game.updateBombs = function () {
    for (let i = game.bombs.length - 1; i >= 0; i--) {
      const bomb = game.bombs[i];
      const nextRow = game.isBoomBomb(bomb) ? bomb.row + bomb.rowDirection : bomb.row;
      const nextCol = game.isBoomBomb(bomb) ? bomb.col + bomb.colDirection : bomb.col + bomb.direction;

      // Check bounds - bounce if hitting the edge
      if (nextRow < 0 || nextRow >= game.ROWS || nextCol < 0 || nextCol >= game.COLS) {
        if (game.isBoomBomb(bomb)) {
          bomb.rowDirection *= -1;
          bomb.colDirection *= -1;
        } else {
          bomb.direction *= -1; // Reverse direction
        }
        continue;
      }

      // Check for collision with ANY player (regardless of selection state)
      const hitPlayerIndex = game.players.findIndex(p => p.row === nextRow && p.col === nextCol);
      if (hitPlayerIndex !== -1) {
        const player = game.players[hitPlayerIndex];

        // 💥 Play explosion sound
        const explosionSound = document.getElementById("explosionSound");
        if (explosionSound) {
          game.playSound(explosionSound);
        }

        // Create explosion animation
        game.explodingPlayers.push({
          x: player.col * game.TILE_SIZE,
          y: player.row * game.TILE_SIZE,
          velocityY: -8,
          // Initial upward velocity
          rotation: 0,
          rotationSpeed: (Math.random() < 0.5 ? -1 : 1) * 0.3,
          // Random rotation direction
          pieceType: player.pieceType
        });

        // Remove the player that got hit (regardless of selection state)
        game.players.splice(hitPlayerIndex, 1);
        game.updateStatus("💣 A player was blown up!");
        game.updatePlayerCount();
        game.shakeAmount = 30; // shake intensity
        game.scheduleAutoRestartAfterDeath("💀 You were blown up! Restarting level...");

        // Clear selection if the selected player was blown up
        if (game.selectedPlayerIndex === hitPlayerIndex) {
          game.selectedPlayerIndex = -1;
        } else if (game.selectedPlayerIndex > hitPlayerIndex) {
          // Adjust selected index if a player before it was removed
          game.selectedPlayerIndex--;
        }

        // Check if all players are gone
        if (game.players.length === 0) {
          game.updateStatus("Game Over! All players destroyed!");
        }

        // Move the bomb to the player's position and continue
        game.board[bomb.row][bomb.col] = game.CELL_TYPES.EMPTY;
        bomb.row = nextRow;
        bomb.col = nextCol;
        game.board[bomb.row][bomb.col] = game.CELL_TYPES.BOMB;
        continue; // Skip the rest of the logic for this bomb this frame
      }

      // Only move if the next position is empty
      if (game.board[nextRow][nextCol] === game.CELL_TYPES.EMPTY) {
        // Clear current position
        game.board[bomb.row][bomb.col] = game.CELL_TYPES.EMPTY;

        // Move bomb
        bomb.row = nextRow;
        bomb.col = nextCol;
        game.board[bomb.row][bomb.col] = game.CELL_TYPES.BOMB;
      } else {
        // If the next position is blocked by something else, bounce
        if (game.isBoomBomb(bomb)) {
          bomb.rowDirection *= -1;
          bomb.colDirection *= -1;
        } else {
          bomb.direction *= -1;
        }
      }
    }
  };
  game.handleDuckCollision = function (playerIndex) {
    const player = game.players[playerIndex];
    if (!player) return;
    game.explodingPlayers.push({
      x: player.col * game.TILE_SIZE,
      y: player.row * game.TILE_SIZE,
      velocityY: -7,
      velocityX: 0,
      rotation: 0,
      rotationSpeed: (Math.random() < 0.5 ? -1 : 1) * 0.22,
      pieceType: player.pieceType
    });
    if (game.board[player.row][player.col] === game.CELL_TYPES.PLAYER) {
      game.board[player.row][player.col] = game.CELL_TYPES.EMPTY;
    }
    game.players.splice(playerIndex, 1);
    game.updatePlayerCount();
    game.selectedPlayerIndex = -1;
    game.shakeAmount = 18;
    game.updateStatus("🦆 You ran into a duck!");
    game.scheduleAutoRestartAfterDeath("🦆 The duck knocked you out! Restarting level...");
  };
  game.updateDucks = function () {
    let removedSupport = false;
    for (let i = game.ducks.length - 1; i >= 0; i--) {
      const duck = game.ducks[i];
      const isWaitingToRespawn = duck.col < 0 || duck.col >= game.COLS;
      const nextCol = isWaitingToRespawn ? duck.direction === 1 ? 0 : game.COLS - 1 : duck.col + duck.direction;
      if (nextCol < 0 || nextCol >= game.COLS) {
        const riderIndex = duck.row > 0 ? game.getPlayerAt(duck.row - 1, duck.col) : -1;
        if (riderIndex !== -1) removedSupport = true;
        duck.col = duck.direction === 1 ? game.COLS : -1;
        continue;
      }
      const hitPlayerIndex = game.getPlayerAt(duck.row, nextCol);
      if (game.board[duck.row][nextCol] !== game.CELL_TYPES.EMPTY && hitPlayerIndex === -1 || game.getDuckAt(duck.row, nextCol) !== -1) {
        continue;
      }
      const riderIndex = !isWaitingToRespawn && duck.row > 0 ? game.getPlayerAt(duck.row - 1, duck.col) : -1;
      if (riderIndex !== -1) {
        const rider = game.players[riderIndex];
        const riderTargetPlayerIndex = game.getPlayerAt(rider.row, nextCol);
        const riderTargetCell = game.board[rider.row][nextCol];
        const riderIsBlocked = riderTargetPlayerIndex !== -1 || ![game.CELL_TYPES.EMPTY, game.CELL_TYPES.OBJECTIVE, game.CELL_TYPES.OBJECTIVE_COMPLETED].includes(riderTargetCell);
        if (riderIsBlocked) {
          // The duck keeps moving. The rider stays behind, loses support,
          // and is allowed to fall after all ducks finish this movement tick.
          removedSupport = true;
        } else {
          game.board[rider.row][rider.col] = game.getObjectiveCellTypeAt(rider.row, rider.col);
          rider.col = nextCol;
          game.board[rider.row][rider.col] = game.CELL_TYPES.PLAYER;
          game.visitedSquares[rider.row][rider.col] = true;
          game.checkObjectiveCompletion();
          game.checkWinCondition();
        }
      }
      duck.col = nextCol;
      if (hitPlayerIndex !== -1) {
        game.handleDuckCollision(hitPlayerIndex);
      }
    }
    if (removedSupport && game.gravityEnabled && !game.antigravityEnabled && game.fallingPieces.length === 0) {
      game.applyGravity();
    }
  };
  game.reverseMovingPlatform = function (platform) {
    platform.direction *= -1;
  };
  game.getGoalCellType = function () {
    return game.goal && game.goal.type === "counter" ? game.CELL_TYPES.COUNTER_GOAL : game.CELL_TYPES.GOAL;
  };
  game.updateHorizontalMovingPlatform = function (platform) {
    const nextCol = platform.currentCol + platform.direction;
    if (nextCol < platform.minCol || nextCol > platform.maxCol) {
      game.reverseMovingPlatform(platform);
      return;
    }
    const currentRow = platform.row;
    const currentCol = platform.col;
    const deltaCol = nextCol - currentCol;
    if (deltaCol === 0) return;
    const carriedPlayerIndex = game.getPlayerAt(currentRow - 1, currentCol);
    const carriedPlayer = carriedPlayerIndex !== -1 ? game.players[carriedPlayerIndex] : null;
    const carriedGoal = game.goal && game.goal.row === currentRow - 1 && game.goal.col === currentCol ? game.goal : null;
    if (nextCol < 0 || nextCol >= game.COLS || game.board[currentRow][nextCol] !== game.CELL_TYPES.EMPTY) {
      game.reverseMovingPlatform(platform);
      return;
    }
    let carriedPlayerTargetCol = null;
    if (carriedPlayer) {
      carriedPlayerTargetCol = carriedPlayer.col + deltaCol;
      if (carriedPlayerTargetCol < 0 || carriedPlayerTargetCol >= game.COLS) {
        game.reverseMovingPlatform(platform);
        return;
      }
      const targetCell = game.board[carriedPlayer.row][carriedPlayerTargetCol];
      const targetPlayerIndex = game.getPlayerAt(carriedPlayer.row, carriedPlayerTargetCol);
      if (targetPlayerIndex !== -1 || targetCell !== game.CELL_TYPES.EMPTY) {
        game.reverseMovingPlatform(platform);
        return;
      }
    }
    let carriedGoalTargetCol = null;
    if (carriedGoal) {
      carriedGoalTargetCol = carriedGoal.col + deltaCol;
      if (carriedGoalTargetCol < 0 || carriedGoalTargetCol >= game.COLS) {
        game.reverseMovingPlatform(platform);
        return;
      }
      const targetCell = game.board[carriedGoal.row][carriedGoalTargetCol];
      const targetPlayerIndex = game.getPlayerAt(carriedGoal.row, carriedGoalTargetCol);
      if (targetPlayerIndex !== -1 || targetCell !== game.CELL_TYPES.EMPTY) {
        game.reverseMovingPlatform(platform);
        return;
      }
    }
    game.board[currentRow][currentCol] = game.CELL_TYPES.EMPTY;
    if (carriedPlayer) {
      game.board[carriedPlayer.row][carriedPlayer.col] = game.CELL_TYPES.EMPTY;
      carriedPlayer.col = carriedPlayerTargetCol;
      game.visitedSquares[carriedPlayer.row][carriedPlayer.col] = true;
    }
    if (carriedGoal) {
      game.board[carriedGoal.row][carriedGoal.col] = game.CELL_TYPES.EMPTY;
      carriedGoal.col = carriedGoalTargetCol;
    }
    platform.currentCol = nextCol;
    platform.col = nextCol;
    game.board[platform.row][platform.col] = game.CELL_TYPES.MOVING_PLATFORM;
    if (carriedPlayer) {
      game.board[carriedPlayer.row][carriedPlayer.col] = game.CELL_TYPES.PLAYER;
    }
    if (carriedGoal) {
      game.board[carriedGoal.row][carriedGoal.col] = game.getGoalCellType();
    }
  };
  game.updateMovingPlatforms = function () {
    for (const platform of game.movingPlatforms) {
      if (platform.axis === "horizontal") {
        game.updateHorizontalMovingPlatform(platform);
        continue;
      }
      const nextLevel = platform.currentLevel + platform.direction;
      if (nextLevel < platform.minLevel || nextLevel > platform.maxLevel) {
        game.reverseMovingPlatform(platform);
        continue;
      }
      const currentRow = platform.row;
      const nextRow = game.platformLevelToRow(nextLevel);
      const deltaRow = nextRow - currentRow;
      if (deltaRow === 0) continue;
      const carriedPlayerIndex = game.getPlayerAt(currentRow - 1, platform.col);
      const carriedPlayer = carriedPlayerIndex !== -1 ? game.players[carriedPlayerIndex] : null;
      const carriedGoal = game.goal && game.goal.row === currentRow - 1 && game.goal.col === platform.col ? game.goal : null;
      const platformDestinationPlayerIndex = game.getPlayerAt(nextRow, platform.col);
      const platformDestinationIsCarriedPlayer = carriedPlayer && platformDestinationPlayerIndex === carriedPlayerIndex;
      const platformDestinationIsCarriedGoal = carriedGoal && nextRow === carriedGoal.row && platform.col === carriedGoal.col;
      if (nextRow < 0 || nextRow >= game.ROWS || game.board[nextRow][platform.col] !== game.CELL_TYPES.EMPTY && !platformDestinationIsCarriedPlayer && !platformDestinationIsCarriedGoal) {
        game.reverseMovingPlatform(platform);
        continue;
      }
      let carriedPlayerTargetRow = null;
      if (carriedPlayer) {
        carriedPlayerTargetRow = carriedPlayer.row + deltaRow;
        if (carriedPlayerTargetRow < 0 || carriedPlayerTargetRow >= game.ROWS) {
          game.reverseMovingPlatform(platform);
          continue;
        }
        const targetCell = game.board[carriedPlayerTargetRow][platform.col];
        const targetPlayerIndex = game.getPlayerAt(carriedPlayerTargetRow, platform.col);
        const targetIsCurrentPlatformCell = carriedPlayerTargetRow === currentRow;
        if (targetPlayerIndex !== -1 || targetCell !== game.CELL_TYPES.EMPTY && !targetIsCurrentPlatformCell) {
          game.reverseMovingPlatform(platform);
          continue;
        }
      }
      let carriedGoalTargetRow = null;
      if (carriedGoal) {
        carriedGoalTargetRow = carriedGoal.row + deltaRow;
        if (carriedGoalTargetRow < 0 || carriedGoalTargetRow >= game.ROWS) {
          game.reverseMovingPlatform(platform);
          continue;
        }
        const targetCell = game.board[carriedGoalTargetRow][platform.col];
        const targetPlayerIndex = game.getPlayerAt(carriedGoalTargetRow, platform.col);
        const targetIsCurrentPlatformCell = carriedGoalTargetRow === currentRow;
        if (targetPlayerIndex !== -1 || targetCell !== game.CELL_TYPES.EMPTY && !targetIsCurrentPlatformCell) {
          game.reverseMovingPlatform(platform);
          continue;
        }
      }
      game.board[currentRow][platform.col] = game.CELL_TYPES.EMPTY;
      if (carriedPlayer) {
        game.board[carriedPlayer.row][carriedPlayer.col] = game.CELL_TYPES.EMPTY;
        carriedPlayer.row = carriedPlayerTargetRow;
        game.visitedSquares[carriedPlayer.row][carriedPlayer.col] = true;
      }
      if (carriedGoal) {
        game.board[carriedGoal.row][carriedGoal.col] = game.CELL_TYPES.EMPTY;
        carriedGoal.row = carriedGoalTargetRow;
      }
      platform.currentLevel = nextLevel;
      platform.row = nextRow;
      game.board[platform.row][platform.col] = game.CELL_TYPES.MOVING_PLATFORM;
      if (carriedPlayer) {
        game.board[carriedPlayer.row][carriedPlayer.col] = game.CELL_TYPES.PLAYER;
      }
      if (carriedGoal) {
        game.board[carriedGoal.row][carriedGoal.col] = game.getGoalCellType();
      }
    }
  };
  game.updateExplodingPlayers = function () {
    for (let i = game.explodingPlayers.length - 1; i >= 0; i--) {
      const p = game.explodingPlayers[i];

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
      if (p.y > game.canvas.height + game.TILE_SIZE || p.x < -game.TILE_SIZE || p.x > game.canvas.width + game.TILE_SIZE) {
        game.explodingPlayers.splice(i, 1);
      }
    }
  };
  game.handleLaserCollision = function (playerIndex, laserRow, laserCol) {
    const player = game.players[playerIndex];
    if (!player) return;
    const explosionSound = document.getElementById("explosionSound");
    if (explosionSound) {
      game.playSound(explosionSound);
    }
    game.explodingPlayers.push({
      x: laserCol * game.TILE_SIZE,
      y: laserRow * game.TILE_SIZE,
      velocityY: -8,
      rotation: 0,
      rotationSpeed: (Math.random() < 0.5 ? -1 : 1) * 0.3,
      pieceType: player.pieceType
    });
    game.createExplosionParticles(laserCol * game.TILE_SIZE, laserRow * game.TILE_SIZE);
    game.board[player.row][player.col] = game.CELL_TYPES.EMPTY;
    game.players.splice(playerIndex, 1);
    game.updateStatus("A player was cut down by a laser!");
    game.updatePlayerCount();
    game.shakeAmount = 24;
    game.scheduleAutoRestartAfterDeath("You were hit by a laser! Restarting level...");
    if (game.selectedPlayerIndex === playerIndex) {
      game.selectedPlayerIndex = -1;
    } else if (game.selectedPlayerIndex > playerIndex) {
      game.selectedPlayerIndex--;
    }
    game.fallingPieces = game.fallingPieces.filter(piece => piece.playerIndex !== playerIndex);
    game.risingPieces = game.risingPieces.filter(piece => piece.playerIndex !== playerIndex);
    if (game.players.length === 0) {
      game.updateStatus("Game Over! All players destroyed!");
    }
  };
  game.checkActiveLaserCollisions = function () {
    if (game.mode !== "play" || game.gameWon || game.laserBlocks.length === 0) return;
    if (!game.laserBlocks.some(laser => game.isLaserActive(laser))) return;
    const hits = new Map();
    for (let i = 0; i < game.players.length; i++) {
      const player = game.players[i];
      if (game.isCellInActiveLaser(player.row, player.col)) {
        hits.set(i, {
          row: player.row,
          col: player.col
        });
      }
    }
    for (const piece of game.fallingPieces) {
      if (piece.playerIndex === "goal") continue;
      const row = Math.max(0, Math.min(game.ROWS - 1, Math.floor((piece.y + game.TILE_SIZE / 2) / game.TILE_SIZE)));
      if (game.isCellInActiveLaser(row, piece.col)) {
        hits.set(piece.playerIndex, {
          row,
          col: piece.col
        });
      }
    }
    for (const piece of game.risingPieces) {
      if (piece.playerIndex === "goal") continue;
      const row = Math.max(0, Math.min(game.ROWS - 1, Math.floor((piece.y + game.TILE_SIZE / 2) / game.TILE_SIZE)));
      if (game.isCellInActiveLaser(row, piece.col)) {
        hits.set(piece.playerIndex, {
          row,
          col: piece.col
        });
      }
    }
    [...hits.entries()].sort((a, b) => b[0] - a[0]).forEach(([playerIndex, hit]) => game.handleLaserCollision(playerIndex, hit.row, hit.col));
  };
  game.handleBombCollision = function (player, playerIndex, bombRow, bombCol) {
    // 💥 Play explosion sound
    const explosionSound = document.getElementById("explosionSound");
    if (explosionSound) {
      game.playSound(explosionSound);
    }

    // Create explosion animation at the bomb's position
    game.explodingPlayers.push({
      x: bombCol * game.TILE_SIZE,
      y: bombRow * game.TILE_SIZE,
      velocityY: -8,
      // Initial upward velocity
      rotation: 0,
      rotationSpeed: (Math.random() < 0.5 ? -1 : 1) * 0.3,
      // Random rotation direction
      pieceType: player.pieceType
    });
    game.createExplosionParticles(bombCol * game.TILE_SIZE, bombRow * game.TILE_SIZE);

    // Remove the bomb from the bombs array
    const bombIndex = game.bombs.findIndex(b => b.row === bombRow && b.col === bombCol);
    if (bombIndex !== -1) {
      game.bombs.splice(bombIndex, 1);
    }

    // Remove the player
    game.players.splice(playerIndex, 1);
    game.updateStatus("💣 A player was blown up by moving into a bomb!");
    game.updatePlayerCount();
    game.shakeAmount = 30; // shake intensity
    game.scheduleAutoRestartAfterDeath("💀 You were blown up! Restarting level...");

    // Clear both the bomb and player from the board
    game.board[bombRow][bombCol] = game.CELL_TYPES.EMPTY;

    // Check if all players are gone
    if (game.players.length === 0) {
      game.updateStatus("Game Over! All players destroyed!");
    }

    // Clear selection since this player is gone
    game.selectedPlayerIndex = -1;
  };
  game.createInitialBurst = // Create initial burst effect
  function (container, canvasRect, centerX, startY) {
    const burstColors = ['#ff6b6b', '#f9ca24', '#6c5ce7', '#00b894', '#ffffff'];
    for (let i = 0; i < 20; i++) {
      const burst = document.createElement('div');
      const color = burstColors[Math.floor(Math.random() * burstColors.length)];
      const size = Math.random() * 15 + 8;
      const angle = i / 20 * Math.PI * 2;
      const distance = 30 + Math.random() * 40;
      burst.style.cssText = `
      position: absolute;
      background: ${color};
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      left: ${centerX - size / 2}px;
      top: ${startY}px;
      z-index: 1000;
      pointer-events: none;
      opacity: 0.9;
    `;
      container.appendChild(burst);

      // Animate burst
      let progress = 0;
      const burstInterval = game.lifecycle.setInterval(() => {
        progress += 0.1;
        if (progress >= 1) {
          game.lifecycle.clearInterval(burstInterval);
          burst.remove();
        } else {
          const x = centerX + Math.cos(angle) * distance * progress;
          const y = startY + Math.sin(angle) * distance * progress;
          const scale = 1 - progress;
          const opacity = 0.9 * (1 - progress);
          burst.style.left = `${x - size / 2}px`;
          burst.style.top = `${y}px`;
          burst.style.transform = `scale(${scale})`;
          burst.style.opacity = opacity;
        }
      }, 30);
    }
  };
}
export function initialize(game) {}
