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

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `API request failed with status ${response.status}`);
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
  status: 'draft' | 'published';
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

export type CreatePieceInput = {
  personaId: string;
  title: string;
  body: string;
  type: PieceType;
  visibility: 'private' | 'unlisted' | 'public';
};

export async function createPiece(input: CreatePieceInput): Promise<Piece> {
  return apiRequest<Piece>('/api/v1/pieces', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getOwnerPieces(options: { limit?: number } = {}): Promise<PiecePage> {
  const params = new URLSearchParams();
  params.set('limit', String(options.limit ?? 20));

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

export async function publishOwnerPiece(pieceId: string): Promise<Piece> {
  return apiRequest<Piece>(`/api/v1/owner/pieces/${encodeURIComponent(pieceId)}/publish`, {
    method: 'POST',
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
