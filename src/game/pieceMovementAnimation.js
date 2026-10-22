export function interpolatePieceMove(move, progress, tile) {
  const t = Math.max(0, Math.min(1, progress));
  const eased = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  return {
    x: (move.fromCol + (move.toCol - move.fromCol) * eased) * tile,
    y: (move.fromRow + (move.toRow - move.fromRow) * eased) * tile,
  };
}

export function playerDrawPosition(game, player) {
  const animation = game.pieceMoveAnimation;
  const move = animation?.moves.find(entry => entry.player === player);
  return move ? interpolatePieceMove(move, (animation.now() - animation.started) / animation.duration, game.TILE_SIZE)
    : { x: player.col * game.TILE_SIZE, y: player.row * game.TILE_SIZE };
}

export function installPieceMovementAnimation(game, host = window) {
  let timer = null;
  game.cancelPieceMoveAnimation = () => {
    if (timer != null) game.lifecycle.clearTimeout(timer);
    timer = null;
    game.pieceMoveAnimation = null;
  };
  const start = (destinations, commit) => {
    if (game.pieceMoveAnimation) return true;
    const moves = destinations.map(({ player, row, col }) => ({ player,
      fromRow: player.row, fromCol: player.col, toRow: row, toCol: col }));
    const distance = Math.max(...moves.map(move => Math.hypot(move.toRow - move.fromRow, move.toCol - move.fromCol)));
    const duration = Math.min(400, 160 + distance * 55);
    game.pieceMoveAnimation = { moves, duration, started: host.performance.now(), now: () => host.performance.now() };
    timer = game.lifecycle.setTimeout(() => {
      timer = null; game.pieceMoveAnimation = null;
      if (!game.gameWon && moves.every(move => game.players.includes(move.player))) commit();
    }, duration);
    return true;
  };
  game.startPlayerMoveAnimation = (index, row, col) => {
    const player = game.players[index];
    return start([{ player, row, col }], () => game.movePlayer(game.players.indexOf(player), row, col, { animate: false }));
  };
  game.startCastleAnimation = (kingIndex, rookIndex) => {
    const king = game.players[kingIndex], rook = game.players[rookIndex];
    const direction = rook.col > king.col ? 1 : -1;
    return start([{ player: king, row: king.row, col: king.col + direction * 2 },
      { player: rook, row: rook.row, col: king.col + direction }],
    () => game.castleKingWithRook(game.players.indexOf(king), game.players.indexOf(rook), { animate: false }));
  };
}
