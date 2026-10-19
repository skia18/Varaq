-- Collections contain references to published pieces, never Vault content.
CREATE TABLE public.collections (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 100),
 description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
 system_type text CHECK (system_type IS NULL OR system_type = 'saved'),
 visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','public')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (system_type IS DISTINCT FROM 'saved' OR (name = 'Saved' AND visibility = 'private'))
);
CREATE UNIQUE INDEX collections_one_saved ON public.collections(user_id) WHERE system_type = 'saved';
CREATE INDEX collections_owner ON public.collections(user_id);
CREATE TABLE public.collection_items (
 collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
 piece_id uuid NOT NULL REFERENCES public.pieces(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(collection_id,piece_id)
);
CREATE FUNCTION public.protect_saved_collection() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 IF OLD.system_type = 'saved' THEN
  IF TG_OP = 'DELETE' THEN
   -- Permit deletion only as part of account removal.
   IF EXISTS(SELECT 1 FROM auth.users WHERE id = OLD.user_id) THEN
    RAISE EXCEPTION 'Saved cannot be deleted';
   END IF;
   RETURN OLD;
  END IF;
  IF NEW.system_type IS DISTINCT FROM OLD.system_type OR NEW.user_id <> OLD.user_id THEN
   RAISE EXCEPTION 'Saved is system managed';
  END IF;
 END IF;
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_saved BEFORE UPDATE OR DELETE ON public.collections FOR EACH ROW EXECUTE FUNCTION public.protect_saved_collection();
CREATE FUNCTION public.create_saved_collection() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 INSERT INTO public.collections(user_id,name,system_type) VALUES(NEW.id,'Saved','saved') ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
CREATE TRIGGER user_saved_collection AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.create_saved_collection();
INSERT INTO public.collections(user_id,name,system_type) SELECT id,'Saved','saved' FROM auth.users ON CONFLICT DO NOTHING;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_items ENABLE ROW LEVEL SECURITY;
-- Writes go through the authenticated Go API. No direct client write policies.
CREATE POLICY collections_read ON public.collections FOR SELECT USING (user_id = auth.uid() OR visibility = 'public');
CREATE POLICY collection_items_read ON public.collection_items FOR SELECT USING (
 EXISTS(SELECT 1 FROM public.collections c WHERE c.id=collection_id AND (c.user_id=auth.uid() OR c.visibility='public'))
 AND EXISTS(SELECT 1 FROM public.pieces p WHERE p.id=piece_id AND p.status='published' AND p.visibility='public')
);
REVOKE ALL ON public.collections, public.collection_items FROM anon, authenticated;
GRANT SELECT ON public.collections, public.collection_items TO anon, authenticated;
