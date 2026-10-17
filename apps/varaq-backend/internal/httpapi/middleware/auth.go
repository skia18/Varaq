package middleware

import (
	"net/http"
	"strings"

	"github.com/skia18/varaq/apps/varaq-backend/internal/auth"
)

func RequireAuth(verifier auth.Verifier) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := strings.TrimSpace(r.Header.Get("Authorization"))
			parts := strings.SplitN(header, " ", 2)

			if len(parts) != 2 ||
				!strings.EqualFold(parts[0], "Bearer") ||
				strings.TrimSpace(parts[1]) == "" {
				writeUnauthorized(w)
				return
			}

			user, err := verifier.VerifyToken(r.Context(), parts[1])
			if err != nil {
				writeUnauthorized(w)
				return
			}

			ctx := auth.WithUser(r.Context(), user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func writeUnauthorized(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	_, _ = w.Write([]byte(
		`{"error":{"code":"unauthorized","message":"A valid access token is required."}}`,
	))
}
