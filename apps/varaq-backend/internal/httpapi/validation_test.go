package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/skia18/varaq/apps/varaq-backend/internal/auth"
)

func assertAPIError(t *testing.T, w *httptest.ResponseRecorder, status int, code, message string) {
	t.Helper()
	if w.Code != status {
		t.Fatalf("status=%d want=%d body=%s", w.Code, status, w.Body)
	}
	if w.Header().Get("Content-Type") != "application/json" {
		t.Fatalf("non-JSON response: %s", w.Header())
	}
	var response struct {
		Error struct{ Code, Message string }
	}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if response.Error.Code != code || !strings.Contains(response.Error.Message, message) {
		t.Fatalf("unexpected response: %s", w.Body)
	}
}
func authenticatedRequest(body string) *http.Request {
	r := httptest.NewRequest("POST", "/", strings.NewReader(body))
	return r.WithContext(auth.WithUser(r.Context(), auth.User{ID: "00000000-0000-4000-8000-000000000001"}))
}
func TestProtectedHandlersRejectMissingUser(t *testing.T) {
	for name, handler := range map[string]http.HandlerFunc{
		"create persona": PersonaHandler{}.Create, "get persona": PersonaHandler{}.GetMine,
		"list owner pieces": PieceHandler{}.ListOwnerPieces,
		"get owner piece":   PieceHandler{}.GetOwnerPiece, "update owner piece": PieceHandler{}.UpdateOwnerPiece,
		"publish owner piece": PieceHandler{}.PublishOwnerPiece, "delete owner piece": PieceHandler{}.DeleteOwnerPiece,
	} {
		t.Run(name, func(t *testing.T) {
			w := httptest.NewRecorder()
			handler(w, httptest.NewRequest("POST", "/", strings.NewReader(`{}`)))
			assertAPIError(t, w, 401, "unauthorized", "valid access token")
		})
	}
}
func TestPieceWriteValidation(t *testing.T) {
	for _, tc := range []struct{ body, message string }{
		{`{`, "Invalid JSON"}, {`{"unexpected":true}`, "Invalid JSON"}, {`{} {}`, "single JSON object"},
		{`{"title":"  ","body":"text","type":"poem"}`, "Title"},
		{`{"title":"Title","body":" ","type":"poem"}`, "Body"},
		{`{"title":"Title","body":"text","type":"unknown"}`, "Type"},
	} {
		w := httptest.NewRecorder()
		PieceHandler{}.UpdateOwnerPiece(w, authenticatedRequest(tc.body))
		assertAPIError(t, w, 400, "bad_request", tc.message)
	}
}
func TestPersonaValidation(t *testing.T) {
	for _, tc := range []struct {
		name    string
		input   map[string]any
		message string
	}{
		{"short handle", map[string]any{"handle": "ab", "displayName": "Writer"}, "Handle"},
		{"uppercase handle", map[string]any{"handle": "Writer", "displayName": "Writer"}, "Handle"},
		{"invalid handle characters", map[string]any{"handle": "my-writer", "displayName": "Writer"}, "Handle"},
		{"long handle", map[string]any{"handle": strings.Repeat("a", 31), "displayName": "Writer"}, "Handle"},
		{"blank display name", map[string]any{"handle": "writer", "displayName": "   "}, "Display name"},
		{"long display name", map[string]any{"handle": "writer", "displayName": strings.Repeat("a", 81)}, "Display name"},
		{"long bio", map[string]any{"handle": "writer", "displayName": "Writer", "bio": strings.Repeat("a", 501)}, "Bio"},
		{"unknown field", map[string]any{"handle": "writer", "displayName": "Writer", "isAdmin": true}, "Invalid JSON"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			data, err := json.Marshal(tc.input)
			if err != nil {
				t.Fatal(err)
			}
			w := httptest.NewRecorder()
			PersonaHandler{}.Create(w, authenticatedRequest(string(data)))
			assertAPIError(t, w, 400, "bad_request", tc.message)
		})
	}
}
func TestPaginationRejectsInvalidInputsBeforeDatabaseAccess(t *testing.T) {
	for _, query := range []string{"limit=0", "limit=51", "limit=abc"} {
		t.Run(query, func(t *testing.T) {
			for _, owner := range []bool{false, true} {
				r := authenticatedRequest("")
				r.URL.RawQuery = query
				w := httptest.NewRecorder()
				if owner {
					PieceHandler{}.ListOwnerPieces(w, r)
				} else {
					PersonaHandler{}.ListPublicPieces(w, r)
				}
				assertAPIError(t, w, 400, "bad_request", "Limit")
			}
		})
	}
	w := httptest.NewRecorder()
	r := httptest.NewRequest("GET", "/?cursor=invalid", nil)
	PersonaHandler{}.ListPublicPieces(w, r)
	assertAPIError(t, w, 400, "bad_request", "cursor")
}
func TestSlugs(t *testing.T) {
	for input, want := range map[string]string{" A Page of My Own! ": "a-page-of-my-own", "one___two---three": "one-two-three", "123": "123", "ورق": "", "---": ""} {
		if got := makePieceSlug(input); got != want {
			t.Errorf("slug(%q)=%q want %q", input, got, want)
		}
	}

}
func TestInternalErrorIsGeneric(t *testing.T) {
	w := httptest.NewRecorder()
	writeInternalError(w)
	assertAPIError(t, w, 500, "internal_error", "unexpected error")
	if bytes.Contains(w.Body.Bytes(), []byte("postgres")) {
		t.Fatal("database diagnostics exposed")
	}
}
