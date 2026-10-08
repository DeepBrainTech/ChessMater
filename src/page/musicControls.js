import { game } from '../game/runtime.js';
export function initMusicControls() {
  const bgMusic = document.getElementById("bgMusic");
  const musicToggle = document.getElementById("musicToggle");
  game.cmAudioMuted = false;
  game.cmMusicPlaying = false;

  function isHomepageVisible() {
    const startScreen = document.getElementById("startScreen");
    if (!startScreen) return true;
    return window.getComputedStyle(startScreen).display !== "none";
  }

  function syncBgMusic() {
    if (!bgMusic) return;
    const shouldPlay =
      game.cmMusicPlaying && !game.cmAudioMuted && !isHomepageVisible();
    if (!shouldPlay) {
      bgMusic.pause();
      return;
    }
    bgMusic.volume = 0.5;
    bgMusic.play().catch(() => {});
  }
  game.syncBgMusic = syncBgMusic;

  function applyGlobalMute(muted) {
    game.cmAudioMuted = !!muted;
    document.querySelectorAll("audio").forEach((audioEl) => {
      audioEl.muted = game.cmAudioMuted;
    });
    syncBgMusic();
    if (musicToggle) {
      musicToggle.textContent = game.cmAudioMuted ? "🔇 Muted" : "🔊 Music";
    }
  }

  const onToggle = () => applyGlobalMute(!game.cmAudioMuted);
  if (musicToggle) musicToggle.addEventListener("click", onToggle);
  if (bgMusic) bgMusic.pause();
  applyGlobalMute(false);

  return () => {
    if (musicToggle) musicToggle.removeEventListener("click", onToggle);
  };
}
