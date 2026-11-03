ALTER TABLE public.pieces
  ADD COLUMN cover_path text,
  ADD COLUMN cover_mime_type text,
  ADD COLUMN cover_byte_size bigint CHECK (cover_byte_size IS NULL OR cover_byte_size > 0);

-- Existing single-image pieces remain represented by the original media columns.
-- These columns hold an optional image when the primary media is audio.
