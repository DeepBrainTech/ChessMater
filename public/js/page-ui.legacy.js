/**
 * Page UI wiring previously inlined in index.html.
 * Kept as a classic (non-module) script so it shares the same global scope as game.js / levels.js
 * (currentLevelIndex, LEVELS, loadPuzzle, etc.) without changing game logic.
 */
(function () {
  function initRotateNotice() {
    var notice = document.getElementById("rotateNotice");
    if (!notice) return;
    var dismissedInPortrait = false;

    function isPortrait() {
      if (window.matchMedia("(orientation: portrait)").matches) return true;
      if (window.matchMedia("(orientation: landscape)").matches) return false;
      return window.innerHeight > window.innerWidth;
    }

    function dismiss() {
      if (!notice.classList.contains("is-visible")) return;
      dismissedInPortrait = true;
      notice.classList.remove("is-visible");
    }

    function syncRotateNotice() {
      if (!isPortrait()) {
        dismissedInPortrait = false;
        notice.classList.remove("is-visible");
        return;
      }
      if (dismissedInPortrait) {
        notice.classList.remove("is-visible");
        return;
      }
      notice.classList.add("is-visible");
    }

    notice.addEventListener("click", dismiss);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && notice.classList.contains("is-visible")) dismiss();
    });

    var mq = window.matchMedia("(orientation: portrait)");
    if (mq.addEventListener) mq.addEventListener("change", syncRotateNotice);
    else if (mq.addListener) mq.addListener(syncRotateNotice);
    window.addEventListener("resize", syncRotateNotice);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", syncRotateNotice);
    }
    syncRotateNotice();
  }

  function initMusicControls() {
    var bgMusic = document.getElementById("bgMusic");
    var musicToggle = document.getElementById("musicToggle");
    window.cmAudioMuted = false;
    window.cmMusicPlaying = false;

    function isHomepageVisible() {
      var startScreen = document.getElementById("startScreen");
      if (!startScreen) return true;
      return window.getComputedStyle(startScreen).display !== "none";
    }

    function syncBgMusic() {
      if (!bgMusic) return;
      var shouldPlay =
        window.cmMusicPlaying && !window.cmAudioMuted && !isHomepageVisible();
      if (!shouldPlay) {
        bgMusic.pause();
        return;
      }
      bgMusic.volume = 0.5;
      bgMusic.play().catch(function () {});
    }
    window.syncBgMusic = syncBgMusic;

    function applyGlobalMute(muted) {
      window.cmAudioMuted = !!muted;

      document.querySelectorAll("audio").forEach(function (audioEl) {
        audioEl.muted = window.cmAudioMuted;
      });

      syncBgMusic();

      if (musicToggle) {
        musicToggle.textContent = window.cmAudioMuted ? "🔇 Muted" : "🔊 Music";
      }
    }

    if (musicToggle) {
      musicToggle.addEventListener("click", function () {
        applyGlobalMute(!window.cmAudioMuted);
      });
    }

    if (bgMusic) bgMusic.pause();
    applyGlobalMute(false);
  }

  function initRestartUndoButtons() {
    var restartBtn = document.getElementById("restartLevelBtn");
    var undoMoveBtn = document.getElementById("undoMoveBtn");

    if (restartBtn) {
      restartBtn.addEventListener("click", function () {
        if (typeof restartLevel === "function") {
          restartLevel();
        } else {
          console.error("restartLevel() not found");
        }
      });
    }
    if (undoMoveBtn) {
      undoMoveBtn.addEventListener("click", function () {
        if (typeof undoMove === "function") {
          undoMove();
        } else {
          console.error("undoMove() not found");
        }
      });
    }
  }

  function isLoggedIn() {
    return !!(window.cmUser && (window.cmToken || window.cmSessionReady));
  }

  function updateLoginPromptVisibility() {
    var el = document.getElementById("loginPrompt");
    if (el) el.style.display = isLoggedIn() ? "none" : "block";
  }

  function setGameState(inGame) {
    var startScreen = document.getElementById("startScreen");
    if (startScreen) {
      startScreen.style.display = inGame ? "none" : "flex";
    }
    document.body.classList.toggle("in-game", !!inGame);
    window.cmMusicPlaying = !!inGame;
    if (typeof window.syncBgMusic === "function") {
      window.syncBgMusic();
    }
    if (typeof window.updatePortalButton === "function") {
      window.updatePortalButton();
    }
  }

  function initLeaderboardAndGuide() {
    var leaderboardButton = document.getElementById("leaderboardButton");
    var leaderboardModal = document.getElementById("leaderboardModal");
    var closeLeaderboard = document.getElementById("closeLeaderboard");
    var leaderboardList = document.getElementById("leaderboardList");
    var leaderboardModeSelect = document.getElementById("leaderboardModeSelect");
    var instructionsButton = document.getElementById("instructionsButton");
    var guideModal = document.getElementById("guideModal");
    var closeGuideModal = document.getElementById("closeGuideModal");

    function populateLeaderboardModes() {
      if (!leaderboardModeSelect) return;
      var levelCount =
        typeof LEVELS !== "undefined" && Array.isArray(LEVELS) ? LEVELS.length : 35;
      var previous = leaderboardModeSelect.value;
      leaderboardModeSelect.innerHTML = "";

      var totalOption = document.createElement("option");
      totalOption.value = "progress";
      totalOption.textContent = "Total Levels Unlocked";
      leaderboardModeSelect.appendChild(totalOption);

      for (var i = 1; i <= levelCount; i++) {
        var opt = document.createElement("option");
        opt.value = "level:" + i;
        opt.textContent = "Level " + i + " - Fewest Moves";
        leaderboardModeSelect.appendChild(opt);
      }

      if (
        previous &&
        Array.from(leaderboardModeSelect.options).some(function (o) {
          return o.value === previous;
        })
      ) {
        leaderboardModeSelect.value = previous;
      } else {
        leaderboardModeSelect.value = "progress";
      }
    }

    function getLeaderboardRequestUrl() {
      var raw = leaderboardModeSelect ? leaderboardModeSelect.value : "progress";
      var base =
        (window.API_BASE_URL || "https://chessmater-production.up.railway.app") +
        "/leaderboard";
      if (!raw || raw === "progress") return base;
      if (raw.startsWith("level:")) {
        var level = Number.parseInt(raw.split(":")[1], 10);
        if (Number.isFinite(level) && level > 0) {
          return base + "?mode=level&level=" + level;
        }
      }
      return base;
    }

    if (leaderboardButton) {
      leaderboardButton.addEventListener("click", function () {
        if (!isLoggedIn()) {
          alert("Please log in to view the leaderboard");
          return;
        }
        populateLeaderboardModes();
        leaderboardModal.classList.add("active");
        loadLeaderboard();
      });
    }

    if (closeLeaderboard) {
      closeLeaderboard.addEventListener("click", function () {
        leaderboardModal.classList.remove("active");
      });
    }

    if (leaderboardModal) {
      leaderboardModal.addEventListener("click", function (e) {
        if (e.target === leaderboardModal) {
          leaderboardModal.classList.remove("active");
        }
      });
    }

    if (instructionsButton && guideModal) {
      instructionsButton.addEventListener("click", function () {
        guideModal.classList.add("active");
      });
    }

    if (closeGuideModal && guideModal) {
      closeGuideModal.addEventListener("click", function () {
        guideModal.classList.remove("active");
      });
    }

    if (guideModal) {
      guideModal.addEventListener("click", function (e) {
        if (e.target === guideModal) {
          guideModal.classList.remove("active");
        }
      });
    }

    async function fetchWithUnifiedAuthRetry(path, options) {
      options = options || {};
      if (typeof window.apiFetchWithAuthRetry === "function") {
        return window.apiFetchWithAuthRetry(path, options);
      }
      var base =
        window.API_BASE_URL || "https://chessmater-production.up.railway.app";
      var firstHeaders = Object.assign({}, options.headers || {});
      if (!firstHeaders.Authorization && window.cmToken) {
        firstHeaders.Authorization = "Bearer " + window.cmToken;
      }
      var response = await fetch(base + path, Object.assign({}, options, {
        credentials: "include",
        headers: firstHeaders,
      }));
      if (response.status !== 401) return response;
      if (typeof window.refreshGameTokenFromPortal !== "function") return response;
      var refreshed = await window.refreshGameTokenFromPortal(true);
      if (!refreshed) return response;
      var retryHeaders = Object.assign({}, options.headers || {});
      if (window.cmToken) {
        retryHeaders.Authorization = "Bearer " + window.cmToken;
      }
      return fetch(base + path, Object.assign({}, options, {
        credentials: "include",
        headers: retryHeaders,
      }));
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

        var headers = {};
        if (window.cmToken) {
          headers.Authorization = "Bearer " + window.cmToken;
        }

        var leaderboardUrl = getLeaderboardRequestUrl();
        var leaderboardPath = leaderboardUrl.replace(
          window.API_BASE_URL || "https://chessmater-production.up.railway.app",
          ""
        );
        var res = await fetchWithUnifiedAuthRetry(leaderboardPath, { headers: headers });

        if (res.status === 401) {
          leaderboardList.innerHTML =
            '<div class="leaderboard-error">Session expired. Please <a href="https://deepbraintechnology.com/" target="_blank">refresh from the portal</a> to view leaderboard.</div>';
          return;
        }
        if (!res.ok) {
          throw new Error("Failed to fetch leaderboard");
        }

        var data = await res.json();
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

      var currentUserId = window.cmUser
        ? window.cmUser.user_id || window.cmUser.portal_user_id || window.cmUser.id
        : null;
      var currentUserIdStr = currentUserId != null ? String(currentUserId) : "";
      var isLevelMode = !!(mode && mode.startsWith("level:"));
      var selectedLevel = isLevelMode
        ? Number.parseInt(mode.split(":")[1], 10)
        : null;
      var html = leaderboardData
        .map(function (entry, index) {
          var rank = index + 1;
          var rankClass = "";
          if (rank === 1) rankClass = "gold";
          else if (rank === 2) rankClass = "silver";
          else if (rank === 3) rankClass = "bronze";

          var isCurrentUser =
            entry.user_id != null && String(entry.user_id) === currentUserIdStr;
          var userId = entry.user_id || "";
          var displayName =
            entry.username ||
            (userId.length > 8 ? userId.substring(0, 8) + "..." : userId) ||
            "Anonymous";
          var scoreText = isLevelMode
            ? (entry.best_moves || 0) + " moves"
            : "Level " + (entry.max_unlocked || 0);

          return (
            '<div class="leaderboard-item" ' +
            (isCurrentUser
              ? 'style="background: rgba(255,255,255,0.2); border: 2px solid #ffd700;"'
              : "") +
            ">" +
            '<span class="leaderboard-rank ' +
            rankClass +
            '">' +
            (rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank) +
            "</span>" +
            '<span class="leaderboard-user">' +
            displayName +
            (isCurrentUser ? " (You)" : "") +
            "</span>" +
            '<span class="leaderboard-score">' +
            scoreText +
            "</span>" +
            "</div>"
          );
        })
        .join("");

      var myIndex = currentUserIdStr
        ? leaderboardData.findIndex(function (entry) {
            return (
              entry.user_id != null && String(entry.user_id) === currentUserIdStr
            );
          })
        : -1;
      var myRank = myIndex >= 0 ? myIndex + 1 : null;
      var title =
        isLevelMode && Number.isFinite(selectedLevel)
          ? "Level " + selectedLevel + " - Fewest Moves"
          : "Total Levels Unlocked";
      if (myRank != null) title += " · Your rank: " + myRank;
      leaderboardList.innerHTML =
        '<div class="leaderboard-loading" style="padding: 8px 0 16px; font-size: 1rem; text-align: left;">' +
        title +
        '</div><ul class="leaderboard-list">' +
        html +
        "</ul>";
    }

    if (leaderboardModeSelect) {
      leaderboardModeSelect.addEventListener("change", function () {
        if (leaderboardModal && leaderboardModal.classList.contains("active")) {
          loadLeaderboard();
        }
      });
    }
  }

  async function initLevelSelectAndStart() {
    window.currentMaxUnlocked = 1;

    function mergeMaxUnlocked(value) {
      var parsed = Number.parseInt(value, 10);
      var candidate = Number.isFinite(parsed) ? parsed : 1;
      var merged = Math.max(window.currentMaxUnlocked || 1, candidate);
      window.currentMaxUnlocked = merged;
      return merged;
    }
    window.mergeMaxUnlocked = mergeMaxUnlocked;

    async function fetchProgress() {
      if (window.isLocalDev) {
        var allLevels =
          typeof LEVELS !== "undefined" &&
          Array.isArray(LEVELS) &&
          LEVELS.length > 0
            ? LEVELS.length
            : 999;
        return mergeMaxUnlocked(allLevels);
      }
      try {
        await (window.authReady || Promise.resolve());
        var headers = {};
        if (window.cmToken) {
          headers.Authorization = "Bearer " + window.cmToken;
        }

        var authFetch =
          typeof window.apiFetchWithAuthRetry === "function"
            ? window.apiFetchWithAuthRetry
            : null;
        var res = authFetch
          ? await authFetch("/progress", { headers: headers })
          : await fetch(
              (window.API_BASE_URL ||
                "https://chessmater-production.up.railway.app") + "/progress",
              {
                credentials: "include",
                headers: headers,
              }
            );

        if (!res.ok) {
          return mergeMaxUnlocked(1);
        }

        var data = await res.json();
        var maxUnlocked = parseInt(data.maxUnlocked || "1", 10);
        return mergeMaxUnlocked(maxUnlocked);
      } catch (err) {
        return mergeMaxUnlocked(1);
      }
    }

    async function loadLevels(optionalMaxUnlocked) {
      var levelGrid = document.getElementById("levelGrid");
      if (!levelGrid) return;
      levelGrid.innerHTML = "";
      var currentLevelButton = null;
      var maxUnlockedButton = null;

      var maxUnlocked;
      if (optionalMaxUnlocked !== undefined) {
        maxUnlocked = mergeMaxUnlocked(optionalMaxUnlocked);
      } else {
        maxUnlocked = await fetchProgress();
      }

      if (window.isLocalDev) {
        maxUnlocked = LEVELS.length;
        mergeMaxUnlocked(maxUnlocked);
      }

      LEVELS.forEach(function (level, index) {
        var button = document.createElement("button");

        var isLocked = index + 1 > maxUnlocked;

        button.className = "level-button";
        button.textContent = level.name || "Level " + (index + 1);
        button.dataset.levelIndex = String(index + 1);

        if (index + 1 === maxUnlocked) {
          maxUnlockedButton = button;
        }

        if (isLocked) {
          button.style.background = "#777";
          button.style.cursor = "not-allowed";
          button.style.opacity = "0.5";
          button.textContent += " 🔒";

          button.addEventListener("click", function () {
            updateStatus("This level is locked. Complete earlier levels first!");
          });
        } else {
          button.style.background = "linear-gradient(145deg, #4a90e2, #357abd)";
          button.addEventListener("click", function () {
            currentLevelIndex = index;
            setGameState(true);
            loadPuzzle(level);
          });
        }

        if (index === currentLevelIndex) {
          button.classList.add("current-level");
          currentLevelButton = button;
        }

        levelGrid.appendChild(button);
      });

      var scrollTargetButton = currentLevelButton || maxUnlockedButton;
      if (scrollTargetButton) {
        requestAnimationFrame(function () {
          scrollTargetButton.scrollIntoView({
            block: "center",
            inline: "nearest",
          });
        });
      }
    }

    function ensureCurrentLevelVisible() {
      var levelGrid = document.getElementById("levelGrid");
      if (!levelGrid) return;
      var currentButton = levelGrid.querySelector(".level-button.current-level");
      if (!currentButton) return;

      var gridRect = levelGrid.getBoundingClientRect();
      var btnRect = currentButton.getBoundingClientRect();
      var fullyVisible =
        btnRect.top >= gridRect.top && btnRect.bottom <= gridRect.bottom;
      if (!fullyVisible) {
        currentButton.scrollIntoView({
          block: "center",
          inline: "nearest",
          behavior: "smooth",
        });
      }
    }

    function highlightCurrentLevelButton() {
      var levelGrid = document.getElementById("levelGrid");
      if (!levelGrid) return;
      var buttons = levelGrid.querySelectorAll(".level-button");
      buttons.forEach(function (btn, idx) {
        if (idx === currentLevelIndex) {
          btn.classList.add("current-level");
        } else {
          btn.classList.remove("current-level");
        }
      });
      requestAnimationFrame(ensureCurrentLevelVisible);
    }
    window.highlightCurrentLevelButton = highlightCurrentLevelButton;
    window.ensureCurrentLevelVisible = ensureCurrentLevelVisible;
    window.setGameState = setGameState;
    window.updateLoginPromptVisibility = updateLoginPromptVisibility;

    await (window.authReady || Promise.resolve());

    updateLoginPromptVisibility();

    function updatePortalButton() {
      var portalButton = document.getElementById("portalButton");
      var startScreen = document.getElementById("startScreen");

      if (!portalButton || !startScreen) return;

      var computedStyle = window.getComputedStyle(startScreen);
      var isStartScreenVisible = computedStyle.display !== "none";

      if (isStartScreenVisible) {
        portalButton.textContent = "Back to Main Portal";
        portalButton.onclick = function () {
          window.open("https://deepbraintechnology.com/", "_blank");
        };
      } else {
        portalButton.textContent = "Back to Home";
        portalButton.onclick = function () {
          setGameState(false);
          if (typeof loadLevels === "function") {
            loadLevels(window.currentMaxUnlocked);
          }
        };
      }
    }
    window.updatePortalButton = updatePortalButton;

    setGameState(false);
    updatePortalButton();

    var startScreenObserver = new MutationObserver(function () {
      var startScreenEl = document.getElementById("startScreen");
      if (startScreenEl) {
        var computedStyle = window.getComputedStyle(startScreenEl);
        var isVisible = computedStyle.display !== "none";
        if (isVisible && typeof loadLevels === "function") {
          loadLevels(window.currentMaxUnlocked);
          window.progressNeedsRefresh = false;
        }
      }
      updatePortalButton();
    });

    var startScreen = document.getElementById("startScreen");
    if (startScreen) {
      startScreenObserver.observe(startScreen, {
        attributes: true,
        attributeFilter: ["style"],
      });
    }

    loadLevels();

    var startButton = document.getElementById("startButton");
    if (startButton) {
      startButton.addEventListener("click", async function () {
        if (!isLoggedIn()) {
          alert("Please log in to continue playing");
          return;
        }
        var maxUnlocked = await fetchProgress();
        if (typeof loadLevels === "function") {
          await loadLevels(maxUnlocked);
        }
        setGameState(true);

        if (typeof LEVELS !== "undefined" && LEVELS.length > 0) {
          var startIndex = Math.min(
            Math.max((window.currentMaxUnlocked || maxUnlocked || 1) - 1, 0),
            LEVELS.length - 1
          );
          currentLevelIndex = startIndex;
          loadPuzzle(LEVELS[startIndex]);

          if (typeof enablePlayerControls === "function") {
            enablePlayerControls();
          }
        }
      });
    }
  }

  if (window.__cmPageUiInitialized) return;
  window.__cmPageUiInitialized = true;

  initRotateNotice();
  initMusicControls();
  initRestartUndoButtons();
  initLeaderboardAndGuide();
  initLevelSelectAndStart().then(function () {
    if (typeof window.cmUpdateCurrentUserName === "function") {
      window.cmUpdateCurrentUserName();
    }
  });
})();
