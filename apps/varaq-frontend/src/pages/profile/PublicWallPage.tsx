import { useAuth } from '@/auth/AuthProvider';
import { ProfilePage } from './ProfilePage';
import { ReadingDialog } from '@/components/literary/ReadingDialog';
import { toWriting } from '@/features/feed/writings';
import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowRight, Feather, RefreshCw } from 'lucide-react';

import { getPublicPersona, getPublicPieces, type Persona, type Piece } from '@/lib/api';

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

function PublicWallContent() {
  const { handle } = useParams<{ handle: string }>();

  const [persona, setPersona] = useState<Persona | null>(null);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [readingId, setReadingId] = useState<string | null>(null);
  const readingPiece = pieces.find((piece) => piece.id === readingId);
  const reading =
    readingPiece && persona
      ? toWriting({ ...readingPiece, author: persona.displayName, handle: persona.handle })
      : null;
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [piecesError, setPiecesError] = useState<string | null>(null);

  useEffect(() => {
    setReadingId(null);
  }, [handle]);

  useEffect(() => {
    let cancelled = false;

    async function loadWall() {
      setIsLoading(true);
      setError(null);
      setPiecesError(null);
      setPersona(null);
      setPieces([]);
      setNextCursor(null);

      if (!handle) {
        setError('This writer could not be found.');
        setIsLoading(false);
        return;
      }

      try {
        const publicPersona = await getPublicPersona(handle);

        if (cancelled) return;

        setPersona(publicPersona);

        const page = await getPublicPieces(handle, {
          limit: PAGE_SIZE,
        });

        if (cancelled) return;

        setPieces(page.items);
        setNextCursor(page.nextCursor);
      } catch (err) {
        if (cancelled) return;

        setError(err instanceof Error ? err.message : 'Could not open this writer’s wall.');
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadWall();

    return () => {
      cancelled = true;
    };
  }, [handle]);

  async function loadMore() {
    if (!handle || !nextCursor || isLoadingMore) return;

    setIsLoadingMore(true);
    setPiecesError(null);

    try {
      const page = await getPublicPieces(handle, {
        limit: PAGE_SIZE,
        cursor: nextCursor,
      });

      setPieces((current) => {
        const existingIds = new Set(current.map((piece) => piece.id));

        return [...current, ...page.items.filter((piece) => !existingIds.has(piece.id))];
      });

      setNextCursor(page.nextCursor);
    } catch (err) {
      setPiecesError(err instanceof Error ? err.message : 'Could not load more pages.');
    } finally {
      setIsLoadingMore(false);
    }
  }

  if (isLoading) {
    return (
      <section className="page-section">
        <p className="eyebrow">A writer’s wall</p>
        <h1 className="font-heading text-4xl">A moment, please…</h1>
        <p className="mt-4 text-muted-foreground">Gathering this little corner of Varaq.</p>
      </section>
    );
  }

  if (error || !persona) {
    return (
      <section className="page-section">
        <p className="eyebrow">A writer’s wall</p>
        <h1 className="font-heading text-4xl">This page is out of reach.</h1>
        <p className="mt-4 text-muted-foreground">{error ?? 'This writer could not be found.'}</p>
        <Link
          to="/discover"
          className="mt-6 inline-flex items-center gap-2 text-sm underline underline-offset-4"
        >
          Explore Varaq <ArrowRight size={15} />
        </Link>
      </section>
    );
  }

  return (
    <div className="page-content">
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
        <span className="eyebrow">{pieces.length === 1 ? '1 page' : `${pieces.length} pages`}</span>
      </div>

      {pieces.length === 0 && (
        <div className="empty-page">
          <Feather />
          <h2>No pages here just yet.</h2>
          <p>This writer’s public pages will find their way here when they’re ready.</p>
          <Link to="/discover" className="literary-button wall-write-link">
            Explore writing <ArrowRight size={14} />
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

                  return (
                    <article key={piece.id} className={`writing-card tone-${tone}`}>
                      <div className="card-meta">
                        <span>{formatDate(piece.publishedAt ?? piece.createdAt)}</span>
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
                        <span>Published</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {piecesError && (
        <p className="wall-inline-error" role="status">
          {piecesError}
        </p>
      )}

      {nextCursor && (
        <div className="wall-load-more">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={isLoadingMore}
            className="wall-load-button"
          >
            {isLoadingMore ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                Loading…
              </>
            ) : (
              <>
                Load more pages
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </div>
      )}

      <ReadingDialog reading={reading} onClose={() => setReadingId(null)} />

      <footer className="page-footer">
        <span>A little less noise. A little more meaning.</span>
        <span>Varaq · Words belong to their writers.</span>
      </footer>
    </div>
  );
}

export function PublicWallPage() {
  const { handle } = useParams<{ handle: string }>();
  const { user, persona, isLoading, isPersonaLoading } = useAuth();
  if (isLoading || (user && isPersonaLoading))
    return (
      <section className="page-section">
        <p role="status">Opening the wall…</p>
      </section>
    );
  return user && persona && persona.handle === handle ? (
    <ProfilePage key={`${user.id}:${persona.id}`} />
  ) : (
    <PublicWallContent key={`${user?.id || 'visitor'}:${handle}`} />
  );
}
export function MyWallRedirect() {
  const { user, persona, isLoading, isPersonaLoading } = useAuth();
  if (isLoading || isPersonaLoading) return <p role="status">Opening your wall…</p>;
  return (
    <Navigate
      replace
      to={user && persona ? `/wall/${encodeURIComponent(persona.handle)}` : '/vault'}
    />
  );
}
