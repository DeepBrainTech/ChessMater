export default function LeaderboardModal() {
  return (
    <div id="leaderboardModal" className="leaderboard-modal">
      <div className="leaderboard-content">
        <div className="leaderboard-header">
          <h2>🏆 Leaderboard</h2>
          <button className="close-leaderboard" id="closeLeaderboard" type="button">
            &times;
          </button>
        </div>
        <div className="leaderboard-filter">
          <label htmlFor="leaderboardModeSelect">View:</label>
          <select id="leaderboardModeSelect"></select>
        </div>
        <div id="leaderboardList">
          <div className="leaderboard-loading">Loading leaderboard...</div>
        </div>
      </div>
    </div>
  );
}
