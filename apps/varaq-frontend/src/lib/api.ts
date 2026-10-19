import { createClient } from '@/lib/supabase/client';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(
  /\/+$/,
  '',
);

export type Persona = {
  id: string;
  handle: string;
  displayName: string;
  bio: string | null;
  createdAt: string;
};

export type PieceType = 'poem' | 'fragment' | 'story' | 'letter' | 'essay';

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const supabase = createClient();
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error('Could not retrieve your session.');
  }

  const headers = new Headers(options.headers);

  headers.set('Accept', 'application/json');

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  let response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  // Authentication middleware rejects these requests before a handler can mutate data.
  if (response.status === 401 && session?.access_token) {
    const refreshed = await supabase.auth.refreshSession();
    if (!refreshed.error && refreshed.data.session) {
      headers.set('Authorization', `Bearer ${refreshed.data.session.access_token}`);
      response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
    }
  }

  if (!response.ok) {
    const body = await response.text();
    let message = body || `API request failed with status ${response.status}`;
    let code: string | undefined;
    try {
      const payload = JSON.parse(body);
      if (typeof payload.error?.message === 'string') message = payload.error.message;
      if (typeof payload.error?.code === 'string') code = payload.error.code;
    } catch {
      // Non-JSON errors still carry their HTTP status and response text.
    }
    throw new ApiError(message, response.status, code);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function getMyPersona() {
  return apiRequest<Persona>('/api/v1/me/persona');
}

export function createPersona(input: { handle: string; displayName: string; bio?: string }) {
  return apiRequest<Persona>('/api/v1/personas', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export type Piece = {
  id: string;
  personaId: string;
  slug: string;
  title: string;
  body: string;
  type: PieceType;
  status: 'published';
  visibility: 'public' | 'unlisted' | 'private';
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PiecePage = {
  items: Piece[];
  nextCursor: string | null;
};

export async function getPublicPieces(
  handle: string,
  options: {
    limit?: number;
    cursor?: string | null;
  } = {},
): Promise<PiecePage> {
  const params = new URLSearchParams();

  params.set('limit', String(options.limit ?? 20));

  if (options.cursor) {
    params.set('cursor', options.cursor);
  }

  return apiRequest<PiecePage>(
    `/api/v1/personas/${encodeURIComponent(handle)}/pieces?${params.toString()}`,
  );
}

export async function getOwnerPieces(
  options: {
    limit?: number;
    status?: 'published';
    personaId?: string;
    cursor?: string;
  } = {},
): Promise<PiecePage> {
  const params = new URLSearchParams();
  params.set('limit', String(options.limit ?? 20));

  if (options.status) params.set('status', options.status);
  if (options.personaId) params.set('personaId', options.personaId);
  if (options.cursor) params.set('cursor', options.cursor);
  return apiRequest<PiecePage>(`/api/v1/owner/pieces?${params.toString()}`);
}

export async function getOwnerPiece(pieceId: string): Promise<Piece> {
  return apiRequest<Piece>(`/api/v1/owner/pieces/${encodeURIComponent(pieceId)}`);
}

export type UpdatePieceInput = {
  title: string;
  body: string;
  type: PieceType;
};

export async function updateOwnerPiece(pieceId: string, input: UpdatePieceInput): Promise<Piece> {
  return apiRequest<Piece>(`/api/v1/owner/pieces/${encodeURIComponent(pieceId)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deleteOwnerPiece(pieceId: string): Promise<void> {
  return apiRequest<void>(`/api/v1/owner/pieces/${encodeURIComponent(pieceId)}`, {
    method: 'DELETE',
  });
}

export function getPublicPersona(handle: string): Promise<Persona> {
  return apiRequest<Persona>(`/api/v1/personas/${encodeURIComponent(handle)}`);
}

export type FeedPiece = Piece & { author: string; handle: string };
export type FeedPage = { items: FeedPiece[]; nextCursor: string | null };
export function getFeed(
  options: {
    limit?: number;
    cursor?: string | null;
    type?: PieceType;
    query?: string;
    ids?: string[];
    signal?: AbortSignal;
  } = {},
): Promise<FeedPage> {
  const params = new URLSearchParams({ limit: String(options.limit ?? 10) });
  if (options.cursor) params.set('cursor', options.cursor);
  if (options.type) params.set('type', options.type);
  if (options.query) params.set('q', options.query);
  if (options.ids?.length) params.set('ids', options.ids.join(','));
  return apiRequest<FeedPage>(`/api/v1/feed?${params}`, { signal: options.signal });
}

export type PersonaPage = { items: Persona[]; nextCursor: string | null };
export type PublicCollectionSummary = {
  id: string;
  name: string;
  description: string;
  pieceCount: number;
  createdAt: string;
};
export type PublicCollectionPage = { items: PublicCollectionSummary[]; nextCursor: string | null };
export function searchPersonas(
  query: string,
  options: { cursor?: string | null; limit?: number; signal?: AbortSignal } = {},
) {
  const params = new URLSearchParams({ q: query, limit: String(options.limit ?? 20) });
  if (options.cursor) params.set('cursor', options.cursor);
  return apiRequest<PersonaPage>(`/api/v1/personas?${params}`, { signal: options.signal });
}
export function getPersonaCollections(
  handle: string,
  options: { cursor?: string | null; signal?: AbortSignal } = {},
) {
  const params = new URLSearchParams({ limit: '20' });
  if (options.cursor) params.set('cursor', options.cursor);
  return apiRequest<PublicCollectionPage>(
    `/api/v1/personas/${encodeURIComponent(handle)}/collections?${params}`,
    { signal: options.signal },
  );
}
