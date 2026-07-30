import fs from "fs";
import path from "path";

const monolithPath = "public/js/game.monolith.js";
const livePath = "public/js/game.js";

// Prefer existing monolith backup; otherwise current game.js if it still looks like the monolith.
let src;
if (fs.existsSync(monolithPath)) {
  src = fs.readFileSync(monolithPath, "utf8");
} else {
  src = fs.readFileSync(livePath, "utf8");
  if (src.length < 50000) {
    throw new Error("game.js looks already split; restore game.monolith.js first");
  }
  fs.copyFileSync(livePath, monolithPath);
  console.log("backed up monolith to", monolithPath);
}

const lines = src.split(/\r?\n/);

const parts = [
  {
    file: "01-state.js",
    start: 1,
    end: 161,
    banner: "DOM refs, constants, images, mutable game state",
  },
  {
    file: "02-api-shop-exchange.js",
    start: 162,
    end: 1027,
    banner:
      "API auth, credits, portal shop, exchange modal defs (setup*() calls deferred — no cross-file hoist)",
  },
  {
    file: "03-audio-canvas-hud-replay.js",
    start: 1039,
    end: 1950,
    banner: "Audio, canvas, HUD, replay, objectives + deferred setup*() from former lines 1029-1038",
  },
  {
    file: "04-level-rules.js",
    start: 1951,
    end: 3060,
    banner: "loadPuzzle, gravity, moves, win, undo, teleport, transformer",
  },
  {
    file: "05-vision-render.js",
    start: 3061,
    end: 3757,
    banner: "Valid moves, vision/fog, drawCellContent, drawBoard",
  },
  {
    file: "06-effects-bombs.js",
    start: 3758,
    end: 4203,
    banner: "Confetti, explosions, bombs",
  },
  {
    file: "07-input-loop.js",
    start: 4204,
    end: lines.length,
    banner: "Input, antigravity, restart, game loop, modal scroll lock, boot",
  },
];

const outDir = "public/js/game";
fs.mkdirSync(outDir, { recursive: true });

const manifest = [];
const concatChunks = [];

for (const part of parts) {
  const slice = lines.slice(part.start - 1, part.end);
  const body =
    `/**\n * game/${part.file}\n * ${part.banner}\n * Split from game.js lines ${part.start}-${part.end} — logic unchanged.\n */\n` +
    slice.join("\n").replace(/\n+$/, "") +
    "\n";
  const dest = path.join(outDir, part.file);
  fs.writeFileSync(dest, body);
  const url = "/js/game/" + part.file;
  manifest.push(url);
  concatChunks.push(body);
  console.log("wrote", dest, "lines", part.end - part.start + 1);
}

fs.writeFileSync(
  path.join(outDir, "manifest.json"),
  JSON.stringify({ scripts: manifest }, null, 2) + "\n"
);

// Generated single-file bundle for any leftover <script src="js/game.js"> consumers.
const generated =
  "/** GENERATED FILE — edit public/js/game/*.js then run: node scripts/split-game.mjs */\n" +
  concatChunks.join("\n");
fs.writeFileSync(livePath, generated);

fs.writeFileSync(
  "src/boot/gameScriptManifest.js",
  `/** Classic game script parts (shared global scope). Source: public/js/game/ */\nexport const GAME_SCRIPT_PARTS = ${JSON.stringify(
    manifest,
    null,
    2
  )};\n`
);

console.log("updated public/js/game.js (concat) + src/boot/gameScriptManifest.js");
