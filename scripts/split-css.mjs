import fs from "fs";

const raw = fs.readFileSync("src/styles/app.css", "utf8");
const lines = raw.split(/\r?\n/).map((l) => l.replace(/^ {4}/, ""));
const css = lines.join("\n");
const arr = css.split("\n");

function findLine(pred) {
  const i = arr.findIndex(pred);
  if (i < 0) throw new Error("marker not found: " + pred.toString());
  return i;
}

const keys = [
  ["base.css", 0],
  ["confetti.css", findLine((l) => l.includes(".confetti-container"))],
  ["levels.css", findLine((l) => l.includes(".level-selector"))],
  ["portal.css", findLine((l) => l.includes(".portal-button") && l.trim().startsWith(".portal-button"))],
  [
    "start-screen.css",
    findLine((l) => /^\.start-screen\s*\{/.test(l.trim())),
  ],
  ["modals-shared.css", findLine((l) => l.includes("html.modal-scroll-lock"))],
  [
    "leaderboard.css",
    findLine((l) => /^\.leaderboard-modal\s*\{/.test(l.trim())),
  ],
  [
    "exchange.css",
    findLine((l) => /^\.undo-exchange-modal\s*\{/.test(l.trim())),
  ],
  ["hint.css", findLine((l) => /^\.block-tip-modal\s*\{/.test(l.trim()))],
  ["layout.css", findLine((l) => l.includes("#gameLayoutRow"))],
  ["mobile.css", findLine((l) => l.includes("MOBILE LAYOUT"))],
];

fs.mkdirSync("src/styles", { recursive: true });

for (let i = 0; i < keys.length; i++) {
  const [name, start] = keys[i];
  const end = i + 1 < keys.length ? keys[i + 1][1] : arr.length;
  const body = arr.slice(start, end).join("\n").trim() + "\n";
  fs.writeFileSync("src/styles/" + name, "/* " + name + " */\n" + body);
  console.log("wrote", name, "lines", end - start);
}

const imports = keys.map(([n]) => `@import "./${n}";`).join("\n") + "\n";
fs.writeFileSync("src/styles/app.css", imports);
console.log("app.css -> imports only");
