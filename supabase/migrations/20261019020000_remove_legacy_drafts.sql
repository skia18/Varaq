-- Refuse cleanup if any user's migration is incomplete; never delete writing.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.pieces WHERE status = 'draft') THEN
    RAISE EXCEPTION 'Plaintext drafts still exist; finish moving them before cleanup';
  END IF;
  IF EXISTS (SELECT 1 FROM varaq_private.vault_drafts WHERE legacy_updated_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Unfinished draft imports still exist; reconcile them before cleanup';
  END IF;
END $$;
ALTER TABLE varaq_private.vault_drafts DROP COLUMN legacy_updated_at;
-- Drafts now live exclusively in the encrypted Vault.
ALTER TABLE public.pieces ADD CONSTRAINT pieces_published_only CHECK (status = 'published');
ALTER TABLE public.pieces ALTER COLUMN status SET DEFAULT 'published';
