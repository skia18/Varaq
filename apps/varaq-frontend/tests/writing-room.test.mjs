// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { WritingRoomPage } from '@/pages/write/WritingRoomPage';
import { LegacyWritingRoomPage } from '@/pages/write/LegacyWritingRoomPage';
const mocks = vi.hoisted(() => ({
  draft: vi.fn(),
  saveDraft: vi.fn(),
  decryptDraft: vi.fn(),
  encryptDraft: vi.fn(),
  apiRequest: vi.fn(),
  getOwnerPiece: vi.fn(),
  updateOwnerPiece: vi.fn(),
  lock: vi.fn(),
  session: { userId: 'owner', key: {} },
  persona: { id: 'persona', handle: 'writer' },
}));
vi.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ persona: mocks.persona }) }));
vi.mock('@/features/vault/VaultProvider', () => ({
  useVault: () => ({ session: mocks.session, lock: mocks.lock }),
}));
vi.mock('@/features/vault/api', () => ({ draft: mocks.draft, saveDraft: mocks.saveDraft }));
vi.mock('@/features/vault/crypto', () => ({
  encryptDraft: mocks.encryptDraft,
  decryptDraft: mocks.decryptDraft,
}));
vi.mock('@/lib/api', () => ({
  apiRequest: mocks.apiRequest,
  getOwnerPiece: mocks.getOwnerPiece,
  updateOwnerPiece: mocks.updateOwnerPiece,
}));
const content = {
  title: 'A little room',
  body: '  Keep these words.\n\nAnd their spaces.  ',
  type: 'poem',
};
const envelope = {
  version: 1,
  key: { iv: 'iv', data: 'wrapped' },
  content: { iv: 'iv2', data: 'ciphertext' },
};
let host, root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  mocks.draft.mockResolvedValue({ id: 'draft', personaId: 'persona', revision: 4, envelope });
  mocks.draft.mockResolvedValueOnce({ id: 'draft', personaId: 'persona', revision: 3, envelope });
  mocks.decryptDraft.mockResolvedValue(content);
  mocks.encryptDraft.mockResolvedValue(envelope);
  mocks.saveDraft.mockResolvedValue({ revision: 4 });
  mocks.getOwnerPiece.mockResolvedValue({ id: 'published', status: 'published', ...content });
  mocks.updateOwnerPiece.mockResolvedValue({});
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});
async function mount(Component, path) {
  await act(async () =>
    root.render(
      React.createElement(MemoryRouter, { initialEntries: [path] }, React.createElement(Component)),
    ),
  );
}
async function save() {
  await act(async () =>
    host
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
  );
}
test('restored draft editor preserves writing and saves only its encrypted envelope', async () => {
  await mount(WritingRoomPage, '/write?pieceId=draft');
  expect(host.querySelector('h1').textContent).toBe('Return to your words.');
  expect(host.querySelector('textarea').value).toBe(content.body);
  expect(host.textContent).toContain('@writer');
  await save();
  expect(mocks.encryptDraft).toHaveBeenCalledWith(
    mocks.session.key,
    'owner',
    'draft',
    'persona',
    4,
    content,
  );
  expect(mocks.saveDraft).toHaveBeenCalledWith('draft', 'persona', 3, envelope);
  expect(mocks.apiRequest).not.toHaveBeenCalled();
  expect(host.textContent).toContain('Encrypted draft saved.');
  await act(async () =>
    [...host.querySelectorAll('button')].find((b) => b.textContent === 'Lock Vault').click(),
  );
  expect(mocks.lock).toHaveBeenCalledOnce();
});
test('published editor uses the same writing layout and clearly saves readable published content', async () => {
  await mount(LegacyWritingRoomPage, '/wall/manage/edit?pieceId=published');
  expect(host.querySelector('h1').textContent).toContain('published words');
  expect(host.textContent).toContain('Published piece');
  expect(host.textContent).not.toContain('Encrypted draft');
  expect(host.querySelector('textarea').value).toBe(content.body);
  await save();
  expect(mocks.updateOwnerPiece).toHaveBeenCalledWith('published', content);
  expect(mocks.encryptDraft).not.toHaveBeenCalled();
  expect(host.textContent).toContain('Published changes saved.');
});
test('draft inputs stay disabled until loading and decryption complete', async () => {
  mocks.draft.mockReset().mockReturnValue(new Promise(() => {}));
  await mount(WritingRoomPage, '/write?pieceId=draft');
  expect(host.querySelector('#piece-title').disabled).toBe(true);
  expect(host.querySelector('#piece-body').disabled).toBe(true);
  expect(host.querySelector('button[type="submit"]').disabled).toBe(true);
});
