import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Bookmark, Globe2, LockKeyhole, Plus, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { useCollections } from './CollectionsContext';
import { CollectionForm } from './CollectionForm';

export function BookmarkPicker({ pieceId }: { pieceId: string }) {
  const { user } = useAuth();
  const { collections, loading, error: loadError, membership, create, refresh } = useCollections();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [position, setPosition] = useState<CSSProperties>({ visibility: 'hidden' });
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const saved = collections.some((c) => c.pieceIds.includes(pieceId));

  useEffect(() => {
    if (!open) return;
    function place() {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const margin = 16;
      const gap = 8;
      const width = Math.min(352, window.innerWidth - margin * 2);
      const below = window.innerHeight - rect.bottom - margin - gap;
      const above = rect.top - margin - gap;
      const down = below >= Math.min(420, above);
      setPosition({
        width,
        left: Math.max(margin, Math.min(rect.right - width, window.innerWidth - width - margin)),
        ...(down ? { top: rect.bottom + gap } : { bottom: window.innerHeight - rect.top + gap }),
        maxHeight: Math.max(100, down ? below : above),
      });
    }
    function outside(e: PointerEvent) {
      const target = e.target as Node;
      if (!root.current?.contains(target) && !panel.current?.contains(target)) setOpen(false);
    }
    function key(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    }
    place();
    panel.current?.focus({ preventScroll: true });
    window.addEventListener('resize', place);
    // Capture scrolling on the page as well as nested containers.
    window.addEventListener('scroll', place, true);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  async function change(id: string, add: boolean) {
    setBusy(true);
    setMessage('');
    try {
      await membership(id, pieceId, add);
      setMessage(add ? 'Added to collection.' : 'Removed from collection.');
    } catch {
      setMessage('Could not update this collection. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  async function click() {
    setOpen(!open);
    if (!open && user && !saved) {
      const defaults = collections.find((c) => c.systemType === 'saved');
      if (defaults) await change(defaults.id, true);
    }
  }
  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  return (
    <div className="bookmark-picker" ref={root}>
      <button
        ref={trigger}
        type="button"
        className={`bookmark-trigger ${saved ? 'is-active' : ''}`}
        aria-label="Save and organize piece"
        aria-expanded={open}
        aria-controls={panelId}
        disabled={busy || (!!user && loading)}
        onClick={() => void click()}
      >
        <Bookmark fill={saved ? 'currentColor' : 'none'} />
      </button>
      {open &&
        createPortal(
          <div
            id={panelId}
            ref={panel}
            className="bookmark-popover"
            style={position}
            tabIndex={-1}
            role="region"
            aria-label="Save to collections"
            aria-busy={busy}
          >
            <header className="bookmark-popover-header">
              <div>
                <span className="collection-eyebrow">Keep these words</span>
                <h2>Save to collections</h2>
              </div>
              <button
                className="bookmark-close"
                type="button"
                onClick={close}
                aria-label="Close collection picker"
              >
                <X aria-hidden="true" />
              </button>
            </header>
            <p className="bookmark-popover-intro">A page can belong in more than one place.</p>
            {!user ? (
              <Link className="varaq-action varaq-action--primary" to="/login">
                Sign in to save this piece
              </Link>
            ) : (
              <>
                {loadError && (
                  <p className="collection-notice collection-notice--error" role="alert">
                    {loadError}{' '}
                    <button
                      className="varaq-action varaq-action--small"
                      onClick={() =>
                        void refresh().catch(() => setMessage('Could not load collections.'))
                      }
                    >
                      Retry
                    </button>
                  </p>
                )}
                <div className="collection-choices">
                  {collections.map((c) => (
                    <label className="collection-choice" key={c.id}>
                      <input
                        type="checkbox"
                        disabled={busy}
                        checked={c.pieceIds.includes(pieceId)}
                        onChange={(e) => void change(c.id, e.target.checked)}
                      />
                      <span className="collection-choice-copy">
                        <span className="collection-choice-name">{c.name}</span>
                        <small>
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
                        </small>
                      </span>
                      <span className="collection-choice-count">
                        {c.pieceIds.length} {c.pieceIds.length === 1 ? 'piece' : 'pieces'}
                      </span>
                    </label>
                  ))}
                </div>
                {creating ? (
                  <CollectionForm
                    onCancel={() => setCreating(false)}
                    onSubmit={async (input) => {
                      await create({ ...input, pieceId });
                      setMessage('Collection created with this piece.');
                    }}
                  />
                ) : (
                  <button className="bookmark-new" type="button" onClick={() => setCreating(true)}>
                    <Plus aria-hidden="true" /> New collection
                  </button>
                )}
              </>
            )}
            {message && (
              <p className="bookmark-feedback" role="status">
                {message}
              </p>
            )}
            <footer className="bookmark-popover-footer">
              <span>Your pages, your places.</span>
              <button className="varaq-action varaq-action--small" type="button" onClick={close}>
                Done
              </button>
            </footer>
          </div>,
          document.body,
        )}
    </div>
  );
}
