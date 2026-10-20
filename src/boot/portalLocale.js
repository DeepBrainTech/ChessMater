// Portal language is independent of the game's interface language.
export function normalizePortalLocale(value) {
  const locale = String(value || "").trim().toLowerCase();
  if (/^(zn|zh)(?:[-_][a-z0-9]+)*$/.test(locale)) return "zn";
  if (/^en(?:[-_][a-z0-9]+)*$/.test(locale)) return "en";
  return null;
}

export function getPortalLocale() {
  return normalizePortalLocale(localStorage.getItem("cm_locale")) || "en";
}

export function capturePortalLocale() {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const query = new URLSearchParams(window.location.search);
  const locale = normalizePortalLocale(hash.get("locale")) ||
    normalizePortalLocale(query.get("locale")) || getPortalLocale();
  localStorage.setItem("cm_locale", locale);
  return locale;
}

export function getPortalUrl(page = "braingames") {
  const host = window.location.hostname;
  const localHost = ["localhost", "127.0.0.1", "0.0.0.0", "[::1]", ""].includes(host) ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
    /^172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host);
  const defaultBase = localHost
    ? `http://${host || "localhost"}:3000`
    : "https://deepbraintechnology.com";
  const base = (import.meta.env?.VITE_PORTAL_URL || defaultBase).replace(/\/+$/, "");
  const locale = getPortalLocale();
  return `${base}/${locale === "zn" ? "zh" : locale}/${page}`;
}
