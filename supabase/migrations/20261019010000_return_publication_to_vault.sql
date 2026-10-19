-- Stage only ciphertext; retain a content-free receipt after the atomic move.
CREATE TABLE varaq_private.vault_returns (
 source_piece_id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 draft_id uuid NOT NULL UNIQUE,
 persona_id uuid NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,
 source_updated_at timestamptz NOT NULL,
 envelope jsonb,
 completed boolean NOT NULL DEFAULT false,
 CHECK ((completed AND envelope IS NULL) OR (NOT completed AND envelope IS NOT NULL))
);
ALTER TABLE varaq_private.vault_returns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON varaq_private.vault_returns FROM PUBLIC, anon, authenticated, service_role;
