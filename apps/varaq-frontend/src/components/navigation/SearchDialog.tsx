import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Search, X } from 'lucide-react';
import { writings } from '../../features/feed/writings';

type SearchDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function SearchDialog({ open, onClose }: SearchDialogProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const normalizedQuery = query.trim().toLowerCase();
  const matches = writings.filter((writing) => {
    if (!normalizedQuery) return true;

    return [
      writing.title,
      writing.author,
      writing.handle,
      writing.form,
      writing.excerpt,
      writing.body,
    ].some((value) => value.toLowerCase().includes(normalizedQuery));
  });

  useEffect(() => {
    if (!open) return;

    setQuery('');
    const frame = requestAnimationFrame(() => inputRef.current?.focus());

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  function openWriting(id: string) {
    onClose();
    navigate('/', { state: { openWritingId: id } });
  }

  return (
    <div
      className="search-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="search-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-title"
        aria-describedby="search-description"
      >
        <div className="search-modal-heading">
          <div>
            <span className="eyebrow">A little searching</span>
            <h2 id="search-title">Find a page</h2>
          </div>
          <button
            type="button"
            className="search-close"
            aria-label="Close search"
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </div>

        <p id="search-description" className="search-description">
          Look for a word, a feeling, or a writer.
        </p>

        <label className="search-field">
          <Search aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="A word, a feeling, a writer…"
            aria-label="Search published writing"
          />
          {query && (
            <button type="button" className="search-clear" onClick={() => setQuery('')}>
              Clear
            </button>
          )}
        </label>

        <div className="search-results" aria-live="polite">
          <div className="search-results-meta">
            {normalizedQuery ? 'Pages that might be yours' : 'Pages to wander into'}
            <span>{matches.length}</span>
          </div>

          {matches.length ? (
            matches.map((writing) => (
              <button
                type="button"
                className="search-result"
                key={writing.id}
                onClick={() => openWriting(writing.id)}
              >
                <span className={`search-result-mark tone-${writing.tone}`} />
                <span className="search-result-copy">
                  <strong>{writing.title}</strong>
                  <small>
                    {writing.author} <span aria-hidden="true">·</span> {writing.form}
                  </small>
                  <span className="search-result-excerpt">{writing.excerpt}</span>
                </span>
                <ArrowRight aria-hidden="true" className="search-result-arrow" />
              </button>
            ))
          ) : (
            <div className="search-empty">
              <h3>No pages found, just yet.</h3>
              <p>Try another word, or search for a writer.</p>
            </div>
          )}
        </div>
        <p className="search-hint">
          <kbd>ESC</kbd> to close
        </p>
      </section>
    </div>
  );
}
