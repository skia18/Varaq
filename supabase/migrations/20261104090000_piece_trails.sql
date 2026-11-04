-- A response remains an independent published piece while pointing to one source.
-- Vault drafts are deliberately excluded: only public.pieces can participate.
CREATE TABLE public.piece_trails (
  response_id uuid PRIMARY KEY REFERENCES public.pieces(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES public.pieces(id) ON DELETE CASCADE,
  relation text NOT NULL CHECK (relation IN ('inspired-by', 'continues')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT piece_trails_not_self CHECK (response_id <> source_id)
);

CREATE INDEX piece_trails_source_created
  ON public.piece_trails(source_id, created_at, response_id);

REVOKE ALL ON public.piece_trails FROM anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.piece_trails TO postgres;
