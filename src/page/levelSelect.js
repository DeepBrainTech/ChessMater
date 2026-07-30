function isLoggedIn() {
  return !!(window.cmUser && (window.cmToken || window.cmSessionReady));
}

function getLevels() {
  return typeof window.LEVELS !== "undefined" && Array.isArray(window.LEVELS)
    ? window.LEVELS
    : typeof LEVELS !== "undefined" && Array.isArray(LEVELS)
      ? LEVELS
      : [];
}

function mergeMaxUnlocked(value) {
  const parsed = Number.parseInt(value, 10);
  const candidate = Number.isFinite(parsed) ? parsed : 1;
  const merged = Math.max(window.currentMaxUnlocked || 1, candidate);
  window.currentMaxUnlocked = merged;
  return merged;
}

async function fetchProgress() {
  const levels = getLevels();
  if (window.isLocalDev) {
    const allLevels = levels.length > 0 ? levels.length : 999;
    return mergeMaxUnlocked(allLevels);
  }
  try {
    await (window.authReady || Promise.resolve());
    const headers = {};
    if (window.cmToken) {
      headers.Authorization = `Bearer ${window.cmToken}`;
    }

    const authFetch =
      typeof window.apiFetchWithAuthRetry === "function"
        ? window.apiFetchWithAuthRetry
        : null;
    const res = authFetch
      ? await authFetch("/progress", { headers })
      : await fetch(
          `${window.API_BASE_URL || "https://chessmater-production.up.railway.app"}/progress`,
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
    typeof window.cmGetCurrentLevelIndex === "function"
      ? window.cmGetCurrentLevelIndex()
      : 0;
  const buttons = levelGrid.querySelectorAll(".level-button");
  buttons.forEach((btn, idx) => {
    if (idx === current) btn.classList.add("current-level");
    else btn.classList.remove("current-level");
  });
  requestAnimationFrame(ensureCurrentLevelVisible);
  if (typeof window.cmEmitGameUi === "function") {
    window.cmEmitGameUi({ type: "currentLevel", currentLevelIndex: current });
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

  if (window.isLocalDev) {
    maxUnlocked = levels.length;
    mergeMaxUnlocked(maxUnlocked);
  }

  const currentIndex =
    typeof window.cmGetCurrentLevelIndex === "function"
      ? window.cmGetCurrentLevelIndex()
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
        if (typeof window.updateStatus === "function") {
          window.updateStatus("This level is locked. Complete earlier levels first!");
        }
      });
    } else {
      button.style.background = "linear-gradient(145deg, #4a90e2, #357abd)";
      button.addEventListener("click", () => {
        if (typeof window.cmSetCurrentLevelIndex === "function") {
          window.cmSetCurrentLevelIndex(index);
        }
        if (typeof window.setGameState === "function") window.setGameState(true);
        if (typeof window.loadPuzzle === "function") window.loadPuzzle(level);
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

  if (typeof window.cmEmitGameUi === "function") {
    window.cmEmitGameUi({
      type: "levelsLoaded",
      maxUnlocked,
      levelCount: levels.length,
      currentLevelIndex: currentIndex,
    });
  }
}

export function initLevelSelectApi() {
  window.currentMaxUnlocked = window.currentMaxUnlocked || 1;
  window.mergeMaxUnlocked = mergeMaxUnlocked;
  window.loadLevels = loadLevels;
  window.highlightCurrentLevelButton = highlightCurrentLevelButton;
  window.ensureCurrentLevelVisible = ensureCurrentLevelVisible;
  window.fetchProgress = fetchProgress;
  window.isLoggedIn = isLoggedIn;
}
