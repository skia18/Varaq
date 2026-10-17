package httpapi

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
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

type PieceHandler struct {
	DB *pgxpool.Pool
}

type createPieceRequest struct {
	PersonaID  string  `json:"personaId"`
	Title      string  `json:"title"`
	Body       string  `json:"body"`
	Type       string  `json:"type"`
	Visibility *string `json:"visibility"`
}

var pieceSlugPattern = regexp.MustCompile(`[^a-z0-9]+`)

var allowedPieceTypes = map[string]bool{
	"poem":     true,
	"fragment": true,
	"story":    true,
	"letter":   true,
	"essay":    true,
}

var allowedPieceVisibilities = map[string]bool{
	"private":  true,
	"unlisted": true,
	"public":   true,
}

func (h PieceHandler) Create(w http.ResponseWriter, r *http.Request) {
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

	var req createPieceRequest

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

	req.PersonaID = strings.TrimSpace(req.PersonaID)
	req.Title = strings.TrimSpace(req.Title)

	if req.PersonaID == "" {
		writeBadRequest(w, "personaId is required.")
		return
	}

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

	visibility := "private"
	if req.Visibility != nil {
		visibility = *req.Visibility

		if !allowedPieceVisibilities[visibility] {
			writeBadRequest(w, "Visibility must be private, unlisted, or public.")
			return
		}
	}

	// Only allow users to create pieces under personas they own.
	var ownsPersona bool
	err := h.DB.QueryRow(
		r.Context(),
		`SELECT EXISTS (
			SELECT 1
			FROM public.personas
			WHERE id = $1::uuid
			  AND user_id = $2::uuid
		)`,
		req.PersonaID,
		user.ID,
	).Scan(&ownsPersona)

	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "22P02" {
			writeBadRequest(w, "personaId must be a valid UUID.")
			return
		}

		writeInternalError(w)
		return
	}

	if !ownsPersona {
		writeJSON(w, http.StatusNotFound, map[string]any{
			"error": map[string]string{
				"code":    "persona_not_found",
				"message": "Persona not found.",
			},
		})
		return
	}

	slugBase := makePieceSlug(req.Title)
	if slugBase == "" {
		slugBase = "piece"
	}

	// Keep enough room for the collision suffix within varchar(220).
	if len(slugBase) > 200 {
		slugBase = slugBase[:200]
	}

	// Retry if another piece under this persona already uses the slug.
	for attempt := 0; attempt < 5; attempt++ {
		slug := slugBase

		if attempt > 0 {
			suffix, err := randomPieceSlugSuffix()
			if err != nil {
				writeInternalError(w)
				return
			}

			slug = slugBase + "-" + suffix
		}

		var piece Piece

		err := h.DB.QueryRow(
			r.Context(),
			`INSERT INTO public.pieces
				(persona_id, slug, title, body, type, status, visibility, published_at)
			VALUES ($1::uuid, $2, $3, $4, $5, 'draft', $6, NULL)
			RETURNING
				id, persona_id, slug, title, body, type, status,
				visibility, published_at, created_at, updated_at`,
			req.PersonaID,
			slug,
			req.Title,
			req.Body,
			req.Type,
			visibility,
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
		)

		if err == nil {
			writeJSON(w, http.StatusCreated, piece)
			return
		}

		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) &&
			pgErr.Code == "23505" &&
			pgErr.ConstraintName == "pieces_persona_slug_unique" {
			continue
		}

		writeInternalError(w)
		return
	}

	writeJSON(w, http.StatusConflict, map[string]any{
		"error": map[string]string{
			"code":    "slug_conflict",
			"message": "Could not generate a unique slug. Please try again.",
		},
	})
}

func makePieceSlug(title string) string {
	title = strings.ToLower(strings.TrimSpace(title))
	slug := pieceSlugPattern.ReplaceAllString(title, "-")
	return strings.Trim(slug, "-")
}

func randomPieceSlugSuffix() (string, error) {
	var value [4]byte

	if _, err := rand.Read(value[:]); err != nil {
		return "", err
	}

	return hex.EncodeToString(value[:]), nil
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

	query := `
		SELECT p.id, p.persona_id, p.slug, p.title, p.body,
		       p.type, p.status, p.visibility, p.published_at,
		       p.created_at, p.updated_at
		FROM public.pieces p
		JOIN public.personas persona ON persona.id = p.persona_id
		WHERE persona.user_id = $1::uuid
		ORDER BY p.created_at DESC, p.id DESC
		LIMIT $2
	`

	rows, err := h.DB.Query(r.Context(), query, user.ID, limit)
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

	writeJSON(w, http.StatusOK, PiecePage{
		Items:      items,
		NextCursor: nil,
	})
}

type updatePieceRequest struct {
	Title string `json:"title"`
	Body  string `json:"body"`
	Type  string `json:"type"`
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
	err := h.DB.QueryRow(
		r.Context(),
		`SELECT p.id, p.persona_id, p.slug, p.title, p.body,
		        p.type, p.status, p.visibility, p.published_at,
		        p.created_at, p.updated_at
		 FROM public.pieces p
		 JOIN public.personas persona ON persona.id = p.persona_id
		 WHERE p.id = $1::uuid
		   AND persona.user_id = $2::uuid
		   AND p.status = 'draft'`,
		pieceID,
		user.ID,
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
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, map[string]any{
				"error": map[string]string{
					"code":    "draft_not_found",
					"message": "Draft not found.",
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

	pieceID := chi.URLParam(r, "pieceID")

	var piece Piece
	err := h.DB.QueryRow(
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
		   AND p.status = 'draft'
		 RETURNING p.id, p.persona_id, p.slug, p.title, p.body,
		           p.type, p.status, p.visibility, p.published_at,
		           p.created_at, p.updated_at`,
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
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, map[string]any{
				"error": map[string]string{
					"code":    "draft_not_found",
					"message": "Draft not found or no longer editable.",
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
