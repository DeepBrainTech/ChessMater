function isLoggedIn() {
  return !!(window.cmUser && (window.cmToken || window.cmSessionReady));
}

export function initLeaderboardAndGuide() {
  const leaderboardButton = document.getElementById("leaderboardButton");
  const leaderboardModal = document.getElementById("leaderboardModal");
  const closeLeaderboard = document.getElementById("closeLeaderboard");
  const leaderboardList = document.getElementById("leaderboardList");
  const leaderboardModeSelect = document.getElementById("leaderboardModeSelect");
  const instructionsButton = document.getElementById("instructionsButton");
  const guideModal = document.getElementById("guideModal");
  const closeGuideModal = document.getElementById("closeGuideModal");

  function populateLeaderboardModes() {
    if (!leaderboardModeSelect) return;
    const levelCount =
      typeof window.LEVELS !== "undefined" && Array.isArray(window.LEVELS)
        ? window.LEVELS.length
        : 35;
    const previous = leaderboardModeSelect.value;
    leaderboardModeSelect.innerHTML = "";

    const totalOption = document.createElement("option");
    totalOption.value = "progress";
    totalOption.textContent = "Total Levels Unlocked";
    leaderboardModeSelect.appendChild(totalOption);

    for (let i = 1; i <= levelCount; i++) {
      const opt = document.createElement("option");
      opt.value = `level:${i}`;
      opt.textContent = `Level ${i} - Fewest Moves`;
      leaderboardModeSelect.appendChild(opt);
    }

    if (
      previous &&
      Array.from(leaderboardModeSelect.options).some((o) => o.value === previous)
    ) {
      leaderboardModeSelect.value = previous;
    } else {
      leaderboardModeSelect.value = "progress";
    }
  }

  function getLeaderboardRequestUrl() {
    const raw = leaderboardModeSelect ? leaderboardModeSelect.value : "progress";
    const base = `${window.API_BASE_URL || "https://chessmater-production.up.railway.app"}/leaderboard`;
    if (!raw || raw === "progress") return base;
    if (raw.startsWith("level:")) {
      const level = Number.parseInt(raw.split(":")[1], 10);
      if (Number.isFinite(level) && level > 0) {
        return `${base}?mode=level&level=${level}`;
      }
    }
    return base;
  }

  async function fetchWithUnifiedAuthRetry(path, options = {}) {
    if (typeof window.apiFetchWithAuthRetry === "function") {
      return window.apiFetchWithAuthRetry(path, options);
    }
    const base = window.API_BASE_URL || "https://chessmater-production.up.railway.app";
    const firstHeaders = { ...(options.headers || {}) };
    if (!firstHeaders.Authorization && window.cmToken) {
      firstHeaders.Authorization = `Bearer ${window.cmToken}`;
    }
    let response = await fetch(`${base}${path}`, {
      ...options,
      credentials: "include",
      headers: firstHeaders,
    });
    if (response.status !== 401) return response;
    if (typeof window.refreshGameTokenFromPortal !== "function") return response;
    const refreshed = await window.refreshGameTokenFromPortal(true);
    if (!refreshed) return response;
    const retryHeaders = { ...(options.headers || {}) };
    if (window.cmToken) {
      retryHeaders.Authorization = `Bearer ${window.cmToken}`;
    }
    return fetch(`${base}${path}`, {
      ...options,
      credentials: "include",
      headers: retryHeaders,
    });
  }

  function displayLeaderboard(leaderboardData, mode) {
    if (
      !leaderboardData ||
      !Array.isArray(leaderboardData) ||
      leaderboardData.length === 0
    ) {
      leaderboardList.innerHTML =
        '<div class="leaderboard-loading">No leaderboard data available yet.</div>';
      return;
    }

    const currentUserId = window.cmUser
      ? window.cmUser.user_id || window.cmUser.portal_user_id || window.cmUser.id
      : null;
    const currentUserIdStr = currentUserId != null ? String(currentUserId) : "";
    const isLevelMode = !!(mode && mode.startsWith("level:"));
    const selectedLevel = isLevelMode
      ? Number.parseInt(mode.split(":")[1], 10)
      : null;
    const html = leaderboardData
      .map((entry, index) => {
        const rank = index + 1;
        let rankClass = "";
        if (rank === 1) rankClass = "gold";
        else if (rank === 2) rankClass = "silver";
        else if (rank === 3) rankClass = "bronze";

        const isCurrentUser =
          entry.user_id != null && String(entry.user_id) === currentUserIdStr;
        const userId = entry.user_id || "";
        const displayName =
          entry.username ||
          (userId.length > 8 ? userId.substring(0, 8) + "..." : userId) ||
          "Anonymous";
        const scoreText = isLevelMode
          ? `${entry.best_moves || 0} moves`
          : `Level ${entry.max_unlocked || 0}`;

        return `
            <div class="leaderboard-item" ${
              isCurrentUser
                ? 'style="background: rgba(255,255,255,0.2); border: 2px solid #ffd700;"'
                : ""
            }>
              <span class="leaderboard-rank ${rankClass}">${
                rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank
              }</span>
              <span class="leaderboard-user">${displayName}${
                isCurrentUser ? " (You)" : ""
              }</span>
              <span class="leaderboard-score">${scoreText}</span>
            </div>
          `;
      })
      .join("");

    const myIndex = currentUserIdStr
      ? leaderboardData.findIndex(
          (entry) =>
            entry.user_id != null && String(entry.user_id) === currentUserIdStr
        )
      : -1;
    const myRank = myIndex >= 0 ? myIndex + 1 : null;
    let title =
      isLevelMode && Number.isFinite(selectedLevel)
        ? `Level ${selectedLevel} - Fewest Moves`
        : "Total Levels Unlocked";
    if (myRank != null) title += ` · Your rank: ${myRank}`;
    leaderboardList.innerHTML = `<div class="leaderboard-loading" style="padding: 8px 0 16px; font-size: 1rem; text-align: left;">${title}</div><ul class="leaderboard-list">${html}</ul>`;
  }

  async function loadLeaderboard() {
    if (!leaderboardList) return;
    leaderboardList.innerHTML =
      '<div class="leaderboard-loading">Loading leaderboard...</div>';
    await (window.authReady || Promise.resolve());
    try {
      if (!window.cmUser) {
        leaderboardList.innerHTML =
          '<div class="leaderboard-error">Please log in to view the leaderboard</div>';
        return;
      }

      const headers = {};
      if (window.cmToken) {
        headers.Authorization = `Bearer ${window.cmToken}`;
      }

      const leaderboardUrl = getLeaderboardRequestUrl();
      const leaderboardPath = leaderboardUrl.replace(
        window.API_BASE_URL || "https://chessmater-production.up.railway.app",
        ""
      );
      const res = await fetchWithUnifiedAuthRetry(leaderboardPath, { headers });

      if (res.status === 401) {
        leaderboardList.innerHTML =
          '<div class="leaderboard-error">Session expired. Please <a href="https://deepbraintechnology.com/" target="_blank">refresh from the portal</a> to view leaderboard.</div>';
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch leaderboard");

      const data = await res.json();
      displayLeaderboard(
        data,
        leaderboardModeSelect ? leaderboardModeSelect.value : "progress"
      );
    } catch (err) {
      console.error("Error loading leaderboard:", err);
      leaderboardList.innerHTML =
        '<div class="leaderboard-error">Failed to load leaderboard. Please try again later.</div>';
    }
  }

  const onOpenLeaderboard = () => {
    if (!isLoggedIn()) {
      alert("Please log in to view the leaderboard");
      return;
    }
    populateLeaderboardModes();
    leaderboardModal.classList.add("active");
    loadLeaderboard();
  };
  const onCloseLeaderboard = () => leaderboardModal.classList.remove("active");
  const onLeaderboardBackdrop = (e) => {
    if (e.target === leaderboardModal) leaderboardModal.classList.remove("active");
  };
  const onOpenGuide = () => guideModal.classList.add("active");
  const onCloseGuide = () => guideModal.classList.remove("active");
  const onGuideBackdrop = (e) => {
    if (e.target === guideModal) guideModal.classList.remove("active");
  };
  const onModeChange = () => {
    if (leaderboardModal && leaderboardModal.classList.contains("active")) {
      loadLeaderboard();
    }
  };

  if (leaderboardButton) leaderboardButton.addEventListener("click", onOpenLeaderboard);
  if (closeLeaderboard) closeLeaderboard.addEventListener("click", onCloseLeaderboard);
  if (leaderboardModal) leaderboardModal.addEventListener("click", onLeaderboardBackdrop);
  if (instructionsButton && guideModal) {
    instructionsButton.addEventListener("click", onOpenGuide);
  }
  if (closeGuideModal && guideModal) {
    closeGuideModal.addEventListener("click", onCloseGuide);
  }
  if (guideModal) guideModal.addEventListener("click", onGuideBackdrop);
  if (leaderboardModeSelect) {
    leaderboardModeSelect.addEventListener("change", onModeChange);
  }

  return () => {
    if (leaderboardButton) leaderboardButton.removeEventListener("click", onOpenLeaderboard);
    if (closeLeaderboard) closeLeaderboard.removeEventListener("click", onCloseLeaderboard);
    if (leaderboardModal) leaderboardModal.removeEventListener("click", onLeaderboardBackdrop);
    if (instructionsButton) instructionsButton.removeEventListener("click", onOpenGuide);
    if (closeGuideModal) closeGuideModal.removeEventListener("click", onCloseGuide);
    if (guideModal) guideModal.removeEventListener("click", onGuideBackdrop);
    if (leaderboardModeSelect) {
      leaderboardModeSelect.removeEventListener("change", onModeChange);
    }
  };
}
