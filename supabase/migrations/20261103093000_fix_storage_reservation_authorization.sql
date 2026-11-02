-- Storage policies execute as the authenticated caller. Resolve the matching
-- application reservation through a narrowly scoped definer function so the
-- storage.objects policy does not depend on nested RLS evaluation.
CREATE OR REPLACE FUNCTION public.can_upload_reserved_media(
  p_bucket_id text,
  p_object_path text,
  p_metadata jsonb
) RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.media_uploads AS m
    WHERE m.user_id = auth.uid()
      AND m.bucket_id = p_bucket_id
      AND m.object_path = p_object_path
      AND m.status = 'reserved'
      AND m.expires_at > now()
      -- Supabase versions expose the incoming length as contentLength or size.
      -- If it is not exposed until completion, finalize_media_upload performs
      -- the authoritative comparison against the stored object.
      AND m.byte_size = COALESCE(
        NULLIF(p_metadata->>'contentLength', '')::bigint,
        NULLIF(p_metadata->>'size', '')::bigint,
        m.byte_size
      )
      AND m.mime_type = COALESCE(NULLIF(p_metadata->>'mimetype', ''), m.mime_type)
  );
$$;

REVOKE ALL ON FUNCTION public.can_upload_reserved_media(text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_upload_reserved_media(text,text,jsonb) TO authenticated;

DROP POLICY IF EXISTS varaq_private_media_insert ON storage.objects;
CREATE POLICY varaq_private_media_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'varaq-media-private'
  AND (storage.foldername(name))[1] = (select auth.uid()::text)
  AND public.can_upload_reserved_media(bucket_id, name, metadata)
);
