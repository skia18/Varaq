import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { ApiError, getMyPersona, type Persona } from '@/lib/api';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  persona: Persona | null;
  isLoading: boolean;
  isPersonaLoading: boolean;
  personaError: string | null;
  refreshPersona: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [isPersonaLoading, setIsPersonaLoading] = useState(false);
  const [personaError, setPersonaError] = useState<string | null>(null);

  async function refreshPersona() {
    const {
      data: { session: currentSession },
    } = await createClient().auth.getSession();

    if (!currentSession) {
      setPersona(null);
      setPersonaError(null);
      setIsPersonaLoading(false);
      return;
    }

    setIsPersonaLoading(true);
    setPersonaError(null);

    try {
      const result = await getMyPersona();
      setPersona(result);
    } catch (error) {
      setPersona(null);
      setPersonaError(
        error instanceof ApiError && error.status === 404 && error.code === 'persona_not_found'
          ? null
          : error instanceof Error
            ? error.message
            : 'Could not load your persona.',
      );
    } finally {
      setIsPersonaLoading(false);
    }
  }

  useEffect(() => {
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) setIsPersonaLoading(true);
      setIsLoading(false);

      if (!nextSession) {
        setPersona(null);
        setPersonaError(null);
        setIsPersonaLoading(false);
      } else {
        // Defer the API call until after the auth callback finishes.
        queueMicrotask(() => {
          void refreshPersona();
        });
      }
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      const initialSession = error ? null : data.session;

      setSession(initialSession);
      if (initialSession) setIsPersonaLoading(true);
      setIsLoading(false);

      if (initialSession) {
        void refreshPersona();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    const { error } = await createClient().auth.signOut();
    if (error) throw error;

    setPersona(null);
    setPersonaError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        persona,
        isLoading,
        isPersonaLoading,
        personaError,
        refreshPersona,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
