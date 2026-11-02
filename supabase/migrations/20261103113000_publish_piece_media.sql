ALTER TABLE public.pieces
  ADD COLUMN medium text NOT NULL DEFAULT 'writing',
  ADD COLUMN media_path text,
  ADD COLUMN media_mime_type text,
  ADD COLUMN media_byte_size bigint;

ALTER TABLE public.pieces ADD CONSTRAINT pieces_medium_check
  CHECK (medium IN ('writing','photography','artwork','audio'));
ALTER TABLE public.pieces ADD CONSTRAINT pieces_media_consistency CHECK (
  (medium='writing' AND media_path IS NULL AND media_mime_type IS NULL AND media_byte_size IS NULL)
  OR
  (medium<>'writing' AND media_path IS NOT NULL AND media_mime_type IS NOT NULL AND media_byte_size>0)
);

CREATE OR REPLACE FUNCTION public.can_publish_reserved_media(p_object_path text)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = '' STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.media_uploads AS m
    WHERE m.user_id=auth.uid()
      AND m.bucket_id='varaq-media-private'
      AND m.object_path=p_object_path
      AND m.status='ready'
  );
$$;
REVOKE ALL ON FUNCTION public.can_publish_reserved_media(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_publish_reserved_media(text) TO authenticated;

CREATE POLICY varaq_public_media_copy_insert ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id='varaq-media-public'
  AND public.can_publish_reserved_media(name)
);
