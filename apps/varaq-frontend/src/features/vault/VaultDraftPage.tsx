import { useEffect, useState } from 'react';
import { ArrowLeft, LockKeyhole, Pencil } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useVault } from './VaultProvider';
import { decryptDraft, type DraftContent } from './crypto';
import * as api from './api';
import { signedMediaUrl } from '@/features/media/storage';
import { AudioPlayer } from '@/components/literary/AudioPlayer';
import { forms, literaryFormLabel } from '@/features/feed/writings';
import { LoadingState } from '@/components/ui/LoadingState';

type OpenDraft = { content: DraftContent; imageUrl?: string; audioUrl?: string };

export function VaultDraftPage() {
  const { pieceId = '' } = useParams();
  const { session, lock } = useVault();
  const [draft, setDraft] = useState<OpenDraft | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setDraft(null);
    setError('');
    if (!session) return;
    void (async () => {
      const encrypted = await api.draft(pieceId);
      const content = await decryptDraft(
        session.key,
        session.userId,
        encrypted.id,
        encrypted.personaId,
        encrypted.revision,
        encrypted.envelope,
      );
      const image = content.image ?? (content.medium !== 'audio' ? content.media : undefined);
      const audio = content.audio ?? (content.medium === 'audio' ? content.media : undefined);
      const [imageUrl, audioUrl] = await Promise.all([
        image ? signedMediaUrl(image).catch(() => undefined) : undefined,
        audio ? signedMediaUrl(audio).catch(() => undefined) : undefined,
      ]);
      if (active) setDraft({ content, imageUrl, audioUrl });
    })().catch(() => {
      if (active) setError('This Vault draft could not be opened.');
    });
    return () => {
      active = false;
    };
  }, [pieceId, session]);
  const audioDraft = Boolean(draft?.content.audio) || draft?.content.medium === 'audio';
  const imageDraft =
    !audioDraft && (Boolean(draft?.content.image) || Boolean(draft?.content.media));
  return (
    <section className="page-content piece-page">
      {error ? (
        <div className="empty-page">
          <h1>Page unavailable.</h1>
          <p role="alert">{error}</p>
          <Link className="varaq-action" to="/vault">
            Back to My Vault
          </Link>
        </div>
      ) : draft ? (
        <article className="published-piece vault-draft-reader">
          <div className="piece-reader-toolbar">
            <Link to="/vault" className="varaq-action varaq-action--small">
              <ArrowLeft />
              My Vault
            </Link>
            <div>
              <Link
                to={`/write?pieceId=${encodeURIComponent(pieceId)}`}
                className="varaq-action varaq-action--small"
              >
                <Pencil />
                Edit
              </Link>
              <button type="button" className="varaq-action varaq-action--small" onClick={lock}>
                <LockKeyhole />
                Lock Vault
              </button>
            </div>
          </div>
          <div className="piece-heading-meta">
            <span className="eyebrow">{literaryFormLabel(forms[draft.content.type])}</span>
            <span className="piece-visibility">
              <LockKeyhole />
              Private Vault draft
            </span>
          </div>
          <h1>{draft.content.title}</h1>
          {imageDraft && draft.imageUrl && (
            <figure className="piece-media">
              <img src={draft.imageUrl} alt={draft.content.title} />
            </figure>
          )}
          {audioDraft && draft.imageUrl && (
            <figure className="piece-media piece-media-cover">
              <img src={draft.imageUrl} alt={`Cover art for ${draft.content.title}`} />
            </figure>
          )}
          {audioDraft && draft.audioUrl && <AudioPlayer src={draft.audioUrl} />}
          <div className="published-piece-body">{draft.content.body}</div>
          <p className="vault-reader-note">
            <LockKeyhole />
            This page is decrypted only for this unlocked Vault session.
          </p>
        </article>
      ) : (
        <LoadingState
          variant="page"
          label="Opening your private page…"
          detail="Decrypting it only for this Vault session."
        />
      )}
    </section>
  );
}
