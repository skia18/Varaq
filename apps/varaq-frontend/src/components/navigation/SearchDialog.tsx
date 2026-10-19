import { PublicDirectory } from '@/features/discovery/PublicDirectory';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { toWriting, type Writing } from '../../features/feed/writings';
import { getFeed } from '@/lib/api';
import { SearchResults } from './SearchResults';

type SearchDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function SearchDialog({ open, onClose }: SearchDialogProps) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'pages' | 'writers'>('pages');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const normalizedQuery = query.trim().toLowerCase();
  const [matches, setMatches] = useState<Writing[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open || tab !== 'pages') return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setMatches([]);
    setHasMore(false);
    const timer = window.setTimeout(() => {
      void getFeed({ query: normalizedQuery, limit: 10, signal: controller.signal })
        .then((page) => {
          if (!controller.signal.aborted) {
            setMatches(page.items.map(toWriting));
            setHasMore(Boolean(page.nextCursor));
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) setError('Could not search pages. Please try again.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, normalizedQuery, tab]);

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
            <h2 id="search-title">Find a page or writer</h2>
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
            maxLength={75}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="A word, a feeling, a writer…"
            aria-label={tab === 'writers' ? 'Search writers' : 'Search published writing'}
          />
          {query && (
            <button type="button" className="search-clear" onClick={() => setQuery('')}>
              Clear
            </button>
          )}
        </label>

        <div className="discovery-tabs" aria-label="Search category">
          <button
            className="varaq-action"
            aria-pressed={tab === 'pages'}
            onClick={() => setTab('pages')}
          >
            Pages
          </button>
          <button
            className="varaq-action"
            aria-pressed={tab === 'writers'}
            onClick={() => setTab('writers')}
          >
            Writers
          </button>
        </div>
        {tab === 'writers' ? (
          <PublicDirectory
            key={normalizedQuery}
            query={normalizedQuery}
            compact
            onNavigate={onClose}
          />
        ) : (
          <SearchResults
            matches={matches}
            hasMore={hasMore}
            query={normalizedQuery}
            loading={loading}
            error={error}
            onRead={openWriting}
            onClose={onClose}
          />
        )}
        <p className="search-hint">
          <kbd>ESC</kbd> to close
        </p>
      </section>
    </div>
  );
}
