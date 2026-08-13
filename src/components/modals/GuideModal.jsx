export default function GuideModal() {
  return (
    <div id="guideModal" className="leaderboard-modal">
      <div className="leaderboard-content guide-content">
        <div className="leaderboard-header">
          <h2>Beginner Guide</h2>
          <button className="close-leaderboard" id="closeGuideModal" type="button">
            &times;
          </button>
        </div>

        <h2>Goal</h2>
        <p>
          Move at least one piece to the goal tile. If objectives exist, complete all
          objectives first.
        </p>

        <h2>Basic Controls</h2>
        <ul>
          <li>Click one of your pieces to select it.</li>
          <li>Click a valid destination tile to move.</li>
          <li>Use Undo Move to revert the last move.</li>
          <li>Use Restart Level to reset the current puzzle.</li>
        </ul>

        <h2>Piece Movement</h2>
        <ul>
          <li>
            Each piece follows chess movement rules (rook, bishop, queen, knight, king,
            pawn).
          </li>
          <li>A move must be valid for the selected piece and respect level obstacles.</li>
        </ul>

        <h2>Special Blocks</h2>
        <ul>
          <li>
            <strong>Solid Block</strong>: acts as a wall/platform.
          </li>
          <li>
            <strong>Phase Block</strong>: can be passed from below in specific situations.
          </li>
          <li>
            <strong>Transformer</strong>: lets you change the selected piece type.
          </li>
          <li>
            <strong>Objective</strong>: must be stepped on before finishing when present.
          </li>
          <li>
            <strong>Counter Goal</strong>: goal with a move countdown limit.
          </li>
          <li>
            <strong>Teleporters</strong>: same-color pair teleports pieces.
          </li>
          <li>
            <strong>Bomb</strong>: can destroy pieces and alter board state.
          </li>
          <li>
            <strong>Black Target Pieces</strong>: must be captured before the goal unlocks.
          </li>
          <li>
            <strong>Laser Block</strong>: solid block with selectable edge lasers that fire
            on configured move intervals; touching an active beam fails the level.
          </li>
        </ul>

        <h2>Win And Lose</h2>
        <ul>
          <li>Win: reach the goal after satisfying objective/counter requirements.</li>
          <li>
            Lose condition can happen in bomb-heavy levels if all pieces are destroyed.
          </li>
        </ul>
      </div>
    </div>
  );
}
