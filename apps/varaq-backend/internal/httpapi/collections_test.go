package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skia18/varaq/apps/varaq-backend/internal/auth"
)

func TestCollectionsRequireAuthentication(t *testing.T) {
	router := NewRouter(nil, routerVerifier{t})
	for _, route := range []struct{ method, path string }{{"GET", "/api/v1/collections"}, {"POST", "/api/v1/collections"}, {"PUT", "/api/v1/collections/id"}, {"DELETE", "/api/v1/collections/id"}, {"PUT", "/api/v1/collections/id/pieces/id"}, {"DELETE", "/api/v1/collections/id/pieces/id"}} {
		w := httptest.NewRecorder()
		router.ServeHTTP(w, httptest.NewRequest(route.method, route.path, nil))
		if w.Code != 401 {
			t.Fatalf("%s %s: %d", route.method, route.path, w.Code)
		}
	}
}
func TestCollectionValidation(t *testing.T) {
	for _, in := range []collectionInput{{Name: "", Visibility: "private"}, {Name: "  ", Visibility: "private"}, {Name: strings.Repeat("a", 101), Visibility: "private"}, {Name: "Test", Visibility: "unlisted"}, {Name: "Test", Visibility: "public", PieceID: "bad"}, {Name: "Test", Visibility: "private", Description: strings.Repeat("x", 1001)}} {
		if validCollection(in) {
			t.Fatalf("accepted invalid input: %+v", in)
		}
	}
	if !validCollection(collectionInput{Name: "After Midnight", Visibility: "private"}) {
		t.Fatal("rejected valid collection")
	}
}

func TestCollectionsDatabaseLifecycle(t *testing.T) {
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
	user, other, persona, piece := testUUID(), testUUID(), testUUID(), testUUID()
	for _, id := range []string{user, other} {
		if _, err = db.Exec(ctx, `INSERT INTO auth.users(id) VALUES($1)`, id); err != nil {
			t.Fatal(err)
		}
	}
	defer db.Exec(ctx, `DELETE FROM auth.users WHERE id IN($1,$2)`, user, other)
	if _, err = db.Exec(ctx, `INSERT INTO public.personas(id,user_id,handle,display_name) VALUES($1,$2,$3,'Test')`, persona, user, "c"+strings.ReplaceAll(persona, "-", "")[:20]); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, `INSERT INTO public.pieces(id,persona_id,slug,title,body,type,status,visibility,published_at) VALUES($1,$2,'collection-test','Test','Test body','poem','published','public',now())`, piece, persona); err != nil {
		t.Fatal(err)
	}
	h := CollectionHandler{DB: db}
	call := func(fn http.HandlerFunc, method, cid, pid, uid, body string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, "/", strings.NewReader(body))
		r = r.WithContext(auth.WithUser(r.Context(), auth.User{ID: uid}))
		rc := chi.NewRouteContext()
		rc.URLParams.Add("collectionID", cid)
		rc.URLParams.Add("pieceID", pid)
		r = r.WithContext(context.WithValue(r.Context(), chi.RouteCtxKey, rc))
		w := httptest.NewRecorder()
		fn(w, r)
		return w
	}
	require := func(w *httptest.ResponseRecorder, status int) {
		t.Helper()
		if w.Code != status {
			t.Fatalf("got %d want %d: %s", w.Code, status, w.Body)
		}
	}
	var saved string
	if err = db.QueryRow(ctx, `SELECT id FROM public.collections WHERE user_id=$1 AND system_type='saved'`, user).Scan(&saved); err != nil {
		t.Fatal(err)
	}
	require(call(h.List, "GET", "", "", user, ""), 200)
	require(call(h.List, "GET", "", "", user, ""), 200)
	var count int
	if err = db.QueryRow(ctx, `SELECT count(*) FROM public.collections WHERE user_id=$1 AND system_type='saved'`, user).Scan(&count); err != nil || count != 1 {
		t.Fatalf("Saved count %d: %v", count, err)
	}
	require(call(h.Delete, "DELETE", saved, "", user, ""), 404)
	require(call(h.Update, "PUT", saved, "", user, `{"name":"Renamed","visibility":"public"}`), 404)
	if _, err = db.Exec(ctx, `UPDATE public.collections SET visibility='public' WHERE id=$1`, saved); err == nil {
		t.Fatal("database allowed public Saved")
	}
	if _, err = db.Exec(ctx, `DELETE FROM public.collections WHERE id=$1`, saved); err == nil {
		t.Fatal("database allowed deleting Saved")
	}
	require(call(h.Public, "GET", saved, "", other, ""), 404)
	require(call(h.Membership, "PUT", saved, piece, user, ""), 204)
	require(call(h.Membership, "PUT", saved, piece, user, ""), 204)
	if err = db.QueryRow(ctx, `SELECT count(*) FROM public.collection_items WHERE collection_id=$1`, saved).Scan(&count); err != nil || count != 1 {
		t.Fatalf("duplicate save count %d: %v", count, err)
	}
	w := call(h.Create, "POST", "", "", user, `{"name":"After Midnight","pieceId":"`+piece+`"}`)
	require(w, 201)
	var custom Collection
	if json.Unmarshal(w.Body.Bytes(), &custom) != nil {
		t.Fatal("invalid collection response")
	}
	if custom.Visibility != "private" || len(custom.PieceIDs) != 1 {
		t.Fatalf("bad new collection: %+v", custom)
	}
	require(call(h.Public, "GET", custom.ID, "", other, ""), 404)
	require(call(h.Update, "PUT", custom.ID, "", other, `{"name":"Stolen","visibility":"public"}`), 404)
	require(call(h.Delete, "DELETE", custom.ID, "", other, ""), 404)
	require(call(h.Membership, "DELETE", custom.ID, piece, other, ""), 404)
	require(call(h.Membership, "PUT", custom.ID, piece, other, ""), 404)
	require(call(h.Update, "PUT", custom.ID, "", user, `{"name":"After Midnight","visibility":"public"}`), 204)
	require(call(h.Public, "GET", custom.ID, "", other, ""), 200)
	require(call(h.Membership, "DELETE", saved, piece, user, ""), 204)
	if err = db.QueryRow(ctx, `SELECT count(*) FROM public.collection_items WHERE collection_id=$1 AND piece_id=$2`, custom.ID, piece).Scan(&count); err != nil || count != 1 {
		t.Fatal("unsaving changed custom membership")
	}
	// Visibility changes hide stale references without revealing cached writing.
	if _, err = db.Exec(ctx, `UPDATE public.pieces SET visibility='unlisted' WHERE id=$1`, piece); err != nil {
		t.Fatal(err)
	}
	w = call(h.Public, "GET", custom.ID, "", other, "")
	require(w, 200)
	var public Collection
	_ = json.Unmarshal(w.Body.Bytes(), &public)
	if len(public.PieceIDs) != 0 {
		t.Fatal("unavailable piece exposed")
	}
	require(call(h.Membership, "PUT", saved, piece, user, ""), 400)
	require(call(h.Create, "POST", "", "", user, `{"name":"Rollback","pieceId":"`+piece+`"}`), 400)
	if err = db.QueryRow(ctx, `SELECT count(*) FROM public.collections WHERE user_id=$1 AND name='Rollback'`, user).Scan(&count); err != nil || count != 0 {
		t.Fatal("create with unavailable piece did not roll back")
	}
	require(call(h.Delete, "DELETE", custom.ID, "", user, ""), 204)
	if err = db.QueryRow(ctx, `SELECT count(*) FROM public.pieces WHERE id=$1`, piece).Scan(&count); err != nil || count != 1 {
		t.Fatal("deleting collection deleted original")
	}
	if err = db.QueryRow(ctx, `SELECT count(*) FROM public.collection_items WHERE collection_id=$1`, custom.ID).Scan(&count); err != nil || count != 0 {
		t.Fatal("memberships not cleaned up")
	}
}
