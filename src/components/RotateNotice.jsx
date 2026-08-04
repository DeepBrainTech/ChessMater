export default function RotateNotice() {
  return (
    <div
      id="rotateNotice"
      role="dialog"
      aria-modal="true"
      aria-live="polite"
      aria-label="Landscape recommended"
    >
      <span className="rotate-notice-icon" aria-hidden="true">
        🔄
      </span>
      <div>Switch to landscape mode for the best gameplay experience.</div>
      <div className="rotate-notice-sub">Rotate your device or tap to continue.</div>
      <button type="button" className="rotate-notice-dismiss" id="rotateNoticeDismiss">
        Continue
      </button>
    </div>
  );
}
