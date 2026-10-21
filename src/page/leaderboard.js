// The leaderboard owns its React state; only the existing guide uses DOM events.
export function initLeaderboardAndGuide() {
  const button = document.getElementById('instructionsButton');
  const modal = document.getElementById('guideModal');
  const close = document.getElementById('closeGuideModal');
  const openGuide = () => modal?.classList.add('active');
  const closeGuide = () => modal?.classList.remove('active');
  const backdrop = event => { if (event.target === modal) closeGuide(); };
  button?.addEventListener('click', openGuide);
  close?.addEventListener('click', closeGuide);
  modal?.addEventListener('click', backdrop);
  return () => {
    button?.removeEventListener('click', openGuide);
    close?.removeEventListener('click', closeGuide);
    modal?.removeEventListener('click', backdrop);
  };
}
