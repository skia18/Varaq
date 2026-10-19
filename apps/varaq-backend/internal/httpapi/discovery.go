package httpapi

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
)

type discoveryCursor struct {
	Query     string    `json:"q"`
	Rank      int       `json:"rank"`
	Handle    string    `json:"handle"`
	CreatedAt time.Time `json:"createdAt"`
	ID        string    `json:"id"`
}

func discoveryParams(r *http.Request) (int, discoveryCursor, error) {
	limit := 20
	if raw := r.URL.Query().Get("limit"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n < 1 || n > 50 {
			return 0, discoveryCursor{}, fmt.Errorf("Limit must be between 1 and 50.")
		}
		limit = n
	}
	var cursor discoveryCursor
	if raw := r.URL.Query().Get("cursor"); raw != "" {
		data, err := base64.RawURLEncoding.DecodeString(raw)
		if err != nil || json.Unmarshal(data, &cursor) != nil {
			return 0, cursor, fmt.Errorf("Invalid pagination cursor.")
		}
	}
	return limit, cursor, nil
}
func encodeDiscoveryCursor(c discoveryCursor) string {
	b, _ := json.Marshal(c)
	return base64.RawURLEncoding.EncodeToString(b)
}

func (h PersonaHandler) Search(w http.ResponseWriter, r *http.Request) {
	limit, cursor, err := discoveryParams(r)
	if err != nil {
		writeBadRequest(w, err.Error())
		return
	}
	q := strings.ToLower(strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(r.URL.Query().Get("q")), "@")))
	if len(q) > 300 {
		writeBadRequest(w, "Search must be at most 300 bytes.")
		return
	}
	hasCursor := r.URL.Query().Get("cursor") != ""
	if hasCursor && (cursor.Query != q || !handlePattern.MatchString(cursor.Handle) || cursor.Rank < 0 || cursor.Rank > 2) {
		writeBadRequest(w, "Invalid pagination cursor.")
		return
	}
	rows, err := h.DB.Query(r.Context(), `WITH matches AS (
 SELECT id,handle,display_name,bio,created_at,
 CASE WHEN handle=$1 THEN 0 WHEN starts_with(handle,$1) OR starts_with(lower(display_name),$1) THEN 1 ELSE 2 END AS rank
 FROM public.personas WHERE $1='' OR strpos(handle,$1)>0 OR strpos(lower(display_name),$1)>0)
 SELECT id,handle,display_name,bio,created_at,rank FROM matches
 WHERE NOT $2 OR (rank,handle)>($3,$4) ORDER BY rank,handle LIMIT $5`, q, hasCursor, cursor.Rank, cursor.Handle, limit+1)
	if err != nil {
		writeInternalError(w)
		return
	}
	defer rows.Close()
	items := []Persona{}
	ranks := []int{}
	for rows.Next() {
		var p Persona
		var rank int
		if rows.Scan(&p.ID, &p.Handle, &p.DisplayName, &p.Bio, &p.CreatedAt, &rank) != nil {
			writeInternalError(w)
			return
		}
		items = append(items, p)
		ranks = append(ranks, rank)
	}
	if rows.Err() != nil {
		writeInternalError(w)
		return
	}
	var next *string
	if len(items) > limit {
		items = items[:limit]
		c := encodeDiscoveryCursor(discoveryCursor{Query: q, Rank: ranks[limit-1], Handle: items[limit-1].Handle})
		next = &c
	}
	writeJSON(w, 200, struct {
		Items      []Persona `json:"items"`
		NextCursor *string   `json:"nextCursor"`
	}{items, next})
}

type PublicCollectionSummary struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	PieceCount  int       `json:"pieceCount"`
	CreatedAt   time.Time `json:"createdAt"`
}

func (h CollectionHandler) ListPublicByPersona(w http.ResponseWriter, r *http.Request) {
	limit, cursor, err := discoveryParams(r)
	if err != nil {
		writeBadRequest(w, err.Error())
		return
	}
	handle := chi.URLParam(r, "handle")
	hasCursor := r.URL.Query().Get("cursor") != ""
	if hasCursor && (cursor.Query != handle || cursor.CreatedAt.IsZero() || !uuidPattern.MatchString(cursor.ID)) {
		writeBadRequest(w, "Invalid pagination cursor.")
		return
	}
	var exists bool
	if err = h.DB.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM public.personas WHERE handle=$1)`, handle).Scan(&exists); err != nil {
		writeInternalError(w)
		return
	}
	if !exists {
		http.NotFound(w, r)
		return
	}
	rows, err := h.DB.Query(r.Context(), `SELECT c.id,c.name,c.description,c.created_at,
 (SELECT count(*) FROM public.collection_items i JOIN public.pieces p ON p.id=i.piece_id WHERE i.collection_id=c.id AND p.status='published' AND p.visibility='public')
 FROM public.collections c JOIN public.personas persona ON persona.user_id=c.user_id
 WHERE persona.handle=$1 AND c.visibility='public' AND c.system_type IS NULL
 AND (NOT $2 OR (c.created_at,c.id)<($3,$4::uuid))
 ORDER BY c.created_at DESC,c.id DESC LIMIT $5`, handle, hasCursor, cursor.CreatedAt, func() string {
		if hasCursor {
			return cursor.ID
		}
		return "00000000-0000-0000-0000-000000000000"
	}(), limit+1)
	if err != nil {
		writeInternalError(w)
		return
	}
	defer rows.Close()
	items := []PublicCollectionSummary{}
	for rows.Next() {
		var c PublicCollectionSummary
		if rows.Scan(&c.ID, &c.Name, &c.Description, &c.CreatedAt, &c.PieceCount) != nil {
			writeInternalError(w)
			return
		}
		items = append(items, c)
	}
	if rows.Err() != nil {
		writeInternalError(w)
		return
	}
	var next *string
	if len(items) > limit {
		items = items[:limit]
		last := items[limit-1]
		c := encodeDiscoveryCursor(discoveryCursor{Query: handle, CreatedAt: last.CreatedAt, ID: last.ID})
		next = &c
	}
	writeJSON(w, 200, struct {
		Items      []PublicCollectionSummary `json:"items"`
		NextCursor *string                   `json:"nextCursor"`
	}{items, next})
}
