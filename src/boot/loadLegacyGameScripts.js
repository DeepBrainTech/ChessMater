/**
 * Loads classic game engine parts + levels after React mounts required DOM ids.
 * Page UI is initialized from React modules (src/page), not page-ui.js.
 */

import { GAME_SCRIPT_PARTS } from "./gameScriptManifest.js";

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-cm-legacy="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "1") resolve();
      else existing.addEventListener("load", () => resolve(), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.dataset.cmLegacy = src;
    script.onload = () => {
      script.dataset.loaded = "1";
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(script);
  });
}

let loadPromise = null;

export function loadLegacyGameScripts() {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    if (!window.__cmGamePartsLoaded) {
      for (const src of GAME_SCRIPT_PARTS) {
        await loadScript(src);
      }
      window.__cmGamePartsLoaded = true;
    }
    await loadScript("/js/levels.js");
  })();
  return loadPromise;
}
