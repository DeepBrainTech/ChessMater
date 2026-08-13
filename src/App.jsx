import { useEffect } from "react";
import PortalButton from "./components/PortalButton.jsx";
import RotateNotice from "./components/RotateNotice.jsx";
import StartScreen from "./components/StartScreen.jsx";
import GameShell from "./components/GameShell.jsx";
import GameModals from "./components/GameModals.jsx";
import GameAudio from "./components/GameAudio.jsx";
import { loadLegacyGameScripts } from "./boot/loadLegacyGameScripts.js";
import { installGameUiBridge } from "./game/uiBridge.js";
import { initPageUi } from "./page/initPageUi.js";

export default function App() {
  useEffect(() => {
    installGameUiBridge();
    let cancelled = false;
    let cleanupPageUi = null;

    (async () => {
      try {
        await loadLegacyGameScripts();
        if (cancelled) return;
        cleanupPageUi = await initPageUi();
      } catch (err) {
        if (!cancelled) console.error(err);
      }
    })();

    return () => {
      cancelled = true;
      if (typeof cleanupPageUi === "function") cleanupPageUi();
    };
  }, []);

  return (
    <>
      <PortalButton />
      <RotateNotice />
      <StartScreen />
      <GameModals />
      <GameShell />
      <GameAudio />
    </>
  );
}
