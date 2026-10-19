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
  mocks.useAuth.mockReturnValue({
    user: null,
    persona: null,
    isLoading: false,
    isPersonaLoading: false,
  });
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

test('legacy draft list opens a private draft without requesting the public feed and closes with Escape', async () => {
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

test('legacy edit, publish and delete controls stay separate from reading', async () => {
  await mount(React.createElement(ProfilePage), '/vault');
  expect(host.querySelector('a[aria-label="Edit A page to read"]').getAttribute('href')).toBe(
    '/write?importId=piece-1',
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

async function mountWall(handle = 'quiet_stranger') {
  await act(async () =>
    root.render(
      React.createElement(
        MemoryRouter,
        { initialEntries: [`/wall/${handle}`] },
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
}
test('My Wall shows public and unlisted publications with owner controls, excluding drafts', async () => {
  mocks.getOwnerPieces.mockResolvedValue({
    items: [
      piece,
      { ...piece, id: 'unlisted', title: 'Unlisted words', visibility: 'unlisted' },
      { ...piece, id: 'draft', title: 'Private draft', status: 'draft', visibility: 'private' },
    ],
    nextCursor: null,
  });
  await mountWall();
  expect(mocks.getOwnerPieces).toHaveBeenCalledWith({
    limit: 20,
    status: 'published',
    personaId: persona.id,
  });
  expect(mocks.getPublicPieces).not.toHaveBeenCalled();
  expect(host.textContent).toContain('Unlisted words');
  expect(host.textContent).not.toContain('Private draft');
  expect(host.querySelector('a[aria-label="Edit A page to read"]').getAttribute('href')).toBe(
    '/wall/manage/edit?pieceId=piece-1',
  );
  expect(host.querySelector('a[href="/vault/return/piece-1"]')).not.toBeNull();
  expect([...host.querySelectorAll('button')].some((b) => b.textContent.includes('Delete'))).toBe(
    true,
  );
});
test('visitors get only the public endpoint and no management controls', async () => {
  await mountWall('another_writer');
  expect(mocks.getPublicPieces).toHaveBeenCalledWith('another_writer', { limit: 20 });
  expect(mocks.getOwnerPieces).not.toHaveBeenCalled();
  expect(host.textContent).not.toContain('Move to Vault');
  expect(host.querySelector('a[aria-label^="Edit "]')).toBeNull();
});
test('sign-out removes owner-only unlisted content and switches to the public wall', async () => {
  mocks.getOwnerPieces.mockResolvedValue({
    items: [piece, { ...piece, id: 'unlisted', title: 'Unlisted words', visibility: 'unlisted' }],
    nextCursor: null,
  });
  await mountWall();
  expect(host.textContent).toContain('Unlisted words');
  mocks.useAuth.mockReturnValue({
    user: null,
    persona: null,
    isLoading: false,
    isPersonaLoading: false,
  });
  await mountWall();
  expect(host.textContent).not.toContain('Unlisted words');
  expect(host.textContent).not.toContain('Move to Vault');
  expect(mocks.getPublicPieces).toHaveBeenCalled();
});
test('owner wall loads older publications using its filtered cursor', async () => {
  mocks.getOwnerPieces
    .mockResolvedValueOnce({ items: [piece], nextCursor: 'older' })
    .mockResolvedValueOnce({
      items: [{ ...piece, id: 'older', title: 'Older publication' }],
      nextCursor: null,
    });
  await mountWall();
  await click(
    [...host.querySelectorAll('button')].find((b) => b.textContent === 'Load more pages'),
  );
  expect(mocks.getOwnerPieces).toHaveBeenLastCalledWith({
    limit: 20,
    status: 'published',
    personaId: persona.id,
    cursor: 'older',
  });
  expect(host.textContent).toContain('Older publication');
});
