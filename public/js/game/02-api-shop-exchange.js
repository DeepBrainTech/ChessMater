/**
 * game/02-api-shop-exchange.js
 * API auth, credits, portal shop, exchange modal defs (setup*() calls deferred — no cross-file hoist)
 * Split from game.js lines 162-1027 — logic unchanged.
 */
function updateUndoButtonLabel() {
  if (!undoMoveButton) return;
  undoMoveButton.textContent = `Undo(${undoCredits})`;
  if (typeof window.cmEmitGameUi === "function") {
    window.cmEmitGameUi({ type: "undoCredits", undoCredits });
  }
}

function updateAntigravityButtonLabel() {
  if (!antigravityToggleButton) return;
  const state = antigravityEnabled ? "ON" : "OFF";
  if (antigravityUnlockedThisRun) {
    antigravityToggleButton.textContent = `Antigravity ${state}`;
  } else {
    antigravityToggleButton.textContent = `Antigravity(${antigravityCredits})`;
  }
  if (typeof window.cmEmitGameUi === "function") {
    window.cmEmitGameUi({
      type: "antigravity",
      antigravityCredits,
      antigravityEnabled,
      antigravityUnlockedThisRun,
    });
  }
}

function getApiBaseUrl() {
  return window.API_BASE_URL || "https://chessmater-production.up.railway.app";
}

function buildAuthHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (window.cmToken) {
    headers.Authorization = `Bearer ${window.cmToken}`;
  }
  return headers;
}

function getTokenExpSeconds(token) {
  if (!token || typeof token !== "string") return null;
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(atob(parts[1]));
    const exp = Number.parseInt(payload?.exp, 10);
    return Number.isFinite(exp) ? exp : null;
  } catch (_) {
    return null;
  }
}

function shouldRefreshGameTokenSoon(token, bufferSeconds = 45) {
  const exp = getTokenExpSeconds(token);
  if (!exp) return true;
  const now = Math.floor(Date.now() / 1000);
  return exp - now <= bufferSeconds;
}

async function refreshGameTokenFromPortal(force = false) {
  if (!force && !shouldRefreshGameTokenSoon(window.cmToken)) return !!window.cmToken;
  if (window.cmRefreshPromise) return window.cmRefreshPromise;

  window.cmRefreshPromise = (async () => {
    const base = normalizePortalApiBase(window.cmPortalApiBase || "");
    if (!base) return false;

    try {
      const sessionRes = await fetch(`${base}/api/games/chessmater/session`, {
        method: "GET",
        credentials: "include"
      });
      if (sessionRes.status === 401) {
        if (typeof window.cmGetPortalLoginUrl === "function") {
          window.location.href = window.cmGetPortalLoginUrl();
        } else {
          const next = encodeURIComponent(location.href);
          window.location.href = "https://deepbraintechnology.com/zh/login?next=" + next;
        }
        return false;
      }
      const sessionData = await sessionRes.json().catch(() => null);
      const sessionToken =
        sessionData?.data?.game_token ||
        sessionData?.data?.token ||
        sessionData?.game_token ||
        sessionData?.token ||
        null;
      if (sessionRes.ok && sessionToken && typeof sessionToken === "string") {
        window.cmToken = sessionToken;
        if (sessionData?.data?.user) {
          window.cmUser = sessionData.data.user;
        }
        return true;
      }
      return false;
    } catch (_) {
      return false;
    } finally {
      window.cmRefreshPromise = null;
    }
  })();

  return window.cmRefreshPromise;
}

async function apiFetchWithAuthRetry(path, options = {}) {
  await (window.authReady || Promise.resolve());

  const firstHeaders = { ...(options.headers || {}) };
  if (!firstHeaders.Authorization && window.cmToken) {
    firstHeaders.Authorization = `Bearer ${window.cmToken}`;
  }

  let response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    credentials: "include",
    headers: firstHeaders
  });

  if (response.status !== 401) return response;

  const refreshed = await refreshGameTokenFromPortal(true);
  if (!refreshed) return response;

  const retryHeaders = { ...(options.headers || {}) };
  if (window.cmToken) {
    retryHeaders.Authorization = `Bearer ${window.cmToken}`;
  }

  response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    credentials: "include",
    headers: retryHeaders
  });
  return response;
}

window.refreshGameTokenFromPortal = refreshGameTokenFromPortal;
window.apiFetchWithAuthRetry = apiFetchWithAuthRetry;

async function syncUndoCreditsFromServer() {
  try {
    const res = await apiFetchWithAuthRetry("/undo-credits", {
      method: "GET",
      headers: buildAuthHeaders()
    });
    if (!res.ok) return false;
    const data = await res.json();
    const credits = Number.parseInt(data?.undoCredits, 10);
    undoCredits = Number.isFinite(credits) ? credits : 0;
    updateUndoButtonLabel();
    return true;
  } catch (_) {
    return false;
  }
}

async function syncAntigravityCreditsFromServer() {
  try {
    const res = await apiFetchWithAuthRetry("/antigravity-credits", {
      method: "GET",
      headers: buildAuthHeaders()
    });
    if (!res.ok) return false;
    const data = await res.json();
    const credits = Number.parseInt(data?.antigravityCredits, 10);
    antigravityCredits = Number.isFinite(credits) ? credits : 0;
    updateAntigravityButtonLabel();
    return true;
  } catch (_) {
    return false;
  }
}

async function grantUndoCredit(amount = 1) {
  const parsed = Number.parseInt(amount, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return;

  try {
    const res = await apiFetchWithAuthRetry("/undo-credits/grant", {
      method: "POST",
      headers: buildAuthHeaders(),
      body: JSON.stringify({ amount: parsed })
    });
    if (res.ok) {
      const data = await res.json();
      const credits = Number.parseInt(data?.undoCredits, 10);
      undoCredits = Number.isFinite(credits) ? credits : undoCredits + parsed;
      updateUndoButtonLabel();
      return;
    }
  } catch (_) {}

  undoCredits += parsed;
  updateUndoButtonLabel();
}

async function consumeUndoCredit(amount = 1) {
  const parsed = Number.parseInt(amount, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return false;

  try {
    const res = await apiFetchWithAuthRetry("/undo-credits/use", {
      method: "POST",
      headers: buildAuthHeaders(),
      body: JSON.stringify({ amount: parsed })
    });
    if (res.status === 400) {
      return false;
    }
    if (res.ok) {
      const data = await res.json();
      const credits = Number.parseInt(data?.undoCredits, 10);
      undoCredits = Number.isFinite(credits) ? credits : Math.max(undoCredits - parsed, 0);
      updateUndoButtonLabel();
      return true;
    }
  } catch (_) {}

  if (undoCredits < parsed) return false;
  undoCredits -= parsed;
  updateUndoButtonLabel();
  return true;
}

async function grantAntigravityCreditsFromServerOnly(amount = 1) {
  const parsed = Number.parseInt(amount, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return false;
  try {
    const res = await apiFetchWithAuthRetry("/antigravity-credits/grant", {
      method: "POST",
      headers: buildAuthHeaders(),
      body: JSON.stringify({ amount: parsed })
    });
    if (!res.ok) return false;
    const data = await res.json();
    const credits = Number.parseInt(data?.antigravityCredits, 10);
    antigravityCredits = Number.isFinite(credits) ? credits : antigravityCredits + parsed;
    updateAntigravityButtonLabel();
    return true;
  } catch (_) {
    return false;
  }
}

async function consumeAntigravityCredit(amount = 1) {
  const parsed = Number.parseInt(amount, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return false;
  try {
    const res = await apiFetchWithAuthRetry("/antigravity-credits/use", {
      method: "POST",
      headers: buildAuthHeaders(),
      body: JSON.stringify({ amount: parsed })
    });
    if (res.status === 400) return false;
    if (res.ok) {
      const data = await res.json();
      const credits = Number.parseInt(data?.antigravityCredits, 10);
      antigravityCredits = Number.isFinite(credits) ? credits : Math.max(antigravityCredits - parsed, 0);
      updateAntigravityButtonLabel();
      return true;
    }
  } catch (_) {}

  if (antigravityCredits < parsed) return false;
  antigravityCredits -= parsed;
  updateAntigravityButtonLabel();
  return true;
}

/** Main portal shop item (must match portal config). */
const PORTAL_UNDO_ITEM_ID = "chess_mater_undo";
const PORTAL_ANTIGRAVITY_ITEM_ID = "chess_mater_antigravity";
const PORTAL_REPLAY_ITEM_ID = "chess_mater_reply";
const PORTAL_UNDO_GAME_MODE = "chessmater";

/** Fallback display prices when portal catalog/item fetch fails or API base is unset (align with shop_items.py). */
const SHOP_ITEM_FALLBACK_COST = {
  [PORTAL_UNDO_ITEM_ID]: { coins: 5, diamonds: 0, flowers: 0 },
  [PORTAL_ANTIGRAVITY_ITEM_ID]: { coins: 5, diamonds: 0, flowers: 0 },
  [PORTAL_REPLAY_ITEM_ID]: { coins: 0, diamonds: 2, flowers: 0 }
};

const shopPriceCache = {};
let shopCatalogWarmPromise = null;

function normalizePortalApiBase(base) {
  if (!base || typeof base !== "string") return "";
  return base.replace(/\/+$/, "");
}

function portalUndoShopAvailable() {
  const base = normalizePortalApiBase(window.cmPortalApiBase || "");
  return !!base;
}

function normalizePortalShopCost(raw) {
  const coins = Number(raw?.coins);
  const diamonds = Number(raw?.diamonds);
  const flowers = Number(raw?.flowers);
  return {
    coins: Number.isFinite(coins) ? Math.max(0, Math.floor(coins)) : 0,
    diamonds: Number.isFinite(diamonds) ? Math.max(0, Math.floor(diamonds)) : 0,
    flowers: Number.isFinite(flowers) ? Math.max(0, Math.floor(flowers)) : 0
  };
}

function getFallbackShopCost(itemId) {
  return SHOP_ITEM_FALLBACK_COST[itemId] || { coins: 0, diamonds: 0, flowers: 0 };
}

const CM_CURRENCY_ICON_SRC = {
  coin: (window.CM_ASSETS && window.CM_ASSETS.ui && window.CM_ASSETS.ui.coin) || "/assets/images/coin.svg",
  diamond: (window.CM_ASSETS && window.CM_ASSETS.ui && window.CM_ASSETS.ui.diamond) || "/assets/images/diamond.svg",
  flower: (window.CM_ASSETS && window.CM_ASSETS.ui && window.CM_ASSETS.ui.flower) || "/assets/images/flower.svg",
};

function currencyIconImgHtml(kind) {
  const src = CM_CURRENCY_ICON_SRC[kind];
  if (!src) return "";
  return `<img class="undo-exchange-currency-icon" src="${src}" alt="" aria-hidden="true" width="18" height="18" />`;
}

function formatShopCostForExchangeLineHtml(cost) {
  const c = normalizePortalShopCost(cost);
  const parts = [];
  if (c.coins > 0) {
    parts.push(
      `<span class="undo-exchange-cost-part">${currencyIconImgHtml("coin")}<span class="undo-exchange-cost-num">${c.coins}</span></span>`
    );
  }
  if (c.diamonds > 0) {
    parts.push(
      `<span class="undo-exchange-cost-part">${currencyIconImgHtml("diamond")}<span class="undo-exchange-cost-num">${c.diamonds}</span></span>`
    );
  }
  if (c.flowers > 0) {
    parts.push(
      `<span class="undo-exchange-cost-part">${currencyIconImgHtml("flower")}<span class="undo-exchange-cost-num">${c.flowers}</span></span>`
    );
  }
  if (!parts.length) return "—";
  return parts.join('<span class="undo-exchange-cost-sep">, </span>');
}

function refreshLevelCompleteReplayLockCostEl() {
  if (!levelCompleteReplayLockCostEl) return;
  levelCompleteReplayLockCostEl.textContent = "…";
  void (async () => {
    const cost = await ensureShopCostCached(PORTAL_REPLAY_ITEM_ID);
    levelCompleteReplayLockCostEl.innerHTML = formatShopCostForExchangeLineHtml(cost);
  })();
}

async function warmShopPriceCache() {
  const base = normalizePortalApiBase(window.cmPortalApiBase || "");
  if (!base) return;
  if (!shopCatalogWarmPromise) {
    shopCatalogWarmPromise = (async () => {
      try {
        const res = await fetch(
          `${base}/api/games/shop/catalog?game_mode=${encodeURIComponent(PORTAL_UNDO_GAME_MODE)}`,
          { method: "GET" }
        );
        const json = await res.json().catch(() => null);
        if (!res.ok || json == null || json.success === false || !json.data || typeof json.data.items !== "object") {
          return;
        }
        for (const [id, row] of Object.entries(json.data.items)) {
          if (row && row.cost && typeof row.cost === "object") {
            shopPriceCache[id] = normalizePortalShopCost(row.cost);
          }
        }
      } catch (_) {}
    })();
  }
  await shopCatalogWarmPromise;
}

async function ensureShopCostCached(itemId) {
  if (shopPriceCache[itemId]) return shopPriceCache[itemId];
  const base = normalizePortalApiBase(window.cmPortalApiBase || "");
  if (!base) return getFallbackShopCost(itemId);

  await warmShopPriceCache();
  if (shopPriceCache[itemId]) return shopPriceCache[itemId];

  try {
    const res = await fetch(
      `${base}/api/games/shop/item?item_id=${encodeURIComponent(itemId)}&game_mode=${encodeURIComponent(PORTAL_UNDO_GAME_MODE)}`,
      { method: "GET" }
    );
    const json = await res.json().catch(() => null);
    if (res.ok && json && json.success !== false && json.data && json.data.cost && typeof json.data.cost === "object") {
      const c = normalizePortalShopCost(json.data.cost);
      shopPriceCache[itemId] = c;
      return c;
    }
  } catch (_) {}

  return getFallbackShopCost(itemId);
}

async function getPortalAssets() {
  const base = normalizePortalApiBase(window.cmPortalApiBase || "");
  if (!base) return null;
  try {
    const res = await fetch(`${base}/api/user/assets`, {
      credentials: "include",
      headers: {
        "X-User-Timezone": Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
      }
    });
    const data = await res.json().catch(() => null);
    const coins = data?.data?.coins;
    const diamonds = data?.data?.diamonds;
    const flowers = data?.data?.flowers;
    if (typeof coins !== "number" || typeof diamonds !== "number" || typeof flowers !== "number") {
      return null;
    }
    return {
      coins: Math.max(0, Math.floor(coins)),
      diamonds: Math.max(0, Math.floor(diamonds)),
      flowers: Math.max(0, Math.floor(flowers))
    };
  } catch (_) {
    return null;
  }
}

async function postPortalRedeemUndo() {
  return postPortalRedeemItem(PORTAL_UNDO_ITEM_ID);
}

async function postPortalRedeemItem(itemId) {
  const base = normalizePortalApiBase(window.cmPortalApiBase || "");
  if (!base) return { ok: false, message: "Portal session not available." };
  const url = `${base}/api/user/shop/redeem?item_id=${encodeURIComponent(itemId)}&game_mode=${encodeURIComponent(PORTAL_UNDO_GAME_MODE)}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: {
        "X-User-Timezone": Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
      }
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const msg =
        (data && (data.message || data.error || data.detail)) ||
        `Redeem failed (${res.status}).`;
      return { ok: false, message: String(msg) };
    }
    if (data && data.success === false) {
      const msg = (data.message || data.error || "Redeem rejected.") + "";
      return { ok: false, message: msg };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err && err.message ? err.message : "Network error during redeem." };
  }
}

async function grantUndoCreditsFromServerOnly(amount = 1) {
  const parsed = Number.parseInt(amount, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return false;
  try {
    const res = await apiFetchWithAuthRetry("/undo-credits/grant", {
      method: "POST",
      headers: buildAuthHeaders(),
      body: JSON.stringify({ amount: parsed })
    });
    if (!res.ok) return false;
    const data = await res.json();
    const credits = Number.parseInt(data?.undoCredits, 10);
    if (Number.isFinite(credits)) {
      undoCredits = credits;
    } else {
      undoCredits += parsed;
    }
    updateUndoButtonLabel();
    return true;
  } catch (_) {
    return false;
  }
}

const undoExchangeModal = document.getElementById("undoExchangeModal");
const undoExchangeCoinsEl = document.getElementById("undoExchangeCoins");
const undoExchangeDiamondsEl = document.getElementById("undoExchangeDiamonds");
const undoExchangeFlowersEl = document.getElementById("undoExchangeFlowers");
const undoExchangeMessageEl = document.getElementById("undoExchangeMessage");
const undoExchangeRedeemBtn = document.getElementById("undoExchangeRedeemBtn");
const undoExchangeCloseBtn = document.getElementById("undoExchangeCloseBtn");
const undoExchangeCostTextEl = document.getElementById("undoExchangeCostText");
const antigravityExchangeModal = document.getElementById("antigravityExchangeModal");
const antigravityExchangeCoinsEl = document.getElementById("antigravityExchangeCoins");
const antigravityExchangeDiamondsEl = document.getElementById("antigravityExchangeDiamonds");
const antigravityExchangeFlowersEl = document.getElementById("antigravityExchangeFlowers");
const antigravityExchangeMessageEl = document.getElementById("antigravityExchangeMessage");
const antigravityExchangeRedeemBtn = document.getElementById("antigravityExchangeRedeemBtn");
const antigravityExchangeCloseBtn = document.getElementById("antigravityExchangeCloseBtn");
const antigravityExchangeCostTextEl = document.getElementById("antigravityExchangeCostText");
const replayExchangeModal = document.getElementById("replayExchangeModal");
const replayExchangeCoinsEl = document.getElementById("replayExchangeCoins");
const replayExchangeDiamondsEl = document.getElementById("replayExchangeDiamonds");
const replayExchangeFlowersEl = document.getElementById("replayExchangeFlowers");
const replayExchangeMessageEl = document.getElementById("replayExchangeMessage");
const replayExchangeRedeemBtn = document.getElementById("replayExchangeRedeemBtn");
const replayExchangeCloseBtn = document.getElementById("replayExchangeCloseBtn");
const replayExchangeCostTextEl = document.getElementById("replayExchangeCostText");

function setUndoExchangeBalanceCells(coinsText, diamondsText, flowersText) {
  if (undoExchangeCoinsEl) undoExchangeCoinsEl.textContent = coinsText;
  if (undoExchangeDiamondsEl) undoExchangeDiamondsEl.textContent = diamondsText;
  if (undoExchangeFlowersEl) undoExchangeFlowersEl.textContent = flowersText;
}

function setUndoExchangeMessage(text, kind) {
  if (!undoExchangeMessageEl) return;
  undoExchangeMessageEl.textContent = text || "";
  undoExchangeMessageEl.classList.remove("error", "success", "hint");
  if (kind === "error") undoExchangeMessageEl.classList.add("error");
  if (kind === "success") undoExchangeMessageEl.classList.add("success");
  if (kind === "hint") undoExchangeMessageEl.classList.add("hint");
}

function setUndoExchangeBusy(busy) {
  if (!undoExchangeRedeemBtn) return;
  undoExchangeRedeemBtn.disabled = !!busy || !portalUndoShopAvailable();
}

function closeUndoExchangeModal() {
  if (!undoExchangeModal) return;
  undoExchangeModal.classList.remove("active");
  undoExchangeModal.setAttribute("aria-hidden", "true");
}

async function refreshUndoExchangeAssetsDisplay() {
  if (!portalUndoShopAvailable()) {
    setUndoExchangeBalanceCells("—", "—", "—");
    setUndoExchangeMessage("Open from the main portal to load your coins, diamonds, and flowers.", "hint");
    return;
  }
  setUndoExchangeMessage("");
  setUndoExchangeBalanceCells("…", "…", "…");
  const assets = await getPortalAssets();
  if (!assets) {
    setUndoExchangeBalanceCells("—", "—", "—");
    setUndoExchangeMessage("Could not load assets. Check portal session.", "error");
    return;
  }
  setUndoExchangeBalanceCells(String(assets.coins), String(assets.diamonds), String(assets.flowers));
}

async function openUndoExchangeModal() {
  if (!undoExchangeModal) return;
  if (undoExchangeCostTextEl) undoExchangeCostTextEl.textContent = "…";
  setUndoExchangeMessage("");
  undoExchangeModal.classList.add("active");
  undoExchangeModal.setAttribute("aria-hidden", "false");
  setUndoExchangeBusy(false);
  const [, cost] = await Promise.all([
    refreshUndoExchangeAssetsDisplay(),
    ensureShopCostCached(PORTAL_UNDO_ITEM_ID)
  ]);
  if (undoExchangeCostTextEl) undoExchangeCostTextEl.innerHTML = formatShopCostForExchangeLineHtml(cost);
}

async function handleUndoExchangeRedeem() {
  if (!portalUndoShopAvailable()) return;
  setUndoExchangeMessage("");
  setUndoExchangeBusy(true);
  const redeem = await postPortalRedeemUndo();
  if (!redeem.ok) {
    setUndoExchangeMessage(redeem.message || "Redeem failed.", "error");
    setUndoExchangeBusy(false);
    await refreshUndoExchangeAssetsDisplay();
    return;
  }
  const granted = await grantUndoCreditsFromServerOnly(1);
  if (!granted) {
    setUndoExchangeMessage(
      "Portal redeem may have succeeded, but adding undo credits failed. Please refresh or contact support if coins were deducted.",
      "error"
    );
    setUndoExchangeBusy(false);
    await syncUndoCreditsFromServer();
    await refreshUndoExchangeAssetsDisplay();
    return;
  }
  await refreshUndoExchangeAssetsDisplay();
  await syncUndoCreditsFromServer();
  setUndoExchangeBusy(false);
  closeUndoExchangeModal();
}

function setupUndoExchangeModal() {
  if (undoExchangeCloseBtn) {
    undoExchangeCloseBtn.addEventListener("click", closeUndoExchangeModal);
  }
  if (undoExchangeModal) {
    undoExchangeModal.addEventListener("click", (e) => {
      if (e.target === undoExchangeModal) closeUndoExchangeModal();
    });
  }
  if (undoExchangeRedeemBtn) {
    undoExchangeRedeemBtn.addEventListener("click", () => {
      handleUndoExchangeRedeem();
    });
  }
}

setupUndoExchangeModal();
window.openUndoExchangeModal = openUndoExchangeModal;
window.warmShopPriceCache = warmShopPriceCache;
queueMicrotask(() => {
  if (portalUndoShopAvailable()) void warmShopPriceCache();
});

function setGenericExchangeBalanceCells(coinsEl, diamondsEl, flowersEl, coinsText, diamondsText, flowersText) {
  if (coinsEl) coinsEl.textContent = coinsText;
  if (diamondsEl) diamondsEl.textContent = diamondsText;
  if (flowersEl) flowersEl.textContent = flowersText;
}

function setGenericExchangeMessage(messageEl, text, kind) {
  if (!messageEl) return;
  messageEl.textContent = text || "";
  messageEl.classList.remove("error", "success", "hint");
  if (kind === "error") messageEl.classList.add("error");
  if (kind === "success") messageEl.classList.add("success");
  if (kind === "hint") messageEl.classList.add("hint");
}

async function fetchReplayUnlockStatusForLevel(levelNumber) {
  const lvl = Number.parseInt(levelNumber, 10);
  if (!Number.isFinite(lvl) || lvl <= 0) return false;
  try {
    const res = await apiFetchWithAuthRetry(`/replay-unlocks/status?level=${encodeURIComponent(lvl)}`, {
      method: "GET",
      headers: buildAuthHeaders()
    });
    if (!res.ok) return false;
    const data = await res.json();
    return !!data?.unlocked;
  } catch (_) {
    return false;
  }
}

async function activateReplayUnlockForLevel(levelNumber) {
  const lvl = Number.parseInt(levelNumber, 10);
  if (!Number.isFinite(lvl) || lvl <= 0) return false;
  try {
    const res = await apiFetchWithAuthRetry("/replay-unlocks/activate", {
      method: "POST",
      headers: buildAuthHeaders(),
      body: JSON.stringify({ level: lvl })
    });
    return res.ok;
  } catch (_) {
    return false;
  }
}

function closeAntigravityExchangeModal() {
  if (!antigravityExchangeModal) return;
  antigravityExchangeModal.classList.remove("active");
  antigravityExchangeModal.setAttribute("aria-hidden", "true");
}

async function refreshAntigravityExchangeAssetsDisplay() {
  if (!portalUndoShopAvailable()) {
    setGenericExchangeBalanceCells(antigravityExchangeCoinsEl, antigravityExchangeDiamondsEl, antigravityExchangeFlowersEl, "—", "—", "—");
    setGenericExchangeMessage(antigravityExchangeMessageEl, "Open from the main portal to load your coins, diamonds, and flowers.", "hint");
    return;
  }
  setGenericExchangeMessage(antigravityExchangeMessageEl, "");
  setGenericExchangeBalanceCells(antigravityExchangeCoinsEl, antigravityExchangeDiamondsEl, antigravityExchangeFlowersEl, "…", "…", "…");
  const assets = await getPortalAssets();
  if (!assets) {
    setGenericExchangeBalanceCells(antigravityExchangeCoinsEl, antigravityExchangeDiamondsEl, antigravityExchangeFlowersEl, "—", "—", "—");
    setGenericExchangeMessage(antigravityExchangeMessageEl, "Could not load assets. Check portal session.", "error");
    return;
  }
  setGenericExchangeBalanceCells(antigravityExchangeCoinsEl, antigravityExchangeDiamondsEl, antigravityExchangeFlowersEl, String(assets.coins), String(assets.diamonds), String(assets.flowers));
}

function setAntigravityExchangeBusy(busy) {
  if (!antigravityExchangeRedeemBtn) return;
  antigravityExchangeRedeemBtn.disabled = !!busy || !portalUndoShopAvailable();
}

async function openAntigravityExchangeModal() {
  if (!antigravityExchangeModal) return;
  if (antigravityExchangeCostTextEl) antigravityExchangeCostTextEl.textContent = "…";
  setGenericExchangeMessage(antigravityExchangeMessageEl, "");
  antigravityExchangeModal.classList.add("active");
  antigravityExchangeModal.setAttribute("aria-hidden", "false");
  setAntigravityExchangeBusy(false);
  const [, cost] = await Promise.all([
    refreshAntigravityExchangeAssetsDisplay(),
    ensureShopCostCached(PORTAL_ANTIGRAVITY_ITEM_ID)
  ]);
  if (antigravityExchangeCostTextEl) antigravityExchangeCostTextEl.innerHTML = formatShopCostForExchangeLineHtml(cost);
}

async function handleAntigravityExchangeRedeem() {
  if (!portalUndoShopAvailable()) return;
  setGenericExchangeMessage(antigravityExchangeMessageEl, "");
  setAntigravityExchangeBusy(true);
  const redeem = await postPortalRedeemItem(PORTAL_ANTIGRAVITY_ITEM_ID);
  if (!redeem.ok) {
    setGenericExchangeMessage(antigravityExchangeMessageEl, redeem.message || "Redeem failed.", "error");
    setAntigravityExchangeBusy(false);
    await refreshAntigravityExchangeAssetsDisplay();
    return;
  }
  const granted = await grantAntigravityCreditsFromServerOnly(1);
  if (!granted) {
    setGenericExchangeMessage(antigravityExchangeMessageEl, "Portal redeem may have succeeded, but adding antigravity credits failed. Please refresh.", "error");
    setAntigravityExchangeBusy(false);
    await syncAntigravityCreditsFromServer();
    await refreshAntigravityExchangeAssetsDisplay();
    return;
  }
  await refreshAntigravityExchangeAssetsDisplay();
  await syncAntigravityCreditsFromServer();
  setAntigravityExchangeBusy(false);
  closeAntigravityExchangeModal();
}

function setupAntigravityExchangeModal() {
  if (antigravityExchangeCloseBtn) antigravityExchangeCloseBtn.addEventListener("click", closeAntigravityExchangeModal);
  if (antigravityExchangeModal) {
    antigravityExchangeModal.addEventListener("click", (e) => {
      if (e.target === antigravityExchangeModal) closeAntigravityExchangeModal();
    });
  }
  if (antigravityExchangeRedeemBtn) {
    antigravityExchangeRedeemBtn.addEventListener("click", () => {
      handleAntigravityExchangeRedeem();
    });
  }
}

function closeReplayExchangeModal() {
  if (!replayExchangeModal) return;
  replayExchangeModal.classList.remove("active");
  replayExchangeModal.setAttribute("aria-hidden", "true");
}

async function refreshReplayExchangeAssetsDisplay() {
  if (!portalUndoShopAvailable()) {
    setGenericExchangeBalanceCells(replayExchangeCoinsEl, replayExchangeDiamondsEl, replayExchangeFlowersEl, "—", "—", "—");
    setGenericExchangeMessage(replayExchangeMessageEl, "Open from the main portal to load your coins, diamonds, and flowers.", "hint");
    return;
  }
  setGenericExchangeMessage(replayExchangeMessageEl, "");
  setGenericExchangeBalanceCells(replayExchangeCoinsEl, replayExchangeDiamondsEl, replayExchangeFlowersEl, "…", "…", "…");
  const assets = await getPortalAssets();
  if (!assets) {
    setGenericExchangeBalanceCells(replayExchangeCoinsEl, replayExchangeDiamondsEl, replayExchangeFlowersEl, "—", "—", "—");
    setGenericExchangeMessage(replayExchangeMessageEl, "Could not load assets. Check portal session.", "error");
    return;
  }
  setGenericExchangeBalanceCells(replayExchangeCoinsEl, replayExchangeDiamondsEl, replayExchangeFlowersEl, String(assets.coins), String(assets.diamonds), String(assets.flowers));
}

function setReplayExchangeBusy(busy) {
  if (!replayExchangeRedeemBtn) return;
  replayExchangeRedeemBtn.disabled = !!busy || !portalUndoShopAvailable();
}

async function openReplayExchangeModal() {
  if (!replayExchangeModal) return;
  if (replayExchangeCostTextEl) replayExchangeCostTextEl.textContent = "…";
  setGenericExchangeMessage(replayExchangeMessageEl, "");
  replayExchangeModal.classList.add("active");
  replayExchangeModal.setAttribute("aria-hidden", "false");
  setReplayExchangeBusy(false);
  const [, cost] = await Promise.all([
    refreshReplayExchangeAssetsDisplay(),
    ensureShopCostCached(PORTAL_REPLAY_ITEM_ID)
  ]);
  if (replayExchangeCostTextEl) replayExchangeCostTextEl.innerHTML = formatShopCostForExchangeLineHtml(cost);
}

async function handleReplayExchangeRedeem() {
  if (!portalUndoShopAvailable()) return;
  const levelNumber = currentLevelIndex + 1;
  if (!Number.isFinite(levelNumber) || levelNumber <= 0) return;
  setGenericExchangeMessage(replayExchangeMessageEl, "");
  setReplayExchangeBusy(true);
  const redeem = await postPortalRedeemItem(PORTAL_REPLAY_ITEM_ID);
  if (!redeem.ok) {
    setGenericExchangeMessage(replayExchangeMessageEl, redeem.message || "Redeem failed.", "error");
    setReplayExchangeBusy(false);
    await refreshReplayExchangeAssetsDisplay();
    return;
  }
  const activated = await activateReplayUnlockForLevel(levelNumber);
  if (!activated) {
    setGenericExchangeMessage(replayExchangeMessageEl, "Redeem succeeded, but replay unlock sync failed. Please refresh.", "error");
    setReplayExchangeBusy(false);
    await refreshReplayExchangeAssetsDisplay();
    return;
  }

  replayUnlockedForLevel = true;
  await fetchFewestOtherMovesForCurrentLevel();
  updateLevelCompleteReplayDisplay();
  await refreshReplayExchangeAssetsDisplay();
  setReplayExchangeBusy(false);
  closeReplayExchangeModal();
  closeHintModal();
  const onLevelComplete =
    levelCompleteModal && levelCompleteModal.classList.contains("active");
  if (!onLevelComplete) {
    openInGameWalkthroughModal();
  }
}

function setupReplayExchangeModal() {
  if (replayExchangeCloseBtn) replayExchangeCloseBtn.addEventListener("click", closeReplayExchangeModal);
  if (replayExchangeModal) {
    replayExchangeModal.addEventListener("click", (e) => {
      if (e.target === replayExchangeModal) closeReplayExchangeModal();
    });
  }
  if (replayExchangeRedeemBtn) {
    replayExchangeRedeemBtn.addEventListener("click", () => {
      handleReplayExchangeRedeem();
    });
  }
  if (levelCompleteReplayLock) {
    levelCompleteReplayLock.addEventListener("click", () => {
      openReplayExchangeModal();
    });
  }
}

function setupInGameWalkthrough() {
  if (hintSolutionActionBtn) {
    hintSolutionActionBtn.addEventListener("click", () => {
      handleSolutionGuideAction();
    });
  }
  const closeWalkthrough = () => closeInGameWalkthroughModal();
  if (closeInGameWalkthroughModalBtn) {
    closeInGameWalkthroughModalBtn.addEventListener("click", closeWalkthrough);
  }
  if (inGameWalkthroughCloseBtn) {
    inGameWalkthroughCloseBtn.addEventListener("click", closeWalkthrough);
  }
  if (inGameWalkthroughModal) {
    inGameWalkthroughModal.addEventListener("click", (e) => {
      if (e.target === inGameWalkthroughModal) closeWalkthrough();
    });
  }
}

function setupHintModal() {
  if (blockTipToggle && blockTipModal) {
    blockTipToggle.addEventListener("click", () => {
      openHintModal();
    });
  }
  const closeBtn = document.getElementById("closeBlockTip");
  if (blockTipModal && closeBtn) {
    closeBtn.addEventListener("click", closeHintModal);
    blockTipModal.addEventListener("click", (e) => {
      if (e.target === blockTipModal) closeHintModal();
    });
  }
}
