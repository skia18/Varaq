package httpapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skia18/varaq/apps/varaq-backend/internal/auth"
	authmiddleware "github.com/skia18/varaq/apps/varaq-backend/internal/httpapi/middleware"
)

func NewRouter(db *pgxpool.Pool, verifier auth.Verifier) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Get("/healthz", (HealthHandler{DB: db}).Liveness)
	r.Get("/readyz", (HealthHandler{DB: db}).Readiness)

	personas := PersonaHandler{DB: db}

	r.Route("/api/v1", func(api chi.Router) {
		api.Post("/personas", authmiddleware.RequireAuth(verifier)(http.HandlerFunc(personas.Create)).ServeHTTP)
		api.Get("/personas/{handle}", personas.GetByHandle)

		api.With(authmiddleware.RequireAuth(verifier)).Get("/me/persona", personas.GetMine)
	})

	return r
}
