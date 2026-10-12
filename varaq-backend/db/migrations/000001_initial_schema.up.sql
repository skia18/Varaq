-- Varaq initial schema. Supabase Auth owns authentication identities.
-- Apply using Supabase SQL migrations or your chosen migration runner.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE piece_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE piece_visibility AS ENUM ('public', 'unlisted', 'private');
CREATE TYPE collection_visibility AS ENUM ('public', 'unlisted', 'private');
CREATE TYPE report_status AS ENUM ('open', 'reviewing', 'resolved', 'dismissed');

-- One account can eventually own multiple personas. Do not expose user_id publicly.
CREATE TABLE app_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE personas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    handle TEXT NOT NULL,
    display_name TEXT NOT NULL,
    bio TEXT NOT NULL DEFAULT '',
    theme JSONB NOT NULL DEFAULT '{"palette":"paper","layout":"editorial","typeface":"serif"}'::jsonb,
    is_discoverable BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT personas_handle_format CHECK (handle ~ '^[a-zA-Z0-9_]{3,30}$'),
    CONSTRAINT personas_display_name_length CHECK (char_length(display_name) BETWEEN 1 AND 80),
    CONSTRAINT personas_bio_length CHECK (char_length(bio) <= 500)
);
CREATE UNIQUE INDEX personas_handle_lower_uq ON personas (lower(handle));
CREATE INDEX personas_user_id_idx ON personas (user_id);

CREATE TABLE pieces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL,
    excerpt TEXT NOT NULL DEFAULT '',
    genre TEXT NOT NULL DEFAULT 'fragment',
    status piece_status NOT NULL DEFAULT 'draft',
    visibility piece_visibility NOT NULL DEFAULT 'private',
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT pieces_title_length CHECK (char_length(title) <= 200),
    CONSTRAINT pieces_body_nonempty CHECK (char_length(btrim(body)) > 0),
    CONSTRAINT pieces_genre_valid CHECK (genre IN ('poem', 'fragment', 'story', 'essay', 'letter', 'other')),
    CONSTRAINT pieces_publication_state CHECK (status <> 'published' OR published_at IS NOT NULL)
);
CREATE UNIQUE INDEX pieces_persona_slug_uq ON pieces (persona_id, slug);
CREATE INDEX pieces_public_feed_idx ON pieces (published_at DESC, id DESC)
    WHERE status = 'published' AND visibility = 'public' AND deleted_at IS NULL;
CREATE INDEX pieces_persona_wall_idx ON pieces (persona_id, published_at DESC, id DESC)
    WHERE status = 'published' AND visibility = 'public' AND deleted_at IS NULL;
CREATE INDEX pieces_owner_drafts_idx ON pieces (persona_id, updated_at DESC)
    WHERE status = 'draft' AND deleted_at IS NULL;

CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT tags_name_length CHECK (char_length(name) BETWEEN 1 AND 40)
);

CREATE TABLE piece_tags (
    piece_id UUID NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (piece_id, tag_id)
);
CREATE INDEX piece_tags_tag_id_idx ON piece_tags (tag_id, piece_id);

CREATE TABLE collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    cover_style JSONB NOT NULL DEFAULT '{}'::jsonb,
    visibility collection_visibility NOT NULL DEFAULT 'private',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT collections_title_length CHECK (char_length(title) BETWEEN 1 AND 120),
    CONSTRAINT collections_description_length CHECK (char_length(description) <= 500)
);
CREATE UNIQUE INDEX collections_owner_slug_uq ON collections (owner_persona_id, slug);
CREATE INDEX collections_public_idx ON collections (created_at DESC, id DESC)
    WHERE visibility = 'public';

CREATE TABLE collection_pieces (
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    piece_id UUID NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (collection_id, piece_id)
);
CREATE INDEX collection_pieces_order_idx ON collection_pieces (collection_id, position, added_at);

CREATE TABLE responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    piece_id UUID NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
    persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT responses_body_length CHECK (char_length(btrim(body)) BETWEEN 1 AND 3000)
);
CREATE INDEX responses_piece_idx ON responses (piece_id, created_at ASC, id ASC)
    WHERE deleted_at IS NULL;

CREATE TABLE saved_pieces (
    persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    piece_id UUID NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (persona_id, piece_id)
);
CREATE INDEX saved_pieces_persona_idx ON saved_pieces (persona_id, created_at DESC);

CREATE TABLE persona_blocks (
    blocker_persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    blocked_persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (blocker_persona_id, blocked_persona_id),
    CONSTRAINT persona_cannot_block_self CHECK (blocker_persona_id <> blocked_persona_id)
);

CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_persona_id UUID REFERENCES personas(id) ON DELETE SET NULL,
    piece_id UUID REFERENCES pieces(id) ON DELETE SET NULL,
    response_id UUID REFERENCES responses(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    status report_status NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    CONSTRAINT reports_reason_length CHECK (char_length(reason) BETWEEN 1 AND 80),
    CONSTRAINT reports_details_length CHECK (char_length(details) <= 2000),
    CONSTRAINT reports_target_required CHECK (piece_id IS NOT NULL OR response_id IS NOT NULL)
);
CREATE INDEX reports_status_created_idx ON reports (status, created_at ASC);
