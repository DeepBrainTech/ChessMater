import ReplayStepNav from "./ReplayStepNav.jsx";
import { ButtonArtwork } from "../GameButton.jsx";
import { CompletionIcon } from "./LevelCompleteModal.jsx";

export default function InGameWalkthroughModal() {
  return (
    <div id="inGameWalkthroughModal" className="leaderboard-modal" aria-hidden="true">
      <div className="level-complete-content" role="dialog" aria-modal="true" aria-label="Hint walkthrough">
       <div className="level-complete-inner">
        <div className="level-complete-header">
          <button
            type="button"
            className="level-complete-close"
            id="closeInGameWalkthroughModal"
            aria-label="Close walkthrough"
          >
            <ButtonArtwork utility />
            <CompletionIcon name="close" />
          </button>
        </div>
        <div className="level-complete-stats">
          <div className="level-complete-stat"><span>Your Moves</span><strong>-</strong></div>
          <div className="level-complete-stat"><span>Other’s Best</span><strong id="inGameWalkthroughBestMoves">--</strong></div>
        </div>
        <div className="level-complete-replay" id="inGameWalkthroughPanel">
          <p className="level-complete-replay-title" id="inGameWalkthroughTitle">
            Best Route By <span id="inGameWalkthroughAuthor">--</span>
          </p>
          <p className="level-complete-replay-subtitle" id="inGameWalkthroughSubtitle"></p>
          <div className="level-complete-replay-canvas-wrap">
           <div className="hint-empty-state" role="status">
             <strong id="inGameWalkthroughEmptyTitle">No other player has completed this level yet.</strong>
             <p>No Hint was used. Check back later for a guide.</p>
           </div>
           <div className="level-complete-replay-board">
            <canvas
              id="inGameWalkthroughCanvas"
              width="1270"
              height="794"
              aria-label="Walkthrough mini board"
            ></canvas>
           </div>
          </div>
          <p className="level-complete-replay-hint level-complete-announcement" id="inGameWalkthroughHint">
            ←/→ step · ↑ first · ↓ last · Scroll up/down to step
          </p>
          <p className="level-complete-replay-event" id="inGameWalkthroughEvent" role="status"></p>
          <div className="level-complete-replay-controls">
          <p className="level-complete-replay-step" id="inGameWalkthroughStep" data-step-label="Step">
            Step: -- / --
          </p>
          <ReplayStepNav id="inGameReplayStepNav" ariaLabel="Walkthrough step controls" variant="inline" />
          </div>
        </div>
        <div className="level-complete-actions">
          <button type="button" id="inGameWalkthroughCloseBtn">
            Retry
          </button>
        </div>
       </div>
      </div>
    </div>
  );
}
