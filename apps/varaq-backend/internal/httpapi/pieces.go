package httpapi

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
)

type Piece struct {
	ID          string     `json:"id"`
	PersonaID   string     `json:"personaId"`
	Slug        string     `json:"slug"`
	Title       string     `json:"title"`
	Body        string     `json:"body"`
	Type        string     `json:"type"`
	Status      string     `json:"status"`
	Visibility  string     `json:"visibility"`
	PublishedAt *time.Time `json:"publishedAt"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
}

type PiecePage struct {
	Items      []Piece `json:"items"`
	NextCursor *string `json:"nextCursor"`
}

type pieceCursor struct {
	PublishedAt time.Time `json:"publishedAt"`
	ID          string    `json:"id"`
}

func (h PersonaHandler) ListPublicPieces(w http.ResponseWriter, r *http.Request) {
	handle := chi.URLParam(r, "handle")

	limit := 20
	if rawLimit := r.URL.Query().Get("limit"); rawLimit != "" {
		parsed, err := strconv.Atoi(rawLimit)
		if err != nil || parsed < 1 || parsed > 50 {
			writeBadRequest(w, "Limit must be between 1 and 50.")
			return
		}
		limit = parsed
	}

	var cursor *pieceCursor
	if rawCursor := r.URL.Query().Get("cursor"); rawCursor != "" {
		decoded, err := base64.RawURLEncoding.DecodeString(rawCursor)
		if err != nil {
			writeBadRequest(w, "Invalid pagination cursor.")
			return
		}

		var parsed pieceCursor
		if err := json.Unmarshal(decoded, &parsed); err != nil ||
			parsed.PublishedAt.IsZero() ||
			strings.TrimSpace(parsed.ID) == "" {
			writeBadRequest(w, "Invalid pagination cursor.")
			return
		}
		cursor = &parsed
	}

	// Verify the persona exists so an unknown handle returns 404,
	// even when that persona has no published pieces.
	var personaID string
	err := h.DB.QueryRow(
		r.Context(),
		`SELECT id FROM public.personas WHERE handle = $1`,
		handle,
	).Scan(&personaID)

	if errors.Is(err, pgx.ErrNoRows) {
		writeJSON(w, http.StatusNotFound, map[string]any{
			"error": map[string]string{
				"code":    "not_found",
				"message": "Persona not found.",
			},
		})
		return
	}
	if err != nil {
		writeInternalError(w)
		return
	}

	query := `
		SELECT id, persona_id, slug, title, body, type, status,
		       visibility, published_at, created_at, updated_at
		FROM public.pieces
		WHERE persona_id = $1
		  AND status = 'published'
		  AND visibility = 'public'
	`
	args := []any{personaID}

	if cursor != nil {
		query += `
		  AND (published_at, id) < ($2, $3::uuid)
		`
		args = append(args, cursor.PublishedAt, cursor.ID)
	}

	query += `
		ORDER BY published_at DESC, id DESC
		LIMIT $` + strconv.Itoa(len(args)+1)
	args = append(args, limit+1)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		writeInternalError(w)
		return
	}
	defer rows.Close()

	items := make([]Piece, 0, limit+1)
	for rows.Next() {
		var piece Piece
		if err := rows.Scan(
			&piece.ID,
			&piece.PersonaID,
			&piece.Slug,
			&piece.Title,
			&piece.Body,
			&piece.Type,
			&piece.Status,
			&piece.Visibility,
			&piece.PublishedAt,
			&piece.CreatedAt,
			&piece.UpdatedAt,
		); err != nil {
			writeInternalError(w)
			return
		}
		items = append(items, piece)
	}

	if err := rows.Err(); err != nil {
		writeInternalError(w)
		return
	}

	page := PiecePage{
		Items:      items,
		NextCursor: nil,
	}

	if len(items) > limit {
		items = items[:limit]
		page.Items = items

		last := items[len(items)-1]
		encoded, err := json.Marshal(pieceCursor{
			PublishedAt: *last.PublishedAt,
			ID:          last.ID,
		})
		if err != nil {
			writeInternalError(w)
			return
		}

		next := base64.RawURLEncoding.EncodeToString(encoded)
		page.NextCursor = &next
	}

	writeJSON(w, http.StatusOK, page)
}
