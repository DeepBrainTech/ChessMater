export function ensurePlayerSelected(game, preferredIndex = game.selectedPlayerIndex) {
  if (game.mode !== 'play' || game.gameWon) return game.selectedPlayerIndex;
  if (preferredIndex === -1) {
    game.selectedPlayerIndex = -1;
    return -1;
  }
  game.selectedPlayerIndex = Number.isInteger(preferredIndex) && game.players[preferredIndex]
    ? preferredIndex : game.players.length ? 0 : -1;
  return game.selectedPlayerIndex;
}
