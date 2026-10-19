import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { useVault } from '@/features/vault/VaultProvider';
import { decryptDraft, encryptDraft, type DraftContent } from '@/features/vault/crypto';
import * as api from '@/features/vault/api';
import { apiRequest, getOwnerPiece } from '@/lib/api';

export function WritingRoomPage() {
  const { persona } = useAuth();
  const { session } = useVault();
  const [params, setParams] = useSearchParams();
  const source = params.get('importId');
  const paramId = params.get('pieceId');
  const [id, setId] = useState(() => paramId || crypto.randomUUID());
  const [revision, setRevision] = useState(0);
  const [content, setContent] = useState<DraftContent>({ title: '', body: '', type: 'fragment' });
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const epoch = useRef(0);
  const owner = useRef('');
  const legacy = useRef<{ id: string; updatedAt: string } | null>(null);
  const unsaved = useRef(false);
  // Retry exactly the same envelope after a lost save response.
  const pending = useRef<{
    id: string;
    persona: string;
    revision: number;
    envelope: api.EncryptedDraft['envelope'];
    content: string;
  } | null>(null);
  useEffect(() => {
    const n = ++epoch.current;
    setLoaded(false);
    setError('');
    setMessage('');
    pending.current = null;
    legacy.current = null;
    unsaved.current = false;
    if (!session || !persona) return;
    void (async () => {
      if (source) {
        const p = await getOwnerPiece(source);
        if (p.status !== 'draft') throw new Error('Only unpublished drafts can be imported.');
        if (n !== epoch.current) return;
        legacy.current = { id: p.id, updatedAt: p.updatedAt };
        owner.current = p.personaId;
        setId(p.id);
        setRevision(0);
        setContent({ title: p.title, body: p.body, type: p.type });
        unsaved.current = true;
      } else if (paramId) {
        const d = await api.draft(paramId);
        const c = await decryptDraft(
          session.key,
          session.userId,
          d.id,
          d.personaId,
          d.revision,
          d.envelope,
        );
        if (n !== epoch.current) return;
        owner.current = d.personaId;
        setId(d.id);
        setRevision(d.revision);
        setContent(c);
      } else {
        owner.current = persona.id;
        setId(crypto.randomUUID());
        setRevision(0);
        setContent({ title: '', body: '', type: 'fragment' });
      }
      if (n === epoch.current) setLoaded(true);
    })().catch((e) => {
      if (n === epoch.current) setError(e instanceof Error ? e.message : 'Could not open draft.');
    });
    return () => {
      epoch.current++;
    };
  }, [paramId, source, session, persona?.id]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (unsaved.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);
  function edit(next: DraftContent) {
    setContent(next);
    unsaved.current = true;
    setMessage('');
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!session || !loaded) return;
    const n = epoch.current;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const snapshot = JSON.stringify(content);
      if (pending.current && pending.current.content !== snapshot)
        throw new Error(
          'The previous save has an uncertain outcome. Refresh before editing further.',
        );
      const request = pending.current || {
        id,
        persona: owner.current,
        revision,
        envelope: await encryptDraft(
          session.key,
          session.userId,
          id,
          owner.current,
          revision + 1,
          content,
        ),
        content: snapshot,
      };
      pending.current = request;
      if (legacy.current) {
        await apiRequest('/api/v1/owner/vault/import', {
          method: 'POST',
          body: JSON.stringify({
            id: legacy.current.id,
            updatedAt: legacy.current.updatedAt,
            envelope: request.envelope,
          }),
        });
      } else {
        await api.saveDraft(request.id, request.persona, request.revision, request.envelope);
      }
      // Read back and authenticate before reporting success or deleting a legacy source.
      const stored = await api.draft(id);
      const verified = await decryptDraft(
        session.key,
        session.userId,
        id,
        stored.personaId,
        stored.revision,
        stored.envelope,
      );
      if (JSON.stringify(verified) !== snapshot)
        throw new Error('Saved revision differs. Reload before continuing.');
      if (legacy.current) {
        await apiRequest(`/api/v1/owner/vault/import/${id}/finalize`, {
          method: 'POST',
          body: JSON.stringify({ updatedAt: legacy.current.updatedAt }),
        });
      }
      if (n !== epoch.current) return;
      pending.current = null;
      legacy.current = null;
      unsaved.current = false;
      setRevision(stored.revision);
      setMessage('Encrypted draft saved.');
      if (!paramId) setParams({ pieceId: id }, { replace: true });
    } catch {
      if (n === epoch.current)
        setError(
          'Save could not be verified. Your writing remains here. Retry the same save, or refresh to check the stored revision before making further changes.',
        );
    } finally {
      if (n === epoch.current) setBusy(false);
    }
  }
  return (
    <section className="page-section">
      <Link to="/vault">← Vault</Link>
      <h1>{source ? 'Encrypt a legacy draft' : 'Writing room'}</h1>
      <p>Saved drafts are encrypted in your browser.</p>
      <form onSubmit={save}>
        <fieldset disabled={!loaded || busy}>
          <label>
            Type{' '}
            <select
              value={content.type}
              onChange={(e) => edit({ ...content, type: e.target.value as DraftContent['type'] })}
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
              maxLength={200}
              required
              value={content.title}
              onChange={(e) => edit({ ...content, title: e.target.value })}
            />
          </label>
          <label>
            Your writing
            <textarea
              className="w-full"
              style={{ minHeight: 400, whiteSpace: 'pre-wrap' }}
              maxLength={50000}
              required
              value={content.body}
              onChange={(e) => edit({ ...content, body: e.target.value })}
            />
          </label>
          <button
            className="literary-button"
            disabled={!content.title.trim() || !content.body.trim()}
          >
            {busy ? 'Saving…' : 'Save encrypted draft'}
          </button>
        </fieldset>
      </form>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
