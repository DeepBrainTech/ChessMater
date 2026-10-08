import { useEffect } from "react";
import PortalButton from "./components/PortalButton.jsx";
import RotateNotice from "./components/RotateNotice.jsx";
import StartScreen from "./components/StartScreen.jsx";
import GameShell from "./components/GameShell.jsx";
import GameModals from "./components/GameModals.jsx";
import GameAudio from "./components/GameAudio.jsx";
import { initializeGame } from "./game/initialize.js";
import { initPageUi } from "./page/initPageUi.js";

export default function App() {
  useEffect(() => {
    const disposeGame = initializeGame();
    const controller = new AbortController();
    let cancelled = false;
    let cleanupPageUi = null;

    (async () => {
      try {
        const cleanup = await initPageUi(controller.signal);
        if (cancelled) cleanup();
        else cleanupPageUi = cleanup;
      } catch (err) {
        if (!cancelled) console.error(err);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      if (typeof cleanupPageUi === "function") cleanupPageUi();
      disposeGame();
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
