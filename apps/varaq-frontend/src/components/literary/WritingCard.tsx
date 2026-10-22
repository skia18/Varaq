import { BookmarkPicker } from '../../features/collections/BookmarkPicker';
import type { Writing } from '../../features/feed/writings';
import { Link } from 'react-router-dom';

type WritingCardProps = {
  writing: Writing;
  onRead: (writing: Writing) => void;
};

export function WritingCard({ writing, onRead }: WritingCardProps) {
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

        <BookmarkPicker pieceId={writing.id} />
      </div>
    </>
  );

  return <article className={`writing-card tone-${writing.tone}`}>{content}</article>;
}
