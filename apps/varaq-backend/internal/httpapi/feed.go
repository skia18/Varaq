package httpapi

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/pgtype"
)

type FeedPiece struct {
	Piece
	Author string `json:"author"`
	Handle string `json:"handle"`
}

type FeedPage struct {
	Items      []FeedPiece `json:"items"`
	NextCursor *string     `json:"nextCursor"`
}

// buildFeedQuery keeps visibility enforcement common to browsing, search and saved pages.
func buildFeedQuery(r *http.Request) (string, []any, int, error) {
	values := r.URL.Query()
	limit := 10
	if raw := values.Get("limit"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n < 1 || n > 50 {
			return "", nil, 0, fmt.Errorf("Limit must be between 1 and 50.")
		}
		limit = n
	}
	query := `SELECT p.id, p.persona_id, p.slug, p.title, p.body, p.type,
 p.status, p.visibility, p.published_at, p.created_at, p.updated_at,
 persona.display_name, persona.handle
 FROM public.pieces p JOIN public.personas persona ON persona.id = p.persona_id
 WHERE p.status = 'published' AND p.visibility = 'public'`
	args := []any{}
	add := func(value any) string { args = append(args, value); return "$" + strconv.Itoa(len(args)) }
	if kind := values.Get("type"); kind != "" {
		if !allowedPieceTypes[kind] {
			return "", nil, 0, fmt.Errorf("Invalid piece type.")
		}
		query += " AND p.type = " + add(kind)
	}
	if search := strings.TrimSpace(values.Get("q")); search != "" {
		if len(search) > 300 {
			return "", nil, 0, fmt.Errorf("Search must be at most 300 bytes.")
		}
		// strpos searches literal text, so percent and underscore are not wildcards.
		query += " AND strpos(lower(p.title || ' ' || p.body || ' ' || persona.display_name || ' ' || persona.handle), lower(" + add(search) + ")) > 0"
	}
	if raw := values.Get("ids"); raw != "" {
		ids := strings.Split(raw, ",")
		if len(ids) > 50 {
			return "", nil, 0, fmt.Errorf("At most 50 IDs are allowed.")
		}
		uuids := make([]pgtype.UUID, 0, len(ids))
		for _, id := range ids {
			var uuid pgtype.UUID
			if err := uuid.Scan(id); err != nil {
				return "", nil, 0, fmt.Errorf("Invalid piece ID.")
			}
			uuids = append(uuids, uuid)
		}
		query += " AND p.id = ANY(" + add(uuids) + "::uuid[])"
	}
	if raw := values.Get("cursor"); raw != "" {
		decoded, err := base64.RawURLEncoding.DecodeString(raw)
		var cursor pieceCursor
		if err != nil || json.Unmarshal(decoded, &cursor) != nil || cursor.PublishedAt.IsZero() {
			return "", nil, 0, fmt.Errorf("Invalid pagination cursor.")
		}
		var uuid pgtype.UUID
		if err := uuid.Scan(cursor.ID); err != nil {
			return "", nil, 0, fmt.Errorf("Invalid pagination cursor.")
		}
		query += " AND (p.published_at, p.id) < (" + add(cursor.PublishedAt) + ", " + add(uuid) + "::uuid)"
	}
	query += " ORDER BY p.published_at DESC, p.id DESC LIMIT " + add(limit+1)
	return query, args, limit, nil
}

func (h PieceHandler) ListFeed(w http.ResponseWriter, r *http.Request) {
	query, args, limit, err := buildFeedQuery(r)
	if err != nil {
		writeBadRequest(w, err.Error())
		return
	}
	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		writeInternalError(w)
		return
	}
	defer rows.Close()
	items := make([]FeedPiece, 0, limit+1)
	for rows.Next() {
		var item FeedPiece
		if err := rows.Scan(&item.ID, &item.PersonaID, &item.Slug, &item.Title, &item.Body, &item.Type, &item.Status, &item.Visibility, &item.PublishedAt, &item.CreatedAt, &item.UpdatedAt, &item.Author, &item.Handle); err != nil {
			writeInternalError(w)
			return
		}
		items = append(items, item)
	}
	if rows.Err() != nil {
		writeInternalError(w)
		return
	}
	page := FeedPage{Items: items}
	if len(items) > limit {
		page.Items = items[:limit]
		last := page.Items[limit-1]
		encoded, err := json.Marshal(pieceCursor{PublishedAt: *last.PublishedAt, ID: last.ID})
		if err != nil {
			writeInternalError(w)
			return
		}
		cursor := base64.RawURLEncoding.EncodeToString(encoded)
		page.NextCursor = &cursor
	}
	writeJSON(w, http.StatusOK, page)
}
