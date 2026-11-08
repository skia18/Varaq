import { BookmarkPicker } from '../../features/collections/BookmarkPicker';
import type { Writing } from '../../features/feed/writings';
import { Link } from 'react-router-dom';
import { AudioLines, Pause, Play } from 'lucide-react';
import { formatDuration } from '../../features/feed/writings';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { TrailPathIcon } from '@/components/icons/TrailPathIcon';
import { feedCategory, type FeedCategoryId } from '@/features/feed/categories';
import { pauseOtherAudioPlayers } from './audio-playback';
import { AudioWaveform } from './AudioWaveform';
import '@/styles/writing-card.css';

type WritingCardProps = {
  writing: Writing;
  onRead: (writing: Writing) => void;
  showBookmark?: boolean;
  actions?: ReactNode;
  pieceHref?: string;
};

const formCategories: Record<Writing['form'], FeedCategoryId> = {
  Poems: 'poem',
  'Short stories': 'story',
  Essays: 'essay',
  Letters: 'letter',
  Fragments: 'fragment',
};

const toneRotation: Record<Writing['tone'], number> = {
  paper: -1,
  sage: 1.5,
  red: -1,
  plain: 0,
  blue: 0.7,
  blush: -0.6,
  ochre: 0.9,
};

export function WritingCard({
  writing,
  onRead,
  showBookmark = true,
  actions,
  pieceHref,
}: WritingCardProps) {
  const medium = writing.medium ?? 'writing';
  const mediaImage = medium === 'audio' ? writing.coverUrl : writing.imageUrl;
  const category = feedCategory(medium === 'writing' ? formCategories[writing.form] : medium);
  const CategoryIcon = category.icon;
  const username = `@${writing.handle || writing.author}`;
  const reduceMotion = useReducedMotion();
  const rotation = medium === 'writing' ? toneRotation[writing.tone] : -0.6;
  const previewRef = useRef<HTMLAudioElement>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);
  const [previewLength, setPreviewLength] = useState(writing.audioDuration ?? 0);

  useEffect(() => () => previewRef.current?.pause(), []);

  function toggleAudioPreview() {
    const audio = previewRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play().catch(() => setPreviewPlaying(false));
    else audio.pause();
  }

  function seekAudioPreview(progress: number) {
    const audio = previewRef.current;
    if (!audio || !previewLength) return;
    audio.currentTime = progress * previewLength;
    setPreviewTime(audio.currentTime);
  }
  const content = (
    <>
      <div className="card-meta">
        <Link
          className="card-author"
          to={`/wall/${encodeURIComponent(writing.handle)}`}
          aria-label={`Visit ${writing.author}’s wall`}
        >
          {username}
        </Link>
        <span className="card-meta-icons">
          {(writing.trailConnected || writing.respondsTo) && (
            <span
              className="card-meta-icon"
              aria-label="Connected to a Trail"
              title="Connected to a Trail"
            >
              <TrailPathIcon aria-hidden="true" />
            </span>
          )}
          <span className="card-meta-icon" aria-label={category.label} title={category.label}>
            <CategoryIcon aria-hidden="true" />
          </span>
        </span>
      </div>

      {pieceHref ? (
        <Link className="card-read" to={pieceHref} aria-label={`Read ${writing.title}`}>
          <h2>{writing.title}</h2>
          <p className="card-excerpt">{writing.excerpt}</p>
        </Link>
      ) : (
        <button
          type="button"
          className="card-read"
          onClick={() => onRead(writing)}
          aria-label={`Read ${writing.title}`}
        >
          <h2>{writing.title}</h2>
          <p className="card-excerpt">{writing.excerpt}</p>
        </button>
      )}

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

  const visual = medium !== 'writing' && (mediaImage || medium === 'audio') && (
    <div className="media-card-visual">
      {pieceHref ? (
        <Link className="media-card-open" to={pieceHref} aria-label={`Open ${writing.title}`}>
          {mediaImage ? (
            <motion.img
              src={mediaImage}
              alt={
                medium === 'audio'
                  ? `Cover art for ${writing.title}`
                  : (writing.imageAlt ?? writing.title)
              }
              className="media-card-image"
              loading="lazy"
              whileHover={reduceMotion ? undefined : { scale: 1.025 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            />
          ) : (
            <motion.span
              className="media-audio-placeholder"
              aria-hidden="true"
              animate={
                reduceMotion ? undefined : { backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }
              }
              transition={{ duration: 14, ease: 'easeInOut', repeat: Infinity }}
            >
              <AudioLines />
            </motion.span>
          )}
        </Link>
      ) : (
        <button
          type="button"
          className="media-card-open"
          onClick={() => onRead(writing)}
          aria-label={`Open ${writing.title}`}
        >
          {mediaImage ? (
            <motion.img
              src={mediaImage}
              alt={
                medium === 'audio'
                  ? `Cover art for ${writing.title}`
                  : (writing.imageAlt ?? writing.title)
              }
              className="media-card-image"
              loading="lazy"
              whileHover={reduceMotion ? undefined : { scale: 1.025 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            />
          ) : (
            <motion.span
              className="media-audio-placeholder"
              aria-hidden="true"
              animate={
                reduceMotion ? undefined : { backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }
              }
              transition={{ duration: 14, ease: 'easeInOut', repeat: Infinity }}
            >
              <AudioLines />
            </motion.span>
          )}
        </button>
      )}
      {medium === 'audio' && writing.audioUrl && (
        <>
          <div className="media-audio-controls">
            <motion.button
              type="button"
              className="media-play"
              aria-label={previewPlaying ? `Pause ${writing.title}` : `Play ${writing.title}`}
              onClick={toggleAudioPreview}
              whileTap={reduceMotion ? undefined : { scale: 0.9 }}
            >
              {previewPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            </motion.button>
            <AudioWaveform
              className="media-waveform"
              progress={previewLength ? previewTime / previewLength : 0}
              onSeek={seekAudioPreview}
              label={`Seek through ${writing.title}`}
            />
            <span className="media-audio-time">
              {formatDuration(previewTime)} / {formatDuration(previewLength)}
            </span>
          </div>
          <audio
            ref={previewRef}
            src={writing.audioUrl}
            preload="metadata"
            onPlay={(event) => {
              pauseOtherAudioPlayers(event.currentTarget);
              setPreviewPlaying(true);
            }}
            onPause={() => setPreviewPlaying(false)}
            onEnded={() => {
              setPreviewPlaying(false);
              setPreviewTime(0);
            }}
            onTimeUpdate={(event) => setPreviewTime(event.currentTarget.currentTime)}
            onLoadedMetadata={(event) => {
              const length = event.currentTarget.duration;
              if (Number.isFinite(length) && length > 0) setPreviewLength(length);
            }}
          />
        </>
      )}
    </div>
  );

  return (
    <motion.article
      className={`writing-card tone-${writing.tone}${medium !== 'writing' ? ` media-card media-${medium}` : ''}`}
      initial={reduceMotion ? false : { opacity: 0, y: 10, rotate: rotation }}
      animate={{ opacity: 1, y: 0, rotate: rotation }}
      whileHover={reduceMotion ? undefined : { y: -4, rotate: 0 }}
      transition={{ duration: 0.26, ease: 'easeOut' }}
    >
      {visual}
      {medium !== 'writing' ? <div className="media-card-content">{content}</div> : content}
    </motion.article>
  );
}
