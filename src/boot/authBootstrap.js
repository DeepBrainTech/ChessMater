import { session } from '../services/session.js';
import { game } from '../game/runtime.js';
import { capturePortalLocale, getPortalUrl } from "./portalLocale.js";

/**
 * Initialize the Portal session before React mounts the board.
 */

function isPrivateLanHost(hostname) {
  if (!hostname) return false;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  const match172 = hostname.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (match172) {
    const second = Number(match172[1]);
    return second >= 16 && second <= 31;
  }
  return false;
}

export function bootstrapAuth() {
  const host = window.location.hostname;
  const isLocalDev =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "" ||
    isPrivateLanHost(host);
  session.isLocalDev = isLocalDev;
  session.API_BASE_URL = isLocalDev
    ? `http://${host || "localhost"}:3000`
    : "https://chessmater-production.up.railway.app";
  session.cmPortalApiBase = isLocalDev ? "" : "https://api.deepbraintechnology.com";

  const hashHadContent = window.location.hash.replace(/^#/, "").length > 0;
  const initialHash = new URLSearchParams(window.location.hash.slice(1));
  let gameToken = initialHash.get("token");
  capturePortalLocale();
  session.cmPortalHashBalances = {
    coins: Number(initialHash.get("coins") ?? 0) || 0,
    diamonds: Number(initialHash.get("diamonds") ?? 0) || 0,
    flowers: Number(initialHash.get("flowers") ?? 0) || 0,
  };

  if (hashHadContent) {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }

  try {
    sessionStorage.removeItem("cm_portal_token");
    sessionStorage.removeItem("cm_portal_api_base");
  } catch (_) {}

  if (gameToken) {
    localStorage.removeItem("access_token");
    localStorage.removeItem("userId");
    localStorage.removeItem("user_name");
    localStorage.removeItem("user_password");
    localStorage.removeItem("sso_token");
  }

  session.cmGetPortalLoginUrl = function () {
    return getPortalUrl("login") + "?next=" + encodeURIComponent(location.href);
  };

  session.cmToken = null;
  session.cmUser = null;
  session.cmSessionReady = false;
  let user = null;

  function updateCurrentUserName() {
    const el1 = document.getElementById("startScreenUserName");
    const el2 = document.getElementById("mainContainerUserName");
    if (!el1 && !el2) return;
    const u = session.cmUser;
    const text = u
      ? u.username ||
        u.user_id ||
        (u.portal_user_id ? String(u.portal_user_id) : "") ||
        ""
      : "";
    const display = text ? "current user: " + text : "";
    if (el1) el1.textContent = display;
    if (el2) el2.textContent = display;
  }
  session.cmUpdateCurrentUserName = updateCurrentUserName;

  function verifyPortalGameToken(token) {
    try {
      const payload = token.split(".")[1];
      user = JSON.parse(atob(payload));
    } catch (err) {
      console.error("JWT parse error:", err);
      session.cmSessionReady = false;
      return Promise.resolve();
    }
    return fetch(`${session.API_BASE_URL}/api/auth/verify`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          session.cmToken = token;
          session.cmUser = data.user;
          session.cmSessionReady = true;
          updateCurrentUserName();
          if (typeof game.updateLoginPromptVisibility === "function")
            game.updateLoginPromptVisibility();
        } else {
          console.error("Token verification failed:", data.message);
          session.cmToken = token;
          session.cmUser = user
            ? { id: user.sub, username: user.username, portal_user_id: user.user_id }
            : null;
          session.cmSessionReady = false;
          updateCurrentUserName();
          if (typeof game.updateLoginPromptVisibility === "function")
            game.updateLoginPromptVisibility();
        }
        return data;
      })
      .catch((err) => {
        console.error("Token verify request failed:", err);
        session.cmToken = token;
        session.cmUser = user
          ? { id: user.sub, username: user.username, portal_user_id: user.user_id }
          : null;
        session.cmSessionReady = false;
        updateCurrentUserName();
        if (typeof game.updateLoginPromptVisibility === "function")
          game.updateLoginPromptVisibility();
      });
  }

  if (isLocalDev && !gameToken) {
    console.log("🔧 本地开发模式：自动设置测试用户");
    session.cmToken = "dev-token";
    session.cmUser = {
      id: 999,
      username: "dev_user",
      portal_user_id: "999",
      user_id: 999,
    };
    session.cmSessionReady = true;
    session.authReady = Promise.resolve();
    updateCurrentUserName();
    if (typeof game.updateLoginPromptVisibility === "function")
      game.updateLoginPromptVisibility();
  } else if (gameToken) {
    session.authReady = verifyPortalGameToken(gameToken);
  } else {
    session.authReady = (async () => {
      const portalBase = String(session.cmPortalApiBase || "").replace(/\/+$/, "");
      let restored = false;

      if (portalBase) {
        try {
          const sessionRes = await fetch(portalBase + "/api/games/chessmater/session", {
            method: "GET",
            credentials: "include",
          });
          if (sessionRes.status === 401) {
            window.location.href = session.cmGetPortalLoginUrl();
            return null;
          }
          const sessionData = await sessionRes.json().catch(() => null);
          const freshGameToken =
            sessionData?.data?.game_token || null;
          const portalUser = sessionData?.data?.user || null;
          if (sessionRes.ok && typeof freshGameToken === "string" && freshGameToken) {
            session.cmToken = freshGameToken;
            if (portalUser) {
              session.cmUser = portalUser;
            }
            const verifyRes = await fetch(`${session.API_BASE_URL}/api/auth/verify`, {
              method: "POST",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + freshGameToken,
              },
            });
            const verifyData = await verifyRes.json().catch(() => null);
            if (verifyData?.success && verifyData?.user) {
              session.cmUser = verifyData.user;
              session.cmSessionReady = true;
              restored = true;
            } else if (session.cmUser) {
              session.cmSessionReady = false;
              restored = true;
            }
          }
        } catch (_) {}
      }

      if (!restored) {
        const response = await fetch(`${session.API_BASE_URL}/api/auth/me`, {
          method: "GET",
          credentials: "include",
        }).catch(() => null);
        const data = response ? await response.json().catch(() => null) : null;
        if (data && data.success && data.user) {
          session.cmUser = data.user;
          session.cmSessionReady = true;
        } else {
          session.cmSessionReady = false;
        }
        updateCurrentUserName();
        if (typeof game.updateLoginPromptVisibility === "function")
          game.updateLoginPromptVisibility();
        return data;
      }

      updateCurrentUserName();
      if (typeof game.updateLoginPromptVisibility === "function")
        game.updateLoginPromptVisibility();
      return { success: true, user: session.cmUser };
    })();
  }

}
