import { getPortalUrl } from "../boot/portalLocale.js";

const HOME_ASSETS = "/assets/images/home/";

function ActionButton({ id, label, variant }) {
  return (
    <button
      className={`start-screen-action start-screen-action--${variant}`}
      id={id}
      type="button"
    >
      <span className="start-screen-action-frame" aria-hidden="true">
        <img src={`${HOME_ASSETS}${variant === "start" ? "button-start" : variant === "guide" ? "button-guide" : "button-leaderboard"}.webp`} alt="" />
      </span>
      <span className="start-screen-action-label">{label}</span>
    </button>
  );
}

export default function StartScreen() {
  return (
    <div id="startScreen" className="start-screen">
      <img
        className="home-backdrop"
        src={`${HOME_ASSETS}castle-courtyard.webp`}
        alt=""
        aria-hidden="true"
      />
      <main className="home-scene" aria-labelledby="homeTitle">
        <div className="home-content">
          <h1 className="visually-hidden" id="homeTitle">ChessMater</h1>

          <div className="home-emblems" aria-hidden="true">
            <div className="home-emblem home-emblem--primary">
              <img src={`${HOME_ASSETS}shield-primary.png`} alt="" />
            </div>
          </div>

          <div className="home-brand">
            <div className="home-logo-frame">
              <img src={`${HOME_ASSETS}chessmater-logo.png`} alt="ChessMater" />
            </div>
            <p id="startScreenUserName" className="current-user-name" />
            <p id="loginPrompt" className="login-prompt" style={{ display: "none" }}>
              Please log in to play. {" "}
              <a href={getPortalUrl("login")} target="_blank" rel="noreferrer">
                Go to main portal to log in
              </a>
            </p>
          </div>

          <div className="start-screen-buttons" aria-label="Main menu">
            <ActionButton id="startButton" label="Start Game" variant="start" />
            <ActionButton id="instructionsButton" label="Beginner Guide" variant="guide" />
            <ActionButton id="leaderboardButton" label="Leaderboard" variant="leaderboard" />
          </div>
        </div>
      </main>
    </div>
  );
}
