import { Dialog } from '@base-ui/react/dialog';
import { PublicDirectory } from '@/features/discovery/PublicDirectory';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { toWriting, type Writing } from '../../features/feed/writings';
import { getFeed } from '@/lib/api';
import { SearchResults } from './SearchResults';
import '@/styles/search.css';

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
    if (!open || tab !== 'pages' || !normalizedQuery) {
      setLoading(false);
      setError(null);
      setMatches([]);
      setHasMore(false);
      return;
    }
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
  }, [open]);

  function openWriting(id: string) {
    onClose();
    void navigate('/', { state: { openWritingId: id } });
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="search-shade" />
        <Dialog.Viewport className="search-backdrop">
          <Dialog.Popup className="search-modal" initialFocus={inputRef}>
            <div className="search-modal-heading">
              <div>
                <span className="eyebrow">A little searching</span>
                <Dialog.Title id="search-title">Find a page or writer</Dialog.Title>
              </div>
              <Dialog.Close className="search-close" aria-label="Close search">
                <X aria-hidden="true" />
              </Dialog.Close>
            </div>

            <Dialog.Description id="search-description" className="search-description">
              Look for a word, a feeling, or a writer.
            </Dialog.Description>

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
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
