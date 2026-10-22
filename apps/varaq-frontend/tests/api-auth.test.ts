import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { apiRequest } from '@/lib/api';
const mocks = vi.hoisted(() => ({ getSession: vi.fn(), refreshSession: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: mocks }) }));
const request = vi.fn();
beforeEach(() => {
  vi.stubGlobal('fetch', request);
  request.mockReset();
  mocks.getSession.mockResolvedValue({ data: { session: { access_token: 'old' } }, error: null });
  mocks.refreshSession.mockReset();
});
afterEach(() => vi.unstubAllGlobals());
const rejected = () =>
  new Response(
    JSON.stringify({
      error: { code: 'unauthorized', message: 'A valid access token is required.' },
    }),
    { status: 401 },
  );
test('retries a rejected authenticated request once with the refreshed token', async () => {
  const tokens: string[] = [];
  request.mockImplementation(async (_url, options) => {
    tokens.push(options.headers.get('Authorization'));
    return tokens.length === 1 ? rejected() : new Response(JSON.stringify({ id: 'persona' }));
  });
  mocks.refreshSession.mockResolvedValue({
    data: { session: { access_token: 'new' } },
    error: null,
  });
  expect(await apiRequest('/api/v1/me/persona')).toEqual({ id: 'persona' });
  expect(tokens).toEqual(['Bearer old', 'Bearer new']);
  expect(mocks.refreshSession).toHaveBeenCalledTimes(1);
});
test('persistent rejection stops after one refresh', async () => {
  request.mockImplementation(async () => rejected());
  mocks.refreshSession.mockResolvedValue({
    data: { session: { access_token: 'new' } },
    error: null,
  });
  await expect(apiRequest('/api/v1/me/persona')).rejects.toMatchObject({
    status: 401,
    code: 'unauthorized',
  });
  expect(request).toHaveBeenCalledTimes(2);
  expect(mocks.refreshSession).toHaveBeenCalledTimes(1);
});
test('failed refresh preserves the authentication error without retrying', async () => {
  request.mockImplementation(async () => rejected());
  mocks.refreshSession.mockResolvedValue({ data: { session: null }, error: new Error('expired') });
  await expect(apiRequest('/api/v1/me/persona')).rejects.toMatchObject({ status: 401 });
  expect(request).toHaveBeenCalledTimes(1);
});

test('concurrent authentication failures share one token refresh', async () => {
  request.mockImplementation(async (_url, options) =>
    options.headers.get('Authorization') === 'Bearer old'
      ? rejected()
      : new Response(JSON.stringify({ id: 'persona' })),
  );
  let finishRefresh!: (value: unknown) => void;
  mocks.refreshSession.mockImplementation(
    () =>
      new Promise((resolve) => {
        finishRefresh = resolve;
      }),
  );

  const first = apiRequest('/api/v1/me/persona');
  const second = apiRequest('/api/v1/me/persona');
  await vi.waitFor(() => expect(mocks.refreshSession).toHaveBeenCalledTimes(1));
  finishRefresh({ data: { session: { access_token: 'new' } }, error: null });

  await expect(Promise.all([first, second])).resolves.toEqual([
    { id: 'persona' },
    { id: 'persona' },
  ]);
  expect(mocks.refreshSession).toHaveBeenCalledTimes(1);
});
