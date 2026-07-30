export default function GameAudio() {
  return (
    <>
      <audio id="bgMusic" loop preload="none">
        <source src="/assets/audio/background1.mp3" type="audio/mpeg" />
      </audio>
      <audio id="moveSound" preload="auto">
        <source src="/assets/audio/thump.mp3" type="audio/mpeg" />
      </audio>
      <audio id="explosionSound" preload="auto">
        <source src="/assets/audio/explosion.mp3" type="audio/mpeg" />
      </audio>
    </>
  );
}
