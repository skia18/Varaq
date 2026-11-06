import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { forms } from '@/features/feed/writings';
import { WritingCard } from '@/components/literary/WritingCard';
import { LoadingLabel, LoadingState } from '@/components/ui/LoadingState';
import { postItTone } from '@/features/feed/postItTones';
import { Feather, Pencil, RefreshCw, Send, Trash2, ShieldAlert, X } from 'lucide-react';
import { Dialog } from '@base-ui/react/dialog';
import { useVault } from './VaultProvider';
import { decryptDraft, type DraftContent } from './crypto';
import * as api from './api';
import {
  copyMediaForPublication,
  removePrivateMediaSource,
  signedMediaUrl,
} from '@/features/media/storage';

type OpenDraft = api.EncryptedDraft & {
  content: DraftContent;
  imageUrl?: string;
  audioUrl?: string;
};
export function VaultPage() {
  const { session } = useVault();
  const { persona } = useAuth();
  const [loading, setLoading] = useState(true);
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
    setLoading(true);
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
        page.items.map(async (d) => {
          const content = await decryptDraft(
            session.key,
            session.userId,
            d.id,
            d.personaId,
            d.revision,
            d.envelope,
          );
          const image = content.image ?? (content.medium !== 'audio' ? content.media : undefined);
          const audio = content.audio ?? (content.medium === 'audio' ? content.media : undefined);
          const [imageUrl, audioUrl] = await Promise.all([
            image ? signedMediaUrl(image).catch(() => undefined) : undefined,
            audio ? signedMediaUrl(audio).catch(() => undefined) : undefined,
          ]);
          return { ...d, content, imageUrl, audioUrl };
        }),
      );
      if (!cancelled) setItems(opened);
    })()
      .catch(() => {
        if (!cancelled)
          setError(
            'Could not open Vault drafts. A draft may be damaged or the connection unavailable.',
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
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
      const attachments = [
        current.content.image,
        current.content.audio,
        current.content.media,
      ].filter(
        (media, index, all) =>
          media && all.findIndex((item) => item?.uploadId === media.uploadId) === index,
      );
      await Promise.all(attachments.map((media) => copyMediaForPublication(media!)));
      await api.publish(current.id, operationId, current.revision, current.content, visibility);
      if (attachments.length) {
        try {
          await Promise.all(attachments.map((media) => removePrivateMediaSource(media!)));
        } catch {
          // The public copy is authoritative after publication; stale private
          // sources can be removed by maintenance without hiding the piece.
        }
      }
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
  const date = (value: string) =>
    new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long', year: 'numeric' }).format(
      new Date(value),
    );
  const minutes = (body: string) =>
    Math.max(1, Math.ceil(body.trim().split(/\s+/).filter(Boolean).length / 200));
  const draftActions = (d: OpenDraft) => (
    <div className="vault-card-actions">
      <Link
        className="vault-card-action"
        aria-label={`Edit ${d.content.title}`}
        to={`/write?pieceId=${d.id}`}
      >
        <Pencil size={14} />
        Edit
      </Link>
      <button
        className="vault-card-action vault-card-action--primary"
        disabled={busy}
        onClick={() => {
          setSelected(d);
          setVisibility('public');
        }}
      >
        <Send size={14} />
        Publish
      </button>
      <button
        className="vault-card-action vault-card-delete"
        disabled={busy}
        onClick={() => void remove(d)}
      >
        <Trash2 size={14} />
        Delete
      </button>
    </div>
  );
  return (
    <div className="page-content">
      <section className="writer-profile">
        <span className="eyebrow">Your private writing space</span>
        <span className="avatar-mark" aria-hidden="true">
          {persona?.displayName.trim().charAt(0).toLowerCase() || 'v'}
        </span>
        <h1>{persona?.displayName || 'Your Vault'}</h1>
        {persona?.bio && <p className="bio">{persona.bio}</p>}
        {persona?.handle && <p className="wall-handle">@{persona.handle}</p>}
      </section>
      <div className="writer-tabs">
        <span className="eyebrow">
          {items.length === 1 ? '1 private page' : `${items.length} private pages`}
        </span>
        {persona && (
          <Link
            to={`/wall/${encodeURIComponent(persona.handle)}`}
            className="vault-card-action profile-mobile-link"
          >
            My Wall
          </Link>
        )}
        <button
          className="wall-refresh varaq-action varaq-action--small"
          aria-label="Refresh your pages"
          onClick={() => setReload((x) => x + 1)}
          disabled={busy || loading}
        >
          {loading ? (
            <LoadingLabel>Refreshing</LoadingLabel>
          ) : (
            <>
              <RefreshCw size={14} /> Refresh
            </>
          )}
        </button>
      </div>
      {error && (
        <p className="wall-inline-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="wall-status" role="status">
          {message}{' '}
          {publishedId && (
            <Link className="varaq-action varaq-action--small" to={`/piece/${publishedId}`}>
              Read or share the published piece
            </Link>
          )}
        </p>
      )}
      {pending.length > 0 && (
        <div className="wall-status" role="status">
          {pending.length} published piece(s) awaiting encrypted draft cleanup.{' '}
          <button
            className="varaq-action varaq-action--small"
            onClick={() => setReload((x) => x + 1)}
          >
            Retry cleanup
          </button>
        </div>
      )}
      {loading && (
        <LoadingState label="Turning your private pages…" detail="Decrypting this Vault session." />
      )}
      {!loading && !error && items.length === 0 && (
        <div className="empty-page">
          <Feather />
          <h2>Every page begins with a word.</h2>
          <p>Your personal drafts belong here, until you choose to publish.</p>
          <Link to="/write" className="literary-button wall-write-link">
            <Feather size={14} />
            Write your first page
          </Link>
        </div>
      )}
      {items.length > 0 && (
        <div className="writing-grid wall-writing-grid">
          {[0, 1, 2].map((column) => (
            <div className="writing-column" key={column}>
              {items
                .filter((_, index) => index % 3 === column)
                .map((d) =>
                  d.content.audio || d.content.medium === 'audio' ? (
                    <WritingCard
                      key={d.id}
                      writing={{
                        id: d.id,
                        title: d.content.title,
                        author: persona?.displayName || 'You',
                        handle: persona?.handle || '',
                        form: forms[d.content.type],
                        body: d.content.body,
                        excerpt:
                          d.content.body.length > 240
                            ? `${d.content.body.slice(0, 240)}…`
                            : d.content.body,
                        date: date(d.updatedAt),
                        minutes: minutes(d.content.body),
                        tone: postItTone(items.indexOf(d)),
                        medium: 'audio',
                        audioUrl: d.audioUrl,
                        coverUrl: d.imageUrl,
                      }}
                      onRead={() => undefined}
                      pieceHref={`/vault/draft/${encodeURIComponent(d.id)}`}
                      showBookmark={false}
                      actions={draftActions(d)}
                    />
                  ) : (
                    <article
                      className={`writing-card tone-${postItTone(items.indexOf(d))}`}
                      key={d.id}
                    >
                      {d.imageUrl && (
                        <img
                          className="vault-media-preview vault-image-preview"
                          src={d.imageUrl}
                          alt={`Draft preview for ${d.content.title}`}
                        />
                      )}
                      <div className="card-meta">
                        <span>{date(d.updatedAt)}</span>
                        <span className="card-type">
                          {d.content.type.charAt(0).toUpperCase() + d.content.type.slice(1)}
                        </span>
                      </div>
                      <Link
                        to={`/vault/draft/${encodeURIComponent(d.id)}`}
                        className="card-read wall-card-content"
                        aria-label={`Read ${d.content.title}`}
                      >
                        <h2>{d.content.title}</h2>
                        <p className="card-excerpt">
                          {d.content.body.length > 500
                            ? `${d.content.body.slice(0, 500).trimEnd()}…`
                            : d.content.body}
                        </p>
                      </Link>
                      <div className="card-footer wall-card-footer">
                        <span>{minutes(d.content.body)} min read</span>
                        <span>Draft</span>
                      </div>
                      {draftActions(d)}
                    </article>
                  ),
                )}
            </div>
          ))}
        </div>
      )}
      <footer className="page-footer">
        <span>A little less noise. A little more meaning.</span>
        <span>Varaq · Words belong to their writers.</span>
      </footer>
      <Dialog.Root
        open={!!selected}
        onOpenChange={(open) => {
          if (!open && !busy) setSelected(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="reading-shade" />
          <Dialog.Viewport className="reading-backdrop">
            <Dialog.Popup className="reading-modal confirmation-modal" aria-busy={busy}>
              <Dialog.Close
                className="confirmation-close"
                aria-label="Cancel publication"
                disabled={busy}
              >
                <X aria-hidden="true" />
              </Dialog.Close>
              <div className="confirmation-heading">
                <span className="confirmation-icon">
                  <Send aria-hidden="true" />
                </span>
                <span className="eyebrow">Share your words</span>
              </div>
              <Dialog.Title className="confirmation-title">
                Publish “{selected?.content.title}”?
              </Dialog.Title>
              <Dialog.Description className="confirmation-notice">
                <ShieldAlert aria-hidden="true" />
                <span>
                  Publishing moves this piece out of your encrypted Vault. Varaq will receive and
                  store readable content.
                </span>
              </Dialog.Description>
              <label className="confirmation-field">
                <span className="confirmation-label">Who can read this piece?</span>
                <select
                  disabled={busy}
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as 'public' | 'unlisted')}
                >
                  <option value="public">Public — visible on your wall and in discovery</option>
                  <option value="unlisted">Unlisted — anyone with the link can read</option>
                </select>
              </label>
              <section className="confirmation-preview" aria-label="Publication preview">
                <span className="confirmation-label">Your piece</span>
                <div className="confirmation-preview-body">{selected?.content.body}</div>
              </section>
              <div className="varaq-actions confirmation-actions">
                <button
                  className="varaq-action varaq-action--primary"
                  disabled={busy}
                  onClick={() => void publish()}
                >
                  {busy ? <LoadingLabel>Publishing</LoadingLabel> : 'Confirm publication'}
                </button>
                <button className="varaq-action" disabled={busy} onClick={() => setSelected(null)}>
                  Cancel
                </button>
              </div>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
