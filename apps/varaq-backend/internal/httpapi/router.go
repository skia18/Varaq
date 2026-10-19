package httpapi

import (
	"net/http"
	"os"
	"strings"

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
	// Allow the local frontend and the configured production frontend.
	allowedOrigins := []string{"http://localhost:5173"}

	if origin := strings.TrimRight(
		strings.TrimSpace(os.Getenv("FRONTEND_ORIGIN")),
		"/",
	); origin != "" {
		allowedOrigins = append(allowedOrigins, origin)
	}

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   allowedOrigins,
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
	pieces := PieceHandler{DB: db}

	r.Route("/api/v1", func(api chi.Router) {
		api.With(authmiddleware.RequireAuth(verifier)).
			Post("/personas", personas.Create)

		api.With(authmiddleware.RequireAuth(verifier)).
			Post("/pieces", pieces.Create)

		api.Get("/feed", pieces.ListFeed)
		api.Get("/pieces/{pieceID}", pieces.GetPublishedPiece)
		api.Group(func(v chi.Router) {
			v.Use(authmiddleware.RequireAuth(verifier))
			v.Get("/owner/pieces/{pieceID}/vault", pieces.ReturnToVault)
			v.Post("/owner/pieces/{pieceID}/vault", pieces.ReturnToVault)
			v.Post("/owner/pieces/{pieceID}/vault/finalize", pieces.FinalizeReturnToVault)
			v.Post("/owner/vault/import", pieces.ImportVault)
			v.Post("/owner/vault/import/{pieceID}/finalize", pieces.ImportVault)
			v.Get("/owner/vault", pieces.VaultConfig)
			v.Put("/owner/vault", pieces.VaultConfig)
			v.Get("/owner/vault/drafts", pieces.VaultDrafts)
			v.Get("/owner/vault/drafts/{pieceID}", pieces.VaultDraft)
			v.Put("/owner/vault/drafts/{pieceID}", pieces.VaultDraft)
			v.Delete("/owner/vault/drafts/{pieceID}", pieces.VaultDraft)
			v.Get("/owner/vault/transfers", pieces.VaultPending)
			v.Get("/owner/vault/transfers/{pieceID}", pieces.VaultTransfer)
			v.Post("/owner/vault/transfers/{pieceID}/finalize", pieces.VaultTransfer)
		})

		api.Get("/personas/{handle}", personas.GetByHandle)
		api.Get("/personas/{handle}/pieces", personas.ListPublicPieces)

		api.With(authmiddleware.RequireAuth(verifier)).
			Get("/me/persona", personas.GetMine)

		api.With(authmiddleware.RequireAuth(verifier)).
			Get("/owner/pieces", pieces.ListOwnerPieces)

		api.With(authmiddleware.RequireAuth(verifier)).
			Get("/owner/pieces/{pieceID}", pieces.GetOwnerPiece)

		api.With(authmiddleware.RequireAuth(verifier)).
			Put("/owner/pieces/{pieceID}", pieces.UpdateOwnerPiece)

		api.With(authmiddleware.RequireAuth(verifier)).
			Post("/owner/pieces/{pieceID}/publish", pieces.PublishOwnerPiece)

		api.With(authmiddleware.RequireAuth(verifier)).
			Delete("/owner/pieces/{pieceID}", pieces.DeleteOwnerPiece)

	})

	return r
}
