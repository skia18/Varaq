import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getOwnerPiece, updateOwnerPiece, type Piece } from '@/lib/api';

// Published content is intentionally readable by Varaq and uses the existing editor API.
export function LegacyWritingRoomPage() {
  const [params] = useSearchParams();
  const id = params.get('pieceId');
  const [piece, setPiece] = useState<Piece | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setPiece(null);
    setError('');
    if (!id) {
      setError('Choose a published piece to edit.');
      return;
    }
    void getOwnerPiece(id)
      .then((p) => {
        if (p.status !== 'published')
          throw new Error('Move this legacy draft into the encrypted Vault before editing.');
        if (active) setPiece(p);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Could not open published piece.');
      });
    return () => {
      active = false;
    };
  }, [id]);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!piece) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await updateOwnerPiece(piece.id, { title: piece.title, body: piece.body, type: piece.type });
      setMessage('Published changes saved.');
    } catch {
      setError('Could not save changes. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="page-section">
      <Link to="/published">← Published writing</Link>
      <h1>Edit published writing</h1>
      <p>This piece has left the encrypted Vault. Changes update the readable published content.</p>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {piece && (
        <form onSubmit={save}>
          <fieldset disabled={busy}>
            <label>
              Type{' '}
              <select
                value={piece.type}
                onChange={(e) => setPiece({ ...piece, type: e.target.value as Piece['type'] })}
              >
                {['poem', 'fragment', 'story', 'letter', 'essay'].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Title
              <input
                className="w-full"
                required
                maxLength={200}
                value={piece.title}
                onChange={(e) => setPiece({ ...piece, title: e.target.value })}
              />
            </label>
            <label>
              Writing
              <textarea
                className="w-full"
                style={{ minHeight: 400 }}
                required
                maxLength={50000}
                value={piece.body}
                onChange={(e) => setPiece({ ...piece, body: e.target.value })}
              />
            </label>
            <button className="literary-button">
              {busy ? 'Saving…' : 'Save published changes'}
            </button>
          </fieldset>
        </form>
      )}
    </section>
  );
}
