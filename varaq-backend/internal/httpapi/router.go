package httpapi

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct {
	DB *pgxpool.Pool
}

func NewRouter(pool *pgxpool.Pool) http.Handler {
	h := &Handler{DB: pool}
	r := chi.NewRouter()
	r.Get("/healthz", h.health)
	r.Get("/readyz", h.ready)
	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/feed", h.feed)
	})
	return r
}

type healthResponse struct {
	Status string `json:"status"`
}

func (h *Handler) health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, healthResponse{Status: "ok"})
}

func (h *Handler) ready(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := contextWithTimeout(r, 2*time.Second)
	defer cancel()
	if err := h.DB.Ping(ctx); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "not_ready"})
		return
	}
	writeJSON(w, http.StatusOK, healthResponse{Status: "ready"})
}

func (h *Handler) feed(w http.ResponseWriter, r *http.Request) {
	// Placeholder until the feed query and cursor-pagination contract are added.
	writeJSON(w, http.StatusOK, map[string]any{"items": []any{}, "next_cursor": nil})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
