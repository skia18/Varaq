// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ResponseError } from '@/generated/api';
import { ReturnToVaultPage } from '@/features/vault/ReturnToVaultPage';
const mocks = vi.hoisted(() => ({
  getOwnerPiece: vi.fn(),
  returnStatus: vi.fn(),
  stageReturn: vi.fn(),
  finalizeReturn: vi.fn(),
  encryptDraft: vi.fn(),
  decryptDraft: vi.fn(),
}));
vi.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ persona: { handle: 'writer' } }) }));
vi.mock('@/lib/api', () => ({ getOwnerPiece: mocks.getOwnerPiece }));
vi.mock('@/features/vault/api', () => mocks);
vi.mock('@/features/vault/crypto', () => ({
  encryptDraft: mocks.encryptDraft,
  decryptDraft: mocks.decryptDraft,
}));
vi.mock('@/features/vault/VaultProvider', () => ({
  useVault: () => ({ session: { userId: 'user', key: {} } }),
}));
const content = { title: 'Published title', body: 'Published body', type: 'poem' };
const envelope = {
  version: 1,
  key: { iv: 'nonce', data: 'cipherkey' },
  content: { iv: 'nonce2', data: 'ciphertext' },
};
const stamp = '2026-10-19T00:00:00.123456Z';
let root, host;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  mocks.getOwnerPiece.mockResolvedValue({
    id: 'source',
    personaId: 'persona',
    status: 'published',
    visibility: 'unlisted',
    updatedAt: stamp,
    ...content,
  });
  mocks.returnStatus.mockRejectedValueOnce(new ResponseError(new Response(null, { status: 404 })));
  mocks.encryptDraft.mockResolvedValue(envelope);
  mocks.decryptDraft.mockResolvedValue(content);
  mocks.stageReturn.mockResolvedValue({ draftId: 'fresh', completed: false });
  mocks.finalizeReturn.mockResolvedValue({ draftId: 'fresh', completed: true });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});
async function mount() {
  await act(async () =>
    root.render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/vault/return/source'] },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, {
            path: '/vault/return/:pieceId',
            element: React.createElement(ReturnToVaultPage),
          }),
          React.createElement(Route, {
            path: '/vault',
            element: React.createElement('p', null, 'Vault destination'),
          }),
        ),
      ),
    ),
  );
}
async function click(text) {
  const b = [...document.querySelectorAll('button')].find((b) => b.textContent === text);
  expect(b).toBeTruthy();
  await act(async () => b.click());
}
test('requires confirmation, sends ciphertext, verifies readback, then finalizes with full timestamp precision', async () => {
  await mount();
  await click('Move to Vault');
  expect(mocks.stageReturn).not.toHaveBeenCalled();
  await click('Cancel');
  expect(mocks.finalizeReturn).not.toHaveBeenCalled();
  await click('Move to Vault');
  mocks.returnStatus.mockImplementation(async () => ({
    draftId: mocks.encryptDraft.mock.calls[0][2],
    personaId: 'persona',
    updatedAt: stamp,
    envelope,
    completed: false,
  }));
  await click('Confirm move to Vault');
  const id = mocks.encryptDraft.mock.calls[0][2];
  expect(id).not.toBe('source');
  expect(mocks.stageReturn).toHaveBeenCalledWith('source', id, stamp, envelope);
  expect(JSON.stringify(mocks.stageReturn.mock.calls)).not.toContain(content.body);
  expect(mocks.decryptDraft).toHaveBeenCalled();
  expect(mocks.finalizeReturn).toHaveBeenCalledWith('source', id, stamp);
  expect(mocks.decryptDraft.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.finalizeReturn.mock.invocationCallOrder[0],
  );
  expect(host.textContent).toContain('Vault destination');
});
test('failed verification preserves the publication and never finalizes', async () => {
  await mount();
  mocks.returnStatus.mockResolvedValue({
    draftId: 'fresh',
    personaId: 'persona',
    updatedAt: stamp,
    envelope,
    completed: false,
  });
  mocks.decryptDraft.mockRejectedValue(new Error('invalid tag'));
  await click('Move to Vault');
  await click('Confirm move to Vault');
  expect(mocks.finalizeReturn).not.toHaveBeenCalled();
  expect(host.textContent).toContain('could not be confirmed');
});
test('a lost finalize response reconciles its completed receipt', async () => {
  await mount();
  mocks.returnStatus
    .mockResolvedValueOnce({
      draftId: 'fresh',
      personaId: 'persona',
      updatedAt: stamp,
      envelope,
      completed: false,
    })
    .mockResolvedValueOnce({ draftId: 'fresh', completed: true });
  mocks.finalizeReturn.mockRejectedValue(new Error('timeout'));
  await click('Move to Vault');
  await click('Confirm move to Vault');
  expect(mocks.finalizeReturn).toHaveBeenCalled();
  expect(host.textContent).toContain('Vault destination');
});
