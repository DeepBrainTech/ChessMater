/**
 * Auth / portal bootstrap — behavior preserved from the previous index.html inline script.
 * Runs once before React mounts so window.authReady / cmToken are available early.
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
  window.isLocalDev = isLocalDev;
  window.API_BASE_URL = isLocalDev
    ? `http://${host || "localhost"}:3000`
    : "https://chessmater-production.up.railway.app";
  window.cmPortalApiBase = isLocalDev ? "" : "https://api.deepbraintechnology.com";

  const hashHadContent = window.location.hash.replace(/^#/, "").length > 0;
  const initialHash = new URLSearchParams(window.location.hash.slice(1));
  let gameToken = initialHash.get("token");
  const locale =
    initialHash.get("locale") || localStorage.getItem("cm_locale") || "en";
  window.cmPortalHashBalances = {
    coins: Number(initialHash.get("coins") ?? 0) || 0,
    diamonds: Number(initialHash.get("diamonds") ?? 0) || 0,
    flowers: Number(initialHash.get("flowers") ?? 0) || 0,
  };
  localStorage.setItem("cm_locale", locale);

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

  window.cmGetPortalLoginUrl = function () {
    const loc = (localStorage.getItem("cm_locale") || "en").toLowerCase();
    const prefix = loc.startsWith("zh") ? "zh" : "en";
    return (
      "https://deepbraintechnology.com/" +
      prefix +
      "/login?next=" +
      encodeURIComponent(location.href)
    );
  };

  window.cmToken = null;
  window.cmUser = null;
  window.cmSessionReady = false;
  let user = null;

  function updateCurrentUserName() {
    const el1 = document.getElementById("startScreenUserName");
    const el2 = document.getElementById("mainContainerUserName");
    if (!el1 && !el2) return;
    const u = window.cmUser;
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
  window.cmUpdateCurrentUserName = updateCurrentUserName;

  function verifyPortalGameToken(token) {
    try {
      const payload = token.split(".")[1];
      user = JSON.parse(atob(payload));
    } catch (err) {
      console.error("JWT parse error:", err);
      window.cmSessionReady = false;
      return Promise.resolve();
    }
    return fetch(`${window.API_BASE_URL}/api/auth/verify`, {
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
          window.cmToken = token;
          window.cmUser = data.user;
          window.cmSessionReady = true;
          updateCurrentUserName();
          if (typeof window.updateLoginPromptVisibility === "function")
            window.updateLoginPromptVisibility();
        } else {
          console.error("Token verification failed:", data.message);
          window.cmToken = token;
          window.cmUser = user
            ? { id: user.sub, username: user.username, portal_user_id: user.user_id }
            : null;
          window.cmSessionReady = false;
          updateCurrentUserName();
          if (typeof window.updateLoginPromptVisibility === "function")
            window.updateLoginPromptVisibility();
        }
        return data;
      })
      .catch((err) => {
        console.error("Token verify request failed:", err);
        window.cmToken = token;
        window.cmUser = user
          ? { id: user.sub, username: user.username, portal_user_id: user.user_id }
          : null;
        window.cmSessionReady = false;
        updateCurrentUserName();
        if (typeof window.updateLoginPromptVisibility === "function")
          window.updateLoginPromptVisibility();
      });
  }

  if (isLocalDev && !gameToken) {
    console.log("🔧 本地开发模式：自动设置测试用户");
    window.cmToken = "dev-token";
    window.cmUser = {
      id: 999,
      username: "dev_user",
      portal_user_id: "999",
      user_id: 999,
    };
    window.cmSessionReady = true;
    window.authReady = Promise.resolve();
    updateCurrentUserName();
    if (typeof window.updateLoginPromptVisibility === "function")
      window.updateLoginPromptVisibility();
  } else if (gameToken) {
    window.authReady = verifyPortalGameToken(gameToken);
  } else {
    window.authReady = (async () => {
      const portalBase = String(window.cmPortalApiBase || "").replace(/\/+$/, "");
      let restored = false;

      if (portalBase) {
        try {
          const sessionRes = await fetch(portalBase + "/api/games/chessmater/session", {
            method: "GET",
            credentials: "include",
          });
          if (sessionRes.status === 401) {
            window.location.href = window.cmGetPortalLoginUrl();
            return null;
          }
          const sessionData = await sessionRes.json().catch(() => null);
          const freshGameToken =
            sessionData?.data?.game_token ||
            sessionData?.data?.token ||
            sessionData?.game_token ||
            sessionData?.token ||
            null;
          const portalUser = sessionData?.data?.user || null;
          if (sessionRes.ok && typeof freshGameToken === "string" && freshGameToken) {
            window.cmToken = freshGameToken;
            if (portalUser) {
              window.cmUser = portalUser;
            }
            const verifyRes = await fetch(`${window.API_BASE_URL}/api/auth/verify`, {
              method: "POST",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + freshGameToken,
              },
            });
            const verifyData = await verifyRes.json().catch(() => null);
            if (verifyData?.success && verifyData?.user) {
              window.cmUser = verifyData.user;
              window.cmSessionReady = true;
              restored = true;
            } else if (window.cmUser) {
              window.cmSessionReady = false;
              restored = true;
            }
          }
        } catch (_) {}
      }

      if (!restored) {
        const response = await fetch(`${window.API_BASE_URL}/api/auth/me`, {
          method: "GET",
          credentials: "include",
        }).catch(() => null);
        const data = response ? await response.json().catch(() => null) : null;
        if (data && data.success && data.user) {
          window.cmUser = data.user;
          window.cmSessionReady = true;
        } else {
          window.cmSessionReady = false;
        }
        updateCurrentUserName();
        if (typeof window.updateLoginPromptVisibility === "function")
          window.updateLoginPromptVisibility();
        return data;
      }

      updateCurrentUserName();
      if (typeof window.updateLoginPromptVisibility === "function")
        window.updateLoginPromptVisibility();
      return { success: true, user: window.cmUser };
    })();
  }

  window.checkTokenStatus = function () {
    /* debug: token status */
  };
  window.detectInterference = function () {
    /* debug: extension check */
  };
}
