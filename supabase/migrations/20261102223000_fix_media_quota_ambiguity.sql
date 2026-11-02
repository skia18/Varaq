-- Output column names in these table-returning functions are PL/pgSQL variables.
-- Qualify quota ledger columns so PostgreSQL cannot confuse the two.
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
  v_quota constant bigint := 262144000;
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
  SELECT u.* INTO v_usage FROM public.media_usage AS u WHERE u.user_id=v_user FOR UPDATE;
  IF v_usage.used_bytes + v_usage.reserved_bytes + p_byte_size > v_quota THEN
    RAISE EXCEPTION 'Media storage quota exceeded';
  END IF;
  v_path := v_user::text || '/' || p_piece_id::text || '/' || v_id::text || '.' || lower(p_extension);
  INSERT INTO public.media_uploads(id,user_id,piece_id,object_path,kind,byte_size,mime_type)
  VALUES(v_id,v_user,p_piece_id,v_path,p_kind,p_byte_size,p_mime_type);
  UPDATE public.media_usage AS u
    SET reserved_bytes=u.reserved_bytes+p_byte_size,updated_at=now()
    WHERE u.user_id=v_user;
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
  SELECT m.* INTO v_upload FROM public.media_uploads AS m WHERE m.id=p_upload_id AND m.user_id=v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Upload reservation not found'; END IF;
  IF v_upload.status = 'ready' THEN
    SELECT u.* INTO v_usage FROM public.media_usage AS u WHERE u.user_id=v_user;
    RETURN QUERY SELECT v_upload.id,v_upload.object_path,v_usage.used_bytes,v_usage.reserved_bytes,v_quota;
    RETURN;
  END IF;
  SELECT (o.metadata->>'size')::bigint INTO v_actual FROM storage.objects AS o
   WHERE o.bucket_id=v_upload.bucket_id AND o.name=v_upload.object_path;
  IF v_actual IS NULL OR v_actual <> v_upload.byte_size THEN RAISE EXCEPTION 'Uploaded object does not match its reservation'; END IF;
  UPDATE public.media_uploads AS m SET status='ready',expires_at='infinity',updated_at=now() WHERE m.id=v_upload.id;
  UPDATE public.media_usage AS u
    SET reserved_bytes=u.reserved_bytes-v_upload.byte_size,
        used_bytes=u.used_bytes+v_upload.byte_size,
        updated_at=now()
    WHERE u.user_id=v_user RETURNING u.* INTO v_usage;
  RETURN QUERY SELECT v_upload.id,v_upload.object_path,v_usage.used_bytes,v_usage.reserved_bytes,v_quota;
END $$;

CREATE OR REPLACE FUNCTION public.release_media_upload(p_upload_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_upload public.media_uploads%ROWTYPE;
BEGIN
  SELECT m.* INTO v_upload FROM public.media_uploads AS m WHERE m.id=p_upload_id AND m.user_id=v_user FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE public.media_usage AS u SET
    reserved_bytes=u.reserved_bytes-CASE WHEN v_upload.status='reserved' THEN v_upload.byte_size ELSE 0 END,
    used_bytes=u.used_bytes-CASE WHEN v_upload.status IN ('ready','published') THEN v_upload.byte_size ELSE 0 END,
    updated_at=now()
  WHERE u.user_id=v_user;
  DELETE FROM public.media_uploads AS m WHERE m.id=v_upload.id;
END $$;
