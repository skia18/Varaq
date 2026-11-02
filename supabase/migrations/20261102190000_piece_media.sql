-- Piece media is uploaded directly to Storage after an atomic quota reservation.
-- Draft objects remain private; publication will copy them to the public bucket.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('varaq-media-private', 'varaq-media-private', false, 26214400,
   ARRAY['image/jpeg','image/png','image/webp','audio/mpeg','audio/wav','audio/mp4']),
  ('varaq-media-public', 'varaq-media-public', true, 26214400,
   ARRAY['image/jpeg','image/png','image/webp','audio/mpeg','audio/wav','audio/mp4'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE TABLE public.media_usage (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  used_bytes bigint NOT NULL DEFAULT 0 CHECK (used_bytes >= 0),
  reserved_bytes bigint NOT NULL DEFAULT 0 CHECK (reserved_bytes >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.media_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  piece_id uuid NOT NULL,
  bucket_id text NOT NULL DEFAULT 'varaq-media-private' CHECK (bucket_id IN ('varaq-media-private','varaq-media-public')),
  object_path text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('photography','artwork','audio','audio-cover')),
  byte_size bigint NOT NULL CHECK (byte_size > 0),
  mime_type text NOT NULL,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','ready','published')),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '1 hour',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX media_uploads_owner ON public.media_uploads(user_id, status);
CREATE INDEX media_uploads_piece ON public.media_uploads(piece_id);

ALTER TABLE public.media_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY media_usage_owner_read ON public.media_usage
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY media_uploads_owner_read ON public.media_uploads
  FOR SELECT TO authenticated USING (user_id = auth.uid());

REVOKE ALL ON public.media_usage, public.media_uploads FROM anon, authenticated;
GRANT SELECT ON public.media_usage, public.media_uploads TO authenticated;

CREATE OR REPLACE FUNCTION public.reserve_media_upload(
  p_piece_id uuid,
  p_kind text,
  p_byte_size bigint,
  p_mime_type text,
  p_extension text
) RETURNS TABLE(upload_id uuid, object_path text, used_bytes bigint, reserved_bytes bigint, quota_bytes bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_id uuid := gen_random_uuid();
  v_path text;
  v_usage public.media_usage%ROWTYPE;
  v_quota constant bigint := 262144000; -- 250 MiB
  v_limit bigint;
  v_allowed text[];
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_kind NOT IN ('photography','artwork','audio','audio-cover') THEN RAISE EXCEPTION 'Unsupported media kind'; END IF;
  v_limit := CASE WHEN p_kind = 'audio' THEN 26214400 WHEN p_kind = 'audio-cover' THEN 5242880 ELSE 10485760 END;
  v_allowed := CASE WHEN p_kind = 'audio' THEN ARRAY['audio/mpeg','audio/wav','audio/mp4'] ELSE ARRAY['image/jpeg','image/png','image/webp'] END;
  IF p_byte_size < 1 OR p_byte_size > v_limit THEN RAISE EXCEPTION 'File exceeds the allowed size'; END IF;
  IF NOT (p_mime_type = ANY(v_allowed)) THEN RAISE EXCEPTION 'Unsupported file type'; END IF;
  IF p_extension !~ '^[a-z0-9]{2,5}$' THEN RAISE EXCEPTION 'Invalid file extension'; END IF;

  INSERT INTO public.media_usage(user_id) VALUES(v_user) ON CONFLICT DO NOTHING;
  SELECT * INTO v_usage FROM public.media_usage WHERE user_id=v_user FOR UPDATE;
  IF v_usage.used_bytes + v_usage.reserved_bytes + p_byte_size > v_quota THEN
    RAISE EXCEPTION 'Media storage quota exceeded';
  END IF;
  v_path := v_user::text || '/' || p_piece_id::text || '/' || v_id::text || '.' || lower(p_extension);
  INSERT INTO public.media_uploads(id,user_id,piece_id,object_path,kind,byte_size,mime_type)
  VALUES(v_id,v_user,p_piece_id,v_path,p_kind,p_byte_size,p_mime_type);
  UPDATE public.media_usage SET reserved_bytes=reserved_bytes+p_byte_size,updated_at=now() WHERE user_id=v_user;
  RETURN QUERY SELECT v_id,v_path,v_usage.used_bytes,v_usage.reserved_bytes+p_byte_size,v_quota;
END $$;

CREATE OR REPLACE FUNCTION public.finalize_media_upload(p_upload_id uuid)
RETURNS TABLE(upload_id uuid, object_path text, used_bytes bigint, reserved_bytes bigint, quota_bytes bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_upload public.media_uploads%ROWTYPE;
  v_usage public.media_usage%ROWTYPE;
  v_actual bigint;
  v_quota constant bigint := 262144000;
BEGIN
  SELECT * INTO v_upload FROM public.media_uploads WHERE id=p_upload_id AND user_id=v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Upload reservation not found'; END IF;
  IF v_upload.status = 'ready' THEN
    SELECT * INTO v_usage FROM public.media_usage WHERE user_id=v_user;
    RETURN QUERY SELECT v_upload.id,v_upload.object_path,v_usage.used_bytes,v_usage.reserved_bytes,v_quota;
    RETURN;
  END IF;
  SELECT (metadata->>'size')::bigint INTO v_actual FROM storage.objects
   WHERE bucket_id=v_upload.bucket_id AND name=v_upload.object_path;
  IF v_actual IS NULL OR v_actual <> v_upload.byte_size THEN RAISE EXCEPTION 'Uploaded object does not match its reservation'; END IF;
  UPDATE public.media_uploads SET status='ready',expires_at='infinity',updated_at=now() WHERE id=v_upload.id;
  UPDATE public.media_usage SET reserved_bytes=reserved_bytes-v_upload.byte_size,used_bytes=used_bytes+v_upload.byte_size,updated_at=now()
   WHERE user_id=v_user RETURNING * INTO v_usage;
  RETURN QUERY SELECT v_upload.id,v_upload.object_path,v_usage.used_bytes,v_usage.reserved_bytes,v_quota;
END $$;

CREATE OR REPLACE FUNCTION public.release_media_upload(p_upload_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_upload public.media_uploads%ROWTYPE;
BEGIN
  SELECT * INTO v_upload FROM public.media_uploads WHERE id=p_upload_id AND user_id=v_user FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE public.media_usage SET
    reserved_bytes=reserved_bytes-CASE WHEN v_upload.status='reserved' THEN v_upload.byte_size ELSE 0 END,
    used_bytes=used_bytes-CASE WHEN v_upload.status IN ('ready','published') THEN v_upload.byte_size ELSE 0 END,
    updated_at=now()
  WHERE user_id=v_user;
  DELETE FROM public.media_uploads WHERE id=v_upload.id;
END $$;

CREATE OR REPLACE FUNCTION public.get_media_usage()
RETURNS TABLE(used_bytes bigint, reserved_bytes bigint, quota_bytes bigint)
LANGUAGE sql SECURITY DEFINER SET search_path = '' STABLE AS $$
  SELECT coalesce(u.used_bytes,0),coalesce(u.reserved_bytes,0),262144000::bigint
  FROM (SELECT auth.uid() AS user_id) me
  LEFT JOIN public.media_usage u ON u.user_id=me.user_id;
$$;

REVOKE ALL ON FUNCTION public.reserve_media_upload(uuid,text,bigint,text,text), public.finalize_media_upload(uuid), public.release_media_upload(uuid), public.get_media_usage() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_media_upload(uuid,text,bigint,text,text), public.finalize_media_upload(uuid), public.release_media_upload(uuid), public.get_media_usage() TO authenticated;

CREATE POLICY varaq_private_media_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id='varaq-media-private'
  AND (storage.foldername(name))[1]=(select auth.uid()::text)
  AND EXISTS(
    SELECT 1 FROM public.media_uploads m
    WHERE m.user_id=auth.uid() AND m.bucket_id=storage.objects.bucket_id AND m.object_path=storage.objects.name
      AND m.status='reserved' AND m.expires_at>now()
      AND m.byte_size=(metadata->>'size')::bigint AND m.mime_type=(metadata->>'mimetype')
  )
);
CREATE POLICY varaq_private_media_read ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id='varaq-media-private' AND owner_id=(select auth.uid()::text)
);
CREATE POLICY varaq_private_media_delete ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id='varaq-media-private' AND owner_id=(select auth.uid()::text)
);
