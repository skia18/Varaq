import { WritingCard } from '@/components/literary/WritingCard';
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
    <section aria-label="Recent writing" className="saved-writing-grid" aria-busy={loading}>
      {writings.map((writing) => (
        <WritingCard key={writing.id} writing={writing} onRead={onRead} />
      ))}
    </section>
  );
}
