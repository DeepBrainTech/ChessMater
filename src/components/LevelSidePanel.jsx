import { useEffect, useState } from "react";
import { subscribeGameUi } from "../game/uiBridge.js";

export default function LevelSidePanel() {
  const [players, setPlayers] = useState(0);
  const [objectives, setObjectives] = useState({ completed: 0, total: 0 });

  useEffect(() => {
    return subscribeGameUi((event) => {
      if (event.type === "playerCount") setPlayers(event.count);
      if (event.type === "objectiveCount") {
        setObjectives({
          completed: event.completed,
          total: event.totalObjectives,
        });
      }
    });
  }, []);

  return (
    <div id="gameSidePanel">
      <div id="blockTipStats">
        <div className="player-count" id="playerCount">
          Players: {players}
        </div>
        <div className="objective-count" id="objectiveCount">
          Objectives: {objectives.completed}/{objectives.total}
        </div>
      </div>
      <div className="level-selector">
        {/* Populated by src/page/levelSelect.js (same flow as legacy page-ui). */}
        <div className="level-grid" id="levelGrid"></div>
      </div>
    </div>
  );
}
