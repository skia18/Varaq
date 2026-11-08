package httpapi

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skia18/varaq/apps/varaq-backend/internal/auth"
)

type Piece struct {
	ID          string      `json:"id"`
	PersonaID   string      `json:"personaId"`
	Slug        string      `json:"slug"`
	Title       string      `json:"title"`
	Body        string      `json:"body"`
	Type        string      `json:"type"`
	Status      string      `json:"status"`
	Visibility  string      `json:"visibility"`
	PublishedAt *time.Time  `json:"publishedAt"`
	CreatedAt   time.Time   `json:"createdAt"`
	UpdatedAt   time.Time   `json:"updatedAt"`
	Medium      string      `json:"medium"`
	MediaPath   *string     `json:"mediaPath,omitempty"`
	MediaMime   *string     `json:"mediaMimeType,omitempty"`
	MediaBytes  *int64      `json:"mediaByteSize,omitempty"`
	MediaUpload *string     `json:"mediaUploadId,omitempty"`
	CoverPath   *string     `json:"coverPath,omitempty"`
	CoverMime   *string     `json:"coverMimeType,omitempty"`
	CoverBytes  *int64      `json:"coverByteSize,omitempty"`
	CoverUpload *string     `json:"coverUploadId,omitempty"`
	RespondsTo  *RespondsTo `json:"respondsTo,omitempty"`
}

type RespondsTo struct {
	PieceID  string `json:"pieceId"`
	Relation string `json:"relation"`
}

type PiecePage struct {
	Items      []Piece `json:"items"`
	NextCursor *string `json:"nextCursor"`
}

type pieceCursor struct {
	PublishedAt time.Time `json:"publishedAt"`
	ID          string    `json:"id"`
}

type PieceHandler struct {
	DB *pgxpool.Pool
}

var pieceSlugPattern = regexp.MustCompile(`[^a-z0-9]+`)

var allowedPieceTypes = map[string]bool{
	"poem":     true,
	"fragment": true,
	"story":    true,
	"letter":   true,
	"essay":    true,
}

var allowedPieceMediums = map[string]bool{
	"writing":     true,
	"photography": true,
	"artwork":     true,
	"audio":       true,
}

func makePieceSlug(title string) string {
	title = strings.ToLower(strings.TrimSpace(title))
	slug := pieceSlugPattern.ReplaceAllString(title, "-")
	return strings.Trim(slug, "-")
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

	// Verify the persona exists even when it has no published pieces.
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
		       visibility, published_at, created_at, updated_at,
		       medium, media_path, media_mime_type, media_byte_size, cover_path, cover_mime_type, cover_byte_size
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
			&piece.Medium,
			&piece.MediaPath,
			&piece.MediaMime,
			&piece.MediaBytes,
			&piece.CoverPath, &piece.CoverMime, &piece.CoverBytes,
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

func (h PieceHandler) ListOwnerPieces(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]any{
			"error": map[string]string{
				"code":    "unauthorized",
				"message": "A valid access token is required.",
			},
		})
		return
	}

	limit := 20
	if rawLimit := r.URL.Query().Get("limit"); rawLimit != "" {
		parsed, err := strconv.Atoi(rawLimit)
		if err != nil || parsed < 1 || parsed > 50 {
			writeBadRequest(w, "Limit must be between 1 and 50.")
			return
		}
		limit = parsed
	}

	status, personaID := r.URL.Query().Get("status"), r.URL.Query().Get("personaId")
	if status != "" && status != "published" {
		writeBadRequest(w, "Invalid status filter.")
		return
	}
	if personaID != "" && !uuidPattern.MatchString(personaID) {
		writeBadRequest(w, "Invalid personaId filter.")
		return
	}
	var cursorTime *time.Time
	var cursorID *string
	if raw := r.URL.Query().Get("cursor"); raw != "" {
		bytes, err := base64.RawURLEncoding.DecodeString(raw)
		var cursor struct {
			CreatedAt time.Time `json:"createdAt"`
			ID        string    `json:"id"`
		}
		if err != nil || json.Unmarshal(bytes, &cursor) != nil || cursor.CreatedAt.IsZero() || !uuidPattern.MatchString(cursor.ID) {
			writeBadRequest(w, "Invalid pagination cursor.")
			return
		}
		cursorTime = &cursor.CreatedAt
		cursorID = &cursor.ID
	}
	query := `
		SELECT p.id, p.persona_id, p.slug, p.title, p.body,
		       p.type, p.status, p.visibility, p.published_at,
		       p.created_at, p.updated_at, p.medium, p.media_path,
		       p.media_mime_type, p.media_byte_size, p.cover_path, p.cover_mime_type, p.cover_byte_size
		FROM public.pieces p
		JOIN public.personas persona ON persona.id = p.persona_id
		WHERE persona.user_id = $1::uuid AND p.status='published'
          AND ($3::text='' OR p.status=$3)
          AND ($4::text='' OR p.persona_id=NULLIF($4,'')::uuid)
          AND ($5::timestamptz IS NULL OR (p.created_at,p.id)<($5,$6::uuid))
		ORDER BY p.created_at DESC, p.id DESC
		LIMIT $2
	`

	rows, err := h.DB.Query(r.Context(), query, user.ID, limit+1, status, personaID, cursorTime, cursorID)
	if err != nil {
		writeInternalError(w)
		return
	}
	defer rows.Close()

	items := make([]Piece, 0, limit)

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
			&piece.Medium,
			&piece.MediaPath,
			&piece.MediaMime,
			&piece.MediaBytes,
			&piece.CoverPath, &piece.CoverMime, &piece.CoverBytes,
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

	var next *string
	if len(items) > limit {
		items = items[:limit]
		last := items[len(items)-1]
		raw, err := json.Marshal(struct {
			CreatedAt time.Time `json:"createdAt"`
			ID        string    `json:"id"`
		}{last.CreatedAt, last.ID})
		if err != nil {
			writeInternalError(w)
			return
		}
		encoded := base64.RawURLEncoding.EncodeToString(raw)
		next = &encoded
	}
	writeJSON(w, http.StatusOK, PiecePage{Items: items, NextCursor: next})
}

type updatePieceRequest struct {
	Title      string      `json:"title"`
	Body       string      `json:"body"`
	Type       string      `json:"type"`
	RespondsTo *RespondsTo `json:"respondsTo"`
	ClearTrail bool        `json:"clearTrail"`
}

func (h PieceHandler) GetOwnerPiece(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]any{
			"error": map[string]string{
				"code":    "unauthorized",
				"message": "A valid access token is required.",
			},
		})
		return
	}

	pieceID := chi.URLParam(r, "pieceID")

	var piece Piece
	row := h.DB.QueryRow(
		r.Context(),
		`SELECT p.id, p.persona_id, p.slug, p.title, p.body,
		        p.type, p.status, p.visibility, p.published_at,
		        p.created_at, p.updated_at, p.medium, p.media_path,
		        p.media_mime_type, p.media_byte_size, media.id, p.cover_path, p.cover_mime_type, p.cover_byte_size, cover.id,
		        trail.source_id, trail.relation
		 FROM public.pieces p
		 JOIN public.personas persona ON persona.id = p.persona_id
		 LEFT JOIN public.media_uploads media ON media.piece_id=p.id AND media.status='published'
		   AND media.object_path=p.media_path
		 LEFT JOIN public.media_uploads cover ON cover.piece_id=p.id AND cover.status='published'
		   AND cover.object_path=p.cover_path
		 LEFT JOIN public.piece_trails trail ON trail.response_id=p.id
		 WHERE p.id = $1::uuid
		   AND persona.user_id = $2::uuid`,
		pieceID,
		user.ID,
	)
	var trailSource, trailRelation *string
	err := row.Scan(
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
		&piece.Medium,
		&piece.MediaPath,
		&piece.MediaMime,
		&piece.MediaBytes,
		&piece.MediaUpload,
		&piece.CoverPath, &piece.CoverMime, &piece.CoverBytes,
		&piece.CoverUpload,
		&trailSource, &trailRelation,
	)
	if trailSource != nil && trailRelation != nil {
		piece.RespondsTo = &RespondsTo{PieceID: *trailSource, Relation: *trailRelation}
	}

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, map[string]any{
				"error": map[string]string{
					"code":    "piece_not_found",
					"message": "Piece not found.",
				},
			})
			return
		}

		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "22P02" {
			writeBadRequest(w, "pieceID must be a valid UUID.")
			return
		}

		writeInternalError(w)
		return
	}

	writeJSON(w, http.StatusOK, piece)
}

func (h PieceHandler) UpdateOwnerPiece(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]any{
			"error": map[string]string{
				"code":    "unauthorized",
				"message": "A valid access token is required.",
			},
		})
		return
	}

	var req updatePieceRequest

	r.Body = http.MaxBytesReader(w, r.Body, 400_000)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(&req); err != nil {
		writeBadRequest(w, "Invalid JSON request body.")
		return
	}

	var extra any
	if err := decoder.Decode(&extra); !errors.Is(err, io.EOF) {
		writeBadRequest(w, "Request body must contain a single JSON object.")
		return
	}

	req.Title = strings.TrimSpace(req.Title)

	titleLength := utf8.RuneCountInString(req.Title)
	if titleLength < 1 || titleLength > 200 {
		writeBadRequest(w, "Title must contain 1–200 characters.")
		return
	}

	bodyLength := utf8.RuneCountInString(req.Body)
	if utf8.RuneCountInString(strings.TrimSpace(req.Body)) < 1 ||
		bodyLength > 50000 {
		writeBadRequest(w, "Body must contain 1–50000 characters and cannot be blank.")
		return
	}

	if !allowedPieceTypes[req.Type] {
		writeBadRequest(w, "Type must be poem, fragment, story, letter, or essay.")
		return
	}
	if req.RespondsTo != nil && (!uuidPattern.MatchString(req.RespondsTo.PieceID) || (req.RespondsTo.Relation != "inspired-by" && req.RespondsTo.Relation != "continues")) {
		writeBadRequest(w, "Invalid Trail relationship.")
		return
	}
	if req.RespondsTo != nil && req.ClearTrail {
		writeBadRequest(w, "Choose a Trail relationship or remove it, not both.")
		return
	}

	pieceID := chi.URLParam(r, "pieceID")
	if req.RespondsTo != nil && req.RespondsTo.PieceID == pieceID {
		writeBadRequest(w, "A piece cannot respond to itself.")
		return
	}
	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		writeInternalError(w)
		return
	}
	defer tx.Rollback(r.Context())
	if req.RespondsTo != nil {
		var valid bool
		err = tx.QueryRow(r.Context(), `WITH RECURSIVE descendants(id) AS (
		 SELECT response_id FROM public.piece_trails WHERE source_id=$1::uuid
		 UNION SELECT t.response_id FROM public.piece_trails t JOIN descendants d ON t.source_id=d.id
		) SELECT EXISTS(
		 SELECT 1 FROM public.pieces source, public.pieces response
		 JOIN public.personas persona ON persona.id=response.persona_id
		 WHERE source.id=$2::uuid AND source.status='published' AND source.visibility='public'
		 AND response.id=$1::uuid AND response.status='published' AND response.visibility='public'
		 AND persona.user_id=$3::uuid AND NOT EXISTS(SELECT 1 FROM descendants WHERE id=$2::uuid)
		)`, pieceID, req.RespondsTo.PieceID, user.ID).Scan(&valid)
		if err != nil {
			writeInternalError(w)
			return
		}
		if !valid {
			writeJSON(w, http.StatusConflict, map[string]any{"error": map[string]string{"code": "invalid_trail_relationship", "message": "The selected pieces cannot be connected. Both must be public and the relationship cannot form a cycle."}})
			return
		}
	}

	var piece Piece
	err = tx.QueryRow(
		r.Context(),
		`UPDATE public.pieces AS p
		 SET title = $3,
		     body = $4,
		     type = $5,
		     updated_at = NOW()
		 FROM public.personas AS persona
		 WHERE p.id = $1::uuid
		   AND persona.id = p.persona_id
		   AND persona.user_id = $2::uuid
         AND p.status = 'published'
		 RETURNING p.id, p.persona_id, p.slug, p.title, p.body,
		           p.type, p.status, p.visibility, p.published_at,
		           p.created_at, p.updated_at, p.medium, p.media_path,
		           p.media_mime_type, p.media_byte_size, p.cover_path, p.cover_mime_type, p.cover_byte_size`,
		pieceID,
		user.ID,
		req.Title,
		req.Body,
		req.Type,
	).Scan(
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
		&piece.Medium,
		&piece.MediaPath,
		&piece.MediaMime,
		&piece.MediaBytes,
		&piece.CoverPath, &piece.CoverMime, &piece.CoverBytes,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, map[string]any{
				"error": map[string]string{
					"code":    "piece_not_found",
					"message": "Piece not found or no longer editable.",
				},
			})
			return
		}

		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "22P02" {
			writeBadRequest(w, "pieceID must be a valid UUID.")
			return
		}

		writeInternalError(w)
		return
	}
	if req.RespondsTo != nil {
		_, err = tx.Exec(r.Context(), `INSERT INTO public.piece_trails(response_id,source_id,relation) VALUES($1::uuid,$2::uuid,$3)
		 ON CONFLICT(response_id) DO UPDATE SET source_id=EXCLUDED.source_id,relation=EXCLUDED.relation`, pieceID, req.RespondsTo.PieceID, req.RespondsTo.Relation)
		if err != nil {
			writeInternalError(w)
			return
		}
		piece.RespondsTo = req.RespondsTo
	} else if req.ClearTrail {
		_, err = tx.Exec(r.Context(), `DELETE FROM public.piece_trails WHERE response_id=$1::uuid`, pieceID)
		if err != nil {
			writeInternalError(w)
			return
		}
	}
	if err = tx.Commit(r.Context()); err != nil {
		writeInternalError(w)
		return
	}

	writeJSON(w, http.StatusOK, piece)
}

func (h PieceHandler) PublishOwnerPiece(w http.ResponseWriter, r *http.Request) {
	if _, ok := auth.UserFromContext(r.Context()); !ok {
		vaultError(w, http.StatusUnauthorized, "unauthorized", "A valid access token is required.")
		return
	}
	h.PublishVault(w, r)
}

func (h PieceHandler) DeleteOwnerPiece(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]any{
			"error": map[string]string{
				"code":    "unauthorized",
				"message": "A valid access token is required.",
			},
		})
		return
	}

	pieceID := chi.URLParam(r, "pieceID")

	tag, err := h.DB.Exec(
		r.Context(),
		`DELETE FROM public.pieces AS p
         USING public.personas AS persona
         WHERE p.id = $1::uuid
           AND persona.id = p.persona_id
           AND persona.user_id = $2::uuid`,
		pieceID,
		user.ID,
	)

	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "22P02" {
			writeBadRequest(w, "pieceID must be a valid UUID.")
			return
		}

		writeInternalError(w)
		return
	}

	if tag.RowsAffected() == 0 {
		writeJSON(w, http.StatusNotFound, map[string]any{
			"error": map[string]string{
				"code":    "piece_not_found",
				"message": "Piece not found.",
			},
		})
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
