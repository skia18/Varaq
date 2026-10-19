import { argon2idAsync } from '@noble/hashes/argon2.js';
import type { PieceType } from '@/lib/api';

import type { Sealed, VaultConfig, VaultEnvelope as Envelope } from '@/generated/api';
export type { Sealed, VaultConfig, Envelope };
export type DraftContent = { title: string; body: string; type: PieceType };
const enc = new TextEncoder();
export const toBase64 = (b: Uint8Array) =>
  btoa(Array.from(b, (x) => String.fromCharCode(x)).join(''));
export const fromBase64 = (s: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));
const context = (...parts: (string | number)[]) => JSON.stringify(['varaq-vault', 1, ...parts]);
async function aes(raw: Uint8Array<ArrayBuffer>) {
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function seal(key: CryptoKey, bytes: Uint8Array<ArrayBuffer>, aad: string): Promise<Sealed> {
  const iv = random(12);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: enc.encode(aad), tagLength: 128 },
    key,
    bytes,
  );
  return { iv: toBase64(iv), data: toBase64(new Uint8Array(encrypted)) };
}
async function open(key: CryptoKey, value: Sealed, aad: string) {
  if (fromBase64(value.iv).length !== 12) throw new Error('Invalid encryption nonce.');
  return new Uint8Array(
    await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: fromBase64(value.iv),
        additionalData: enc.encode(aad),
        tagLength: 128,
      },
      key,
      fromBase64(value.data),
    ),
  );
}
async function passKey(passphrase: string, salt: string) {
  const bytes = fromBase64(salt);
  if (bytes.length !== 16) throw new Error('Invalid Vault salt.');
  // Version 1 fixes the KDF profile; never accept weaker server-supplied costs.
  const raw = new Uint8Array(
    await argon2idAsync(passphrase, bytes, { t: 3, m: 65536, p: 1, dkLen: 32 }),
  );
  try {
    return await aes(raw);
  } finally {
    raw.fill(0);
  }
}
async function recoveryKey(secret: string, user: string) {
  const raw = fromBase64(secret.replace(/^varaq1\./, ''));
  if (raw.length !== 32 || !secret.startsWith('varaq1.')) throw new Error('Invalid recovery key.');
  try {
    const material = await crypto.subtle.importKey('raw', raw, 'HKDF', false, ['deriveKey']);
    return await crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: enc.encode(user),
        info: enc.encode('varaq-vault-recovery-v1'),
      },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
  } finally {
    raw.fill(0);
  }
}
export async function setupVault(user: string, passphrase: string) {
  if (passphrase.length < 12) throw new Error('Use a Vault passphrase of at least 12 characters.');
  const raw = random(32),
    salt = toBase64(random(16)),
    recovery = `varaq1.${toBase64(random(32))}`;
  try {
    const config: VaultConfig = {
      version: 1,
      salt,
      passphrase: await seal(await passKey(passphrase, salt), raw, context(user, 'passphrase')),
      recovery: await seal(await recoveryKey(recovery, user), raw, context(user, 'recovery')),
    };
    return { config, recovery, key: await aes(raw), sessionKey: toBase64(raw) };
  } finally {
    raw.fill(0);
  }
}
export async function unlockVaultSession(user: string, config: VaultConfig, passphrase: string) {
  if (config.version !== 1) throw new Error('Unsupported Vault format.');
  const raw = await open(
    await passKey(passphrase, config.salt),
    config.passphrase,
    context(user, 'passphrase'),
  );
  try {
    return { key: await aes(raw), sessionKey: toBase64(raw) };
  } finally {
    raw.fill(0);
  }
}
export async function unlockVault(user: string, config: VaultConfig, passphrase: string) {
  return (await unlockVaultSession(user, config, passphrase)).key;
}
export async function restoreVaultSession(sessionKey: string) {
  const raw = fromBase64(sessionKey);
  try {
    if (raw.length !== 32) throw new Error('Invalid session key.');
    return await aes(raw);
  } finally {
    raw.fill(0);
  }
}
export async function recoverVault(
  user: string,
  config: VaultConfig,
  recovery: string,
  passphrase: string,
) {
  if (config.version !== 1 || passphrase.length < 12)
    throw new Error('Use a passphrase of at least 12 characters.');
  const raw = await open(
    await recoveryKey(recovery.trim(), user),
    config.recovery,
    context(user, 'recovery'),
  );
  try {
    const salt = toBase64(random(16));
    const next: VaultConfig = {
      ...config,
      salt,
      passphrase: await seal(await passKey(passphrase, salt), raw, context(user, 'passphrase')),
    };
    await unlockVault(user, next, passphrase);
    return { config: next, key: await aes(raw), sessionKey: toBase64(raw) };
  } finally {
    raw.fill(0);
  }
}
export async function encryptDraft(
  key: CryptoKey,
  user: string,
  id: string,
  persona: string,
  revision: number,
  content: DraftContent,
): Promise<Envelope> {
  const raw = random(32);
  try {
    return {
      version: 1,
      key: await seal(key, raw, context(user, id, persona, revision, 'key')),
      content: await seal(
        await aes(raw),
        enc.encode(JSON.stringify(content)),
        context(user, id, persona, revision, 'content'),
      ),
    };
  } finally {
    raw.fill(0);
  }
}
export async function decryptDraft(
  key: CryptoKey,
  user: string,
  id: string,
  persona: string,
  revision: number,
  envelope: Envelope,
): Promise<DraftContent> {
  if (envelope.version !== 1) throw new Error('Unsupported draft format.');
  const raw = await open(key, envelope.key, context(user, id, persona, revision, 'key'));
  try {
    const content = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(
        await open(
          await aes(raw),
          envelope.content,
          context(user, id, persona, revision, 'content'),
        ),
      ),
    );
    if (
      typeof content.title !== 'string' ||
      typeof content.body !== 'string' ||
      !['poem', 'fragment', 'story', 'letter', 'essay'].includes(content.type)
    )
      throw new Error('Invalid draft content.');
    return content;
  } finally {
    raw.fill(0);
  }
}
