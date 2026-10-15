import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-24">
      <p className="font-display text-5xl">This page is missing.</p>
      <Link to="/" className="mt-6 inline-block text-oxide underline">
        Return to Varaq
      </Link>
    </section>
  );
}
