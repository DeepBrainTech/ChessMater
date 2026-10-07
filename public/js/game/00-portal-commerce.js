(function () {
class PortalApiError extends Error {
    constructor(status, code) {
        super(code);
        this.status = status;
        this.code = code;
        this.name = "PortalApiError";
    }
}
class PortalGameClient {
    constructor(baseUrl, apiSlug, gameKey = apiSlug) {
        this.apiSlug = apiSlug;
        this.gameKey = gameKey;
        this.baseUrl = baseUrl.replace(/\/$/, "");
    }
    async request(path, init = {}) {
        const response = await fetch(this.baseUrl + path, {
            ...init,
            credentials: "include",
            cache: "no-store",
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) {
            const detail = payload?.detail;
            const code = typeof detail === "string" ? detail
                : Array.isArray(detail) ? "validation_error"
                    : typeof payload?.message === "string" ? payload.message : "portal_request_failed";
            throw new PortalApiError(response.status, code);
        }
        return payload.data;
    }
    purchasePath(productId) {
        return "/api/games/" + encodeURIComponent(this.apiSlug)
            + "/purchases/" + encodeURIComponent(productId);
    }
    assets() {
        return this.request("/api/user/assets");
    }
    inventory() {
        return this.request("/api/user/shop/inventory");
    }
    catalog() {
        const query = new URLSearchParams({ game_mode: this.gameKey });
        return this.request("/api/games/shop/catalog?" + query);
    }
    startSession(timezone) {
        return this.request("/api/games/" + encodeURIComponent(this.apiSlug) + "/token", {
            method: "POST",
            headers: timezone ? { "X-User-Timezone": timezone } : undefined,
        });
    }
    refreshSession() {
        return this.request("/api/games/" + encodeURIComponent(this.apiSlug) + "/session");
    }
    quote(productId) {
        return this.request(this.purchasePath(productId) + "/quote");
    }
    redeemGrant(productId, request) {
        return this.request(this.purchasePath(productId) + "/redeem", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request),
        });
    }
    redeemItem(request) {
        const query = new URLSearchParams({ ...request, game_mode: this.gameKey });
        return this.request("/api/user/shop/redeem?" + query, { method: "POST" });
    }
    consumeItem(request, count = 1) {
        const query = new URLSearchParams({ ...request, count: String(count), game_mode: this.gameKey });
        return this.request("/api/user/shop/consume?" + query, { method: "POST" });
    }
    checkout(asset, bundleId, locale) {
        const kind = asset === "coins" ? "coin" : "diamond";
        return this.request("/api/billing/" + kind + "-checkout-session", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bundle_id: bundleId, locale }),
        });
    }
}
/** Generate once per user action, then keep this object when retrying a lost response. */
function newPurchaseRequest(target) {
    return { request_id: crypto.randomUUID(), target };
}
function newItemRequest(itemId) {
    return { request_id: crypto.randomUUID(), item_id: itemId };
}
/** Browser-side retries are scoped to the signed-in game account. */
class PortalInventoryClient extends PortalGameClient {
    constructor(base, slug, accountId, gameKey = slug) {
        super(base, slug, gameKey);
        this.accountId = accountId;
        this.pending = new Map();
        this.busy = new Set();
        this.storagePrefix = `portal-commerce:${base}:${gameKey}:`;
    }
    key(operation) {
        const userId = this.accountId();
        if (!Number.isSafeInteger(userId) || !userId || userId < 0) {
            throw new PortalApiError(401, 'game_account_required');
        }
        return `${this.storagePrefix}${userId}:${operation}`;
    }
    read(key) {
        try {
            return sessionStorage.getItem(key) ?? this.pending.get(key) ?? null;
        }
        catch {
            return this.pending.get(key) ?? null;
        }
    }
    write(key, value) {
        this.pending.set(key, value);
        try {
            sessionStorage.setItem(key, value);
        }
        catch { /* In-memory retries still work. */ }
    }
    remove(key) {
        this.pending.delete(key);
        try {
            sessionStorage.removeItem(key);
        }
        catch { /* Storage can be disabled. */ }
    }
    async assertAccount() {
        const expected = this.accountId();
        const session = await this.refreshSession();
        if (!expected || session.user.id !== expected) {
            throw new PortalApiError(401, 'portal_account_mismatch');
        }
    }
    async mutate(operation, send, keep = false) {
        const key = this.key(operation);
        if (this.busy.has(key))
            throw new PortalApiError(409, 'operation_in_progress');
        this.busy.add(key);
        try {
            await this.assertAccount();
            let id = this.read(key);
            if (!id) {
                id = crypto.randomUUID();
                this.write(key, id);
            }
            const result = await send(id);
            if (!keep)
                this.remove(key);
            return result;
        }
        catch (error) {
            if (keep && error instanceof PortalApiError && error.code === 'purchase_session_expired') {
                this.remove(key);
            }
            throw error;
        }
        finally {
            this.busy.delete(key);
        }
    }
    buyItem(itemId) {
        return this.mutate(`redeem:${itemId}`, id => this.redeemItem({ item_id: itemId, request_id: id }));
    }
    useItem(itemId, count = 1) {
        return this.mutate(`consume:${itemId}:${count}`, id => this.consumeItem({ item_id: itemId, request_id: id }, count));
    }
    hasPendingUse(itemId, count = 1) {
        try {
            return !!this.read(this.key(`consume:${itemId}:${count}`));
        }
        catch {
            return false;
        }
    }
    buyGrant(productId, target) {
        return this.mutate(`grant:${productId}:${target}`, id => this.redeemGrant(productId, { target, request_id: id }), true);
    }
    finishGrant(productId, target) {
        this.remove(this.key(`grant:${productId}:${target}`));
    }
}
/** This identifies browser retry storage; the server verifies authentication. */
function gameAccountId(token) {
    try {
        const part = token?.split('.')[1];
        if (!part)
            return null;
        const claims = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
        return Number.isSafeInteger(claims.user_id) && claims.user_id > 0 ? claims.user_id : null;
    }
    catch {
        return null;
    }
}

window.PortalInventoryClient = PortalInventoryClient;
window.PortalApiError = PortalApiError;
window.gameAccountId = gameAccountId;
})();
