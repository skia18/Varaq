-- name: GetPublicFeed :many
SELECT
    p.id,
    p.slug,
    p.title,
    p.excerpt,
    p.body,
    p.genre,
    p.published_at,
    pe.handle AS persona_handle,
    pe.display_name AS persona_display_name
FROM pieces p
JOIN personas pe ON pe.id = p.persona_id
WHERE p.status = 'published'
  AND p.visibility = 'public'
  AND p.deleted_at IS NULL
  AND (sqlc.narg(cursor_published_at)::timestamptz IS NULL
       OR (p.published_at, p.id) < (sqlc.narg(cursor_published_at)::timestamptz, sqlc.narg(cursor_id)::uuid))
ORDER BY p.published_at DESC, p.id DESC
LIMIT sqlc.arg(page_size)::int;

-- name: GetPublicPieceByPersonaAndSlug :one
SELECT p.id, p.slug, p.title, p.body, p.excerpt, p.genre, p.published_at,
       pe.id AS persona_id, pe.handle AS persona_handle, pe.display_name AS persona_display_name
FROM pieces p
JOIN personas pe ON pe.id = p.persona_id
WHERE pe.handle = sqlc.arg(handle)
  AND p.slug = sqlc.arg(slug)
  AND p.status = 'published'
  AND p.visibility = 'public'
  AND p.deleted_at IS NULL;
