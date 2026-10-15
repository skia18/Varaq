import { useMemo, useState } from 'react';
import { PieceCard } from '../../components/literary/PieceCard';
import {
  discoveryPieces,
  discoveryThemes,
  pieceTypes,
  type PieceType,
} from '../../features/discovery/discovery.data';
import { DiscoveryFilters } from '../../features/discovery/DiscoveryFilters';

export function DiscoverPage() {
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | PieceType>('all');
  const [selectedTheme, setSelectedTheme] = useState('');

  const filteredPieces = useMemo(() => {
    const query = search.trim().toLowerCase();

    return discoveryPieces.filter((piece) => {
      const matchesSearch =
        !query ||
        [
          piece.title,
          piece.excerpt,
          piece.author,
          piece.type,
          ...piece.themes,
        ].some((value) => value.toLowerCase().includes(query));

      const matchesType =
        selectedType === 'all' || piece.type === selectedType;

      const matchesTheme =
        !selectedTheme || piece.themes.includes(selectedTheme);

      return matchesSearch && matchesType && matchesTheme;
    });
  }, [search, selectedType, selectedTheme]);

  function clearFilters() {
    setSearch('');
    setSelectedType('all');
    setSelectedTheme('');
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-12 md:py-20">
      <header className="max-w-3xl">
        <p className="mb-4 text-xs tracking-[0.25em] text-oxide uppercase">
          The open pages
        </p>

        <h1 className="font-display text-6xl leading-none md:text-8xl">
          Discover
        </h1>

        <p className="mt-6 max-w-xl text-base leading-8 text-ink/65 md:text-lg">
          Wander through the words people leave behind. Find a thought that
          feels like yours, written by someone you have never met.
        </p>
      </header>

      <div className="mt-14 grid gap-12 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside>
          <DiscoveryFilters
            search={search}
            selectedType={selectedType}
            selectedTheme={selectedTheme}
            onSearchChange={setSearch}
            onTypeChange={setSelectedType}
            onThemeChange={setSelectedTheme}
            pieceTypes={pieceTypes}
            themes={discoveryThemes}
          />
        </aside>

        <section>
          <div className="mb-6 flex items-center justify-between border-b border-ink/15 pb-4">
            <p className="text-sm text-ink/60">
              {filteredPieces.length}{' '}
              {filteredPieces.length === 1 ? 'page' : 'pages'} found
            </p>

            {(search || selectedType !== 'all' || selectedTheme) && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-sm text-oxide underline underline-offset-4"
              >
                Clear filters
              </button>
            )}
          </div>

          {filteredPieces.length > 0 ? (
            <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {filteredPieces.map((piece) => (
                <PieceCard key={piece.id} piece={piece} />
              ))}
            </div>
          ) : (
            <div className="py-16">
              <h2 className="font-display text-3xl">
                No pages found, just yet.
              </h2>
              <p className="mt-3 text-sm text-ink/60">
                Try another word or let go of a filter.
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-5 text-sm text-oxide underline underline-offset-4"
              >
                Start again
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}