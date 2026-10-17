import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Feather, RefreshCw, Sparkles } from 'lucide-react';

import { useAuth } from '@/auth/AuthProvider';

export function ProfilePage() {
  const { user, persona, isLoading, isPersonaLoading, personaError, refreshPersona } = useAuth();

  if (isLoading || isPersonaLoading) {
    return (
      <section className="page-section">
        <p className="eyebrow">Your wall</p>
        <h1 className="font-heading text-4xl">A moment, please.</h1>
        <p className="mt-4 text-muted-foreground">Gathering your pages…</p>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="page-section">
        <p className="eyebrow">Your wall</p>
        <h1 className="font-heading text-4xl">A place for your words.</h1>
        <p className="mt-4 text-muted-foreground">Sign in to visit your personal wall.</p>
        <Link to="/login" className="literary-button mt-6 inline-flex items-center gap-2">
          Sign in <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </section>
    );
  }

  if (personaError || !persona) {
    return (
      <section className="page-section">
        <p className="eyebrow">Your wall</p>
        <h1 className="font-heading text-4xl">Your page is waiting.</h1>
        <p className="mt-4 text-muted-foreground">
          {personaError
            ? 'We could not load your persona. Please try again.'
            : 'Your writing identity has not been set up yet.'}
        </p>

        {personaError && (
          <button
            type="button"
            className="literary-button mt-6 inline-flex items-center gap-2"
            onClick={() => void refreshPersona()}
          >
            <RefreshCw size={16} aria-hidden="true" />
            Try again
          </button>
        )}
      </section>
    );
  }

  const joinedDate = new Intl.DateTimeFormat('en', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(persona.createdAt));

  return (
    <main className="page-section">
      <header className="mb-10">
        <p className="eyebrow">A little corner of the commons</p>
        <h1 className="font-heading text-4xl md:text-5xl">Your wall</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          A place to leave pieces of yourself, one page at a time.
        </p>
      </header>

      <section
        aria-labelledby="profile-name"
        className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 md:p-10"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-12 h-48 w-48 rounded-full border border-border/70"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-2 -top-4 h-32 w-32 rounded-full border border-border/70"
        />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start">
          <div
            aria-hidden="true"
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-border bg-muted"
          >
            <Feather className="h-8 w-8 text-oxide" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="eyebrow">The writer behind the words</p>

            <h2 id="profile-name" className="mt-2 font-heading text-3xl md:text-4xl">
              {persona.displayName}
            </h2>

            <p className="mt-2 text-sm text-oxide">@{persona.handle}</p>

            <p className="mt-5 max-w-2xl whitespace-pre-wrap font-serif text-lg leading-relaxed text-muted-foreground">
              {persona.bio || 'Still finding the words.'}
            </p>

            <p className="mt-5 text-xs text-muted-foreground">A wall since {joinedDate}</p>
          </div>
        </div>
      </section>

      <section className="mt-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Collected thoughts</p>
            <h2 className="mt-2 font-heading text-3xl">Your pages</h2>
          </div>

          <span className="text-sm text-muted-foreground">A work in progress</span>
        </div>

        <div className="mt-6 rounded-2xl border border-dashed border-border px-6 py-12 text-center md:px-12 md:py-16">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <BookOpen className="h-6 w-6 text-oxide" aria-hidden="true" />
          </div>

          <h3 className="mt-5 font-heading text-2xl">Every wall begins with a blank page.</h3>

          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            Your published poems, fragments, letters, stories, and essays will find their home here.
            For now, there is room for what comes next.
          </p>

          <Link to="/discover" className="literary-button mt-7 inline-flex items-center gap-2">
            <Sparkles size={16} aria-hidden="true" />
            Explore the commons
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <footer className="mt-12 border-t border-border pt-6">
        <p className="font-serif text-sm italic text-muted-foreground">
          Some things are better left on a page.
        </p>
      </footer>
    </main>
  );
}
