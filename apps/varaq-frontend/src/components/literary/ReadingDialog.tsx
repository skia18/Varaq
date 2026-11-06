import { Dialog } from '@base-ui/react/dialog';
import { Link } from 'react-router-dom';
import type { Writing } from '@/features/feed/writings';
import { literaryFormLabel } from '@/features/feed/writings';
import { AudioPlayer } from './AudioPlayer';

type Reading = Pick<Writing, 'title' | 'form' | 'minutes' | 'author' | 'date' | 'body'> & {
  handle?: string;
} & Partial<
    Pick<
      Writing,
      'medium' | 'imageUrl' | 'imageAlt' | 'audioUrl' | 'coverUrl' | 'audioDuration' | 'credits'
    >
  >;

export function ReadingDialog({
  reading,
  onClose,
}: {
  reading: Reading | null;
  onClose: () => void;
}) {
  return (
    <Dialog.Root
      open={Boolean(reading)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="reading-shade" />
        <Dialog.Viewport className="reading-backdrop">
          <Dialog.Popup className="reading-modal" aria-describedby={undefined}>
            {reading && (
              <>
                <Dialog.Close className="reading-close" aria-label="Close reading">
                  ×
                </Dialog.Close>
                <span className="eyebrow">
                  {literaryFormLabel(reading.form)} · {reading.minutes} min read
                </span>
                <Dialog.Title className="reading-title">{reading.title}</Dialog.Title>
                <p className="reading-byline">
                  by{' '}
                  {reading.handle ? (
                    <Link
                      to={`/wall/${encodeURIComponent(reading.handle)}`}
                      onClick={onClose}
                      aria-label={`Visit ${reading.author}’s wall`}
                    >
                      {reading.author}
                    </Link>
                  ) : (
                    reading.author
                  )}{' '}
                  · {reading.date}
                </p>
                {(reading.imageUrl || (reading.coverUrl && !reading.audioUrl)) && (
                  <figure className="reading-media">
                    <img
                      src={reading.imageUrl ?? reading.coverUrl}
                      alt={reading.imageAlt ?? `Image for ${reading.title}`}
                      className="reading-media-image"
                    />
                  </figure>
                )}
                {reading.audioUrl && (
                  <AudioPlayer
                    src={reading.audioUrl}
                    duration={reading.audioDuration}
                    artwork={reading.coverUrl}
                  />
                )}
                <div className="reading-body">{reading.body}</div>
                {reading.credits && reading.credits.length > 0 && (
                  <ul className="media-credits">
                    {reading.credits.map((credit) => (
                      <li key={credit}>{credit}</li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
