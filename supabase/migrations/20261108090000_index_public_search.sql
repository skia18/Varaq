-- Trigram indexes keep literal substring search responsive as public writing grows.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX pieces_public_search_trgm
  ON public.pieces
  USING gin (lower(title || ' ' || body) extensions.gin_trgm_ops)
  WHERE status = 'published' AND visibility = 'public';

CREATE INDEX personas_public_search_trgm
  ON public.personas
  USING gin (lower(handle || ' ' || display_name) extensions.gin_trgm_ops);
