-- During upload authorization Supabase exposes the declared byte count as
-- metadata.contentLength; metadata.size is populated only after completion.
DROP POLICY IF EXISTS varaq_private_media_insert ON storage.objects;
CREATE POLICY varaq_private_media_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id='varaq-media-private'
  AND (storage.foldername(name))[1]=(select auth.uid()::text)
  AND EXISTS(
    SELECT 1 FROM public.media_uploads m
    WHERE m.user_id=auth.uid()
      AND m.bucket_id=storage.objects.bucket_id
      AND m.object_path=storage.objects.name
      AND m.status='reserved'
      AND m.expires_at>now()
      AND m.byte_size=(storage.objects.metadata->>'contentLength')::bigint
      AND m.mime_type=storage.objects.metadata->>'mimetype'
  )
);
