import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookmarkPicker } from '@/features/collections/BookmarkPicker';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Globe2, Link2, Play, X } from 'lucide-react';
import { apiRequest, getTrail, type Piece, type TrailGraph } from '@/lib/api';
import { AudioPlayer } from '@/components/literary/AudioPlayer';
import { forms, literaryFormLabel } from '@/features/feed/writings';
import { publicMediaUrl } from '@/features/media/storage';
import { TrailTeaser } from '@/components/literary/TrailView';
import { LoadingState } from '@/components/ui/LoadingState';
import '@/styles/pages.css';
import '@/styles/overlays.css';
export function PublishedPiecePage() {
  const { pieceId } = useParams();
  const [piece, setPiece] = useState<Piece | null>(null);
  const [error, setError] = useState('');
  const [trail, setTrail] = useState<TrailGraph | null>(null);
  const [trailLoading, setTrailLoading] = useState(true);
  const [trailError, setTrailError] = useState('');
  const [playerOpen, setPlayerOpen] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setPiece(null);
    setError('');
    setTrail(null);
    setTrailLoading(true);
    setTrailError('');
    void apiRequest<Piece>(`/api/v1/pieces/${encodeURIComponent(pieceId || '')}`)
      .then((p) => {
        if (!cancelled) {
          setPiece(p);
          setPlayerOpen(false);
        }
      })
      .catch(() => {
        if (!cancelled) setError('This piece is unavailable.');
      });
    void getTrail(pieceId || '')
      .then((value) => {
        if (!cancelled) setTrail(value);
      })
      .catch(() => {
        if (!cancelled)
          setTrailError(
            'The Trail could not be loaded. Refresh after updating the backend and database.',
          );
      })
      .finally(() => {
        if (!cancelled) setTrailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pieceId]);

  useEffect(() => {
    if (!playerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPlayerOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [playerOpen]);

  return (
    <section className="page-content piece-page">
      {error ? (
        <p role="alert">{error}</p>
      ) : piece ? (
        <article className="published-piece">
          <Link to="/" className="varaq-action varaq-action--small piece-back">
            <ArrowLeft />
            The commons
          </Link>
          <div className="piece-heading-meta">
            <span className="eyebrow">{literaryFormLabel(forms[piece.type])}</span>
            <span className="piece-visibility">
              {piece.visibility === 'unlisted' ? <Link2 /> : <Globe2 />}
              {piece.visibility === 'unlisted' ? 'Unlisted' : 'Public'}
            </span>
          </div>
          <h1>{piece.title}</h1>
          {piece.visibility === 'public' && <BookmarkPicker pieceId={piece.id} />}
          {(piece.medium === 'photography' || piece.medium === 'artwork') && piece.mediaPath && (
            <figure className="piece-media">
              <img src={publicMediaUrl(piece.mediaPath)} alt={piece.imageAlt ?? piece.title} />
            </figure>
          )}
          {piece.medium === 'audio' && (piece.coverUrl || piece.coverPath) && (
            <figure className="piece-media piece-media-cover">
              <img
                src={piece.coverUrl ?? publicMediaUrl(piece.coverPath!)}
                alt={`Cover art for ${piece.title}`}
              />
            </figure>
          )}
          {piece.medium === 'audio' && piece.mediaPath && (
            <>
              <button
                type="button"
                className="varaq-action audio-listening-open"
                onClick={() => setPlayerOpen(true)}
              >
                <Play aria-hidden="true" /> Play audio
              </button>
              {playerOpen &&
                createPortal(
                  <div
                    className="audio-listening-overlay"
                    role="dialog"
                    aria-modal="true"
                    aria-label={`Listening to ${piece.title}`}
                  >
                    {(piece.coverUrl || piece.coverPath) && (
                      <div
                        className="audio-listening-artwork"
                        style={{
                          backgroundImage: `url("${(piece.coverUrl ?? publicMediaUrl(piece.coverPath!)).replaceAll('"', '\\"')}")`,
                        }}
                        aria-hidden="true"
                      />
                    )}
                    <div className="audio-listening-heading">
                      <span className="eyebrow">Now listening</span>
                      <h2>{piece.title}</h2>
                    </div>
                    <button
                      type="button"
                      className="audio-listening-close"
                      aria-label="Close full-screen player"
                      onClick={() => setPlayerOpen(false)}
                      autoFocus
                    >
                      <X aria-hidden="true" />
                    </button>
                    <AudioPlayer
                      src={publicMediaUrl(piece.mediaPath)}
                      duration={piece.audioDuration ?? undefined}
                      artwork={
                        piece.coverUrl ??
                        (piece.coverPath ? publicMediaUrl(piece.coverPath) : undefined)
                      }
                      fullscreen
                    />
                  </div>,
                  document.body,
                )}
            </>
          )}
          <div className="published-piece-body">{piece.body}</div>
          {piece.credits && piece.credits.length > 0 && (
            <ul className="media-credits">
              {piece.credits.map((credit) => (
                <li key={credit}>{credit}</li>
              ))}
            </ul>
          )}
          {piece.visibility === 'public' && (
            <TrailTeaser
              graph={trail}
              pieceId={piece.id}
              loading={trailLoading}
              error={trailError}
            />
          )}
        </article>
      ) : (
        <LoadingState
          variant="page"
          label="Opening this page…"
          detail="Gathering its words and media."
        />
      )}
    </section>
  );
}
