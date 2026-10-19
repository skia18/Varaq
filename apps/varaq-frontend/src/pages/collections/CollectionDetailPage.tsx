import { ArrowLeft, Bookmark, Globe2, LockKeyhole, Pencil, Search, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCollections, type Collection } from '@/features/collections/CollectionsContext';
import { CollectionForm } from '@/features/collections/CollectionForm';
import { apiRequest, getFeed, type FeedPiece } from '@/lib/api';
import { toWriting } from '@/features/feed/writings';
import { WritingCard } from '@/components/literary/WritingCard';

export function CollectionDetailPage() {
  const { collectionId } = useParams();
  const navigate = useNavigate();
  const { collections, loading: ownerLoading, membership, update, remove } = useCollections();
  const owned = collections.find((c) => c.id === collectionId);
  const [shared, setShared] = useState<Collection | null>(null),
    [pieces, setPieces] = useState<FeedPiece[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState(''),
    [message, setMessage] = useState(''),
    [attempt, setAttempt] = useState(0);
  const collection = owned ?? shared;
  useEffect(() => {
    setShared(null);
    setEditing(false);
    setQuery('');
    setMessage('');
  }, [collectionId]);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setPieces([]);
    if (ownerLoading)
      return () => {
        active = false;
        controller.abort();
      };
    async function load() {
      try {
        const c =
          owned ??
          (await apiRequest<Collection>(`/api/v1/collections/${collectionId}/public`, {
            signal: controller.signal,
          }));
        if (!active) return;
        setShared(owned ? null : c);
        const batches: string[][] = [];
        for (let i = 0; i < c.pieceIds.length; i += 50) batches.push(c.pieceIds.slice(i, i + 50));
        const pages = await Promise.all(
          batches.map((ids) => getFeed({ ids, limit: 50, signal: controller.signal })),
        );
        const byId = new Map(pages.flatMap((p) => p.items).map((p) => [p.id, p]));
        if (active) setPieces(c.pieceIds.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : [])));
      } catch {
        if (active)
          setError('This collection could not be loaded. It may be private or unavailable.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [collectionId, owned, ownerLoading, attempt]);
  async function deleteCollection() {
    if (
      !owned ||
      !window.confirm(`Delete “${owned.name}”? The original pieces will remain available.`)
    )
      return;
    setBusy(true);
    try {
      await remove(owned.id);
      navigate('/collections');
    } catch {
      setMessage('Could not delete the collection. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  async function removePiece(id: string) {
    if (!owned) return;
    setBusy(true);
    try {
      await membership(owned.id, id, false);
      setMessage('Removed from this collection.');
    } catch {
      setMessage('Could not remove the piece. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page-content collections-page collection-detail">
      <Link className="collection-back" to="/collections">
        <ArrowLeft aria-hidden="true" /> All collections
      </Link>
      {loading ? (
        <p className="collection-notice" role="status">
          Loading collection…
        </p>
      ) : error ? (
        <p className="collection-notice collection-notice--error" role="alert">
          {error}{' '}
          <button
            className="varaq-action varaq-action--small"
            onClick={() => setAttempt((x) => x + 1)}
          >
            Retry
          </button>
        </p>
      ) : (
        collection && (
          <>
            <header className="page-intro collection-detail-header">
              <div>
                <span className="collection-eyebrow">
                  {collection.systemType
                    ? 'The pages you keep'
                    : owned
                      ? 'Your personal anthology'
                      : 'A shared anthology'}
                </span>
                <h1>{collection.name}</h1>
                <p>
                  {collection.description ||
                    (collection.systemType
                      ? 'Some words ask to be kept. These are yours to return to.'
                      : 'Words, gathered in their own little corner.')}
                </p>
                <div className="collection-detail-meta">
                  <span>
                    {pieces.length} {pieces.length === 1 ? 'piece' : 'pieces'}
                  </span>
                  <span className="collection-privacy">
                    {collection.visibility === 'private' ? (
                      <LockKeyhole aria-hidden="true" />
                    ) : (
                      <Globe2 aria-hidden="true" />
                    )}
                    {collection.systemType
                      ? 'Always private'
                      : collection.visibility === 'private'
                        ? 'Private'
                        : 'Public'}
                  </span>
                </div>
              </div>
              {owned && !owned.systemType && (
                <div className="collection-actions">
                  <button className="varaq-action" onClick={() => setEditing(!editing)}>
                    <Pencil aria-hidden="true" /> Edit collection
                  </button>
                  <button
                    className="varaq-action collection-action-danger"
                    disabled={busy}
                    onClick={() => void deleteCollection()}
                  >
                    <Trash2 aria-hidden="true" /> Delete collection
                  </button>
                </div>
              )}
            </header>
            {collection.visibility === 'public' && (
              <p className="collection-share">
                <Globe2 aria-hidden="true" /> Share this collection:{' '}
                <a href={`/collections/${collection.id}`}>
                  {window.location.origin}/collections/{collection.id}
                </a>
              </p>
            )}
            {editing && owned && (
              <CollectionForm
                initial={owned}
                onSubmit={(input) => update(owned.id, input)}
                onCancel={() => setEditing(false)}
              />
            )}
            <label className="collection-search">
              Find a piece
              <span className="collection-search-field">
                <Search aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search titles, writing, and authors"
                />
              </span>
            </label>
            {pieces.length === 0 ? (
              <section className="empty-page collection-empty">
                <Bookmark aria-hidden="true" />
                <h2>A shelf waiting for its first page.</h2>
                <p>Add published writing using its bookmark.</p>
                <Link className="varaq-action" to="/">
                  Browse the commons
                </Link>
              </section>
            ) : (
              <section className="saved-writing-grid" aria-label="Collection pieces">
                {pieces
                  .filter((p) =>
                    (p.title + ' ' + p.body + ' ' + p.author)
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )
                  .map((p) => (
                    <div key={p.id}>
                      <WritingCard
                        writing={toWriting(p)}
                        onRead={() => navigate(`/piece/${p.id}`)}
                      />
                      {owned && (
                        <button
                          className="collection-remove varaq-action varaq-action--small"
                          disabled={busy}
                          onClick={() => void removePiece(p.id)}
                        >
                          <span aria-hidden="true">−</span> Remove from {owned.name}
                        </button>
                      )}
                    </div>
                  ))}
              </section>
            )}
            <p className="collection-page-note">
              Only pieces that are still publicly available appear here.
            </p>
          </>
        )
      )}
      {message && (
        <p className="collection-notice" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
