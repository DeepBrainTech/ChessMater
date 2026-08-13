import fs from "fs";
import path from "path";

const monolithPath = "public/js/game.monolith.js";
if (!fs.existsSync(monolithPath)) {
  throw new Error("Missing public/js/game.monolith.js (expected main's game.js copy)");
}

const src = fs.readFileSync(monolithPath, "utf8");
const lines = src.split(/\r?\n/);

/** 1-based inclusive ranges for classic shared-global parts (main fog/laser version). */
const parts = [
  {
    file: "01-state.js",
    start: 1,
    end: 259,
    banner: "DOM refs, constants, images, mutable game state",
  },
  {
    file: "02-api-shop-exchange.js",
    start: 260,
    end: 1125,
    banner: "API/credits/shop/exchange modal defs (setup calls deferred)",
  },
  {
    file: "03-audio-canvas-hud-replay.js",
    start: 1138,
    end: 2757,
    banner: "Audio, HUD, replay, objectives, lasers/platforms helpers",
  },
  {
    file: "04-level-rules.js",
    start: 2758,
    end: 4121,
    banner: "loadPuzzle, gravity, moves, win, undo, teleport, transformer",
  },
  {
    file: "05-vision-render.js",
    start: 4122,
    end: 4830,
    banner: "Valid moves, vision/fog, drawBoard",
  },
  {
    file: "06-effects-bombs.js",
    start: 4831,
    end: 5646,
    banner: "Confetti, bombs, ducks, platforms, lasers collisions",
  },
  {
    file: "07-input-loop.js",
    start: 5647,
    end: lines.length,
    banner: "Input, antigravity, restart, game loop, boot",
  },
];

const deferredSetup = `
// Deferred from monolith ~1127-1135 (must run after openHintModal / setupReplayStepNav exist).
setupAntigravityExchangeModal();
setupReplayExchangeModal();
setupInGameWalkthrough();
setupReplayStepNav();
setupHintModal();
window.openAntigravityExchangeModal = openAntigravityExchangeModal;
window.openReplayExchangeModal = openReplayExchangeModal;
window.handleSolutionGuideAction = handleSolutionGuideAction;
window.openInGameWalkthroughModal = openInGameWalkthroughModal;
window.openHintModal = openHintModal;
`;

const outDir = "public/js/game";
fs.mkdirSync(outDir, { recursive: true });

const manifest = [];
const concatChunks = [];

for (const part of parts) {
  const slice = lines.slice(part.start - 1, part.end);
  let body =
    `/**\n * game/${part.file}\n * ${part.banner}\n * Split from game.monolith.js lines ${part.start}-${part.end}.\n */\n` +
    slice.join("\n").replace(/\n+$/, "") +
    "\n";

  if (part.file === "03-audio-canvas-hud-replay.js") {
    body = body.replace(/\n+$/, "") + "\n" + deferredSetup + "\n";
  }

  const dest = path.join(outDir, part.file);
  fs.writeFileSync(dest, body);
  const url = "/js/game/" + part.file;
  manifest.push(url);
  concatChunks.push(body);
  console.log("wrote", dest, "lines", part.end - part.start + 1);
}

// Keep existing 00-assets-config.js if present; ensure it's first in manifest.
const assetsFile = "00-assets-config.js";
const assetsPath = path.join(outDir, assetsFile);
if (!fs.existsSync(assetsPath)) {
  throw new Error("Expected " + assetsPath);
}
const fullManifest = ["/js/game/" + assetsFile, ...manifest];

fs.writeFileSync(
  path.join(outDir, "manifest.json"),
  JSON.stringify({ scripts: fullManifest }, null, 2) + "\n"
);

const assetsBody = fs.readFileSync(assetsPath, "utf8");
const generated =
  "/** GENERATED FILE — edit public/js/game/*.js then run: node scripts/concat-game.mjs */\n\n" +
  assetsBody +
  "\n" +
  concatChunks.join("\n");
fs.writeFileSync("public/js/game.js", generated);

fs.writeFileSync(
  "src/boot/gameScriptManifest.js",
  `/** Classic game script parts (shared global scope). Source: public/js/game/ */\nexport const GAME_SCRIPT_PARTS = ${JSON.stringify(
    fullManifest,
    null,
    2
  )};\n`
);

console.log("updated game.js concat + manifest (", fullManifest.length, "scripts)");
