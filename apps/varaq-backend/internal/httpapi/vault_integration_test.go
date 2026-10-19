package httpapi

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skia18/varaq/apps/varaq-backend/internal/auth"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"
)

func testUUID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[:4], b[4:6], b[6:8], b[8:10], b[10:])
}
func TestVaultDatabaseLifecycle(t *testing.T) {
	url := os.Getenv("VARAQ_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("set VARAQ_TEST_DATABASE_URL to an isolated migrated database")
	}
	ctx := context.Background()
	db, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	user, other, persona, id := testUUID(), testUUID(), testUUID(), testUUID()
	for _, u := range []string{user, other} {
		if _, err = db.Exec(ctx, `INSERT INTO auth.users(id) VALUES($1::uuid)`, u); err != nil {
			t.Fatal(err)
		}
	}
	defer db.Exec(ctx, `DELETE FROM auth.users WHERE id IN($1::uuid,$2::uuid)`, user, other)
	if _, err = db.Exec(ctx, `INSERT INTO public.personas(id,user_id,handle,display_name) VALUES($1::uuid,$2::uuid,$3,'Test')`, persona, user, "t"+strings.ReplaceAll(persona, "-", "")[:20]); err != nil {
		t.Fatal(err)
	}
	h := PieceHandler{DB: db}
	call := func(handler http.HandlerFunc, method, id, uid string, body any) *httptest.ResponseRecorder {
		var raw string
		if body != nil {
			b, e := json.Marshal(body)
			if e != nil {
				t.Fatal(e)
			}
			raw = string(b)
		}
		r := httptest.NewRequest(method, "/", strings.NewReader(raw))
		r = r.WithContext(auth.WithUser(r.Context(), auth.User{ID: uid}))
		rc := chi.NewRouteContext()
		rc.URLParams.Add("pieceID", id)
		r = r.WithContext(context.WithValue(r.Context(), chi.RouteCtxKey, rc))
		w := httptest.NewRecorder()
		handler(w, r)
		return w
	}
	require := func(w *httptest.ResponseRecorder, status int) {
		t.Helper()
		if w.Code != status {
			t.Fatalf("status %d expected %d: %s", w.Code, status, w.Body.String())
		}
	}
	b64 := func(n int) string { return base64.StdEncoding.EncodeToString(make([]byte, n)) }
	sealed := sealedValue{IV: b64(12), Data: b64(48)}
	config := vaultConfig{Version: 1, Salt: b64(16), Passphrase: sealed, Recovery: sealed}
	require(call(h.VaultConfig, "PUT", "", user, map[string]any{"config": config, "revision": 0}), 200)
	require(call(h.VaultConfig, "PUT", "", user, map[string]any{"config": config, "revision": 0}), 409)
	require(call(h.VaultConfig, "PUT", "", user, map[string]any{"config": config, "revision": 1}), 200)
	require(call(h.VaultConfig, "PUT", "", user, map[string]any{"config": config, "revision": 1}), 409)
	env := vaultEnvelope{Version: 1, Key: sealed, Content: sealed}
	save := map[string]any{"personaId": persona, "revision": 0, "envelope": env}
	require(call(h.VaultDraft, "PUT", id, user, save), 200)
	require(call(h.VaultDraft, "PUT", id, user, save), 200)
	require(call(h.VaultDraft, "GET", id, other, nil), 404)
	require(call(h.VaultDraft, "PUT", id, other, save), 409)
	changed := env
	changed.Content.Data = b64(49)
	save["envelope"] = changed
	require(call(h.VaultDraft, "PUT", id, user, save), 409)
	save["revision"] = 1
	require(call(h.VaultDraft, "PUT", id, user, save), 200)
	require(call(h.VaultDraft, "DELETE", id, user, map[string]int{"revision": 1}), 409)
	snapshot := publishVaultRequest{OperationID: testUUID(), SourceRevision: 1, Title: "Published title", Body: "Published body", Type: "poem", Visibility: "unlisted"}
	require(call(h.PublishVault, "POST", id, user, snapshot), 409)
	snapshot.SourceRevision = 2
	require(call(h.PublishVault, "POST", id, user, snapshot), 200)
	require(call(h.PublishVault, "POST", id, user, snapshot), 200)
	var count int
	if err = db.QueryRow(ctx, `SELECT count(*) FROM public.pieces WHERE id=$1::uuid`, id).Scan(&count); err != nil || count != 1 {
		t.Fatalf("publication count %d %v", count, err)
	}
	require(call(h.VaultDraft, "PUT", id, user, save), 409)
	list := call(h.VaultDrafts, "GET", "", user, nil)
	require(list, 200)
	if strings.Contains(list.Body.String(), id) {
		t.Fatal("published source remains in active Vault")
	}
	require(call(h.GetPublishedPiece, "GET", id, "", nil), 200)
	require(call(h.VaultTransfer, "POST", id, other, nil), 404)
	var kept bool
	_ = db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM varaq_private.vault_drafts WHERE id=$1::uuid)`, id).Scan(&kept)
	if !kept {
		t.Fatal("unauthorized finalize deleted source")
	}
	require(call(h.VaultTransfer, "POST", id, user, nil), 204)
	require(call(h.VaultTransfer, "POST", id, user, nil), 204)
	require(call(h.PublishVault, "POST", id, user, snapshot), 200)
	conflict := snapshot
	conflict.Visibility = "public"
	require(call(h.PublishVault, "POST", id, user, conflict), 409)
	require(call(h.VaultTransfer, "GET", id, user, nil), 200)
	if _, err = db.Exec(ctx, `DELETE FROM public.pieces WHERE id=$1::uuid`, id); err != nil {
		t.Fatal(err)
	}
	require(call(h.PublishVault, "POST", id, user, snapshot), 200)
	_ = db.QueryRow(ctx, `SELECT count(*) FROM public.pieces WHERE id=$1::uuid`, id).Scan(&count)
	if count != 0 {
		t.Fatal("retry resurrected publication")
	}
	unpublished := testUUID()
	save["revision"] = 0
	require(call(h.VaultDraft, "PUT", unpublished, user, save), 200)
	require(call(h.VaultTransfer, "POST", unpublished, user, nil), 404)
	require(call(h.VaultDraft, "GET", unpublished, user, nil), 200)
	snapshot.OperationID = testUUID()
	snapshot.SourceRevision = 1
	snapshot.Visibility = "public"
	require(call(h.PublishVault, "POST", unpublished, user, snapshot), 200)
	_, err = db.Exec(ctx, `UPDATE varaq_private.publication_operations SET published_at=now()-interval '10 minutes' WHERE draft_id=$1::uuid`, unpublished)
	if err != nil {
		t.Fatal(err)
	}
	if err = ReconcileVaultTransfers(ctx, db); err != nil {
		t.Fatal(err)
	}
	_ = db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM varaq_private.vault_drafts WHERE id=$1::uuid)`, unpublished).Scan(&kept)
	if kept {
		t.Fatal("cleanup left ciphertext")
	}
	for _, role := range []string{"anon", "authenticated", "service_role"} {
		for _, table := range []string{"public.pieces", "public.personas", "varaq_private.vault_drafts", "varaq_private.vaults", "varaq_private.publication_operations"} {
			for _, priv := range []string{"SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "TRIGGER", "REFERENCES"} {
				var allowed bool
				if err = db.QueryRow(ctx, `SELECT has_table_privilege($1,$2,$3)`, role, table, priv).Scan(&allowed); err != nil || allowed {
					t.Fatalf("privilege %s %s %s allowed=%v err=%v", role, table, priv, allowed, err)
				}
			}
		}
	}
	legacy := testUUID()
	var stamp time.Time
	err = db.QueryRow(ctx, `INSERT INTO public.pieces(id,persona_id,slug,title,body,type) VALUES($1::uuid,$2::uuid,$3,'Legacy','Legacy body','poem') RETURNING updated_at`, legacy, persona, legacy).Scan(&stamp)
	if err != nil {
		t.Fatal(err)
	}
	require(call(h.ImportVault, "POST", "", user, map[string]any{"id": legacy, "updatedAt": stamp, "envelope": env}), 204)
	require(call(h.VaultDraft, "GET", legacy, user, nil), 200)
	require(call(h.ImportVault, "POST", legacy, user, map[string]any{"updatedAt": stamp}), 204)
	_ = db.QueryRow(ctx, `SELECT count(*) FROM public.pieces WHERE id=$1::uuid`, legacy).Scan(&count)
	if count != 0 {
		t.Fatal("legacy plaintext retained")
	}
	// Two requests racing on an unpublished source must commit only one piece.
	concurrent := testUUID()
	save["revision"] = 0
	require(call(h.VaultDraft, "PUT", concurrent, user, save), 200)
	raceSnapshot := snapshot
	raceSnapshot.OperationID = testUUID()
	raceSnapshot.SourceRevision = 1
	results := make(chan *httptest.ResponseRecorder, 2)
	go func() { results <- call(h.PublishVault, "POST", concurrent, user, raceSnapshot) }()
	go func() { results <- call(h.PublishVault, "POST", concurrent, user, raceSnapshot) }()
	require(<-results, 200)
	require(<-results, 200)
	_ = db.QueryRow(ctx, `SELECT count(*) FROM public.pieces WHERE id=$1::uuid`, concurrent).Scan(&count)
	if count != 1 {
		t.Fatal("concurrent duplicate publication")
	}
	// A database failure rolls back publication and keeps the encrypted draft.
	failed := testUUID()
	require(call(h.VaultDraft, "PUT", failed, user, save), 200)
	if _, err = db.Exec(ctx, `CREATE OR REPLACE FUNCTION varaq_private.test_reject_publish() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.title='INJECT_FAILURE' THEN RAISE EXCEPTION 'test failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER test_reject_publish BEFORE INSERT ON public.pieces FOR EACH ROW EXECUTE FUNCTION varaq_private.test_reject_publish()`); err != nil {
		t.Fatal(err)
	}
	broken := snapshot
	broken.OperationID = testUUID()
	broken.Title = "INJECT_FAILURE"
	broken.SourceRevision = 1
	w := call(h.PublishVault, "POST", failed, user, broken)
	_, cleanupErr := db.Exec(ctx, `DROP TRIGGER test_reject_publish ON public.pieces; DROP FUNCTION varaq_private.test_reject_publish()`)
	if cleanupErr != nil {
		t.Fatal(cleanupErr)
	}
	require(w, 500)
	require(call(h.VaultDraft, "GET", failed, user, nil), 200)
	_ = db.QueryRow(ctx, `SELECT count(*) FROM varaq_private.publication_operations WHERE draft_id=$1::uuid`, failed).Scan(&count)
	if count != 0 {
		t.Fatal("failed transaction recorded successful publication")
	}
	// Finalizing an import whose legacy source changed must preserve that source.
	modified := testUUID()
	err = db.QueryRow(ctx, `INSERT INTO public.pieces(id,persona_id,slug,title,body,type) VALUES($1::uuid,$2::uuid,$3,'Legacy','Original','poem') RETURNING updated_at`, modified, persona, modified).Scan(&stamp)
	if err != nil {
		t.Fatal(err)
	}
	require(call(h.ImportVault, "POST", "", user, map[string]any{"id": modified, "updatedAt": stamp, "envelope": env}), 204)
	_, err = db.Exec(ctx, `UPDATE public.pieces SET body='Changed' WHERE id=$1::uuid`, modified)
	if err != nil {
		t.Fatal(err)
	}
	require(call(h.ImportVault, "POST", modified, user, map[string]any{"updatedAt": stamp}), 409)
	_ = db.QueryRow(ctx, `SELECT count(*) FROM public.pieces WHERE id=$1::uuid`, modified).Scan(&count)
	if count != 1 {
		t.Fatal("changed legacy source was deleted")
	}

}
