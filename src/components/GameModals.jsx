import LeaderboardModal from "./modals/LeaderboardModal.jsx";
import GuideModal from "./modals/GuideModal.jsx";
import InGameWalkthroughModal from "./modals/InGameWalkthroughModal.jsx";
import LevelCompleteModal from "./modals/LevelCompleteModal.jsx";
import ExchangeModal from "./modals/ExchangeModal.jsx";
import PowerUpsModal from "./modals/PowerUpsModal.jsx";

export default function GameModals() {
  return (
    <>
      <LeaderboardModal />
      <GuideModal />
      <InGameWalkthroughModal />
      <LevelCompleteModal />
      <PowerUpsModal />
      <ExchangeModal idPrefix="undo" title="Use Undo" titleId="undoExchangeTitle" />
      <ExchangeModal
        idPrefix="antigravity"
        title="Use Antigravity"
        titleId="antigravityExchangeTitle"
      />
    </>
  );
}
