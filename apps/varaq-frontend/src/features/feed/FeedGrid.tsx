import { WritingCard } from '@/components/literary/WritingCard';
import type { Writing, WritingTone } from './writings';

const wallTones: WritingTone[] = [
  'paper',
  'sage',
  'blush',
  'blue',
  'ochre',
  'paper',
  'red',
  'sage',
  'blue',
  'blush',
];

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
            writing={{ ...writing, tone: wallTones[index % wallTones.length] }}
            onRead={onRead}
          />
        </div>
      ))}
    </section>
  );
}
