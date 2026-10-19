-- Keep Vault storage outside Supabase's exposed schemas. All access is through Go.
REVOKE ALL ON public.personas, public.pieces FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated, service_role;
CREATE SCHEMA IF NOT EXISTS varaq_private;
REVOKE ALL ON SCHEMA varaq_private FROM PUBLIC, anon, authenticated, service_role;
CREATE TABLE varaq_private.vaults (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 config jsonb NOT NULL,
 revision integer NOT NULL DEFAULT 1 CHECK (revision > 0)
);
CREATE TABLE varaq_private.vault_drafts (
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES varaq_private.vaults(user_id) ON DELETE CASCADE,
 persona_id uuid NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,
 revision integer NOT NULL CHECK (revision > 0),
 envelope jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON varaq_private.vault_drafts(user_id, updated_at DESC, id);
-- Durable tombstones intentionally survive deletion of a published piece.
CREATE TABLE varaq_private.publication_operations (
 draft_id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 operation_id uuid NOT NULL,
 piece_id uuid NOT NULL,
 source_revision integer NOT NULL,
 fingerprint text NOT NULL,
 cleanup_pending boolean NOT NULL DEFAULT true,
 published_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id, operation_id)
);
ALTER TABLE varaq_private.vaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE varaq_private.vault_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE varaq_private.publication_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA varaq_private FROM PUBLIC, anon, authenticated, service_role;
-- A legacy source is retained until the browser authenticates the uploaded copy.
ALTER TABLE varaq_private.vault_drafts ADD COLUMN legacy_updated_at timestamptz;
