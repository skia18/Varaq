import type { PieceType } from './discovery.data';

type DiscoveryFiltersProps = {
  search: string;
  selectedType: 'all' | PieceType;
  selectedTheme: string;
  onSearchChange: (value: string) => void;
  onTypeChange: (value: 'all' | PieceType) => void;
  onThemeChange: (value: string) => void;
  pieceTypes: Array<'all' | PieceType>;
  themes: string[];
};

export function DiscoveryFilters({
  search,
  selectedType,
  selectedTheme,
  onSearchChange,
  onTypeChange,
  onThemeChange,
  pieceTypes,
  themes,
}: DiscoveryFiltersProps) {
  return (
    <section className="space-y-6">
      <label className="block">
        <span className="mb-2 block text-sm text-ink/65">
          Search the pages
        </span>

        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="A title, a feeling, a word..."
          className="w-full border-b border-ink/30 bg-transparent px-0 py-3 text-base outline-none placeholder:text-ink/40 focus:border-oxide"
        />
      </label>

      <div>
        <p className="mb-3 text-sm text-ink/65">Form</p>

        <div className="flex flex-wrap gap-2">
          {pieceTypes.map((type) => {
            const active = selectedType === type;

            return (
              <button
                key={type}
                type="button"
                onClick={() => onTypeChange(type)}
                aria-pressed={active}
                className={`rounded-full border px-4 py-2 text-sm capitalize transition-colors ${
                  active
                    ? 'border-ink bg-ink text-paper'
                    : 'border-ink/20 hover:border-oxide hover:text-oxide'
                }`}
              >
                {type}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-3 text-sm text-ink/65">Themes</p>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onThemeChange('')}
            aria-pressed={!selectedTheme}
            className={`text-sm underline-offset-4 ${
              !selectedTheme
                ? 'text-oxide underline'
                : 'text-ink/60 hover:text-oxide'
            }`}
          >
            All themes
          </button>

          {themes.map((theme) => (
            <button
              key={theme}
              type="button"
              onClick={() =>
                onThemeChange(selectedTheme === theme ? '' : theme)
              }
              aria-pressed={selectedTheme === theme}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                selectedTheme === theme
                  ? 'bg-sage/25 text-ink'
                  : 'text-ink/60 hover:bg-sage/15 hover:text-ink'
              }`}
            >
              {theme}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}