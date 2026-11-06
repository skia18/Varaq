import { Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatDuration } from '@/features/feed/writings';
import { pauseOtherAudioPlayers } from './audio-playback';
import { AudioWaveform } from './AudioWaveform';

export function AudioPlayer({
  src,
  duration,
  artwork,
  fullscreen = false,
}: {
  src: string;
  duration?: number;
  artwork?: string;
  fullscreen?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [length, setLength] = useState(duration ?? 0);

  useEffect(() => () => audioRef.current?.pause(), []);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play().catch(() => setPlaying(false));
    else audio.pause();
  }

  function seek(value: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value;
    setTime(value);
  }

  return (
    <div
      className={`audio-player${artwork ? ' has-artwork' : ' has-hue-background'}${fullscreen ? ' audio-player--fullscreen' : ''}`}
      style={
        artwork
          ? {
              backgroundImage: `linear-gradient(rgb(20 16 13 / 38%), rgb(20 16 13 / 72%)), url("${artwork.replaceAll('"', '\\"')}")`,
            }
          : undefined
      }
    >
      <button
        type="button"
        className="audio-toggle"
        aria-label={playing ? 'Pause recording' : 'Play recording'}
        onClick={toggle}
      >
        {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
      </button>
      <div className="audio-track">
        <div className="audio-player-heading">
          <span>Listen</span>
          <span>{playing ? 'Playing' : 'Audio page'}</span>
        </div>
        <AudioWaveform
          progress={length ? time / length : 0}
          onSeek={(progress) => seek(progress * length)}
        />
        <div className="audio-times">
          <span>{formatDuration(time)}</span>
          <span>{formatDuration(length)}</span>
        </div>
      </div>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={(event) => {
          pauseOtherAudioPlayers(event.currentTarget);
          setPlaying(true);
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => {
          const nextLength = event.currentTarget.duration;
          if (Number.isFinite(nextLength) && nextLength > 0) setLength(nextLength);
        }}
      />
    </div>
  );
}
