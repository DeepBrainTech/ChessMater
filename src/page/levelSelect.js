import { session } from '../services/session.js';
import { game } from '../game/runtime.js';
function isLoggedIn() {
  return !!(session.cmUser && (session.cmToken || session.cmSessionReady));
}

function getLevels() {
  return typeof game.LEVELS !== "undefined" && Array.isArray(game.LEVELS)
    ? game.LEVELS
    : [];
}

function mergeMaxUnlocked(value) {
  const parsed = Number.parseInt(value, 10);
  const candidate = Number.isFinite(parsed) ? parsed : 1;
  const merged = Math.max(game.currentMaxUnlocked || 1, candidate);
  game.currentMaxUnlocked = merged;
  return merged;
}

async function fetchProgress() {
  const levels = getLevels();
  if (session.isLocalDev) {
    const allLevels = levels.length > 0 ? levels.length : 999;
    return mergeMaxUnlocked(allLevels);
  }
  try {
    await (session.authReady || Promise.resolve());
    const headers = {};
    if (session.cmToken) {
      headers.Authorization = `Bearer ${session.cmToken}`;
    }

    const authFetch =
      typeof game.apiFetchWithAuthRetry === "function"
        ? game.apiFetchWithAuthRetry
        : null;
    const res = authFetch
      ? await authFetch("/progress", { headers })
      : await fetch(
          `${session.API_BASE_URL || "https://chessmater-production.up.railway.app"}/progress`,
          { credentials: "include", headers }
        );

    if (!res.ok) return mergeMaxUnlocked(1);

    const data = await res.json();
    const maxUnlocked = parseInt(data.maxUnlocked || "1", 10);
    return mergeMaxUnlocked(maxUnlocked);
  } catch (err) {
    return mergeMaxUnlocked(1);
  }
}

function ensureCurrentLevelVisible() {
  const levelGrid = document.getElementById("levelGrid");
  if (!levelGrid) return;
  const currentButton = levelGrid.querySelector(".level-button.current-level");
  if (!currentButton) return;

  const gridRect = levelGrid.getBoundingClientRect();
  const btnRect = currentButton.getBoundingClientRect();
  const fullyVisible =
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
  const levelGrid = document.getElementById("levelGrid");
  if (!levelGrid) return;
  const current =
    typeof game.cmGetCurrentLevelIndex === "function"
      ? game.cmGetCurrentLevelIndex()
      : 0;
  const buttons = levelGrid.querySelectorAll(".level-button");
  buttons.forEach((btn, idx) => {
    if (idx === current) btn.classList.add("current-level");
    else btn.classList.remove("current-level");
  });
  requestAnimationFrame(ensureCurrentLevelVisible);
  if (typeof game.cmEmitGameUi === "function") {
    game.cmEmitGameUi({ type: "currentLevel", currentLevelIndex: current });
  }
}

export async function loadLevels(optionalMaxUnlocked) {
  const levelGrid = document.getElementById("levelGrid");
  if (!levelGrid) return;
  levelGrid.innerHTML = "";
  let currentLevelButton = null;
  let maxUnlockedButton = null;
  const levels = getLevels();

  let maxUnlocked;
  if (optionalMaxUnlocked !== undefined) {
    maxUnlocked = mergeMaxUnlocked(optionalMaxUnlocked);
  } else {
    maxUnlocked = await fetchProgress();
  }

  if (session.isLocalDev) {
    maxUnlocked = levels.length;
    mergeMaxUnlocked(maxUnlocked);
  }

  const currentIndex =
    typeof game.cmGetCurrentLevelIndex === "function"
      ? game.cmGetCurrentLevelIndex()
      : 0;

  levels.forEach((level, index) => {
    const button = document.createElement("button");
    const isLocked = index + 1 > maxUnlocked;

    button.className = "level-button";
    button.textContent = level.name || `Level ${index + 1}`;
    button.dataset.levelIndex = String(index + 1);
    button.type = "button";

    if (index + 1 === maxUnlocked) maxUnlockedButton = button;

    if (isLocked) {
      button.style.background = "#777";
      button.style.cursor = "not-allowed";
      button.style.opacity = "0.5";
      button.textContent += " 🔒";
      button.addEventListener("click", () => {
        if (typeof game.updateStatus === "function") {
          game.updateStatus("This level is locked. Complete earlier levels first!");
        }
      });
    } else {
      button.style.background = "linear-gradient(145deg, #4a90e2, #357abd)";
      button.addEventListener("click", () => {
        if (typeof game.cmSetCurrentLevelIndex === "function") {
          game.cmSetCurrentLevelIndex(index);
        }
        if (typeof game.setGameState === "function") game.setGameState(true);
        if (typeof game.loadPuzzle === "function") game.loadPuzzle(level);
        highlightCurrentLevelButton();
      });
    }

    if (index === currentIndex) {
      button.classList.add("current-level");
      currentLevelButton = button;
    }

    levelGrid.appendChild(button);
  });

  const scrollTargetButton = currentLevelButton || maxUnlockedButton;
  if (scrollTargetButton) {
    requestAnimationFrame(() => {
      scrollTargetButton.scrollIntoView({ block: "center", inline: "nearest" });
    });
  }

  if (typeof game.cmEmitGameUi === "function") {
    game.cmEmitGameUi({
      type: "levelsLoaded",
      maxUnlocked,
      levelCount: levels.length,
      currentLevelIndex: currentIndex,
    });
  }
}

export function initLevelSelectApi() {
  game.currentMaxUnlocked = game.currentMaxUnlocked || 1;
  game.mergeMaxUnlocked = mergeMaxUnlocked;
  game.loadLevels = loadLevels;
  game.highlightCurrentLevelButton = highlightCurrentLevelButton;
  game.ensureCurrentLevelVisible = ensureCurrentLevelVisible;
  game.fetchProgress = fetchProgress;
  game.isLoggedIn = isLoggedIn;
}
