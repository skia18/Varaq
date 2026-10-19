// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PersonaGate } from '@/auth/PersonaSetup';
import { MemoryRouter } from 'react-router-dom';
const mocks = vi.hoisted(() => ({
  auth: {
    user: { id: 'new-user' },
    persona: null as null | { id: string },
    isLoading: false,
    isPersonaLoading: false,
    personaError: null as string | null,
    refreshPersona: vi.fn(),
  },
  createPersona: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut: mocks.signOut } }),
}));
vi.mock('@/auth/AuthProvider', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/lib/api', async (original) => ({
  ...(await original<object>()),
  createPersona: mocks.createPersona,
}));
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  Object.assign(mocks.auth, { persona: null, isPersonaLoading: false, personaError: null });
  mocks.createPersona.mockResolvedValue({ id: 'persona' });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
async function render() {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <PersonaGate>
          <p>Account content</p>
        </PersonaGate>
      </MemoryRouter>,
    ),
  );
}
test('new users can create a persona without writing or setting up a Vault', async () => {
  await render();
  expect(host.textContent).toContain('Create your persona');
  expect(host.querySelector('.account-scene')).not.toBeNull();
  expect(host.textContent).toContain('Step 2 of 2');
  expect(host.textContent).not.toContain('Account content');
  for (const [id, value] of [
    ['persona-display-name', 'Reader'],
    ['persona-handle', 'reader'],
  ]) {
    const input = host.querySelector(`#${id}`)!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
  await act(async () =>
    host
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
  );
  expect(mocks.createPersona).toHaveBeenCalledWith({
    displayName: 'Reader',
    handle: 'reader',
    bio: '',
  });
  expect(mocks.auth.refreshPersona).toHaveBeenCalled();
  mocks.auth.persona = { id: 'persona' };
  await render();
  expect(host.textContent).toContain('Account content');
});
test('loading and failures do not prompt users to create another persona', async () => {
  mocks.auth.isPersonaLoading = true;
  await render();
  expect(host.querySelector('form')).toBeNull();
  mocks.auth.isPersonaLoading = false;
  mocks.auth.personaError = 'Service unavailable';
  await render();
  expect(host.querySelector('[role="alert"]')?.textContent).toBe('Service unavailable');
  expect(host.querySelector('form')).toBeNull();
});

test('account errors offer a local sign-in recovery', async () => {
  mocks.auth.personaError = 'Your session could not be verified. Please sign in again.';
  mocks.signOut.mockResolvedValue({ error: null });
  await render();
  const button = Array.from(host.querySelectorAll('button')).find(
    (item) => item.textContent === 'Sign in again',
  );
  expect(button).toBeDefined();
  await act(async () => button!.click());
  expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
});
