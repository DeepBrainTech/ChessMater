import ReplayStepNav from "./ReplayStepNav.jsx";

export default function LevelCompleteModal() {
  return (
    <div id="levelCompleteModal" className="leaderboard-modal">
      <div className="leaderboard-content level-complete-content">
        <div className="leaderboard-header">
          <h2>Level Complete</h2>
          <button className="close-leaderboard" id="closeLevelCompleteModal" type="button">
            &times;
          </button>
        </div>
        <p id="levelCompleteText">Great job!</p>
        <div className="level-complete-stats">
          <div id="levelCompleteMoveCount">Your move: 0</div>
          <div id="levelCompleteFewestOtherMoves">Others&apos; best: --</div>
        </div>
        <p id="levelCompleteAchievement" className="level-complete-achievement"></p>
        <div className="level-complete-replay" id="levelCompleteReplayPanel">
          <p className="level-complete-replay-title" id="levelCompleteReplayTitle">
            Fewest move by other user walkthrough
          </p>
          <p className="level-complete-replay-subtitle" id="levelCompleteReplaySubtitle"></p>
          <div className="level-complete-replay-canvas-wrap">
            <canvas
              id="levelCompleteReplayCanvas"
              width="320"
              height="220"
              aria-label="Replay mini board"
            ></canvas>
            <div className="level-complete-replay-lock" id="levelCompleteReplayLock">
              <div className="level-complete-replay-lock-icon">🔒</div>
              <div className="level-complete-replay-lock-text">
                Unlock replay for this level
                <br />
                <span
                  id="levelCompleteReplayLockCost"
                  className="level-complete-replay-lock-cost"
                >
                  …
                </span>
              </div>
            </div>
          </div>
          <p className="level-complete-replay-hint" id="levelCompleteReplayHint">
            ←/→ step · ↑ first · ↓ last (keys or buttons below)
          </p>
          <p className="level-complete-replay-step" id="levelCompleteReplayStep">
            Step: --/--
          </p>
          <ReplayStepNav
            id="levelCompleteReplayStepNav"
            ariaLabel="Replay step controls"
          />
          <p className="level-complete-replay-event" id="levelCompleteReplayEvent"></p>
        </div>
        <div className="level-complete-actions">
          <button id="levelCompleteRetryBtn" type="button">
            Retry
          </button>
          <button id="levelCompleteNextBtn" type="button">
            Next Level
          </button>
        </div>
      </div>
    </div>
  );
}
