import { useState } from 'react';
import { Bookmark, Heart } from 'lucide-react';
import type { Writing } from '../../features/feed/writings';

type WritingCardProps = {
  writing: Writing;
  onRead: (writing: Writing) => void;
};

export function WritingCard({ writing, onRead }: WritingCardProps) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);

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
        <button
          type="button"
          className={liked ? 'is-active' : ''}
          onClick={() => setLiked((value) => !value)}
          aria-label={liked ? 'Remove appreciation' : 'Appreciate this writing'}
          aria-pressed={liked}
        >
          <Heart fill={liked ? 'currentColor' : 'none'} />
          {writing.appreciations + Number(liked)}
        </button>

        <span>{writing.minutes} min read</span>

        <button
          type="button"
          className={saved ? 'is-active' : ''}
          onClick={() => setSaved((value) => !value)}
          aria-label={saved ? 'Remove saved page' : 'Save this page'}
          aria-pressed={saved}
        >
          <Bookmark fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>
    </>
  );

  return (
    <article className={`writing-card tone-${writing.tone}`}>
      {writing.tone === 'photo' && (
        <button
          type="button"
          className="card-photo-button"
          onClick={() => onRead(writing)}
          aria-label={`Read ${writing.title}`}
        >
          <img
            src="/quiet-window.jpg"
            alt="A quiet window with soft natural light"
            className="card-photo"
          />
        </button>
      )}

      {writing.tone === 'photo' ? <div className="photo-content">{content}</div> : content}
    </article>
  );
}
