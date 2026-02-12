import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Serve all your static files (HTML, JS, images, sounds, etc.) from public directory
app.use(express.static(path.join(__dirname, "public")));

// Default route (so index.html opens automatically)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`✅ ChessMater is running on port ${PORT}`);
});
