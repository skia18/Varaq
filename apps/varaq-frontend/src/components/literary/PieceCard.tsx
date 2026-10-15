import type { LiteraryPiece } from '../../features/discovery/discovery.data';
import { Link } from 'react-router-dom';

type PieceCardProps = {
  piece: LiteraryPiece;
};

export function PieceCard({ piece }: PieceCardProps) {
  return (
    <article className="group flex h-full flex-col border-t border-ink/20 py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="text-xs tracking-widest text-oxide uppercase">
          {piece.type}
        </span>

        <span className="text-xs text-ink/50">
          {piece.readingTime} min read
        </span>
      </div>

      <Link
        to={`/p/${piece.slug}`}
        className="font-display text-3xl leading-tight transition-colors group-hover:text-oxide"
      >
        {piece.title}
      </Link>

      <p className="mt-4 flex-1 text-sm leading-7 text-ink/75">
        {piece.excerpt}
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {piece.themes.map((theme) => (
          <span
            key={theme}
            className="rounded-full border border-ink/15 px-3 py-1 text-xs text-ink/65"
          >
            {theme}
          </span>
        ))}
      </div>

      <div className="mt-6 border-t border-ink/10 pt-4">
        <Link
          to={`/u/${piece.handle}`}
          className="text-sm transition-colors hover:text-oxide"
        >
          {piece.author}
        </Link>
      </div>
    </article>
  );
}