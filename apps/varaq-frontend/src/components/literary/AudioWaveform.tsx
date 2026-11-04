const BARS = [
  26, 44, 34, 62, 48, 76, 55, 38, 68, 84, 58, 42, 72, 52, 90, 64, 46, 78, 58, 36,
  66, 82, 54, 70, 94, 61, 43, 74, 56, 86, 67, 48, 76, 92, 63, 40, 69, 51, 80, 59,
  88, 65, 45, 73, 57, 83, 62, 38, 71, 91, 55, 77, 49, 68, 85, 60, 42, 75, 53, 81,
];

type AudioWaveformProps = {
  progress: number;
  onSeek: (progress: number) => void;
  label?: string;
  className?: string;
};

function Bars() {
  return BARS.map((height, index) => (
    <rect
      key={index}
      x={index * 4 + 1}
      y={(100 - height) / 2}
      width="2.4"
      height={height}
      rx="1.2"
    />
  ));
}

export function AudioWaveform({
  progress,
  onSeek,
  label = 'Seek through recording',
  className = '',
}: AudioWaveformProps) {
  const normalized = Math.max(0, Math.min(1, progress));

  return (
    <div className={`audio-waveform ${className}`.trim()}>
      <svg aria-hidden="true" viewBox="0 0 240 100" preserveAspectRatio="none">
        <g className="audio-waveform-idle"><Bars /></g>
        <g
          className="audio-waveform-played"
          style={{ clipPath: `inset(0 ${100 - normalized * 100}% 0 0)` }}
        >
          <Bars />
        </g>
      </svg>
      <input
        type="range"
        min={0}
        max={1}
        step={0.001}
        value={normalized}
        aria-label={label}
        onChange={(event) => onSeek(Number(event.target.value))}
      />
    </div>
  );
}
