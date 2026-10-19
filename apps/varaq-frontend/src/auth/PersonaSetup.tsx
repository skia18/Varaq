import { useState, type FormEvent, type ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import { ApiError, createPersona } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AccountScene } from '@/layouts/AccountScene';
import { createClient } from '@/lib/supabase/client';
import { useNavigate } from 'react-router-dom';

export function PersonaGate({ children }: { children: ReactNode }) {
  const { user, persona, isLoading, isPersonaLoading, personaError, refreshPersona } = useAuth();
  if (isLoading || (user && isPersonaLoading)) {
    return (
      <p className="wall-status" role="status">
        Loading your account…
      </p>
    );
  }
  if (user && personaError) {
    return (
      <AccountScene>
        <AccountRecovery message={personaError} retry={refreshPersona} />
      </AccountScene>
    );
  }
  if (user && !persona)
    return (
      <AccountScene>
        <PersonaSetup key={user.id} />
      </AccountScene>
    );
  return children;
}

function AccountRecovery({ message, retry }: { message: string; retry: () => Promise<void> }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function signInAgain() {
    setBusy(true);
    setError('');
    try {
      const result = await createClient().auth.signOut({ scope: 'local' });
      if (result.error) throw result.error;
      navigate('/login', { replace: true });
    } catch {
      setError('Could not clear your session. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={1} className="font-medium text-lg tracking-normal">
          Let’s get you back in.
        </CardTitle>
        <CardDescription role="alert">{message}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button disabled={busy} onClick={() => void signInAgain()}>
          Sign in again
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => void retry()}>
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}

function PersonaSetup() {
  const { refreshPersona } = useAuth();
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await createPersona({
        handle: handle.trim(),
        displayName: displayName.trim(),
        bio: bio.trim(),
      });
      await refreshPersona();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'persona_already_exists') {
        await refreshPersona();
      } else {
        setError(
          err instanceof Error ? err.message : 'Could not create your persona. Please try again.',
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardDescription>Step 2 of 2 · Your persona</CardDescription>
          <CardTitle role="heading" aria-level={1} className="font-medium text-lg tracking-normal">
            Create your persona
          </CardTitle>
          <CardDescription>
            Choose the name people will see. A pen name is welcome. You don’t need to write anything
            to join.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-6">
            <div className="grid gap-2">
              <Label htmlFor="persona-display-name">Display name</Label>
              <Input
                id="persona-display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                maxLength={80}
                pattern=".*\S.*"
                disabled={busy}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="persona-handle">Handle</Label>
              <Input
                id="persona-handle"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                required
                pattern="[a-z0-9_]{3,30}"
                minLength={3}
                maxLength={30}
                aria-describedby="persona-handle-help"
                disabled={busy}
                autoCapitalize="none"
                spellCheck={false}
              />
              <p id="persona-handle-help" className="text-sm text-muted-foreground">
                3–30 lowercase letters, numbers, or underscores. This will be your public wall
                address.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="persona-bio">Bio (optional)</Label>
              <Input
                id="persona-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={500}
                disabled={busy}
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Creating persona…' : 'Create persona'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
