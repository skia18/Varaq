import { describe, it, expect } from 'vitest';
import { encryptDraft, decryptDraft, setupVault, unlockVault, recoverVault } from './crypto';
const user = 'user-a',
  id = 'draft-a',
  persona = 'persona-a';
const content = { title: 'CONFIDENTIAL_TITLE', body: 'CONFIDENTIAL_BODY', type: 'poem' as const };
describe('Vault envelopes', () => {
  it('roundtrips without plaintext and uses fresh key/nonce per save', async () => {
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
      'encrypt',
      'decrypt',
    ]);
    const a = await encryptDraft(key, user, id, persona, 1, content);
    const b = await encryptDraft(key, user, id, persona, 1, content);
    expect(JSON.stringify(a)).not.toContain(content.title);
    expect(JSON.stringify(a)).not.toContain(content.body);
    expect(a.content.iv).not.toBe(b.content.iv);
    expect(a.key.data).not.toBe(b.key.data);
    expect(await decryptDraft(key, user, id, persona, 1, a)).toEqual(content);
    for (const args of [
      ['other', id, persona, 1],
      [user, 'other', persona, 1],
      [user, id, 'other', 1],
      [user, id, persona, 2],
    ] as const) {
      await expect(decryptDraft(key, args[0], args[1], args[2], args[3], a)).rejects.toThrow();
    }
    const corrupt = structuredClone(a);
    corrupt.content.data =
      (corrupt.content.data[0] === 'A' ? 'B' : 'A') + corrupt.content.data.slice(1);
    await expect(decryptDraft(key, user, id, persona, 1, corrupt)).rejects.toThrow();
    const wrong = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
      'encrypt',
      'decrypt',
    ]);
    await expect(decryptDraft(wrong, user, id, persona, 1, a)).rejects.toThrow();
  });
  it('unlocks on a fresh key, recovers and replaces the passphrase wrapper', async () => {
    const v = await setupVault(user, 'a long first passphrase');
    expect(v.key.extractable).toBe(false);
    const encrypted = await encryptDraft(v.key, user, id, persona, 1, content);
    const unlocked = await unlockVault(user, v.config, 'a long first passphrase');
    expect(await decryptDraft(unlocked, user, id, persona, 1, encrypted)).toEqual(content);
    await expect(unlockVault(user, v.config, 'wrong passphrase')).rejects.toThrow();
    const recovered = await recoverVault(user, v.config, v.recovery, 'a different long passphrase');
    const fresh = await unlockVault(user, recovered.config, 'a different long passphrase');
    expect(await decryptDraft(fresh, user, id, persona, 1, encrypted)).toEqual(content);
    await expect(unlockVault(user, recovered.config, 'a long first passphrase')).rejects.toThrow();
    await expect(
      recoverVault(user, v.config, 'varaq1.AA==', 'another long passphrase'),
    ).rejects.toThrow();
  }, 60000);
});
