import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { type Persona, apiRequest } from '@/lib/api';

export type Collection = {
  curator?: Persona;
  id: string;
  name: string;
  description: string;
  systemType: 'saved' | null;
  visibility: 'private' | 'public';
  pieceIds: string[];
  createdAt: string;
  updatedAt: string;
};
export type CollectionInput = {
  name: string;
  description: string;
  visibility: 'private' | 'public';
  pieceId?: string;
};
const base = '/api/v1/collections';
function useCollectionsState() {
  const { user } = useAuth();
  const userId = user?.id;
  const currentUser = useRef(userId);
  currentUser.current = userId;
  const [state, setState] = useState<{ userId?: string; items: Collection[] }>({ items: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const collections = state.userId === userId ? state.items : [];
  const refresh = useCallback(async () => {
    if (!userId) return;
    const items = await apiRequest<Collection[]>(base);
    if (currentUser.current === userId) {
      setState({ userId, items });
      setError('');
    }
  }, [userId]);
  useEffect(() => {
    let active = true;
    setError('');
    if (!userId) {
      setState({ items: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    void refresh()
      .catch(() => {
        if (active) setError('Could not load collections. Please try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId, refresh]);
  async function membership(collectionId: string, pieceId: string, add: boolean) {
    await apiRequest(`${base}/${collectionId}/pieces/${pieceId}`, {
      method: add ? 'PUT' : 'DELETE',
    });
    if (currentUser.current === userId)
      setState((previous) => ({
        ...previous,
        items: previous.items.map((c) =>
          c.id === collectionId
            ? {
                ...c,
                pieceIds: add
                  ? [...new Set([...c.pieceIds, pieceId])]
                  : c.pieceIds.filter((id) => id !== pieceId),
              }
            : c,
        ),
      }));
  }
  async function create(input: CollectionInput) {
    const collection = await apiRequest<Collection>(base, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (currentUser.current === userId)
      setState((previous) => ({ userId, items: [...previous.items, collection] }));
    return collection;
  }
  async function update(id: string, input: CollectionInput) {
    await apiRequest(`${base}/${id}`, { method: 'PUT', body: JSON.stringify(input) });
    await refresh();
  }
  async function remove(id: string) {
    await apiRequest(`${base}/${id}`, { method: 'DELETE' });
    await refresh();
  }
  return { collections, loading, error, refresh, membership, create, update, remove };
}
const Context = createContext<ReturnType<typeof useCollectionsState> | null>(null);
export function CollectionsProvider({ children }: { children: ReactNode }) {
  const value = useCollectionsState();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useCollections() {
  const context = useContext(Context);
  if (!context) throw new Error('CollectionsProvider is required');
  return context;
}
