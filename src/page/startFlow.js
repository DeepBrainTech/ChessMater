import { session } from '../services/session.js';
import { game } from '../game/runtime.js';
import { getPortalUrl } from "../boot/portalLocale.js";
import { loadLevels } from "./levelSelect.js";

function isLoggedIn() {
  return !!(session.cmUser && (session.cmToken || session.cmSessionReady));
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
  game.cmMusicPlaying = !!inGame;
  if (typeof game.syncBgMusic === "function") game.syncBgMusic();
  if (typeof game.updatePortalButton === "function") game.updatePortalButton();
  if (typeof game.cmEmitGameUi === "function") {
    game.cmEmitGameUi({ type: "gameState", inGame: !!inGame });
  }
}

export async function initStartFlow(signal) {
  game.setGameState = setGameState;
  game.updateLoginPromptVisibility = updateLoginPromptVisibility;

  await (session.authReady || Promise.resolve());
  if (signal?.aborted) return () => {};
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
        window.location.href = getPortalUrl();
      };
    } else {
      portalButton.textContent = "Back to Home";
      portalButton.onclick = () => {
        setGameState(false);
        if (typeof game.loadLevels === "function") {
          game.loadLevels(game.currentMaxUnlocked);
        }
      };
    }
  }
  game.updatePortalButton = updatePortalButton;

  setGameState(false);
  updatePortalButton();

  const startScreenObserver = new MutationObserver(() => {
    const startScreenEl = document.getElementById("startScreen");
    if (startScreenEl) {
      const computedStyle = window.getComputedStyle(startScreenEl);
      const isVisible = computedStyle.display !== "none";
      if (isVisible && typeof game.loadLevels === "function") {
        game.loadLevels(game.currentMaxUnlocked);
        game.progressNeedsRefresh = false;
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
  if (signal?.aborted) {
    startScreenObserver.disconnect();
    return () => {};
  }

  const startButton = document.getElementById("startButton");
  const onStart = async () => {
    if (!isLoggedIn()) {
      alert("Please log in to continue playing");
      return;
    }
    const maxUnlocked = await game.fetchProgress();
    if (signal?.aborted) return;
    if (typeof game.loadLevels === "function") {
      await game.loadLevels(maxUnlocked);
      if (signal?.aborted) return;
    }
    setGameState(true);

    const levels = game.LEVELS || [];
    if (levels.length > 0) {
      const startIndex = Math.min(
        Math.max((game.currentMaxUnlocked || maxUnlocked || 1) - 1, 0),
        levels.length - 1
      );
      if (typeof game.cmSetCurrentLevelIndex === "function") {
        game.cmSetCurrentLevelIndex(startIndex);
      }
      if (typeof game.loadPuzzle === "function") {
        game.loadPuzzle(levels[startIndex]);
      }
      if (typeof game.highlightCurrentLevelButton === "function") {
        game.highlightCurrentLevelButton();
      }
      if (typeof game.enablePlayerControls === "function") {
        game.enablePlayerControls();
      }
    }
  };

  if (startButton) startButton.addEventListener("click", onStart);

  const restartBtn = document.getElementById("restartLevelBtn");
  const undoMoveBtn = document.getElementById("undoMoveBtn");
  const onRestart = () => {
    if (typeof game.restartLevel === "function") game.restartLevel();
    else console.error("restartLevel() not found");
  };
  const onUndo = () => {
    if (typeof game.undoMove === "function") game.undoMove();
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
