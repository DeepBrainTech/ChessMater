// Explicit shared state for the single board mounted on this page.
// Feature modules receive this object instead of reading browser globals.
export let game = {};

export function resetGameRuntime() {
  game = {};
  return game;
}
