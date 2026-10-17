
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Feather, RefreshCw } from 'lucide-react';

import { useAuth } from '@/auth/AuthProvider';
import { getPublicPieces, type Piece } from '@/lib/api';

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
  const {
    user,
    persona,
    isLoading,
    isPersonaLoading,
    personaError,
    refreshPersona,
  } = useAuth();

  const [pieces, setPieces] = useState<Piece[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isPiecesLoading, setIsPiecesLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [piecesError, setPiecesError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!persona?.handle) {
      setPieces([]);
      setNextCursor(null);
      return;
    }

    let cancelled = false;

    async function loadPieces() {
      setIsPiecesLoading(true);
      setPiecesError(null);
      setPieces([]);
      setNextCursor(null);

      try {
        const page = await getPublicPieces(persona!.handle, {
          limit: PAGE_SIZE,
        });

        if (cancelled) return;

        setPieces(page.items);
        setNextCursor(page.nextCursor);
      } catch (error) {
        if (cancelled) return;

        setPiecesError(
          error instanceof Error
            ? error.message
            : 'Could not load your published pages.',
        );
      } finally {
        if (!cancelled) setIsPiecesLoading(false);
      }
    }

    void loadPieces();

    return () => {
      cancelled = true;
    };
  }, [persona?.handle, reloadKey]);

  const loadMore = useCallback(async () => {
    if (!persona?.handle || !nextCursor || isLoadingMore) return;

    setIsLoadingMore(true);
    setPiecesError(null);

    try {
      const page = await getPublicPieces(persona.handle, {
        limit: PAGE_SIZE,
        cursor: nextCursor,
      });

      setPieces((current) => {
        const existingIds = new Set(current.map((piece) => piece.id));
        return [
          ...current,
          ...page.items.filter((piece) => !existingIds.has(piece.id)),
        ];
      });

      setNextCursor(page.nextCursor);
    } catch (error) {
      setPiecesError(
        error instanceof Error
          ? error.message
          : 'Could not load more pages.',
      );
    } finally {
      setIsLoadingMore(false);
    }
  }, [persona?.handle, nextCursor, isLoadingMore]);

  if (isLoading || isPersonaLoading) {
    return (
      <section className="page-section">
        <p className="eyebrow">A writer’s wall</p>
        <h1 className="font-heading text-4xl">A moment, please…</h1>
        <p className="mt-4 text-muted-foreground">
          Gathering your little corner of Varaq.
        </p>
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
        <p className="mt-4 text-muted-foreground">
          Your writing wall is not set up yet.
        </p>
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
        <span className="eyebrow">
          {pieces.length === 1 ? '1 page loaded' : `${pieces.length} pages loaded`}
        </span>

        <button
          type="button"
          onClick={() => setReloadKey((key) => key + 1)}
          disabled={isPiecesLoading}
          className="wall-refresh"
          aria-label="Refresh published pages"
        >
          <RefreshCw
            size={14}
            className={isPiecesLoading ? 'animate-spin' : ''}
          />
          Refresh
        </button>
      </div>

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
            const columnPieces = pieces.filter(
              (_, index) => index % 3 === column,
            );

            return (
              <div className="writing-column" key={column}>
                {columnPieces.map((piece) => {
                  const tone =
                    CARD_TONES[pieces.findIndex((item) => item.id === piece.id) % CARD_TONES.length];

                  return (
                    <article
                      key={piece.id}
                      className={`writing-card tone-${tone}`}
                    >
                      <div className="card-meta">
                        <span>{formatDate(piece.publishedAt ?? piece.createdAt)}</span>
                        <span className="card-type">{formatType(piece.type)}</span>
                      </div>

                      <div className="card-read wall-card-content">
                        <h2>{piece.title}</h2>
                        <p className="card-excerpt">
                          {getExcerpt(piece.body)}
                        </p>
                      </div>

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

      {piecesError && pieces.length > 0 && (
        <p className="wall-inline-error" role="status">
          {piecesError}
        </p>
      )}

      {nextCursor && !isPiecesLoading && (
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

      <footer className="page-footer">
        <span>A little less noise. A little more meaning.</span>
        <span>Varaq · Words belong to their writers.</span>
      </footer>
    </div>
  );
}
