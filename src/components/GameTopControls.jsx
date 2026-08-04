import { useEffect, useState } from "react";
import { subscribeGameUi } from "../game/uiBridge.js";

/**
 * HUD controls — keeps stable DOM ids for the classic engine while mirroring
 * credit/move updates from the uiBridge for React-friendly future work.
 */
export default function GameTopControls() {
  const [undoCredits, setUndoCredits] = useState(null);
  const [antigravityLabel, setAntigravityLabel] = useState(null);
  const [moveCount, setMoveCount] = useState(null);
  const [fewest, setFewest] = useState(null);

  useEffect(() => {
    return subscribeGameUi((event) => {
      if (event.type === "undoCredits") setUndoCredits(event.undoCredits);
      if (event.type === "antigravity") {
        const state = event.antigravityEnabled ? "ON" : "OFF";
        setAntigravityLabel(
          event.antigravityUnlockedThisRun
            ? `Antigravity ${state}`
            : `Antigravity(${event.antigravityCredits})`
        );
      }
      if (event.type === "moveCount") setMoveCount(event.levelMoveCount);
      if (event.type === "fewestOtherMoves") {
        setFewest(
          Number.isFinite(event.bestMoves) ? event.bestMoves : null
        );
      }
    });
  }, []);

  return (
    <div id="gameTopRightControls">
      <div className="controls-left">
        <div className="top-stats">
          <div className="move-count" id="moveCount">
            Your move: {moveCount ?? 0}
          </div>
          <div className="fewest-other-moves" id="fewestOtherMoves">
            Others&apos; best: {fewest == null ? "--" : fewest}
          </div>
        </div>
        <button id="undoMoveBtn" type="button">
          Undo({undoCredits ?? 0})
        </button>
        <button id="restartLevelBtn" type="button">
          Restart Level
        </button>
        <button
          id="antigravityToggle"
          type="button"
          onClick={() => {
            if (typeof window.toggleAntigravity === "function") {
              window.toggleAntigravity();
            }
          }}
        >
          {antigravityLabel ?? "Antigravity(0)"}
        </button>
      </div>
      <div className="controls-right">
        <button type="button" id="blockTipToggle">
          Hint
        </button>
        <button id="musicToggle" type="button">
          Music
        </button>
      </div>
    </div>
  );
}
