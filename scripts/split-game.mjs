import fs from "node:fs";
import path from "node:path";

const snapshot = fs.readFileSync("public/js/game.monolith.js", "utf8");
const sections = [...snapshot.matchAll(/\/\/ BEGIN GAME PART: ([a-zA-Z0-9-]+\.js)\r?\n([\s\S]*?)\r?\n\/\/ END GAME PART: \1/g)];
if (sections.length !== 9 || new Set(sections.map(section => section[1])).size !== 9) {
  throw new Error("Snapshot is missing the current nine game parts; run concat-game.mjs first.");
}
const output = path.resolve("public/js/game");
for (const [, filename, content] of sections) {
  const target = path.resolve(output, filename);
  if (path.dirname(target) !== output) throw new Error("Invalid game part filename");
  fs.writeFileSync(target, content, "utf8");
}
await import("./concat-game.mjs");
