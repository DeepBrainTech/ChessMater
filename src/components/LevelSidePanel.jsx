import { useEffect, useState } from "react";
import { subscribeGameUi } from "../game/uiBridge.js";
import { game } from "../game/runtime.js";
import { styleTestLevel } from "../game/styleTestLevel.js";

export default function LevelSidePanel({ children }) {
  const [players, setPlayers] = useState(0);
  const [objectives, setObjectives] = useState({ completed: 0, total: 0 });
  const [targets, setTargets] = useState({ captured: 0, total: 0 });
  const [moves, setMoves] = useState(0);
  const [best, setBest] = useState(null);
  const [styleTest, setStyleTest] = useState(false);
  const [levelTip, setLevelTip] = useState(() => String(game.currentPuzzleData?.blockTip ?? "").trim());

  useEffect(() => {
    return subscribeGameUi((event) => {
      if (event.type === "playerCount") setPlayers(event.count);
      if (event.type === "puzzleLoaded") {
        setStyleTest(event.styleTest);
        setLevelTip(event.blockTip || "");
      }
      if (event.type === "moveCount") setMoves(event.levelMoveCount);
      if (event.type === "fewestOtherMoves") setBest(Number.isFinite(event.bestMoves) ? event.bestMoves : null);
      if (event.type === "objectiveCount") {
        setObjectives({
          completed: event.completed,
          total: event.totalObjectives,
        });
      }
      if (event.type === "targetPieceCount") {
        setTargets({
          captured: event.captured,
          total: event.totalTargetPieces,
        });
      }
    });
  }, []);

  return (
    <>
      <aside id="gameSidePanel">
        <section className="game-stats" aria-label="Level statistics">
          <div className="game-stats-inner">
            <span className="game-stats-shield" aria-hidden="true" />
            <div className="game-move-stats">
              <div id="moveCount" className="game-move-stat">
                <span>Your Moves</span><strong>{String(moves).padStart(2, "0")}</strong>
              </div>
              <div id="fewestOtherMoves" className="game-move-stat">
                <span>Others’ Best</span><strong>{best == null ? "--" : String(best).padStart(2, "0")}</strong>
              </div>
            </div>
            <div id="blockTipStats">
              <div className="player-count" id="playerCount">
                <span>Players:</span><strong>{String(players).padStart(2, "0")}</strong>
              </div>
              <div className="objective-count" id="objectiveCount">
                <span>Objectives:</span><strong>{objectives.completed}/{objectives.total}</strong>
              </div>
              <div className="objective-count" id="targetPieceCount">
                <span>Target Pieces:</span><strong>{targets.captured}/{targets.total}</strong>
              </div>
            </div>
          </div>
        </section>
        {!styleTest && levelTip && (
          <section className="game-level-tips" aria-labelledby="gameLevelTipsHeading">
            <div className="game-level-tips-card">
              <h2 id="gameLevelTipsHeading">
                <span className="game-level-tips-icon" aria-hidden="true" />
                Level Tips
              </h2>
              <p aria-live="polite">{levelTip}</p>
            </div>
          </section>
        )}
        {children}
      </aside>
      <section className="level-selector" aria-label="Level progress">
        <div className="level-grid" id="levelGrid" tabIndex={0} aria-label="关卡选择，可左右滑动"></div>
        <button
          id="styleTestLevelButton"
          className={`level-button level-style-test-button${styleTest ? " current-level" : ""}`}
          type="button"
          title="Test · 全元素样式预览"
          aria-label="打开 Test 全元素样式预览关卡"
          aria-pressed={styleTest}
          onClick={() => game.loadPuzzle?.(styleTestLevel)}
        >Test</button>
      </section>
    </>
  );
}
