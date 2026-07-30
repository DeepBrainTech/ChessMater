import ReplayStepNav from "./ReplayStepNav.jsx";

export default function InGameWalkthroughModal() {
  return (
    <div id="inGameWalkthroughModal" className="leaderboard-modal" aria-hidden="true">
      <div className="leaderboard-content level-complete-content">
        <div className="leaderboard-header">
          <h2>Walkthrough</h2>
          <button
            type="button"
            className="close-leaderboard"
            id="closeInGameWalkthroughModal"
            aria-label="Close walkthrough"
          >
            &times;
          </button>
        </div>
        <div className="level-complete-replay" id="inGameWalkthroughPanel">
          <p className="level-complete-replay-title" id="inGameWalkthroughTitle">
            Best route
          </p>
          <p className="level-complete-replay-subtitle" id="inGameWalkthroughSubtitle"></p>
          <div className="level-complete-replay-canvas-wrap">
            <canvas
              id="inGameWalkthroughCanvas"
              width="320"
              height="220"
              aria-label="Walkthrough mini board"
            ></canvas>
          </div>
          <p className="level-complete-replay-hint" id="inGameWalkthroughHint">
            ←/→ step · ↑ first · ↓ last (keys or buttons below)
          </p>
          <p className="level-complete-replay-step" id="inGameWalkthroughStep">
            Step: --/--
          </p>
          <ReplayStepNav id="inGameReplayStepNav" ariaLabel="Walkthrough step controls" />
          <p className="level-complete-replay-event" id="inGameWalkthroughEvent"></p>
        </div>
        <div className="level-complete-actions">
          <button type="button" id="inGameWalkthroughCloseBtn">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
