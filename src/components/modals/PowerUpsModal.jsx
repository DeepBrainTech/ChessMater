import { useEffect, useRef, useState } from "react";
import { subscribeGameUi } from "../../game/uiBridge.js";
import { hideModal, showModal } from "../../game/modalFocus.js";
import { POWER_UPS, UTILITY_PACK } from "../../game/powerUps.js";
import { ButtonArtwork } from "../GameButton.jsx";
import { CompletionIcon } from "./LevelCompleteModal.jsx";
import { getPortalUrl } from "../../boot/portalLocale.js";
import "../../styles/power-ups.css";

function PowerIcon({ name }) {
  return <span className={`power-icon power-icon--${name}`} aria-hidden="true"><span className="power-icon-border" /><span className="power-icon-fill" /><span className="power-icon-shadow" /><span className="power-icon-shine power-icon-shine--a" /><span className="power-icon-shine power-icon-shine--b" /><img src={`/assets/images/game/ui-icon-${name}.svg`} alt="" /></span>;
}

function SaveTag({ saving }) {
  return <span className="power-ribbon"><span className="power-ribbon-art" aria-hidden="true"><span className="power-ribbon-fill" /><span className="power-ribbon-shadow" /><span className="power-ribbon-shine power-ribbon-shine--a" /><span className="power-ribbon-shine power-ribbon-shine--b" /></span><span className="power-ribbon-text">Save {saving}%</span></span>;
}

export default function PowerUpsModal() {
  const modal = useRef(null);
  const engine = useRef(null);
  const busyRef = useRef(false);
  const generation = useRef(0);
  const [shop, setShop] = useState({ catalog: null, coins: null, busy: false, message: "", kind: "idle", selected: "" });
  const noticeKind = shop.message ? shop.kind : shop.coins !== null && shop.coins < 300 ? "warning" : "idle";
  const noticeText = shop.message || (noticeKind === "warning" ? "Not enough coins. Tap + to get more." : "");
  useEffect(() => {
    if (shop.kind !== 'success') return;
    const timer = window.setTimeout(() => setShop(s => ({ ...s, kind: 'idle', message: '' })), 4000);
    return () => window.clearTimeout(timer);
  }, [shop.kind, shop.message]);
  const close = () => { if (!busyRef.current) { generation.current++; hideModal(modal.current); } };
  useEffect(() => {
    const refreshBalance = async () => {
      if (document.visibilityState === 'hidden' || !modal.current?.classList.contains('active') || busyRef.current) return;
      const version = generation.current;
      const assets = await engine.current?.getPortalAssets().catch(() => null);
      if (generation.current === version) setShop(s => ({ ...s, coins: assets?.coins ?? null,
        ...(assets && s.kind === 'warning' ? { kind: 'idle', message: '' } : {}) }));
    };
    window.addEventListener('focus', refreshBalance);
    document.addEventListener('visibilitychange', refreshBalance);
    return () => {
      window.removeEventListener('focus', refreshBalance);
      document.removeEventListener('visibilitychange', refreshBalance);
    };
  }, []);
  useEffect(() => subscribeGameUi(event => {
    if (event.type !== "openPowerUps" || busyRef.current) return;
    engine.current = event.game;
    const version = ++generation.current;
    setShop({ catalog: null, coins: null, busy: false, message: "Loading power-ups…", kind: "loading", selected: event.asset });
    showModal(modal.current);
    modal.current.querySelector('.power-close')?.focus({ preventScroll: true });
    Promise.all([event.game.getPortalCommerce().catalog(), event.game.getPortalAssets()]).then(([catalog, assets]) => {
      if (generation.current !== version) return;
      setShop(s => ({ ...s, catalog: catalog.items, coins: assets?.coins ?? null, kind: assets ? 'idle' : 'error', message: assets ? "" : "Could not load your balance. Check your portal session." }));
    }).catch(() => {
      if (generation.current === version) setShop(s => ({ ...s, kind: 'error', message: "Could not load power-ups. Please reopen to retry." }));
    });
  }), []);
  const buy = async (item, label) => {
    if (busyRef.current) return;
    generation.current++;
    busyRef.current = true;
    setShop(s => ({ ...s, busy: true, kind: 'purchasing', message: "Purchasing…" }));
    try {
      const game = engine.current;
      const result = await game.postPortalRedeemItem(item);
      const assets = await game.getPortalAssets();
      const insufficient = !result.ok && /insufficient/i.test(result.message);
      setShop(s => ({ ...s, coins: assets?.coins ?? null, kind: result.ok ? 'success' : insufficient ? 'warning' : 'error', message: result.ok
        ? `Added ${label}!`
        : insufficient ? "Not enough coins. Tap + to get more." : "Purchase failed. Please try again." }));
    } catch {
      setShop(s => ({ ...s, kind: 'error', message: "Could not confirm your purchase. Please try again." }));
    } finally {
      busyRef.current = false;
      setShop(s => ({ ...s, busy: false }));
    }
  };
  const priceButton = (item, price, label) => {
    const cost = shop.catalog?.[item]?.cost;
    const valid = cost?.coins === price && !cost.diamonds && !cost.flowers;
    return <button type="button" className="power-price" disabled={shop.busy || !valid || shop.coins === null || shop.coins < price}
      onClick={() => buy(item, label)} aria-label={`Exchange ${price} coins for ${label}`} title={cost && !valid ? "Price changed. Please refresh the game." : undefined}>
      <span className="power-price-art" aria-hidden="true"><span className="power-price-border" /><span className="power-price-fill" /><span className="power-price-shadow" /><span className="power-price-shine" /><span className="power-price-jewel power-price-jewel--left" /><span className="power-price-jewel power-price-jewel--right" /></span>
      <span className="power-price-content"><img src="/assets/images/powerups/coin.svg" alt="" />{price}</span>
    </button>;
  };
  return <div ref={modal} id="powerUpsModal" className="power-ups-modal" aria-hidden="true" onClick={e => { if (e.target === e.currentTarget) close(); }} onKeyDown={e => {
    if (e.key === "Escape") { e.stopPropagation(); close(); }
    if (e.key === "Tab") {
      const buttons = [...modal.current.querySelectorAll("button:not(:disabled), a[href]")];
      const first = buttons[0], last = buttons.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  }}>
    <section className="power-ups-panel" role="dialog" aria-modal="true" aria-labelledby="powerUpsTitle" aria-busy={shop.busy} data-needs-coins={noticeKind === 'warning'}>
      <h2 id="powerUpsTitle">Power-Ups</h2>
      <div className={`power-shop-message power-shop-message--${noticeKind}`} data-visible={Boolean(noticeText)} role="status" aria-live="polite" aria-atomic="true">
        {noticeText && <>
          <span className={`power-shop-message-icon${['loading', 'purchasing'].includes(noticeKind) ? ' power-shop-message-icon--busy' : ''}`} aria-hidden="true">{noticeKind === 'success' ? '✓' : ['loading', 'purchasing'].includes(noticeKind) ? '' : '!'}</span>
          <span>{noticeText}</span>
        </>}
      </div>
      <div className="power-ups-inner">
        <header className="power-ups-header">
          <div className="power-coins">
            <span className="power-coin-balance" aria-label={`Coins: ${shop.coins ?? "unavailable"}`}><img src="/assets/images/powerups/balance-coin.svg" alt="" /><span className="power-coin-value">{shop.coins?.toLocaleString('en-US') ?? "—"}</span></span>
            <a className="power-coins-add" href={getPortalUrl('shop')} target="_blank" rel="noopener noreferrer" aria-label="Get coins in the main portal shop (opens in a new tab)" title="Get coins in the main portal shop"><span aria-hidden="true">+</span></a>
          </div>
          <button type="button" className="power-close" disabled={shop.busy} aria-label="Close power-ups" onClick={close} ref={node => { if (node && modal.current?.classList.contains("active") && document.activeElement === document.body) node.focus(); }}><ButtonArtwork utility /><CompletionIcon name="close" /></button>
        </header>
        {POWER_UPS.map(power => <div className="power-row" key={power.key} data-selected={shop.selected === power.key}>
          <div className="power-label"><PowerIcon name={power.key} /><span>{power.label}</span></div>
          <div className="power-option"><span className="power-quantity">x1</span><span className="power-option-name">Single</span>{priceButton(power.item, power.single, `1 ${power.label}`)}</div>
          <span className="power-or">or</span>
          <div className="power-option power-option--pack"><SaveTag saving={power.saving} /><span className="power-quantity">x5</span><div className="power-option-name">Pack of 5<del><img src="/assets/images/powerups/coin.svg" alt="" />{power.single * 5}</del></div>{priceButton(`${power.item}_pack5`, power.pack, `5 ${power.label}`)}</div>
        </div>)}
        <div className="power-bundle">
          <SaveTag saving={17} />
          <div className="power-bundle-icons"><PowerIcon name="undo" /><PowerIcon name="antigravity" /><PowerIcon name="hint" /></div>
          <div className="power-bundle-description"><strong>ChessMater Utility Pack</strong><span>3 Hint + 2 Undo + 1 AntiGravity</span></div>
          <div className="power-bundle-price"><del><img src="/assets/images/powerups/coin.svg" alt="" />2300</del>{priceButton(UTILITY_PACK, 1900, "ChessMater Utility Pack")}</div>
        </div>
      </div>
    </section>
  </div>;
}
