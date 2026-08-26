// Ensures only one <AudioPlayer> plays at a time across the whole app —
// starting one pauses whatever else was playing, like every normal player.
let currentlyPlaying: HTMLAudioElement | null = null;

export function registerPlaying(el: HTMLAudioElement) {
  if (currentlyPlaying && currentlyPlaying !== el) {
    currentlyPlaying.pause();
  }
  currentlyPlaying = el;
}

export function unregisterIfCurrent(el: HTMLAudioElement) {
  if (currentlyPlaying === el) currentlyPlaying = null;
}
