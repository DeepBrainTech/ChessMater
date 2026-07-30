export default function ExchangeModal({ idPrefix, title, titleId }) {
  const modalId = `${idPrefix}ExchangeModal`;
  const costId = `${idPrefix}ExchangeCostText`;
  const coinsId = `${idPrefix}ExchangeCoins`;
  const diamondsId = `${idPrefix}ExchangeDiamonds`;
  const flowersId = `${idPrefix}ExchangeFlowers`;
  const messageId = `${idPrefix}ExchangeMessage`;
  const closeId = `${idPrefix}ExchangeCloseBtn`;
  const redeemId = `${idPrefix}ExchangeRedeemBtn`;

  return (
    <div id={modalId} className="undo-exchange-modal" aria-hidden="true">
      <div className="undo-exchange-panel" role="dialog" aria-labelledby={titleId}>
        <h2 className="undo-exchange-title" id={titleId}>
          {title}
        </h2>
        <div className="undo-exchange-section undo-exchange-section--cost">
          <div className="undo-exchange-section-label">Cost</div>
          <div className="undo-exchange-section-body undo-exchange-cost-line">
            <strong id={costId}>…</strong>
          </div>
        </div>
        <div className="undo-exchange-section undo-exchange-section--assets">
          <div className="undo-exchange-section-label">Your assets</div>
          <div className="undo-exchange-balances">
            <p className="undo-exchange-balance-row">
              <img
                className="undo-exchange-currency-icon"
                src="/assets/images/coin.svg"
                width="22"
                height="22"
                alt="Coins"
              />
              <span id={coinsId} className="undo-exchange-balance-value">
                —
              </span>
            </p>
            <p className="undo-exchange-balance-row">
              <img
                className="undo-exchange-currency-icon"
                src="/assets/images/diamond.svg"
                width="22"
                height="22"
                alt="Diamonds"
              />
              <span id={diamondsId} className="undo-exchange-balance-value">
                —
              </span>
            </p>
            <p className="undo-exchange-balance-row">
              <img
                className="undo-exchange-currency-icon"
                src="/assets/images/flower.svg"
                width="22"
                height="22"
                alt="Flowers"
              />
              <span id={flowersId} className="undo-exchange-balance-value">
                —
              </span>
            </p>
          </div>
        </div>
        <p id={messageId} className="undo-exchange-message" role="status"></p>
        <div className="undo-exchange-footer">
          <button type="button" id={closeId} className="undo-exchange-btn-cancel">
            Cancel
          </button>
          <button type="button" id={redeemId} className="undo-exchange-btn-confirm">
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
