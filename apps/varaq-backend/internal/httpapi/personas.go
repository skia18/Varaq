package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skia18/varaq/apps/varaq-backend/internal/auth"
)

type PersonaHandler struct {
	DB *pgxpool.Pool
}

type Persona struct {
	ID          string    `json:"id"`
	Handle      string    `json:"handle"`
	DisplayName string    `json:"displayName"`
	Bio         *string   `json:"bio"`
	CreatedAt   time.Time `json:"createdAt"`
}

type createPersonaRequest struct {
	Handle      string  `json:"handle"`
	DisplayName string  `json:"displayName"`
	Bio         *string `json:"bio"`
}

var handlePattern = regexp.MustCompile(`^[a-z0-9_]{3,30}$`)

func (h PersonaHandler) Create(w http.ResponseWriter, r *http.Request) {
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

	var req createPersonaRequest
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(&req); err != nil {
		writeBadRequest(w, "Invalid JSON request body.")
		return
	}

	req.Handle = strings.TrimSpace(req.Handle)
	req.DisplayName = strings.TrimSpace(req.DisplayName)

	if !handlePattern.MatchString(req.Handle) {
		writeBadRequest(w, "Handle must be 3–30 lowercase letters, numbers, or underscores.")
		return
	}
	if len(req.DisplayName) < 1 || len(req.DisplayName) > 80 {
		writeBadRequest(w, "Display name must contain 1–80 characters.")
		return
	}
	if req.Bio != nil && len(*req.Bio) > 500 {
		writeBadRequest(w, "Bio must contain at most 500 characters.")
		return
	}

	var persona Persona
	err := h.DB.QueryRow(
		r.Context(),
		`INSERT INTO public.personas (user_id, handle, display_name, bio)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, handle, display_name, bio, created_at`,
		user.ID,
		req.Handle,
		req.DisplayName,
		req.Bio,
	).Scan(
		&persona.ID,
		&persona.Handle,
		&persona.DisplayName,
		&persona.Bio,
		&persona.CreatedAt,
	)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			writeJSON(w, http.StatusConflict, map[string]any{
				"error": map[string]string{
					"code":    "handle_unavailable",
					"message": "That handle is already in use.",
				},
			})
			return
		}

		writeInternalError(w)
		return
	}

	writeJSON(w, http.StatusCreated, persona)
}

func (h PersonaHandler) GetByHandle(w http.ResponseWriter, r *http.Request) {
	handle := chi.URLParam(r, "handle")

	var persona Persona
	err := h.DB.QueryRow(
		r.Context(),
		`SELECT id, handle, display_name, bio, created_at
		 FROM public.personas
		 WHERE handle = $1`,
		handle,
	).Scan(
		&persona.ID,
		&persona.Handle,
		&persona.DisplayName,
		&persona.Bio,
		&persona.CreatedAt,
	)

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

	writeJSON(w, http.StatusOK, persona)
}

func (h PersonaHandler) GetMine(w http.ResponseWriter, r *http.Request) {
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

	var persona Persona
	err := h.DB.QueryRow(
		r.Context(),
		`SELECT id, handle, display_name, bio, created_at
		 FROM public.personas
		 WHERE user_id = $1`,
		user.ID,
	).Scan(
		&persona.ID,
		&persona.Handle,
		&persona.DisplayName,
		&persona.Bio,
		&persona.CreatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		writeJSON(w, http.StatusNotFound, map[string]any{
			"error": map[string]string{
				"code":    "persona_not_found",
				"message": "This account has not created a persona yet.",
			},
		})
		return
	}
	if err != nil {
		writeInternalError(w)
		return
	}

	writeJSON(w, http.StatusOK, persona)
}

func writeBadRequest(w http.ResponseWriter, message string) {
	writeJSON(w, http.StatusBadRequest, map[string]any{
		"error": map[string]string{
			"code":    "bad_request",
			"message": message,
		},
	})
}

func writeInternalError(w http.ResponseWriter) {
	writeJSON(w, http.StatusInternalServerError, map[string]any{
		"error": map[string]string{
			"code":    "internal_error",
			"message": "An unexpected error occurred.",
		},
	})
}
