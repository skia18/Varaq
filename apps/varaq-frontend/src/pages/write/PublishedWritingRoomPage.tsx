import { WritingEditor } from './WritingEditor';
import { useAuth } from '@/auth/AuthProvider';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  apiRequest,
  getOwnerPiece,
  getOwnerPieces,
  updateOwnerPiece,
  type FeedPage,
  type Piece,
} from '@/lib/api';

// Published content is intentionally readable by Varaq and uses the existing editor API.
export function PublishedWritingRoomPage() {
  const { persona } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const id = params.get('pieceId');
  const respondTo = params.get('respondTo');
  const [piece, setPiece] = useState<Piece | null>(null);
  const [responseSource, setResponseSource] = useState<Piece | null>(null);
  const [choices, setChoices] = useState<Piece[]>([]);
  const [trailSources, setTrailSources] = useState<Piece[]>([]);
  const [initiallyInTrail, setInitiallyInTrail] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [connectingId, setConnectingId] = useState('');
  useEffect(() => {
    let active = true;
    setPiece(null);
    setError('');
    if (!id && respondTo) {
      void Promise.all([
        apiRequest<Piece>(`/api/v1/pieces/${encodeURIComponent(respondTo)}`),
        getOwnerPieces({ limit: 50, status: 'published' }),
      ])
        .then(([source, page]) => {
          if (!active) return;
          setResponseSource(source);
          setChoices(
            page.items.filter(
              (candidate) => candidate.visibility === 'public' && candidate.id !== source.id,
            ),
          );
        })
        .catch(() => {
          if (active) setError('Could not load your public pieces.');
        });
      return () => {
        active = false;
      };
    }
    if (!id) {
      setError('Choose a published piece to edit.');
      return;
    }
    void getOwnerPiece(id)
      .then(async (p) => {
        if (p.status !== 'published') throw new Error('Only published pieces can be edited here.');
        const sourceId = respondTo ?? p.respondsTo?.pieceId;
        const [source, feed] = await Promise.all([
          sourceId
            ? apiRequest<Piece>(`/api/v1/pieces/${encodeURIComponent(sourceId)}`)
            : Promise.resolve(null),
          Promise.resolve(apiRequest<FeedPage>('/api/v1/feed?limit=50')).catch(() => null),
        ]);
        if (active) {
          setResponseSource(source);
          setTrailSources((feed?.items ?? []).filter((candidate) => candidate.id !== p.id));
          setInitiallyInTrail(Boolean(p.respondsTo));
          setPiece(
            respondTo
              ? {
                  ...p,
                  respondsTo: {
                    pieceId: respondTo,
                    relation: p.respondsTo?.relation ?? 'inspired-by',
                  },
                }
              : p,
          );
        }
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Could not open published piece.');
      });
    return () => {
      active = false;
    };
  }, [id, respondTo]);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!piece) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const updated = await updateOwnerPiece(piece.id, {
        title: piece.title,
        body: piece.body,
        type: piece.type,
        ...(piece.respondsTo ? { respondsTo: piece.respondsTo } : {}),
        ...(!piece.respondsTo && initiallyInTrail ? { clearTrail: true } : {}),
      });
      setPiece({ ...piece, ...updated });
      setInitiallyInTrail(Boolean(piece.respondsTo));
      setMessage('Published changes saved.');
    } catch {
      setError('Could not save changes. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  async function connectExisting(choice: Piece, relation: 'inspired-by' | 'continues') {
    setConnectingId(choice.id);
    setError('');
    try {
      await updateOwnerPiece(choice.id, {
        title: choice.title,
        body: choice.body,
        type: choice.type,
        respondsTo: { pieceId: respondTo!, relation },
      });
      void navigate(`/trail/${encodeURIComponent(respondTo!)}`);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'The piece could not be added to this Trail.',
      );
    } finally {
      setConnectingId('');
    }
  }
  if (!id && respondTo) {
    return (
      <section className="page-content existing-piece-picker">
        <header className="page-intro">
          <div>
            <span className="eyebrow">Add an existing piece</span>
            <h1>Choose a page</h1>
            <p>
              {responseSource
                ? `Connect one of your public pages to “${responseSource.title}”.`
                : 'Loading the source page…'}
            </p>
          </div>
        </header>
        {error && (
          <p className="collection-notice collection-notice--error" role="alert">
            {error}
          </p>
        )}
        {choices.length ? (
          <div className="existing-piece-choices">
            {choices.map((choice) => (
              <article className="existing-piece-card" key={choice.id}>
                <strong>{choice.title}</strong>
                <small>
                  {choice.type} ·{' '}
                  {new Date(choice.publishedAt ?? choice.createdAt).toLocaleDateString()}
                </small>
                <p>
                  {choice.body.slice(0, 150)}
                  {choice.body.length > 150 ? '…' : ''}
                </p>
                <div className="existing-piece-relations">
                  <button
                    type="button"
                    className="varaq-action varaq-action--small"
                    disabled={Boolean(connectingId)}
                    onClick={() => void connectExisting(choice, 'inspired-by')}
                  >
                    {connectingId === choice.id ? 'Connecting…' : 'Inspired by'}
                  </button>
                  <button
                    type="button"
                    className="varaq-action varaq-action--small"
                    disabled={Boolean(connectingId)}
                    onClick={() => void connectExisting(choice, 'continues')}
                  >
                    Continues
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : responseSource ? (
          <p className="collection-notice">
            You do not have another public piece available to add.
          </p>
        ) : (
          <p role="status">Gathering your pages…</p>
        )}
      </section>
    );
  }
  return (
    <WritingEditor
      content={
        piece
          ? { ...piece, respondsTo: piece.respondsTo ?? undefined }
          : { title: '', body: '', type: 'fragment' }
      }
      onChange={(content) => {
        if (piece) {
          setPiece({ ...piece, ...content });
          setMessage('');
        }
      }}
      onSave={save}
      mode="published"
      handle={persona?.handle}
      backTo={persona ? `/wall/${encodeURIComponent(persona.handle)}` : '/vault'}
      loaded={!!piece}
      busy={busy}
      error={error}
      message={message}
      responseSource={responseSource}
      trailSources={trailSources}
      pieceId={piece?.id}
    />
  );
}
