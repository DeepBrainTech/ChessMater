import { register as registerRules } from '../../game/engine/rules.js';

// Run the real movement rules on a separate board, never on the player's game.
export function createGuideRules(player, platforms = [], goal = null) {
  const CELL_TYPES = { EMPTY: 0, SOLID_BLOCK: 1, GOAL: 3, TRANSFORMER: 6, BOMB: 99, BLACK_TARGET_PIECE: 100, MOVING_PLATFORM: 101 };
  const board = Array.from({ length: 4 }, (_, row) => Array.from({ length: 5 }, (_, col) =>
    platforms.includes(row * 5 + col) ? CELL_TYPES.SOLID_BLOCK : goal === row * 5 + col ? CELL_TYPES.GOAL : CELL_TYPES.EMPTY));
  const context = { ROWS: 4, COLS: 5, CELL_TYPES, board, players: [player],
    getDuckAt: () => -1, isPhaseCell: () => false };
  registerRules(context);
  // These demonstration boards have no objectives or captured targets.
  context.areAllObjectivesCompleted = () => true;
  return context;
}

export function guideMoves(player, platforms, goal) {
  const rules = createGuideRules(player, platforms, goal);
  return Array.from({ length: 20 }, (_, index) => index)
    .filter(index => rules.isValidMove(0, Math.floor(index / 5), index % 5));
}

export function guideLanding(player, platforms, goal) {
  const rules = createGuideRules(player, platforms, goal);
  return { ...player, row: rules.findFallPosition(player.row, player.col) };
}

export function guideRising(player, platforms = [], goal = null) {
  let row = player.row;
  while (row > 0 && !platforms.includes((row - 1) * 5 + player.col) && (row - 1) * 5 + player.col !== goal) row--;
  return { ...player, row };
}

export function guideScene(pieceType, page) {
  const player = { pieceType, row: page === 1 ? 1 : 2, col: page === 1 ? 1 : 2, hasMoved: false };
  const platforms = [15, 16, 17, 18, 19];
  if (page === 1) platforms.push(11);
  const goal = page !== 3 ? null : { king: 13, queen: 14, rook: 14, bishop: 8, knight: 3, pawn: 8 }[pieceType];
  // Keep the target supported while giving every piece a legal route to it.
  if (goal != null && goal < 10) platforms.push(goal + 5);
  const moves = guideMoves(player, platforms, goal);
  return { player, platforms, goal, destination: page === 3 ? goal : moves[0] };
}
