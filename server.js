import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const distDir = path.join(__dirname, "dist");
const publicDir = path.join(__dirname, "public");
const hasDist = fs.existsSync(path.join(distDir, "index.html"));

// Prefer Vite production build; fall back to public/ for legacy assets / editor.
if (hasDist) {
  app.use(express.static(distDir));
} else {
  console.warn(
    "⚠️  dist/ missing — run `npm run build`. Serving public/ only (legacy HTML if present)."
  );
}
app.use(express.static(publicDir));

app.get("/", (req, res) => {
  if (hasDist) {
    res.sendFile(path.join(distDir, "index.html"));
    return;
  }
  const legacy = path.join(publicDir, "index.legacy.html");
  if (fs.existsSync(legacy)) {
    res.sendFile(legacy);
    return;
  }
  res.status(503).send("Frontend not built. Run npm run build (or npm run dev).");
});

// SPA fallback for client routes (keep /editor.html and static files as-is)
app.get("*", (req, res, next) => {
  if (req.path.includes(".")) return next();
  if (hasDist) {
    res.sendFile(path.join(distDir, "index.html"));
    return;
  }
  next();
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`✅ ChessMater is running on port ${PORT}`);
  console.log(hasDist ? `   Serving Vite build from dist/` : `   Serving public/ (no dist yet)`);
});
