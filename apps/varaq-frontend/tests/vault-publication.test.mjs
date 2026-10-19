// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { VaultPage } from '@/features/vault/VaultPage';
const mocks = vi.hoisted(() => ({
  drafts: vi.fn(),
  pendingTransfers: vi.fn(),
  finalize: vi.fn(),
  publish: vi.fn(),
  transferStatus: vi.fn(),
  removeDraft: vi.fn(),
  decryptDraft: vi.fn(),
  session: { userId: 'owner', key: {} },
}));
vi.mock('@/features/vault/api', () => mocks);
vi.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({
    persona: { displayName: 'Test Writer', handle: 'writer', bio: 'A private profile' },
  }),
}));
vi.mock('@/features/vault/crypto', () => ({ decryptDraft: mocks.decryptDraft }));
vi.mock('@/features/vault/VaultProvider', () => ({ useVault: () => ({ session: mocks.session }) }));
let root, host;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  mocks.drafts.mockResolvedValue({
    items: [
      {
        id: 'draft',
        personaId: 'persona',
        revision: 3,
        envelope: {},
        updatedAt: '2026-10-19T00:00:00Z',
      },
    ],
  });
  mocks.pendingTransfers.mockResolvedValue({ ids: [] });
  mocks.decryptDraft.mockResolvedValue({
    title: 'Secret title',
    body: 'Secret writing',
    type: 'poem',
  });
  mocks.finalize.mockResolvedValue(undefined);
  mocks.publish.mockResolvedValue({ pieceId: 'draft', published: true });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
async function mount() {
  await act(async () =>
    root.render(React.createElement(MemoryRouter, null, React.createElement(VaultPage))),
  );
}
async function click(text) {
  const button = [...document.querySelectorAll('button')].find((b) => b.textContent === text);
  expect(button).toBeTruthy();
  await act(async () => button.click());
}
test('plaintext is submitted only after explicit confirmation and failed cleanup stays visible', async () => {
  await mount();
  expect(mocks.publish).not.toHaveBeenCalled();
  await click('Publish');
  expect(document.querySelector('[role="dialog"]').textContent).toContain('readable content');
  expect(mocks.publish).not.toHaveBeenCalled();
  await click('Cancel');
  expect(mocks.publish).not.toHaveBeenCalled();
  await click('Publish');
  mocks.finalize.mockRejectedValue(new Error('offline'));
  mocks.pendingTransfers.mockResolvedValue({ ids: ['draft'] });
  mocks.drafts.mockResolvedValue({ items: [] });
  await click('Confirm publication');
  expect(mocks.publish).toHaveBeenCalledWith(
    'draft',
    'draft',
    3,
    { title: 'Secret title', body: 'Secret writing', type: 'poem' },
    'public',
  );
  expect(mocks.finalize).toHaveBeenCalledWith('draft');
  expect(host.textContent).toContain('awaiting encrypted draft cleanup');
  expect(mocks.removeDraft).not.toHaveBeenCalled();
});
test('an uncertain outcome preserves the draft and does not request deletion', async () => {
  await mount();
  mocks.publish.mockRejectedValue(new Error('timeout'));
  mocks.transferStatus.mockRejectedValue(new Error('offline'));
  await click('Publish');
  await click('Confirm publication');
  expect(host.textContent).toContain('outcome is uncertain');
  expect(mocks.finalize).not.toHaveBeenCalled();
  expect(mocks.removeDraft).not.toHaveBeenCalled();
  expect(host.textContent).toContain('Secret title');
});

test('Vault keeps the private profile and original writing-card layout', async () => {
  await mount();
  expect(host.querySelector('.writer-profile h1').textContent).toBe('Test Writer');
  expect(host.querySelector('.wall-handle').textContent).toBe('@writer');
  expect(host.querySelector('.bio').textContent).toBe('A private profile');
  expect(host.querySelector('.writing-grid .writing-card')).not.toBeNull();
  expect(host.querySelector('button[aria-label="Read Secret title"]')).not.toBeNull();
});
