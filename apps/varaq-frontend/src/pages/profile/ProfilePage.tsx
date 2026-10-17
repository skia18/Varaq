import { useAuth } from '@/auth/AuthProvider';

export function ProfilePage() {
  const { user } = useAuth();

  return (
    <section className="page-section">
      <p className="eyebrow">Your wall</p>
      <h1 className="font-heading text-4xl">Your profile</h1>
      <p className="mt-4 text-muted-foreground">{user?.email}</p>
    </section>
  );
}
