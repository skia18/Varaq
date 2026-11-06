import { WritingCard } from '@/components/literary/WritingCard';
import { postItTone } from './postItTones';
import type { Writing } from './writings';

export function FeedGrid({
  writings,
  onRead,
  loading = false,
  ariaLabel = 'Recent writing',
  hrefForWriting = (writing) => `/piece/${encodeURIComponent(writing.id)}`,
}: {
  writings: Writing[];
  onRead: (writing: Writing) => void;
  loading?: boolean;
  ariaLabel?: string;
  hrefForWriting?: (writing: Writing) => string;
}) {
  return (
    <section aria-label={ariaLabel} className="saved-writing-grid commons-wall" aria-busy={loading}>
      {writings.map((writing, index) => (
        <div className="commons-note" key={writing.id}>
          <WritingCard
            writing={{ ...writing, tone: postItTone(index) }}
            onRead={onRead}
            pieceHref={hrefForWriting(writing)}
          />
        </div>
      ))}
    </section>
  );
}
