package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestDiscoveryRejectsInvalidPagination(t *testing.T) {
	for _, query := range []string{"limit=0", "limit=51", "limit=no", "cursor=bad", "cursor=e30"} {
		for _, handler := range []http.HandlerFunc{PersonaHandler{}.Search, CollectionHandler{}.ListPublicByPersona} {
			w := httptest.NewRecorder()
			handler(w, httptest.NewRequest("GET", "/?"+query, nil))
			if w.Code != 400 {
				t.Fatalf("%s: %d %s", query, w.Code, w.Body)
			}
		}
	}
	w := httptest.NewRecorder()
	PersonaHandler{}.Search(w, httptest.NewRequest("GET", "/?q="+strings.Repeat("x", 301), nil))
	assertAPIError(t, w, 400, "bad_request", "Search")
}

func TestPublicDiscoveryDatabaseLifecycle(t *testing.T) {
	databaseURL := os.Getenv("VARAQ_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("set VARAQ_TEST_DATABASE_URL to an isolated migrated database")
	}
	ctx := context.Background()
	db, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	user, other := testUUID(), testUUID()
	handle := "d" + strings.ReplaceAll(user, "-", "")[:16]
	for i, id := range []string{user, other} {
		if _, err = db.Exec(ctx, `INSERT INTO auth.users(id) VALUES($1)`, id); err != nil {
			t.Fatal(err)
		}
		defer db.Exec(ctx, `DELETE FROM auth.users WHERE id=$1`, id)
		suffix := ""
		if i == 1 {
			suffix = "x"
		}
		if _, err = db.Exec(ctx, `INSERT INTO public.personas(user_id,handle,display_name) VALUES($1,$2,$3)`, id, handle+suffix, "Writer "+handle); err != nil {
			t.Fatal(err)
		}
	}
	call := func(handler http.HandlerFunc, query string) *httptest.ResponseRecorder {
		r := httptest.NewRequest("GET", "/?"+query, nil)
		rc := chi.NewRouteContext()
		rc.URLParams.Add("handle", handle)
		r = r.WithContext(context.WithValue(r.Context(), chi.RouteCtxKey, rc))
		w := httptest.NewRecorder()
		handler(w, r)
		if w.Code != 200 {
			t.Fatalf("status %d: %s", w.Code, w.Body)
		}
		return w
	}
	var people struct {
		Items      []Persona `json:"items"`
		NextCursor *string   `json:"nextCursor"`
	}
	w := call(PersonaHandler{DB: db}.Search, "q=@"+strings.ToUpper(handle)+"&limit=1")
	if err = json.Unmarshal(w.Body.Bytes(), &people); err != nil {
		t.Fatal(err)
	}
	if len(people.Items) != 1 || people.Items[0].Handle != handle || people.NextCursor == nil {
		t.Fatalf("exact match/pagination: %s", w.Body)
	}
	w = call(PersonaHandler{DB: db}.Search, "q="+handle+"&limit=1&cursor="+url.QueryEscape(*people.NextCursor))
	if err = json.Unmarshal(w.Body.Bytes(), &people); err != nil {
		t.Fatal(err)
	}
	if len(people.Items) != 1 || people.Items[0].Handle != handle+"x" || people.NextCursor != nil {
		t.Fatalf("second page: %s", w.Body)
	}
	for _, visibility := range []string{"private", "public", "public"} {
		if _, err = db.Exec(ctx, `INSERT INTO public.collections(user_id,name,visibility) VALUES($1,'Discovery',$2)`, user, visibility); err != nil {
			t.Fatal(err)
		}
	}
	var page struct {
		Items      []PublicCollectionSummary `json:"items"`
		NextCursor *string                   `json:"nextCursor"`
	}
	w = call(CollectionHandler{DB: db}.ListPublicByPersona, "limit=1")
	if err = json.Unmarshal(w.Body.Bytes(), &page); err != nil {
		t.Fatal(err)
	}
	if len(page.Items) != 1 || page.NextCursor == nil || page.Items[0].PieceCount != 0 {
		t.Fatalf("collections page: %s", w.Body)
	}
	first := page.Items[0].ID
	w = call(CollectionHandler{DB: db}.ListPublicByPersona, "limit=1&cursor="+url.QueryEscape(*page.NextCursor))
	if err = json.Unmarshal(w.Body.Bytes(), &page); err != nil {
		t.Fatal(err)
	}
	if len(page.Items) != 1 || page.Items[0].ID == first || page.NextCursor != nil {
		t.Fatalf("collections pagination/privacy: %s", w.Body)
	}
	r := httptest.NewRequest("GET", "/", nil)
	rc := chi.NewRouteContext()
	rc.URLParams.Add("collectionID", first)
	r = r.WithContext(context.WithValue(r.Context(), chi.RouteCtxKey, rc))
	w = httptest.NewRecorder()
	CollectionHandler{DB: db}.Public(w, r)
	var collection Collection
	if json.Unmarshal(w.Body.Bytes(), &collection) != nil || collection.Curator == nil || collection.Curator.Handle != handle {
		t.Fatalf("curator: %s", w.Body)
	}
	if strings.Contains(w.Body.String(), user) {
		t.Fatal("account ID exposed")
	}
	if _, err = db.Exec(ctx, `UPDATE public.collections SET visibility='private' WHERE id=$1`, first); err != nil {
		t.Fatal(err)
	}
	w = httptest.NewRecorder()
	CollectionHandler{DB: db}.Public(w, r)
	if w.Code != 404 {
		t.Fatalf("private collection status %d", w.Code)
	}
}
