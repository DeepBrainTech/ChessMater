import GameTopControls from "./GameTopControls.jsx";
import LevelSidePanel from "./LevelSidePanel.jsx";

export default function GameShell() {
  return (
    <div className="container consumer-mode" id="mainContainer">
      <h1>ChessMater</h1>
      <p id="mainContainerUserName" className="current-user-name"></p>
      <GameTopControls />
      <div className="game-area">
        <div id="gameLayoutRow">
          <div className="canvas-container">
            <canvas id="gameCanvas" width="1280" height="800"></canvas>
          </div>
          <LevelSidePanel />
        </div>
        <div className="status" id="statusMessage"></div>
      </div>

      <footer>
        Chess piece images by{" "}
        <a href="https://en.wikipedia.org/wiki/User:Cburnett">Cburnett</a>, licensed under{" "}
        <a href="https://creativecommons.org/licenses/by-sa/3.0/">CC BY-SA 3.0</a>. Source:{" "}
        <a href="https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces">
          Wikimedia Commons
        </a>
        .
      </footer>
    </div>
  );
}
