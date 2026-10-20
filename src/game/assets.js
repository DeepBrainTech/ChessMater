/**
 * Central asset URLs for ChessMater.
 *
 * Put design files under public/assets/, then point paths here.
 *
 * Folder map:
 *   public/assets/images/pieces/  → chess piece + goal/bomb sprites
 *   public/assets/images/blocks/  → solid / phase / teleporter / objective tiles
 *   public/assets/images/ui/      → HUD icons
 *   public/assets/images/fx/      → particles / VFX
 *   public/assets/audio/music/    → background loops
 *   public/assets/audio/sfx/      → move / explode / win sounds
 *   public/assets/fonts/          → custom UI fonts
 */
export const assets = {
  pieces: {
    rook: "/assets/images/game/piece-rook.svg",
    castle_rook: "/assets/images/game/piece-rook.svg",
    bishop: "/assets/images/game/piece-bishop.svg",
    queen: "/assets/images/game/piece-queen.svg",
    knight: "/assets/images/game/piece-knight.svg",
    king: "/assets/images/game/piece-king.svg",
    pawn: "/assets/images/game/piece-pawn.svg",
    boom_right:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='40' fill='black'/%3E%3Ccircle cx='35' cy='40' r='5' fill='white'/%3E%3Ccircle cx='45' cy='35' r='3' fill='white'/%3E%3Cpath d='M60,30 L75,25 L70,40 Z' fill='red'/%3E%3C/svg%3E",
    boom_left:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='40' fill='black'/%3E%3Ccircle cx='35' cy='40' r='5' fill='white'/%3E%3Ccircle cx='45' cy='35' r='3' fill='white'/%3E%3Cpath d='M60,30 L75,25 L70,40 Z' fill='red'/%3E%3C/svg%3E",
    target: "/assets/images/game/piece-dark-king.svg",
    bomb:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='40' fill='black'/%3E%3Ccircle cx='35' cy='40' r='5' fill='white'/%3E%3Ccircle cx='45' cy='35' r='3' fill='white'/%3E%3Cpath d='M60,30 L75,25 L70,40 Z' fill='red'/%3E%3C/svg%3E",
  },
  targetPieces: {
    rook: "/assets/images/game/piece-rook.svg",
    bishop: "/assets/images/game/piece-bishop.svg",
    queen: "/assets/images/game/piece-queen.svg",
    knight: "/assets/images/game/piece-knight.svg",
    king: "/assets/images/game/piece-dark-king.svg",
    pawn: "/assets/images/game/piece-pawn.svg",
  },
  ui: {
    coin: "/assets/images/coin.svg",
    diamond: "/assets/images/diamond.svg",
    flower: "/assets/images/flower.svg",
  },
  tiles: {
    light: "/assets/images/game/tile-light.webp",
    dark: "/assets/images/game/tile-dark.webp",
    blockOpen: "/assets/images/game/tile-block-open.webp",
    swap: "/assets/images/game/tile-swap-a.webp",
    swapActive: "/assets/images/game/tile-swap-b.webp",
    direction: "/assets/images/game/tile-direction.webp",
    checkpoint: "/assets/images/game/tile-checkpoint.webp",
    bomb: "/assets/images/game/tile-bomb.webp",
  },
  audio: {
    music: "/assets/audio/background1.mp3",
    move: "/assets/audio/thump.mp3",
    explode: "/assets/audio/explosion.mp3",
    win: "/assets/audio/completion.mp3",
  },
  blocks: {},
};
