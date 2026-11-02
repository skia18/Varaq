export function pauseOtherAudioPlayers(active: HTMLAudioElement) {
  document.querySelectorAll('audio').forEach((audio) => {
    if (audio !== active && !audio.paused) audio.pause();
  });
}
