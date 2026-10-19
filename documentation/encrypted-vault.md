# Encrypted Vault

The Vault uses the existing React/Vite/TypeScript, Go/Chi, Supabase Auth, and PostgreSQL stack. Only Go accesses application tables. Apply `supabase/migrations/20261019000000_encrypted_vault.sql` before deploying this application version; it has not been applied to a hosted project by this implementation.

## User flow

1. Sign in with Supabase. Open `/vault` and create a separate passphrase (minimum 12 characters).
2. Save the recovery key and acknowledge it before setup is committed. There is no server copy of this secret.
3. Unlock once per tab session. Manual lock, sign-out, account change, refresh, or closing the tab clears the unlocked UI/key references. Navigating between pages retains unlock in memory. No inactivity timer is currently implemented.
4. Save drafts manually. The browser encrypts before sending; optimistic revisions prevent stale overwrites. A lost-response retry reuses the original envelope. After an uncertain save, retry unchanged content or reload before further edits. Closing/refreshing with unsaved edits triggers the browser warning; in-app navigation does not yet have a dirty-state blocker.
5. Select Publish, confirm the snapshot and public/unlisted visibility. This intentionally sends readable content to Varaq. A committed receipt removes the source from active Vault queries and freezes it. Browser cleanup removes ciphertext; a Go worker retries confirmed transfers after five minutes, checked every minute.
6. Published writing is managed at `/published`. Public and unlisted pieces are readable at `/piece/{uuid}`; only public pieces appear on public walls/feeds. Published editing/deletion retain their existing plaintext behavior.

## Crypto format v1

`@noble/hashes` 2.2.0 supplies Argon2id (t=3, m=65536 KiB, p=1, 32-byte result). The profile is fixed by format version; the server cannot request weaker or excessive costs. Device benchmarking is still required before a production release.

A random 32-byte master key is wrapped twice: under a passphrase-derived AES key, and under an HKDF-SHA-256 key derived from a random 32-byte recovery secret. The recovery text is `varaq1.` followed by standard Base64. AES-256-GCM uses random 12-byte nonces and 128-bit tags. Setup stores a 16-byte passphrase KDF salt and the two wrappers. Recovery changes the passphrase wrapper using configuration CAS and validates it locally before saving.

Each saved revision gets a fresh random 32-byte data key. That key encrypts JSON `{title,body,type}` and is wrapped under the master key. AAD is UTF-8 JSON of `['varaq-vault',1,userId,draftId,personaId,revision,purpose]`, where purpose is `key` or `content`. Master wrappers bind userId and `passphrase`/`recovery` purpose. Stored envelopes contain only version, nonces, ciphertext/tags, and the wrapped data key. Server metadata includes ownership, identity, revision, timestamps, and ciphertext size.

Unlocked CryptoKeys are non-extractable; temporary byte arrays are cleared where possible. JavaScript/GC cannot guarantee memory erasure. XSS, malicious delivered JavaScript, compromised devices, server deletion, and undetectable historical rollback on a fresh browser remain outside the established protections. An attacker with wrappers can attempt offline passphrase guesses. Losing both credentials makes recovery unavailable. Account password reset does not reset the Vault. Recovery does not revoke previously copied keys or ciphertext.

## Database and lifecycle

Storage is in `varaq_private`, outside configured Data API schemas. Browser roles have no schema/table access. This migration retains the existing database-owner Go connection behavior; a separately provisioned runtime role needs explicit private-schema/table grants and intentional RLS policy/role configuration. Do not expose its credentials to the browser.

`publication_operations.draft_id` is unique and intentionally has no cascading foreign key to `pieces`. This receipt survives published deletion and prevents replay from recreating content. Publication, source revision check, and receipt insertion commit together. Advisory transaction locks serialize operations on a draft, including absent-row creation. Same-operation/snapshot retry returns the original identity. A conflicting snapshot returns 409; the browser queries source status before deciding whether to retain an active draft.

Failed/uncertain publication preserves ciphertext. Failed cleanup is shown as pending and retried. Cleanup cannot authorize itself from a browser claim: it requires a committed server receipt and deletes only the encrypted source. Existing published rows/revisions/backups are not converted to encrypted storage.

## Legacy drafts

Existing plaintext drafts remain explicitly labelled at `/published`. New plaintext draft creation is disabled. Published edits remain supported; legacy draft editing moves through `/write?importId={uuid}`.

Import uploads ciphertext while preserving the source, reads it back, authenticates/decrypts locally, compares the content, then conditionally removes the unchanged plaintext draft. Pending imports are not active Vault drafts and cannot be published through the encrypted publisher. Concurrent source changes prevent deletion. Reloading the import can replace a staged copy when the source timestamp changed. Historical backups/WAL may retain plaintext according to existing retention policies; this feature cannot retroactively encrypt them.

## Validation

- `npm run api:validate-spec`
- `npm run api:generate:web` (pinned generator; finalization marks upstream generated code unchecked while app consumers remain type checked)
- `npm run build:web`
- `npm run test:web`
- `npm run lint:web`
- `npm run test:go`
- `VARAQ_TEST_DATABASE_URL=<isolated migrated PostgreSQL URL> go test ./... -race -count=1` from `apps/varaq-backend`

The database integration test inserts synthetic Auth users and removes them afterward; only point it at a disposable database. It tests actual SQL revision conflicts, exact retries, ownership, publication uniqueness, rollback injection, cleanup, privileges, source-import conflicts, and tombstones. Unit/browser-component tests cover crypto tampering/context binding, fresh-key recovery, ciphertext-only generated-client transport, explicit confirmation, and uncertain publication/cleanup UI.

Production release still needs an actual-browser exercise with local Supabase Auth (including logout/account switching and refresh), network/log/storage canary inspection, low-end-device KDF benchmarking, deployment-role review, and backup/retention confirmation. Tests here do not amount to a cryptographic audit or prove resistance to malicious application delivery.
