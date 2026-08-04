import fs from "fs";
import path from "path";

const outDir = "public/js/game";
const parts = [
  "00-assets-config.js",
  "01-state.js",
  "02-api-shop-exchange.js",
  "03-audio-canvas-hud-replay.js",
  "04-level-rules.js",
  "05-vision-render.js",
  "06-effects-bombs.js",
  "07-input-loop.js",
];

const chunks = parts.map((f) => fs.readFileSync(path.join(outDir, f), "utf8"));
const generated =
  "/** GENERATED FILE — edit public/js/game/*.js then run: node scripts/concat-game.mjs */\n\n" +
  chunks.join("\n");
fs.writeFileSync("public/js/game.js", generated);

const manifest = parts.map((f) => "/js/game/" + f);
fs.writeFileSync(
  path.join(outDir, "manifest.json"),
  JSON.stringify({ scripts: manifest }, null, 2) + "\n"
);
fs.writeFileSync(
  "src/boot/gameScriptManifest.js",
  `/** Classic game script parts (shared global scope). Source: public/js/game/ */\nexport const GAME_SCRIPT_PARTS = ${JSON.stringify(
    manifest,
    null,
    2
  )};\n`
);
console.log("concatenated", parts.length, "parts → public/js/game.js");
