import type { Envelope, VaultConfig, DraftContent } from './crypto';
import { apiRequest } from '@/lib/api';
export type EncryptedDraft = {
  id: string;
  personaId: string;
  revision: number;
  envelope: Envelope;
  createdAt: string;
  updatedAt: string;
};
type VaultConfigState = { config: VaultConfig | null; revision: number };
type VaultRevision = { revision: number };
type VaultTransfer = { published: boolean; pieceId?: string; cleanupPending?: boolean };
type VaultReturn = {
  draftId: string;
  personaId: string;
  updatedAt: string;
  envelope: Envelope | null;
  completed: boolean;
};
type VaultReturnResult = { draftId: string; completed: boolean };

const vaultBase = '/api/v1/owner/vault';
const draftPath = (id: string) => `${vaultBase}/drafts/${encodeURIComponent(id)}`;
const transferPath = (id: string) => `${vaultBase}/transfers/${encodeURIComponent(id)}`;
const returnPath = (id: string) => `/api/v1/owner/pieces/${encodeURIComponent(id)}/vault`;

export const vaultConfig = () => apiRequest<VaultConfigState>(vaultBase);
export const saveConfig = (config: VaultConfig, revision: number) =>
  apiRequest<VaultRevision>(vaultBase, {
    method: 'PUT',
    body: JSON.stringify({ config, revision }),
  });
export const drafts = () => apiRequest<{ items: EncryptedDraft[] }>(`${vaultBase}/drafts`);
export const draft = (id: string) => apiRequest<EncryptedDraft>(draftPath(id));
export const saveDraft = (id: string, personaId: string, revision: number, envelope: Envelope) =>
  apiRequest<VaultRevision>(draftPath(id), {
    method: 'PUT',
    body: JSON.stringify({ personaId, revision, envelope }),
  });
export const removeDraft = (id: string, revision: number) =>
  apiRequest<void>(draftPath(id), {
    method: 'DELETE',
    body: JSON.stringify({ revision }),
  });
export const transferStatus = (id: string) => apiRequest<VaultTransfer>(transferPath(id));
export const pendingTransfers = () => apiRequest<{ ids: string[] }>(`${vaultBase}/transfers`);
export const finalize = (id: string) =>
  apiRequest<void>(`${transferPath(id)}/finalize`, { method: 'POST' });
export const publish = (
  id: string,
  operationId: string,
  sourceRevision: number,
  content: DraftContent,
  visibility: 'public' | 'unlisted',
) =>
  apiRequest<{ pieceId: string; published: boolean }>(
    `/api/v1/owner/pieces/${encodeURIComponent(id)}/publish`,
    {
      method: 'POST',
      body: JSON.stringify({
        operationId,
        sourceRevision,
        title: content.title,
        body: content.body,
        type: content.type,
        visibility,
        respondsTo: content.respondsTo,
        medium: content.audio ? 'audio' : content.image ? 'photography' : 'writing',
        media:
          (content.audio ?? content.image ?? content.media)
            ? {
                uploadId: (content.audio ?? content.image ?? content.media)!.uploadId,
                path: (content.audio ?? content.image ?? content.media)!.path,
                mimeType: (content.audio ?? content.image ?? content.media)!.mimeType,
                byteSize: (content.audio ?? content.image ?? content.media)!.byteSize,
              }
            : undefined,
        cover:
          content.audio && content.image
            ? {
                uploadId: content.image.uploadId,
                path: content.image.path,
                mimeType: content.image.mimeType,
                byteSize: content.image.byteSize,
              }
            : undefined,
      }),
    },
  );

export const returnStatus = (pieceID: string) => apiRequest<VaultReturn>(returnPath(pieceID));
export const stageReturn = (
  pieceID: string,
  draftId: string,
  updatedAt: string,
  envelope: Envelope,
) =>
  apiRequest<VaultReturnResult>(returnPath(pieceID), {
    method: 'POST',
    body: JSON.stringify({ draftId, updatedAt, envelope }),
  });
export const finalizeReturn = (pieceID: string, draftId: string, updatedAt: string) =>
  apiRequest<VaultReturnResult>(`${returnPath(pieceID)}/finalize`, {
    method: 'POST',
    body: JSON.stringify({ draftId, updatedAt }),
  });
