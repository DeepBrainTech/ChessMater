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
    btnRect.left >= gridRect.left && btnRect.right <= gridRect.right;
  if (!fullyVisible) {
    levelGrid.scrollTo({
      left: levelGrid.scrollLeft + btnRect.left - gridRect.left - (gridRect.width - btnRect.width) / 2,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
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
    if (idx === current) btn.setAttribute("aria-current", "step");
    else btn.removeAttribute("aria-current");
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

  const currentIndex =
    typeof game.cmGetCurrentLevelIndex === "function"
      ? game.cmGetCurrentLevelIndex()
      : 0;

  levels.forEach((level, index) => {
    const button = document.createElement("button");
    const isLocked = index + 1 > maxUnlocked;

    button.className = "level-button";
    button.textContent = String(index + 1);
    button.title = level.name || `Level ${index + 1}`;
    button.setAttribute("aria-label", `${level.name || `Level ${index + 1}`}${isLocked ? " (locked)" : ""}`);
    button.dataset.levelIndex = String(index + 1);
    button.type = "button";

    if (index + 1 === maxUnlocked) maxUnlockedButton = button;

    if (isLocked) {
      button.classList.add("locked");
      button.setAttribute("aria-disabled", "true");
      button.addEventListener("click", () => {
        if (typeof game.updateStatus === "function") {
          game.updateStatus("This level is locked. Complete earlier levels first!");
        }
      });
    } else {
      if (index + 1 < maxUnlocked) button.classList.add("completed");
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
      button.setAttribute("aria-current", "step");
      currentLevelButton = button;
    }

    levelGrid.appendChild(button);
  });

  const scrollTargetButton = currentLevelButton || maxUnlockedButton;
  if (scrollTargetButton) {
    requestAnimationFrame(() => {
      const gridRect = levelGrid.getBoundingClientRect();
      const buttonRect = scrollTargetButton.getBoundingClientRect();
      levelGrid.scrollLeft += buttonRect.left - gridRect.left - (gridRect.width - buttonRect.width) / 2;
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
  return initLevelRailScroll();
}

function initLevelRailScroll() {
  const rail = document.getElementById("levelGrid");
  if (!rail) return () => {};
  const controller = new AbortController();
  const { signal } = controller;
  let drag = null;
  let suppressClickUntil = 0;

  rail.addEventListener("pointerdown", event => {
    // Touch scrolling keeps the browser's native direction locking and inertia.
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    suppressClickUntil = 0;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, scrollLeft: rail.scrollLeft, moved: false };
  }, { signal });

  window.addEventListener("pointermove", event => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved) {
      if (Math.abs(dx) < 6 || Math.abs(dx) <= Math.abs(dy)) return;
      drag.moved = true;
      rail.classList.add("is-dragging");
      rail.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    rail.scrollLeft = drag.scrollLeft - dx;
  }, { signal, passive: false });

  const finishDrag = event => {
    if (!drag || event.pointerId !== drag.id) return;
    if (drag.moved) suppressClickUntil = performance.now() + 300;
    const pointerId = drag.id;
    drag = null;
    rail.classList.remove("is-dragging");
    if (rail.hasPointerCapture(pointerId)) rail.releasePointerCapture(pointerId);
  };
  window.addEventListener("pointerup", finishDrag, { signal });
  window.addEventListener("pointercancel", finishDrag, { signal });
  rail.addEventListener("lostpointercapture", finishDrag, { signal });
  rail.addEventListener("click", event => {
    // A horizontal drag must not open the level under the release position.
    if (event.detail !== 0 && performance.now() < suppressClickUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
      suppressClickUntil = 0;
    }
  }, { signal, capture: true });

  rail.addEventListener("wheel", event => {
    if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rail.clientWidth : 1;
    const before = rail.scrollLeft;
    rail.scrollLeft += event.deltaY * unit;
    if (rail.scrollLeft !== before) event.preventDefault();
  }, { signal, passive: false });

  return () => {
    controller.abort();
    if (drag && rail.hasPointerCapture(drag.id)) rail.releasePointerCapture(drag.id);
    drag = null;
    rail.classList.remove("is-dragging");
  };
}
