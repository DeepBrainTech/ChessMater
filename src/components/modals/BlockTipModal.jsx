export default function BlockTipModal() {
  return (
    <div id="blockTipModal" className="block-tip-modal" aria-hidden="true">
      <div className="block-tip-content" role="dialog" aria-labelledby="hintModalTitle">
        <div className="block-tip-header">
          <h3 id="hintModalTitle">Hint</h3>
          <button
            type="button"
            className="close-block-tip"
            id="closeBlockTip"
            aria-label="Close hint"
          >
            &times;
          </button>
        </div>
        <section className="hint-section" aria-labelledby="hintLevelTipsHeading">
          <h4 className="hint-section-title" id="hintLevelTipsHeading">
            Level tips
          </h4>
          <p id="blockDescription">Welcome! Start the first level to learn about blocks.</p>
        </section>
        <hr className="hint-solution-divider" />
        <section
          className="hint-section"
          id="hintSolutionSection"
          aria-labelledby="hintSolutionHeading"
        >
          <h4 className="hint-section-title" id="hintSolutionHeading">
            Solution guide
          </h4>
          <p className="hint-solution-summary" id="hintSolutionSummary">
            Others&apos; best: --
          </p>
          <button
            type="button"
            className="hint-solution-action"
            id="hintSolutionActionBtn"
            style={{ display: "none" }}
          >
            Unlock guide
          </button>
          <p className="hint-solution-note" id="hintSolutionNote"></p>
        </section>
      </div>
    </div>
  );
}
