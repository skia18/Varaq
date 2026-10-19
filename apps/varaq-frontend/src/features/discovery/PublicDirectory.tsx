import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getPersonaCollections,
  searchPersonas,
  type Persona,
  type PublicCollectionSummary,
} from '@/lib/api';

// Key this component by query/handle so pending pagination cannot affect another directory.
export function PublicDirectory({
  query,
  handle,
  compact = false,
  onNavigate,
}: {
  query?: string;
  handle?: string;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const [people, setPeople] = useState<Persona[]>([]);
  const [collections, setCollections] = useState<PublicCollectionSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(
      () => {
        const request = handle
          ? getPersonaCollections(handle, { signal: controller.signal })
          : searchPersonas(query ?? '', { limit: compact ? 5 : 20, signal: controller.signal });
        void request
          .then((page) => {
            if (controller.signal.aborted) return;
            if (handle) setCollections(page.items as PublicCollectionSummary[]);
            else setPeople(page.items as Persona[]);
            setCursor(page.nextCursor);
          })
          .catch(() => {
            if (!controller.signal.aborted) setError('Could not load results. Please try again.');
          })
          .finally(() => {
            if (!controller.signal.aborted) setLoading(false);
          });
      },
      handle ? 0 : 300,
    );
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, handle, compact, attempt]);
  async function more() {
    if (!cursor || loading) return;
    setLoading(true);
    setError('');
    try {
      if (handle) {
        const page = await getPersonaCollections(handle, { cursor });
        setCollections((old) => [
          ...old,
          ...page.items.filter((c) => !old.some((p) => p.id === c.id)),
        ]);
        setCursor(page.nextCursor);
      } else {
        const page = await searchPersonas(query ?? '', { cursor });
        setPeople((old) => [...old, ...page.items.filter((c) => !old.some((p) => p.id === c.id))]);
        setCursor(page.nextCursor);
      }
    } catch {
      setError('Could not load more results. Please try again.');
    } finally {
      setLoading(false);
    }
  }
  return (
    <section
      className="public-directory"
      aria-label={handle ? 'Public collections' : 'Writers'}
      aria-busy={loading}
    >
      {people.map((person) => (
        <Link
          className="directory-card"
          key={person.id}
          to={`/wall/${encodeURIComponent(person.handle)}`}
          onClick={onNavigate}
        >
          <strong>{person.displayName}</strong>
          <span>@{person.handle}</span>
          {person.bio && <p>{person.bio}</p>}
        </Link>
      ))}
      {collections.map((collection) => (
        <Link className="directory-card" key={collection.id} to={`/collections/${collection.id}`}>
          <strong>{collection.name}</strong>
          {collection.description && <p>{collection.description}</p>}
          <span>
            {collection.pieceCount} {collection.pieceCount === 1 ? 'piece' : 'pieces'}
          </span>
        </Link>
      ))}
      {loading && <p role="status">Loading {handle ? 'collections' : 'writers'}…</p>}
      {error && (
        <p role="alert">
          {error}{' '}
          <button
            className="varaq-action"
            onClick={() => {
              if (people.length || collections.length) void more();
              else {
                setError('');
                setLoading(true);
                setAttempt((n) => n + 1);
              }
            }}
          >
            Retry
          </button>
        </p>
      )}
      {!loading && !error && people.length === 0 && collections.length === 0 && (
        <p>
          {handle ? 'No public collections here yet.' : 'No writers found. Try a name or @handle.'}
        </p>
      )}
      {cursor &&
        (compact ? (
          <Link
            className="search-view-all"
            to={`/discover?${new URLSearchParams({ q: query ?? '', tab: 'writers' })}`}
            onClick={onNavigate}
          >
            View all writers
          </Link>
        ) : (
          <button className="varaq-action" disabled={loading} onClick={() => void more()}>
            Load more
          </button>
        ))}
    </section>
  );
}
