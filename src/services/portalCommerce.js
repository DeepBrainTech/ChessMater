class PortalApiError extends Error {
    constructor(status, code) {
        super(code);
        this.status = status;
        this.code = code;
        this.name = "PortalApiError";
    }
}
class PortalGameClient {
    constructor(baseUrl, apiSlug, gameKey = apiSlug, environment = globalThis) {
        this.environment = environment;
        this.apiSlug = apiSlug;
        this.gameKey = gameKey;
        this.baseUrl = baseUrl.replace(/\/$/, "");
    }
    async request(path, init = {}) {
        const response = await this.environment.fetch(this.baseUrl + path, {
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
    assets() {
        return this.request("/api/user/assets");
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
    redeemItem(request) {
        const query = new URLSearchParams({ ...request, game_mode: this.gameKey });
        return this.request("/api/user/shop/redeem?" + query, { method: "POST" });
    }
    checkout(asset, bundleId, locale) {
        const kind = asset === "coins" ? "coin" : "diamond";
        return this.request("/api/billing/" + kind + "-checkout-session", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bundle_id: bundleId, locale }),
        });
    }
}
/** Browser-side retries are scoped to the signed-in game account. */
class PortalCommerceClient extends PortalGameClient {
    constructor(base, slug, accountId, gameKey = slug, environment = globalThis) {
        super(base, slug, gameKey, environment);
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
            return this.environment.sessionStorage.getItem(key) ?? this.pending.get(key) ?? null;
        }
        catch {
            return this.pending.get(key) ?? null;
        }
    }
    write(key, value) {
        this.pending.set(key, value);
        try {
            this.environment.sessionStorage.setItem(key, value);
        }
        catch { /* In-memory retries still work. */ }
    }
    remove(key) {
        this.pending.delete(key);
        try {
            this.environment.sessionStorage.removeItem(key);
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
                id = this.environment.crypto.randomUUID();
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
    buyLocalItem(itemId) {
        return this.mutate(`local-redeem:${itemId}`, id => this.redeemItem({ item_id: itemId, request_id: id }), true);
    }
    finishLocalItem(itemId, purchaseId) {
        const key = this.key(`local-redeem:${itemId}`);
        if (!purchaseId || this.read(key) === purchaseId) this.remove(key);
    }
    migrateInventory() {
        return this.request('/api/user/shop/chessmater/migrate', { method: 'POST' });
    }
    pendingDeliveries() {
        return this.request('/api/user/shop/chessmater/deliveries');
    }
    acknowledgeDelivery(purchaseId) {
        return this.request('/api/user/shop/chessmater/deliveries/' + encodeURIComponent(purchaseId) + '/ack', { method: 'POST' });
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

export { PortalCommerceClient, PortalApiError, gameAccountId };
