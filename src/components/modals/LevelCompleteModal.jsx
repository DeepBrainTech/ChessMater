import ReplayStepNav from "./ReplayStepNav.jsx";
import { ButtonArtwork } from "../GameButton.jsx";

export function CompletionIcon({ name, className }) {
  return (
    <span className={`completion-icon completion-icon--${name} ${className || ""}`} aria-hidden="true">
      <span className="completion-icon-rim" />
      <span className="completion-icon-face">
        <span className="completion-icon-body" />
        <span className="completion-icon-shine" />
        <span className="completion-icon-detail" />
      </span>
      {name === "lock" && <span className="completion-icon-key" />}
    </span>
  );
}

export default function LevelCompleteModal() {
  return (
    <div id="levelCompleteModal" className="leaderboard-modal">
      <div className="level-complete-content" role="dialog" aria-modal="true" aria-labelledby="levelCompleteHeading">
       <div className="level-complete-inner">
        <div className="level-complete-header">
          <h2 id="levelCompleteHeading">Level Complete!</h2>
          <button className="level-complete-close" id="closeLevelCompleteModal" type="button" aria-label="Close level complete">
            <ButtonArtwork utility />
            <CompletionIcon name="close" />
          </button>
        </div>
        <p id="levelCompleteCoinReward" className="level-complete-coin-reward" role="status" hidden>
          <img src="/assets/images/powerups/coin.svg" alt="Coins" />
          <span>+200</span>
        </p>
        <p id="levelCompleteText" className="level-complete-announcement">Great job!</p>
        <div className="level-complete-stats">
          <div className="level-complete-stat"><span>Your Moves</span><strong id="levelCompleteMoveCount">0</strong></div>
          <div className="level-complete-stat"><span>Other’s Best</span><strong id="levelCompleteFewestOtherMoves">--</strong></div>
        </div>
        <p id="levelCompleteAchievement" className="level-complete-achievement"></p>
        <div className="level-complete-replay" id="levelCompleteReplayPanel">
          <p className="level-complete-replay-title" id="levelCompleteReplayTitle">
            Best Route By <span id="levelCompleteReplayAuthor">--</span>
          </p>
          <p className="level-complete-replay-subtitle" id="levelCompleteReplaySubtitle"></p>
          <div className="level-complete-replay-canvas-wrap">
           <div className="level-complete-replay-board">
            <canvas
              id="levelCompleteReplayCanvas"
              width="1270"
              height="794"
              aria-label="Replay mini board"
            ></canvas>
           </div>
            <div className="level-complete-replay-lock" id="levelCompleteReplayLock" role="button" tabIndex={0} aria-label="Use 1 Hint to view this run's guide" onKeyDown={event => {
              if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); }
            }}>
              <CompletionIcon name="lock" className="level-complete-replay-lock-icon" />
              <div className="level-complete-replay-lock-text">
                <span>View Hint</span>
                <span
                  id="levelCompleteReplayLockCost"
                  className="level-complete-replay-lock-cost"
                >
                  …
                </span>
              </div>
            </div>
          </div>
          <p className="level-complete-replay-hint level-complete-announcement" id="levelCompleteReplayHint">
            ←/→ step · ↑ first · ↓ last · Scroll up/down to step
          </p>
          <p className="level-complete-replay-event" id="levelCompleteReplayEvent" role="status"></p>
          <div className="level-complete-replay-controls">
           <p className="level-complete-replay-step" id="levelCompleteReplayStep" data-step-label="Step">Step: -- / --</p>
          <ReplayStepNav
            id="levelCompleteReplayStepNav"
            ariaLabel="Replay step controls"
            variant="inline"
          />
          </div>
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
    </div>
  );
}
