-- The reservation function already binds the object path to auth.uid(). Keep
-- INSERT focused on that authorization and permit Storage to return the newly
-- inserted owner-scoped row regardless of Storage API version behavior.
DROP POLICY IF EXISTS varaq_private_media_insert ON storage.objects;
CREATE POLICY varaq_private_media_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'varaq-media-private'
  AND public.can_upload_reserved_media(bucket_id, name, metadata)
);

DROP POLICY IF EXISTS varaq_private_media_owner_path_read ON storage.objects;
CREATE POLICY varaq_private_media_owner_path_read ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'varaq-media-private'
  AND (storage.foldername(name))[1] = (select auth.uid()::text)
);
