// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { VaultProvider, VaultGate, useVault } from '@/features/vault/VaultProvider';
const mocks = vi.hoisted(() => ({
  auth: { user: { id: 'user-a' }, isLoading: false },
  restore: vi.fn(),
  unlock: vi.fn(),
}));
vi.mock('@/auth/AuthProvider', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/features/vault/api', () => ({
  vaultConfig: async () => ({ config: { version: 1 }, revision: 1 }),
  saveConfig: vi.fn(),
}));
vi.mock('@/features/vault/crypto', () => ({
  restoreVaultSession: mocks.restore,
  unlockVaultSession: mocks.unlock,
  setupVault: vi.fn(),
  recoverVault: vi.fn(),
}));
const storageKey = 'varaq.vault.session.v1';
let root, host;
function Probe() {
  const { session, lock } = useVault();
  return React.createElement(
    'div',
    null,
    React.createElement('span', { 'data-testid': 'state' }, session ? 'unlocked' : 'locked'),
    React.createElement('button', { onClick: lock, 'data-testid': 'lock' }, 'Lock'),
  );
}
function tree() {
  return React.createElement(
    VaultProvider,
    null,
    React.createElement(Probe),
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(
        Routes,
        null,
        React.createElement(
          Route,
          { element: React.createElement(VaultGate) },
          React.createElement(Route, {
            path: '/',
            element: React.createElement('p', null, 'Drafts'),
          }),
        ),
      ),
    ),
  );
}
async function render() {
  await act(async () => root.render(tree()));
}
async function unlock() {
  await act(async () =>
    host
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
  );
  expect(host.querySelector('[data-testid="state"]').textContent).toBe('unlocked');
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  sessionStorage.clear();
  mocks.auth = { user: { id: 'user-a' }, isLoading: false };
  mocks.restore.mockResolvedValue({ type: 'secret' });
  mocks.unlock.mockResolvedValue({ key: { type: 'secret' }, sessionKey: 'local-unlock-key' });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  sessionStorage.clear();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
test('persists unlock through remount/refresh, same-user auth events and tab focus changes', async () => {
  await render();
  await unlock();
  expect(JSON.parse(sessionStorage.getItem(storageKey))).toEqual({
    userId: 'user-a',
    sessionKey: 'local-unlock-key',
  });
  mocks.auth = { user: { id: 'user-a' }, isLoading: false };
  await render();
  await act(async () => {
    window.dispatchEvent(new Event('blur'));
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
  });
  expect(host.querySelector('[data-testid="state"]').textContent).toBe('unlocked');
  await act(async () => root.unmount());
  root = createRoot(host);
  await render();
  expect(mocks.restore).toHaveBeenCalledWith('local-unlock-key');
  expect(host.querySelector('[data-testid="state"]').textContent).toBe('unlocked');
});
test('manual lock and sign-out clear stored unlock keys', async () => {
  await render();
  await unlock();
  await act(async () => host.querySelector('[data-testid="lock"]').click());
  expect(sessionStorage.getItem(storageKey)).toBeNull();
  expect(host.querySelector('[data-testid="state"]').textContent).toBe('locked');
  await unlock();
  mocks.auth = { user: null, isLoading: false };
  await render();
  expect(sessionStorage.getItem(storageKey)).toBeNull();
  expect(host.querySelector('[data-testid="state"]').textContent).toBe('locked');
});
test('waits for Auth before restoring and never restores another account key', async () => {
  sessionStorage.setItem(storageKey, JSON.stringify({ userId: 'user-a', sessionKey: 'stored' }));
  mocks.auth = { user: null, isLoading: true };
  await render();
  expect(sessionStorage.getItem(storageKey)).not.toBeNull();
  expect(mocks.restore).not.toHaveBeenCalled();
  mocks.auth = { user: { id: 'user-b' }, isLoading: false };
  await render();
  expect(sessionStorage.getItem(storageKey)).toBeNull();
  expect(mocks.restore).not.toHaveBeenCalled();
});
