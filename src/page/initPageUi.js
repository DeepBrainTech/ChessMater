import { initRotateNotice } from "./rotateNotice.js";
import { initMusicControls } from "./musicControls.js";
import { initLeaderboardAndGuide } from "./leaderboard.js";
import { initLevelSelectApi } from "./levelSelect.js";
import { initStartFlow } from "./startFlow.js";

/**
 * Page chrome previously in public/js/page-ui.js — now React-bootstrapped modules.
 * Still talks to the classic game engine via window.* APIs.
 */
export async function initPageUi() {
  if (window.__cmPageUiInitialized) return () => {};
  window.__cmPageUiInitialized = true;

  const cleanups = [];
  cleanups.push(initRotateNotice());
  cleanups.push(initMusicControls());
  cleanups.push(initLeaderboardAndGuide());
  initLevelSelectApi();
  cleanups.push(await initStartFlow());

  if (typeof window.cmUpdateCurrentUserName === "function") {
    window.cmUpdateCurrentUserName();
  }

  return () => {
    cleanups.forEach((fn) => {
      if (typeof fn === "function") fn();
    });
    window.__cmPageUiInitialized = false;
  };
}
