import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles/app.css";
import { bootstrapAuth } from "./boot/authBootstrap.js";

bootstrapAuth();

createRoot(document.getElementById("root")).render(<App />);
