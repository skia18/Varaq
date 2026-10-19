package httpapi

import (
	"encoding/base64"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestVaultEnvelopeValidation(t *testing.T) {
	value := sealedValue{IV: base64.StdEncoding.EncodeToString(make([]byte, 12)), Data: base64.StdEncoding.EncodeToString(make([]byte, 48))}
	if !validSealed(value, 48) {
		t.Fatal("valid key wrapper rejected")
	}
	value.IV = base64.StdEncoding.EncodeToString(make([]byte, 11))
	if validSealed(value, 48) {
		t.Fatal("invalid nonce accepted")
	}
	value.IV = base64.StdEncoding.EncodeToString(make([]byte, 12))
	value.Data = base64.StdEncoding.EncodeToString(make([]byte, 49))
	if validSealed(value, 48) {
		t.Fatal("oversized wrapper accepted")
	}
}
func TestVaultDecoderRejectsPlaintextAndTrailingJSON(t *testing.T) {
	for _, body := range []string{`{"title":"plaintext"}`, `{"version":1} {}`, strings.Repeat("x", 400001)} {
		r := httptest.NewRequest("PUT", "/", strings.NewReader(body))
		w := httptest.NewRecorder()
		var env vaultEnvelope
		if decodeVault(w, r, &env) {
			t.Fatalf("accepted invalid request")
		}
	}
}
func TestRouterProtectsVault(t *testing.T) {
	router := NewRouter(nil, routerVerifier{t})
	for _, route := range []struct{ method, path string }{{"GET", "/owner/vault"}, {"PUT", "/owner/vault"}, {"GET", "/owner/vault/drafts"}, {"PUT", "/owner/vault/drafts/id"}, {"DELETE", "/owner/vault/drafts/id"}, {"GET", "/owner/vault/transfers"}, {"POST", "/owner/vault/transfers/id/finalize"}, {"GET", "/owner/pieces/id/vault"}, {"POST", "/owner/pieces/id/vault"}, {"POST", "/owner/pieces/id/vault/finalize"}} {
		w := httptest.NewRecorder()
		router.ServeHTTP(w, httptest.NewRequest(route.method, "/api/v1"+route.path, nil))
		if w.Code != 401 {
			t.Fatalf("unprotected %s: %d", route.path, w.Code)
		}
	}
}

func TestOwnerPieceFiltersRejectInvalidInputs(t *testing.T) {
	for _, query := range []string{"status=unknown", "status=draft", "personaId=invalid", "cursor=invalid", "cursor=e30"} {
		r := authenticatedRequest("")
		r.URL.RawQuery = query
		w := httptest.NewRecorder()
		PieceHandler{}.ListOwnerPieces(w, r)
		if w.Code != 400 {
			t.Fatalf("query %s: %d %s", query, w.Code, w.Body.String())
		}
	}
}

func TestRemovedDraftEndpoints(t *testing.T) {
	router := NewRouter(nil, routerVerifier{t})
	for _, path := range []string{"/api/v1/pieces", "/api/v1/owner/vault/import", "/api/v1/owner/vault/import/00000000-0000-4000-8000-000000000001/finalize"} {
		w := httptest.NewRecorder()
		router.ServeHTTP(w, httptest.NewRequest("POST", path, strings.NewReader(`{}`)))
		if w.Code != 404 && w.Code != 405 {
			t.Fatalf("retired endpoint %s returned %d", path, w.Code)
		}
	}
	w := httptest.NewRecorder()
	PieceHandler{}.PublishOwnerPiece(w, authenticatedRequest(""))
	if w.Code != 400 {
		t.Fatalf("publication without a Vault snapshot returned %d", w.Code)
	}
}
