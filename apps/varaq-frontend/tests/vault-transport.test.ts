import { afterEach, expect, it, vi } from 'vitest';
import { encryptDraft } from '@/features/vault/crypto';
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({
        data: { session: { access_token: 'test-auth-token' } },
        error: null,
      }),
    },
  }),
}));
import { saveDraft } from '@/features/vault/api';
afterEach(() => vi.unstubAllGlobals());
it('the generated client sends only the encrypted draft envelope and bearer authentication', async () => {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
  const content = {
    title: 'PRIVATE_CANARY_TITLE',
    body: 'PRIVATE_CANARY_BODY',
    type: 'poem' as const,
  };
  const envelope = await encryptDraft(key, 'user', 'id', 'persona', 1, content);
  const fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ revision: 1 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', fetch);
  await saveDraft('id', 'persona', 0, envelope);
  const [url, options] = fetch.mock.calls[0];
  expect(url).toContain('/owner/vault/drafts/id');
  expect(options.headers.Authorization).toBe('Bearer test-auth-token');
  expect(JSON.parse(options.body)).toEqual({ personaId: 'persona', revision: 0, envelope });
  expect(options.body).not.toContain(content.title);
  expect(options.body).not.toContain(content.body);
});
