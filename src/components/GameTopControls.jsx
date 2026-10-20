import { game } from '../game/runtime.js';
import { useEffect, useState } from "react";
import { subscribeGameUi } from "../game/uiBridge.js";
import GameButton, { ButtonArtwork } from "./GameButton.jsx";

/**
 * React owns HUD text and numbers; the engine publishes updates through uiBridge.
 */
export default function GameTopControls() {
  const [undoCredits, setUndoCredits] = useState(null);
  const [antigravity, setAntigravity] = useState({ credits: 0, enabled: false, unlocked: false });
  const [guide, setGuide] = useState({ available: false, unlocked: false });
  const [hintCredits, setHintCredits] = useState(null);
  const [styleTest, setStyleTest] = useState(false);

  useEffect(() => {
    return subscribeGameUi((event) => {
      if (event.type === "undoCredits") setUndoCredits(event.undoCredits);
      if (event.type === "hintCredits") setHintCredits(event.hintCredits);
      if (event.type === "puzzleLoaded") setStyleTest(event.styleTest);
      if (event.type === "antigravity") {
        setAntigravity({ credits: event.antigravityCredits, enabled: event.antigravityEnabled, unlocked: event.antigravityUnlockedThisRun });
      }
      if (event.type === "fewestOtherMoves") setGuide({ available: Number.isFinite(event.bestMoves), unlocked: !!event.hintUnlockedThisRun });
    });
  }, []);

  const guideTitle = !guide.available ? "Hint — No guide available for this level"
    : guide.unlocked ? "Hint — Free views and retries until you leave this level" : "Hint — Use 1 Hint for unlimited views and retries until you leave this level";

  return (
    <div id="gameTopRightControls">
      <div className="game-primary-actions">
        <GameButton id="antigravityToggle" label="Anti-Gravity" color="purple" icon="antigravity"
          quantity={antigravity.unlocked ? (antigravity.enabled ? "ON" : "OFF") : `x${antigravity.credits}`}
          pressed={antigravity.enabled} disabled={styleTest} onClick={() => game.toggleAntigravity?.()} />
        <GameButton id="blockTipToggle" label="Hint" color="gold" icon="hint" title={guideTitle} ariaLabel={guideTitle}
          quantity={guide.unlocked ? <span className="hint-view-label">View</span> : `x${hintCredits ?? "—"}`} />
        <GameButton id="undoMoveBtn" label="Undo" color="blue" icon="undo" quantity={`x${undoCredits ?? 0}`} disabled={styleTest} />
      </div>
      <div className="game-utility-actions">
        <button id="restartLevelBtn" className="game-utility-action" type="button" title="Restart level" aria-label="Restart level">
          <ButtonArtwork utility />
          <span className="game-utility-icon game-utility-icon--restart" aria-hidden="true" />
        </button>
        <button id="musicToggle" className="game-utility-action" type="button" title="Mute music" aria-label="Mute music" aria-pressed="false">
          <ButtonArtwork utility />
          <span className="game-utility-icon game-utility-icon--music" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
