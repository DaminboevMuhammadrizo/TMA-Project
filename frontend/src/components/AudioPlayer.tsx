import { useEffect, useRef, useState, type ChangeEvent, type MouseEvent } from 'react';
import type { MediaItem } from '@/api/types';
import { formatDuration } from '@/utils/format';
import { registerPlaying, unregisterIfCurrent } from '@/utils/audioSingleton';
import { PauseIcon, PlayIcon } from './icons';

interface AudioPlayerProps {
  item: MediaItem;
}

/**
 * Compact, custom-styled audio player (play/pause, scrub, duration) built on
 * a plain <audio> element with the native controls hidden — used for both
 * AUDIO (music) and VOICE items.
 */
export function AudioPlayer({ item }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(item.durationSec ?? 0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const onWaiting = () => setIsLoading(true);
    const onPlaying = () => setIsLoading(false);
    const onPause = () => setIsPlaying(false);
    const onPlay = () => setIsPlaying(true);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('play', onPlay);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('play', onPlay);
      unregisterIfCurrent(audio);
    };
  }, []);

  const togglePlay = (e: MouseEvent) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      registerPlaying(audio);
      audio.play().catch(() => setIsPlaying(false));
    } else {
      audio.pause();
    }
  };

  const onScrub = (e: ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;
    const value = Number(e.target.value);
    audio.currentTime = value;
    setCurrentTime(value);
  };

  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="flex items-center gap-3 w-full" onClick={(e) => e.stopPropagation()}>
      <audio ref={audioRef} src={item.fileUrl} preload="none" />
      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pauza' : 'Ijro etish'}
        className="shrink-0 flex items-center justify-center w-11 h-11 rounded-full bg-tg-button text-tg-button-text active:scale-95 transition-transform"
      >
        {isLoading ? (
          <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
        ) : isPlaying ? (
          <PauseIcon className="w-5 h-5" />
        ) : (
          <PlayIcon className="w-5 h-5 ml-0.5" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <input
          type="range"
          className="scrub w-full"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(currentTime, duration || 0)}
          onChange={onScrub}
          style={{
            background: `linear-gradient(to right, var(--tg-button-color) ${progressPct}%, var(--tg-section-separator-color) ${progressPct}%)`,
          }}
        />
        <div className="flex justify-between mt-1 text-xs text-tg-hint tabular-nums">
          <span>{formatDuration(currentTime)}</span>
          <span>{formatDuration(duration)}</span>
        </div>
      </div>
    </div>
  );
}
