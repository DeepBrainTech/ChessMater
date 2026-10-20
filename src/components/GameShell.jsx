import GameTopControls from "./GameTopControls.jsx";
import LevelSidePanel from "./LevelSidePanel.jsx";
import { useEffect, useState } from "react";
import { subscribeGameUi } from "../game/uiBridge.js";
import { styleTestLevel } from "../game/styleTestLevel.js";

export default function GameShell() {
  const [styleTest, setStyleTest] = useState(false);
  const [sampleLabel, setSampleLabel] = useState("");
  useEffect(() => subscribeGameUi(event => {
    if (event.type === "puzzleLoaded") {
      setStyleTest(event.styleTest);
      setSampleLabel("");
    }
    if (event.type === "styleTestSelection") {
      setSampleLabel(`R${event.row + 1} C${event.col + 1} · ${event.label}`);
    }
  }), []);
  return (
    <div className={`container consumer-mode${styleTest ? " style-test-mode" : ""}`} id="mainContainer">
      <h1>ChessMater</h1>
      <p id="mainContainerUserName" className="current-user-name"></p>
      <div className="game-area">
        <div id="gameLayoutRow">
          <div className="canvas-container">
            {styleTest && <p className="style-test-caption" role="status">
              <strong>TEST</strong><span>{sampleLabel || `${styleTestLevel.samples.length} 个元素与状态 · 点击格子查看名称 · 不消耗道具`}</span>
            </p>}
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
