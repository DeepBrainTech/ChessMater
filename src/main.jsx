import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles/app.css";
import { bootstrapAuth } from "./boot/authBootstrap.js";

bootstrapAuth();

// Avoid StrictMode double-mount in dev: legacy game.js initializes once on load.
createRoot(document.getElementById("root")).render(<App />);
