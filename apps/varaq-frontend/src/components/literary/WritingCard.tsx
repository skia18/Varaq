import { BookmarkPicker } from '../../features/collections/BookmarkPicker';
import type { Writing } from '../../features/feed/writings';
import { Link } from 'react-router-dom';
import { AudioLines, Pause, Play } from 'lucide-react';
import { formatDuration, literaryFormLabel } from '../../features/feed/writings';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { pauseOtherAudioPlayers } from './audio-playback';

type WritingCardProps = {
  writing: Writing;
  onRead: (writing: Writing) => void;
  showBookmark?: boolean;
  actions?: ReactNode;
};

export function WritingCard({ writing, onRead, showBookmark = true, actions }: WritingCardProps) {
  const medium = writing.medium ?? 'writing';
  const mediaImage = medium === 'audio' ? writing.coverUrl : writing.imageUrl;
  const previewRef = useRef<HTMLAudioElement>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);

  useEffect(() => () => previewRef.current?.pause(), []);

  function toggleAudioPreview() {
    const audio = previewRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play().catch(() => setPreviewPlaying(false));
    else audio.pause();
  }
  const content = (
    <>
      <div className="card-meta">
        <Link
          className="card-author"
          to={`/wall/${encodeURIComponent(writing.handle)}`}
          aria-label={`Visit ${writing.author}’s wall`}
        >
          {writing.author}
        </Link>
        <span className="card-type">{literaryFormLabel(writing.form)}</span>
      </div>

      <button
        type="button"
        className="card-read"
        onClick={() => onRead(writing)}
        aria-label={`Read ${writing.title}`}
      >
        <h2>{writing.title}</h2>
        <p className="card-excerpt">{writing.excerpt}</p>
      </button>

      <div className="card-footer">
        <span>
          {medium === 'audio' && writing.audioDuration
            ? formatDuration(writing.audioDuration)
            : `${writing.minutes} min read`}
        </span>

        {showBookmark && <BookmarkPicker pieceId={writing.id} />}
      </div>
      {actions}
    </>
  );

  if (medium !== 'writing') {
    return (
      <article className={`writing-card media-card media-${medium}`}>
        {(mediaImage || medium === 'audio') && (
          <div className="media-card-visual">
            <button
              type="button"
              className="media-card-open"
              onClick={() => onRead(writing)}
              aria-label={`Open ${writing.title}`}
            >
              {mediaImage ? (
                <img
                  src={mediaImage}
                  alt={
                    medium === 'audio'
                      ? `Cover art for ${writing.title}`
                      : (writing.imageAlt ?? writing.title)
                  }
                  className="media-card-image"
                  loading="lazy"
                />
              ) : (
                <span className="media-audio-placeholder" aria-hidden="true">
                  <AudioLines />
                </span>
              )}
            </button>
            {medium === 'audio' && writing.audioUrl && (
              <>
                <button
                  type="button"
                  className="media-play"
                  aria-label={previewPlaying ? `Pause ${writing.title}` : `Play ${writing.title}`}
                  onClick={toggleAudioPreview}
                >
                  {previewPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                </button>
                <audio
                  ref={previewRef}
                  src={writing.audioUrl}
                  preload="metadata"
                  onPlay={(event) => {
                    pauseOtherAudioPlayers(event.currentTarget);
                    setPreviewPlaying(true);
                  }}
                  onPause={() => setPreviewPlaying(false)}
                  onEnded={() => setPreviewPlaying(false)}
                />
              </>
            )}
          </div>
        )}
        <div className="media-card-content">{content}</div>
      </article>
    );
  }

  return <article className={`writing-card tone-${writing.tone}`}>{content}</article>;
}
