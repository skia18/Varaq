import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function UpdatePasswordForm({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  const [success, setSuccess] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const successRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (success) successRef.current?.focus();
  }, [success]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    const supabase = createClient();
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword('');
      setSuccess(true);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={1} className="font-medium text-lg tracking-normal">
            A fresh beginning.
          </CardTitle>
          <CardDescription>
            {success ? 'Your next chapter is ready.' : 'Please enter your new password below.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div role="status" ref={successRef} tabIndex={-1}>
            {success && (
              <p>
                Your password has been updated. <Link to="/login">Back to sign in</Link>
              </p>
            )}
          </div>
          {!success && (
            <form onSubmit={handleUpdatePassword}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="password">New password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="New password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                {error && (
                  <p role="alert" className="text-sm text-red-500">
                    {error}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Saving...' : 'Save new password'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
