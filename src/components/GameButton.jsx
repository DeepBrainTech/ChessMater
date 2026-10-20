const ASSETS = "/assets/images/game/";

export function ButtonArtwork({ utility = false }) {
  return (
    <span className={`game-button-art${utility ? " game-button-art--utility" : ""}`} aria-hidden="true">
      <span className="game-button-art-border" />
      <span className="game-button-art-fill" />
      <span className="game-button-art-shadow" />
      <span className="game-button-art-shine game-button-art-shine--a" />
      <span className="game-button-art-shine game-button-art-shine--b" />
      <span className="game-button-diamond game-button-diamond--left" />
      <span className="game-button-diamond game-button-diamond--right" />
    </span>
  );
}

export default function GameButton({ id, label, color, icon, quantity, onClick, pressed, disabled = false, title, ariaLabel }) {
  return (
    <button id={id} className={`game-action game-action--${color}`} type="button" onClick={onClick} aria-pressed={pressed} disabled={disabled} title={title} aria-label={ariaLabel}>
      <ButtonArtwork />
      <span className="game-action-content">
        <span className="game-action-heading">
          <span className="game-action-icon" aria-hidden="true" style={{ backgroundImage: `url("${ASSETS}ui-icon-${icon}.svg")` }} />
          <span>{label}</span>
        </span>
        <span className="game-credit">{quantity}</span>
      </span>
    </button>
  );
}
