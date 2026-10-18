// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PublicWallPage } from '@/pages/profile/PublicWallPage';
import { ProfilePage } from '@/pages/profile/ProfilePage';
import { HomePage } from '@/pages/home/HomePage';
import { SavedPagesProvider } from '@/features/saved/SavedPagesContext';

const mocks = vi.hoisted(() => ({
  getPublicPersona: vi.fn(),
  getPublicPieces: vi.fn(),
  getOwnerPieces: vi.fn(),
  getFeed: vi.fn(),
  publishOwnerPiece: vi.fn(),
  deleteOwnerPiece: vi.fn(),
  useAuth: vi.fn(),
}));
vi.mock('@/lib/api', () => mocks);
vi.mock('@/auth/AuthProvider', () => ({ useAuth: mocks.useAuth }));

const persona = {
  id: 'persona',
  handle: 'quiet_stranger',
  displayName: 'Quiet Stranger',
  bio: null,
};
const piece = {
  id: 'piece-1',
  personaId: persona.id,
  slug: 'a-page',
  title: 'A page to read',
  body: `${'A long line of writing. '.repeat(30)}\n\nThe final line.`,
  type: 'poem',
  status: 'published',
  visibility: 'public',
  publishedAt: '2026-10-18T12:00:00Z',
  createdAt: '2026-10-18T12:00:00Z',
  updatedAt: '2026-10-18T12:00:00Z',
};
let host, root, consoleError;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.useFakeTimers();
  consoleError = vi.spyOn(console, 'error');
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })),
  );
  mocks.getPublicPersona.mockResolvedValue(persona);
  mocks.getPublicPieces.mockResolvedValue({ items: [piece], nextCursor: null });
  mocks.getOwnerPieces.mockResolvedValue({
    items: [{ ...piece, status: 'draft', visibility: 'private', publishedAt: null }],
    nextCursor: null,
  });
  mocks.getFeed.mockResolvedValue({
    items: [{ ...piece, author: persona.displayName, handle: persona.handle }],
    nextCursor: null,
  });
  mocks.useAuth.mockReturnValue({
    user: { id: 'user' },
    persona,
    isLoading: false,
    isPersonaLoading: false,
    personaError: null,
  });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  await flushDialogUpdates();
  host.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  // Keep React warnings visible, and fail if asynchronous dialog updates escape act.
  const actWarnings = consoleError.mock.calls.filter((args) =>
    args.some((value) => typeof value === 'string' && value.includes('not wrapped in act')),
  );
  expect(actWarnings).toEqual([]);
});
async function flushDialogUpdates() {
  await act(async () => {
    await vi.runAllTimersAsync();
  });
}
async function mount(page, path) {
  await act(async () =>
    root.render(
      React.createElement(
        MemoryRouter,
        { initialEntries: [path] },
        React.createElement(
          SavedPagesProvider,
          null,
          React.createElement(
            Routes,
            null,
            React.createElement(Route, { path: '*', element: page }),
          ),
        ),
      ),
    ),
  );
}
async function click(element) {
  expect(element).not.toBeNull();
  await act(async () => {
    element.focus();
    element.click();
  });
  await flushDialogUpdates();
}
async function openReader() {
  const button = host.querySelector('button[aria-label="Read A page to read"]');
  await click(button);
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  const dialog = document.querySelector('[role="dialog"]');
  expect(dialog.textContent).toContain(piece.body);
  expect(dialog.textContent).toContain(persona.displayName);
  expect(dialog.querySelector('.reading-body').textContent).toBe(piece.body);
  return button;
}

test('public wall opens the full piece in place and closes with the close button', async () => {
  await act(async () =>
    root.render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/wall/quiet_stranger'] },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, {
            path: '/wall/:handle',
            element: React.createElement(PublicWallPage),
          }),
        ),
      ),
    ),
  );
  await openReader();
  expect(mocks.getPublicPieces).toHaveBeenCalledTimes(1);
  expect(mocks.getFeed).not.toHaveBeenCalled();
  await click(document.querySelector('button[aria-label="Close reading"]'));
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});

test('vault opens a private draft without requesting the public feed and closes with Escape', async () => {
  await mount(React.createElement(ProfilePage), '/vault');
  const trigger = await openReader();
  expect(document.querySelector('[role="dialog"]').contains(document.activeElement)).toBe(true);
  expect(mocks.getFeed).not.toHaveBeenCalled();
  expect(mocks.getPublicPieces).not.toHaveBeenCalled();
  await act(async () =>
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
  );
  await flushDialogUpdates();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

test('vault edit, publish and delete controls stay separate from reading', async () => {
  await mount(React.createElement(ProfilePage), '/vault');
  expect(host.querySelector('a[aria-label="Edit A page to read"]').getAttribute('href')).toBe(
    '/write?pieceId=piece-1',
  );
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  await click(
    [...host.querySelectorAll('button')].find((button) => button.textContent.includes('Publish')),
  );
  await click(
    [...host.querySelectorAll('button')].find((button) => button.textContent.includes('Delete')),
  );
  expect(confirm).toHaveBeenCalledTimes(2);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(mocks.publishOwnerPiece).not.toHaveBeenCalled();
  expect(mocks.deleteOwnerPiece).not.toHaveBeenCalled();
});

test('commons continues to open the full piece with the shared reader', async () => {
  await mount(React.createElement(HomePage), '/');
  await openReader();
  await click(document.querySelector('button[aria-label="Close reading"]'));
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});
