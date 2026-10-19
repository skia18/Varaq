-- Fail rather than delete or reassign identities if existing accounts have duplicates.
-- Resolve any duplicates explicitly before retrying this migration.
ALTER TABLE public.personas
  ADD CONSTRAINT personas_user_id_key UNIQUE (user_id);
