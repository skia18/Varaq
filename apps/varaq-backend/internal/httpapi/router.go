package httpapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/skia18/varaq/apps/varaq-backend/internal/auth"
	authmiddleware "github.com/skia18/varaq/apps/varaq-backend/internal/httpapi/middleware"
)

func NewRouter(db *pgxpool.Pool, verifier auth.Verifier) http.Handler {
	r := chi.NewRouter()

	// Allow the Vite development frontend to call the Go API.
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:5173"},
		AllowedMethods:   []string{"GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	r.Use(chimiddleware.RequestID)
	r.Use(chimiddleware.RealIP)
	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)

	health := HealthHandler{DB: db}
	r.Get("/healthz", health.Liveness)
	r.Get("/readyz", health.Readiness)

	personas := PersonaHandler{DB: db}

	r.Route("/api/v1", func(api chi.Router) {
		api.With(authmiddleware.RequireAuth(verifier)).
			Post("/personas", personas.Create)

		api.Get("/personas/{handle}", personas.GetByHandle)
		api.Get("/personas/{handle}/pieces", personas.ListPublicPieces)

		api.With(authmiddleware.RequireAuth(verifier)).
			Get("/me/persona", personas.GetMine)
	})

	return r
}
