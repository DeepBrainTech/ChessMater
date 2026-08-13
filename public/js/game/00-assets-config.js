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
window.CM_ASSETS = {
  pieces: {
    rook: "https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg",
    castle_rook: "https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg",
    bishop: "https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg",
    queen: "https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg",
    knight: "https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg",
    king: "https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg",
    pawn: "https://upload.wikimedia.org/wikipedia/commons/4/45/Chess_plt45.svg",
    boom_right:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='40' fill='black'/%3E%3Ccircle cx='35' cy='40' r='5' fill='white'/%3E%3Ccircle cx='45' cy='35' r='3' fill='white'/%3E%3Cpath d='M60,30 L75,25 L70,40 Z' fill='red'/%3E%3C/svg%3E",
    boom_left:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='40' fill='black'/%3E%3Ccircle cx='35' cy='40' r='5' fill='white'/%3E%3Ccircle cx='45' cy='35' r='3' fill='white'/%3E%3Cpath d='M60,30 L75,25 L70,40 Z' fill='red'/%3E%3C/svg%3E",
    target: "https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg",
    bomb:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='40' fill='black'/%3E%3Ccircle cx='35' cy='40' r='5' fill='white'/%3E%3Ccircle cx='45' cy='35' r='3' fill='white'/%3E%3Cpath d='M60,30 L75,25 L70,40 Z' fill='red'/%3E%3C/svg%3E",
  },
  targetPieces: {
    rook: "https://upload.wikimedia.org/wikipedia/commons/f/ff/Chess_rdt45.svg",
    bishop: "https://upload.wikimedia.org/wikipedia/commons/9/98/Chess_bdt45.svg",
    queen: "https://upload.wikimedia.org/wikipedia/commons/4/47/Chess_qdt45.svg",
    knight: "https://upload.wikimedia.org/wikipedia/commons/e/ef/Chess_ndt45.svg",
    king: "https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg",
    pawn: "https://upload.wikimedia.org/wikipedia/commons/c/c7/Chess_pdt45.svg",
  },
  ui: {
    coin: "/assets/images/coin.svg",
    diamond: "/assets/images/diamond.svg",
    flower: "/assets/images/flower.svg",
  },
  audio: {
    music: "/assets/audio/background1.mp3",
    move: "/assets/audio/thump.mp3",
    explode: "/assets/audio/explosion.mp3",
    win: "/assets/audio/completion.mp3",
  },
  blocks: {},
};
