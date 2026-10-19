import { describe, it, expect } from 'vitest';
import {
  encryptDraft,
  decryptDraft,
  setupVault,
  unlockVault,
  recoverVault,
  restoreVaultSession,
} from './crypto';
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
  it('accepts single-character passphrases for setup, unlock and recovery', async () => {
    const v = await setupVault(user, '7');
    expect(v.key.extractable).toBe(false);
    const encrypted = await encryptDraft(v.key, user, id, persona, 1, content);
    const restored = await restoreVaultSession(v.sessionKey);
    expect(restored.extractable).toBe(false);
    expect(await decryptDraft(restored, user, id, persona, 1, encrypted)).toEqual(content);
    await expect(restoreVaultSession('AA==')).rejects.toThrow();
    const unlocked = await unlockVault(user, v.config, '7');
    expect(await decryptDraft(unlocked, user, id, persona, 1, encrypted)).toEqual(content);
    await expect(unlockVault(user, v.config, 'wrong passphrase')).rejects.toThrow();
    const recovered = await recoverVault(user, v.config, v.recovery, '猫');
    const fresh = await unlockVault(user, recovered.config, '猫');
    expect(await decryptDraft(fresh, user, id, persona, 1, encrypted)).toEqual(content);
    await expect(unlockVault(user, recovered.config, '7')).rejects.toThrow();
    await expect(
      recoverVault(user, v.config, 'varaq1.AA==', 'another long passphrase'),
    ).rejects.toThrow();
  }, 60000);
  it('requires a non-empty passphrase', async () => {
    await expect(setupVault(user, '')).rejects.toThrow('Enter a Vault passphrase.');
    await expect(
      recoverVault(
        user,
        { version: 1, salt: '', passphrase: { iv: '', data: '' }, recovery: { iv: '', data: '' } },
        'unused',
        '',
      ),
    ).rejects.toThrow('Enter a Vault passphrase.');
  });
});
