export function register(game) {
  game.normalizePortalApiBase = function (base) {
    if (!base || typeof base !== "string") return "";
    return base.replace(/\/+$/, "");
  };
  game.normalizePortalShopCost = function (raw) {
    const coins = Number(raw?.coins);
    const diamonds = Number(raw?.diamonds);
    const flowers = Number(raw?.flowers);
    return {
      coins: Number.isFinite(coins) ? Math.max(0, Math.floor(coins)) : 0,
      diamonds: Number.isFinite(diamonds) ? Math.max(0, Math.floor(diamonds)) : 0,
      flowers: Number.isFinite(flowers) ? Math.max(0, Math.floor(flowers)) : 0
    };
  };
  game.getMovingPlatformAt = function (row, col) {
    return game.movingPlatforms.find(platform => platform.row === row && platform.col === col) || null;
  };
  game.getMovingPlatformAxisAt = function (row, col) {
    const platform = game.getMovingPlatformAt(row, col);
    return platform && platform.axis === "horizontal" ? "horizontal" : "vertical";
  };
  game.normalizeBombData = function (bomb) {
    if (bomb.type === "boom_right" || bomb.type === "boom_left") {
      const defaultBoom = game.createBoomBomb(bomb.row, bomb.col, bomb.type);
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
  };
  game.normalizeDuckData = function (duck) {
    return {
      row: Number.parseInt(duck.row, 10),
      col: Number.parseInt(duck.col, 10),
      direction: duck.direction === -1 ? -1 : 1
    };
  };
  game.normalizeTargetPieceData = function (piece) {
    const allowedTypes = ["rook", "bishop", "queen", "knight", "king", "pawn"];
    const pieceType = allowedTypes.includes(piece.pieceType) ? piece.pieceType : "pawn";
    return {
      row: Number.parseInt(piece.row, 10),
      col: Number.parseInt(piece.col, 10),
      pieceType,
      captured: !!piece.captured
    };
  };
  game.normalizeLaserDirections = function (directions) {
    if (!Array.isArray(directions)) return game.DEFAULT_LASER_DIRECTIONS.slice();
    const validDirections = directions.filter(direction => game.DEFAULT_LASER_DIRECTIONS.includes(direction));
    return [...new Set(validDirections)];
  };
  game.normalizeLaserFireEverySteps = function (value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return game.DEFAULT_LASER_FIRE_EVERY_STEPS;
    return Math.max(2, Math.min(99, parsed));
  };
  game.getLaserFireEverySteps = function (laser) {
    return game.normalizeLaserFireEverySteps(laser && laser.fireEverySteps);
  };
  game.normalizeLaserBlockData = function (laser) {
    return {
      row: Number.parseInt(laser.row, 10),
      col: Number.parseInt(laser.col, 10),
      directions: game.normalizeLaserDirections(laser.directions),
      fireEverySteps: game.normalizeLaserFireEverySteps(laser.fireEverySteps)
    };
  };
  game.isLaserBlockAt = function (row, col) {
    return game.laserBlocks.some(laser => laser.row === row && laser.col === col);
  };
  game.removeLaserBlockAt = function (row, col) {
    const index = game.laserBlocks.findIndex(laser => laser.row === row && laser.col === col);
    if (index !== -1) {
      game.laserBlocks.splice(index, 1);
    }
  };
  game.addLaserBlock = function (row, col, directions = game.DEFAULT_LASER_DIRECTIONS, fireEverySteps = game.DEFAULT_LASER_FIRE_EVERY_STEPS) {
    const normalizedDirections = game.normalizeLaserDirections(directions);
    const normalizedFireEverySteps = game.normalizeLaserFireEverySteps(fireEverySteps);
    const existing = game.laserBlocks.find(laser => laser.row === row && laser.col === col);
    if (existing) {
      existing.directions = normalizedDirections;
      existing.fireEverySteps = normalizedFireEverySteps;
      return;
    }
    if (!game.isLaserBlockAt(row, col)) {
      game.laserBlocks.push({
        row,
        col,
        directions: normalizedDirections,
        fireEverySteps: normalizedFireEverySteps
      });
    }
  };
  game.isLaserBlockingCell = function (row, col) {
    return game.board[row][col] === game.CELL_TYPES.SOLID_BLOCK || game.board[row][col] === game.CELL_TYPES.PHASE_BLOCK_ACTIVE || game.board[row][col] === game.CELL_TYPES.MOVING_PLATFORM;
  };
  game.isLaserActive = function (laser, moveNumber = game.levelMoveCount) {
    const fireEverySteps = game.getLaserFireEverySteps(laser);
    return moveNumber > 0 && moveNumber % fireEverySteps === 0;
  };
  game.getLaserCountdown = function (laser, moveNumber = game.levelMoveCount) {
    const fireEverySteps = game.getLaserFireEverySteps(laser);
    if (moveNumber > 0 && moveNumber % fireEverySteps === 0) {
      return 0;
    }
    return fireEverySteps - moveNumber % fireEverySteps;
  };
  game.getLaserDirections = function (laser) {
    const enabledDirections = game.normalizeLaserDirections(laser.directions);
    return game.LASER_DIRECTIONS.filter(direction => enabledDirections.includes(direction.name));
  };
  game.getLaserCellsFromBlock = function (laser) {
    const cells = [];
    for (const direction of game.getLaserDirections(laser)) {
      let row = laser.row + direction.dr;
      let col = laser.col + direction.dc;
      while (row >= 0 && row < game.ROWS && col >= 0 && col < game.COLS) {
        if (game.isLaserBlockingCell(row, col)) break;
        cells.push({
          row,
          col,
          direction: direction.name
        });
        row += direction.dr;
        col += direction.dc;
      }
    }
    return cells;
  };
  game.isCellInActiveLaser = function (row, col) {
    return game.laserBlocks.some(laser => game.isLaserActive(laser) && game.getLaserCellsFromBlock(laser).some(cell => cell.row === row && cell.col === col));
  };
  game.getMoveTraversalCells = function (fromRow, fromCol, toRow, toCol) {
    const rowDelta = toRow - fromRow;
    const colDelta = toCol - fromCol;
    const rowStep = Math.sign(rowDelta);
    const colStep = Math.sign(colDelta);
    const straightOrDiagonal = fromRow === toRow || fromCol === toCol || Math.abs(rowDelta) === Math.abs(colDelta);
    if (!straightOrDiagonal) {
      return [{
        row: toRow,
        col: toCol
      }];
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
  };
  game.getActiveLaserHitOnMove = function (player, toRow, toCol) {
    return game.getMoveTraversalCells(player.row, player.col, toRow, toCol).find(cell => game.isCellInActiveLaser(cell.row, cell.col)) || null;
  };
  game.clampPlatformLevel = function (level) {
    const parsed = Number.parseInt(level, 10);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(game.ROWS - 1, parsed));
  };
  game.rowToPlatformLevel = function (row) {
    return game.clampPlatformLevel(game.ROWS - 1 - row);
  };
  game.platformLevelToRow = function (level) {
    return game.ROWS - 1 - game.clampPlatformLevel(level);
  };
  game.clampPlatformCol = function (col) {
    const parsed = Number.parseInt(col, 10);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(game.COLS - 1, parsed));
  };
  game.normalizeMovingPlatformData = function (platform) {
    const axis = platform.axis === "horizontal" ? "horizontal" : "vertical";
    if (axis === "horizontal") {
      const currentCol = platform.currentCol !== undefined ? game.clampPlatformCol(platform.currentCol) : game.clampPlatformCol(platform.col);
      const minCol = game.clampPlatformCol(platform.minCol !== undefined ? platform.minCol : 0);
      const maxCol = game.clampPlatformCol(platform.maxCol !== undefined ? platform.maxCol : game.COLS - 1);
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
    const currentLevel = platform.currentLevel !== undefined ? game.clampPlatformLevel(platform.currentLevel) : game.rowToPlatformLevel(platform.row);
    const minLevel = game.clampPlatformLevel(platform.minLevel !== undefined ? platform.minLevel : 0);
    const maxLevel = game.clampPlatformLevel(platform.maxLevel !== undefined ? platform.maxLevel : game.ROWS - 1);
    const low = Math.min(minLevel, maxLevel);
    const high = Math.max(minLevel, maxLevel);
    return {
      row: platform.row !== undefined ? platform.row : game.platformLevelToRow(currentLevel),
      col: platform.col,
      minLevel: low,
      maxLevel: high,
      currentLevel: Math.max(low, Math.min(high, currentLevel)),
      direction: platform.direction === -1 ? -1 : 1
    };
  };
}
