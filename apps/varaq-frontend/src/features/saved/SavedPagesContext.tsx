import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type SavedPagesContextValue = {
  savedIds: string[];
  toggleSaved: (id: string) => void;
  isSaved: (id: string) => boolean;
};

const SavedPagesContext = createContext<SavedPagesContextValue | null>(null);

const STORAGE_KEY = 'varaq:saved-pages';

function readSavedIds(): string[] {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);

    if (!value) {
      return [];
    }

    const parsed: unknown = JSON.parse(value);

    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
      return [];
    }

    return [...new Set(parsed)];
  } catch {
    return [];
  }
}

function writeSavedIds(ids: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Saved pages remain usable in memory if storage is unavailable.
  }
}

export function SavedPagesProvider({ children }: { children: ReactNode }) {
  const [savedIds, setSavedIds] = useState<string[]>(readSavedIds);

  useEffect(() => {
    writeSavedIds(savedIds);
  }, [savedIds]);

  const toggleSaved = useCallback((id: string) => {
    setSavedIds((current) =>
      current.includes(id) ? current.filter((savedId) => savedId !== id) : [...current, id],
    );
  }, []);

  const isSaved = useCallback((id: string) => savedIds.includes(id), [savedIds]);

  const value = useMemo(
    () => ({ savedIds, toggleSaved, isSaved }),
    [savedIds, toggleSaved, isSaved],
  );

  return <SavedPagesContext.Provider value={value}>{children}</SavedPagesContext.Provider>;
}

export function useSavedPages() {
  const context = useContext(SavedPagesContext);

  if (!context) {
    throw new Error('SavedPagesProvider is required');
  }

  return context;
}
