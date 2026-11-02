CREATE OR REPLACE FUNCTION public.can_return_published_media(p_object_path text)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = '' STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.media_uploads AS m
    WHERE m.user_id=auth.uid()
      AND m.bucket_id='varaq-media-public'
      AND m.object_path=p_object_path
      AND m.status='published'
  );
$$;
REVOKE ALL ON FUNCTION public.can_return_published_media(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_return_published_media(text) TO authenticated;

DROP POLICY IF EXISTS varaq_private_media_insert ON storage.objects;
CREATE POLICY varaq_private_media_insert ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id='varaq-media-private'
  AND (
    public.can_upload_reserved_media(bucket_id,name,metadata)
    OR public.can_return_published_media(name)
  )
);

CREATE POLICY varaq_public_media_owner_select ON storage.objects
FOR SELECT TO authenticated USING (
  bucket_id='varaq-media-public' AND owner_id=(select auth.uid()::text)
);
CREATE POLICY varaq_public_media_owner_delete ON storage.objects
FOR DELETE TO authenticated USING (
  bucket_id='varaq-media-public' AND owner_id=(select auth.uid()::text)
);
