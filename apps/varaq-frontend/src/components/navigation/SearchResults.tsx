import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { Writing } from '@/features/feed/writings';

export function SearchResults({
  matches,
  hasMore,
  query,
  loading,
  error,
  onRead,
  onClose,
}: {
  matches: Writing[];
  hasMore: boolean;
  query: string;
  loading: boolean;
  error: string | null;
  onRead: (id: string) => void;
  onClose: () => void;
}) {
  const resultsPath = `/discover${query ? `?${new URLSearchParams({ q: query })}` : ''}`;
  return (
    <div className="search-results" aria-live="polite">
      <div className="search-results-meta">
        {query ? 'Pages that might be yours' : 'Pages to wander into'}
        <span>
          {matches.length}
          {hasMore ? '+' : ''}
        </span>
      </div>
      {loading ? (
        <p role="status">Searching pages…</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : (
        <>
          {matches.length ? (
            matches.map((writing) => (
              <button
                type="button"
                className="search-result"
                key={writing.id}
                onClick={() => onRead(writing.id)}
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
          {hasMore && (
            <Link className="search-view-all" to={resultsPath} onClick={onClose}>
              View all results <ArrowRight aria-hidden="true" size={16} />
            </Link>
          )}
        </>
      )}
    </div>
  );
}
