export default function ReplayStepNav({ id, ariaLabel }) {
  return (
    <div className="replay-step-nav" id={id} role="group" aria-label={ariaLabel}>
      <button
        type="button"
        className="replay-step-nav-btn replay-step-nav-btn--up"
        data-replay-step="first"
        aria-label="First step"
      >
        ↑
      </button>
      <button
        type="button"
        className="replay-step-nav-btn replay-step-nav-btn--left"
        data-replay-step="prev"
        aria-label="Previous step"
      >
        ←
      </button>
      <button
        type="button"
        className="replay-step-nav-btn replay-step-nav-btn--right"
        data-replay-step="next"
        aria-label="Next step"
      >
        →
      </button>
      <button
        type="button"
        className="replay-step-nav-btn replay-step-nav-btn--down"
        data-replay-step="last"
        aria-label="Last step"
      >
        ↓
      </button>
    </div>
  );
}
