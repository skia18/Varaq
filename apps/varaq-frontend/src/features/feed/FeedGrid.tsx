import { WritingCard } from '@/components/literary/WritingCard';
import { postItTone } from './postItTones';
import type { Writing } from './writings';

export function FeedGrid({
  writings,
  onRead,
  loading = false,
}: {
  writings: Writing[];
  onRead: (writing: Writing) => void;
  loading?: boolean;
}) {
  return (
    <section
      aria-label="Recent writing"
      className="saved-writing-grid commons-wall"
      aria-busy={loading}
    >
      {writings.map((writing, index) => (
        <div className="commons-note" key={writing.id}>
          <WritingCard
            writing={{ ...writing, tone: postItTone(index) }}
            onRead={onRead}
          />
        </div>
      ))}
    </section>
  );
}
