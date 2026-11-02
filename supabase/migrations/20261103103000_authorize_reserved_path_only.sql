-- Storage's INSERT-time metadata differs across upload implementations.
-- Authorize the immutable reserved path here; bucket constraints validate MIME
-- and maximum size, while finalize_media_upload verifies the actual byte count.
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
  );
$$;
