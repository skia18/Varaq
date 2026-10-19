import { ReadingDialog } from '@/components/literary/ReadingDialog';
import { toWriting } from '@/features/feed/writings';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Feather, Pencil, RefreshCw, Send, Trash2 } from 'lucide-react';

import { useAuth } from '@/auth/AuthProvider';
import { deleteOwnerPiece, getOwnerPieces, publishOwnerPiece, type Piece } from '@/lib/api';

const PAGE_SIZE = 20;

const CARD_TONES = ['paper', 'sage', 'plain', 'red'] as const;

function formatDate(date: string) {
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date));
}

function formatType(type: Piece['type']) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function getExcerpt(body: string, maxLength = 500) {
  if (body.length <= maxLength) return body;
  return `${body.slice(0, maxLength).trimEnd()}…`;
}

function getReadTime(body: string) {
  return Math.max(1, Math.ceil(body.trim().split(/\s+/).filter(Boolean).length / 200));
}

export function ProfilePage() {
  const { user, persona, isLoading, isPersonaLoading, personaError, refreshPersona } = useAuth();

  const [pieces, setPieces] = useState<Piece[]>([]);
  const [readingId, setReadingId] = useState<string | null>(null);
  const readingPiece = pieces.find((piece) => piece.id === readingId);
  const reading =
    readingPiece && persona
      ? toWriting({ ...readingPiece, author: persona.displayName, handle: persona.handle })
      : null;
  const [isPiecesLoading, setIsPiecesLoading] = useState(false);
  const [piecesError, setPiecesError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [pieceActionId, setPieceActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    setReadingId(null);
  }, [persona?.handle]);

  useEffect(() => {
    if (!persona?.handle) {
      setPieces([]);
      setIsPiecesLoading(false);
      return;
    }

    let cancelled = false;

    async function loadPieces() {
      setIsPiecesLoading(true);
      setPiecesError(null);
      setPieces([]);

      try {
        const page = await getOwnerPieces({ limit: PAGE_SIZE });

        if (cancelled) return;

        setPieces(page.items);
      } catch (error) {
        if (cancelled) return;

        setPiecesError(error instanceof Error ? error.message : 'Could not load your pages.');
      } finally {
        if (!cancelled) {
          setIsPiecesLoading(false);
        }
      }
    }

    void loadPieces();

    return () => {
      cancelled = true;
    };
  }, [persona?.handle, reloadKey]);

  async function handlePublish(piece: Piece) {
    const confirmed = window.confirm(
      `Publish "${piece.title}"? It will become visible on your public wall.`,
    );

    if (!confirmed) return;

    setPieceActionId(piece.id);
    setActionError(null);
    setActionMessage(null);

    try {
      await publishOwnerPiece(piece.id);

      setActionMessage(`"${piece.title}" has been published.`);
      setReloadKey((key) => key + 1);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not publish this page.');
    } finally {
      setPieceActionId(null);
    }
  }

  async function handleDelete(piece: Piece) {
    const confirmed = window.confirm(`Permanently delete "${piece.title}"? This cannot be undone.`);

    if (!confirmed) return;

    setPieceActionId(piece.id);
    setActionError(null);
    setActionMessage(null);

    try {
      await deleteOwnerPiece(piece.id);

      setPieces((current) => current.filter((item) => item.id !== piece.id));
      setActionMessage(`"${piece.title}" has been deleted.`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not delete this page.');
    } finally {
      setPieceActionId(null);
    }
  }

  if (isLoading || isPersonaLoading) {
    return (
      <section className="page-section">
        <p className="eyebrow">A writer’s wall</p>
        <h1 className="font-heading text-4xl">A moment, please…</h1>
        <p className="mt-4 text-muted-foreground">Gathering your little corner of Varaq.</p>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="page-section">
        <p className="eyebrow">A writer’s wall</p>
        <h1 className="font-heading text-4xl">Your wall awaits.</h1>
        <Link to="/login" className="mt-6 inline-flex items-center gap-2">
          Sign in <ArrowRight size={16} />
        </Link>
      </section>
    );
  }

  if (personaError) {
    return (
      <section className="page-section">
        <p className="eyebrow">A writer’s wall</p>
        <h1 className="font-heading text-4xl">Your wall, almost there.</h1>
        <p className="mt-4 text-muted-foreground">{personaError}</p>
        <button
          type="button"
          onClick={() => void refreshPersona()}
          className="mt-6 inline-flex items-center gap-2 text-sm underline underline-offset-4"
        >
          <RefreshCw size={15} />
          Try again
        </button>
      </section>
    );
  }

  if (!persona) {
    return (
      <section className="page-section">
        <p className="eyebrow">A writer’s wall</p>
        <h1 className="font-heading text-4xl">A page of your own.</h1>
        <p className="mt-4 text-muted-foreground">Your writing wall is not set up yet.</p>
      </section>
    );
  }

  return (
    <div className="page-content">
      <p>
        <Link to="/vault">Open encrypted Vault</Link> · Published writing and legacy drafts. Legacy
        drafts are not end-to-end encrypted.
      </p>
      <section className="writer-profile">
        <span className="eyebrow">A writer’s wall</span>

        <span className="avatar-mark" aria-hidden="true">
          {persona.displayName.trim().charAt(0).toLowerCase() || 'v'}
        </span>

        <h1>{persona.displayName}</h1>

        {persona.bio && <p className="bio">{persona.bio}</p>}

        <p className="wall-handle">@{persona.handle}</p>
      </section>

      <div className="writer-tabs">
        <span className="eyebrow">
          {pieces.length === 1 ? '1 page loaded' : `${pieces.length} pages loaded`}
        </span>

        <button
          type="button"
          onClick={() => {
            setActionError(null);
            setActionMessage(null);
            setReloadKey((key) => key + 1);
          }}
          disabled={isPiecesLoading || pieceActionId !== null}
          className="wall-refresh"
          aria-label="Refresh your pages"
        >
          <RefreshCw size={14} className={isPiecesLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {actionError && (
        <p className="wall-inline-error" role="alert">
          {actionError}
        </p>
      )}

      {actionMessage && (
        <p className="wall-status" role="status">
          {actionMessage}
        </p>
      )}

      {isPiecesLoading && (
        <p className="wall-status" role="status">
          Turning the pages…
        </p>
      )}

      {!isPiecesLoading && piecesError && pieces.length === 0 && (
        <div className="empty-page">
          <Feather />
          <h2>These pages are out of reach.</h2>
          <p>{piecesError}</p>
          <button
            type="button"
            className="literary-button wall-retry"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            Try again <ArrowRight size={14} />
          </button>
        </div>
      )}

      {!isPiecesLoading && !piecesError && pieces.length === 0 && (
        <div className="empty-page">
          <Feather />
          <h2>Every wall begins with a word.</h2>
          <p>This page is still becoming.</p>
          <Link to="/write" className="literary-button wall-write-link">
            <Feather size={14} />
            Write your first page
          </Link>
        </div>
      )}

      {pieces.length > 0 && (
        <div className="writing-grid wall-writing-grid">
          {[0, 1, 2].map((column) => {
            const columnPieces = pieces.filter((_, index) => index % 3 === column);

            return (
              <div className="writing-column" key={column}>
                {columnPieces.map((piece) => {
                  const pieceIndex = pieces.findIndex((item) => item.id === piece.id);
                  const tone = CARD_TONES[pieceIndex % CARD_TONES.length];

                  const displayDate =
                    piece.status === 'published'
                      ? (piece.publishedAt ?? piece.createdAt)
                      : piece.updatedAt;

                  return (
                    <article key={piece.id} className={`writing-card tone-${tone}`}>
                      <div className="card-meta">
                        <span>{formatDate(displayDate)}</span>
                        <span className="card-type">{formatType(piece.type)}</span>
                      </div>

                      <button
                        type="button"
                        className="card-read wall-card-content"
                        aria-label={`Read ${piece.title}`}
                        onClick={() => setReadingId(piece.id)}
                      >
                        <h2>{piece.title}</h2>
                        <p className="card-excerpt">{getExcerpt(piece.body)}</p>
                      </button>

                      <div className="card-footer wall-card-footer">
                        <span>{getReadTime(piece.body)} min read</span>
                        <span>{piece.status === 'draft' ? 'Draft' : 'Published'}</span>
                      </div>

                      <div className="vault-card-actions">
                        <Link
                          to={
                            piece.status === 'draft'
                              ? `/write?importId=${encodeURIComponent(piece.id)}`
                              : `/published/edit?pieceId=${encodeURIComponent(piece.id)}`
                          }
                          className="vault-card-action"
                          aria-label={`Edit ${piece.title}`}
                        >
                          <Pencil size={14} />
                          Edit
                        </Link>

                        {piece.status === 'draft' && (
                          <Link to={`/write?importId=${piece.id}`}>Move into encrypted Vault</Link>
                        )}
                        {piece.status === 'draft' && (
                          <button
                            type="button"
                            className="vault-card-action"
                            onClick={() => void handlePublish(piece)}
                            disabled={pieceActionId !== null}
                          >
                            <Send size={14} />
                            {pieceActionId === piece.id ? 'Publishing…' : 'Publish'}
                          </button>
                        )}

                        <button
                          type="button"
                          className="vault-card-action vault-card-delete"
                          onClick={() => void handleDelete(piece)}
                          disabled={pieceActionId !== null}
                        >
                          <Trash2 size={14} />
                          {pieceActionId === piece.id ? 'Working…' : 'Delete'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {piecesError && pieces.length > 0 && (
        <p className="wall-inline-error" role="status">
          {piecesError}
        </p>
      )}

      <ReadingDialog reading={reading} onClose={() => setReadingId(null)} />

      <footer className="page-footer">
        <span>A little less noise. A little more meaning.</span>
        <span>Varaq · Words belong to their writers.</span>
      </footer>
    </div>
  );
}
