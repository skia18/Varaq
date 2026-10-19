package middleware

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/skia18/varaq/apps/varaq-backend/internal/auth"
	"net/http"
	"net/http/httptest"
	"testing"
)

type verifierFunc func(context.Context, string) (auth.User, error)

func (f verifierFunc) VerifyToken(ctx context.Context, token string) (auth.User, error) {
	return f(ctx, token)
}

func TestRequireAuthRejectsMissingOrMalformedHeaders(t *testing.T) {
	for _, header := range []string{"", "Bearer", "Bearer   ", "Basic token", "Bearer\ttoken"} {
		t.Run(header, func(t *testing.T) {
			verifier := verifierFunc(func(context.Context, string) (auth.User, error) {
				t.Fatal("verifier must not be called")
				return auth.User{}, nil
			})
			next := http.HandlerFunc(func(http.ResponseWriter, *http.Request) { t.Fatal("protected handler was called") })
			r := httptest.NewRequest("GET", "/private", nil)
			r.Header.Set("Authorization", header)
			w := httptest.NewRecorder()
			RequireAuth(verifier)(next).ServeHTTP(w, r)
			if w.Code != 401 || w.Header().Get("Content-Type") != "application/json" {
				t.Fatalf("unexpected response: %d %s", w.Code, w.Body)
			}
			var response struct{ Error struct{ Code string } }
			if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil || response.Error.Code != "unauthorized" {
				t.Fatalf("invalid error response: %s", w.Body)
			}
		})
	}
}
func TestRequireAuthSetsUserContext(t *testing.T) {
	for _, header := range []string{"Bearer valid-token", "bearer valid-token", "  BEARER valid-token  "} {
		t.Run(header, func(t *testing.T) {
			verified, handled := false, false
			verifier := verifierFunc(func(_ context.Context, token string) (auth.User, error) {
				verified = true
				if token != "valid-token" {
					t.Fatalf("token=%q", token)
				}
				return auth.User{ID: "writer"}, nil
			})
			next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				handled = true
				if user, ok := auth.UserFromContext(r.Context()); !ok || user.ID != "writer" {
					t.Fatal("missing authenticated context")
				}
				w.WriteHeader(204)
			})
			r := httptest.NewRequest("GET", "/private", nil)
			r.Header.Set("Authorization", header)
			w := httptest.NewRecorder()
			RequireAuth(verifier)(next).ServeHTTP(w, r)
			if !verified || !handled || w.Code != 204 {
				t.Fatalf("verified=%v handled=%v status=%d", verified, handled, w.Code)
			}
		})
	}
}
func TestRequireAuthDoesNotExposeVerifierErrors(t *testing.T) {
	verifier := verifierFunc(func(context.Context, string) (auth.User, error) { return auth.User{}, errors.New("private diagnostic") })
	next := http.HandlerFunc(func(http.ResponseWriter, *http.Request) { t.Fatal("protected handler called") })
	r := httptest.NewRequest("GET", "/private", nil)
	r.Header.Set("Authorization", "Bearer invalid")
	w := httptest.NewRecorder()
	RequireAuth(verifier)(next).ServeHTTP(w, r)
	if w.Code != 401 || w.Body.String() != `{"error":{"code":"unauthorized","message":"A valid access token is required."}}` {
		t.Fatalf("unexpected response: %d %s", w.Code, w.Body)
	}
}
