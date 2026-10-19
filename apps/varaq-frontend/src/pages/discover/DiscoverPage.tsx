import { PublicDirectory } from '@/features/discovery/PublicDirectory';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { WritingCard } from '@/components/literary/WritingCard';
import { forms, toWriting } from '@/features/feed/writings';
import { usePublicFeed } from '@/features/feed/usePublicFeed';
import { FeedStatus } from '@/features/feed/FeedStatus';
import type { PieceType } from '@/lib/api';

export function DiscoverPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('q') ?? '';
  const writers = searchParams.get('tab') === 'writers';
  const [query, setQuery] = useState(search.trim());
  const [type, setType] = useState<PieceType | undefined>();
  const navigate = useNavigate();
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  const feed = usePublicFeed({ type, query, enabled: !writers });
  return (
    <div className="page-content">
      <header className="page-intro">
        <div>
          <h1>Discover</h1>
          <p>Find a page or a writer among publicly published writing.</p>
        </div>
      </header>
      <div className="discovery-tabs" aria-label="Search category">
        {['pages', 'writers'].map((tab) => (
          <button
            key={tab}
            className="varaq-action"
            aria-pressed={writers === (tab === 'writers')}
            onClick={() =>
              setSearchParams((current) => {
                current.set('tab', tab);
                return current;
              })
            }
          >
            {tab === 'pages' ? 'Pages' : 'Writers'}
          </button>
        ))}
      </div>
      <div className="feed-toolbar">
        <label>
          {writers ? 'Search writers' : 'Search the pages'}{' '}
          <input
            className="rounded border p-2"
            type="search"
            maxLength={75}
            value={search}
            onChange={(e) => {
              const value = e.target.value;
              setSearchParams(
                (current) => {
                  if (value) current.set('q', value);
                  else current.delete('q');
                  return current;
                },
                { replace: true },
              );
            }}
            placeholder="A title, a word, a writer…"
          />
        </label>
        {!writers && (
          <label>
            Form{' '}
            <select
              className="sort-control"
              value={type ?? ''}
              onChange={(e) => setType(e.target.value ? (e.target.value as PieceType) : undefined)}
            >
              <option value="">All pages</option>
              {Object.entries(forms).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {writers ? (
        <PublicDirectory key={search.trim().toLowerCase()} query={search.trim().toLowerCase()} />
      ) : (
        <>
          <section
            className="saved-writing-grid"
            aria-label="Discovered writing"
            aria-busy={feed.isLoading}
          >
            {feed.items.map((piece) => (
              <WritingCard
                key={piece.id}
                writing={toWriting(piece)}
                onRead={(writing) => navigate('/', { state: { openWritingId: writing.id } })}
              />
            ))}
          </section>
          <FeedStatus feed={feed} />
        </>
      )}
    </div>
  );
}
