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
