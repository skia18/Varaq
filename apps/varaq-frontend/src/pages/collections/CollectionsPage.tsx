import { useState } from 'react';
import {
  ArrowUpRight,
  Bookmark,
  BookOpen,
  FolderPlus,
  Globe2,
  LockKeyhole,
  Plus,
  Search,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCollections } from '@/features/collections/CollectionsContext';
import { CollectionForm } from '@/features/collections/CollectionForm';

export function CollectionsPage() {
  const { collections, loading, error, create, refresh, membership } = useCollections();
  const [creating, setCreating] = useState(false),
    [query, setQuery] = useState(''),
    [message, setMessage] = useState(''),
    [importing, setImporting] = useState(false);
  const [legacy, setLegacy] = useState<string[]>(() => {
    try {
      const ids: unknown = JSON.parse(localStorage.getItem('varaq:saved-pages') ?? '[]');
      return Array.isArray(ids)
        ? [
            ...new Set(
              ids.filter(
                (id): id is string => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id),
              ),
            ),
          ]
        : [];
    } catch {
      return [];
    }
  });
  async function importSaved() {
    const saved = collections.find((c) => c.systemType === 'saved');
    if (!saved) return;
    setImporting(true);
    const failed: string[] = [];
    for (const id of legacy) {
      try {
        await membership(saved.id, id, true);
      } catch {
        failed.push(id);
      }
    }
    setLegacy(failed);
    try {
      if (failed.length) localStorage.setItem('varaq:saved-pages', JSON.stringify(failed));
      else localStorage.removeItem('varaq:saved-pages');
    } catch {
      /* Preserve in-memory result if storage is unavailable. */
    }
    setMessage(
      failed.length
        ? `${legacy.length - failed.length} imported. ${failed.length} could not be imported; original browser saves retained for retry.`
        : 'Browser saves imported.',
    );
    setImporting(false);
  }
  return (
    <div className="page-content collections-page">
      <header className="page-intro">
        <div>
          <span className="collection-eyebrow">Your gathered pages</span>
          <h1>Collections</h1>
          <p>Gather the words you want to return to.</p>
        </div>
        <button className="varaq-action varaq-action--primary" onClick={() => setCreating(true)}>
          <Plus aria-hidden="true" /> New collection
        </button>
      </header>
      {legacy.length > 0 && (
        <section className="collection-import">
          <Bookmark aria-hidden="true" />
          <div>
            <strong>A few pages came with you.</strong>
            <p>
              This browser has {legacy.length} saved pieces. Import them into this account’s private
              Saved collection?
            </p>
          </div>
          <button
            className="varaq-action varaq-action--small"
            disabled={loading || importing}
            onClick={() => void importSaved()}
          >
            {importing ? 'Importing…' : 'Import browser saves'}
          </button>
        </section>
      )}
      {message && (
        <p className="collection-notice" role="status">
          {message}
        </p>
      )}
      {creating && <CollectionForm onSubmit={create} onCancel={() => setCreating(false)} />}
      <div className="collection-toolbar">
        <label className="collection-search">
          Find a collection
          <span className="collection-search-field">
            <Search aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search collections"
            />
          </span>
        </label>
        <span className="collection-tally">
          {collections.length} {collections.length === 1 ? 'collection' : 'collections'} · A little
          room for what stays.
        </span>
      </div>
      {loading ? (
        <p className="collection-notice" role="status">
          Loading collections…
        </p>
      ) : error ? (
        <p className="collection-notice collection-notice--error" role="alert">
          {error}{' '}
          <button
            className="varaq-action varaq-action--small"
            onClick={() => void refresh().catch(() => setMessage('Could not load collections.'))}
          >
            Retry
          </button>
        </p>
      ) : (
        <section className="collections-grid" aria-label="Your collections">
          {collections
            .filter((c) =>
              (c.name + ' ' + c.description).toLowerCase().includes(query.toLowerCase()),
            )
            .map((c) => (
              <Link
                className={`collection-tile ${c.systemType ? 'collection-tile-saved' : ''}`}
                to={`/collections/${c.id}`}
                key={c.id}
              >
                <div className="collection-art" aria-hidden="true">
                  <span className="collection-art-label">
                    {c.systemType ? 'The pages you keep' : 'A personal anthology'}
                  </span>
                  <span className="collection-art-emblem">
                    {c.systemType ? <Bookmark /> : <BookOpen />}
                  </span>
                  <span className="collection-art-note">
                    {c.systemType
                      ? 'For another day, another reading.'
                      : 'Words, gathered in your own way.'}
                  </span>
                </div>
                <span className="collection-tile-heading">
                  <span className="collection-eyebrow">
                    {c.systemType ? 'Made for you' : 'Your collection'}
                  </span>
                  <ArrowUpRight aria-hidden="true" />
                </span>
                <h2>{c.name}</h2>
                <p>
                  {c.description ||
                    (c.systemType ? 'Some words ask to be kept.' : 'A place for gathered pages.')}
                </p>
                <div className="collection-tile-footer">
                  <small>
                    {c.pieceIds.length} {c.pieceIds.length === 1 ? 'piece' : 'pieces'}
                  </small>
                  <span className="collection-privacy">
                    {c.visibility === 'private' ? (
                      <LockKeyhole aria-hidden="true" />
                    ) : (
                      <Globe2 aria-hidden="true" />
                    )}
                    {c.systemType
                      ? 'Always private'
                      : c.visibility === 'private'
                        ? 'Private'
                        : 'Public'}
                  </span>
                </div>
              </Link>
            ))}
          <button className="collection-tile collection-new" onClick={() => setCreating(true)}>
            <span className="collection-new-icon">
              <FolderPlus aria-hidden="true" />
            </span>
            <strong>Make a little room.</strong>
            <span>
              Start a collection for the words
              <br />
              that belong together.
            </span>
            <span className="collection-new-action">
              <Plus aria-hidden="true" /> New collection
            </span>
          </button>
        </section>
      )}
      <footer className="collection-page-note">
        Some words ask to be kept. Give them a place.
      </footer>
    </div>
  );
}
