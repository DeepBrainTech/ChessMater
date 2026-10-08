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
  return `https://deepbraintechnology.com/${getPortalLocale()}/${page}`;
}
