package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skia18/varaq/apps/varaq-backend/internal/store"
)

type HealthHandler struct {
	DB *pgxpool.Pool
}

func (h HealthHandler) Liveness(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status": "ok",
	})
}

func (h HealthHandler) Readiness(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()

	if err := store.CheckDatabase(ctx, h.DB); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{
			"status":   "not_ready",
			"database": "unavailable",
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"status":   "ok",
		"database": "connected",
	})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
