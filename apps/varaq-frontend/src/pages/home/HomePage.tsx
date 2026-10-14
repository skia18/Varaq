export function HomePage() {
  return (
    <section className="mx-auto flex min-h-[80vh] max-w-7xl flex-col justify-center px-6 py-20">
      <p className="mb-6 text-sm tracking-[0.25em] text-oxide uppercase">
        A home for words
      </p>

      <h1 className="max-w-4xl font-display text-6xl leading-[1.05] font-medium md:text-8xl">
        Leave a page of yourself behind.
      </h1>

      <p className="mt-8 max-w-xl text-lg leading-relaxed text-ink/70">
        A quiet corner of the internet for poems, fragments, letters, and
        everything that deserves to be written down.
      </p>
    </section>
  );
}