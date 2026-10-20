import GameTopControls from "./GameTopControls.jsx";
import LevelSidePanel from "./LevelSidePanel.jsx";

export default function GameShell() {
  return (
    <div className="container consumer-mode" id="mainContainer">
      <h1>ChessMater</h1>
      <p id="mainContainerUserName" className="current-user-name"></p>
      <div className="game-area">
        <div id="gameLayoutRow">
          <div className="canvas-container">
            <div className="game-board-frame">
              <canvas id="gameCanvas" width="1280" height="800"></canvas>
            </div>
          </div>
          <LevelSidePanel>
            <GameTopControls />
          </LevelSidePanel>
        </div>
        <div className="status" id="statusMessage"></div>
      </div>
    </div>
  );
}
