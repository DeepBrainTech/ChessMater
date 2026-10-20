import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ["VITE_", "PORTAL_"]);
  const browserUrls = {
    VITE_PORTAL_API_BASE_URL: env.VITE_PORTAL_API_BASE_URL || env.PORTAL_API_URL,
    VITE_PORTAL_URL: env.VITE_PORTAL_URL || env.PORTAL_URL,
  };
  return {
    define: Object.fromEntries(Object.entries(browserUrls)
      .filter(([, value]) => value)
      .map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)])),
    plugins: [react()],
    publicDir: "public",
    build: {
      outDir: "dist",
      emptyOutDir: true,
      rollupOptions: {
        input: {
          game: fileURLToPath(new URL("./index.html", import.meta.url)),
          editor: fileURLToPath(new URL("./editor.html", import.meta.url)),
        },
      },
    },
    server: {
      port: 5173,
    },
  };
});
