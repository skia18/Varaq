import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { WritingEditor } from './WritingEditor';
import { useAuth } from '@/auth/AuthProvider';
import { useVault } from '@/features/vault/VaultProvider';
import { decryptDraft, encryptDraft, type DraftContent } from '@/features/vault/crypto';
import * as api from '@/features/vault/api';

export function WritingRoomPage() {
  const { persona } = useAuth();
  const { session, lock } = useVault();
  const [params, setParams] = useSearchParams();
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
    unsaved.current = false;
    if (!session || !persona) return;
    void (async () => {
      if (paramId) {
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
  }, [paramId, session, persona?.id]);
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
      await api.saveDraft(request.id, request.persona, request.revision, request.envelope);
      // Read back and authenticate before reporting save success.
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
      if (n !== epoch.current) return;
      pending.current = null;
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
    <WritingEditor
      content={content}
      onChange={edit}
      onSave={save}
      mode={paramId ? 'draft' : 'new'}
      handle={persona?.handle}
      backTo="/vault"
      loaded={loaded}
      busy={busy}
      error={error}
      message={message}
      onLock={lock}
    />
  );
}
