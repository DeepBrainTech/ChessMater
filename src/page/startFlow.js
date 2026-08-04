import { loadLevels } from "./levelSelect.js";

function isLoggedIn() {
  return !!(window.cmUser && (window.cmToken || window.cmSessionReady));
}

function updateLoginPromptVisibility() {
  const el = document.getElementById("loginPrompt");
  if (el) el.style.display = isLoggedIn() ? "none" : "block";
}

function setGameState(inGame) {
  const startScreen = document.getElementById("startScreen");
  if (startScreen) {
    startScreen.style.display = inGame ? "none" : "flex";
  }
  document.body.classList.toggle("in-game", !!inGame);
  window.cmMusicPlaying = !!inGame;
  if (typeof window.syncBgMusic === "function") window.syncBgMusic();
  if (typeof window.updatePortalButton === "function") window.updatePortalButton();
  if (typeof window.cmEmitGameUi === "function") {
    window.cmEmitGameUi({ type: "gameState", inGame: !!inGame });
  }
}

export async function initStartFlow() {
  window.setGameState = setGameState;
  window.updateLoginPromptVisibility = updateLoginPromptVisibility;

  await (window.authReady || Promise.resolve());
  updateLoginPromptVisibility();

  function updatePortalButton() {
    const portalButton = document.getElementById("portalButton");
    const startScreen = document.getElementById("startScreen");
    if (!portalButton || !startScreen) return;

    const computedStyle = window.getComputedStyle(startScreen);
    const isStartScreenVisible = computedStyle.display !== "none";

    if (isStartScreenVisible) {
      portalButton.textContent = "Back to Main Portal";
      portalButton.onclick = () => {
        window.open("https://deepbraintechnology.com/", "_blank");
      };
    } else {
      portalButton.textContent = "Back to Home";
      portalButton.onclick = () => {
        setGameState(false);
        if (typeof window.loadLevels === "function") {
          window.loadLevels(window.currentMaxUnlocked);
        }
      };
    }
  }
  window.updatePortalButton = updatePortalButton;

  setGameState(false);
  updatePortalButton();

  const startScreenObserver = new MutationObserver(() => {
    const startScreenEl = document.getElementById("startScreen");
    if (startScreenEl) {
      const computedStyle = window.getComputedStyle(startScreenEl);
      const isVisible = computedStyle.display !== "none";
      if (isVisible && typeof window.loadLevels === "function") {
        window.loadLevels(window.currentMaxUnlocked);
        window.progressNeedsRefresh = false;
      }
    }
    updatePortalButton();
  });

  const startScreen = document.getElementById("startScreen");
  if (startScreen) {
    startScreenObserver.observe(startScreen, {
      attributes: true,
      attributeFilter: ["style"],
    });
  }

  await loadLevels();

  const startButton = document.getElementById("startButton");
  const onStart = async () => {
    if (!isLoggedIn()) {
      alert("Please log in to continue playing");
      return;
    }
    const maxUnlocked = await window.fetchProgress();
    if (typeof window.loadLevels === "function") {
      await window.loadLevels(maxUnlocked);
    }
    setGameState(true);

    const levels = window.LEVELS || [];
    if (levels.length > 0) {
      const startIndex = Math.min(
        Math.max((window.currentMaxUnlocked || maxUnlocked || 1) - 1, 0),
        levels.length - 1
      );
      if (typeof window.cmSetCurrentLevelIndex === "function") {
        window.cmSetCurrentLevelIndex(startIndex);
      }
      if (typeof window.loadPuzzle === "function") {
        window.loadPuzzle(levels[startIndex]);
      }
      if (typeof window.highlightCurrentLevelButton === "function") {
        window.highlightCurrentLevelButton();
      }
      if (typeof window.enablePlayerControls === "function") {
        window.enablePlayerControls();
      }
    }
  };

  if (startButton) startButton.addEventListener("click", onStart);

  const restartBtn = document.getElementById("restartLevelBtn");
  const undoMoveBtn = document.getElementById("undoMoveBtn");
  const onRestart = () => {
    if (typeof window.restartLevel === "function") window.restartLevel();
    else console.error("restartLevel() not found");
  };
  const onUndo = () => {
    if (typeof window.undoMove === "function") window.undoMove();
    else console.error("undoMove() not found");
  };
  if (restartBtn) restartBtn.addEventListener("click", onRestart);
  if (undoMoveBtn) undoMoveBtn.addEventListener("click", onUndo);

  return () => {
    startScreenObserver.disconnect();
    if (startButton) startButton.removeEventListener("click", onStart);
    if (restartBtn) restartBtn.removeEventListener("click", onRestart);
    if (undoMoveBtn) undoMoveBtn.removeEventListener("click", onUndo);
  };
}
