import { session } from '../services/session.js';
import { game } from '../game/runtime.js';
import { initRotateNotice } from "./rotateNotice.js";
import { initMusicControls } from "./musicControls.js";
import { initLeaderboardAndGuide } from "./leaderboard.js";
import { initLevelSelectApi } from "./levelSelect.js";
import { initStartFlow } from "./startFlow.js";

/** Initialize page interactions after the game mounts. */
export async function initPageUi(signal) {
  if (game.__cmPageUiInitialized) return () => {};
  game.__cmPageUiInitialized = true;
  const runtime = game;

  const cleanups = [];
  const cleanup = () => {
    cleanups.forEach((fn) => {
      if (typeof fn === "function") fn();
    });
    runtime.__cmPageUiInitialized = false;
  };
  if (signal?.aborted) { cleanup(); return () => {}; }
  cleanups.push(initRotateNotice());
  cleanups.push(initMusicControls());
  cleanups.push(initLeaderboardAndGuide());
  initLevelSelectApi();
  try {
    cleanups.push(await initStartFlow(signal));
  } catch (error) {
    cleanup();
    throw error;
  }
  if (signal?.aborted) { cleanup(); return () => {}; }

  if (typeof session.cmUpdateCurrentUserName === "function") {
    session.cmUpdateCurrentUserName();
  }

  return cleanup;
}
