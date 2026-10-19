import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Dialog } from '@base-ui/react/dialog';
import { useVault } from './VaultProvider';
import { decryptDraft, type DraftContent } from './crypto';
import * as api from './api';

type OpenDraft = api.EncryptedDraft & { content: DraftContent };
export function VaultPage() {
  const { session } = useVault();
  const [items, setItems] = useState<OpenDraft[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [publishedId, setPublishedId] = useState('');
  const [selected, setSelected] = useState<OpenDraft | null>(null);
  const [visibility, setVisibility] = useState<'public' | 'unlisted'>('public');
  const [pending, setPending] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    if (!session) return;
    setItems([]);
    setError('');
    void (async () => {
      const waiting = await api.pendingTransfers();
      const remaining: string[] = [];
      for (const id of waiting.ids) {
        try {
          await api.finalize(id);
        } catch {
          remaining.push(id);
        }
      }
      if (!cancelled) setPending(remaining);
      const page = await api.drafts();
      const opened = await Promise.all(
        page.items.map(async (d) => ({
          ...d,
          content: await decryptDraft(
            session.key,
            session.userId,
            d.id,
            d.personaId,
            d.revision,
            d.envelope,
          ),
        })),
      );
      if (!cancelled) setItems(opened);
    })().catch(() => {
      if (!cancelled)
        setError(
          'Could not open Vault drafts. A draft may be damaged or the connection unavailable.',
        );
    });
    return () => {
      cancelled = true;
    };
  }, [session, reload]);
  async function publish() {
    if (!selected) return;
    setBusy(true);
    setError('');
    const current = selected;
    // Identity is durable on the server. No plaintext or keys are persisted here.
    const operationId = current.id;
    try {
      await api.publish(current.id, operationId, current.revision, current.content, visibility);
      setItems((xs) => xs.filter((d) => d.id !== current.id));
      setSelected(null);
      setMessage('Published. This piece has left your Vault.');
      setPublishedId(current.id);
      try {
        await api.finalize(current.id);
      } catch {
        setPending((xs) => [...new Set([...xs, current.id])]);
      }
      setReload((x) => x + 1);
    } catch {
      try {
        const status = await api.transferStatus(current.id);
        if (status.published) {
          setItems((xs) => xs.filter((d) => d.id !== current.id));
          setSelected(null);
          setMessage('Publication confirmed.');
          setPublishedId(current.id);
          try {
            await api.finalize(current.id);
          } catch {
            setPending((xs) => [...xs, current.id]);
          }
          setReload((x) => x + 1);
        } else
          setError(
            'Publication was not confirmed. Your encrypted draft is preserved; retry when ready.',
          );
      } catch {
        setError(
          'Publication outcome is uncertain. Your encrypted draft is preserved. Refresh to check its status before retrying.',
        );
      }
    } finally {
      setBusy(false);
    }
  }
  async function remove(d: OpenDraft) {
    if (!window.confirm(`Permanently delete “${d.content.title}”?`)) return;
    setBusy(true);
    try {
      await api.removeDraft(d.id, d.revision);
      setReload((x) => x + 1);
    } catch {
      setError('Draft could not be deleted. Refresh before retrying.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="page-section">
      <h1>Your Vault</h1>
      <p>Personal writing, encrypted before it leaves this browser.</p>
      <Link to="/write">Write a draft</Link> ·{' '}
      <Link to="/published">Published writing and legacy drafts</Link> ·{' '}
      <button onClick={() => setReload((x) => x + 1)} disabled={busy}>
        Refresh
      </button>
      {error && <p role="alert">{error}</p>}
      {message && (
        <p role="status">
          {message}{' '}
          {publishedId && (
            <Link to={`/piece/${publishedId}`}>Read or share the published piece</Link>
          )}
        </p>
      )}
      {pending.length > 0 && (
        <div role="status">
          {pending.length} published piece(s) awaiting encrypted draft cleanup.{' '}
          <button onClick={() => setReload((x) => x + 1)}>Retry cleanup</button>
        </div>
      )}
      {items.map((d) => (
        <article className="writing-card" key={d.id}>
          <h2>{d.content.title}</h2>
          <p style={{ whiteSpace: 'pre-wrap' }}>{d.content.body}</p>
          <Link to={`/write?pieceId=${d.id}`}>Edit</Link>{' '}
          <button
            disabled={busy}
            onClick={() => {
              setSelected(d);
              setVisibility('public');
            }}
          >
            Publish
          </button>{' '}
          <button disabled={busy} onClick={() => void remove(d)}>
            Delete
          </button>
        </article>
      ))}
      <Dialog.Root
        open={!!selected}
        onOpenChange={(open) => {
          if (!open && !busy) setSelected(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="reading-shade" />
          <Dialog.Viewport className="reading-backdrop">
            <Dialog.Popup className="reading-modal">
              <Dialog.Title>Publish “{selected?.content.title}”?</Dialog.Title>
              <Dialog.Description>
                Publishing moves this piece out of your encrypted Vault. Varaq will receive and
                store readable content.
              </Dialog.Description>
              <label>
                Visibility{' '}
                <select
                  disabled={busy}
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as 'public' | 'unlisted')}
                >
                  <option value="public">Public — visible on your wall and in discovery</option>
                  <option value="unlisted">Unlisted — anyone with the link can read</option>
                </select>
              </label>
              <div style={{ whiteSpace: 'pre-wrap', maxHeight: '40vh', overflow: 'auto' }}>
                {selected?.content.body}
              </div>
              <button disabled={busy} onClick={() => void publish()}>
                {busy ? 'Publishing…' : 'Confirm publication'}
              </button>
              <button disabled={busy} onClick={() => setSelected(null)}>
                Cancel
              </button>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
