import { LockKeyhole, ShieldAlert, X } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Dialog } from '@base-ui/react/dialog';
import { ResponseError } from '@/generated/api';
import { getOwnerPiece, type Piece } from '@/lib/api';
import { useVault } from './VaultProvider';
import { encryptDraft, decryptDraft, type DraftContent } from './crypto';
import * as api from './api';

// Stage ciphertext, read it back and authenticate it, then atomically unpublish.
export function ReturnToVaultPage() {
  const { persona } = useAuth();
  const { pieceId } = useParams();
  const { session } = useVault();
  const navigate = useNavigate();
  const [piece, setPiece] = useState<Piece | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [reload, setReload] = useState(0);
  const epoch = useRef(0);
  const staged = useRef<Awaited<ReturnType<typeof api.returnStatus>> | null>(null);
  useEffect(() => {
    const n = ++epoch.current;
    setPiece(null);
    setError('');
    setConfirm(false);
    staged.current = null;
    if (!pieceId) return;
    void (async () => {
      let receipt = null;
      try {
        receipt = await api.returnStatus(pieceId);
      } catch (e) {
        if (!(e instanceof ResponseError && e.response.status === 404)) throw e;
      }
      if (n !== epoch.current) return;
      if (receipt?.completed) {
        navigate('/vault', { replace: true });
        return;
      }
      const source = await getOwnerPiece(pieceId);
      if (source.status !== 'published' || !['public', 'unlisted'].includes(source.visibility))
        throw new Error('Only public or unlisted published pieces can move back to the Vault.');
      if (n !== epoch.current) return;
      if (receipt?.updatedAt === source.updatedAt) staged.current = receipt;
      setPiece(source);
    })().catch(() => {
      if (n === epoch.current)
        setError('Could not load this publication or check its move status. Refresh to retry.');
    });
    return () => {
      epoch.current++;
    };
  }, [pieceId, reload, navigate]);
  async function move() {
    if (!piece || !session || !pieceId) return;
    const n = epoch.current;
    setBusy(true);
    setError('');
    const content: DraftContent = { title: piece.title, body: piece.body, type: piece.type };
    try {
      const existing = staged.current;
      const draftId = existing?.draftId || crypto.randomUUID();
      const envelope =
        existing?.envelope ||
        (await encryptDraft(session.key, session.userId, draftId, piece.personaId, 1, content));
      if (n !== epoch.current) return;
      if (!existing) await api.stageReturn(pieceId, draftId, piece.updatedAt, envelope);
      const receipt = await api.returnStatus(pieceId);
      if (n !== epoch.current) return;
      if (receipt.completed) {
        navigate('/vault', { replace: true });
        return;
      }
      staged.current = receipt;
      if (
        receipt.updatedAt !== piece.updatedAt ||
        receipt.personaId !== piece.personaId ||
        !receipt.envelope
      )
        throw new Error('Source changed');
      const verified = await decryptDraft(
        session.key,
        session.userId,
        receipt.draftId,
        receipt.personaId,
        1,
        receipt.envelope,
      );
      if (JSON.stringify(verified) !== JSON.stringify(content))
        throw new Error('Encrypted copy did not match');
      if (n !== epoch.current) return;
      await api.finalizeReturn(pieceId, receipt.draftId, receipt.updatedAt);
      if (n === epoch.current) navigate('/vault', { replace: true });
    } catch {
      // A timeout may occur after commit. The durable receipt resolves that outcome.
      try {
        const receipt = await api.returnStatus(pieceId);
        if (n !== epoch.current) return;
        if (receipt.completed) {
          navigate('/vault', { replace: true });
          return;
        }
        staged.current = receipt;
      } catch {
        /* Preserve both source and staged ciphertext on uncertainty. */
      }
      if (n === epoch.current)
        setError(
          'The move could not be confirmed. Refresh to check its status. An unconfirmed move keeps the publication; encrypted copies are preserved.',
        );
    } finally {
      if (n === epoch.current) setBusy(false);
    }
  }
  return (
    <section className="page-content">
      <div className="confirmation-page">
        <Link to={persona ? `/wall/${encodeURIComponent(persona.handle)}` : '/vault'}>
          ← My Wall
        </Link>
        <div className="confirmation-heading">
          <span className="confirmation-icon">
            <LockKeyhole aria-hidden="true" />
          </span>
          <span className="eyebrow">A private page again</span>
        </div>
        <h1 className="confirmation-title">Move back to Vault</h1>
        {piece && (
          <>
            <h2 className="confirmation-piece-title">{piece.title}</h2>
            <p className="confirmation-notice">
              <ShieldAlert aria-hidden="true" />
              <span>
                This will remove the piece from your published writing, public wall, discovery, and
                its current public or unlisted link. Your browser will encrypt a private draft
                first.
              </span>
            </p>
            <p className="confirmation-footnote">
              Copies already saved by readers or retained in backups cannot be recalled.
            </p>
            <button
              className="varaq-action varaq-action--primary"
              disabled={busy}
              onClick={() => setConfirm(true)}
            >
              Move to Vault
            </button>
          </>
        )}
        {!piece && !error && <p>Loading…</p>}
        {error && (
          <p role="alert">
            {error}{' '}
            <button
              className="varaq-action varaq-action--small"
              disabled={busy}
              onClick={() => setReload((x) => x + 1)}
            >
              Refresh status
            </button>
          </p>
        )}
        <Dialog.Root
          open={confirm}
          onOpenChange={(open) => {
            if (!busy) setConfirm(open);
          }}
        >
          <Dialog.Portal>
            <Dialog.Backdrop className="reading-shade" />
            <Dialog.Viewport className="reading-backdrop">
              <Dialog.Popup className="reading-modal confirmation-modal" aria-busy={busy}>
                <Dialog.Close
                  className="confirmation-close"
                  aria-label="Cancel move to Vault"
                  disabled={busy}
                >
                  <X aria-hidden="true" />
                </Dialog.Close>
                <div className="confirmation-heading">
                  <span className="confirmation-icon">
                    <LockKeyhole aria-hidden="true" />
                  </span>
                  <span className="eyebrow">Return to your Vault</span>
                </div>
                <Dialog.Title className="confirmation-title">
                  Unpublish “{piece?.title}” and move to Vault?
                </Dialog.Title>
                <Dialog.Description className="confirmation-notice">
                  <ShieldAlert aria-hidden="true" />
                  <span>
                    The published link will stop working. An encrypted private draft will replace
                    the publication after its encrypted copy is verified.
                  </span>
                </Dialog.Description>
                <p className="confirmation-footnote">
                  Copies already saved by readers or retained in backups cannot be recalled.
                </p>
                <div className="varaq-actions confirmation-actions">
                  <button
                    className="varaq-action varaq-action--primary"
                    disabled={busy}
                    onClick={() => void move()}
                  >
                    {busy ? 'Moving…' : 'Confirm move to Vault'}
                  </button>
                  <button
                    className="varaq-action"
                    disabled={busy}
                    onClick={() => setConfirm(false)}
                  >
                    Cancel
                  </button>
                </div>
                {error && (
                  <p className="confirmation-error" role="alert">
                    {error}
                  </p>
                )}
              </Dialog.Popup>
            </Dialog.Viewport>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </section>
  );
}
