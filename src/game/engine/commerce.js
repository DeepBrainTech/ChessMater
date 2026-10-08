import { session } from '../../services/session.js';
export function register(game) {
  game.updateUndoButtonLabel = function () {
    if (!game.undoMoveButton) return;
    if (game.CM_EDITOR_PAGE) game.undoMoveButton.textContent = `Undo(${game.undoCredits})`;
    if (typeof game.cmEmitGameUi === "function") {
      game.cmEmitGameUi({
        type: "undoCredits",
        undoCredits: game.undoCredits
      });
    }
  };
  game.updateAntigravityButtonLabel = function () {
    if (!game.antigravityToggleButton) return;
    const state = game.antigravityEnabled ? "ON" : "OFF";
    if (game.antigravityUnlockedThisRun) {
      if (game.CM_EDITOR_PAGE) game.antigravityToggleButton.textContent = `Antigravity ${state}`;
    } else {
      if (game.CM_EDITOR_PAGE) game.antigravityToggleButton.textContent = `Antigravity(${game.antigravityCredits})`;
    }
    if (typeof game.cmEmitGameUi === "function") {
      game.cmEmitGameUi({
        type: "antigravity",
        antigravityCredits: game.antigravityCredits,
        antigravityEnabled: game.antigravityEnabled,
        antigravityUnlockedThisRun: game.antigravityUnlockedThisRun
      });
    }
  };
  game.getApiBaseUrl = function () {
    return session.API_BASE_URL || "https://chessmater-production.up.railway.app";
  };
  game.buildAuthHeaders = function () {
    const headers = {
      "Content-Type": "application/json"
    };
    if (session.cmToken) {
      headers.Authorization = `Bearer ${session.cmToken}`;
    }
    return headers;
  };
  game.getTokenExpSeconds = function (token) {
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
  };
  game.shouldRefreshGameTokenSoon = function (token, bufferSeconds = 45) {
    const exp = game.getTokenExpSeconds(token);
    if (!exp) return true;
    const now = Math.floor(Date.now() / 1000);
    return exp - now <= bufferSeconds;
  };
  game.refreshGameTokenFromPortal = async function (force = false) {
    if (!force && !game.shouldRefreshGameTokenSoon(session.cmToken)) return !!session.cmToken;
    if (session.cmRefreshPromise) return session.cmRefreshPromise;
    session.cmRefreshPromise = (async () => {
      const base = game.normalizePortalApiBase(session.cmPortalApiBase || "");
      if (!base) return false;
      try {
        const sessionRes = await fetch(`${base}/api/games/chessmater/session`, {
          method: "GET",
          credentials: "include"
        });
        if (sessionRes.status === 401) {
          if (typeof session.cmGetPortalLoginUrl === "function") {
            window.location.href = session.cmGetPortalLoginUrl();
          } else {
            const next = encodeURIComponent(location.href);
            window.location.href = "https://deepbraintechnology.com/zh/login?next=" + next;
          }
          return false;
        }
        const sessionData = await sessionRes.json().catch(() => null);
        const sessionToken = sessionData?.data?.game_token || null;
        if (sessionRes.ok && sessionToken && typeof sessionToken === "string") {
          session.cmToken = sessionToken;
          if (sessionData?.data?.user) {
            session.cmUser = sessionData.data.user;
          }
          return true;
        }
        return false;
      } catch (_) {
        return false;
      } finally {
        session.cmRefreshPromise = null;
      }
    })();
    return session.cmRefreshPromise;
  };
  game.apiFetchWithAuthRetry = async function (path, options = {}) {
    await (session.authReady || Promise.resolve());
    const firstHeaders = {
      ...(options.headers || {})
    };
    if (!firstHeaders.Authorization && session.cmToken) {
      firstHeaders.Authorization = `Bearer ${session.cmToken}`;
    }
    let response = await fetch(`${game.getApiBaseUrl()}${path}`, {
      ...options,
      credentials: "include",
      headers: firstHeaders
    });
    if (response.status !== 401) return response;
    const refreshed = await game.refreshGameTokenFromPortal(true);
    if (!refreshed) return response;
    const retryHeaders = {
      ...(options.headers || {})
    };
    if (session.cmToken) {
      retryHeaders.Authorization = `Bearer ${session.cmToken}`;
    }
    response = await fetch(`${game.getApiBaseUrl()}${path}`, {
      ...options,
      credentials: "include",
      headers: retryHeaders
    });
    return response;
  };
  game.syncUndoCreditsFromServer = async function () {
    try {
      const res = await game.apiFetchWithAuthRetry("/undo-credits", {
        method: "GET",
        headers: game.buildAuthHeaders()
      });
      if (!res.ok) return false;
      const data = await res.json();
      const credits = Number.parseInt(data?.undoCredits, 10);
      game.localUndoCredits = Number.isFinite(credits) ? credits : 0;
      await game.syncPortalInventory();
      game.undoCredits = game.localUndoCredits + (game.portalQuantities[game.PORTAL_UNDO_ITEM_ID] || 0);
      game.updateUndoButtonLabel();
      return true;
    } catch (_) {
      return false;
    }
  };
  game.syncAntigravityCreditsFromServer = async function () {
    try {
      const res = await game.apiFetchWithAuthRetry("/antigravity-credits", {
        method: "GET",
        headers: game.buildAuthHeaders()
      });
      if (!res.ok) return false;
      const data = await res.json();
      const credits = Number.parseInt(data?.antigravityCredits, 10);
      game.localAntigravityCredits = Number.isFinite(credits) ? credits : 0;
      await game.syncPortalInventory();
      game.antigravityCredits = game.localAntigravityCredits + (game.portalQuantities[game.PORTAL_ANTIGRAVITY_ITEM_ID] || 0);
      game.updateAntigravityButtonLabel();
      return true;
    } catch (_) {
      return false;
    }
  };
  game.consumeUndoCredit = async function (amount = 1) {
    return game.consumeGameCredit(game.PORTAL_UNDO_ITEM_ID, '/undo-credits/use', amount);
  };
  game.consumeAntigravityCredit = async function (amount = 1) {
    return game.consumeGameCredit(game.PORTAL_ANTIGRAVITY_ITEM_ID, '/antigravity-credits/use', amount);
  };
  game.getPortalCommerce = function () {
    const base = game.normalizePortalApiBase(session.cmPortalApiBase || '');
    if (!base) throw new Error('Portal session not available.');
    if (!game.cmCommerceClient || game.cmCommerceBase !== base) {
      game.cmCommerceBase = base;
      game.cmCommerceClient = new game.PortalInventoryClient(base, 'chessmater', () => game.gameAccountId(session.cmToken) || Number(session.cmUser?.portal_user_id || session.cmUser?.user_id || session.cmUser?.id) || null);
    }
    return game.cmCommerceClient;
  };
  game.syncPortalInventory = async function () {
    try {
      const portal = game.getPortalCommerce();
      await portal.assertAccount();
      const inventory = await portal.inventory();
      game.portalQuantities = Object.fromEntries(inventory.items.map(item => [item.item_id, item.quantity]));
    } catch (_) {/* Unavailable inventory cannot authorize a game action. */}
    game.undoCredits = game.localUndoCredits + (game.portalQuantities[game.PORTAL_UNDO_ITEM_ID] || 0);
    game.antigravityCredits = game.localAntigravityCredits + (game.portalQuantities[game.PORTAL_ANTIGRAVITY_ITEM_ID] || 0);
    game.updateUndoButtonLabel();
    game.updateAntigravityButtonLabel();
  };
  game.consumeGameCredit = async function (itemId, localPath, amount) {
    if (!Number.isSafeInteger(amount) || amount <= 0 || game.creditUsesBusy.has(itemId)) return false;
    game.creditUsesBusy.add(itemId);
    try {
      if ((game.portalQuantities[itemId] || 0) >= amount || game.portalUndoShopAvailable() && game.getPortalCommerce().hasPendingUse(itemId, amount)) {
        const used = await game.getPortalCommerce().useItem(itemId, amount);
        game.portalQuantities[itemId] = used.inventory_quantity;
        await game.syncPortalInventory();
        return true;
      }
      const res = await game.apiFetchWithAuthRetry(localPath, {
        method: 'POST',
        headers: game.buildAuthHeaders(),
        body: JSON.stringify({
          amount
        })
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (!data.success) return false;
      if (itemId === game.PORTAL_UNDO_ITEM_ID) game.localUndoCredits = data.undoCredits;else game.localAntigravityCredits = data.antigravityCredits;
      await game.syncPortalInventory();
      return true;
    } catch (_) {
      return false;
    } finally {
      game.creditUsesBusy.delete(itemId);
    }
  };
  game.portalUndoShopAvailable = function () {
    const base = game.normalizePortalApiBase(session.cmPortalApiBase || "");
    return !!base;
  };
  game.currencyIconImgHtml = function (kind) {
    const src = game.CM_CURRENCY_ICON_SRC[kind];
    if (!src) return "";
    return `<img class="undo-exchange-currency-icon" src="${src}" alt="" aria-hidden="true" width="18" height="18" />`;
  };
  game.formatShopCostForExchangeLineHtml = function (cost) {
    if (!cost) return "—";
    const c = game.normalizePortalShopCost(cost);
    const parts = [];
    if (c.coins > 0) {
      parts.push(`<span class="undo-exchange-cost-part">${game.currencyIconImgHtml("coin")}<span class="undo-exchange-cost-num">${c.coins}</span></span>`);
    }
    if (c.diamonds > 0) {
      parts.push(`<span class="undo-exchange-cost-part">${game.currencyIconImgHtml("diamond")}<span class="undo-exchange-cost-num">${c.diamonds}</span></span>`);
    }
    if (c.flowers > 0) {
      parts.push(`<span class="undo-exchange-cost-part">${game.currencyIconImgHtml("flower")}<span class="undo-exchange-cost-num">${c.flowers}</span></span>`);
    }
    if (!parts.length) return "0";
    return parts.join('<span class="undo-exchange-cost-sep">, </span>');
  };
  game.refreshLevelCompleteReplayLockCostEl = function () {
    if (!game.levelCompleteReplayLockCostEl) return;
    game.levelCompleteReplayLockCostEl.textContent = "…";
    void (async () => {
      const cost = await game.ensureShopCostCached(game.PORTAL_REPLAY_ITEM_ID);
      game.levelCompleteReplayLockCostEl.innerHTML = game.formatShopCostForExchangeLineHtml(cost);
    })();
  };
  game.warmShopPriceCache = async function () {
    const base = game.normalizePortalApiBase(session.cmPortalApiBase || "");
    if (!base) return;
    if (!game.shopCatalogWarmPromise) {
      game.shopCatalogWarmPromise = (async () => {
        try {
          const res = await fetch(`${base}/api/games/shop/catalog?game_mode=${encodeURIComponent(game.PORTAL_UNDO_GAME_MODE)}`, {
            method: "GET"
          });
          const json = await res.json().catch(() => null);
          if (!res.ok || json == null || json.success === false || !json.data || typeof json.data.items !== "object") {
            return;
          }
          for (const [id, row] of Object.entries(json.data.items)) {
            if (row && row.cost && typeof row.cost === "object") {
              game.shopPriceCache[id] = game.normalizePortalShopCost(row.cost);
            }
          }
        } catch (_) {}
      })();
    }
    await game.shopCatalogWarmPromise;
  };
  game.ensureShopCostCached = async function (itemId) {
    try {
      const portal = game.getPortalCommerce();
      let cost;
      if (itemId === game.PORTAL_REPLAY_ITEM_ID) {
        cost = (await portal.quote('replay')).cost;
      } else {
        cost = (await portal.catalog()).items[itemId]?.cost;
      }
      if (!cost || Object.values(cost).some(value => !Number.isSafeInteger(value) || value < 0)) throw new Error('invalid_shop_cost');
      game.shopPriceCache[itemId] = game.normalizePortalShopCost(cost);
      return game.shopPriceCache[itemId];
    } catch (_) {
      delete game.shopPriceCache[itemId];
      return null;
    }
  };
  game.getPortalAssets = async function () {
    const base = game.normalizePortalApiBase(session.cmPortalApiBase || "");
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
  };
  game.postPortalRedeemUndo = async function () {
    return game.postPortalRedeemItem(game.PORTAL_UNDO_ITEM_ID);
  };
  game.postPortalRedeemItem = async function (itemId) {
    try {
      const result = await game.getPortalCommerce().buyItem(itemId);
      game.portalQuantities[itemId] = result.inventory_quantity;
      await game.syncPortalInventory();
      return {
        ok: true,
        data: result
      };
    } catch (err) {
      return {
        ok: false,
        message: err?.message || 'Redeem failed.'
      };
    }
  };
  game.setUndoExchangeBalanceCells = function (coinsText, diamondsText, flowersText) {
    if (game.undoExchangeCoinsEl) game.undoExchangeCoinsEl.textContent = coinsText;
    if (game.undoExchangeDiamondsEl) game.undoExchangeDiamondsEl.textContent = diamondsText;
    if (game.undoExchangeFlowersEl) game.undoExchangeFlowersEl.textContent = flowersText;
  };
  game.setUndoExchangeMessage = function (text, kind) {
    if (!game.undoExchangeMessageEl) return;
    game.undoExchangeMessageEl.textContent = text || "";
    game.undoExchangeMessageEl.classList.remove("error", "success", "hint");
    if (kind === "error") game.undoExchangeMessageEl.classList.add("error");
    if (kind === "success") game.undoExchangeMessageEl.classList.add("success");
    if (kind === "hint") game.undoExchangeMessageEl.classList.add("hint");
  };
  game.setUndoExchangeBusy = function (busy) {
    if (!game.undoExchangeRedeemBtn) return;
    game.undoExchangeRedeemBtn.disabled = !!busy || !game.portalUndoShopAvailable() || !game.shopPriceCache[game.PORTAL_UNDO_ITEM_ID];
  };
  game.closeUndoExchangeModal = function () {
    if (!game.undoExchangeModal) return;
    game.undoExchangeModal.classList.remove("active");
    game.undoExchangeModal.setAttribute("aria-hidden", "true");
  };
  game.refreshUndoExchangeAssetsDisplay = async function () {
    if (!game.portalUndoShopAvailable()) {
      game.setUndoExchangeBalanceCells("—", "—", "—");
      game.setUndoExchangeMessage("Open from the main portal to load your coins, diamonds, and flowers.", "hint");
      return;
    }
    game.setUndoExchangeMessage("");
    game.setUndoExchangeBalanceCells("…", "…", "…");
    const assets = await game.getPortalAssets();
    if (!assets) {
      game.setUndoExchangeBalanceCells("—", "—", "—");
      game.setUndoExchangeMessage("Could not load assets. Check portal session.", "error");
      return;
    }
    game.setUndoExchangeBalanceCells(String(assets.coins), String(assets.diamonds), String(assets.flowers));
  };
  game.openUndoExchangeModal = async function () {
    if (!game.undoExchangeModal) return;
    if (game.undoExchangeCostTextEl) game.undoExchangeCostTextEl.textContent = "…";
    game.setUndoExchangeMessage("");
    game.undoExchangeModal.classList.add("active");
    game.undoExchangeModal.setAttribute("aria-hidden", "false");
    game.setUndoExchangeBusy(true);
    const [, cost] = await Promise.all([game.refreshUndoExchangeAssetsDisplay(), game.ensureShopCostCached(game.PORTAL_UNDO_ITEM_ID)]);
    if (game.undoExchangeCostTextEl) game.undoExchangeCostTextEl.innerHTML = game.formatShopCostForExchangeLineHtml(cost);
    game.setUndoExchangeBusy(false);
  };
  game.handleUndoExchangeRedeem = async function () {
    if (!game.portalUndoShopAvailable()) return;
    game.setUndoExchangeMessage("");
    game.setUndoExchangeBusy(true);
    const redeem = await game.postPortalRedeemUndo();
    if (!redeem.ok) {
      game.setUndoExchangeMessage(redeem.message || "Redeem failed.", "error");
      game.setUndoExchangeBusy(false);
      await game.refreshUndoExchangeAssetsDisplay();
      return;
    }
    await game.refreshUndoExchangeAssetsDisplay();
    await game.syncUndoCreditsFromServer();
    game.setUndoExchangeBusy(false);
    game.closeUndoExchangeModal();
  };
  game.setupUndoExchangeModal = function () {
    if (game.undoExchangeCloseBtn) {
      game.lifecycle.listen(game.undoExchangeCloseBtn, "click", game.closeUndoExchangeModal);
    }
    if (game.undoExchangeModal) {
      game.lifecycle.listen(game.undoExchangeModal, "click", e => {
        if (e.target === game.undoExchangeModal) game.closeUndoExchangeModal();
      });
    }
    if (game.undoExchangeRedeemBtn) {
      game.lifecycle.listen(game.undoExchangeRedeemBtn, "click", () => {
        game.handleUndoExchangeRedeem();
      });
    }
  };
  game.setGenericExchangeBalanceCells = function (coinsEl, diamondsEl, flowersEl, coinsText, diamondsText, flowersText) {
    if (coinsEl) coinsEl.textContent = coinsText;
    if (diamondsEl) diamondsEl.textContent = diamondsText;
    if (flowersEl) flowersEl.textContent = flowersText;
  };
  game.setGenericExchangeMessage = function (messageEl, text, kind) {
    if (!messageEl) return;
    messageEl.textContent = text || "";
    messageEl.classList.remove("error", "success", "hint");
    if (kind === "error") messageEl.classList.add("error");
    if (kind === "success") messageEl.classList.add("success");
    if (kind === "hint") messageEl.classList.add("hint");
  };
  game.fetchReplayUnlockStatusForLevel = async function (levelNumber) {
    const lvl = Number.parseInt(levelNumber, 10);
    if (!Number.isFinite(lvl) || lvl <= 0) return false;
    try {
      const res = await game.apiFetchWithAuthRetry(`/replay-unlocks/status?level=${encodeURIComponent(lvl)}`, {
        method: "GET",
        headers: game.buildAuthHeaders()
      });
      if (!res.ok) return false;
      const data = await res.json();
      return !!data?.unlocked;
    } catch (_) {
      return false;
    }
  };
  game.activateReplayUnlockForLevel = async function (levelNumber, grantToken) {
    const lvl = Number.parseInt(levelNumber, 10);
    if (!Number.isFinite(lvl) || lvl <= 0) return false;
    try {
      const res = await game.apiFetchWithAuthRetry("/replay-unlocks/activate", {
        method: "POST",
        headers: {
          ...game.buildAuthHeaders(),
          "X-Grant-Token": grantToken
        },
        body: JSON.stringify({
          level: lvl
        })
      });
      return res.ok;
    } catch (_) {
      return false;
    }
  };
  game.closeAntigravityExchangeModal = function () {
    if (!game.antigravityExchangeModal) return;
    game.antigravityExchangeModal.classList.remove("active");
    game.antigravityExchangeModal.setAttribute("aria-hidden", "true");
  };
  game.refreshAntigravityExchangeAssetsDisplay = async function () {
    if (!game.portalUndoShopAvailable()) {
      game.setGenericExchangeBalanceCells(game.antigravityExchangeCoinsEl, game.antigravityExchangeDiamondsEl, game.antigravityExchangeFlowersEl, "—", "—", "—");
      game.setGenericExchangeMessage(game.antigravityExchangeMessageEl, "Open from the main portal to load your coins, diamonds, and flowers.", "hint");
      return;
    }
    game.setGenericExchangeMessage(game.antigravityExchangeMessageEl, "");
    game.setGenericExchangeBalanceCells(game.antigravityExchangeCoinsEl, game.antigravityExchangeDiamondsEl, game.antigravityExchangeFlowersEl, "…", "…", "…");
    const assets = await game.getPortalAssets();
    if (!assets) {
      game.setGenericExchangeBalanceCells(game.antigravityExchangeCoinsEl, game.antigravityExchangeDiamondsEl, game.antigravityExchangeFlowersEl, "—", "—", "—");
      game.setGenericExchangeMessage(game.antigravityExchangeMessageEl, "Could not load assets. Check portal session.", "error");
      return;
    }
    game.setGenericExchangeBalanceCells(game.antigravityExchangeCoinsEl, game.antigravityExchangeDiamondsEl, game.antigravityExchangeFlowersEl, String(assets.coins), String(assets.diamonds), String(assets.flowers));
  };
  game.setAntigravityExchangeBusy = function (busy) {
    if (!game.antigravityExchangeRedeemBtn) return;
    game.antigravityExchangeRedeemBtn.disabled = !!busy || !game.portalUndoShopAvailable() || !game.shopPriceCache[game.PORTAL_ANTIGRAVITY_ITEM_ID];
  };
  game.openAntigravityExchangeModal = async function () {
    if (!game.antigravityExchangeModal) return;
    if (game.antigravityExchangeCostTextEl) game.antigravityExchangeCostTextEl.textContent = "…";
    game.setGenericExchangeMessage(game.antigravityExchangeMessageEl, "");
    game.antigravityExchangeModal.classList.add("active");
    game.antigravityExchangeModal.setAttribute("aria-hidden", "false");
    game.setAntigravityExchangeBusy(true);
    const [, cost] = await Promise.all([game.refreshAntigravityExchangeAssetsDisplay(), game.ensureShopCostCached(game.PORTAL_ANTIGRAVITY_ITEM_ID)]);
    if (game.antigravityExchangeCostTextEl) game.antigravityExchangeCostTextEl.innerHTML = game.formatShopCostForExchangeLineHtml(cost);
    game.setAntigravityExchangeBusy(false);
  };
  game.handleAntigravityExchangeRedeem = async function () {
    if (!game.portalUndoShopAvailable()) return;
    game.setGenericExchangeMessage(game.antigravityExchangeMessageEl, "");
    game.setAntigravityExchangeBusy(true);
    const redeem = await game.postPortalRedeemItem(game.PORTAL_ANTIGRAVITY_ITEM_ID);
    if (!redeem.ok) {
      game.setGenericExchangeMessage(game.antigravityExchangeMessageEl, redeem.message || "Redeem failed.", "error");
      game.setAntigravityExchangeBusy(false);
      await game.refreshAntigravityExchangeAssetsDisplay();
      return;
    }
    await game.refreshAntigravityExchangeAssetsDisplay();
    await game.syncAntigravityCreditsFromServer();
    game.setAntigravityExchangeBusy(false);
    game.closeAntigravityExchangeModal();
  };
  game.setupAntigravityExchangeModal = function () {
    if (game.antigravityExchangeCloseBtn) game.lifecycle.listen(game.antigravityExchangeCloseBtn, "click", game.closeAntigravityExchangeModal);
    if (game.antigravityExchangeModal) {
      game.lifecycle.listen(game.antigravityExchangeModal, "click", e => {
        if (e.target === game.antigravityExchangeModal) game.closeAntigravityExchangeModal();
      });
    }
    if (game.antigravityExchangeRedeemBtn) {
      game.lifecycle.listen(game.antigravityExchangeRedeemBtn, "click", () => {
        game.handleAntigravityExchangeRedeem();
      });
    }
  };
  game.closeReplayExchangeModal = function () {
    if (!game.replayExchangeModal) return;
    game.replayExchangeModal.classList.remove("active");
    game.replayExchangeModal.setAttribute("aria-hidden", "true");
  };
  game.refreshReplayExchangeAssetsDisplay = async function () {
    if (!game.portalUndoShopAvailable()) {
      game.setGenericExchangeBalanceCells(game.replayExchangeCoinsEl, game.replayExchangeDiamondsEl, game.replayExchangeFlowersEl, "—", "—", "—");
      game.setGenericExchangeMessage(game.replayExchangeMessageEl, "Open from the main portal to load your coins, diamonds, and flowers.", "hint");
      return;
    }
    game.setGenericExchangeMessage(game.replayExchangeMessageEl, "");
    game.setGenericExchangeBalanceCells(game.replayExchangeCoinsEl, game.replayExchangeDiamondsEl, game.replayExchangeFlowersEl, "…", "…", "…");
    const assets = await game.getPortalAssets();
    if (!assets) {
      game.setGenericExchangeBalanceCells(game.replayExchangeCoinsEl, game.replayExchangeDiamondsEl, game.replayExchangeFlowersEl, "—", "—", "—");
      game.setGenericExchangeMessage(game.replayExchangeMessageEl, "Could not load assets. Check portal session.", "error");
      return;
    }
    game.setGenericExchangeBalanceCells(game.replayExchangeCoinsEl, game.replayExchangeDiamondsEl, game.replayExchangeFlowersEl, String(assets.coins), String(assets.diamonds), String(assets.flowers));
  };
  game.setReplayExchangeBusy = function (busy) {
    if (!game.replayExchangeRedeemBtn) return;
    game.replayExchangeRedeemBtn.disabled = !!busy || !game.portalUndoShopAvailable() || !game.shopPriceCache[game.PORTAL_REPLAY_ITEM_ID];
  };
  game.openReplayExchangeModal = async function () {
    if (!game.replayExchangeModal) return;
    if (game.replayExchangeCostTextEl) game.replayExchangeCostTextEl.textContent = "…";
    game.setGenericExchangeMessage(game.replayExchangeMessageEl, "");
    game.replayExchangeModal.classList.add("active");
    game.replayExchangeModal.setAttribute("aria-hidden", "false");
    game.setReplayExchangeBusy(true);
    const [, cost] = await Promise.all([game.refreshReplayExchangeAssetsDisplay(), game.ensureShopCostCached(game.PORTAL_REPLAY_ITEM_ID)]);
    if (game.replayExchangeCostTextEl) game.replayExchangeCostTextEl.innerHTML = game.formatShopCostForExchangeLineHtml(cost);
    game.setReplayExchangeBusy(false);
  };
  game.handleReplayExchangeRedeem = async function () {
    if (!game.portalUndoShopAvailable()) return;
    const levelNumber = game.currentLevelIndex + 1;
    if (!Number.isFinite(levelNumber) || levelNumber <= 0) return;
    game.setGenericExchangeMessage(game.replayExchangeMessageEl, "");
    game.setReplayExchangeBusy(true);
    let grant;
    try {
      const portal = game.getPortalCommerce();
      if (await game.fetchReplayUnlockStatusForLevel(levelNumber)) {
        portal.finishGrant('replay', 'level:' + levelNumber);
        game.replayUnlockedForLevel = true;
        await game.fetchFewestOtherMovesForCurrentLevel();
        game.updateLevelCompleteReplayDisplay();
        game.setReplayExchangeBusy(false);
        game.closeReplayExchangeModal();
        return;
      }
      grant = await portal.buyGrant('replay', 'level:' + levelNumber);
    } catch (err) {
      game.setGenericExchangeMessage(game.replayExchangeMessageEl, err?.message || 'Redeem failed.', 'error');
      game.setReplayExchangeBusy(false);
      return;
    }
    const activated = await game.activateReplayUnlockForLevel(levelNumber, grant.grant_token);
    if (!activated) {
      game.setGenericExchangeMessage(game.replayExchangeMessageEl, "Redeem succeeded, but replay unlock sync failed. Please refresh.", "error");
      game.setReplayExchangeBusy(false);
      await game.refreshReplayExchangeAssetsDisplay();
      return;
    }
    game.getPortalCommerce().finishGrant('replay', 'level:' + levelNumber);
    game.replayUnlockedForLevel = true;
    await game.fetchFewestOtherMovesForCurrentLevel();
    game.updateLevelCompleteReplayDisplay();
    await game.refreshReplayExchangeAssetsDisplay();
    game.setReplayExchangeBusy(false);
    game.closeReplayExchangeModal();
    game.closeHintModal();
    const onLevelComplete = game.levelCompleteModal && game.levelCompleteModal.classList.contains("active");
    if (!onLevelComplete) {
      game.openInGameWalkthroughModal();
    }
  };
  game.setupReplayExchangeModal = function () {
    if (game.replayExchangeCloseBtn) game.lifecycle.listen(game.replayExchangeCloseBtn, "click", game.closeReplayExchangeModal);
    if (game.replayExchangeModal) {
      game.lifecycle.listen(game.replayExchangeModal, "click", e => {
        if (e.target === game.replayExchangeModal) game.closeReplayExchangeModal();
      });
    }
    if (game.replayExchangeRedeemBtn) {
      game.lifecycle.listen(game.replayExchangeRedeemBtn, "click", () => {
        game.handleReplayExchangeRedeem();
      });
    }
    if (game.levelCompleteReplayLock) {
      game.lifecycle.listen(game.levelCompleteReplayLock, "click", () => {
        game.openReplayExchangeModal();
      });
    }
  };
  game.setupInGameWalkthrough = function () {
    if (game.hintSolutionActionBtn) {
      game.lifecycle.listen(game.hintSolutionActionBtn, "click", () => {
        game.handleSolutionGuideAction();
      });
    }
    const closeWalkthrough = () => game.closeInGameWalkthroughModal();
    if (game.closeInGameWalkthroughModalBtn) {
      game.lifecycle.listen(game.closeInGameWalkthroughModalBtn, "click", closeWalkthrough);
    }
    if (game.inGameWalkthroughCloseBtn) {
      game.lifecycle.listen(game.inGameWalkthroughCloseBtn, "click", closeWalkthrough);
    }
    if (game.inGameWalkthroughModal) {
      game.lifecycle.listen(game.inGameWalkthroughModal, "click", e => {
        if (e.target === game.inGameWalkthroughModal) closeWalkthrough();
      });
    }
  };
  game.setupHintModal = function () {
    if (game.blockTipToggle && game.blockTipModal) {
      game.lifecycle.listen(game.blockTipToggle, "click", () => {
        game.openHintModal();
      });
    }
    const closeBtn = document.getElementById("closeBlockTip");
    if (game.blockTipModal && closeBtn) {
      game.lifecycle.listen(closeBtn, "click", game.closeHintModal);
      game.lifecycle.listen(game.blockTipModal, "click", e => {
        if (e.target === game.blockTipModal) game.closeHintModal();
      });
    }
  };
}
export function initialize(game) {
  game.undoExchangeModal = document.getElementById('undoExchangeModal');
  game.undoExchangeCloseBtn = document.getElementById('undoExchangeCloseBtn');
  game.undoExchangeRedeemBtn = document.getElementById('undoExchangeRedeemBtn');
  game.undoExchangeCoinsEl = document.getElementById('undoExchangeCoins');
  game.undoExchangeDiamondsEl = document.getElementById('undoExchangeDiamonds');
  game.undoExchangeFlowersEl = document.getElementById('undoExchangeFlowers');
  game.undoExchangeMessageEl = document.getElementById('undoExchangeMessage');
  game.undoExchangeCostTextEl = document.getElementById('undoExchangeCostText');
  game.antigravityExchangeModal = document.getElementById('antigravityExchangeModal');
  game.antigravityExchangeCloseBtn = document.getElementById('antigravityExchangeCloseBtn');
  game.antigravityExchangeRedeemBtn = document.getElementById('antigravityExchangeRedeemBtn');
  game.antigravityExchangeCoinsEl = document.getElementById('antigravityExchangeCoins');
  game.antigravityExchangeDiamondsEl = document.getElementById('antigravityExchangeDiamonds');
  game.antigravityExchangeFlowersEl = document.getElementById('antigravityExchangeFlowers');
  game.antigravityExchangeMessageEl = document.getElementById('antigravityExchangeMessage');
  game.antigravityExchangeCostTextEl = document.getElementById('antigravityExchangeCostText');
  game.replayExchangeModal = document.getElementById('replayExchangeModal');
  game.replayExchangeCloseBtn = document.getElementById('replayExchangeCloseBtn');
  game.replayExchangeRedeemBtn = document.getElementById('replayExchangeRedeemBtn');
  game.replayExchangeCoinsEl = document.getElementById('replayExchangeCoins');
  game.replayExchangeDiamondsEl = document.getElementById('replayExchangeDiamonds');
  game.replayExchangeFlowersEl = document.getElementById('replayExchangeFlowers');
  game.replayExchangeMessageEl = document.getElementById('replayExchangeMessage');
  game.replayExchangeCostTextEl = document.getElementById('replayExchangeCostText');


  game.localUndoCredits = 0;
  game.localAntigravityCredits = 0;
  game.portalQuantities = {};
  game.creditUsesBusy = new Set();
  game.cmCommerceClient = null;
  game.cmCommerceBase = '';
  game.PORTAL_UNDO_ITEM_ID = "chess_mater_undo";
  game.PORTAL_ANTIGRAVITY_ITEM_ID = "chess_mater_antigravity";
  game.PORTAL_REPLAY_ITEM_ID = "replay";
  game.PORTAL_UNDO_GAME_MODE = "chessmater";
  game.shopPriceCache = {};
  game.shopCatalogWarmPromise = null;
  game.CM_CURRENCY_ICON_SRC = {
    coin: game.CM_ASSETS && game.CM_ASSETS.ui && game.CM_ASSETS.ui.coin || "/assets/images/coin.svg",
    diamond: game.CM_ASSETS && game.CM_ASSETS.ui && game.CM_ASSETS.ui.diamond || "/assets/images/diamond.svg",
    flower: game.CM_ASSETS && game.CM_ASSETS.ui && game.CM_ASSETS.ui.flower || "/assets/images/flower.svg"
  };
  game.setupUndoExchangeModal();


  queueMicrotask(() => {
    if (game.portalUndoShopAvailable()) void game.warmShopPriceCache();
  });
}
