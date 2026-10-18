import { Bookmark } from 'lucide-react';
import type { Writing } from '../../features/feed/writings';
import { useSavedPages } from '../../features/saved/SavedPagesContext';

type WritingCardProps = {
  writing: Writing;
  onRead: (writing: Writing) => void;
};

export function WritingCard({ writing, onRead }: WritingCardProps) {
  const { isSaved, toggleSaved } = useSavedPages();
  const saved = isSaved(writing.id);

  const content = (
    <>
      <div className="card-meta">
        <span className="card-author">{writing.author}</span>
        <span className="card-type">
          {writing.form === 'Short stories' ? 'Short story' : writing.form.replace(/s$/, '')}
        </span>
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
        <span>{writing.minutes} min read</span>

        <button
          type="button"
          className={saved ? 'is-active' : ''}
          onClick={() => toggleSaved(writing.id)}
          aria-label={saved ? 'Remove saved page' : 'Save this page'}
          aria-pressed={saved}
        >
          <Bookmark fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>
    </>
  );

  return <article className={`writing-card tone-${writing.tone}`}>{content}</article>;
}
