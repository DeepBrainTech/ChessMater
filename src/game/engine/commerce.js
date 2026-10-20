import { session } from '../../services/session.js';
import { showModal, hideModal } from '../modalFocus.js';
export function register(game) {
  game.openPowerUpsShop = function (asset) {
    game.cmEmitGameUi?.({ type: 'openPowerUps', asset, game });
  };
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
  game.applyInventoryBalances = function (data) {
    game.localHintCredits = game.hintCredits = Number(data.hintCredits) || 0;
    game.localUndoCredits = game.undoCredits = Number(data.undoCredits) || 0;
    game.localAntigravityCredits = game.antigravityCredits = Number(data.antigravityCredits) || 0;
    game.updateUndoButtonLabel();
    game.updateAntigravityButtonLabel();
    game.cmEmitGameUi?.({ type: 'hintCredits', hintCredits: game.hintCredits });
    game.updateHintButton?.();
  };
  game.syncGameInventory = async function () {
    try {
      const res = await game.apiFetchWithAuthRetry('/inventory', { method: 'GET', headers: game.buildAuthHeaders() });
      const data = await res.json();
      if (!res.ok || !data.success) return false;
      game.applyInventoryBalances(data);
      return true;
    } catch (_) { return false; }
  };
  game.syncUndoCreditsFromServer = () => game.syncGameInventory();
  game.syncAntigravityCreditsFromServer = () => game.syncGameInventory();
  game.syncLocalHintCreditsFromServer = () => game.syncGameInventory();
  game.recoverLevelCoinRewards = async function () {
    const runId = game.hintRunId;
    try {
      const response = await game.apiFetchWithAuthRetry('/level-rewards/claim', {
        method: 'POST', headers: game.buildAuthHeaders(),
      });
      const data = await response.json();
      if (response.ok && data.success && game.hintRunId === runId && game.gameWon &&
          data.awardedLevels?.includes(game.currentLevelIndex + 1) && game.levelCompleteCoinReward) {
        game.levelCompleteCoinReward.hidden = false;
      }
    } catch (_) { /* The server keeps pending rewards for the next visit. */ }
  };
  game.claimStarterPack = async function () {
    try {
      const res = await game.apiFetchWithAuthRetry('/starter-pack/claim', {
        method: 'POST', headers: game.buildAuthHeaders(), body: JSON.stringify({})
      });
      const data = await res.json();
      if (!res.ok || !data.success) return false;
      game.applyInventoryBalances(data);
      return true;
    } catch (_) { return false; }
  };
  game.claimInventoryDelivery = async function (delivery) {
    const res = await game.apiFetchWithAuthRetry('/inventory/claim', {
      method: 'POST', headers: game.buildAuthHeaders(), body: JSON.stringify({ grant_token: delivery.grant_token })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error('Inventory delivery pending. Please retry.');
    game.applyInventoryBalances(data);
    return data;
  };
  game.recoverInventoryDeliveries = function () {
    if (game.CM_EDITOR_PAGE) return Promise.resolve(true);
    if (game.inventoryRecoveryPromise) return game.inventoryRecoveryPromise;
    const recovery = (async () => {
      try {
        const portal = game.getPortalCommerce();
        await portal.assertAccount();
        await portal.migrateInventory();
        for (let batch = 0; batch < 20; batch++) {
          const { deliveries } = await portal.pendingDeliveries();
          if (!deliveries.length) return true;
          for (const delivery of deliveries) {
            await game.claimInventoryDelivery(delivery);
            portal.finishLocalItem(delivery.item_id, delivery.purchase_id);
            await portal.acknowledgeDelivery(delivery.purchase_id);
          }
        }
        return false;
      } catch (_) { return false; }
      finally { game.inventoryRecoveryPromise = null; }
    })();
    game.inventoryRecoveryPromise = recovery;
    return recovery;
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
      game.cmCommerceClient = new game.PortalCommerceClient(base, 'chessmater', () => game.gameAccountId(session.cmToken) || Number(session.cmUser?.portal_user_id || session.cmUser?.user_id || session.cmUser?.id) || null);
    }
    return game.cmCommerceClient;
  };
  game.consumeGameCredit = async function (itemId, localPath, amount) {
    if (!Number.isSafeInteger(amount) || amount <= 0 || game.creditUsesBusy.has(itemId)) return false;
    game.creditUsesBusy.add(itemId);
    try {
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
      if (itemId === game.PORTAL_UNDO_ITEM_ID) {
        game.localUndoCredits = game.undoCredits = data.undoCredits;
        game.updateUndoButtonLabel();
      } else {
        game.localAntigravityCredits = game.antigravityCredits = data.antigravityCredits;
        game.updateAntigravityButtonLabel();
      }
      await game.syncGameInventory();
      return true;
    } catch (_) {
      return false;
    } finally {
      game.creditUsesBusy.delete(itemId);
    }
  };
  game.consumeLocalHintCredit = async function (runId) {
    const res = await game.apiFetchWithAuthRetry('/hint-credits/use', {
      method: 'POST', headers: game.buildAuthHeaders(),
      body: JSON.stringify({ request_id: runId })
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) {
      const error = new Error(data?.error || 'Could not use Hint credit');
      if (res.status === 400) error.code = 'insufficient_inventory';
      throw error;
    }
    game.localHintCredits = Number.parseInt(data.hintCredits, 10) || 0;
    game.hintCredits = game.localHintCredits;
    game.cmEmitGameUi?.({ type: 'hintCredits', hintCredits: game.hintCredits });
    return data;
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
    game.levelCompleteReplayLockCostEl.innerHTML = '<span class="undo-exchange-cost-part"><img class="undo-exchange-currency-icon" src="/assets/images/game/ui-icon-hint.svg" alt="Hint ticket" width="22" height="22"><span>1</span></span>';
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
      const cost = (await portal.catalog()).items[itemId]?.cost;
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
    let assets = null;
    game.cmEmitGameUi?.({ type: "portalAssetsLoading" });
    if (base) try {
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
      if (res.ok && data?.success && [coins, diamonds, flowers].every(Number.isFinite)) {
        assets = {
          coins: Math.max(0, Math.floor(coins)),
          diamonds: Math.max(0, Math.floor(diamonds)),
          flowers: Math.max(0, Math.floor(flowers))
        };
      }
    } catch (_) { /* The balance stays unavailable until the next successful refresh. */ }
    game.cmEmitGameUi?.({ type: "portalAssets", assets });
    return assets;
  };
  game.postPortalRedeemUndo = async function () {
    return game.postPortalRedeemItem(game.PORTAL_UNDO_ITEM_ID);
  };
  game.postPortalRedeemItem = async function (itemId) {
    try {
      const portal = game.getPortalCommerce();
      const delivery = await portal.buyLocalItem(itemId);
      const data = await game.claimInventoryDelivery(delivery);
      portal.finishLocalItem(itemId);
      await portal.acknowledgeDelivery(delivery.purchase_id).catch(() => {});
      return { ok: true, data };
    } catch (err) {
      return { ok: false, message: err?.message || 'Redeem failed.' };
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
    hideModal(game.undoExchangeModal);
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
    if (!game.CM_EDITOR_PAGE) return game.openPowerUpsShop('undo');
    if (!game.undoExchangeModal) return;
    if (game.undoExchangeCostTextEl) game.undoExchangeCostTextEl.textContent = "…";
    game.setUndoExchangeMessage("");
    showModal(game.undoExchangeModal);
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
  game.closeAntigravityExchangeModal = function () {
    if (!game.antigravityExchangeModal) return;
    hideModal(game.antigravityExchangeModal);
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
    if (!game.CM_EDITOR_PAGE) return game.openPowerUpsShop('antigravity');
    if (!game.antigravityExchangeModal) return;
    if (game.antigravityExchangeCostTextEl) game.antigravityExchangeCostTextEl.textContent = "…";
    game.setGenericExchangeMessage(game.antigravityExchangeMessageEl, "");
    showModal(game.antigravityExchangeModal);
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
  game.resetHintForRun = function ({ preserve = false } = {}) {
    game.closeInGameWalkthroughModal?.();
    if (preserve) return;
    game.hintRunId = globalThis.crypto.randomUUID();
    game.hintUnlockedThisRun = false;
    game.hintUsePromise = null;
    game.hintPendingRunId = null;
  };
  game.useHintForCurrentRun = function () {
    if (game.CM_EDITOR_PAGE) return Promise.resolve(false);
    if (game.hintUsePromise) return game.hintUsePromise;
    const runId = game.hintRunId;
    const levelNumber = game.currentLevelIndex + 1;
    const current = () => game.hintRunId === runId && game.currentLevelIndex + 1 === levelNumber;
    const view = () => {
      const completed = game.levelCompleteModal?.classList.contains('active');
      if (!completed) game.openInGameWalkthroughModal();
      game.updateLevelCompleteReplayDisplay();
    };
    if (game.hintUnlockedThisRun) {
      view();
      return Promise.resolve(true);
    }
    if (game.hintCredits === 0 && (!runId || game.hintPendingRunId !== runId)) {
      game.openPowerUpsShop('hint');
      return Promise.resolve(false);
    }
    if (!Number.isFinite(game.fewestOtherMovesForLevel) || !(game.fewestOtherMovesReplayPath?.length >= 2)) {
      game.updateStatus('No Hint guide is available for this level yet. No Hint was used.');
      view();
      return Promise.resolve(false);
    }
    const pending = (async () => {
      try {
        game.hintPendingRunId = runId;
        await game.consumeLocalHintCredit(runId);
        if (!current()) return false;
        game.hintPendingRunId = null;
        game.hintUnlockedThisRun = true;
        game.refreshFewestOtherMovesAffordance();
        game.updateFewestOtherMovesDisplay(game.fewestOtherMovesForLevel, game.fewestOtherMovesReplayPath, game.fewestOtherMovesUserName);
        view();
        return true;
      } catch (error) {
        if (!current()) return false;
        if (error?.code === 'insufficient_inventory') {
          game.hintPendingRunId = null;
          game.openPowerUpsShop('hint');
        }
        else game.updateStatus('Could not use Hint. Please retry; this run will not be charged twice.');
        return false;
      } finally {
        await game.syncGameInventory();
        if (current()) game.hintUsePromise = null;
      }
    })();
    game.hintUsePromise = pending;
    return pending;
  };
  game.setupLevelCompleteHint = function () {
    if (game.levelCompleteReplayLock) game.lifecycle.listen(game.levelCompleteReplayLock, 'click', () => game.useHintForCurrentRun());
  };
  game.setupInGameWalkthrough = function () {
    const closeWalkthrough = () => game.closeInGameWalkthroughModal();
    if (game.closeInGameWalkthroughModalBtn) {
      game.lifecycle.listen(game.closeInGameWalkthroughModalBtn, "click", closeWalkthrough);
    }
    if (game.inGameWalkthroughCloseBtn) {
      game.lifecycle.listen(game.inGameWalkthroughCloseBtn, "click", () => {
        closeWalkthrough();
        game.restartLevel();
      });
    }
    if (game.inGameWalkthroughModal) {
      game.lifecycle.listen(game.inGameWalkthroughModal, "click", e => {
        if (e.target === game.inGameWalkthroughModal) closeWalkthrough();
      });
    }
  };
  game.setupHintButton = function () {
    if (game.blockTipToggle && !game.CM_EDITOR_PAGE) {
      game.lifecycle.listen(game.blockTipToggle, "click", () => game.openHintModal());
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
  game.hintCredits = null;
  game.hintPendingRunId = null;
  game.localHintCredits = 0;
  game.hintRunId = globalThis.crypto.randomUUID();
  game.hintUnlockedThisRun = false;
  game.hintUsePromise = null;

  game.localUndoCredits = 0;
  game.localAntigravityCredits = 0;
  game.inventoryRecoveryPromise = null;
  game.creditUsesBusy = new Set();
  game.cmCommerceClient = null;
  game.cmCommerceBase = '';
  game.PORTAL_UNDO_ITEM_ID = "chess_mater_undo";
  game.PORTAL_ANTIGRAVITY_ITEM_ID = "chess_mater_antigravity";
  // Keep the product ID stable for purchases and legacy inventory migration.
  game.PORTAL_HINT_ITEM_ID = "chess_mater_reply";
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
