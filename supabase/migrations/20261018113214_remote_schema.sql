SET local check_function_bodies = off;

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "service_role";

CREATE TABLE "public"."personas" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"      uuid                     NOT NULL,
  "handle"       character varying(30)    NOT NULL,
  "display_name" character varying(80)    NOT NULL,
  "bio"          text,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "personas_bio_length" CHECK (((bio IS NULL) OR (length(bio) <= 500))),
  CONSTRAINT "personas_display_name_not_empty" CHECK (((length(TRIM(BOTH FROM display_name)) >= 1) AND (length(TRIM(BOTH FROM display_name)) <= 80))),
  CONSTRAINT "personas_handle_format" CHECK (((handle)::text ~ '^[a-z0-9_]{3,30}$'::text)),
  CONSTRAINT "personas_handle_key" UNIQUE (handle),
  CONSTRAINT "personas_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."personas"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."pieces" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "persona_id"   uuid                     NOT NULL,
  "slug"         character varying(220)   NOT NULL,
  "title"        character varying(200)   NOT NULL,
  "body"         text                     NOT NULL,
  "type"         character varying(20)    NOT NULL,
  "status"       character varying(20)    NOT NULL DEFAULT 'draft'::character varying,
  "visibility"   character varying(20)    NOT NULL DEFAULT 'private'::character varying,
  "published_at" timestamp with time zone,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "pieces_body_not_empty" CHECK (((length(TRIM(BOTH FROM body)) >= 1) AND (length(TRIM(BOTH FROM body)) <= 50000))),
  CONSTRAINT "pieces_persona_slug_unique" UNIQUE (persona_id, slug),
  CONSTRAINT "pieces_pkey" PRIMARY KEY (id),
  CONSTRAINT "pieces_publication_consistency" CHECK (((((status)::text = 'draft'::text) AND (published_at IS NULL)) OR (((status)::text = 'published'::text) AND (published_at IS
    NOT NULL)))),
  CONSTRAINT "pieces_status_check" CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'published'::character varying])::text[]))),
  CONSTRAINT "pieces_title_not_empty" CHECK (((length(TRIM(BOTH FROM title)) >= 1) AND (length(TRIM(BOTH FROM title)) <= 200))),
  CONSTRAINT "pieces_type_check"
    CHECK
    (((type)::text = ANY ((ARRAY['poem'::character varying, 'fragment'::character varying, 'story'::character varying, 'letter'::character varying, 'essay'::character
    varying])::text[]))),
  CONSTRAINT "pieces_visibility_check"
    CHECK (((visibility)::text = ANY ((ARRAY['public'::character varying, 'unlisted'::character varying, 'private'::character varying])::text[])))
);

ALTER TABLE "public"."pieces"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION "public"."set_updated_at"() FROM "anon", "authenticated", "service_role";

ALTER TABLE "public"."personas"
  ADD CONSTRAINT "personas_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."pieces"
  ADD CONSTRAINT "pieces_persona_id_fkey" FOREIGN KEY (persona_id) REFERENCES public.personas(id) ON DELETE CASCADE;

CREATE INDEX idx_personas_user_id ON public.personas USING btree (user_id);

CREATE INDEX idx_pieces_persona_created ON public.pieces USING btree (persona_id, created_at DESC, id DESC);

CREATE INDEX idx_pieces_persona_published ON public.pieces USING btree (persona_id, published_at DESC, id DESC)
  WHERE ((status)::text = 'published'::text);

CREATE INDEX idx_pieces_public_feed ON public.pieces USING btree (published_at DESC, id DESC)
  WHERE (((status)::text = 'published'::text) AND ((visibility)::text = 'public'::text));

CREATE TRIGGER personas_set_updated_at
  BEFORE UPDATE ON public.personas
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER pieces_set_updated_at
  BEFORE UPDATE ON public.pieces
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

GRANT EXECUTE ON FUNCTION "public"."set_updated_at"() TO PUBLIC;

REVOKE ALL ON FUNCTION "public"."set_updated_at"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."set_updated_at"() TO "postgres";

REVOKE ALL ON TABLE "public"."personas" FROM "anon";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."personas" TO "anon";

REVOKE ALL ON TABLE "public"."personas" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."personas" TO "authenticated";

REVOKE ALL ON TABLE "public"."personas" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."personas" TO "postgres";

REVOKE ALL ON TABLE "public"."personas" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."personas" TO "service_role";

REVOKE ALL ON TABLE "public"."pieces" FROM "anon";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."pieces" TO "anon";

REVOKE ALL ON TABLE "public"."pieces" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."pieces" TO "authenticated";

REVOKE ALL ON TABLE "public"."pieces" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."pieces" TO "postgres";

REVOKE ALL ON TABLE "public"."pieces" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."pieces" TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLES TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLES TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLES TO "service_role";

