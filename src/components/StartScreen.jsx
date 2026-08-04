export default function StartScreen() {
  return (
    <div id="startScreen" className="start-screen">
      <h1>ChessMater</h1>
      <p id="startScreenUserName" className="current-user-name"></p>
      <p id="loginPrompt" className="login-prompt" style={{ display: "none" }}>
        Please log in to play.{" "}
        <a href="https://deepbraintechnology.com/" target="_blank" rel="noreferrer">
          Go to main portal to log in
        </a>
      </p>
      <div className="start-screen-buttons">
        <button id="startButton" type="button">
          Start Game
        </button>
        <button id="instructionsButton" type="button">
          Beginner Guide
        </button>
        <button id="leaderboardButton" type="button">
          🏆 Leaderboard
        </button>
      </div>
    </div>
  );
}
