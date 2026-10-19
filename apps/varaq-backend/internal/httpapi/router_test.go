package httpapi

import (
	"context"
	"net/http/httptest"
	"testing"

	"github.com/skia18/varaq/apps/varaq-backend/internal/auth"
)

type routerVerifier struct{ t *testing.T }

func (v routerVerifier) VerifyToken(context.Context, string) (auth.User, error) {
	v.t.Fatal("unexpected token verification")
	return auth.User{}, nil
}

func TestRouterProtectsOwnerEndpoints(t *testing.T) {
	router := NewRouter(nil, routerVerifier{t})
	for _, route := range []struct{ method, path string }{
		{"POST", "/api/v1/personas"}, {"POST", "/api/v1/pieces"}, {"GET", "/api/v1/me/persona"},
		{"GET", "/api/v1/owner/pieces"}, {"GET", "/api/v1/owner/pieces/id"}, {"PUT", "/api/v1/owner/pieces/id"},
		{"POST", "/api/v1/owner/pieces/id/publish"}, {"DELETE", "/api/v1/owner/pieces/id"},
	} {
		t.Run(route.method+route.path, func(t *testing.T) {
			w := httptest.NewRecorder()
			router.ServeHTTP(w, httptest.NewRequest(route.method, route.path, nil))
			assertAPIError(t, w, 401, "unauthorized", "valid access token")
		})
	}
}
func TestRouterLivenessAndPublicFeed(t *testing.T) {
	router := NewRouter(nil, routerVerifier{t})
	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest("GET", "/healthz", nil))
	if w.Code != 200 || w.Body.String() != "{\"status\":\"ok\"}\n" {
		t.Fatalf("liveness requires no auth or DB: %d %s", w.Code, w.Body)
	}
	w = httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest("GET", "/api/v1/feed?limit=0", nil))
	assertAPIError(t, w, 400, "bad_request", "Limit")
}
func TestRouterCORS(t *testing.T) {
	t.Setenv("FRONTEND_ORIGIN", " https://varaq.example.test/ ")
	router := NewRouter(nil, routerVerifier{t})
	for _, origin := range []string{"http://localhost:5173", "https://varaq.example.test", "https://untrusted.example.test"} {
		t.Run(origin, func(t *testing.T) {
			r := httptest.NewRequest("OPTIONS", "/api/v1/pieces", nil)
			r.Header.Set("Origin", origin)
			r.Header.Set("Access-Control-Request-Method", "POST")
			r.Header.Set("Access-Control-Request-Headers", "authorization,content-type")
			w := httptest.NewRecorder()
			router.ServeHTTP(w, r)
			want := origin
			if origin == "https://untrusted.example.test" {
				want = ""
			}
			if w.Header().Get("Access-Control-Allow-Origin") != want {
				t.Fatalf("origin %s response headers %v", origin, w.Header())
			}
		})
	}
}
