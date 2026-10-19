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
	for _, route := range []struct{ method, path string }{{"GET", "/owner/vault"}, {"PUT", "/owner/vault"}, {"GET", "/owner/vault/drafts"}, {"PUT", "/owner/vault/drafts/id"}, {"DELETE", "/owner/vault/drafts/id"}, {"GET", "/owner/vault/transfers"}, {"POST", "/owner/vault/transfers/id/finalize"}, {"POST", "/owner/vault/import"}} {
		w := httptest.NewRecorder()
		router.ServeHTTP(w, httptest.NewRequest(route.method, "/api/v1"+route.path, nil))
		if w.Code != 401 {
			t.Fatalf("unprotected %s: %d", route.path, w.Code)
		}
	}
}
