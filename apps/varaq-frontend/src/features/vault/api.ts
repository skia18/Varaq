import { Configuration, PiecesApi } from '@/generated/api';
import { createClient } from '@/lib/supabase/client';
import type { Envelope, VaultConfig, DraftContent } from './crypto';
export type EncryptedDraft = {
  id: string;
  personaId: string;
  revision: number;
  envelope: Envelope;
  createdAt: string;
  updatedAt: string;
};
const client = new PiecesApi(
  new Configuration({
    basePath: (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/+$/, ''),
    accessToken: async () => {
      const { data, error } = await createClient().auth.getSession();
      if (error || !data.session) throw new Error('Sign in to access the Vault.');
      return data.session.access_token;
    },
  }),
);
export const vaultConfig = () => client.getVaultConfig();
export const saveConfig = (config: VaultConfig, revision: number) =>
  client.saveVaultConfig({ vaultConfigWrite: { config, revision } });
export const drafts = async () => {
  const page = await client.getVaultDrafts();
  return {
    items: page.items.map((d) => ({
      ...d,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    })),
  };
};
export const draft = async (id: string): Promise<EncryptedDraft> => {
  const d = await client.getVaultDraft({ pieceID: id });
  return { ...d, createdAt: d.createdAt.toISOString(), updatedAt: d.updatedAt.toISOString() };
};
export const saveDraft = (id: string, personaId: string, revision: number, envelope: Envelope) =>
  client.saveVaultDraft({ pieceID: id, vaultDraftWrite: { personaId, revision, envelope } });
export const removeDraft = (id: string, revision: number) =>
  client.deleteVaultDraft({ pieceID: id, vaultDelete: { revision } });
export const transferStatus = (id: string) => client.getVaultTransfer({ pieceID: id });
export const pendingTransfers = () => client.getPendingVaultTransfers();
export const finalize = (id: string) => client.finalizeVaultTransfer({ pieceID: id });
export const publish = (
  id: string,
  operationId: string,
  sourceRevision: number,
  content: DraftContent,
  visibility: 'public' | 'unlisted',
) =>
  client.publishOwnerPiece({
    pieceID: id,
    vaultPublish: { operationId, sourceRevision, ...content, visibility },
  });
