export default function ReplayStepNav({ id, ariaLabel, variant }) {
  if (variant === "inline") {
    return (
      <div className="replay-step-nav replay-step-nav--inline" id={id} role="group" aria-label={ariaLabel}>
        {[["prev", "previous", "Previous"], ["next", "next", "Next"], ["first", "first", "First"], ["last", "last", "Last"]].map(([action, icon, label]) => (
          <button key={action} type="button" className="replay-step-nav-btn" data-replay-step={action} aria-label={`${label} step`}>
            <span aria-hidden="true" className="level-complete-nav-icon" style={{ backgroundImage: `url(/assets/images/level-complete/${icon}.svg)` }} />
            {label}
          </button>
        ))}
      </div>
    );
  }
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
