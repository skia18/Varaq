package httpapi

import (
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
)

type TrailEdge struct {
	SourceID   string `json:"sourceId"`
	ResponseID string `json:"responseId"`
	Relation   string `json:"relation"`
}

type TrailGraph struct {
	RootID string      `json:"rootId"`
	Nodes  []FeedPiece `json:"nodes"`
	Edges  []TrailEdge `json:"edges"`
}

type TrailSummary struct {
	Root       FeedPiece `json:"root"`
	PieceCount int       `json:"pieceCount"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

// ListTrails returns each connected public Trail once, represented by the
// originating publication. Private and unlisted links do not affect the
// directory or leak the existence of hidden pieces.
func (h PieceHandler) ListTrails(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Query(r.Context(), `
WITH RECURSIVE roots(id) AS (
 SELECT DISTINCT t.source_id
 FROM public.piece_trails t
 JOIN public.pieces source ON source.id=t.source_id
 JOIN public.pieces response ON response.id=t.response_id
 WHERE source.status='published' AND source.visibility='public'
   AND response.status='published' AND response.visibility='public'
   AND NOT EXISTS (
     SELECT 1 FROM public.piece_trails incoming
     JOIN public.pieces parent ON parent.id=incoming.source_id
     WHERE incoming.response_id=t.source_id
       AND parent.status='published' AND parent.visibility='public'
   )
), connected(root_id,id) AS (
 SELECT id,id FROM roots
 UNION
 SELECT c.root_id,t.response_id
 FROM connected c
 JOIN public.piece_trails t ON t.source_id=c.id
 JOIN public.pieces response ON response.id=t.response_id
 WHERE response.status='published' AND response.visibility='public'
)
SELECT p.id,p.persona_id,p.slug,p.title,p.body,p.type,p.status,p.visibility,p.published_at,p.created_at,p.updated_at,
 p.medium,p.media_path,p.media_mime_type,p.media_byte_size,p.cover_path,p.cover_mime_type,p.cover_byte_size,
 persona.display_name,persona.handle,COUNT(c.id),MAX(member.updated_at)
FROM roots r
JOIN connected c ON c.root_id=r.id
JOIN public.pieces member ON member.id=c.id
JOIN public.pieces p ON p.id=r.id
JOIN public.personas persona ON persona.id=p.persona_id
GROUP BY p.id,persona.id
ORDER BY MAX(member.updated_at) DESC,p.id DESC
LIMIT 60`)
	if err != nil {
		writeInternalError(w)
		return
	}
	defer rows.Close()
	items := []TrailSummary{}
	for rows.Next() {
		var item TrailSummary
		if err = rows.Scan(&item.Root.ID, &item.Root.PersonaID, &item.Root.Slug, &item.Root.Title, &item.Root.Body, &item.Root.Type, &item.Root.Status, &item.Root.Visibility, &item.Root.PublishedAt, &item.Root.CreatedAt, &item.Root.UpdatedAt, &item.Root.Medium, &item.Root.MediaPath, &item.Root.MediaMime, &item.Root.MediaBytes, &item.Root.CoverPath, &item.Root.CoverMime, &item.Root.CoverBytes, &item.Root.Author, &item.Root.Handle, &item.PieceCount, &item.UpdatedAt); err != nil {
			writeInternalError(w)
			return
		}
		item.Root.TrailConnected = true
		items = append(items, item)
	}
	if rows.Err() != nil {
		writeInternalError(w)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

// GetTrail exposes only connected public publications. Vault and unlisted pieces
// never become graph nodes, even when the caller knows their IDs.
func (h PieceHandler) GetTrail(w http.ResponseWriter, r *http.Request) {
	root := chi.URLParam(r, "pieceID")
	if !uuidPattern.MatchString(root) {
		writeBadRequest(w, "Invalid piece ID.")
		return
	}
	var available bool
	err := h.DB.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM public.pieces WHERE id=$1::uuid AND status='published' AND visibility='public')`, root).Scan(&available)
	if err != nil {
		writeInternalError(w)
		return
	}
	if !available {
		writeJSON(w, http.StatusNotFound, map[string]any{"error": map[string]string{"code": "not_found", "message": "Trail not found."}})
		return
	}

	connected := `WITH RECURSIVE connected(id) AS (
 SELECT $1::uuid
 UNION
 SELECT CASE WHEN t.source_id=c.id THEN t.response_id ELSE t.source_id END
 FROM connected c
 JOIN public.piece_trails t ON t.source_id=c.id OR t.response_id=c.id
 JOIN public.pieces p ON p.id=CASE WHEN t.source_id=c.id THEN t.response_id ELSE t.source_id END
 WHERE p.status='published' AND p.visibility='public'
) `
	rows, err := h.DB.Query(r.Context(), connected+`
 SELECT p.id,p.persona_id,p.slug,p.title,p.body,p.type,p.status,p.visibility,p.published_at,p.created_at,p.updated_at,
 p.medium,p.media_path,p.media_mime_type,p.media_byte_size,p.cover_path,p.cover_mime_type,p.cover_byte_size,
 persona.display_name,persona.handle
 FROM connected c JOIN public.pieces p ON p.id=c.id JOIN public.personas persona ON persona.id=p.persona_id
 WHERE p.status='published' AND p.visibility='public' ORDER BY p.published_at,p.id`, root)
	if err != nil {
		writeInternalError(w)
		return
	}
	nodes := []FeedPiece{}
	for rows.Next() {
		var n FeedPiece
		if err = rows.Scan(&n.ID, &n.PersonaID, &n.Slug, &n.Title, &n.Body, &n.Type, &n.Status, &n.Visibility, &n.PublishedAt, &n.CreatedAt, &n.UpdatedAt, &n.Medium, &n.MediaPath, &n.MediaMime, &n.MediaBytes, &n.CoverPath, &n.CoverMime, &n.CoverBytes, &n.Author, &n.Handle); err != nil {
			rows.Close()
			writeInternalError(w)
			return
		}
		n.TrailConnected = true
		nodes = append(nodes, n)
	}
	if err = rows.Err(); err != nil {
		rows.Close()
		writeInternalError(w)
		return
	}
	rows.Close()

	edgeRows, err := h.DB.Query(r.Context(), connected+`
 SELECT t.source_id,t.response_id,t.relation FROM public.piece_trails t
 JOIN connected s ON s.id=t.source_id JOIN connected d ON d.id=t.response_id
 JOIN public.pieces sp ON sp.id=t.source_id JOIN public.pieces rp ON rp.id=t.response_id
 WHERE sp.status='published' AND sp.visibility='public' AND rp.status='published' AND rp.visibility='public'
 ORDER BY t.created_at,t.response_id`, root)
	if err != nil {
		writeInternalError(w)
		return
	}
	defer edgeRows.Close()
	edges := []TrailEdge{}
	for edgeRows.Next() {
		var e TrailEdge
		if err = edgeRows.Scan(&e.SourceID, &e.ResponseID, &e.Relation); err != nil {
			writeInternalError(w)
			return
		}
		edges = append(edges, e)
	}
	if err = edgeRows.Err(); err != nil && !errors.Is(err, pgx.ErrNoRows) {
		writeInternalError(w)
		return
	}
	writeJSON(w, http.StatusOK, TrailGraph{RootID: root, Nodes: nodes, Edges: edges})
}
