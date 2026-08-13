export function initMusicControls() {
  const bgMusic = document.getElementById("bgMusic");
  const musicToggle = document.getElementById("musicToggle");
  window.cmAudioMuted = false;
  window.cmMusicPlaying = false;

  function isHomepageVisible() {
    const startScreen = document.getElementById("startScreen");
    if (!startScreen) return true;
    return window.getComputedStyle(startScreen).display !== "none";
  }

  function syncBgMusic() {
    if (!bgMusic) return;
    const shouldPlay =
      window.cmMusicPlaying && !window.cmAudioMuted && !isHomepageVisible();
    if (!shouldPlay) {
      bgMusic.pause();
      return;
    }
    bgMusic.volume = 0.5;
    bgMusic.play().catch(() => {});
  }
  window.syncBgMusic = syncBgMusic;

  function applyGlobalMute(muted) {
    window.cmAudioMuted = !!muted;
    document.querySelectorAll("audio").forEach((audioEl) => {
      audioEl.muted = window.cmAudioMuted;
    });
    syncBgMusic();
    if (musicToggle) {
      musicToggle.textContent = window.cmAudioMuted ? "🔇 Muted" : "🔊 Music";
    }
  }

  const onToggle = () => applyGlobalMute(!window.cmAudioMuted);
  if (musicToggle) musicToggle.addEventListener("click", onToggle);
  if (bgMusic) bgMusic.pause();
  applyGlobalMute(false);

  return () => {
    if (musicToggle) musicToggle.removeEventListener("click", onToggle);
  };
}
